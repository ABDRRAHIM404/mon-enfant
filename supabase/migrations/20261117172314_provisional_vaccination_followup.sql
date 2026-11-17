-- Read-only routine calendar and manually saved follow-ups for an author's private child.
-- No reference assignment, trusted access, source approval or appointment creation.
begin;
create function private.provisional_vaccination_followup(p_child_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.professional_profiles; version public.vaccine_versions; result jsonb; rules jsonb;
begin
 actor:=private.assert_provisional_author();
 if not exists(select 1 from private.provisional_children c where c.id=p_child_id and c.owner_id=actor.user_id) then
  raise exception 'Record unavailable' using errcode='42501';
 end if;
 -- An unapproved account can READ a reviewed calendar. Its own records remain unverified.
 -- Original draft vocabulary/ages may be displayed, but never activated as dated references.
 select v.* into version from public.vaccine_versions v
 where (v.status='approved' and v.review_verified) or (v.status='draft' and v.parent_id is null)
 order by (v.status='approved' and v.review_verified) desc,v.created_at desc,v.id limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('dose_code',r.dose_code,'vaccine_code',r.vaccine_code,
  'label',coalesce(s.document#>>array['vaccines',r.vaccine_code,'label_fr'],r.vaccine_code),
  'age',r.age,'eligibility',r.eligibility,'automatic_scheduling',r.automatic_scheduling) order by r.dose_code),'[]'::jsonb)
 into rules from public.vaccine_rules r join private.vaccine_sources s on s.id=version.source_id where r.version_id=version.id;
 with latest as (
  select distinct on(e.root_id) e.* from private.provisional_entries e
  where e.child_id=p_child_id and e.owner_id=actor.user_id order by e.root_id,e.revision desc
 ), vaccinations as (select * from latest where kind='vaccination' and entry_state='active'),
 appointments as (select * from latest where kind='appointment' and entry_state='active'
  and payload->>'status' in ('planned','rescheduled') and (payload->>'scheduled_for')::timestamptz>=now())
 select jsonb_build_object(
  'version',case when version.id is null then null else jsonb_build_object('id',version.id,'label',version.label,'status',version.status,'review_verified',version.review_verified) end,
  'rules',rules,'declarations_complete',(select count(*)<=500 from vaccinations),
  'declarations',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'dose_code',e.payload->>'dose_code',
   'dose_label',e.payload->>'dose_label','vaccine_code',e.payload->>'vaccine_code',
   'occurred_on',e.occurred_on,'occurrence_precision',e.occurrence_precision,'source_type',e.source_type))
   from (select * from vaccinations order by recorded_at desc,id limit 500)e),'[]'::jsonb),
  'appointments_total',(select count(*) from appointments),
  'appointments',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'purpose',e.payload->>'purpose',
   'scheduled_for',e.payload->>'scheduled_for') order by (e.payload->>'scheduled_for')::timestamptz,e.id)
   from (select * from appointments order by (payload->>'scheduled_for')::timestamptz,id limit 20)e),'[]'::jsonb)
 ) into result;
 insert into private.provisional_audit(actor_id,child_id,action) values(actor.user_id,p_child_id,'vaccination_followup_read');
 return result;
end;$$;
create function public.provisional_vaccination_followup(p_child_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.provisional_vaccination_followup(p_child_id);$$;
revoke all on function private.provisional_vaccination_followup(uuid),public.provisional_vaccination_followup(uuid) from public,anon,authenticated;
grant execute on function private.provisional_vaccination_followup(uuid),public.provisional_vaccination_followup(uuid) to authenticated;
comment on function public.provisional_vaccination_followup(uuid) is 'Live-session author-only private vaccination declarations, reviewed routine calendar (or explicitly unapproved original draft ages), and manually saved future visits. No clinical fulfillment, schedule assignment, promotion or automatic appointments.';
commit;
