-- Read the selected list period and the visible calendar month in one snapshot.
create function private.appointment_workspace(
 p_from date,p_to date,p_month date,p_page integer,p_proposal_page integer,p_state text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=private.assert_doctor();
 version uuid:=private.routine_schedule_version(true);
 preview boolean;
 month_end date;
 result jsonb;
begin
 if p_from is null or p_to is null or p_month is null or p_to<p_from or p_to>p_from+30
  or p_month<>date_trunc('month',p_month::timestamp)::date
  or p_page is null or p_page not between 1 and 10000
  or p_proposal_page is null or p_proposal_page not between 1 and 10000
  or p_state is null or p_state not in ('all','confirmed','scheduled','missed','cancelled','completed',
   'dose_documented','reference_review','pending','indicative') then
  raise exception 'Invalid appointment workspace filters' using errcode='22023';
 end if;
 month_end:=(p_month+interval '1 month')::date-1;
 if p_from>month_end or p_to<p_month then
  raise exception 'The selected period must intersect the calendar month' using errcode='22023';
 end if;
 select coalesce((select status='draft' from public.vaccine_versions where id=version),false) into preview;

 with booked as materialized (
  select data,(data->>'starts_on')::date calendar_day
  from private.appointment_rows(null,true) r(data)
  where (data->>'starts_on')::date between least(p_from,p_month) and greatest(p_to,month_end)
   and case p_state
    when 'all' then true
    when 'confirmed' then data->>'effective_state'='scheduled' and data->>'recommended_on' is not null
    else data->>'effective_state'=p_state
   end
 ), booked_in_period as (
  select data from booked where calendar_day between p_from and p_to
 ), booked_page as (
  select data from booked_in_period order by (data->>'starts_at')::timestamptz,data->>'id'
  limit 50 offset (p_page-1)*50
 ), scope as materialized (
  select child_id from public.access_grants where professional_id=actor
  union
  select child_id from public.doctor_patient_registry where professional_id=actor
  union
  select child_id from private.clinician_shares where recipient_id=actor
   and scope='care_visit' and recipient_session::text=auth.jwt()->>'session_id'
   and revoked_at is null and consumed_at>now()-interval '1 hour'
 ), authorized as materialized (
  select child_id from scope where version is not null and
   (p_state='all' or (preview and p_state='indicative') or (not preview and p_state='pending'))
   and private.can_access_child(child_id,false)
 ), groups as materialized (
  select c.id child_id,c.given_name,c.family_name,c.sex,c.birth_date,r.recommended_on,
   jsonb_agg(jsonb_build_object('code',r.dose_code,'label',r.dose_label) order by r.dose_code) doses,
   bool_or(r.item_id is null) requires_assignment
  from authorized a join public.children c on c.id=a.child_id
  cross join lateral private.routine_appointment_candidates(c.id,version) r
  where r.recommended_on between least(p_from,p_month) and greatest(p_to,month_end)
  group by c.id,r.recommended_on
 ), proposals_in_period as (
  select * from groups where recommended_on between p_from and p_to
 ), proposals_page as (
  select * from proposals_in_period order by recommended_on,child_id limit 3 offset (p_proposal_page-1)*3
 ), day_counts as (
  select calendar_day,sum(appointments)::integer appointments,sum(proposals)::integer proposals from (
   select calendar_day,count(*) appointments,0::bigint proposals from booked where calendar_day between p_month and month_end group by calendar_day
   union all
   select recommended_on,0::bigint,count(*) from groups where recommended_on between p_month and month_end group by recommended_on
  ) counts group by calendar_day
 ), accessed as (
  select (data->>'child_id')::uuid child_id,'appointment_calendar_read' entity from booked_page
  union
  select child_id,'routine_proposal_read' from proposals_page
 ), audit as (
  insert into public.audit_events(actor_id,entity_id,entity_type,action)
  select actor,child_id,entity,'accessed' from accessed
 )
 select jsonb_build_object(
  'appointments',jsonb_build_object('total',(select count(*) from booked_in_period),
    'items',coalesce((select jsonb_agg(data order by (data->>'starts_at')::timestamptz,data->>'id') from booked_page),'[]'::jsonb)),
  'proposals',jsonb_build_object('version',version,'preview',preview,'total',(select count(*) from proposals_in_period),
    'items',coalesce((select jsonb_agg(to_jsonb(p) order by recommended_on,child_id) from proposals_page p),'[]'::jsonb)),
  'days',coalesce((select jsonb_agg(jsonb_build_object('day',calendar_day,'appointments',appointments,'proposals',proposals) order by calendar_day) from day_counts d),'[]'::jsonb)
 ) into result;
 return result;
end;$$;

create function public.appointment_workspace(
 p_from date,p_to date,p_month date,p_page integer,p_proposal_page integer,p_state text
) returns jsonb language sql security invoker set search_path='' as $$
 select private.appointment_workspace(p_from,p_to,p_month,p_page,p_proposal_page,p_state);
$$;
revoke all on function public.appointment_workspace(date,date,date,integer,integer,text),
 private.appointment_workspace(date,date,date,integer,integer,text) from public,anon,authenticated;
grant execute on function public.appointment_workspace(date,date,date,integer,integer,text),
 private.appointment_workspace(date,date,date,integer,integer,text) to authenticated;
