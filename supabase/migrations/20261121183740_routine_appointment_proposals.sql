-- Proposed dates are a read model. Confirmation creates a single audited visit.
create table private.appointment_routine_doses (
 appointment_id uuid not null references public.appointments(id),
 item_id uuid not null references public.child_vaccine_items(id),
 recommended_on date not null,
 primary key (appointment_id, item_id)
);
create index appointment_routine_doses_item_idx on private.appointment_routine_doses(item_id);
alter table private.appointment_routine_doses enable row level security;
revoke all on private.appointment_routine_doses from public, anon, authenticated;
create trigger appointment_routine_doses_immutable before update or delete on private.appointment_routine_doses
 for each row execute function private.prevent_mutation();

create function private.routine_schedule_version(p_include_draft boolean) returns uuid
language sql stable set search_path='' as $$
 select id from public.vaccine_versions
 where (status='approved' and review_verified)
    or (p_include_draft and status='draft' and id='0c504568-7c67-49bb-b43b-c8382439a850')
 order by (status='approved') desc, created_at desc, id limit 1;
$$;

create function private.routine_appointment_candidates(p_child uuid,p_version uuid)
returns table (dose_code text, item_id uuid, recommended_on date, dose_label text)
language sql stable set search_path='' as $$
 with child as (
  select * from public.children where id=p_child and birth_date_precision='exact'
   and birth_date <= (now() at time zone 'Africa/Casablanca')::date
 ), latest as materialized (
  select distinct on (e.root_id) e.id,e.entry_state,e.payload
  from public.clinical_entries e where e.child_id=p_child and e.kind='vaccination'
  order by e.root_id,e.revision desc
 )
 select r.dose_code,i.id,d.due,
  coalesce(s.document->'vaccines'->r.vaccine_code->>'label_fr',r.vaccine_code)
 from child c
 join public.vaccine_rules r on r.version_id=p_version
 join public.vaccine_versions v on v.id=r.version_id
 join private.vaccine_sources s on s.id=v.source_id
 left join public.child_vaccine_items i on i.child_id=c.id and i.version_id=r.version_id and i.dose_code=r.dose_code
 cross join lateral (select case r.age->>'unit'
  when 'weeks' then c.birth_date+(r.age->>'value')::int*7
  when 'months' then (c.birth_date+make_interval(months=>(r.age->>'value')::int))::date
  when 'years' then (c.birth_date+make_interval(years=>(r.age->>'value')::int))::date
 end due) d
 where r.automatic_scheduling and r.dose_code not in ('HBn','HB1')
  and (r.eligibility='all' or c.sex='female')
  and d.due >= (now() at time zone 'Africa/Casablanca')::date
  and (i.id is null or private.vaccine_item_active(i.id))
  and not exists (
   select 1 from latest e
   left join public.vaccination_entry_links l on l.entry_id=e.id
   left join public.child_vaccine_items mapped on mapped.id=l.item_id
   where e.entry_state='active'
   and (mapped.dose_code=r.dose_code or (
    upper(btrim(e.payload->>'vaccine_code'))=upper(r.vaccine_code)
    and upper(btrim(e.payload->>'dose_label'))=upper(r.dose_code)
   ))
  )
  and not exists (
   select 1 from public.appointments a
   cross join lateral (select state from public.appointment_events where appointment_id=a.id order by revision desc limit 1) event
   join lateral (
    select a.vaccine_item_id item
    union
    select item_id from private.appointment_routine_doses where appointment_id=a.id
   ) booked on true
   join public.child_vaccine_items existing on existing.id=booked.item
   where a.child_id=c.id and a.purpose='vaccination' and existing.dose_code=r.dose_code
    and event.state in ('scheduled','missed')
  );
$$;

create function private.routine_appointment_proposals(p_page integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; version uuid; preview boolean; result jsonb;
begin
 actor:=private.assert_doctor();
 if p_page is null or p_page not between 1 and 10000 then
  raise exception 'Invalid proposal page' using errcode='22023';
 end if;
 version:=private.routine_schedule_version(true);
 select status='draft' into preview from public.vaccine_versions where id=version;
 with scope as materialized (
  select child_id from public.access_grants where professional_id=actor
  union
  select child_id from public.doctor_patient_registry where professional_id=actor
  union
  select child_id from private.clinician_shares where recipient_id=actor
   and scope='care_visit' and recipient_session::text=auth.jwt()->>'session_id'
   and revoked_at is null and consumed_at>now()-interval '1 hour'
 ), authorized as materialized (
  select child_id from scope where version is not null and private.can_access_child(child_id,false)
 ), groups as materialized (
  select c.id child_id,c.given_name,c.family_name,c.sex,c.birth_date,r.recommended_on,
   jsonb_agg(jsonb_build_object('code',r.dose_code,'label',r.dose_label) order by r.dose_code) doses,
   bool_or(r.item_id is null) requires_assignment
  from authorized a join public.children c on c.id=a.child_id
  cross join lateral private.routine_appointment_candidates(c.id,version) r
  group by c.id,r.recommended_on
 ), page as (
  select * from groups order by recommended_on,child_id limit 3 offset (p_page-1)*3
 )
 select jsonb_build_object('version',version,'preview',coalesce(preview,false),'total',(select count(*) from groups),
  'items',coalesce((select jsonb_agg(to_jsonb(page) order by recommended_on,child_id) from page),'[]'::jsonb))
 into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action)
 select actor,(item->>'child_id')::uuid,'routine_proposal_read','accessed'
 from jsonb_array_elements(result->'items') item group by item->>'child_id';
 return result;
end;$$;

create function private.confirm_routine_appointment(
 p_operation_id uuid,p_child_id uuid,p_version_id uuid,p_recommended_on date,p_doses text[],
 p_facility_id uuid,p_starts_at text,p_ends_at text,p_reason text,p_reviewed boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; result uuid; dose record; item uuid; items uuid[]:='{}'; expected text[];
 payload jsonb:=jsonb_build_array(p_child_id,p_version_id,p_recommended_on,p_doses,
  p_facility_id,p_starts_at,p_ends_at,p_reason,p_reviewed);
begin
 actor:=private.assert_doctor();
 perform pg_advisory_xact_lock(hashtextextended(p_child_id::text,0));
 if not coalesce(private.can_access_child(p_child_id,false),false) or not private.has_clinical_capability('appointment') then
  raise exception 'Appointment capability and child access required' using errcode='42501';
 end if;
 perform private.assert_facility(p_facility_id);
 result:=private.operation_result(p_operation_id,'routine_appointment_confirm',payload);
 if result is not null then return result; end if;
 perform 1 from public.vaccine_versions where id=p_version_id and status='approved' and review_verified for share;
 if not found or p_version_id is distinct from private.routine_schedule_version(false) then
  raise exception 'Approved reference changed or unavailable' using errcode='PT409';
 end if;
 if private.appointment_instant(p_starts_at)<=now() then
  raise exception 'A future slot is required' using errcode='22023';
 end if;
 select array_agg(dose_code order by dose_code) into expected
 from private.routine_appointment_candidates(p_child_id,p_version_id) where recommended_on=p_recommended_on;
 if expected is null or expected is distinct from p_doses then
  raise exception 'Proposal changed; reload before confirming' using errcode='PT409';
 end if;
 for dose in
  select * from private.routine_appointment_candidates(p_child_id,p_version_id)
  where recommended_on=p_recommended_on order by dose_code
 loop
  item:=coalesce(dose.item_id,private.assign_vaccine_item(gen_random_uuid(),p_child_id,p_version_id,
   dose.dose_code,p_facility_id,p_reason,p_reviewed));
  perform private.assert_appointment_item(p_child_id,item);
  items:=array_append(items,item);
 end loop;
 result:=private.create_appointment(gen_random_uuid(),p_child_id,p_facility_id,'vaccination',
  'Rendez-vous vaccinal',items[1],p_starts_at,p_ends_at,p_reason,p_reviewed);
 insert into private.appointment_routine_doses(appointment_id,item_id,recommended_on)
 select result,id,p_recommended_on from unnest(items) id;
 insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id)
 values(actor,p_operation_id,'routine_appointment_confirm',payload,result);
 return result;
end;$$;

create function public.routine_appointment_proposals(p_page integer default 1) returns jsonb
language sql security invoker set search_path='' as $$
 select private.routine_appointment_proposals(p_page);
$$;
create function public.confirm_routine_appointment(
 p_operation_id uuid,p_child_id uuid,p_version_id uuid,p_recommended_on date,p_doses text[],
 p_facility_id uuid,p_starts_at text,p_ends_at text,p_reason text,p_reviewed boolean
) returns uuid language sql security invoker set search_path='' as $$
 select private.confirm_routine_appointment(p_operation_id,p_child_id,p_version_id,p_recommended_on,p_doses,
  p_facility_id,p_starts_at,p_ends_at,p_reason,p_reviewed);
$$;

revoke all on function private.routine_schedule_version(boolean),private.routine_appointment_candidates(uuid,uuid)
 from public,anon,authenticated;
revoke all on function public.routine_appointment_proposals(integer),private.routine_appointment_proposals(integer),
 public.confirm_routine_appointment(uuid,uuid,uuid,date,text[],uuid,text,text,text,boolean),
 private.confirm_routine_appointment(uuid,uuid,uuid,date,text[],uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.routine_appointment_proposals(integer),private.routine_appointment_proposals(integer),
 public.confirm_routine_appointment(uuid,uuid,uuid,date,text[],uuid,text,text,text,boolean),
 private.confirm_routine_appointment(uuid,uuid,uuid,date,text[],uuid,text,text,text,boolean) to authenticated;

create function private.routine_appointment_status(p_appointment uuid)
returns table (recommended_on date,dose_codes text[],needs_review boolean,documented boolean,documentation jsonb)
language sql stable set search_path='' as $$
 with doses as (
  select d.recommended_on,i.dose_code,
   (not private.vaccine_item_active(i.id) or (r.eligibility='female' and c.sex<>'female')) needs_review,
   private.item_documentation(i.id) evidence
  from private.appointment_routine_doses d
  join public.child_vaccine_items i on i.id=d.item_id
  join public.vaccine_rules r on (r.version_id,r.dose_code)=(i.version_id,i.dose_code)
  join public.children c on c.id=i.child_id
  where d.appointment_id=p_appointment
 )
 select min(recommended_on),array_agg(dose_code order by dose_code),bool_or(needs_review),
  bool_and(evidence is not null),
  (array_agg(evidence order by evidence->>'recorded_at' desc,dose_code) filter (where evidence is not null))[1]
 from doses having count(*)>0;
$$;
revoke all on function private.routine_appointment_status(uuid) from public,anon,authenticated;

create or replace function private.assert_open_appointment(p_item_id uuid,p_except uuid default null) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if p_item_id is not null and exists (
  select 1 from public.child_vaccine_items requested
  join public.appointments a on a.child_id=requested.child_id and a.purpose='vaccination'
  cross join lateral (select state from public.appointment_events where appointment_id=a.id order by revision desc limit 1) event
  where requested.id=p_item_id and a.id is distinct from p_except and event.state in ('scheduled','missed')
   and ((a.responsible_id=auth.uid() and a.vaccine_item_id=requested.id)
    or exists (
     select 1 from private.appointment_routine_doses d join public.child_vaccine_items booked on booked.id=d.item_id
     where d.appointment_id=a.id and booked.dose_code=requested.dose_code
    ))
 ) then
  raise exception 'An open appointment already exists for this intended item' using errcode='PT409',hint='appointment_duplicate';
 end if;
end;$$;

create function private.assert_appointment_reschedulable(p_appointment public.appointments) returns void
language plpgsql stable set search_path='' as $$
declare item uuid; checked integer:=0;
begin
 for item in select item_id from private.appointment_routine_doses
  where appointment_id=p_appointment.id and private.item_documentation(item_id) is null
 loop
  perform private.assert_appointment_item(p_appointment.child_id,item);
  perform private.assert_open_appointment(item,p_appointment.id);
  checked:=checked+1;
 end loop;
 if checked=0 then
  perform private.assert_appointment_item(p_appointment.child_id,p_appointment.vaccine_item_id);
  perform private.assert_open_appointment(p_appointment.vaccine_item_id,p_appointment.id);
 end if;
end;$$;
revoke all on function private.assert_appointment_reschedulable(public.appointments) from public,anon,authenticated;

create or replace function private.change_appointment(p_operation_id uuid,p_appointment_id uuid,p_expected_revision integer,p_action text,p_starts_at text,p_ends_at text,p_reason text,p_reviewed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid;platform text;appointment public.appointments;prior public.appointment_events;result uuid;start_time timestamptz;end_time timestamptz;next_state text;
 payload jsonb:=jsonb_build_object('appointment',p_appointment_id,'revision',p_expected_revision,'action',p_action,'start',p_starts_at,'end',p_ends_at,'reason',p_reason,'reviewed',p_reviewed);
begin
 actor:=private.assert_doctor();select * into appointment from public.appointments where id=p_appointment_id;
 if not found or appointment.responsible_id is distinct from actor or not private.can_access_child(appointment.child_id,false) or not private.has_clinical_capability('appointment') then raise exception 'Responsible professional, appointment capability and child access required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(appointment.child_id::text,0));
 if not private.can_access_child(appointment.child_id,false) or not private.has_clinical_capability('appointment') then raise exception 'Appointment capability and child access required' using errcode='42501';end if;
 perform private.assert_facility(appointment.facility_id);
 result:=private.operation_result(p_operation_id,'appointment_change',payload);if result is not null then return result;end if;
 select * into prior from public.appointment_events where appointment_id=appointment.id order by revision desc limit 1;
 if p_expected_revision is distinct from prior.revision then raise exception 'Stale appointment revision' using errcode='PT409';end if;
 if p_reason is null or length(trim(p_reason)) not between 10 and 1000 or p_reviewed is distinct from true or p_action is null or p_action not in ('reschedule','cancel','complete','mark_missed') then raise exception 'Reviewed decision and reason required' using errcode='22023';end if;
 if p_action<>'reschedule' and (p_starts_at is not null or p_ends_at is not null) then raise exception 'Only a reschedule changes slot times' using errcode='22023';end if;
 if p_action='reschedule' then
  start_time:=private.appointment_instant(p_starts_at);end_time:=private.appointment_instant(p_ends_at);
  if end_time<=start_time or end_time>start_time+interval '24 hours' or (start_time=prior.starts_at and end_time=prior.ends_at) then raise exception 'Choose a different valid slot' using errcode='22023';end if;
  if appointment.purpose='vaccination' then perform private.assert_appointment_reschedulable(appointment);end if;
 elsif p_action='complete' then
  if appointment.purpose='vaccination' or prior.state not in ('scheduled','missed') or prior.starts_at>now() then raise exception 'Only a past non-vaccination visit can be marked completed; document doses in clinical records' using errcode='22023';end if;
 elsif p_action='cancel' then
  if prior.state not in ('scheduled','missed') then raise exception 'Only an outstanding appointment can be cancelled' using errcode='22023';end if;
 else
  if prior.state<>'scheduled' or prior.ends_at>now() then raise exception 'Only a passed scheduled slot can be marked missed' using errcode='22023';end if;
  if appointment.purpose='vaccination' and coalesce((select documented from private.routine_appointment_status(appointment.id)),
      private.item_documentation(appointment.vaccine_item_id) is not null) then raise exception 'Dose documented; review resolved follow-up' using errcode='PT409',hint='vaccine_item_documented';end if;
 end if;
 select professional_id into platform from public.professional_profiles where user_id=actor;
 -- Persist the original passed slot before its new disposition. No dose is inserted.
 if prior.state='scheduled' and prior.ends_at<=now() and p_action<>'mark_missed' then
  insert into public.appointment_events(appointment_id,revision,previous_id,action,state,starts_at,ends_at,previous_starts_at,previous_ends_at,actor_id,professional_id,reason)
  values(appointment.id,prior.revision+1,prior.id,'missed','missed',prior.starts_at,prior.ends_at,prior.starts_at,prior.ends_at,actor,platform,'Créneau passé sans disposition lors de cette revue ; aucune dose manquée n’est déduite.') returning * into prior;
 end if;
 next_state:=case p_action when 'reschedule' then 'scheduled' when 'cancel' then 'cancelled' when 'complete' then 'completed' else 'missed' end;
 insert into public.appointment_events(appointment_id,revision,previous_id,action,state,starts_at,ends_at,previous_starts_at,previous_ends_at,actor_id,professional_id,reason)
 values(appointment.id,prior.revision+1,prior.id,case p_action when 'reschedule' then 'rescheduled' else next_state end,next_state,coalesce(start_time,prior.starts_at),coalesce(end_time,prior.ends_at),prior.starts_at,prior.ends_at,actor,platform,trim(p_reason)) returning id into result;
 insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id) values(actor,p_operation_id,'appointment_change',payload,result);return result;
end;$$;

create or replace function private.appointment_rows(p_child_id uuid default null,p_owned_only boolean default true) returns setof jsonb
language sql stable security definer set search_path='' as $$
 select to_jsonb(a)||jsonb_build_object('revision',e.revision,'event_id',e.id,'state',e.state,'starts_at',e.starts_at,'ends_at',e.ends_at,'starts_on',(e.starts_at at time zone 'Africa/Casablanca')::date,'reason',e.reason,'event_recorded_at',e.recorded_at,
 'effective_state',case when e.state in ('cancelled','completed') then e.state when a.purpose='vaccination' and (coalesce(routine.needs_review,not private.vaccine_item_active(a.vaccine_item_id) or (rule.eligibility='female' and c.sex<>'female'))) then 'reference_review' when a.purpose='vaccination' and doc.data is not null then 'dose_documented' when e.state='missed' or e.ends_at<=now() then 'missed' else 'scheduled' end,
 'is_mine',a.responsible_id=auth.uid(),'documentation',doc.data,'recorded_by_other',coalesce((doc.data->>'author_id')::uuid<>a.responsible_id,false),
 'was_missed',exists(select 1 from public.appointment_events past where past.appointment_id=a.id and past.state='missed'),
 'facility_name',f.name,'child_given_name',c.given_name,'child_family_name',c.family_name,'universal_id',c.universal_id,'history_status',c.history_status,
 'child_sex',c.sex,'recommended_on',routine.recommended_on,'dose_codes',routine.dose_codes,'dose_code',i.dose_code,'version_id',i.version_id,'version_label',v.label)
 from public.appointments a join public.children c on c.id=a.child_id join public.facilities f on f.id=a.facility_id
 join lateral(select * from public.appointment_events where appointment_id=a.id order by revision desc limit 1) e on true
 left join public.child_vaccine_items i on i.id=a.vaccine_item_id left join public.vaccine_versions v on v.id=i.version_id
 left join public.vaccine_rules rule on rule.version_id=i.version_id and rule.dose_code=i.dose_code
 left join lateral private.routine_appointment_status(a.id) routine on a.purpose='vaccination'
 left join lateral(select case when routine.documented then routine.documentation
   when routine.recommended_on is null then private.item_documentation(a.vaccine_item_id) end data) doc on a.purpose='vaccination' 
 where (not p_owned_only or a.responsible_id=auth.uid()) and (p_child_id is null or a.child_id=p_child_id) and (private.can_access_child(a.child_id,false) or private.can_access_as_guardian(a.child_id,false));
$$;
