-- Minimal dashboard projection over the existing trusted clinical ledger and current grants.
begin;
create function private.clinician_recent_consultations(p_limit integer default 6) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.assert_doctor();
 if p_limit is null or p_limit not between 1 and 12 then raise exception 'Invalid recent consultation limit' using errcode='22023';end if;
 with permitted as (
  select g.child_id from public.access_grants g where g.professional_id=auth.uid() and g.revoked_at is null and (g.expires_at is null or g.expires_at>now()) and private.can_access_child(g.child_id,false)
 ), latest as (
  select distinct on(e.root_id) e.* from public.clinical_entries e join permitted p on p.child_id=e.child_id order by e.root_id,e.revision desc
 ), consultations as (
  select * from latest where kind='consultation' and entry_state='active'
 ), recent as (
  select e.id,e.root_id,e.child_id,e.revision,e.occurred_on,e.occurrence_precision,e.recorded_at,e.source_verified,e.professional_id,c.given_name,c.family_name,f.name facility_name,left(coalesce(e.payload->>'reason','Consultation documentée'),180) reason
  from consultations e join public.children c on c.id=e.child_id join public.facilities f on f.id=e.facility_id
  order by e.recorded_at desc,e.id limit p_limit
 ) select jsonb_build_object('total',(select count(*) from consultations),'items',coalesce((select jsonb_agg(to_jsonb(r) order by r.recorded_at desc,r.id) from recent r),'[]'::jsonb)) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action)
 select distinct auth.uid(),(item->>'child_id')::uuid,'clinical_dashboard_read','accessed' from jsonb_array_elements(result->'items') item;
 return result;
end;$$;
create function public.clinician_recent_consultations(p_limit integer default 6) returns jsonb language sql security invoker set search_path='' as $$select private.clinician_recent_consultations(p_limit);$$;
revoke all on function private.clinician_recent_consultations(integer),public.clinician_recent_consultations(integer) from public,anon,authenticated;
grant execute on function private.clinician_recent_consultations(integer),public.clinician_recent_consultations(integer) to authenticated;
commit;
