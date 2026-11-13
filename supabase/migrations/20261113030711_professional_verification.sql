begin;

create table private.staff_permissions (
  user_id uuid primary key references public.professional_profiles(user_id),
  can_review_professionals boolean not null default false
);
alter table private.staff_permissions enable row level security;
revoke all on private.staff_permissions from public, anon, authenticated;

create function private.can_review_professionals() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.professional_profiles p join private.staff_permissions s on s.user_id = p.user_id
    where p.user_id = auth.uid() and p.role = 'admin' and p.verification_status = 'approved' and s.can_review_professionals
  );
$$;
revoke all on function private.can_review_professionals() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.can_review_professionals() to authenticated;
create function public.can_review_professionals() returns boolean
language sql stable security invoker set search_path = '' as $$ select private.can_review_professionals(); $$;
revoke all on function public.can_review_professionals() from public, anon, authenticated;
grant execute on function public.can_review_professionals() to authenticated;

create table public.verification_requests (
  id uuid primary key,
  professional_id uuid not null references public.professional_profiles(user_id),
  display_name text not null check (length(trim(display_name)) between 3 and 150),
  registration_number text not null check (registration_number ~ '^[A-Z0-9/-]{4,64}$'),
  facility_name text not null check (length(trim(facility_name)) between 3 and 200),
  evidence_path text not null unique,
  status text not null default 'under_review' check (status in ('under_review','approved','rejected','needs_more_evidence')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (split_part(evidence_path,'/',1) = professional_id::text and split_part(evidence_path,'/',2) = id::text)
);
create unique index one_pending_verification_idx on public.verification_requests(professional_id) where status = 'under_review';
create unique index active_registration_number_idx on public.verification_requests(registration_number) where status in ('under_review','approved');
create index verification_professional_time_idx on public.verification_requests(professional_id,submitted_at desc);
create index verification_queue_idx on public.verification_requests(status,submitted_at);

create table public.verification_decisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.verification_requests(id),
  reviewer_id uuid not null references public.professional_profiles(user_id),
  decision text not null check (decision in ('approved','rejected','needs_more_evidence')),
  reason text not null check (length(trim(reason)) between 10 and 1000),
  identity_checked boolean not null,
  registration_checked boolean not null,
  created_at timestamptz not null default now(),
  check (decision <> 'approved' or (identity_checked and registration_checked))
);
create index verification_decisions_reviewer_idx on public.verification_decisions(reviewer_id);
create table public.professional_status_events (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id),
  actor_id uuid not null references public.professional_profiles(user_id),
  old_status public.verification_status not null,
  new_status public.verification_status not null,
  reason text not null check (length(trim(reason)) between 10 and 1000),
  created_at timestamptz not null default now()
);
create index professional_status_events_subject_idx on public.professional_status_events(professional_id,created_at desc);
create index professional_status_events_actor_idx on public.professional_status_events(actor_id);

alter table public.verification_requests enable row level security;
alter table public.verification_decisions enable row level security;
alter table public.professional_status_events enable row level security;
revoke all on public.verification_requests,public.verification_decisions,public.professional_status_events from public,anon,authenticated;
grant select on public.verification_requests,public.verification_decisions,public.professional_status_events to authenticated;
create policy verification_own_or_reviewer on public.verification_requests for select to authenticated
  using (professional_id=(select auth.uid()) or (select private.can_review_professionals()));
create policy verification_decisions_own_or_reviewer on public.verification_decisions for select to authenticated
  using ((select private.can_review_professionals()) or exists (select 1 from public.verification_requests r where r.id=request_id and r.professional_id=(select auth.uid())));
create policy professional_status_own_or_reviewer on public.professional_status_events for select to authenticated
  using (professional_id=(select auth.uid()) or (select private.can_review_professionals()));
create policy reviewer_profiles on public.professional_profiles for select to authenticated using ((select private.can_review_professionals()));
create trigger verification_requests_audit after insert or update on public.verification_requests for each row execute function private.audit_change();
create trigger verification_decisions_audit after insert on public.verification_decisions for each row execute function private.audit_change();
create trigger professional_status_audit after insert on public.professional_status_events for each row execute function private.audit_change();
create trigger verification_decisions_immutable before update or delete on public.verification_decisions for each row execute function private.prevent_mutation();
create trigger professional_status_immutable before update or delete on public.professional_status_events for each row execute function private.prevent_mutation();

-- A private, size/MIME-restricted bucket. No public URL or client replacement policy.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('professional-evidence','professional-evidence',false,5242880,array['application/pdf','image/jpeg','image/png']);
create policy evidence_owner_upload on storage.objects for insert to authenticated with check (
  bucket_id='professional-evidence' and split_part(name,'/',1)=(select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/evidence\.(pdf|jpg|png)$'
  and exists (select 1 from public.professional_profiles p where p.user_id=(select auth.uid()) and p.role='doctor' and p.verification_status in ('unverified','rejected'))
);
create policy evidence_read on storage.objects for select to authenticated using (
  bucket_id='professional-evidence' and (
    split_part(name,'/',1)=(select auth.uid())::text
    or ((select private.can_review_professionals()) and exists (select 1 from public.verification_requests r where r.evidence_path=name))
  )
);
create policy evidence_cleanup_unsubmitted on storage.objects for delete to authenticated using (
  bucket_id='professional-evidence' and split_part(name,'/',1)=(select auth.uid())::text
  and not exists (select 1 from public.verification_requests r where r.evidence_path=name)
);

create function private.submit_verification(p_request_id uuid,p_display_name text,p_registration_number text,p_facility_name text,p_evidence_path text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); profile public.professional_profiles; normalized text;
begin
  if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into profile from public.professional_profiles where user_id=actor for update;
  if not found or profile.role <> 'doctor' or profile.verification_status not in ('unverified','rejected') then
    raise exception 'Submission not permitted' using errcode='42501';
  end if;
  normalized := upper(regexp_replace(trim(p_registration_number),'\s+','','g'));
  if length(trim(p_display_name)) not between 3 and 150 or length(trim(p_facility_name)) not between 3 and 200 or normalized !~ '^[A-Z0-9/-]{4,64}$' then
    raise exception 'Invalid application fields' using errcode='22023';
  end if;
  if p_evidence_path !~ ('^'||actor::text||'/'||p_request_id::text||'/evidence\.(pdf|jpg|png)$') or not exists (
    select 1 from storage.objects where bucket_id='professional-evidence' and name=p_evidence_path
  ) then raise exception 'Private evidence is required' using errcode='22023'; end if;
  insert into public.verification_requests(id,professional_id,display_name,registration_number,facility_name,evidence_path)
    values (p_request_id,actor,trim(p_display_name),normalized,trim(p_facility_name),p_evidence_path);
  update public.professional_profiles set verification_status='under_review' where user_id=actor;
  return p_request_id;
end;
$$;
create function public.submit_verification(p_request_id uuid,p_display_name text,p_registration_number text,p_facility_name text,p_evidence_path text) returns uuid
language sql security invoker set search_path='' as $$
  select private.submit_verification(p_request_id,p_display_name,p_registration_number,p_facility_name,p_evidence_path);
$$;

create function private.review_verification(p_request_id uuid,p_decision text,p_reason text,p_identity_checked boolean,p_registration_checked boolean) returns void
language plpgsql security definer set search_path='' as $$
declare application public.verification_requests; profile public.professional_profiles; next_status public.verification_status;
begin
  if auth.uid() is null or not private.can_review_professionals() then raise exception 'Reviewer permission required' using errcode='42501'; end if;
  if p_decision is null or p_decision not in ('approved','rejected','needs_more_evidence') or p_reason is null or length(trim(p_reason)) not between 10 and 1000 then
    raise exception 'Decision and reason required' using errcode='22023';
  end if;
  select * into application from public.verification_requests where id=p_request_id for update;
  if not found or application.status <> 'under_review' then raise exception 'Application is no longer pending' using errcode='22023'; end if;
  if application.professional_id=auth.uid() then raise exception 'Self review is forbidden' using errcode='42501'; end if;
  select * into profile from public.professional_profiles where user_id=application.professional_id for update;
  if profile.role <> 'doctor' or profile.verification_status <> 'under_review' then raise exception 'Account is not under review' using errcode='22023'; end if;
  if p_decision='approved' and (p_identity_checked is distinct from true or p_registration_checked is distinct from true) then raise exception 'Identity and registration must be checked' using errcode='22023'; end if;
  next_status := case p_decision when 'approved' then 'approved'::public.verification_status when 'rejected' then 'rejected'::public.verification_status else 'unverified'::public.verification_status end;
  insert into public.verification_decisions(request_id,reviewer_id,decision,reason,identity_checked,registration_checked)
    values (p_request_id,auth.uid(),p_decision,trim(p_reason),coalesce(p_identity_checked,false),coalesce(p_registration_checked,false));
  update public.verification_requests set status=p_decision,reviewed_at=now() where id=p_request_id;
  update public.professional_profiles set verification_status=next_status,
    professional_id=case when next_status='approved' then coalesce(professional_id,'PRO-'||upper(replace(gen_random_uuid()::text,'-',''))) else professional_id end
    where user_id=application.professional_id;
  insert into public.professional_status_events(professional_id,actor_id,old_status,new_status,reason)
    values (application.professional_id,auth.uid(),profile.verification_status,next_status,trim(p_reason));
end;
$$;
create function public.review_verification(p_request_id uuid,p_decision text,p_reason text,p_identity_checked boolean,p_registration_checked boolean) returns void
language sql security invoker set search_path='' as $$ select private.review_verification(p_request_id,p_decision,p_reason,p_identity_checked,p_registration_checked); $$;

create function private.set_professional_suspension(p_user_id uuid,p_suspend boolean,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare profile public.professional_profiles; next_status public.verification_status;
begin
  if auth.uid() is null or not private.can_review_professionals() or auth.uid()=p_user_id then raise exception 'Reviewer permission required; self-change forbidden' using errcode='42501'; end if;
  if p_suspend is null or p_reason is null or length(trim(p_reason)) not between 10 and 1000 then raise exception 'A reason is required' using errcode='22023'; end if;
  select * into profile from public.professional_profiles where user_id=p_user_id for update;
  if not found or profile.role <> 'doctor' or profile.professional_id is null then raise exception 'Approved professional required' using errcode='22023'; end if;
  next_status := case when p_suspend then 'suspended'::public.verification_status else 'approved'::public.verification_status end;
  if (p_suspend and profile.verification_status <> 'approved') or (not p_suspend and profile.verification_status <> 'suspended') then raise exception 'Invalid account transition' using errcode='22023'; end if;
  update public.professional_profiles set verification_status=next_status where user_id=p_user_id;
  insert into public.professional_status_events(professional_id,actor_id,old_status,new_status,reason) values (p_user_id,auth.uid(),profile.verification_status,next_status,trim(p_reason));
end;
$$;
create function public.set_professional_suspension(p_user_id uuid,p_suspend boolean,p_reason text) returns void
language sql security invoker set search_path='' as $$ select private.set_professional_suspension(p_user_id,p_suspend,p_reason); $$;

create function private.record_evidence_access(p_request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.can_review_professionals() then raise exception 'Reviewer permission required' using errcode='42501'; end if;
  if not exists (select 1 from public.verification_requests where id=p_request_id) then raise exception 'Application not found' using errcode='22023'; end if;
  insert into public.audit_events(actor_id,entity_id,entity_type,action) values (auth.uid(),p_request_id,'verification_evidence_access','updated');
end;
$$;
create function public.record_evidence_access(p_request_id uuid) returns void
language sql security invoker set search_path='' as $$ select private.record_evidence_access(p_request_id); $$;

-- Explicit signature grants; privileged implementations are never in an exposed schema.
revoke all on function private.submit_verification(uuid,text,text,text,text),public.submit_verification(uuid,text,text,text,text),
  private.review_verification(uuid,text,text,boolean,boolean),public.review_verification(uuid,text,text,boolean,boolean),
  private.set_professional_suspension(uuid,boolean,text),public.set_professional_suspension(uuid,boolean,text),
  private.record_evidence_access(uuid),public.record_evidence_access(uuid) from public,anon,authenticated;
grant execute on function private.submit_verification(uuid,text,text,text,text),public.submit_verification(uuid,text,text,text,text),
  private.review_verification(uuid,text,text,boolean,boolean),public.review_verification(uuid,text,text,boolean,boolean),
  private.set_professional_suspension(uuid,boolean,text),public.set_professional_suspension(uuid,boolean,text),
  private.record_evidence_access(uuid),public.record_evidence_access(uuid) to authenticated;
commit;
