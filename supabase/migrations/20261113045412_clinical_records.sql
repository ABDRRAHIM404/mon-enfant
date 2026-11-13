begin;
alter table private.staff_permissions add column can_manage_clinical_permissions boolean not null default false;
create table public.professional_capabilities (
  professional_id uuid not null references public.professional_profiles(user_id),
  capability text not null check(capability in ('consultation','prescription','risk','growth','vaccination')),
  enabled boolean not null default false, expires_at timestamptz,
  granted_by uuid not null references public.professional_profiles(user_id),
  changed_at timestamptz not null default now(),
  primary key(professional_id,capability)
);
create index professional_capabilities_granter_idx on public.professional_capabilities(granted_by);
create table public.capability_changes (
  id uuid primary key default gen_random_uuid(),professional_id uuid not null references public.professional_profiles(user_id),
  capability text not null,enabled boolean not null,expires_at timestamptz,
  actor_id uuid not null references public.professional_profiles(user_id),
  evidence_reference text not null check(length(trim(evidence_reference)) between 10 and 1000),
  reason text not null check(length(trim(reason)) between 10 and 1000),created_at timestamptz not null default now()
);
create index capability_changes_professional_idx on public.capability_changes(professional_id,created_at desc);
create index capability_changes_actor_idx on public.capability_changes(actor_id);
create trigger capability_changes_immutable before update or delete on public.capability_changes for each row execute function private.prevent_mutation();
create trigger capability_changes_audit after insert on public.capability_changes for each row execute function private.audit_change();
alter table public.professional_capabilities enable row level security;
alter table public.capability_changes enable row level security;
revoke all on public.professional_capabilities,public.capability_changes from public,anon,authenticated;

create function private.can_manage_clinical_permissions() returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_live_session() and exists(select 1 from public.professional_profiles p join private.staff_permissions s on s.user_id=p.user_id where p.user_id=auth.uid() and p.role='admin' and p.verification_status='approved' and s.can_manage_clinical_permissions);
$$;
create function public.can_manage_clinical_permissions() returns boolean language sql stable security invoker set search_path='' as $$select private.can_manage_clinical_permissions();$$;
create function private.has_clinical_capability(p_capability text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_live_session() and exists(select 1 from public.professional_profiles p join public.professional_capabilities c on c.professional_id=p.user_id where p.user_id=auth.uid() and p.role='doctor' and p.verification_status='approved' and p.professional_id is not null and c.capability=p_capability and c.enabled and (c.expires_at is null or c.expires_at>now()));
$$;
create function private.my_clinical_capabilities() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.assert_doctor();
 return coalesce((select jsonb_agg(c.capability order by c.capability) from public.professional_capabilities c where c.professional_id=auth.uid() and private.has_clinical_capability(c.capability)),'[]'::jsonb);
end;$$;
create function public.my_clinical_capabilities() returns jsonb language sql stable security invoker set search_path='' as $$select private.my_clinical_capabilities();$$;
create function private.set_clinical_capability(p_operation_id uuid,p_professional_id uuid,p_capability text,p_enabled boolean,p_expires_at timestamptz,p_evidence_reference text,p_reason text,p_verified boolean) returns uuid
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
 if p_capability is null or p_capability not in ('consultation','prescription','risk','growth','vaccination') or p_enabled is null or p_evidence_reference is null or length(trim(p_evidence_reference)) not between 10 and 1000 or p_reason is null or length(trim(p_reason)) not between 10 and 1000 or (p_enabled and (p_verified is distinct from true or (p_expires_at is not null and p_expires_at<=now()))) then raise exception 'Verified basis, reason and valid permission required' using errcode='22023'; end if;
 if not exists(select 1 from public.professional_profiles p where p.user_id=p_professional_id and p.role='doctor' and (not p_enabled or (p.verification_status='approved' and p.professional_id is not null))) then raise exception 'Eligible professional required' using errcode='42501'; end if;
 insert into public.professional_capabilities(professional_id,capability,enabled,expires_at,granted_by) values(p_professional_id,p_capability,p_enabled,p_expires_at,auth.uid()) on conflict(professional_id,capability) do update set enabled=excluded.enabled,expires_at=excluded.expires_at,granted_by=excluded.granted_by,changed_at=now();
 insert into public.capability_changes(professional_id,capability,enabled,expires_at,actor_id,evidence_reference,reason) values(p_professional_id,p_capability,p_enabled,p_expires_at,auth.uid(),trim(p_evidence_reference),trim(p_reason));
 insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id) values(auth.uid(),p_operation_id,'clinical_permission',payload,p_professional_id);
 return p_professional_id;
end;$$;
create function public.set_clinical_capability(p_operation_id uuid,p_professional_id uuid,p_capability text,p_enabled boolean,p_expires_at timestamptz,p_evidence_reference text,p_reason text,p_verified boolean) returns uuid language sql security invoker set search_path='' as $$select private.set_clinical_capability(p_operation_id,p_professional_id,p_capability,p_enabled,p_expires_at,p_evidence_reference,p_reason,p_verified);$$;
create function private.list_clinical_permissions(p_query text default '',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; total bigint;
begin
 if not private.can_manage_clinical_permissions() then raise exception 'Clinical permission manager required' using errcode='42501'; end if;
 if p_query is null or length(p_query)>100 or p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid filters' using errcode='22023'; end if;
 select count(*) into total from public.professional_profiles p where p.role='doctor' and p.professional_id is not null and strpos(lower(p.professional_id),lower(p_query))>0;
 select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('capabilities',coalesce((select jsonb_agg(jsonb_build_object('capability',c.capability,'enabled',c.enabled,'expires_at',c.expires_at)) from public.professional_capabilities c where c.professional_id=p.user_id),'[]'::jsonb))),'[]'::jsonb) into result from (select user_id,professional_id,verification_status from public.professional_profiles where role='doctor' and professional_id is not null and strpos(lower(professional_id),lower(p_query))>0 order by professional_id limit 30 offset (p_page-1)*30) p;
 return jsonb_build_object('items',result,'total',total);
end;$$;
create function public.list_clinical_permissions(p_query text default '',p_page integer default 1) returns jsonb language sql stable security invoker set search_path='' as $$select private.list_clinical_permissions(p_query,p_page);$$;
create function private.clinical_capability_history(p_professional_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_manage_clinical_permissions() and (auth.uid() is distinct from p_professional_id or not private.has_live_session()) then raise exception 'Permission history denied' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc,c.id) from public.capability_changes c where c.professional_id=p_professional_id),'[]'::jsonb);
end;$$;
create function public.clinical_capability_history(p_professional_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.clinical_capability_history(p_professional_id);$$;

create table public.clinical_entries (
 id uuid primary key default gen_random_uuid(),root_id uuid not null references public.clinical_entries(id),
 previous_id uuid unique references public.clinical_entries(id),revision integer not null check(revision>=1),
 child_id uuid not null references public.children(id),
 kind text not null check(kind in ('consultation','prescription','risk','growth')),
 author_id uuid not null references public.professional_profiles(user_id),professional_id text not null,
 facility_id uuid not null references public.facilities(id),
 occurred_on date,occurrence_precision text not null check(occurrence_precision in ('exact','estimated','unknown')),
 source_type text not null check(source_type in ('observed','paper_transcription','reported_history')),
 source_reference text check(length(source_reference)<=1000),source_verified boolean not null,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=20000),
 entry_state text not null default 'active' check(entry_state in ('active','withdrawn')),
 amendment_reason text check(length(trim(amendment_reason)) between 10 and 1000),recorded_at timestamptz not null default now(),
 unique(root_id,revision),check((occurrence_precision='unknown')=(occurred_on is null)),
 check((revision=1 and previous_id is null and root_id=id and amendment_reason is null and entry_state='active') or (revision>1 and previous_id is not null and amendment_reason is not null))
);
create index clinical_entries_child_time_idx on public.clinical_entries(child_id,recorded_at desc,id);
create index clinical_entries_author_idx on public.clinical_entries(author_id);
create index clinical_entries_facility_idx on public.clinical_entries(facility_id);
alter table public.clinical_entries enable row level security;
revoke all on public.clinical_entries from public,anon,authenticated;
create trigger clinical_entries_immutable before update or delete on public.clinical_entries for each row execute function private.prevent_mutation();
create trigger clinical_entries_audit after insert on public.clinical_entries for each row execute function private.audit_change();

create function private.validate_clinical_payload(p_kind text,p_payload jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare keys text[]; key text; value jsonb; n numeric;
begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>20000 then raise exception 'Invalid clinical payload' using errcode='22023'; end if;
 keys:=case p_kind when 'consultation' then array['reason','findings','assessment','plan'] when 'prescription' then array['medication','instructions','duration'] when 'risk' then array['category','description','severity'] when 'growth' then array['weight_kg','height_cm','head_cm'] else null end;
 if keys is null or exists(select 1 from jsonb_object_keys(p_payload) k where k<>all(keys)) then raise exception 'Unsupported clinical fields' using errcode='22023'; end if;
 if p_kind='growth' then
  if p_payload='{}'::jsonb then raise exception 'At least one measurement required' using errcode='22023'; end if;
  for key,value in select * from jsonb_each(p_payload) loop
   if jsonb_typeof(value)<>'number' then raise exception 'Numeric measurements required' using errcode='22023'; end if;
   n:=value::text::numeric;
   if (key='weight_kg' and n not between 0.1 and 250) or (key='height_cm' and n not between 20 and 250) or (key='head_cm' and n not between 10 and 100) then raise exception 'Measurement outside input bounds' using errcode='22023'; end if;
  end loop;
 else
  for key,value in select * from jsonb_each(p_payload) loop
   if jsonb_typeof(value)<>'string' or length(value#>>'{}')>case key when 'findings' then 8000 when 'assessment' then 4000 when 'plan' then 4000 when 'reason' then 1000 when 'medication' then 200 when 'duration' then 200 else 2000 end then raise exception 'Invalid clinical text' using errcode='22023'; end if;
  end loop;
  if p_kind='consultation' and coalesce(length(trim(p_payload->>'reason')),0)<1 then raise exception 'Consultation reason required' using errcode='22023'; end if;
  if p_kind='prescription' and (coalesce(length(trim(p_payload->>'medication')),0)<1 or coalesce(length(trim(p_payload->>'instructions')),0)<1) then raise exception 'Medication and instructions required' using errcode='22023'; end if;
  if p_kind='risk' and (coalesce(length(trim(p_payload->>'description')),0)<1 or coalesce(p_payload->>'category','') not in ('allergy','medical','social','other') or coalesce(p_payload->>'severity','') not in ('unknown','low','moderate','high')) then raise exception 'Risk details required' using errcode='22023'; end if;
 end if;
end;$$;

create function private.write_clinical_entry(p_operation_id uuid,p_child_id uuid,p_kind text,p_facility_id uuid,p_occurred_on date,p_occurrence_precision text,p_source_type text,p_source_reference text,p_source_verified boolean,p_payload jsonb,p_root_id uuid default null,p_expected_revision integer default null,p_amendment_reason text default null,p_entry_state text default 'active') returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; result uuid; prior public.clinical_entries; child public.children; platform text;
 operation_payload jsonb:=jsonb_build_object('child',p_child_id,'kind',p_kind,'facility',p_facility_id,'occurred_on',p_occurred_on,'precision',p_occurrence_precision,'source',p_source_type,'reference',p_source_reference,'verified',p_source_verified,'payload',p_payload,'root',p_root_id,'revision',p_expected_revision,'reason',p_amendment_reason,'state',p_entry_state);
begin
 actor:=private.assert_doctor();
 perform pg_advisory_xact_lock(hashtextextended(p_child_id::text,0));
 if not private.can_access_child(p_child_id,false) or not private.has_clinical_capability(p_kind) then raise exception 'Clinical capability and child access required' using errcode='42501'; end if;
 perform private.assert_facility(p_facility_id);
 result:=private.operation_result(p_operation_id,'clinical_entry',operation_payload);if result is not null then return result;end if;
 perform private.validate_clinical_payload(p_kind,p_payload);
 select * into child from public.children where id=p_child_id;
 if p_occurrence_precision is null or p_occurrence_precision not in ('exact','estimated','unknown') or (p_occurrence_precision='unknown')<>(p_occurred_on is null) or (p_occurred_on is not null and (p_occurred_on>(now() at time zone 'Africa/Casablanca')::date or p_occurred_on<date '1900-01-01' or (child.birth_date_precision='exact' and p_occurred_on<child.birth_date))) then raise exception 'Invalid occurrence date or certainty' using errcode='22023';end if;
 if p_source_type is null or p_source_type not in ('observed','paper_transcription','reported_history') or p_source_verified is null or (p_source_type='observed' and p_occurrence_precision<>'exact') or (p_source_type<>'observed' and coalesce(length(trim(p_source_reference)),0)<3) or length(p_source_reference)>1000 or p_entry_state is null or p_entry_state not in ('active','withdrawn') then raise exception 'Invalid provenance or entry state' using errcode='22023';end if;
 if p_root_id is not null then
  perform pg_advisory_xact_lock(hashtextextended(p_root_id::text,1));
  select * into prior from public.clinical_entries where root_id=p_root_id order by revision desc limit 1;
  if not found or prior.child_id<>p_child_id or prior.kind<>p_kind then raise exception 'Clinical entry denied' using errcode='42501';end if;
  if p_expected_revision is null or prior.revision<>p_expected_revision then raise exception 'Stale clinical revision' using errcode='40001';end if;
  if p_amendment_reason is null or length(trim(p_amendment_reason)) not between 10 and 1000 then raise exception 'Amendment reason required' using errcode='22023';end if;
 elsif p_expected_revision is not null or p_amendment_reason is not null or p_entry_state<>'active' then raise exception 'New entry cannot amend or withdraw' using errcode='22023';
 end if;
 select professional_id into platform from public.professional_profiles where user_id=actor;
 result:=gen_random_uuid();
 insert into public.clinical_entries(id,root_id,previous_id,revision,child_id,kind,author_id,professional_id,facility_id,occurred_on,occurrence_precision,source_type,source_reference,source_verified,payload,entry_state,amendment_reason)
 values(result,coalesce(p_root_id,result),prior.id,coalesce(prior.revision,0)+1,p_child_id,p_kind,actor,platform,p_facility_id,p_occurred_on,p_occurrence_precision,p_source_type,nullif(trim(p_source_reference),''),p_source_verified,p_payload,p_entry_state,case when p_root_id is not null then trim(p_amendment_reason) else null end);
 insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id) values(actor,p_operation_id,'clinical_entry',operation_payload,result);
 return result;
end;$$;
create function public.write_clinical_entry(p_operation_id uuid,p_child_id uuid,p_kind text,p_facility_id uuid,p_occurred_on date,p_occurrence_precision text,p_source_type text,p_source_reference text,p_source_verified boolean,p_payload jsonb,p_root_id uuid default null,p_expected_revision integer default null,p_amendment_reason text default null,p_entry_state text default 'active') returns uuid language sql security invoker set search_path='' as $$select private.write_clinical_entry(p_operation_id,p_child_id,p_kind,p_facility_id,p_occurred_on,p_occurrence_precision,p_source_type,p_source_reference,p_source_verified,p_payload,p_root_id,p_expected_revision,p_amendment_reason,p_entry_state);$$;

create function private.clinical_timeline(p_child_id uuid,p_page integer default 1,p_kind text default 'all') returns jsonb
language plpgsql security definer set search_path='' as $$
declare items jsonb;total bigint;
begin
 if not private.can_access_child(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 10000 or p_kind is null or p_kind not in ('all','consultation','prescription','risk','growth') then raise exception 'Invalid timeline filters' using errcode='22023';end if;
 select count(*) into total from public.clinical_entries e where e.child_id=p_child_id and e.revision=1 and (p_kind='all' or e.kind=p_kind);
 select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('facility_name',f.name) order by e.occurred_on desc nulls last,e.recorded_at desc,e.id),'[]'::jsonb) into items
 from (select latest.* from (select distinct on(root_id) * from public.clinical_entries where child_id=p_child_id and (p_kind='all' or kind=p_kind) order by root_id,revision desc) latest order by occurred_on desc nulls last,recorded_at desc,id limit 30 offset (p_page-1)*30) e join public.facilities f on f.id=e.facility_id;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'clinical_timeline_read','accessed');
 return jsonb_build_object('items',items,'total',total,'page',p_page);
end;$$;
create function public.clinical_timeline(p_child_id uuid,p_page integer default 1,p_kind text default 'all') returns jsonb language sql security invoker set search_path='' as $$select private.clinical_timeline(p_child_id,p_page,p_kind);$$;
create function private.clinical_entry_history(p_child_id uuid,p_root_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_access_child(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('facility_name',f.name) order by e.revision),'[]'::jsonb) into result from public.clinical_entries e join public.facilities f on f.id=e.facility_id where e.child_id=p_child_id and e.root_id=p_root_id;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'clinical_history_read','accessed');return result;
end;$$;
create function public.clinical_entry_history(p_child_id uuid,p_root_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.clinical_entry_history(p_child_id,p_root_id);$$;
create function private.clinical_export(p_child_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_access_child(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 if (select count(*) from public.clinical_entries where child_id=p_child_id)>5000 then raise exception 'Export exceeds interactive limit; use approved scoped export procedure' using errcode='54000';end if;
 select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('facility_name',f.name) order by e.root_id,e.revision),'[]'::jsonb) into result from public.clinical_entries e join public.facilities f on f.id=e.facility_id where e.child_id=p_child_id;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'clinical_export','accessed');return result;
end;$$;
create function public.clinical_export(p_child_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.clinical_export(p_child_id);$$;

do $$declare fn record;begin
 for fn in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname=any(array['can_manage_clinical_permissions','has_clinical_capability','my_clinical_capabilities','set_clinical_capability','list_clinical_permissions','clinical_capability_history','validate_clinical_payload','write_clinical_entry','clinical_timeline','clinical_entry_history','clinical_export']) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
  if fn.proname<>'validate_clinical_payload' then execute format('grant execute on function %s to authenticated',fn.signature);end if;
 end loop;
end$$;
commit;
