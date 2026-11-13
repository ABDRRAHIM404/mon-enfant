begin;

-- Auth.uid() alone does not prove that an issued JWT's session remains active.
create function private.has_live_session() returns boolean
language sql stable security definer set search_path='' as $$
  select case when auth.uid() is not null and coalesce(auth.jwt()->>'session_id','') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then exists (select 1 from auth.sessions s where s.id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid() and (s.not_after is null or s.not_after>now()))
    else false end;
$$;
revoke all on function private.has_live_session() from public,anon,authenticated;
grant execute on function private.has_live_session() to authenticated;
create or replace function private.can_review_professionals() returns boolean
language sql stable security definer set search_path='' as $$
  select private.has_live_session() and exists (
    select 1 from public.professional_profiles p join private.staff_permissions s on s.user_id=p.user_id
    where p.user_id=auth.uid() and p.role='admin' and p.verification_status='approved' and s.can_review_professionals
  );
$$;
alter function private.submit_verification(uuid,text,text,text,text) rename to submit_verification_core;
revoke all on function private.submit_verification_core(uuid,text,text,text,text) from public,anon,authenticated;
create function private.submit_verification(p_request_id uuid,p_display_name text,p_registration_number text,p_facility_name text,p_evidence_path text) returns uuid
language plpgsql security definer set search_path='' as $$
begin
  if not private.has_live_session() then raise exception 'Active session required' using errcode='42501'; end if;
  return private.submit_verification_core(p_request_id,p_display_name,p_registration_number,p_facility_name,p_evidence_path);
end;
$$;
revoke all on function private.submit_verification(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function private.submit_verification(uuid,text,text,text,text) to authenticated;
create or replace function public.submit_verification(p_request_id uuid,p_display_name text,p_registration_number text,p_facility_name text,p_evidence_path text) returns uuid language sql security invoker set search_path='' as $$select private.submit_verification(p_request_id,p_display_name,p_registration_number,p_facility_name,p_evidence_path);$$;

create policy live_profile_session on public.professional_profiles as restrictive for all to authenticated using ((select private.has_live_session())) with check ((select private.has_live_session()));
create policy live_verification_session on public.verification_requests as restrictive for all to authenticated using ((select private.has_live_session())) with check ((select private.has_live_session()));
create policy live_decisions_session on public.verification_decisions as restrictive for all to authenticated using ((select private.has_live_session())) with check ((select private.has_live_session()));
create policy live_status_session on public.professional_status_events as restrictive for all to authenticated using ((select private.has_live_session())) with check ((select private.has_live_session()));
create policy live_grant_session on public.access_grants as restrictive for all to authenticated using ((select private.has_live_session())) with check ((select private.has_live_session()));
create policy live_storage_session on storage.objects as restrictive for all to authenticated using ((select private.has_live_session())) with check ((select private.has_live_session()));

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check check (action in ('created','updated','deleted','accessed'));
alter table public.facilities add column created_by uuid references public.professional_profiles(user_id);
alter table public.facilities add column city text not null default '' check (length(city)<=100);
create index facilities_created_by_idx on public.facilities(created_by);
create table public.professional_facilities (
  professional_id uuid not null references public.professional_profiles(user_id),
  facility_id uuid not null references public.facilities(id),
  declared_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (professional_id,facility_id)
);
create index professional_facilities_facility_idx on public.professional_facilities(facility_id);
alter table public.professional_facilities enable row level security;
revoke all on public.professional_facilities from public,anon,authenticated;

alter table public.children alter column given_name drop not null;
alter table public.children alter column family_name drop not null;
alter table public.children alter column birth_date drop not null;
alter table public.children add column name_status text not null default 'confirmed' check (name_status in ('confirmed','provisional','unknown'));
alter table public.children add column birth_date_precision text not null default 'exact' check (birth_date_precision in ('exact','estimated','unknown'));
alter table public.children add column history_status text not null default 'unknown' check (history_status in ('unknown','partial','reviewed'));
alter table public.children add column source_type text not null default 'new_registration' check (source_type in ('new_registration','paper_transcription'));
alter table public.children add column paper_reference text check (length(paper_reference)<=200);
alter table public.children add column provenance_note text check (length(provenance_note)<=2000);
alter table public.children add column guardian_name text check (length(guardian_name)<=150);
alter table public.children add column guardian_phone text check (guardian_phone ~ '^\+?[0-9 ()-]{6,25}$');
alter table public.children add column duplicate_override_reason text check (length(duplicate_override_reason) between 10 and 1000);
alter table public.children add constraint children_name_certainty check ((name_status='unknown' and given_name is null and family_name is null) or (name_status<>'unknown' and given_name is not null and family_name is not null));
alter table public.children add constraint children_date_certainty check ((birth_date_precision='unknown' and birth_date is null) or (birth_date_precision<>'unknown' and birth_date is not null));
alter table public.children add constraint children_paper_reference check (source_type<>'paper_transcription' or (paper_reference is not null and length(trim(paper_reference))>0));
alter table public.access_grants add column can_manage_access boolean not null default false;
create index children_authorized_match_idx on public.children(lower(family_name),lower(given_name),birth_date);

create table private.operation_receipts (
  actor_id uuid not null references public.professional_profiles(user_id),
  operation_id uuid not null,
  kind text not null,
  payload jsonb not null,
  result_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (actor_id,operation_id)
);
alter table private.operation_receipts enable row level security;
revoke all on private.operation_receipts from public,anon,authenticated;

create table public.child_access_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.professional_profiles(user_id),
  requested_universal_id uuid not null,
  child_id uuid references public.children(id),
  facility_id uuid not null references public.facilities(id),
  register_year integer not null check (register_year between 1900 and 2200),
  register_book text not null check (length(trim(register_book)) between 1 and 100),
  local_number text not null check (length(trim(local_number)) between 1 and 100),
  request_reason text not null check (length(trim(request_reason)) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  decision_reason text check (length(trim(decision_reason)) between 10 and 1000),
  decided_by uuid references public.professional_profiles(user_id),
  manager_delegated boolean not null default false,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index access_request_pending_idx on public.child_access_requests(requester_id,requested_universal_id) where status='pending';
create index access_requests_child_idx on public.child_access_requests(child_id,status);
create index access_requests_facility_idx on public.child_access_requests(facility_id);
create index access_requests_decider_idx on public.child_access_requests(decided_by);
alter table public.child_access_requests enable row level security;
revoke all on public.child_access_requests from public,anon,authenticated;
create trigger child_access_requests_audit after insert or update on public.child_access_requests for each row execute function private.audit_change();
create trigger facilities_audit after insert on public.facilities for each row execute function private.audit_change();

-- Clinical records are returned by audited, explicitly scoped RPCs, never by unaudited table SELECT.
revoke select on public.children,public.doctor_patient_registry,public.facilities,public.access_grants from authenticated;

create function private.assert_doctor() returns uuid
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.has_live_session() or not exists (select 1 from public.professional_profiles p where p.user_id=auth.uid() and p.role='doctor' and p.verification_status='approved' and p.professional_id is not null)
    then raise exception 'Approved doctor and active session required' using errcode='42501'; end if;
  return auth.uid();
end;
$$;
create function private.can_access_child(p_child_id uuid,p_manage boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
  select private.has_live_session() and exists (
    select 1 from public.professional_profiles p join public.access_grants g on g.professional_id=p.user_id
    where p.user_id=auth.uid() and p.role='doctor' and p.verification_status='approved' and p.professional_id is not null
    and g.child_id=p_child_id and g.revoked_at is null and (g.expires_at is null or g.expires_at>now()) and (not p_manage or g.can_manage_access)
  );
$$;
create function private.assert_facility(p_facility_id uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.assert_doctor();
  if not exists (select 1 from public.professional_facilities m where m.professional_id=auth.uid() and m.facility_id=p_facility_id and m.revoked_at is null) then
    raise exception 'Active facility membership required' using errcode='42501'; end if;
end;
$$;
create function private.operation_result(p_id uuid,p_kind text,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare receipt private.operation_receipts;
begin
  perform private.assert_doctor();
  if p_id is null then raise exception 'Operation ID required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_id::text,0));
  select * into receipt from private.operation_receipts where actor_id=auth.uid() and operation_id=p_id;
  if found then
    if receipt.kind<>p_kind or receipt.payload is distinct from p_payload then raise exception 'Operation ID reused with different input' using errcode='22023'; end if;
    return receipt.result_id;
  end if;
  return null;
end;
$$;
create function private.create_facility(p_operation_id uuid,p_name text,p_city text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; payload jsonb:=jsonb_build_object('name',trim(p_name),'city',trim(p_city));
begin
  perform private.assert_doctor();
  result:=private.operation_result(p_operation_id,'create_facility',payload); if result is not null then return result; end if;
  if p_name is null or length(trim(p_name)) not between 3 and 200 or p_city is null or length(trim(p_city))>100 then raise exception 'Invalid facility details' using errcode='22023'; end if;
  insert into public.facilities(name,city,created_by) values (trim(p_name),trim(p_city),auth.uid()) returning id into result;
  insert into public.professional_facilities(professional_id,facility_id) values (auth.uid(),result);
  insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id) values (auth.uid(),p_operation_id,'create_facility',payload,result);
  return result;
end;
$$;
create function public.create_facility(p_operation_id uuid,p_name text,p_city text) returns uuid language sql security invoker set search_path='' as $$select private.create_facility(p_operation_id,p_name,p_city);$$;
create function private.my_facilities() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.assert_doctor();
  return coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'city',f.city) order by f.name)
    from public.facilities f join public.professional_facilities m on m.facility_id=f.id where m.professional_id=auth.uid() and m.revoked_at is null),'[]'::jsonb);
end;
$$;
create function public.my_facilities() returns jsonb language sql stable security invoker set search_path='' as $$select private.my_facilities();$$;

create function private.register_child(p_operation_id uuid,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; actor uuid; facility uuid; dob date; precision text; names text; source text; history text; override_reason text; matches integer;
begin
  actor:=private.assert_doctor();
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>15000 or exists (
    select 1 from jsonb_object_keys(p_payload) k where k<>all(array['facility_id','register_year','register_book','local_number','given_name','family_name','name_status','birth_date','birth_date_precision','sex','history_status','source_type','paper_reference','provenance_note','guardian_name','guardian_phone','duplicate_override_reason'])
  ) then raise exception 'Invalid registration fields' using errcode='22023'; end if;
  result:=private.operation_result(p_operation_id,'register_child',p_payload); if result is not null then return result; end if;
  facility:=(p_payload->>'facility_id')::uuid; perform private.assert_facility(facility);
  precision:=coalesce(p_payload->>'birth_date_precision','exact'); names:=coalesce(p_payload->>'name_status','confirmed'); source:=coalesce(p_payload->>'source_type','new_registration');history:=coalesce(p_payload->>'history_status','unknown');
  dob:=nullif(p_payload->>'birth_date','')::date;
  if dob is not null and (dob>(now() at time zone 'Africa/Casablanca')::date or dob<date '1900-01-01') then raise exception 'Invalid birth date' using errcode='22023'; end if;
  if p_payload->>'sex' is null or p_payload->>'sex' not in ('female','male','unknown') or precision not in ('exact','estimated','unknown') or names not in ('confirmed','provisional','unknown') or source not in ('new_registration','paper_transcription') or history not in ('unknown','partial','reviewed') then raise exception 'Invalid certainty or source' using errcode='22023'; end if;
  if (precision='unknown')<>(dob is null) or (names='unknown' and (nullif(trim(p_payload->>'given_name'),'') is not null or nullif(trim(p_payload->>'family_name'),'') is not null)) then raise exception 'Unknown fields must stay unknown' using errcode='22023'; end if;
  override_reason:=nullif(trim(p_payload->>'duplicate_override_reason'),'');
  if names<>'unknown' and dob is not null then
    select count(*) into matches from public.children c where lower(c.given_name)=lower(trim(p_payload->>'given_name')) and lower(c.family_name)=lower(trim(p_payload->>'family_name')) and c.birth_date=dob and private.can_access_child(c.id,false);
    if matches>0 and (override_reason is null or length(override_reason) not between 10 and 1000) then raise exception 'Possible duplicate: review authorized matches or provide a reason' using errcode='P0002'; end if;
  end if;
  insert into public.children(given_name,family_name,name_status,birth_date,birth_date_precision,sex,history_status,source_type,paper_reference,provenance_note,guardian_name,guardian_phone,duplicate_override_reason,created_by)
    values (nullif(trim(p_payload->>'given_name'),''),nullif(trim(p_payload->>'family_name'),''),names,dob,precision,p_payload->>'sex',history,source,nullif(trim(p_payload->>'paper_reference'),''),nullif(trim(p_payload->>'provenance_note'),''),nullif(trim(p_payload->>'guardian_name'),''),nullif(trim(p_payload->>'guardian_phone'),''),override_reason,actor) returning id into result;
  insert into public.access_grants(child_id,professional_id,granted_by,can_manage_access) values (result,actor,actor,true);
  insert into public.doctor_patient_registry(professional_id,child_id,facility_id,register_year,register_book,local_number)
    values (actor,result,facility,(p_payload->>'register_year')::integer,trim(p_payload->>'register_book'),trim(p_payload->>'local_number'));
  insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id) values (actor,p_operation_id,'register_child',p_payload,result);
  return result;
end;
$$;
create function public.register_child(p_operation_id uuid,p_payload jsonb) returns uuid language sql security invoker set search_path='' as $$select private.register_child(p_operation_id,p_payload);$$;

create function private.list_patients(p_query text default '',p_history text default 'all',p_age text default 'all',p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; total bigint; ids uuid[]; offset_rows integer;
begin
  perform private.assert_doctor();
  if p_query is null or length(p_query)>100 or p_page is null or p_page not between 1 and 10000 or p_history is null or p_history not in ('all','unknown','partial','reviewed') or p_age is null or p_age not in ('all','under1','1to5','over5','unknown') then raise exception 'Invalid filters' using errcode='22023'; end if;
  offset_rows:=(p_page-1)*30;
  with visible as (
    select c.id from public.children c where private.can_access_child(c.id,false) and exists(select 1 from public.doctor_patient_registry r where r.child_id=c.id and r.professional_id=auth.uid() and strpos(lower(concat_ws(' ',c.given_name,c.family_name,c.universal_id::text,c.guardian_phone,r.local_number)),lower(p_query))>0)
    and (p_history='all' or c.history_status=p_history)
    and (p_age='all' or (p_age='unknown' and c.birth_date_precision<>'exact') or (c.birth_date_precision='exact' and ((p_age='under1' and c.birth_date>((now() at time zone 'Africa/Casablanca')::date-interval '1 year')) or (p_age='1to5' and c.birth_date<=((now() at time zone 'Africa/Casablanca')::date-interval '1 year') and c.birth_date>((now() at time zone 'Africa/Casablanca')::date-interval '6 years')) or (p_age='over5' and c.birth_date<=((now() at time zone 'Africa/Casablanca')::date-interval '6 years')))))
  ) select count(*) into total from visible;
  with visible as (
    select c.id from public.children c where private.can_access_child(c.id,false) and exists(select 1 from public.doctor_patient_registry r where r.child_id=c.id and r.professional_id=auth.uid() and strpos(lower(concat_ws(' ',c.given_name,c.family_name,c.universal_id::text,c.guardian_phone,r.local_number)),lower(p_query))>0)
    and (p_history='all' or c.history_status=p_history)
    and (p_age='all' or (p_age='unknown' and c.birth_date_precision<>'exact') or (c.birth_date_precision='exact' and ((p_age='under1' and c.birth_date>((now() at time zone 'Africa/Casablanca')::date-interval '1 year')) or (p_age='1to5' and c.birth_date<=((now() at time zone 'Africa/Casablanca')::date-interval '1 year') and c.birth_date>((now() at time zone 'Africa/Casablanca')::date-interval '6 years')) or (p_age='over5' and c.birth_date<=((now() at time zone 'Africa/Casablanca')::date-interval '6 years')))))
    order by c.created_at desc,c.id limit 30 offset offset_rows
  ) select coalesce(array_agg(id),'{}'::uuid[]) into ids from visible;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'universal_id',c.universal_id,'given_name',c.given_name,'family_name',c.family_name,'name_status',c.name_status,'birth_date',c.birth_date,'birth_date_precision',c.birth_date_precision,'sex',c.sex,'history_status',c.history_status,'source_type',c.source_type,
    'registers',(select jsonb_agg(jsonb_build_object('id',r.id,'facility_id',r.facility_id,'facility_name',f.name,'year',r.register_year,'book',r.register_book,'number',r.local_number)) from public.doctor_patient_registry r join public.facilities f on f.id=r.facility_id where r.child_id=c.id and r.professional_id=auth.uid())) order by c.created_at desc,c.id),'[]'::jsonb) into result from public.children c where c.id=any(ids);
  insert into public.audit_events(actor_id,entity_id,entity_type,action) select auth.uid(),id,'child_registry_read','accessed' from unnest(ids) id;
  return jsonb_build_object('items',result,'total',total,'page',p_page);
end;
$$;
create function public.list_patients(p_query text default '',p_history text default 'all',p_age text default 'all',p_page integer default 1) returns jsonb language sql security invoker set search_path='' as $$select private.list_patients(p_query,p_history,p_age,p_page);$$;

create function private.get_child_profile(p_child_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.can_access_child(p_child_id,false) then raise exception 'Child access denied' using errcode='42501'; end if;
  select to_jsonb(c)||jsonb_build_object('can_manage_access',private.can_access_child(c.id,true),'created_by_professional_id',p.professional_id,
    'registers',coalesce((select jsonb_agg(jsonb_build_object('facility_id',r.facility_id,'facility_name',f.name,'year',r.register_year,'book',r.register_book,'number',r.local_number)) from public.doctor_patient_registry r join public.facilities f on f.id=r.facility_id where r.child_id=c.id and r.professional_id=auth.uid()),'[]'::jsonb))
    into result from public.children c join public.professional_profiles p on p.user_id=c.created_by where c.id=p_child_id;
  insert into public.audit_events(actor_id,entity_id,entity_type,action) values (auth.uid(),p_child_id,'child_profile_read','accessed');
  return result;
end;
$$;
create function public.get_child_profile(p_child_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.get_child_profile(p_child_id);$$;

create function private.link_child(p_operation_id uuid,p_universal_id uuid,p_facility_id uuid,p_year integer,p_book text,p_number text) returns uuid
language plpgsql security definer set search_path='' as $$
declare child uuid; result uuid; payload jsonb:=jsonb_build_object('universal_id',p_universal_id,'facility_id',p_facility_id,'year',p_year,'book',p_book,'number',p_number);
begin
  perform private.assert_doctor(); perform private.assert_facility(p_facility_id);
  result:=private.operation_result(p_operation_id,'link_child',payload); if result is not null then return result; end if;
  select id into child from public.children where universal_id=p_universal_id;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(child::text,''),0));
  if child is null or not private.can_access_child(child,false) then raise exception 'Existing authorization required' using errcode='42501'; end if;
  insert into public.doctor_patient_registry(professional_id,child_id,facility_id,register_year,register_book,local_number) values (auth.uid(),child,p_facility_id,p_year,trim(p_book),trim(p_number)) returning id into result;
  insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id) values (auth.uid(),p_operation_id,'link_child',payload,child);
  return child;
end;
$$;
create function public.link_child(p_operation_id uuid,p_universal_id uuid,p_facility_id uuid,p_year integer,p_book text,p_number text) returns uuid language sql security invoker set search_path='' as $$select private.link_child(p_operation_id,p_universal_id,p_facility_id,p_year,p_book,p_number);$$;

create function private.request_child_access(p_operation_id uuid,p_universal_id uuid,p_facility_id uuid,p_year integer,p_book text,p_number text,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare child uuid; result uuid; payload jsonb:=jsonb_build_object('universal_id',p_universal_id,'facility_id',p_facility_id,'year',p_year,'book',p_book,'number',p_number,'reason',p_reason);
begin
  perform private.assert_doctor(); perform private.assert_facility(p_facility_id);
  result:=private.operation_result(p_operation_id,'request_child_access',payload); if result is not null then return result; end if;
  if p_universal_id is null then raise exception 'Universal ID required' using errcode='22023'; end if;
  select id into child from public.children where universal_id=p_universal_id;
  if child is not null and private.can_access_child(child,false) then raise exception 'Already authorized; use the link workflow' using errcode='22023'; end if;
  insert into public.child_access_requests(requester_id,requested_universal_id,child_id,facility_id,register_year,register_book,local_number,request_reason)
    values (auth.uid(),p_universal_id,child,p_facility_id,p_year,trim(p_book),trim(p_number),trim(p_reason)) returning id into result;
  insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id) values (auth.uid(),p_operation_id,'request_child_access',payload,result);
  return result;
end;
$$;
create function public.request_child_access(p_operation_id uuid,p_universal_id uuid,p_facility_id uuid,p_year integer,p_book text,p_number text,p_reason text) returns uuid language sql security invoker set search_path='' as $$select private.request_child_access(p_operation_id,p_universal_id,p_facility_id,p_year,p_book,p_number,p_reason);$$;

create function private.my_access_requests() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform private.assert_doctor();
  return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'requested_universal_id',r.requested_universal_id,'status',r.status,'created_at',r.created_at,'reason',r.request_reason,'decision_reason',r.decision_reason,'number',r.local_number,'book',r.register_book,'year',r.register_year,
    'child_id',case when r.status='approved' and private.can_access_child(r.child_id,false) then r.child_id else null end) order by r.created_at desc) from (select * from public.child_access_requests where requester_id=auth.uid() order by created_at desc limit 100) r),'[]'::jsonb);
end;
$$;
create function public.my_access_requests() returns jsonb language sql security invoker set search_path='' as $$select private.my_access_requests();$$;
create function private.pending_access_requests() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.assert_doctor();
  select coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'child_id',r.child_id,'universal_id',c.universal_id,'child_name',concat_ws(' ',c.given_name,c.family_name),'requester_professional_id',p.professional_id,'facility_name',f.name,'reason',r.request_reason,'number',r.local_number,'book',r.register_book,'year',r.register_year,'created_at',r.created_at) order by r.created_at)
    from (select * from public.child_access_requests q where q.status='pending' and private.can_access_child(q.child_id,true) order by q.created_at limit 100) r join public.children c on c.id=r.child_id join public.professional_profiles p on p.user_id=r.requester_id join public.facilities f on f.id=r.facility_id),'[]'::jsonb) into result;
  insert into public.audit_events(actor_id,entity_id,entity_type,action) select distinct auth.uid(),(item->>'child_id')::uuid,'child_access_worklist_read','accessed' from jsonb_array_elements(result) item;
  return result;
end;
$$;
create function public.pending_access_requests() returns jsonb language sql security invoker set search_path='' as $$select private.pending_access_requests();$$;

create function private.decide_child_access(p_request_id uuid,p_approve boolean,p_reason text,p_authorization_checked boolean,p_delegate boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare request public.child_access_requests; approved_child uuid; existing_number text;
begin
  perform private.assert_doctor();
  select * into request from public.child_access_requests where id=p_request_id for update;
  if not found then raise exception 'Access manager required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(request.child_id::text,''),0));
  if not private.can_access_child(request.child_id,true) or request.requester_id=auth.uid() then raise exception 'Access manager required; self-review forbidden' using errcode='42501'; end if;
  if request.status<>'pending' then raise exception 'Request already decided' using errcode='22023'; end if;
  if p_approve is null or p_reason is null or length(trim(p_reason)) not between 10 and 1000 then raise exception 'Decision reason required' using errcode='22023'; end if;
  if p_approve then
    if p_authorization_checked is distinct from true then raise exception 'Legitimate authorization must be checked' using errcode='22023'; end if;
    if not exists (select 1 from public.professional_profiles p join public.professional_facilities m on m.professional_id=p.user_id where p.user_id=request.requester_id and p.role='doctor' and p.verification_status='approved' and p.professional_id is not null and m.facility_id=request.facility_id and m.revoked_at is null) then raise exception 'Requester is no longer eligible' using errcode='42501'; end if;
    perform pg_advisory_xact_lock(hashtextextended(request.child_id::text||request.requester_id::text,0));
    select local_number into existing_number from public.doctor_patient_registry where professional_id=request.requester_id and child_id=request.child_id and facility_id=request.facility_id and register_year=request.register_year and register_book=request.register_book;
    if found then
      if existing_number<>request.local_number then raise exception 'Existing register association differs' using errcode='22023'; end if;
    else
      insert into public.doctor_patient_registry(professional_id,child_id,facility_id,register_year,register_book,local_number) values (request.requester_id,request.child_id,request.facility_id,request.register_year,request.register_book,request.local_number);
    end if;
    insert into public.access_grants(child_id,professional_id,granted_by,can_manage_access) values (request.child_id,request.requester_id,auth.uid(),coalesce(p_delegate,false))
      on conflict (child_id,professional_id) do update set granted_by=excluded.granted_by,granted_at=now(),expires_at=null,revoked_at=null,can_manage_access=excluded.can_manage_access;
    approved_child:=request.child_id;
  end if;
  update public.child_access_requests set status=case when p_approve then 'approved' else 'rejected' end,decision_reason=trim(p_reason),decided_by=auth.uid(),decided_at=now(),manager_delegated=p_approve and coalesce(p_delegate,false) where id=p_request_id;
  insert into public.audit_events(actor_id,entity_id,entity_type,action) values (auth.uid(),request.child_id,'child_access_decision','updated');
  return approved_child;
end;
$$;
create function public.decide_child_access(p_request_id uuid,p_approve boolean,p_reason text,p_authorization_checked boolean,p_delegate boolean default false) returns uuid language sql security invoker set search_path='' as $$select private.decide_child_access(p_request_id,p_approve,p_reason,p_authorization_checked,p_delegate);$$;
create function private.withdraw_child_access(p_request_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.assert_doctor();
  if p_reason is null or length(trim(p_reason)) not between 10 and 1000 then raise exception 'Withdrawal reason required' using errcode='22023'; end if;
  update public.child_access_requests set status='withdrawn',decision_reason=trim(p_reason),decided_by=auth.uid(),decided_at=now() where id=p_request_id and requester_id=auth.uid() and status='pending';
  if not found then raise exception 'Pending own request required' using errcode='42501'; end if;
end;
$$;
create function public.withdraw_child_access(p_request_id uuid,p_reason text) returns void language sql security invoker set search_path='' as $$select private.withdraw_child_access(p_request_id,p_reason);$$;

create function private.registry_summary() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.assert_doctor();
  return jsonb_build_object('patients',(select count(distinct r.child_id) from public.doctor_patient_registry r where r.professional_id=auth.uid() and private.can_access_child(r.child_id,false)),
    'uncertain_history',(select count(distinct c.id) from public.children c join public.doctor_patient_registry r on r.child_id=c.id where r.professional_id=auth.uid() and private.can_access_child(c.id,false) and c.history_status<>'reviewed'),
    'pending_requests',(select count(*) from public.child_access_requests r where r.status='pending' and private.can_access_child(r.child_id,true)),
    'facilities',(select count(*) from public.professional_facilities m where m.professional_id=auth.uid() and m.revoked_at is null));
end;
$$;
create function public.registry_summary() returns jsonb language sql stable security invoker set search_path='' as $$select private.registry_summary();$$;

create table public.child_access_changes (
  id uuid primary key default gen_random_uuid(), child_id uuid not null references public.children(id),
  professional_id uuid not null references public.professional_profiles(user_id), actor_id uuid not null references public.professional_profiles(user_id),
  reason text not null check (length(trim(reason)) between 10 and 1000), created_at timestamptz not null default now()
);
create index child_access_changes_child_idx on public.child_access_changes(child_id,created_at desc);
create index child_access_changes_professional_idx on public.child_access_changes(professional_id);
create index child_access_changes_actor_idx on public.child_access_changes(actor_id);
alter table public.child_access_changes enable row level security;
revoke all on public.child_access_changes from public,anon,authenticated;
create trigger child_access_changes_immutable before update or delete on public.child_access_changes for each row execute function private.prevent_mutation();
create trigger child_access_changes_audit after insert on public.child_access_changes for each row execute function private.audit_change();
create function private.child_access_grants(p_child_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not private.can_access_child(p_child_id,true) then raise exception 'Access manager required' using errcode='42501'; end if;
  insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'child_access_grants_read','accessed');
  return coalesce((select jsonb_agg(jsonb_build_object('professional_id',g.professional_id,'platform_id',p.professional_id,'can_manage_access',g.can_manage_access,'granted_at',g.granted_at,'expires_at',g.expires_at,'revoked_at',g.revoked_at,'is_self',g.professional_id=auth.uid())) from public.access_grants g join public.professional_profiles p on p.user_id=g.professional_id where g.child_id=p_child_id),'[]'::jsonb);
end;
$$;
create function public.child_access_grants(p_child_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.child_access_grants(p_child_id);$$;
create function private.revoke_child_access(p_child_id uuid,p_professional_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.assert_doctor(); perform pg_advisory_xact_lock(hashtextextended(p_child_id::text,0));
  if not private.can_access_child(p_child_id,true) or p_professional_id=auth.uid() then raise exception 'Access manager required; use a formal handoff before leaving' using errcode='42501'; end if;
  if p_reason is null or length(trim(p_reason)) not between 10 and 1000 then raise exception 'Revocation reason required' using errcode='22023'; end if;
  update public.access_grants set revoked_at=now() where child_id=p_child_id and professional_id=p_professional_id and revoked_at is null;
  if not found then raise exception 'Active target grant required' using errcode='22023'; end if;
  insert into public.child_access_changes(child_id,professional_id,actor_id,reason) values(p_child_id,p_professional_id,auth.uid(),trim(p_reason));
end;
$$;
create function public.revoke_child_access(p_child_id uuid,p_professional_id uuid,p_reason text) returns void language sql security invoker set search_path='' as $$select private.revoke_child_access(p_child_id,p_professional_id,p_reason);$$;

-- Only narrowly scoped entry points/helpers are executable; internal receipts never are.
do $$ declare fn record; begin
  for fn in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.proname=any(array['assert_doctor','can_access_child','assert_facility','operation_result','create_facility','my_facilities','register_child','list_patients','get_child_profile','link_child','request_child_access','my_access_requests','pending_access_requests','decide_child_access','withdraw_child_access','registry_summary','child_access_grants','revoke_child_access']) loop
    execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
    if fn.proname<>'operation_result' then execute format('grant execute on function %s to authenticated',fn.signature); end if;
  end loop;
end $$;
commit;
