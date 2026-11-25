begin;

alter table private.vaccination_booklet_reviews
 add column uncertain boolean not null default false;
alter table private.vaccination_booklet_reviews
 alter column recommended_end drop not null;

create or replace function private.vaccination_booklet_reviews(p_child_id uuid,p_version_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.assert_doctor();
 if not coalesce(private.can_access_child(p_child_id,false),false) then
  raise exception 'Child access denied' using errcode='42501';
 end if;
 return (
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'dose_code',r.dose_code,
   'outstanding',r.outstanding and not exists (
    select 1 from public.clinical_entries e
    join public.vaccine_rules rule on (rule.version_id,rule.dose_code)=(r.version_id,r.dose_code)
    where e.child_id=r.child_id and e.kind='vaccination' and e.recorded_at >= r.recorded_at
     and upper(btrim(e.payload->>'vaccine_code'))=upper(rule.vaccine_code)
     and upper(btrim(e.payload->>'dose_label'))=upper(rule.dose_code)
   ),'recommended_end',r.recommended_end) || case when r.uncertain then '{"uncertain":true}'::jsonb else '{}'::jsonb end), '[]'::jsonb)
  from (
   select distinct on (dose_code) * from private.vaccination_booklet_reviews
   where child_id=p_child_id and version_id=p_version_id
   order by dose_code,recorded_at desc,id desc
  ) r
 );
end;
$$;

create function private.verify_booklet_dose(
 p_operation_id uuid,p_child_id uuid,p_version_id uuid,p_dose_code text,
 p_expected_id uuid,p_decision text,p_administered_on date,p_reason text
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; rule public.vaccine_rules; child public.children;
 deadline date; previous_id uuid; result uuid; item uuid; facility uuid;
 practices uuid[]; registered uuid[]; label text; reason text:=btrim(p_reason);
 request jsonb:=jsonb_build_array(p_child_id,p_version_id,p_dose_code,p_expected_id,p_decision,p_administered_on,reason);
begin
 actor:=private.assert_doctor();
 perform pg_advisory_xact_lock(hashtextextended(p_child_id::text,0));
 if not coalesce(private.can_access_child(p_child_id,false),false) or not private.has_clinical_capability('vaccination') then
  raise exception 'Vaccination capability and child access required' using errcode='42501';
 end if;
 result:=private.operation_result(p_operation_id,'booklet_verification',request);
 if result is not null then return result; end if;
 if p_decision is null or p_decision not in ('administered','not_administered','uncertain')
  or (p_administered_on is not null) is distinct from (p_decision='administered')
  or (p_decision<>'uncertain' and coalesce(length(reason),0) not between 10 and 1000)
  or length(reason)>1000 then
  raise exception 'Invalid vaccination verification' using errcode='22023';
 end if;
 perform 1 from public.vaccine_versions where id=p_version_id and status='approved' and review_verified for share;
 if not found or p_version_id is distinct from private.routine_schedule_version(false) then
  raise exception 'Approved reference changed' using errcode='PT409';
 end if;
 select * into rule from public.vaccine_rules where version_id=p_version_id and dose_code=p_dose_code;
 if not found then raise exception 'Unknown dose reference' using errcode='22023'; end if;
 select * into child from public.children where id=p_child_id;
 if rule.eligibility='female' and child.sex is distinct from 'female' then
  raise exception 'Eligibility not established' using errcode='22023';
 end if;
 select id into previous_id from private.vaccination_booklet_reviews
 where child_id=p_child_id and version_id=p_version_id and dose_code=p_dose_code
 order by recorded_at desc,id desc limit 1;
 if previous_id is distinct from p_expected_id then
  raise exception 'Review changed; reload before saving' using errcode='PT409';
 end if;

 if p_decision<>'uncertain' and exists (
  select 1 from (
   select distinct on (e.root_id) e.id,e.entry_state,e.payload
   from public.clinical_entries e where e.child_id=p_child_id and e.kind='vaccination'
   order by e.root_id,e.revision desc
  ) latest left join public.vaccination_entry_links l on l.entry_id=latest.id
  left join public.child_vaccine_items prior on prior.id=l.item_id
  where latest.entry_state='active' and upper(btrim(latest.payload->>'vaccine_code'))=upper(rule.vaccine_code)
   and upper(btrim(coalesce(prior.dose_code,latest.payload->>'dose_label')))=upper(p_dose_code)
 ) then
  raise exception 'Existing vaccination documentation must be corrected in its history' using errcode='PT409',hint='booklet_existing_record';
 end if;

 if p_decision='administered' then
  -- This is the clinician's recording facility, never the administration location.
  select array_agg(m.facility_id) into practices from public.professional_facilities m
  where m.professional_id=actor and m.revoked_at is null;
  select array_agg(distinct r.facility_id) into registered from public.doctor_patient_registry r
  where r.child_id=p_child_id and r.professional_id=actor and r.facility_id=any(practices);
  facility:=case when cardinality(registered)=1 then registered[1]
   when cardinality(practices)=1 then practices[1] end;
  if facility is null then
   raise exception 'Recording facility requires explicit selection' using errcode='22023',hint='booklet_facility';
  end if;

  if rule.automatic_scheduling and p_dose_code not in ('HBn','HB1') then
   select i.id into item from public.child_vaccine_items i
   join public.vaccine_rules r on (r.version_id,r.dose_code)=(i.version_id,i.dose_code)
   join public.vaccine_versions v on v.id=r.version_id
   where i.child_id=p_child_id and i.dose_code=p_dose_code and r.vaccine_code=rule.vaccine_code
    and v.status in ('approved','retired') and v.review_verified and private.vaccine_item_active(i.id)
   order by (i.version_id=p_version_id) desc,i.created_at desc limit 1;
   if item is null then
    item:=private.assign_vaccine_item(gen_random_uuid(),p_child_id,p_version_id,p_dose_code,facility,reason,true);
   end if;
  end if;
  select coalesce(s.document->'vaccines'->rule.vaccine_code->>'label_fr',rule.vaccine_code) into label
  from public.vaccine_versions v join private.vaccine_sources s on s.id=v.source_id where v.id=p_version_id;
  result:=private.write_clinical_entry(gen_random_uuid(),p_child_id,'vaccination',facility,
   p_administered_on,'exact','paper_transcription',reason,true,
   jsonb_build_object('vaccine_code',rule.vaccine_code,'vaccine_label',label,'dose_label',p_dose_code,
    'lot_status','unknown','site_status','unknown','provider_status','unknown','administration_facility_status','unknown',
    'matching_status',case when item is null then 'unmatched' else 'clinician_validated' end,
    'schedule_item_id',coalesce(item::text,'')));
 else
  if child.birth_date_precision='exact' and rule.automatic_scheduling and p_dose_code not in ('HBn','HB1') then
   deadline:=case rule.age->>'unit'
    when 'first_4_weeks' then child.birth_date+27
    when 'weeks' then child.birth_date+(rule.age->>'value')::int*7
    when 'months' then (child.birth_date+make_interval(months=>(rule.age->>'value')::int))::date
    when 'years' then (child.birth_date+make_interval(years=>(rule.age->>'value')::int))::date
   end;
  end if;
  if p_decision='not_administered' and (deadline is null or exists (
   select 1 from public.child_vaccine_items i where i.child_id=p_child_id
    and (i.version_id,i.dose_code)=(p_version_id,p_dose_code) and not private.vaccine_item_active(i.id)
  )) then
   raise exception 'No active routine date for this dose' using errcode='22023';
  end if;
  insert into private.vaccination_booklet_reviews(child_id,version_id,dose_code,recommended_end,outstanding,uncertain,actor_id,reason)
  values(p_child_id,p_version_id,p_dose_code,deadline,p_decision='not_administered',p_decision='uncertain',
   actor,coalesce(nullif(reason,''),'Information non confirmée par le soignant.')) returning id into result;
 end if;
 insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id)
 values(actor,p_operation_id,'booklet_verification',request,result);
 return result;
end;
$$;

create function public.verify_booklet_dose(
 p_operation_id uuid,p_child_id uuid,p_version_id uuid,p_dose_code text,
 p_expected_id uuid,p_decision text,p_administered_on date,p_reason text
) returns uuid language sql security invoker set search_path='' as $$
 select private.verify_booklet_dose(p_operation_id,p_child_id,p_version_id,p_dose_code,
  p_expected_id,p_decision,p_administered_on,p_reason);
$$;

revoke all on function private.verify_booklet_dose(uuid,uuid,uuid,text,uuid,text,date,text),
 public.verify_booklet_dose(uuid,uuid,uuid,text,uuid,text,date,text) from public,anon,authenticated;
grant execute on function private.verify_booklet_dose(uuid,uuid,uuid,text,uuid,text,date,text),
 public.verify_booklet_dose(uuid,uuid,uuid,text,uuid,text,date,text) to authenticated;

commit;
