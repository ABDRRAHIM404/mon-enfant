begin;

-- Lookup returns an internal key only after actual current clinical read authority.
create function private.lookup_authorized_child(p_universal_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid;result uuid;
begin
 actor:=private.assert_doctor();
 select c.id into result from public.children c where c.universal_id=p_universal_id and private.can_access_child(c.id,false);
 if result is not null then
  insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,result,'child_lookup_read','accessed');
 end if;
 return result;
end;$$;
create function public.lookup_authorized_child(p_universal_id uuid) returns uuid language sql security invoker set search_path='' as $$select private.lookup_authorized_child(p_universal_id);$$;
revoke all on function private.lookup_authorized_child(uuid),public.lookup_authorized_child(uuid) from public,anon,authenticated;
grant execute on function private.lookup_authorized_child(uuid),public.lookup_authorized_child(uuid) to authenticated;

create table private.guardian_notification_reads (
 guardian_id uuid primary key references private.guardian_profiles(user_id),
 read_through timestamptz not null,updated_at timestamptz not null default now(),check(read_through<=updated_at)
);
alter table private.guardian_notification_reads enable row level security;
revoke all on private.guardian_notification_reads from public,anon,authenticated;
create function private.parent_updates(p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;last_read timestamptz;generated timestamptz:=now();result jsonb;
begin
 actor:=private.assert_parent_account();
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid notifications page' using errcode='22023';end if;
 select read_through into last_read from private.guardian_notification_reads where guardian_id=actor;
 with links as materialized(
  select g.child_id,g.id,g.created_at,c.given_name,c.family_name from private.guardian_links g join public.children c on c.id=g.child_id
  where g.guardian_id=actor and private.can_access_as_guardian(g.child_id,false) and g.revoked_at is null and g.expires_at>generated
 ), activity as materialized(
  select g.id,'access_approved'::text kind,g.child_id,g.given_name,g.family_name,g.created_at occurred_at,null::text clinical_kind,null::integer revision from links g
  union all
  select e.id,case when e.revision>1 then 'care_corrected' else 'care_recorded' end,g.child_id,g.given_name,g.family_name,e.recorded_at,e.kind,e.revision
   from links g join public.clinical_entries e on e.child_id=g.child_id where e.recorded_at>=g.created_at
  union all
  select e.id,'appointment_updated',g.child_id,g.given_name,g.family_name,e.recorded_at,null::text,e.revision
   from links g join public.appointments a on a.child_id=g.child_id join public.appointment_events e on e.appointment_id=a.id where e.recorded_at>=g.created_at
  union all
  select s.id,'request_answered',g.child_id,g.given_name,g.family_name,s.created_at,null::text,null::integer
   from links g join private.parent_correction_requests r on r.child_id=g.child_id and r.guardian_id=actor join private.parent_correction_responses s on s.request_id=r.id
   where s.created_at>=g.created_at and s.outcome<>'withdrawn'
  union all
  select d.id,'claim_rejected',null::uuid,null::text,null::text,d.created_at,null::text,null::integer
   from private.guardian_decisions d join private.guardian_claims c on c.id=d.claim_id where c.guardian_id=actor and d.decision='rejected'
  union all
  select e.id,'access_revoked',null::uuid,null::text,null::text,e.created_at,null::text,null::integer
   from private.guardian_events e join private.guardian_links g on g.id=e.entity_id where g.guardian_id=actor and e.kind='link_revoked'
  union all
  select g.id,'access_expired',null::uuid,null::text,null::text,g.expires_at,null::text,null::integer
   from private.guardian_links g where g.guardian_id=actor and g.revoked_at is null and g.expires_at<=generated
 ),items as(select * from activity where occurred_at<=generated order by occurred_at desc,kind,id limit 50 offset (p_page-1)*50)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('unread',i.occurred_at>coalesce(last_read,'-infinity'::timestamptz)) order by i.occurred_at desc,i.kind,i.id) from items i),'[]'::jsonb),
 'total',(select count(*) from activity where occurred_at<=generated),'unread_total',(select count(*) from activity where occurred_at<=generated and occurred_at>coalesce(last_read,'-infinity'::timestamptz)),
 'page',p_page,'generated_at',generated,'read_through',last_read) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) select actor,g.child_id,'guardian_notifications_read','accessed' from private.guardian_links g where g.guardian_id=actor and g.revoked_at is null and g.expires_at>generated;
 return result;
end;$$;
create function private.mark_parent_updates_read(p_read_through timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=private.assert_parent_account();
 if not exists(select 1 from private.guardian_profiles where user_id=actor) then raise exception 'Parent profile required' using errcode='22023';end if;
 if p_read_through is null or not isfinite(p_read_through) or p_read_through>now() then raise exception 'Invalid notification cursor' using errcode='22023';end if;
 insert into private.guardian_notification_reads(guardian_id,read_through) values(actor,p_read_through)
 on conflict(guardian_id) do update set read_through=greatest(private.guardian_notification_reads.read_through,excluded.read_through),updated_at=now();
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,actor,'guardian_notifications_seen','updated');
end;$$;
create function public.parent_updates(p_page integer default 1) returns jsonb language sql security invoker set search_path='' as $$select private.parent_updates(p_page);$$;
create function public.mark_parent_updates_read(p_read_through timestamptz) returns void language sql security invoker set search_path='' as $$select private.mark_parent_updates_read(p_read_through);$$;
revoke all on function private.parent_updates(integer),public.parent_updates(integer),private.mark_parent_updates_read(timestamptz),public.mark_parent_updates_read(timestamptz) from public,anon,authenticated;
grant execute on function private.parent_updates(integer),public.parent_updates(integer),private.mark_parent_updates_read(timestamptz),public.mark_parent_updates_read(timestamptz) to authenticated;

-- Keep the parent consultation log in sync with the newly implemented reads.
create or replace function private.parent_access_history(p_child_id uuid,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;since_at timestamptz;result jsonb;
begin
 actor:=private.assert_parent_account();
 if not private.can_access_as_guardian(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid access history page' using errcode='22023';end if;
 select created_at into since_at from private.guardian_links where child_id=p_child_id and guardian_id=actor and revoked_at is null and expires_at>now();
 with visible as materialized(
  select a.id,a.occurred_at,a.entity_type,a.action,case when a.actor_id=actor then 'self' when p.role='doctor' and a.entity_type<>all(array['guardian_booklet_read','guardian_booklet_export','guardian_child_list_read','guardian_access_history_read','parent_correction_requested','parent_correction_responded','parent_requests_read','guardian_notifications_read']) then 'professional' else 'guardian' end actor_type,
   case when p.role='doctor' and a.entity_type<>all(array['guardian_booklet_read','guardian_booklet_export','guardian_child_list_read','guardian_access_history_read','parent_correction_requested','parent_correction_responded','parent_requests_read','guardian_notifications_read']) then p.professional_id else null end professional_id
  from public.audit_events a left join public.professional_profiles p on p.user_id=a.actor_id
  where a.entity_id=p_child_id and a.occurred_at>=since_at and a.entity_type=any(array['child_profile_read','clinical_timeline_read','clinical_history_read','clinical_export','vaccine_items_read','vaccine_item_history_read','vaccine_items_export','vaccination_duplicate_check','patient_appointments_read','appointment_history_read','appointments_export','appointment_calendar_read','appointment_worklist_read','vaccine_followup_read','patient_visit_overview_read','appointment_item_options_read','guardian_booklet_read','guardian_booklet_export','guardian_child_list_read','guardian_management_read','parent_correction_requested','parent_correction_responded','parent_requests_read','doctor_parent_requests_read','guardian_access_history_read','child_lookup_read','guardian_notifications_read'])
 ),items as(select * from visible order by occurred_at desc,id limit 50 offset (p_page-1)*50)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i) order by i.occurred_at desc,i.id) from items i),'[]'::jsonb),'total',(select count(*) from visible),'page',p_page,'since',since_at) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,p_child_id,'guardian_access_history_read','accessed');
 return result;
end;$$;

commit;
