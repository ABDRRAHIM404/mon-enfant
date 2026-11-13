begin;
alter table public.professional_capabilities drop constraint professional_capabilities_capability_check;
alter table public.professional_capabilities add constraint professional_capabilities_capability_check check(capability in ('consultation','prescription','risk','growth','vaccination','appointment'));
create or replace function private.set_clinical_capability(p_operation_id uuid,p_professional_id uuid,p_capability text,p_enabled boolean,p_expires_at timestamptz,p_evidence_reference text,p_reason text,p_verified boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare receipt private.operation_receipts; payload jsonb:=jsonb_build_object('professional',p_professional_id,'capability',p_capability,'enabled',p_enabled,'expires_at',p_expires_at,'evidence',p_evidence_reference,'reason',p_reason,'verified',p_verified);
begin
 if not private.can_manage_clinical_permissions() then raise exception 'Clinical permission manager required' using errcode='42501'; end if;
 if p_operation_id is null then raise exception 'Operation ID required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation_id::text,0));
 select * into receipt from private.operation_receipts where actor_id=auth.uid() and operation_id=p_operation_id;
 if found then
  if receipt.kind<>'clinical_permission' or receipt.payload is distinct from payload then raise exception 'Operation ID reused with different input' using errcode='22023'; end if;
  return receipt.result_id;
 end if;
 if p_capability is null or p_capability not in ('consultation','prescription','risk','growth','vaccination','appointment') or p_enabled is null or p_evidence_reference is null or length(trim(p_evidence_reference)) not between 10 and 1000 or p_reason is null or length(trim(p_reason)) not between 10 and 1000 or (p_enabled and (p_verified is distinct from true or (p_expires_at is not null and p_expires_at<=now()))) then raise exception 'Verified basis, reason and valid permission required' using errcode='22023'; end if;
 if not exists(select 1 from public.professional_profiles p where p.user_id=p_professional_id and p.role='doctor' and (not p_enabled or (p.verification_status='approved' and p.professional_id is not null))) then raise exception 'Eligible professional required' using errcode='42501'; end if;
 insert into public.professional_capabilities(professional_id,capability,enabled,expires_at,granted_by) values(p_professional_id,p_capability,p_enabled,p_expires_at,auth.uid()) on conflict(professional_id,capability) do update set enabled=excluded.enabled,expires_at=excluded.expires_at,granted_by=excluded.granted_by,changed_at=now();
 insert into public.capability_changes(professional_id,capability,enabled,expires_at,actor_id,evidence_reference,reason) values(p_professional_id,p_capability,p_enabled,p_expires_at,auth.uid(),trim(p_evidence_reference),trim(p_reason));
 insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id) values(auth.uid(),p_operation_id,'clinical_permission',payload,p_professional_id);
 return p_professional_id;
end;$$;

-- Appointment identities and their dispositions are separate from clinical administrations.
create table public.appointments (
 id uuid primary key default gen_random_uuid(),child_id uuid not null references public.children(id),
 responsible_id uuid not null references public.professional_profiles(user_id),professional_id text not null,
 facility_id uuid not null references public.facilities(id),purpose text not null check(purpose in ('consultation','vaccination','other')),
 purpose_label text not null check(length(trim(purpose_label)) between 1 and 120),
 vaccine_item_id uuid references public.child_vaccine_items(id),created_at timestamptz not null default now(),
 check((purpose='vaccination')=(vaccine_item_id is not null))
);
create index appointments_child_idx on public.appointments(child_id,created_at,id);
create index appointments_responsible_idx on public.appointments(responsible_id,child_id);
create index appointments_facility_idx on public.appointments(facility_id);
create index appointments_vaccine_idx on public.appointments(vaccine_item_id,responsible_id);
create table public.appointment_events (
 id uuid primary key default gen_random_uuid(),appointment_id uuid not null references public.appointments(id),
 revision integer not null check(revision>=1),previous_id uuid unique references public.appointment_events(id),
 action text not null check(action in ('created','rescheduled','missed','cancelled','completed')),
 state text not null check(state in ('scheduled','missed','cancelled','completed')),
 starts_at timestamptz not null,ends_at timestamptz not null,
 previous_starts_at timestamptz,previous_ends_at timestamptz,
 actor_id uuid not null references public.professional_profiles(user_id),professional_id text not null,
 reason text not null check(length(trim(reason)) between 10 and 1000),
 recorded_at timestamptz not null default now(),unique(appointment_id,revision),
 check(ends_at>starts_at and ends_at<=starts_at+interval '24 hours'),
 check((revision=1 and previous_id is null and action='created' and state='scheduled' and previous_starts_at is null and previous_ends_at is null) or (revision>1 and previous_id is not null and action<>'created' and previous_starts_at is not null and previous_ends_at is not null)),
 check((action in ('created','rescheduled') and state='scheduled') or (action=state and action in ('missed','cancelled','completed')))
);
create index appointment_events_actor_idx on public.appointment_events(actor_id);
create index appointment_events_time_idx on public.appointment_events(starts_at,appointment_id,revision desc);
alter table public.appointments enable row level security;
alter table public.appointment_events enable row level security;
revoke all on public.appointments,public.appointment_events from public,anon,authenticated;
create trigger appointments_immutable before update or delete on public.appointments for each row execute function private.prevent_mutation();
create trigger appointment_events_immutable before update or delete on public.appointment_events for each row execute function private.prevent_mutation();
create trigger appointments_audit after insert on public.appointments for each row execute function private.audit_change();
create trigger appointment_events_audit after insert on public.appointment_events for each row execute function private.audit_change();

-- Preserve local wall time and explicit offset across Casablanca clock changes.
create function private.appointment_instant(p_text text) returns timestamptz
language plpgsql stable set search_path='' as $$
declare instant timestamptz; wall timestamp;
begin
 if p_text is null or p_text !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:00\+0[01]:00$' then raise exception 'Explicit Casablanca local time and offset required' using errcode='22023';end if;
 instant:=p_text::timestamptz;wall:=substring(p_text from 1 for 19)::timestamp;
 if instant at time zone 'Africa/Casablanca' is distinct from wall then raise exception 'Nonexistent Casablanca time or incorrect offset' using errcode='22023';end if;
 if wall::date<date '2000-01-01' or wall::date>(now() at time zone 'Africa/Casablanca')::date+interval '20 years' then raise exception 'Appointment date outside supported range' using errcode='22023';end if;
 return instant;
end;$$;
create function private.item_documentation(p_item_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('entry_id',e.id,'root_id',e.root_id,'author_id',e.author_id,'professional_id',e.professional_id,'facility_id',e.facility_id,'occurred_on',e.occurred_on,'recorded_at',e.recorded_at,'active_count',count(*) over())
 from public.vaccination_entry_links l join public.clinical_entries e on e.id=l.entry_id
 where l.item_id=p_item_id and e.entry_state='active' and not exists(select 1 from public.clinical_entries newer where newer.root_id=e.root_id and newer.revision>e.revision)
 order by e.recorded_at desc,e.id limit 1;
$$;
create function private.assert_appointment_item(p_child_id uuid,p_item_id uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.child_vaccine_items i join public.vaccine_versions v on v.id=i.version_id join public.vaccine_rules r on r.version_id=i.version_id and r.dose_code=i.dose_code join public.children c on c.id=i.child_id where i.id=p_item_id and i.child_id=p_child_id and private.vaccine_item_active(i.id) and v.review_verified and v.status in ('approved','retired') and r.automatic_scheduling and r.dose_code<>'HB1' and (r.eligibility<>'female' or c.sex='female')) then raise exception 'Active reviewed child vaccine item required' using errcode='22023';end if;
 if private.item_documentation(p_item_id) is not null then raise exception 'Intended dose is already documented; review clinical history' using errcode='PT409',hint='vaccine_item_documented';end if;
end;$$;
create function private.assert_open_appointment(p_item_id uuid,p_except uuid default null) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if p_item_id is not null and exists(select 1 from public.appointments a join lateral(select state from public.appointment_events where appointment_id=a.id order by revision desc limit 1) e on true where a.responsible_id=auth.uid() and a.vaccine_item_id=p_item_id and a.id is distinct from p_except and e.state in ('scheduled','missed')) then raise exception 'An open appointment already exists for this intended item' using errcode='PT409',hint='appointment_duplicate';end if;
end;$$;
create function private.create_appointment(p_operation_id uuid,p_child_id uuid,p_facility_id uuid,p_purpose text,p_purpose_label text,p_vaccine_item_id uuid,p_starts_at text,p_ends_at text,p_reason text,p_reviewed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid;platform text;result uuid;start_time timestamptz;end_time timestamptz;
 payload jsonb:=jsonb_build_object('child',p_child_id,'facility',p_facility_id,'purpose',p_purpose,'label',p_purpose_label,'item',p_vaccine_item_id,'start',p_starts_at,'end',p_ends_at,'reason',p_reason,'reviewed',p_reviewed);
begin
 actor:=private.assert_doctor();perform pg_advisory_xact_lock(hashtextextended(p_child_id::text,0));
 if not private.can_access_child(p_child_id,false) or not private.has_clinical_capability('appointment') then raise exception 'Appointment capability and child access required' using errcode='42501';end if;
 perform private.assert_facility(p_facility_id);
 result:=private.operation_result(p_operation_id,'appointment_create',payload);if result is not null then return result;end if;
 start_time:=private.appointment_instant(p_starts_at);end_time:=private.appointment_instant(p_ends_at);
 if end_time<=start_time or end_time>start_time+interval '24 hours' or p_purpose is null or p_purpose not in ('consultation','vaccination','other') or p_purpose_label is null or length(trim(p_purpose_label)) not between 1 and 120 or (p_purpose='vaccination')<>(p_vaccine_item_id is not null) or p_reason is null or length(trim(p_reason)) not between 10 and 1000 or p_reviewed is distinct from true then raise exception 'Purpose, valid slot, reviewed basis and reason required' using errcode='22023';end if;
 if p_purpose='vaccination' then perform private.assert_appointment_item(p_child_id,p_vaccine_item_id);perform private.assert_open_appointment(p_vaccine_item_id);end if;
 select professional_id into platform from public.professional_profiles where user_id=actor;
 insert into public.appointments(child_id,responsible_id,professional_id,facility_id,purpose,purpose_label,vaccine_item_id) values(p_child_id,actor,platform,p_facility_id,p_purpose,trim(p_purpose_label),p_vaccine_item_id) returning id into result;
 insert into public.appointment_events(appointment_id,revision,action,state,starts_at,ends_at,actor_id,professional_id,reason) values(result,1,'created','scheduled',start_time,end_time,actor,platform,trim(p_reason));
 insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id) values(actor,p_operation_id,'appointment_create',payload,result);return result;
end;$$;
create function private.change_appointment(p_operation_id uuid,p_appointment_id uuid,p_expected_revision integer,p_action text,p_starts_at text,p_ends_at text,p_reason text,p_reviewed boolean) returns uuid
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
  if appointment.purpose='vaccination' then perform private.assert_appointment_item(appointment.child_id,appointment.vaccine_item_id);perform private.assert_open_appointment(appointment.vaccine_item_id,appointment.id);end if;
 elsif p_action='complete' then
  if appointment.purpose='vaccination' or prior.state not in ('scheduled','missed') or prior.starts_at>now() then raise exception 'Only a past non-vaccination visit can be marked completed; document doses in clinical records' using errcode='22023';end if;
 elsif p_action='cancel' then
  if prior.state not in ('scheduled','missed') then raise exception 'Only an outstanding appointment can be cancelled' using errcode='22023';end if;
 else
  if prior.state<>'scheduled' or prior.ends_at>now() then raise exception 'Only a passed scheduled slot can be marked missed' using errcode='22023';end if;
  if appointment.purpose='vaccination' and private.item_documentation(appointment.vaccine_item_id) is not null then raise exception 'Dose documented; review resolved follow-up' using errcode='PT409',hint='vaccine_item_documented';end if;
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

create function private.guard_appointment_identity() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.vaccine_item_id is not null and not exists(select 1 from public.child_vaccine_items where id=new.vaccine_item_id and child_id=new.child_id) then raise exception 'Appointment and intended item must share the child' using errcode='22023';end if;
 return new;
end;$$;
create trigger appointment_identity_guard before insert on public.appointments for each row execute function private.guard_appointment_identity();
create function private.guard_appointment_event() returns trigger
language plpgsql set search_path='' as $$
declare prior public.appointment_events;
begin
 if new.previous_id is not null then
  select * into prior from public.appointment_events where id=new.previous_id;
  if prior.appointment_id is distinct from new.appointment_id or new.revision<>prior.revision+1 or new.previous_starts_at is distinct from prior.starts_at or new.previous_ends_at is distinct from prior.ends_at then raise exception 'Appointment event must retain its exact preceding revision and slot' using errcode='22023';end if;
 end if;
 if not exists(select 1 from public.appointments where id=new.appointment_id and responsible_id=new.actor_id) then raise exception 'Appointment decisions require the responsible professional' using errcode='42501';end if;
 return new;
end;$$;
create trigger appointment_event_guard before insert on public.appointment_events for each row execute function private.guard_appointment_event();

create function private.appointment_rows(p_child_id uuid default null,p_owned_only boolean default true) returns setof jsonb
language sql stable security definer set search_path='' as $$
 select to_jsonb(a)||jsonb_build_object('revision',e.revision,'event_id',e.id,'state',e.state,'starts_at',e.starts_at,'ends_at',e.ends_at,'starts_on',(e.starts_at at time zone 'Africa/Casablanca')::date,'reason',e.reason,'event_recorded_at',e.recorded_at,
 'effective_state',case when e.state in ('cancelled','completed') then e.state when a.purpose='vaccination' and not private.vaccine_item_active(a.vaccine_item_id) then 'reference_review' when a.purpose='vaccination' and doc.data is not null then 'dose_documented' when e.state='missed' or e.ends_at<=now() then 'missed' else 'scheduled' end,
 'is_mine',a.responsible_id=auth.uid(),'documentation',doc.data,'recorded_by_other',coalesce((doc.data->>'author_id')::uuid<>a.responsible_id,false),
 'was_missed',exists(select 1 from public.appointment_events past where past.appointment_id=a.id and past.state='missed'),
 'facility_name',f.name,'child_given_name',c.given_name,'child_family_name',c.family_name,'universal_id',c.universal_id,'history_status',c.history_status,
 'dose_code',i.dose_code,'version_id',i.version_id,'version_label',v.label)
 from public.appointments a join public.children c on c.id=a.child_id join public.facilities f on f.id=a.facility_id
 join lateral(select * from public.appointment_events where appointment_id=a.id order by revision desc limit 1) e on true
 left join public.child_vaccine_items i on i.id=a.vaccine_item_id left join public.vaccine_versions v on v.id=i.version_id
 left join lateral(select private.item_documentation(a.vaccine_item_id) data) doc on a.purpose='vaccination'
 where (not p_owned_only or a.responsible_id=auth.uid()) and (p_child_id is null or a.child_id=p_child_id) and private.can_access_child(a.child_id,false);
$$;
create function private.appointment_calendar(p_from date,p_to date,p_page integer default 1,p_state text default 'all') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.assert_doctor();
 if p_from is null or p_to is null or p_to<p_from or p_to>p_from+41 or p_page is null or p_page not between 1 and 10000 or p_state is null or p_state not in ('all','scheduled','missed','dose_documented','reference_review','cancelled','completed') then raise exception 'Invalid calendar range or filters' using errcode='22023';end if;
 with rows as materialized(select data from private.appointment_rows(null,true) r(data) where (data->>'starts_on')::date between p_from and p_to and (p_state='all' or data->>'effective_state'=p_state)),
 days as(select data->>'starts_on' day,count(*) n from rows group by data->>'starts_on'),
 page as(select data from rows order by (data->>'starts_at')::timestamptz,data->>'id' limit 50 offset (p_page-1)*50)
 select jsonb_build_object('items',coalesce((select jsonb_agg(data order by (data->>'starts_at')::timestamptz,data->>'id') from page),'[]'::jsonb),'total',(select count(*) from rows),'days',coalesce((select jsonb_agg(jsonb_build_object('day',day,'count',n) order by day) from days),'[]'::jsonb),'from',p_from,'to',p_to,'page',p_page,'generated_at',now(),'timezone','Africa/Casablanca') into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) select auth.uid(),(value->>'child_id')::uuid,'appointment_calendar_read','accessed' from jsonb_array_elements(result->'items') group by value->>'child_id';
 return result;
end;$$;
create function private.appointment_worklist(p_bucket text default 'today',p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.assert_doctor();
 if p_page is null or p_page not between 1 and 10000 or p_bucket is null or p_bucket not in ('all','today','upcoming','missed','missed_vaccinations','resolved_by_other','reference_review') then raise exception 'Invalid follow-up filters' using errcode='22023';end if;
 with rows as materialized(select data from private.appointment_rows(null,true) r(data)),
 filtered as(select data from rows where p_bucket='all'
  or (p_bucket='today' and (data->>'starts_on')::date=(now() at time zone 'Africa/Casablanca')::date and data->>'effective_state' in ('scheduled','missed'))
  or (p_bucket='upcoming' and data->>'effective_state'='scheduled' and (data->>'ends_at')::timestamptz>now())
  or (p_bucket='missed' and data->>'effective_state'='missed')
  or (p_bucket='missed_vaccinations' and data->>'effective_state'='missed' and data->>'purpose'='vaccination')
  or (p_bucket='resolved_by_other' and data->>'effective_state'='dose_documented' and (data->>'recorded_by_other')::boolean)
  or (p_bucket='reference_review' and data->>'effective_state'='reference_review')),
 page as(select data from filtered order by (data->>'starts_at')::timestamptz,data->>'id' limit 30 offset (p_page-1)*30)
 select jsonb_build_object('items',coalesce((select jsonb_agg(data order by (data->>'starts_at')::timestamptz,data->>'id') from page),'[]'::jsonb),'total',(select count(*) from filtered),'page',p_page,'generated_at',now(),
 'counts',(select jsonb_build_object('today',count(*) filter(where (data->>'starts_on')::date=(now() at time zone 'Africa/Casablanca')::date and data->>'effective_state' in ('scheduled','missed')),'upcoming',count(*) filter(where data->>'effective_state'='scheduled' and (data->>'ends_at')::timestamptz>now()),'missed',count(*) filter(where data->>'effective_state'='missed'),'missed_vaccinations',count(*) filter(where data->>'effective_state'='missed' and data->>'purpose'='vaccination'),'resolved_by_other',count(*) filter(where data->>'effective_state'='dose_documented' and (data->>'recorded_by_other')::boolean),'reference_review',count(*) filter(where data->>'effective_state'='reference_review')) from rows)) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) select auth.uid(),(value->>'child_id')::uuid,'appointment_worklist_read','accessed' from jsonb_array_elements(result->'items') group by value->>'child_id';
 return result;
end;$$;
create function private.patient_appointments(p_child_id uuid,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_access_child(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid appointment page' using errcode='22023';end if;
 with rows as materialized(select data from private.appointment_rows(p_child_id,false) r(data)),page as(select data from rows order by (data->>'starts_at')::timestamptz desc,data->>'id' limit 30 offset (p_page-1)*30)
 select jsonb_build_object('items',coalesce((select jsonb_agg(data order by (data->>'starts_at')::timestamptz desc,data->>'id') from page),'[]'::jsonb),'total',(select count(*) from rows),'page',p_page) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'patient_appointments_read','accessed');return result;
end;$$;
create function private.appointment_history(p_child_id uuid,p_appointment_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_access_child(p_child_id,false) or not exists(select 1 from public.appointments where id=p_appointment_id and child_id=p_child_id) then raise exception 'Appointment denied' using errcode='42501';end if;
 if (select count(*) from public.appointment_events where appointment_id=p_appointment_id)>5000 then raise exception 'Appointment history exceeds interactive limit' using errcode='54000';end if;
 select jsonb_build_object('appointment',(select data from private.appointment_rows(p_child_id,false) r(data) where (data->>'id')::uuid=p_appointment_id),'events',coalesce((select jsonb_agg(to_jsonb(e) order by revision) from public.appointment_events e where appointment_id=p_appointment_id),'[]'::jsonb)) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'appointment_history_read','accessed');return result;
end;$$;
create function private.appointments_export(p_child_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_access_child(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 if (select count(*) from public.appointments where child_id=p_child_id)>5000 or (select count(*) from public.appointment_events e join public.appointments a on a.id=e.appointment_id where a.child_id=p_child_id)>5000 then raise exception 'Appointment export exceeds interactive limit' using errcode='54000';end if;
 select coalesce(jsonb_agg(data||jsonb_build_object('events',(select jsonb_agg(to_jsonb(e) order by revision) from public.appointment_events e where e.appointment_id=(data->>'id')::uuid)) order by (data->>'starts_at')::timestamptz,data->>'id'),'[]'::jsonb) into result from private.appointment_rows(p_child_id,false) r(data);
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'appointments_export','accessed');return result;
end;$$;

create function private.item_reference(p_item_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare item public.child_vaccine_items;rule public.vaccine_rules;version public.vaccine_versions;child public.children;start_on date;end_on date;state text;
begin
 select * into item from public.child_vaccine_items where id=p_item_id;
 select * into rule from public.vaccine_rules where version_id=item.version_id and dose_code=item.dose_code;
 select * into version from public.vaccine_versions where id=item.version_id;
 select * into child from public.children where id=item.child_id;
 state:=case when not private.vaccine_item_active(item.id) then 'reference_withdrawn' when rule.dose_code='HB1' or not rule.automatic_scheduling then 'disabled_reference_only' when version.status<>'approved' or not version.review_verified then 'unreviewed_version' when rule.eligibility='female' and child.sex='unknown' then 'eligibility_unknown' when rule.eligibility='female' and child.sex<>'female' then 'ineligible' when child.birth_date_precision<>'exact' or child.birth_date is null then 'birth_date_uncertain' else 'routine_reference' end;
 if state='routine_reference' then
  start_on:=case rule.age->>'unit' when 'first_4_weeks' then child.birth_date when 'weeks' then child.birth_date+((rule.age->>'value')::integer*7) when 'months' then (child.birth_date+make_interval(months=>(rule.age->>'value')::integer))::date when 'years' then (child.birth_date+make_interval(years=>(rule.age->>'value')::integer))::date else null end;
  end_on:=case when rule.age->>'unit'='first_4_weeks' then start_on+27 else start_on end;
 end if;
 return jsonb_build_object('state',state,'start_on',start_on,'end_on',end_on,'is_window',rule.age->>'unit'='first_4_weeks');
end;$$;
create function private.vaccine_followup_rows() returns setof jsonb
language sql stable security definer set search_path='' as $$
 select to_jsonb(i)||jsonb_build_object('dose_code',i.dose_code,'version_label',v.label,'version_status',v.status,'rule',to_jsonb(rule),'reference',ref.data,'documentation',doc.data,
 'child_given_name',c.given_name,'child_family_name',c.family_name,'universal_id',c.universal_id,'history_status',c.history_status,
 'followup_state',case when doc.data is not null then 'documented' when ref.data->>'state'<>'routine_reference' then 'reference_review' when (ref.data->>'end_on')::date<(now() at time zone 'Africa/Casablanca')::date then 'potentially_overdue_unconfirmed' when (ref.data->>'start_on')::date<=(now() at time zone 'Africa/Casablanca')::date+30 then 'routine_due' else 'routine_future' end)
 from public.child_vaccine_items i join public.children c on c.id=i.child_id join public.vaccine_versions v on v.id=i.version_id join public.vaccine_rules rule on rule.version_id=i.version_id and rule.dose_code=i.dose_code
 cross join lateral(select private.item_reference(i.id) data) ref left join lateral(select private.item_documentation(i.id) data) doc on true
 where private.can_access_child(i.child_id,false) and (i.assigned_by=auth.uid() or exists(select 1 from public.doctor_patient_registry r where r.child_id=i.child_id and r.professional_id=auth.uid()) or exists(select 1 from public.appointments a where a.vaccine_item_id=i.id and a.responsible_id=auth.uid()));
$$;
create function private.vaccine_followup_worklist(p_bucket text default 'all',p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.assert_doctor();
 if p_page is null or p_page not between 1 and 10000 or p_bucket is null or p_bucket not in ('all','routine_due','potentially_overdue_unconfirmed','unknown_history','documented','reference_review') then raise exception 'Invalid vaccine follow-up filters' using errcode='22023';end if;
 with rows as materialized(select data from private.vaccine_followup_rows() r(data)),
 filtered as(select data from rows where p_bucket='all' or data->>'followup_state'=p_bucket or (p_bucket='unknown_history' and (data->>'history_status'<>'reviewed' or data->'reference'->>'state' in ('birth_date_uncertain','eligibility_unknown')))),
 page as(select data from filtered order by (data->'reference'->>'end_on')::date nulls last,data->>'id' limit 30 offset (p_page-1)*30)
 select jsonb_build_object('items',coalesce((select jsonb_agg(data order by (data->'reference'->>'end_on')::date nulls last,data->>'id') from page),'[]'::jsonb),'total',(select count(*) from filtered),'page',p_page,'generated_at',now(),
 'counts',(select jsonb_build_object('potentially_overdue_unconfirmed',count(*) filter(where data->>'followup_state'='potentially_overdue_unconfirmed'),'routine_due',count(*) filter(where data->>'followup_state'='routine_due'),'unknown_history',count(*) filter(where data->>'history_status'<>'reviewed' or data->'reference'->>'state' in ('birth_date_uncertain','eligibility_unknown')),'documented',count(*) filter(where data->>'followup_state'='documented'),'reference_review',count(*) filter(where data->>'followup_state'='reference_review')) from rows)) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) select auth.uid(),(value->>'child_id')::uuid,'vaccine_followup_read','accessed' from jsonb_array_elements(result->'items') group by value->>'child_id';return result;
end;$$;
create function private.patient_visit_overview(p_child_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_access_child(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 select jsonb_build_object('last_documented_care',(select max(e.occurred_on) from public.clinical_entries e where e.child_id=p_child_id and e.entry_state='active' and e.occurrence_precision='exact' and not exists(select 1 from public.clinical_entries newer where newer.root_id=e.root_id and newer.revision>e.revision)),
 'next_own_appointment',(select data from private.appointment_rows(p_child_id,true) r(data) where data->>'effective_state'='scheduled' and (data->>'starts_at')::timestamptz>=now() order by (data->>'starts_at')::timestamptz,data->>'id' limit 1)) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'patient_visit_overview_read','accessed');return result;
end;$$;

-- Preserve existing scoped registry search and append visit metadata only for its authorized page.
alter function private.list_patients(text,text,text,integer) rename to list_patients_base;
create function private.list_patients(p_query text default '',p_history text default 'all',p_age text default 'all',p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;items jsonb;
begin
 result:=private.list_patients_base(p_query,p_history,p_age,p_page);
 select coalesce(jsonb_agg(value||private.patient_visit_overview((value->>'id')::uuid) order by ord),'[]'::jsonb) into items from jsonb_array_elements(result->'items') with ordinality as rows(value,ord);
 return jsonb_set(result,'{items}',items);
end;$$;
create or replace function public.list_patients(p_query text default '',p_history text default 'all',p_age text default 'all',p_page integer default 1) returns jsonb language sql security invoker set search_path='' as $$select private.list_patients(p_query,p_history,p_age,p_page);$$;

create function public.create_appointment(p_operation_id uuid,p_child_id uuid,p_facility_id uuid,p_purpose text,p_purpose_label text,p_vaccine_item_id uuid,p_starts_at text,p_ends_at text,p_reason text,p_reviewed boolean) returns uuid language sql security invoker set search_path='' as $$select private.create_appointment(p_operation_id,p_child_id,p_facility_id,p_purpose,p_purpose_label,p_vaccine_item_id,p_starts_at,p_ends_at,p_reason,p_reviewed);$$;
create function public.change_appointment(p_operation_id uuid,p_appointment_id uuid,p_expected_revision integer,p_action text,p_starts_at text,p_ends_at text,p_reason text,p_reviewed boolean) returns uuid language sql security invoker set search_path='' as $$select private.change_appointment(p_operation_id,p_appointment_id,p_expected_revision,p_action,p_starts_at,p_ends_at,p_reason,p_reviewed);$$;
create function public.appointment_calendar(p_from date,p_to date,p_page integer default 1,p_state text default 'all') returns jsonb language sql security invoker set search_path='' as $$select private.appointment_calendar(p_from,p_to,p_page,p_state);$$;
create function public.appointment_worklist(p_bucket text default 'today',p_page integer default 1) returns jsonb language sql security invoker set search_path='' as $$select private.appointment_worklist(p_bucket,p_page);$$;
create function public.patient_appointments(p_child_id uuid,p_page integer default 1) returns jsonb language sql security invoker set search_path='' as $$select private.patient_appointments(p_child_id,p_page);$$;
create function public.appointment_history(p_child_id uuid,p_appointment_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.appointment_history(p_child_id,p_appointment_id);$$;
create function public.appointments_export(p_child_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.appointments_export(p_child_id);$$;
create function public.vaccine_followup_worklist(p_bucket text default 'all',p_page integer default 1) returns jsonb language sql security invoker set search_path='' as $$select private.vaccine_followup_worklist(p_bucket,p_page);$$;
create function public.patient_visit_overview(p_child_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.patient_visit_overview(p_child_id);$$;

do $$declare fn record;begin
 for fn in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname=any(array['appointment_instant','item_documentation','assert_appointment_item','assert_open_appointment','create_appointment','change_appointment','guard_appointment_identity','guard_appointment_event','appointment_rows','appointment_calendar','appointment_worklist','patient_appointments','appointment_history','appointments_export','item_reference','vaccine_followup_rows','vaccine_followup_worklist','patient_visit_overview','list_patients','list_patients_base']) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
  if fn.proname=any(array['create_appointment','change_appointment','appointment_calendar','appointment_worklist','patient_appointments','appointment_history','appointments_export','vaccine_followup_worklist','patient_visit_overview','list_patients']) then execute format('grant execute on function %s to authenticated',fn.signature);end if;
 end loop;
end$$;
commit;
