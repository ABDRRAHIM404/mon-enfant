begin;

-- No new authority: each projection reuses current-session and existing record guards.
create function private.parent_home_summary() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; workspace jsonb; updates jsonb; next_visit jsonb;
begin
 actor:=private.assert_parent_account();
 workspace:=private.parent_workspace();
 updates:=private.parent_updates(1);
 select r.data into next_visit
 from jsonb_array_elements(workspace->'children') c
 cross join lateral private.appointment_rows((c->>'id')::uuid,false) r(data)
 where r.data->>'effective_state'='scheduled' and (r.data->>'ends_at')::timestamptz>now()
 order by (r.data->>'starts_at')::timestamptz,r.data->>'id' limit 1;
 -- The existing parent-visible calendar audit category also covers this narrow calendar summary.
 insert into public.audit_events(actor_id,entity_id,entity_type,action)
 select actor,(c->>'id')::uuid,'guardian_calendar_read','accessed' from jsonb_array_elements(workspace->'children') c;
 return workspace||jsonb_build_object('next_appointment',next_visit,'unread_total',(updates->>'unread_total')::bigint,'generated_at',now());
end;$$;
create function public.parent_home_summary() returns jsonb language sql security invoker set search_path='' as $$select private.parent_home_summary();$$;
revoke all on function private.parent_home_summary(),public.parent_home_summary() from public,anon,authenticated;
grant execute on function private.parent_home_summary(),public.parent_home_summary() to authenticated;

-- Preserve pagination and the existing author-only workspace, adding current immutable-ledger counts.
create or replace function private.provisional_workspace(p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
declare profile public.professional_profiles; items jsonb; total integer; summary jsonb; week_start date;
begin
 profile:=private.assert_provisional_author();
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid page' using errcode='22023';end if;
 week_start:=date_trunc('week',now() at time zone 'Africa/Casablanca')::date;
 select count(*) into total from private.provisional_children where owner_id=profile.user_id;
 select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into items from (select * from private.provisional_children where owner_id=profile.user_id order by created_at desc,id limit 30 offset (p_page-1)*30)c;
 with current_entries as materialized (
  select e.* from private.provisional_entries e where e.owner_id=profile.user_id and e.entry_state='active'
   and not exists(select 1 from private.provisional_entries n where n.root_id=e.root_id and n.revision>e.revision)
 ) select jsonb_build_object(
  'consultations_week',count(*) filter(where kind='consultation' and occurrence_precision='exact' and occurred_on>=week_start and occurred_on<week_start+7),
  'vaccinations',count(*) filter(where kind='vaccination'),
  'appointments_upcoming',count(*) filter(where kind='appointment' and payload->>'status' in ('planned','rescheduled') and (payload->>'scheduled_for')::timestamptz>=now()),
  'week_start',week_start,'generated_at',now()
 ) into summary from current_entries;
 insert into private.provisional_audit(actor_id,action) values(profile.user_id,'workspace_read');
 return jsonb_build_object('items',items,'total',total,'page',p_page,'summary',summary);
end;$$;


create function private.parent_vaccination_history(p_child_id uuid,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare child jsonb;result jsonb;
begin
 child:=private.parent_child_header(p_child_id);
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid history page' using errcode='22023';end if;
 with current_entries as materialized (
  select e.*,f.name facility_name from public.clinical_entries e join public.facilities f on f.id=e.facility_id
  where e.child_id=p_child_id and e.kind='vaccination' and e.entry_state='active'
   and not exists(select 1 from public.clinical_entries n where n.root_id=e.root_id and n.revision>e.revision)
 ), items as (select * from current_entries order by occurred_on desc nulls last,recorded_at desc,id limit 20 offset (p_page-1)*20)
 select jsonb_build_object('child',child,'items',coalesce((select jsonb_agg(to_jsonb(i)||private.vaccination_metadata(i.id) order by i.occurred_on desc nulls last,i.recorded_at desc,i.id) from items i),'[]'::jsonb),'total',(select count(*) from current_entries),'page',p_page) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'guardian_booklet_read','accessed');
 return result;
end;$$;
create function public.parent_vaccination_history(p_child_id uuid,p_page integer default 1) returns jsonb language sql security invoker set search_path='' as $$select private.parent_vaccination_history(p_child_id,p_page);$$;
revoke all on function private.parent_vaccination_history(uuid,integer),public.parent_vaccination_history(uuid,integer) from public,anon,authenticated;
grant execute on function private.parent_vaccination_history(uuid,integer),public.parent_vaccination_history(uuid,integer) to authenticated;

commit;
