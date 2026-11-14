begin;

-- Apply parity to the CURRENT definitions, preserving all session, approval,
-- capability, child-grant and independent-review conditions and existing ACLs.
-- Historical migrations stay immutable; neither role gains a blanket grant.
do $parity$
declare f record; definition text;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.prokind='f' loop
  definition:=pg_get_functiondef(f.oid);
  if definition ~ E'\\mrole\\s*(=|<>)\\s*''doctor''' then
   definition:=regexp_replace(definition,E'\\mrole\\s*=\\s*''doctor''','role in (''doctor'',''nurse'')','g');
   definition:=regexp_replace(definition,E'\\mrole\\s*<>\\s*''doctor''','role not in (''doctor'',''nurse'')','g');
   execute definition;
  end if;
 end loop;
end $parity$;
-- Own unverified enrollment only; role choice is a declaration, never approval.
create function private.enroll_clinician(p_role text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); current_role public.professional_role;
begin
 if not private.has_live_session() then raise exception 'Not authorized' using errcode='42501';end if;
 if p_role is null or p_role not in ('doctor','nurse') then raise exception 'Invalid declared role' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('clinician-enroll:'||actor::text,0));
 select role into current_role from public.professional_profiles where user_id=actor;
 if found then
  if current_role::text<>p_role then raise exception 'Existing role cannot be changed by enrollment' using errcode='42501';end if;
  return;
 end if;
 insert into public.professional_profiles(user_id,role) values(actor,p_role::public.professional_role);
end;$$;
create function public.enroll_clinician(p_role text) returns void language sql security invoker set search_path='' as $$select private.enroll_clinician(p_role);$$;

drop policy evidence_owner_upload on storage.objects;
create policy evidence_owner_upload on storage.objects for insert to authenticated with check (
 bucket_id='professional-evidence' and split_part(name,'/',1)=(select auth.uid())::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/evidence\.(pdf|jpg|png)$'
 and exists(select 1 from public.professional_profiles p where p.user_id=(select auth.uid()) and p.role in ('doctor','nurse') and p.verification_status in ('unverified','rejected'))
);

-- No public child FK, register, access grant, guardian link or share token.
-- These identities can NEVER enter trusted duplicate probes or clinical history.
create table private.provisional_children (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.professional_profiles(user_id),
 operation_id uuid not null,identity jsonb not null,author_role public.professional_role not null,
 account_status public.verification_status not null,validation_state text not null default 'unverified' check(validation_state='unverified'),
 created_at timestamptz not null default now(),unique(owner_id,operation_id)
);
create index provisional_children_owner_idx on private.provisional_children(owner_id,created_at desc,id);
create table private.provisional_entries (
 id uuid primary key,child_id uuid not null references private.provisional_children(id),owner_id uuid not null references public.professional_profiles(user_id),
 operation_id uuid not null,root_id uuid not null,previous_id uuid references private.provisional_entries(id),revision integer not null check(revision>0),
 kind text not null check(kind in ('consultation','prescription','risk','growth','vaccination','appointment')),
 occurred_on date,occurrence_precision text not null check(occurrence_precision in ('exact','estimated','unknown')),
 source_type text not null check(source_type in ('observed','paper_transcription','reported')),source_reference text,
 payload jsonb not null,reason text,entry_state text not null check(entry_state in ('active','withdrawn')),
 author_role public.professional_role not null,account_status public.verification_status not null,
 validation_state text not null default 'unverified' check(validation_state='unverified'),recorded_at timestamptz not null default now(),
 unique(owner_id,operation_id),unique(root_id,revision),
 check((revision=1 and previous_id is null and root_id=id) or (revision>1 and previous_id is not null and length(trim(reason)) between 10 and 1000))
);
create index provisional_entries_child_idx on private.provisional_entries(child_id,root_id,revision desc);
create table private.provisional_audit (
 id uuid primary key default gen_random_uuid(),actor_id uuid not null references public.professional_profiles(user_id),child_id uuid,
 action text not null,created_at timestamptz not null default now()
);
alter table private.provisional_children enable row level security;
alter table private.provisional_entries enable row level security;
alter table private.provisional_audit enable row level security;
revoke all on private.provisional_children,private.provisional_entries,private.provisional_audit from public,anon,authenticated;
create trigger provisional_children_immutable before update or delete on private.provisional_children for each row execute function private.prevent_mutation();
create trigger provisional_entries_immutable before update or delete on private.provisional_entries for each row execute function private.prevent_mutation();
create trigger provisional_audit_immutable before update or delete on private.provisional_audit for each row execute function private.prevent_mutation();

create function private.assert_provisional_author() returns public.professional_profiles language plpgsql stable security definer set search_path='' as $$
declare profile public.professional_profiles;
begin
 select * into profile from public.professional_profiles where user_id=auth.uid();
 if not private.has_live_session() or not found or profile.role not in ('doctor','nurse') or profile.verification_status not in ('unverified','under_review','approved') then
  raise exception 'Not authorized' using errcode='42501';
 end if;
 return profile;
end;$$;

create function private.create_provisional_child(p_operation_id uuid,p_identity jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare profile public.professional_profiles; child private.provisional_children; key text; value jsonb; result uuid;
begin
 profile:=private.assert_provisional_author();
 if p_operation_id is null or p_identity is null or jsonb_typeof(p_identity)<>'object' or octet_length(p_identity::text)>8000 then raise exception 'Invalid identity' using errcode='22023';end if;
 for key,value in select * from jsonb_each(p_identity) loop
  if key<>all(array['given_name','family_name','name_status','birth_date','birth_date_precision','sex','source_reference','local_reference']) or jsonb_typeof(value)<>'string' or length(value#>>'{}')>500 then raise exception 'Invalid identity field' using errcode='22023';end if;
 end loop;
 if coalesce(p_identity->>'name_status','') not in ('confirmed','provisional','unknown') or coalesce(p_identity->>'birth_date_precision','') not in ('exact','estimated','unknown') or coalesce(p_identity->>'sex','') not in ('male','female','unknown') then raise exception 'Identity certainty required' using errcode='22023';end if;
 if p_identity->>'name_status'<>'unknown' and (coalesce(length(trim(p_identity->>'given_name')),0) not between 1 and 100 or coalesce(length(trim(p_identity->>'family_name')),0) not between 1 and 100) then raise exception 'Names required' using errcode='22023';end if;
 if p_identity->>'name_status'='unknown' and (coalesce(p_identity->>'given_name','')<>'' or coalesce(p_identity->>'family_name','')<>'') then raise exception 'Unknown identity must remain unknown' using errcode='22023';end if;
 if p_identity->>'birth_date_precision'='unknown' then
  if coalesce(p_identity->>'birth_date','')<>'' then raise exception 'Unknown birth date must remain unknown' using errcode='22023';end if;
 elsif coalesce(p_identity->>'birth_date','') !~ '^\d{4}-\d{2}-\d{2}$' or (p_identity->>'birth_date')::date not between date '1900-01-01' and current_date then raise exception 'Invalid birth date' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('provisional-create:'||profile.user_id::text||p_operation_id::text,0));
 select * into child from private.provisional_children where owner_id=profile.user_id and operation_id=p_operation_id;
 if found then
  if child.identity is distinct from p_identity then raise exception 'Operation input changed' using errcode='22023';end if;
  return child.id;
 end if;
 insert into private.provisional_children(owner_id,operation_id,identity,author_role,account_status) values(profile.user_id,p_operation_id,p_identity,profile.role,profile.verification_status) returning id into result;
 insert into private.provisional_audit(actor_id,child_id,action) values(profile.user_id,result,'child_created');
 return result;
end;$$;
create function public.create_provisional_child(p_operation_id uuid,p_identity jsonb) returns uuid language sql security invoker set search_path='' as $$select private.create_provisional_child(p_operation_id,p_identity);$$;

create function private.write_provisional_entry(p_operation_id uuid,p_child_id uuid,p_kind text,p_occurred_on date,p_occurrence_precision text,p_source_type text,p_source_reference text,p_payload jsonb,p_root_id uuid default null,p_expected_revision integer default null,p_reason text default null,p_entry_state text default 'active') returns uuid language plpgsql security definer set search_path='' as $$
declare profile public.professional_profiles; prior private.provisional_entries; receipt private.provisional_entries; result uuid:=gen_random_uuid(); root uuid; rev integer:=1; key text; val jsonb;
begin
 profile:=private.assert_provisional_author();
 -- Check ownership BEFORE validating or probing entry IDs. Missing and foreign IDs have identical behavior.
 if not exists(select 1 from private.provisional_children where id=p_child_id and owner_id=profile.user_id) then raise exception 'Record unavailable' using errcode='42501';end if;
 if p_operation_id is null or p_kind is null or p_kind not in ('consultation','prescription','risk','growth','vaccination','appointment') or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>16000 or coalesce(p_occurrence_precision,'') not in ('exact','estimated','unknown') or coalesce(p_source_type,'') not in ('observed','paper_transcription','reported') or coalesce(p_entry_state,'') not in ('active','withdrawn') or length(coalesce(p_source_reference,''))>1000 then raise exception 'Invalid entry' using errcode='22023';end if;
 if (p_occurrence_precision='unknown')<>(p_occurred_on is null) or (p_kind<>'appointment' and p_occurred_on>current_date) then raise exception 'Invalid occurrence date' using errcode='22023';end if;
 if p_occurred_on<date '1900-01-01' or p_occurred_on>current_date+interval '10 years' then raise exception 'Invalid occurrence date' using errcode='22023';end if;
 if p_source_type='paper_transcription' and coalesce(length(trim(p_source_reference)),0)<3 then raise exception 'Paper source required' using errcode='22023';end if;
 if p_kind in ('consultation','prescription','risk','growth') then perform private.validate_clinical_payload(p_kind,p_payload);
 elsif p_kind='vaccination' then
  for key,val in select * from jsonb_each(p_payload) loop
   if key<>all(array['vaccine_label','dose_label','lot_number','site','administered_by','administration_facility','notes']) or jsonb_typeof(val)<>'string' or length(val#>>'{}')>2000 then raise exception 'Invalid vaccine details' using errcode='22023';end if;
  end loop;
  if coalesce(length(trim(p_payload->>'vaccine_label')),0) not between 1 and 200 or coalesce(length(trim(p_payload->>'dose_label')),0) not between 1 and 100 then raise exception 'Vaccine and dose required' using errcode='22023';end if;
 else
  for key,val in select * from jsonb_each(p_payload) loop
   if key<>all(array['purpose','scheduled_for','status','notes']) or jsonb_typeof(val)<>'string' or length(val#>>'{}')>2000 then raise exception 'Invalid appointment details' using errcode='22023';end if;
  end loop;
  if coalesce(length(trim(p_payload->>'purpose')),0) not between 1 and 200 or coalesce(p_payload->>'status','') not in ('planned','completed','missed','cancelled','rescheduled') or coalesce(p_payload->>'scheduled_for','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$' then raise exception 'Appointment purpose, time and disposition required' using errcode='22023';end if;
  if (p_payload->>'scheduled_for')::timestamptz not between timestamptz '1900-01-01' and now()+interval '10 years' then raise exception 'Invalid scheduled time' using errcode='22023';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('provisional-entry:'||profile.user_id::text||p_operation_id::text,0));
 select * into receipt from private.provisional_entries where owner_id=profile.user_id and operation_id=p_operation_id;
 if found then
  if receipt.child_id<>p_child_id or receipt.kind<>p_kind or receipt.occurred_on is distinct from p_occurred_on or receipt.occurrence_precision<>p_occurrence_precision or receipt.source_type<>p_source_type or receipt.source_reference is distinct from nullif(trim(p_source_reference),'') or receipt.payload is distinct from p_payload or receipt.reason is distinct from nullif(trim(p_reason),'') or receipt.entry_state<>p_entry_state or (p_root_id is null and receipt.revision<>1) or (p_root_id is not null and (receipt.root_id<>p_root_id or receipt.revision<>coalesce(p_expected_revision,0)+1)) then raise exception 'Operation input changed' using errcode='22023';end if;
  return receipt.id;
 end if;
 if p_root_id is null then
  if p_expected_revision is not null or p_entry_state<>'active' then raise exception 'Invalid first revision' using errcode='22023';end if;
  root:=result;
 else
  perform pg_advisory_xact_lock(hashtextextended('provisional-root:'||p_root_id::text,0));
  select * into prior from private.provisional_entries where child_id=p_child_id and owner_id=profile.user_id and root_id=p_root_id order by revision desc limit 1;
  if not found then raise exception 'Record unavailable' using errcode='42501';end if;
  if prior.revision is distinct from p_expected_revision then raise exception 'Revision changed' using errcode='PT409';end if;
  if prior.kind<>p_kind or coalesce(length(trim(p_reason)),0) not between 10 and 1000 then raise exception 'Amendment reason required' using errcode='22023';end if;
  root:=prior.root_id;rev:=prior.revision+1;
 end if;
 insert into private.provisional_entries(id,child_id,owner_id,operation_id,root_id,previous_id,revision,kind,occurred_on,occurrence_precision,source_type,source_reference,payload,reason,entry_state,author_role,account_status)
 values(result,p_child_id,profile.user_id,p_operation_id,root,prior.id,rev,p_kind,p_occurred_on,p_occurrence_precision,p_source_type,nullif(trim(p_source_reference),''),p_payload,nullif(trim(p_reason),''),p_entry_state,profile.role,profile.verification_status);
 insert into private.provisional_audit(actor_id,child_id,action) values(profile.user_id,p_child_id,case when rev=1 then 'entry_created' else 'entry_revised' end);
 return result;
end;$$;
create function public.write_provisional_entry(p_operation_id uuid,p_child_id uuid,p_kind text,p_occurred_on date,p_occurrence_precision text,p_source_type text,p_source_reference text,p_payload jsonb,p_root_id uuid default null,p_expected_revision integer default null,p_reason text default null,p_entry_state text default 'active') returns uuid language sql security invoker set search_path='' as $$select private.write_provisional_entry(p_operation_id,p_child_id,p_kind,p_occurred_on,p_occurrence_precision,p_source_type,p_source_reference,p_payload,p_root_id,p_expected_revision,p_reason,p_entry_state);$$;

create function private.provisional_workspace(p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
declare profile public.professional_profiles; items jsonb; total integer;
begin
 profile:=private.assert_provisional_author();
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid page' using errcode='22023';end if;
 select count(*) into total from private.provisional_children where owner_id=profile.user_id;
 select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into items from (select * from private.provisional_children where owner_id=profile.user_id order by created_at desc,id limit 30 offset (p_page-1)*30)c;
 insert into private.provisional_audit(actor_id,action) values(profile.user_id,'workspace_read');
 return jsonb_build_object('items',items,'total',total,'page',p_page);
end;$$;
create function public.provisional_workspace(p_page integer default 1) returns jsonb language sql security invoker set search_path='' as $$select private.provisional_workspace(p_page);$$;

create function private.provisional_booklet(p_child_id uuid,p_page integer default 1,p_root_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare profile public.professional_profiles; child private.provisional_children; entries jsonb; total integer;
begin
 profile:=private.assert_provisional_author();
 select * into child from private.provisional_children where id=p_child_id and owner_id=profile.user_id;
 if not found then raise exception 'Record unavailable' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid page' using errcode='22023';end if;
 select count(*) into total from private.provisional_entries where child_id=p_child_id and (p_root_id is null or root_id=p_root_id);
 select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) into entries from(select * from private.provisional_entries where child_id=p_child_id and (p_root_id is null or root_id=p_root_id) order by recorded_at desc,revision desc,id limit 30 offset (p_page-1)*30)e;
 insert into private.provisional_audit(actor_id,child_id,action) values(profile.user_id,p_child_id,'booklet_read');
 return jsonb_build_object('child',to_jsonb(child),'entries',entries,'total',total,'page',p_page);
end;$$;
create function public.provisional_booklet(p_child_id uuid,p_page integer default 1,p_root_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.provisional_booklet(p_child_id,p_page,p_root_id);$$;

revoke all on function private.enroll_clinician(text),public.enroll_clinician(text),private.assert_provisional_author(),private.create_provisional_child(uuid,jsonb),public.create_provisional_child(uuid,jsonb),private.write_provisional_entry(uuid,uuid,text,date,text,text,text,jsonb,uuid,integer,text,text),public.write_provisional_entry(uuid,uuid,text,date,text,text,text,jsonb,uuid,integer,text,text),private.provisional_workspace(integer),public.provisional_workspace(integer),private.provisional_booklet(uuid,integer,uuid),public.provisional_booklet(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function private.enroll_clinician(text),public.enroll_clinician(text),private.create_provisional_child(uuid,jsonb),public.create_provisional_child(uuid,jsonb),private.write_provisional_entry(uuid,uuid,text,date,text,text,text,jsonb,uuid,integer,text,text),public.write_provisional_entry(uuid,uuid,text,date,text,text,text,jsonb,uuid,integer,text,text),private.provisional_workspace(integer),public.provisional_workspace(integer),private.provisional_booklet(uuid,integer,uuid),public.provisional_booklet(uuid,integer,uuid) to authenticated;
commit;
