begin;

create table private.guardian_settings (
 guardian_id uuid primary key references private.guardian_profiles(user_id),
 contact_phone text check(contact_phone is null or (length(contact_phone) between 5 and 32 and contact_phone~'^[+0-9 ()-]+$')),
 email_updates boolean not null default false,
 reminder_days integer not null default 1 check(reminder_days in (1,3,7)),
 updated_at timestamptz not null default now()
);
create table private.guardian_settings_events (
 id uuid primary key default gen_random_uuid(),guardian_id uuid not null references private.guardian_profiles(user_id),
 settings jsonb not null,created_at timestamptz not null default now()
);
create table private.parent_correction_requests (
 id uuid primary key,guardian_id uuid not null references private.guardian_profiles(user_id),
 child_id uuid not null references public.children(id),category text not null check(category in ('clinical','identity','access','other')),
 entry_id uuid references public.clinical_entries(id),root_id uuid references public.clinical_entries(id),entry_revision integer,
 message text not null check(length(trim(message)) between 20 and 2000),created_at timestamptz not null default now(),
 check((category='clinical' and entry_id is not null and root_id is not null and entry_revision is not null) or (category<>'clinical' and entry_id is null and root_id is null and entry_revision is null))
);
create index parent_corrections_child_idx on private.parent_correction_requests(child_id,created_at desc,id);
create index parent_corrections_guardian_idx on private.parent_correction_requests(guardian_id,created_at desc,id);
create table private.parent_correction_responses (
 id uuid primary key,request_id uuid not null unique references private.parent_correction_requests(id),
 actor_id uuid not null references auth.users(id),professional_id text,
 outcome text not null check(outcome in ('answered','rejected','corrected','withdrawn')),
 message text not null check(length(trim(message)) between 10 and 2000),
 correction_entry_id uuid references public.clinical_entries(id),created_at timestamptz not null default now(),
 check((outcome='corrected')=(correction_entry_id is not null))
);
alter table private.guardian_settings enable row level security;
alter table private.guardian_settings_events enable row level security;
alter table private.parent_correction_requests enable row level security;
alter table private.parent_correction_responses enable row level security;
revoke all on private.guardian_settings,private.guardian_settings_events,private.parent_correction_requests,private.parent_correction_responses from public,anon,authenticated;
create trigger guardian_settings_events_immutable before update or delete on private.guardian_settings_events for each row execute function private.prevent_mutation();
create trigger parent_correction_requests_immutable before update or delete on private.parent_correction_requests for each row execute function private.prevent_mutation();
create trigger parent_correction_responses_immutable before update or delete on private.parent_correction_responses for each row execute function private.prevent_mutation();

create function private.save_parent_settings(p_contact_phone text,p_email_updates boolean,p_reminder_days integer) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid;phone text:=nullif(trim(p_contact_phone),'');
begin
 actor:=private.assert_parent_account();
 if not exists(select 1 from private.guardian_profiles where user_id=actor) then raise exception 'Parent profile required' using errcode='22023';end if;
 if (phone is not null and (length(phone) not between 5 and 32 or phone!~'^[+0-9 ()-]+$')) or p_email_updates is null or p_reminder_days is null or p_reminder_days not in (1,3,7)
 then raise exception 'Invalid parent preferences' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':guardian_settings',0));
 insert into private.guardian_settings(guardian_id,contact_phone,email_updates,reminder_days) values(actor,phone,p_email_updates,p_reminder_days)
 on conflict(guardian_id) do update set contact_phone=excluded.contact_phone,email_updates=excluded.email_updates,reminder_days=excluded.reminder_days,updated_at=now();
 insert into private.guardian_settings_events(guardian_id,settings) values(actor,jsonb_build_object('contact_phone',phone,'email_updates',p_email_updates,'reminder_days',p_reminder_days));
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,actor,'guardian_settings','updated');
end;$$;
create function private.parent_settings() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;result jsonb;
begin
 actor:=private.assert_parent_account();
 select jsonb_build_object('settings',coalesce((select jsonb_build_object('contact_phone',s.contact_phone,'email_updates',s.email_updates,'reminder_days',s.reminder_days,'updated_at',s.updated_at) from private.guardian_settings s where s.guardian_id=actor),jsonb_build_object('contact_phone',null,'email_updates',false,'reminder_days',1)),
 'history',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'created_at',e.created_at) order by e.created_at desc,e.id) from (select id,created_at from private.guardian_settings_events where guardian_id=actor order by created_at desc,id limit 50)e),'[]'::jsonb),
 'history_total',(select count(*) from private.guardian_settings_events where guardian_id=actor)) into result;
 return result;
end;$$;

create function private.request_parent_correction(p_operation_id uuid,p_child_id uuid,p_category text,p_entry_id uuid,p_message text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid;existing private.parent_correction_requests;entry public.clinical_entries;
begin
 actor:=private.assert_parent_account();
 perform pg_advisory_xact_lock(hashtextextended(p_child_id::text,0));
 if not private.can_access_as_guardian(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 if p_operation_id is null or p_category is null or p_category not in ('clinical','identity','access','other') or p_message is null or length(trim(p_message)) not between 20 and 2000
 then raise exception 'Correction request details required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':parent_request',0));
 select * into existing from private.parent_correction_requests where id=p_operation_id;
 if found then
  if existing.guardian_id<>actor then raise exception 'Request unavailable' using errcode='42501';end if;
  if existing.child_id<>p_child_id or existing.category<>p_category or existing.entry_id is distinct from p_entry_id or existing.message<>trim(p_message)
  then raise exception 'Operation ID reused with different input' using errcode='22023';end if;
  return existing.id;
 end if;
 if (select count(*) from private.parent_correction_requests where guardian_id=actor and created_at>now()-interval '24 hours')>=20
 or (select count(*) from private.parent_correction_requests r where guardian_id=actor and child_id=p_child_id and not exists(select 1 from private.parent_correction_responses s where s.request_id=r.id))>=10
 then raise exception 'Correction request rate limit reached' using errcode='PT429';end if;
 if p_category='clinical' then
  select * into entry from public.clinical_entries where id=p_entry_id and child_id=p_child_id;
  if not found then raise exception 'Entry unavailable' using errcode='42501';end if;
 elsif p_entry_id is not null then raise exception 'Entry applies only to clinical requests' using errcode='22023';end if;
 insert into private.parent_correction_requests(id,guardian_id,child_id,category,entry_id,root_id,entry_revision,message)
 values(p_operation_id,actor,p_child_id,p_category,entry.id,entry.root_id,entry.revision,trim(p_message));
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,p_child_id,'parent_correction_requested','created');
 return p_operation_id;
end;$$;

create function private.respond_parent_correction(p_operation_id uuid,p_request_id uuid,p_outcome text,p_message text,p_correction_entry_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid;request private.parent_correction_requests;existing private.parent_correction_responses;platform text;entry public.clinical_entries;
begin
 actor:=private.assert_parent_account();
 select * into request from private.parent_correction_requests where id=p_request_id;
 if not found then raise exception 'Request unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(request.child_id::text,0));
 if p_outcome='withdrawn' then
  if actor<>request.guardian_id or not private.can_access_as_guardian(request.child_id,false) then raise exception 'Own current guardian access required' using errcode='42501';end if;
 elsif not private.can_access_child(request.child_id,true) then raise exception 'Child access manager required' using errcode='42501';
 end if;
 if p_operation_id is null or p_outcome is null or p_outcome not in ('answered','rejected','corrected','withdrawn') or p_message is null or length(trim(p_message)) not between 10 and 2000
 then raise exception 'Correction response required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text||':response',0));
 select * into existing from private.parent_correction_responses where request_id=p_request_id;
 if found then
  if existing.id=p_operation_id and existing.actor_id=actor and existing.outcome=p_outcome and existing.message=trim(p_message) and existing.correction_entry_id is not distinct from p_correction_entry_id then return existing.id;end if;
  raise exception 'Request already answered' using errcode='PT409';
 end if;
 if p_outcome='corrected' then
  select * into entry from public.clinical_entries where id=p_correction_entry_id and child_id=request.child_id and root_id=request.root_id and revision>request.entry_revision and author_id=actor and recorded_at>=request.created_at;
  if not found or not private.has_clinical_capability(entry.kind) then raise exception 'Attributed clinical amendment required' using errcode='42501';end if;
 elsif p_correction_entry_id is not null then raise exception 'Unexpected clinical correction reference' using errcode='22023';end if;
 select professional_id into platform from public.professional_profiles where user_id=actor and role='doctor';
 insert into private.parent_correction_responses(id,request_id,actor_id,professional_id,outcome,message,correction_entry_id)
 values(p_operation_id,p_request_id,actor,platform,p_outcome,trim(p_message),p_correction_entry_id);
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,request.child_id,'parent_correction_responded','created');
 return p_operation_id;
end;$$;

-- Private projection reused only by the explicitly scoped wrappers below.
create function private.parent_correction_rows(p_child_id uuid,p_guardian_only boolean) returns setof jsonb
language sql stable security definer set search_path='' as $$
 select to_jsonb(r)||jsonb_build_object('guardian_display_name',g.display_name,'child_given_name',c.given_name,'child_family_name',c.family_name,'universal_id',c.universal_id,
 'correction_options',case when p_guardian_only then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'recorded_at',e.recorded_at,'entry_state',e.entry_state) order by e.revision desc) from public.clinical_entries e where e.child_id=r.child_id and e.root_id=r.root_id and e.revision>r.entry_revision and e.author_id=auth.uid() and e.recorded_at>=r.created_at and private.has_clinical_capability(e.kind)),'[]'::jsonb) end,
 'response',case when s.id is null then null else jsonb_build_object('id',s.id,'outcome',s.outcome,'message',s.message,'professional_id',s.professional_id,'correction_entry_id',s.correction_entry_id,'created_at',s.created_at) end)
 from private.parent_correction_requests r join public.children c on c.id=r.child_id join private.guardian_profiles g on g.user_id=r.guardian_id left join private.parent_correction_responses s on s.request_id=r.id
 where (p_child_id is null or r.child_id=p_child_id) and case when p_guardian_only then r.guardian_id=auth.uid() and private.can_access_as_guardian(r.child_id,false) else private.can_access_child(r.child_id,true) end;
$$;
create function private.parent_corrections(p_child_id uuid default null,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;result jsonb;
begin
 actor:=private.assert_parent_account();
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid request page' using errcode='22023';end if;
 if p_child_id is not null and not private.can_access_as_guardian(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 with all_rows as materialized(select r from private.parent_correction_rows(p_child_id,true) t(r)), items as(select r from all_rows order by (r->>'created_at')::timestamptz desc,r->>'id' limit 30 offset (p_page-1)*30)
 select jsonb_build_object('items',coalesce((select jsonb_agg(r order by (r->>'created_at')::timestamptz desc,r->>'id') from items),'[]'::jsonb),'total',(select count(*) from all_rows),'page',p_page) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) select actor,(r->>'child_id')::uuid,'parent_requests_read','accessed' from jsonb_array_elements(result->'items') t(r) group by r->>'child_id';
 return result;
end;$$;
create function private.doctor_parent_corrections(p_child_id uuid default null,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;result jsonb;
begin
 actor:=private.assert_doctor();
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid request page' using errcode='22023';end if;
 if p_child_id is not null and not private.can_access_child(p_child_id,true) then raise exception 'Child access manager required' using errcode='42501';end if;
 with all_rows as materialized(select r from private.parent_correction_rows(p_child_id,false) t(r)), items as(select r from all_rows order by (r->'response'='null'::jsonb) desc,(r->>'created_at')::timestamptz desc,r->>'id' limit 30 offset (p_page-1)*30)
 select jsonb_build_object('items',coalesce((select jsonb_agg(r) from items),'[]'::jsonb),'total',(select count(*) from all_rows),'page',p_page) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) select actor,(r->>'child_id')::uuid,'doctor_parent_requests_read','accessed' from jsonb_array_elements(result->'items') t(r) group by r->>'child_id';
 return result;
end;$$;

create function private.parent_access_history(p_child_id uuid,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;since_at timestamptz;result jsonb;
begin
 actor:=private.assert_parent_account();
 if not private.can_access_as_guardian(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid access history page' using errcode='22023';end if;
 select created_at into since_at from private.guardian_links where child_id=p_child_id and guardian_id=actor and revoked_at is null and expires_at>now();
 with visible as materialized(
  select a.id,a.occurred_at,a.entity_type,a.action,case when a.actor_id=actor then 'self' when p.role='doctor' and a.entity_type<>all(array['guardian_booklet_read','guardian_booklet_export','guardian_child_list_read','guardian_access_history_read','parent_correction_requested','parent_correction_responded','parent_requests_read']) then 'professional' else 'guardian' end actor_type,
   case when p.role='doctor' and a.entity_type<>all(array['guardian_booklet_read','guardian_booklet_export','guardian_child_list_read','guardian_access_history_read','parent_correction_requested','parent_correction_responded','parent_requests_read']) then p.professional_id else null end professional_id
  from public.audit_events a left join public.professional_profiles p on p.user_id=a.actor_id
  where a.entity_id=p_child_id and a.occurred_at>=since_at and a.entity_type=any(array['child_profile_read','clinical_timeline_read','clinical_history_read','clinical_export','vaccine_items_read','vaccine_item_history_read','vaccine_items_export','vaccination_duplicate_check','patient_appointments_read','appointment_history_read','appointments_export','appointment_calendar_read','appointment_worklist_read','vaccine_followup_read','patient_visit_overview_read','appointment_item_options_read','guardian_booklet_read','guardian_booklet_export','guardian_child_list_read','guardian_management_read','parent_correction_requested','parent_correction_responded','parent_requests_read','doctor_parent_requests_read','guardian_access_history_read'])
 ),items as(select * from visible order by occurred_at desc,id limit 50 offset (p_page-1)*50)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i) order by i.occurred_at desc,i.id) from items i),'[]'::jsonb),'total',(select count(*) from visible),'page',p_page,'since',since_at) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,p_child_id,'guardian_access_history_read','accessed');
 return result;
end;$$;

create function public.save_parent_settings(p_contact_phone text,p_email_updates boolean,p_reminder_days integer) returns void language sql security invoker set search_path='' as $$select private.save_parent_settings(p_contact_phone,p_email_updates,p_reminder_days);$$;
create function public.parent_settings() returns jsonb language sql security invoker set search_path='' as $$select private.parent_settings();$$;
create function public.request_parent_correction(p_operation_id uuid,p_child_id uuid,p_category text,p_entry_id uuid,p_message text) returns uuid language sql security invoker set search_path='' as $$select private.request_parent_correction(p_operation_id,p_child_id,p_category,p_entry_id,p_message);$$;
create function public.respond_parent_correction(p_operation_id uuid,p_request_id uuid,p_outcome text,p_message text,p_correction_entry_id uuid) returns uuid language sql security invoker set search_path='' as $$select private.respond_parent_correction(p_operation_id,p_request_id,p_outcome,p_message,p_correction_entry_id);$$;
create function public.parent_corrections(p_child_id uuid default null,p_page integer default 1) returns jsonb language sql security invoker set search_path='' as $$select private.parent_corrections(p_child_id,p_page);$$;
create function public.doctor_parent_corrections(p_child_id uuid default null,p_page integer default 1) returns jsonb language sql security invoker set search_path='' as $$select private.doctor_parent_corrections(p_child_id,p_page);$$;
create function public.parent_access_history(p_child_id uuid,p_page integer default 1) returns jsonb language sql security invoker set search_path='' as $$select private.parent_access_history(p_child_id,p_page);$$;
revoke all on function private.parent_correction_rows(uuid,boolean) from public,anon,authenticated;
do $$declare fn record;begin
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.proname=any(array['save_parent_settings','parent_settings','request_parent_correction','respond_parent_correction','parent_corrections','doctor_parent_corrections','parent_access_history']) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
  execute format('grant execute on function %s to authenticated',fn.signature);
 end loop;
end$$;
commit;
