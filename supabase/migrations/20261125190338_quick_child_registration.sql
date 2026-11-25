begin;

alter table public.children add column profile_revision bigint not null default 0;

-- Keep the existing private staged duplicate workflow for both registration modes.
create or replace function private.registration_candidates(p_payload jsonb,p_mother text,p_birthplace text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare ids uuid[];phase text:='ready';initial_complete boolean;
begin
 initial_complete:=coalesce(p_payload->>'name_status','confirmed')<>'unknown' and coalesce(p_payload->>'birth_date_precision','exact')='exact' and nullif(p_payload->>'birth_date','') is not null and (p_payload->>'sex') in ('female','male','unknown');
 -- Unknown/estimated identity is preserved, never converted to invented dates.
 -- Provisional author-only records live outside public.children and are never probed.
 if not initial_complete then return jsonb_build_object('state','ready','ids','[]'::jsonb,'truncated',false,'checked',false);end if;
 select coalesce(array_agg(c.id),'{}'::uuid[]) into ids from(
  select c.id from public.children c where c.birth_date=(p_payload->>'birth_date')::date and c.birth_date_precision='exact' and (c.sex=p_payload->>'sex' or c.sex='unknown'
     or p_payload->>'sex'='unknown')
   and ((private.registration_identity_normal(c.given_name)=private.registration_identity_normal(p_payload->>'given_name') and private.registration_identity_normal(c.family_name)=private.registration_identity_normal(p_payload->>'family_name'))
    or (private.registration_identity_normal(c.family_name)=private.registration_identity_normal(p_payload->>'family_name') and left(private.registration_identity_normal(c.given_name),3)=left(private.registration_identity_normal(p_payload->>'given_name'),3))
    or (private.registration_identity_normal(c.given_name)=private.registration_identity_normal(p_payload->>'given_name') and left(private.registration_identity_normal(c.family_name),3)=left(private.registration_identity_normal(p_payload->>'family_name'),3)))
  order by c.id limit 51)c;
 if cardinality(ids)>50 then phase:='needs_review';
 elsif cardinality(ids)>0 then
  if private.registration_identity_normal(p_mother) is null or private.registration_identity_normal(p_birthplace) is null then phase:='needs_details';
  elsif exists(select 1 from private.child_duplicate_identity d where d.child_id=any(ids) and private.registration_identity_normal(d.mother_name)=private.registration_identity_normal(p_mother) and private.registration_identity_normal(d.birthplace)=private.registration_identity_normal(p_birthplace)) then phase:='need_qr';
  elsif exists(select 1 from unnest(ids) i(id) left join private.child_duplicate_identity d on d.child_id=i.id where d.child_id is null or d.mother_name is null or d.birthplace is null or private.registration_identity_normal(d.mother_name)=private.registration_identity_normal(p_mother) or private.registration_identity_normal(d.birthplace)=private.registration_identity_normal(p_birthplace)) then phase:='needs_review';
  end if;
 end if;
 return jsonb_build_object('state',phase,'ids',to_jsonb(ids),'truncated',cardinality(ids)>50,'checked',true);
end;$$;

create or replace function private.prepare_child_registration(p_operation_id uuid,p_payload jsonb,p_mother_name text default null,p_birthplace text default null,p_request_review boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;item private.registration_cases;comparison jsonb;mother text:=nullif(trim(p_mother_name),'');place text:=nullif(trim(p_birthplace),'');dob date;phase text;quick boolean:=coalesce(p_payload->'quick_registration'='true'::jsonb,false);
begin
 actor:=private.assert_doctor();
 if p_operation_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>15000
  or exists(select 1 from jsonb_object_keys(p_payload) k where k<>all(case when quick then array['quick_registration','given_name','family_name','birth_date','sex'] else array['facility_id','register_year','register_book','local_number','given_name','family_name','name_status','birth_date','birth_date_precision','sex','history_status','source_type','paper_reference','provenance_note','guardian_name','guardian_phone','duplicate_override_reason','smi_reference','parent_draft_identity_checked'] end))
 then raise exception 'Valid registration context required' using errcode='22023';end if;
 if not quick then
  perform private.assert_facility((p_payload->>'facility_id')::uuid);
 elsif coalesce(p_payload->>'birth_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
  raise exception 'Exact birth date required' using errcode='22023';
 end if;
 if (not quick and (p_payload->>'register_year' is null or (p_payload->>'register_year')::integer not between 1900 and 2200 or nullif(trim(p_payload->>'register_book'),'') is null or length(p_payload->>'register_book')>100 or nullif(trim(p_payload->>'local_number'),'') is null or length(p_payload->>'local_number')>100))
  or length(coalesce(p_payload->>'given_name',''))>100 or length(coalesce(p_payload->>'family_name',''))>100
  or coalesce(p_payload->>'sex','') not in ('female','male','unknown') or coalesce(p_payload->>'name_status','confirmed') not in ('confirmed','provisional','unknown') or coalesce(p_payload->>'birth_date_precision','exact') not in ('exact','estimated','unknown')
  or (mother is not null and length(mother) not between 2 and 200) or (place is not null and length(place) not between 2 and 200)
  or length(coalesce(p_payload->>'smi_reference',''))>100
 then raise exception 'Registration details required' using errcode='22023';end if;
 if coalesce(p_payload->>'name_status','confirmed')<>'unknown' and (nullif(trim(p_payload->>'given_name'),'') is null or nullif(trim(p_payload->>'family_name'),'') is null) then raise exception 'Full name or explicit uncertainty required' using errcode='22023';end if;
 dob:=nullif(p_payload->>'birth_date','')::date;
 if (coalesce(p_payload->>'birth_date_precision','exact')='unknown')<>(dob is null) or dob>(now() at time zone 'Africa/Casablanca')::date or dob<date '1900-01-01' then raise exception 'Valid birth date and precision required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':registration_probe',0));
 select * into item from private.registration_cases where actor_id=actor and operation_id=p_operation_id for update;
 if found then
  if item.payload is distinct from p_payload then raise exception 'Registration operation reused with different identity or context' using errcode='22023';end if;
  if item.state='committed' then return jsonb_build_object('state','committed','operation_id',p_operation_id);end if;
  if item.expires_at<=now() then raise exception 'Registration case expired' using errcode='PT409';end if;
  if item.secondary_locked and (item.mother_name is distinct from mother or item.birthplace is distinct from place) then raise exception 'Secondary comparison already recorded; use controlled review' using errcode='22023';end if;
  if item.reviewed_revision is not null or (item.secondary_locked and item.mother_name is not distinct from mother and item.birthplace is not distinct from place) then return jsonb_build_object('state',item.state,'operation_id',p_operation_id);end if;
 end if;
 if (select count(*) from private.registration_probe_events where actor_id=actor and kind in ('checked','secondary','review_requested') and created_at>now()-interval '1 hour')>=60
 or (select count(*) from private.registration_probe_events where actor_id=actor and kind in ('checked','secondary','review_requested') and created_at>now()-interval '1 minute')>=10 then
  if not exists(select 1 from private.registration_probe_events where actor_id=actor and kind='rate_limited' and created_at>now()-interval '1 minute') then insert into private.registration_probe_events(actor_id,operation_id,kind,outcome) values(actor,p_operation_id,'rate_limited','rate_limited');end if;
  return jsonb_build_object('state','rate_limited','operation_id',p_operation_id);
 end if;
 comparison:=private.registration_candidates(p_payload,mother,place);phase:=comparison->>'state';
 if p_request_review and phase in ('needs_details','need_qr') then phase:='needs_review';end if;
 if item.actor_id is null then
  insert into private.registration_cases(actor_id,operation_id,payload,mother_name,birthplace,secondary_locked,state,candidate_ids,truncated,expires_at)
  values(actor,p_operation_id,p_payload,mother,place,mother is not null and place is not null,phase,array(select jsonb_array_elements_text(comparison->'ids')::uuid),(comparison->>'truncated')::boolean,now()+case when phase in ('needs_review','need_qr') then interval '7 days' else interval '30 minutes' end);
 else
  update private.registration_cases set mother_name=mother,birthplace=place,secondary_locked=mother is not null and place is not null,state=phase,candidate_ids=array(select jsonb_array_elements_text(comparison->'ids')::uuid),truncated=(comparison->>'truncated')::boolean,expires_at=now()+case when phase in ('needs_review','need_qr') then interval '7 days' else interval '30 minutes' end,revision=revision+1 where actor_id=actor and operation_id=p_operation_id;
 end if;
 insert into private.registration_probe_events(actor_id,operation_id,kind,outcome) values(actor,p_operation_id,case when p_request_review then 'review_requested' when item.actor_id is null then 'checked' else 'secondary' end,phase);
 return jsonb_build_object('state',phase,'operation_id',p_operation_id,'checked',(comparison->>'checked')::boolean);
end;$$;

create or replace function private.register_child(p_operation_id uuid,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid;item private.registration_cases;comparison jsonb;result uuid;base jsonb;quick boolean:=coalesce(p_payload->'quick_registration'='true'::jsonb,false);
begin
 actor:=private.assert_doctor();
 select * into item from private.registration_cases where actor_id=actor and operation_id=p_operation_id for update;
 if not found then raise exception 'Registration-bound duplicate check required' using errcode='42501';end if;
 if item.payload is distinct from p_payload then raise exception 'Registration payload changed' using errcode='22023';end if;
 if item.state='committed' then return item.child_id;end if;
 if item.expires_at<=now() or item.state<>'ready' then raise exception 'Registration requires additional information or controlled review' using errcode='PT409';end if;
 -- All creators with the same birth date serialize, including near-name matches.
 perform pg_advisory_xact_lock(hashtextextended(coalesce((nullif(p_payload->>'birth_date','')::date)::text,'unknown')||':new_child',0));
 if not quick then perform private.assert_facility((p_payload->>'facility_id')::uuid); end if;
 comparison:=private.registration_candidates(p_payload,item.mother_name,item.birthplace);
 if item.reviewed_revision is null then
  if comparison->>'state'<>'ready' then raise exception 'A new possible duplicate requires another registration check' using errcode='PT409';end if;
 elsif (comparison->>'truncated')::boolean or exists(select 1 from jsonb_array_elements_text(comparison->'ids') i(id) where i.id::uuid<>all(item.candidate_ids)) then
  raise exception 'Candidate set changed after review' using errcode='PT409';
 end if;
 if quick then
  insert into public.children(given_name,family_name,name_status,birth_date,birth_date_precision,sex,created_by)
  values(trim(p_payload->>'given_name'),trim(p_payload->>'family_name'),'provisional',(p_payload->>'birth_date')::date,'exact',p_payload->>'sex',actor)
  returning id into result;
  insert into public.access_grants(child_id,professional_id,granted_by,can_manage_access)
  values(result,actor,actor,true);
 else
  base:=p_payload-array['smi_reference','parent_draft_identity_checked'];
  if item.reviewed_revision is not null and nullif(trim(base->>'duplicate_override_reason'),'') is null then base:=base||jsonb_build_object('duplicate_override_reason','Dossier distinct après revue contrôlée de l’opération '||p_operation_id::text);end if;
  result:=private.register_child_before_duplicates(p_operation_id,base);
  update public.doctor_patient_registry set smi_reference=nullif(trim(p_payload->>'smi_reference'),'') where child_id=result and professional_id=actor;
 end if;
 insert into private.child_duplicate_identity(child_id,mother_name,birthplace,recorded_by) values(result,item.mother_name,item.birthplace,actor);
 update private.registration_cases set state='committed',child_id=result,revision=revision+1 where actor_id=actor and operation_id=p_operation_id;
 insert into private.registration_probe_events(actor_id,operation_id,kind,outcome) values(actor,p_operation_id,'committed','created_new_child');
 return result;
end;$$;

create or replace function private.list_patients_base(p_query text default '',p_history text default 'all',p_age text default 'all',p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; total bigint; ids uuid[]; offset_rows integer;
begin
  perform private.assert_doctor();
  if p_query is null or length(p_query)>100 or p_page is null or p_page not between 1 and 10000 or p_history is null or p_history not in ('all','unknown','partial','reviewed') or p_age is null or p_age not in ('all','under1','1to5','over5','unknown') then raise exception 'Invalid filters' using errcode='22023'; end if;
  offset_rows:=(p_page-1)*30;
  with visible as (
    select c.id from public.children c where private.can_access_child(c.id,false) and (exists(select 1 from public.doctor_patient_registry r where r.child_id=c.id and r.professional_id=auth.uid() and strpos(lower(concat_ws(' ',c.given_name,c.family_name,c.universal_id::text,c.guardian_phone,r.local_number)),lower(p_query))>0)
      or (c.created_by=auth.uid()
        and private.has_standard_child_access(c.id,false)
        and strpos(lower(concat_ws(' ',c.given_name,c.family_name,c.universal_id::text,c.guardian_phone)),lower(p_query))>0))
    and (p_history='all' or c.history_status=p_history)
    and (p_age='all' or (p_age='unknown' and c.birth_date_precision<>'exact') or (c.birth_date_precision='exact' and ((p_age='under1' and c.birth_date>((now() at time zone 'Africa/Casablanca')::date-interval '1 year')) or (p_age='1to5' and c.birth_date<=((now() at time zone 'Africa/Casablanca')::date-interval '1 year') and c.birth_date>((now() at time zone 'Africa/Casablanca')::date-interval '6 years')) or (p_age='over5' and c.birth_date<=((now() at time zone 'Africa/Casablanca')::date-interval '6 years')))))
  ) select count(*) into total from visible;
  with visible as (
    select c.id from public.children c where private.can_access_child(c.id,false) and (exists(select 1 from public.doctor_patient_registry r where r.child_id=c.id and r.professional_id=auth.uid() and strpos(lower(concat_ws(' ',c.given_name,c.family_name,c.universal_id::text,c.guardian_phone,r.local_number)),lower(p_query))>0)
      or (c.created_by=auth.uid()
        and private.has_standard_child_access(c.id,false)
        and strpos(lower(concat_ws(' ',c.given_name,c.family_name,c.universal_id::text,c.guardian_phone)),lower(p_query))>0))
    and (p_history='all' or c.history_status=p_history)
    and (p_age='all' or (p_age='unknown' and c.birth_date_precision<>'exact') or (c.birth_date_precision='exact' and ((p_age='under1' and c.birth_date>((now() at time zone 'Africa/Casablanca')::date-interval '1 year')) or (p_age='1to5' and c.birth_date<=((now() at time zone 'Africa/Casablanca')::date-interval '1 year') and c.birth_date>((now() at time zone 'Africa/Casablanca')::date-interval '6 years')) or (p_age='over5' and c.birth_date<=((now() at time zone 'Africa/Casablanca')::date-interval '6 years')))))
    order by c.created_at desc,c.id limit 30 offset offset_rows
  ) select coalesce(array_agg(id),'{}'::uuid[]) into ids from visible;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'universal_id',c.universal_id,'given_name',c.given_name,'family_name',c.family_name,'name_status',c.name_status,'birth_date',c.birth_date,'birth_date_precision',c.birth_date_precision,'sex',c.sex,'history_status',c.history_status,'source_type',c.source_type,
    'registers',(select jsonb_agg(jsonb_build_object('id',r.id,'facility_id',r.facility_id,'facility_name',f.name,'year',r.register_year,'book',r.register_book,'number',r.local_number)) from public.doctor_patient_registry r join public.facilities f on f.id=r.facility_id where r.child_id=c.id and r.professional_id=auth.uid())) order by c.created_at desc,c.id),'[]'::jsonb) into result from public.children c where c.id=any(ids);
  insert into public.audit_events(actor_id,entity_id,entity_type,action) select auth.uid(),id,'child_registry_read','accessed' from unnest(ids) id;
  return jsonb_build_object('items',result,'total',total,'page',p_page);
end;
$$;

create or replace function private.registry_summary() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.assert_doctor();
  return (with visible as (
    select c.history_status from public.children c where
      (c.created_by=auth.uid() and private.has_standard_child_access(c.id,false))
      or (exists(select 1 from public.doctor_patient_registry r where r.child_id=c.id and r.professional_id=auth.uid()) and private.can_access_child(c.id,false))
  ) select jsonb_build_object('patients',(select count(*) from visible),
    'uncertain_history',(select count(*) from visible where history_status<>'reviewed'),
    'pending_requests',(select count(*) from public.child_access_requests r where r.status='pending' and private.can_access_child(r.child_id,true)),
    'facilities',(select count(*) from public.professional_facilities m where m.professional_id=auth.uid() and m.revoked_at is null)));
end;
$$;

create or replace function private.get_child_profile(p_child_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.can_access_child(p_child_id,false) then raise exception 'Child access denied' using errcode='42501'; end if;
  select to_jsonb(c)||jsonb_build_object('can_manage_access',private.can_access_child(c.id,true),'created_by_professional_id',p.professional_id,
    'registers',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'facility_id',r.facility_id,'facility_name',f.name,'year',r.register_year,'book',r.register_book,'number',r.local_number,'smi_reference',r.smi_reference) order by r.created_at,r.id) from public.doctor_patient_registry r join public.facilities f on f.id=r.facility_id where r.child_id=c.id and r.professional_id=auth.uid()),'[]'::jsonb))
    into result from public.children c join public.professional_profiles p on p.user_id=c.created_by where c.id=p_child_id;
  insert into public.audit_events(actor_id,entity_id,entity_type,action) values (auth.uid(),p_child_id,'child_profile_read','accessed');
  return result;
end;
$$;

-- Standard dossier managers can edit demographics and their own register only.
create function private.update_child_information(
  p_operation_id uuid, p_child_id uuid, p_expected_revision bigint, p_details jsonb,
  p_register jsonb default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=private.assert_doctor();
  child public.children;
  register_id uuid;
  existing public.doctor_patient_registry;
  facility uuid;
  dob date;
  receipt jsonb:=jsonb_build_object('child_id',p_child_id,'revision',p_expected_revision,'details',p_details,'register',p_register);
begin
  perform pg_advisory_xact_lock(hashtextextended(p_child_id::text,0));
  if not private.has_standard_child_access(p_child_id,true) then
    raise exception 'Standard dossier management authorization required' using errcode='42501';
  end if;
  if private.operation_result(p_operation_id,'update_child_information',receipt) is not null then
    return p_child_id;
  end if;

  select * into strict child from public.children where id=p_child_id for update;
  if p_expected_revision is distinct from child.profile_revision then
    raise exception 'Child information changed; reload before editing' using errcode='PT409';
  end if;
  if p_details is null or jsonb_typeof(p_details)<>'object' or octet_length(p_details::text)>15000
    or exists(select 1 from jsonb_object_keys(p_details) k where k not in (
      'given_name','family_name','name_status','birth_date','birth_date_precision','sex',
      'history_status','paper_reference','provenance_note','guardian_name','guardian_phone'))
    or coalesce(p_details->>'name_status','') not in ('confirmed','provisional','unknown')
    or coalesce(p_details->>'birth_date_precision','') not in ('exact','estimated','unknown')
    or coalesce(p_details->>'sex','') not in ('female','male','unknown')
    or coalesce(p_details->>'history_status','') not in ('unknown','partial','reviewed')
    or length(p_details->>'given_name')>100 or length(p_details->>'family_name')>100
    or (p_details->>'name_status'='unknown') is distinct from
      (nullif(trim(p_details->>'given_name'),'') is null and nullif(trim(p_details->>'family_name'),'') is null)
    or (p_details->>'name_status'<>'unknown' and
      (nullif(trim(p_details->>'given_name'),'') is null or nullif(trim(p_details->>'family_name'),'') is null))
    or coalesce(p_details->>'birth_date','') !~ '^([0-9]{4}-[0-9]{2}-[0-9]{2})?$'
  then raise exception 'Invalid child details' using errcode='22023'; end if;
  dob:=nullif(p_details->>'birth_date','')::date;
  if (p_details->>'birth_date_precision'='unknown')<>(dob is null)
    or dob not between date '1900-01-01' and (now() at time zone 'Africa/Casablanca')::date then
    raise exception 'Invalid birth date' using errcode='22023';
  end if;
  if p_details->>'birth_date_precision'='exact' then
    perform pg_advisory_xact_lock(hashtextextended(dob::text||':new_child',0));
    if (dob is distinct from child.birth_date or child.birth_date_precision<>'exact') and exists (
      select 1 from (
        select distinct on (root_id) occurred_on,entry_state
        from public.clinical_entries where child_id=p_child_id order by root_id,revision desc
      ) latest where entry_state='active' and occurred_on<dob
    ) then raise exception 'Birth date follows documented care' using errcode='PT422'; end if;
  end if;

  if p_register is not null then
    if jsonb_typeof(p_register)<>'object' or octet_length(p_register::text)>2000
      or exists(select 1 from jsonb_object_keys(p_register) k where k not in ('id','facility_id','year','book','number','smi_reference'))
      or coalesce(p_register->>'year','') !~ '^[0-9]{4}$' or (p_register->>'year')::integer not between 1900 and 2200
      or coalesce(length(trim(p_register->>'book')),0) not between 1 and 100
      or coalesce(length(trim(p_register->>'number')),0) not between 1 and 100
      or length(p_register->>'smi_reference')>100 then
      raise exception 'A complete register reference is required' using errcode='22023';
    end if;
    register_id:=nullif(p_register->>'id','')::uuid;
    facility:=(p_register->>'facility_id')::uuid;
    if register_id is not null then
      select * into existing from public.doctor_patient_registry
        where id=register_id and child_id=p_child_id and professional_id=actor for update;
      if not found then raise exception 'Own register entry required' using errcode='42501'; end if;
    end if;
    if register_id is null or facility is distinct from existing.facility_id
      or (p_register->>'year')::integer<>existing.register_year
      or trim(p_register->>'book')<>existing.register_book or trim(p_register->>'number')<>existing.local_number
      or nullif(trim(p_register->>'smi_reference'),'') is distinct from existing.smi_reference then
      perform private.assert_facility(facility);
      if register_id is null then
        insert into public.doctor_patient_registry(professional_id,child_id,facility_id,register_year,register_book,local_number,smi_reference)
        values(actor,p_child_id,facility,(p_register->>'year')::integer,trim(p_register->>'book'),trim(p_register->>'number'),nullif(trim(p_register->>'smi_reference'),''));
      else
        update public.doctor_patient_registry set facility_id=facility,register_year=(p_register->>'year')::integer,
          register_book=trim(p_register->>'book'),local_number=trim(p_register->>'number'),smi_reference=nullif(trim(p_register->>'smi_reference'),'')
          where id=register_id and child_id=p_child_id and professional_id=actor;
      end if;
    end if;
  end if;

  update public.children set
    given_name=nullif(trim(p_details->>'given_name'),''), family_name=nullif(trim(p_details->>'family_name'),''),
    name_status=p_details->>'name_status', birth_date=dob, birth_date_precision=p_details->>'birth_date_precision',
    sex=p_details->>'sex', history_status=p_details->>'history_status',
    paper_reference=case when source_type='paper_transcription' then nullif(trim(p_details->>'paper_reference'),'') else child.paper_reference end,
    provenance_note=nullif(trim(p_details->>'provenance_note'),''),
    guardian_name=nullif(trim(p_details->>'guardian_name'),''), guardian_phone=nullif(trim(p_details->>'guardian_phone'),''),
    profile_revision=child.profile_revision+1
    where id=p_child_id;
  insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id)
    values(actor,p_operation_id,'update_child_information',receipt,p_child_id);
  return p_child_id;
end;
$$;

create function public.update_child_information(
  p_operation_id uuid, p_child_id uuid, p_expected_revision bigint, p_details jsonb,
  p_register jsonb default null
) returns uuid language sql security invoker set search_path='' as $$
  select private.update_child_information(p_operation_id,p_child_id,p_expected_revision,p_details,p_register);
$$;
revoke all on function private.update_child_information(uuid,uuid,bigint,jsonb,jsonb),
  public.update_child_information(uuid,uuid,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.update_child_information(uuid,uuid,bigint,jsonb,jsonb),
  public.update_child_information(uuid,uuid,bigint,jsonb,jsonb) to authenticated;

commit;
