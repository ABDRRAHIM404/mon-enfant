begin;

-- A review records an explicit finding about one overdue reference. It is
-- separate from a dose administration and has no effect on appointment rules.
create table private.vaccination_booklet_reviews (
 id uuid primary key default gen_random_uuid(),
 child_id uuid not null references public.children(id),
 version_id uuid not null,
 dose_code text not null,
 recommended_end date not null,
 outstanding boolean not null,
 actor_id uuid not null references public.professional_profiles(user_id),
 reason text not null check (char_length(reason) between 10 and 1000),
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key (version_id,dose_code) references public.vaccine_rules(version_id,dose_code)
);
create index vaccination_booklet_review_lookup on private.vaccination_booklet_reviews
 (child_id,version_id,dose_code,recorded_at desc,id desc);
alter table private.vaccination_booklet_reviews enable row level security;
revoke all on private.vaccination_booklet_reviews from public,anon,authenticated;
create trigger vaccination_booklet_review_immutable before update or delete on private.vaccination_booklet_reviews
 for each row execute function private.prevent_mutation();

create function private.vaccination_booklet_reviews(p_child_id uuid,p_version_id uuid) returns jsonb
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
   ),'recommended_end',r.recommended_end)), '[]'::jsonb)
  from (
   select distinct on (dose_code) * from private.vaccination_booklet_reviews
   where child_id=p_child_id and version_id=p_version_id
   order by dose_code,recorded_at desc,id desc
  ) r
 );
end;
$$;

create function private.review_booklet_dose(
 p_operation_id uuid,p_child_id uuid,p_version_id uuid,p_dose_code text,
 p_expected_id uuid,p_outstanding boolean,p_reason text
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; matching_rule public.vaccine_rules; child public.children;
 deadline date; previous_id uuid; previous_state boolean; result uuid;
 request jsonb:=jsonb_build_array(p_child_id,p_version_id,p_dose_code,p_expected_id,p_outstanding,btrim(p_reason));
begin
 actor:=private.assert_doctor();
 perform pg_advisory_xact_lock(hashtextextended(p_child_id::text,0));
 if not coalesce(private.can_access_child(p_child_id,false),false) or not private.has_clinical_capability('vaccination') then
  raise exception 'Vaccination capability and child access required' using errcode='42501';
 end if;
 result:=private.operation_result(p_operation_id,'booklet_dose_review',request);
 if result is not null then return result; end if;
 if p_outstanding is null or p_reason is null or char_length(btrim(p_reason)) not between 10 and 1000 then
  raise exception 'A review reason is required' using errcode='22023';
 end if;
 perform 1 from public.vaccine_versions where id=p_version_id and status='approved' and review_verified for share;
 if not found or p_version_id is distinct from private.routine_schedule_version(false) then
  raise exception 'Approved reference changed' using errcode='PT409';
 end if;
 select * into matching_rule from public.vaccine_rules where version_id=p_version_id and dose_code=p_dose_code;
 if not found then raise exception 'Unknown dose reference' using errcode='22023'; end if;
 select * into child from public.children where id=p_child_id;
 deadline:=case matching_rule.age->>'unit'
  when 'first_4_weeks' then child.birth_date+27
  when 'weeks' then child.birth_date+(matching_rule.age->>'value')::int*7
  when 'months' then (child.birth_date+make_interval(months=>(matching_rule.age->>'value')::int))::date
  when 'years' then (child.birth_date+make_interval(years=>(matching_rule.age->>'value')::int))::date
 end;
 if deadline is null or child.birth_date_precision<>'exact' or not matching_rule.automatic_scheduling
  or p_dose_code in ('HBn','HB1') or (matching_rule.eligibility='female' and child.sex<>'female')
  or deadline >= (now() at time zone 'Africa/Casablanca')::date then
  raise exception 'Dose is not eligible for overdue review' using errcode='22023';
 end if;
 select (review->>'id')::uuid,(review->>'outstanding')::boolean into previous_id,previous_state
 from jsonb_array_elements(private.vaccination_booklet_reviews(p_child_id,p_version_id)) review
 where review->>'dose_code'=p_dose_code;
 if previous_id is distinct from p_expected_id or coalesce(previous_state,false)=p_outstanding then
  raise exception 'Review changed; reload before saving' using errcode='PT409';
 end if;
 if p_outstanding and (
  exists (select 1 from public.child_vaccine_items i where i.child_id=p_child_id
   and (i.version_id,i.dose_code)=(p_version_id,p_dose_code) and not private.vaccine_item_active(i.id))
  or exists (
   select 1 from (
    select distinct on (e.root_id) e.id,e.entry_state,e.payload
    from public.clinical_entries e where e.child_id=p_child_id and e.kind='vaccination'
    order by e.root_id,e.revision desc
   ) latest left join public.vaccination_entry_links l on l.entry_id=latest.id
   left join public.child_vaccine_items item on item.id=l.item_id
   where latest.entry_state='active' and upper(btrim(latest.payload->>'vaccine_code'))=upper(matching_rule.vaccine_code)
    and upper(btrim(coalesce(item.dose_code,latest.payload->>'dose_label')))=upper(p_dose_code)
  )
 ) then
  raise exception 'Existing vaccination documentation must be reviewed' using errcode='PT409';
 end if;
 insert into private.vaccination_booklet_reviews(child_id,version_id,dose_code,recommended_end,outstanding,actor_id,reason)
 values(p_child_id,p_version_id,p_dose_code,deadline,p_outstanding,actor,btrim(p_reason)) returning id into result;
 insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id)
 values(actor,p_operation_id,'booklet_dose_review',request,result);
 return result;
end;
$$;

create function public.vaccination_booklet_reviews(p_child_id uuid,p_version_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select private.vaccination_booklet_reviews(p_child_id,p_version_id);
$$;

create function public.review_booklet_dose(
 p_operation_id uuid,p_child_id uuid,p_version_id uuid,p_dose_code text,
 p_expected_id uuid,p_outstanding boolean,p_reason text
) returns uuid language sql security invoker set search_path='' as $$
 select private.review_booklet_dose(p_operation_id,p_child_id,p_version_id,p_dose_code,p_expected_id,p_outstanding,p_reason);
$$;

revoke all on function private.vaccination_booklet_reviews(uuid,uuid), public.vaccination_booklet_reviews(uuid,uuid),
 private.review_booklet_dose(uuid,uuid,uuid,text,uuid,boolean,text), public.review_booklet_dose(uuid,uuid,uuid,text,uuid,boolean,text)
 from public,anon,authenticated;
grant execute on function private.vaccination_booklet_reviews(uuid,uuid), public.vaccination_booklet_reviews(uuid,uuid),
 private.review_booklet_dose(uuid,uuid,uuid,text,uuid,boolean,text), public.review_booklet_dose(uuid,uuid,uuid,text,uuid,boolean,text)
 to authenticated;
commit;
