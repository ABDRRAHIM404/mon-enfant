begin;

create table private.doctor_care_invitations (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id),
  issuer_id uuid not null references public.professional_profiles(user_id),
  recipient_id uuid not null references public.professional_profiles(user_id),
  issuer_session uuid not null,
  token_hash bytea not null unique,
  reason text not null check (length(reason) between 10 and 1000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  redeemed_at timestamptz,
  cancelled_at timestamptz,
  check (issuer_id <> recipient_id)
);
create unique index doctor_care_invitation_pending
  on private.doctor_care_invitations(child_id, issuer_id, recipient_id)
  where redeemed_at is null and cancelled_at is null;
alter table private.doctor_care_invitations enable row level security;
revoke all on private.doctor_care_invitations from public, anon, authenticated;

create function private.issue_doctor_care_qr(
  p_child_id uuid, p_recipient text, p_reason text, p_confirmed boolean
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  recipient uuid;
  secret text;
  invitation private.doctor_care_invitations;
begin
  if not private.can_access_child(p_child_id, true) or not exists (
    select 1 from public.professional_profiles where user_id = actor and role = 'doctor'
  ) then
    raise exception 'Verified doctor and child access management required' using errcode = '42501';
  end if;
  if p_confirmed is distinct from true or p_reason is null
     or length(trim(p_reason)) not between 10 and 1000 then
    raise exception 'Authorization confirmation and reason required' using errcode = '22023';
  end if;
  select user_id into recipient from public.professional_profiles
    where professional_id = upper(trim(p_recipient)) and role = 'doctor'
      and verification_status = 'approved' and user_id <> actor;
  if not found then
    raise exception 'Eligible recipient required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_child_id::text, 0));
  if not private.can_access_child(p_child_id, true) then
    raise exception 'Child access management required' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.access_grants g where g.child_id = p_child_id and g.professional_id = recipient
      and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
  ) then
    raise exception 'Recipient already has access' using errcode = 'PT409';
  end if;
  update private.doctor_care_invitations set cancelled_at = now()
    where child_id = p_child_id and issuer_id = actor and recipient_id = recipient
      and redeemed_at is null and cancelled_at is null;
  secret := translate(rtrim(encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'base64'), '='), '+/', '-_');
  insert into private.doctor_care_invitations (child_id, issuer_id, recipient_id, issuer_session, token_hash, reason)
    values (p_child_id, actor, recipient, (auth.jwt()->>'session_id')::uuid,
            sha256(convert_to(secret, 'UTF8')), trim(p_reason))
    returning * into invitation;
  insert into public.audit_events(actor_id, entity_id, entity_type, action)
    values (actor, p_child_id, 'doctor_care_qr_issued', 'created');
  return jsonb_build_object('id', invitation.id, 'token', secret, 'expires_at', invitation.expires_at);
end;
$$;

create function private.redeem_doctor_care_qr(p_token text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  invitation private.doctor_care_invitations;
  token_digest bytea;
  issuer_access_expires_at timestamptz;
begin
  if not private.has_live_session() or not exists (
    select 1 from public.professional_profiles where user_id = actor and role = 'doctor'
      and verification_status = 'approved' and professional_id is not null
  ) then
    raise exception 'Verified doctor required' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    return null;
  end if;

  token_digest := sha256(convert_to(p_token, 'UTF8'));
  select * into invitation from private.doctor_care_invitations
    where token_hash = token_digest and recipient_id = actor;
  if not found then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(invitation.child_id::text, 0));
  select * into invitation from private.doctor_care_invitations where id = invitation.id for update;
  if invitation.cancelled_at is not null or invitation.expires_at <= now() then
    return null;
  end if;
  if invitation.redeemed_at is not null then
    return null;
  end if;
  if exists (
    select 1 from public.access_grants g where g.child_id = invitation.child_id and g.professional_id = actor
      and g.revoked_at >= invitation.created_at
  ) then
    return null;
  end if;
  select g.expires_at into issuer_access_expires_at
    from public.access_grants g
    join public.professional_profiles p on p.user_id = g.professional_id
    join auth.users u on u.id = p.user_id
    join auth.sessions s on s.user_id = p.user_id and s.id = invitation.issuer_session
    where g.child_id = invitation.child_id and p.user_id = invitation.issuer_id
      and g.can_manage_access and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
      and p.role = 'doctor' and p.verification_status = 'approved' and p.professional_id is not null
      and (u.banned_until is null or u.banned_until <= now())
      and (s.not_after is null or s.not_after > now());
  if not found then
    return null;
  end if;

  insert into public.access_grants (child_id, professional_id, granted_by, can_manage_access, expires_at)
    values (invitation.child_id, actor, invitation.issuer_id, false,
            least(issuer_access_expires_at, now() + interval '1 hour'))
    on conflict (child_id, professional_id) do update
      set granted_by = excluded.granted_by, granted_at = excluded.granted_at,
          expires_at = excluded.expires_at, revoked_at = null, can_manage_access = false
      where access_grants.revoked_at is not null or access_grants.expires_at <= now();
  if found then
    insert into public.child_access_changes(child_id, professional_id, actor_id, reason)
      values (invitation.child_id, actor, invitation.issuer_id, invitation.reason);
  end if;
  update private.doctor_care_invitations set redeemed_at = now() where id = invitation.id;
  insert into public.audit_events(actor_id, entity_id, entity_type, action)
    values (actor, invitation.child_id, 'doctor_care_qr_redeemed', 'accessed');
  return invitation.child_id;
end;
$$;

create function private.cancel_doctor_care_qr(p_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare child uuid;
begin
  if not private.has_live_session() then return false; end if;
  select child_id into child from private.doctor_care_invitations
    where id = p_id and issuer_id = auth.uid();
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(child::text, 0));
  update private.doctor_care_invitations set cancelled_at = now()
    where id = p_id and redeemed_at is null and cancelled_at is null;
  return found;
end;
$$;

create function public.issue_doctor_care_qr(p_child_id uuid, p_recipient text, p_reason text, p_confirmed boolean)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.issue_doctor_care_qr(p_child_id, p_recipient, p_reason, p_confirmed); $$;
create function public.redeem_doctor_care_qr(p_token text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.redeem_doctor_care_qr(p_token); $$;
create function public.cancel_doctor_care_qr(p_id uuid)
returns boolean language sql security invoker set search_path = ''
as $$ select private.cancel_doctor_care_qr(p_id); $$;

revoke execute on function
  public.issue_doctor_care_qr(uuid, text, text, boolean), private.issue_doctor_care_qr(uuid, text, text, boolean),
  public.redeem_doctor_care_qr(text), private.redeem_doctor_care_qr(text),
  public.cancel_doctor_care_qr(uuid), private.cancel_doctor_care_qr(uuid)
from public, anon;
grant execute on function
  public.issue_doctor_care_qr(uuid, text, text, boolean), private.issue_doctor_care_qr(uuid, text, text, boolean),
  public.redeem_doctor_care_qr(text), private.redeem_doctor_care_qr(text),
  public.cancel_doctor_care_qr(uuid), private.cancel_doctor_care_qr(uuid)
to authenticated;

commit;
