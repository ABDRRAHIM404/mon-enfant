begin;

create function private.patient_routine_appointment_proposals(p_child_id uuid,p_page integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; version uuid; preview boolean; result jsonb;
begin
 actor:=private.assert_doctor();
 if not coalesce(private.can_access_child(p_child_id,false),false) then
  raise exception 'Child access denied' using errcode='42501';
 end if;
 if p_page is null or p_page not between 1 and 10000 then
  raise exception 'Invalid proposal page' using errcode='22023';
 end if;
 version:=private.routine_schedule_version(true);
 select status='draft' into preview from public.vaccine_versions where id=version;
 with groups as materialized (
  select c.id child_id,c.given_name,c.family_name,c.sex,c.birth_date,r.recommended_on,
   jsonb_agg(jsonb_build_object('code',r.dose_code,'label',r.dose_label) order by r.dose_code) doses,
   bool_or(r.item_id is null) requires_assignment
  from public.children c
  cross join lateral private.routine_appointment_candidates(c.id,version) r
  where c.id=p_child_id and version is not null
  group by c.id,r.recommended_on
 ), page as (
  select * from groups order by recommended_on limit 3 offset (p_page-1)*3
 )
 select jsonb_build_object('version',version,'preview',coalesce(preview,false),'total',(select count(*) from groups),
  'items',coalesce((select jsonb_agg(to_jsonb(page) order by recommended_on) from page),'[]'::jsonb))
 into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action)
 values(actor,p_child_id,'routine_proposal_read','accessed');
 return result;
end;
$$;

create function public.patient_routine_appointment_proposals(p_child_id uuid,p_page integer default 1) returns jsonb
language sql security invoker set search_path='' as $$
 select private.patient_routine_appointment_proposals(p_child_id,p_page);
$$;

revoke all on function private.patient_routine_appointment_proposals(uuid,integer),
 public.patient_routine_appointment_proposals(uuid,integer) from public,anon,authenticated;
grant execute on function private.patient_routine_appointment_proposals(uuid,integer),
 public.patient_routine_appointment_proposals(uuid,integer) to authenticated;

commit;
