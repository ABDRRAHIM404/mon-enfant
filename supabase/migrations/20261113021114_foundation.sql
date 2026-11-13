-- Phase 1 foundation. No clinical write API is exposed in this milestone.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.professional_role as enum ('doctor', 'admin');
create type public.verification_status as enum ('unverified', 'under_review', 'approved', 'rejected', 'suspended');

create table public.professional_profiles (
  user_id uuid primary key references auth.users(id),
  role public.professional_role not null default 'doctor',
  verification_status public.verification_status not null default 'unverified',
  professional_id text unique,
  created_at timestamptz not null default now(),
  check (verification_status <> 'approved' or professional_id is not null)
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  created_at timestamptz not null default now()
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  universal_id uuid not null default gen_random_uuid() unique,
  given_name text not null check (length(trim(given_name)) between 1 and 100),
  family_name text not null check (length(trim(family_name)) between 1 and 100),
  birth_date date not null,
  sex text not null check (sex in ('female', 'male', 'unknown')),
  created_by uuid not null references public.professional_profiles(user_id),
  created_at timestamptz not null default now()
);
create index children_created_by_idx on public.children(created_by);

-- A registry association is not an authorization grant.
create table public.access_grants (
  child_id uuid not null references public.children(id),
  professional_id uuid not null references public.professional_profiles(user_id),
  granted_by uuid not null references public.professional_profiles(user_id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  primary key (child_id, professional_id),
  check (expires_at is null or expires_at > granted_at)
);
create index access_grants_professional_idx on public.access_grants(professional_id, child_id);
create index access_grants_granted_by_idx on public.access_grants(granted_by);

create table public.doctor_patient_registry (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id),
  child_id uuid not null references public.children(id),
  facility_id uuid not null references public.facilities(id),
  register_year integer not null check (register_year between 1900 and 2200),
  register_book text not null check (length(trim(register_book)) between 1 and 100),
  local_number text not null check (length(trim(local_number)) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (professional_id, facility_id, register_year, register_book, local_number),
  unique (professional_id, child_id, facility_id, register_year, register_book)
);
create index registry_child_idx on public.doctor_patient_registry(child_id);
create index registry_facility_idx on public.doctor_patient_registry(facility_id);

-- Deliberately no clinical payloads in operational audit metadata.
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  entity_id uuid not null,
  entity_type text not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  occurred_at timestamptz not null default now()
);
create index audit_events_actor_time_idx on public.audit_events(actor_id, occurred_at desc);
create index audit_events_entity_idx on public.audit_events(entity_type, entity_id);

-- Internal trigger only; no RPC endpoint and no EXECUTE for API roles.
-- Definer is needed only to append events when an unverified user creates a profile.
create function private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events(actor_id, entity_id, entity_type, action)
  values (auth.uid(), case when TG_TABLE_NAME = 'professional_profiles' then (to_jsonb(NEW)->>'user_id')::uuid when TG_TABLE_NAME = 'access_grants' then (to_jsonb(NEW)->>'child_id')::uuid else (to_jsonb(NEW)->>'id')::uuid end,
    TG_TABLE_NAME, case when TG_OP = 'INSERT' then 'created' else 'updated' end);
  return NEW;
end;
$$;
revoke all on function private.audit_change() from public, anon, authenticated;
create trigger professional_profile_audit after insert or update on public.professional_profiles for each row execute function private.audit_change();
create trigger children_audit after insert or update on public.children for each row execute function private.audit_change();
create trigger access_grant_audit after insert or update on public.access_grants for each row execute function private.audit_change();
create trigger registry_audit after insert or update on public.doctor_patient_registry for each row execute function private.audit_change();

create function private.prevent_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'Append-only record'; end;
$$;
revoke all on function private.prevent_mutation() from public, anon, authenticated;
create trigger audit_immutable before update or delete on public.audit_events for each row execute function private.prevent_mutation();

create function private.keep_child_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if OLD.id is distinct from NEW.id or OLD.universal_id is distinct from NEW.universal_id then
    raise exception 'Child identity is immutable';
  end if;
  return NEW;
end;
$$;
revoke all on function private.keep_child_identity() from public, anon, authenticated;
create trigger child_identity_immutable before update on public.children for each row execute function private.keep_child_identity();

alter table public.professional_profiles enable row level security;
alter table public.facilities enable row level security;
alter table public.children enable row level security;
alter table public.access_grants enable row level security;
alter table public.doctor_patient_registry enable row level security;
alter table public.audit_events enable row level security;

-- Explicit grants; no dependency on a project's default table privileges.
revoke all on public.professional_profiles, public.facilities, public.children, public.access_grants, public.doctor_patient_registry, public.audit_events from anon, authenticated;
grant select on public.professional_profiles, public.facilities, public.children, public.access_grants, public.doctor_patient_registry to authenticated;
grant insert (user_id) on public.professional_profiles to authenticated;

create policy own_profile on public.professional_profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy create_unverified_profile on public.professional_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and role = 'doctor' and verification_status = 'unverified' and professional_id is null
    and coalesce((select auth.jwt()->>'is_anonymous'), 'false') = 'false');

create policy own_active_grants on public.access_grants for select to authenticated
  using (professional_id = (select auth.uid()) and revoked_at is null and (expires_at is null or expires_at > now())
    and exists (select 1 from public.professional_profiles p where p.user_id = (select auth.uid()) and p.role = 'doctor' and p.verification_status = 'approved' and p.professional_id is not null));
create policy authorized_children on public.children for select to authenticated
  using (exists (select 1 from public.access_grants g where g.child_id = children.id and g.professional_id = (select auth.uid())));
create policy own_authorized_registry on public.doctor_patient_registry for select to authenticated
  using (professional_id = (select auth.uid()) and exists (select 1 from public.access_grants g where g.child_id = doctor_patient_registry.child_id and g.professional_id = (select auth.uid())));
create policy own_registry_facilities on public.facilities for select to authenticated
  using (exists (select 1 from public.doctor_patient_registry r where r.facility_id = facilities.id and r.professional_id = (select auth.uid())));
-- audit_events has no API policy: operational audit access is designed in Phase 2.
commit;
