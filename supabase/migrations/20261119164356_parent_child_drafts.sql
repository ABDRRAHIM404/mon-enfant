begin;

create table private.parent_child_drafts (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references private.guardian_profiles(user_id),
  operation_id uuid not null,
  given_name text not null check (length(given_name) between 1 and 100),
  family_name text not null check (length(family_name) between 1 and 100),
  birth_date date not null,
  created_at timestamptz not null default now(),
  token_hash bytea unique,
  token_expires_at timestamptz,
  consent_at timestamptz,
  doctor_id uuid references public.professional_profiles(user_id),
  doctor_session uuid,
  doctor_expires_at timestamptz,
  child_id uuid references public.children(id),
  claim_id uuid unique references private.guardian_claims(id),
  unique (guardian_id, operation_id)
);
create index parent_child_drafts_by_parent on private.parent_child_drafts(guardian_id, created_at desc);
alter table private.parent_child_drafts enable row level security;
revoke all on private.parent_child_drafts from public, anon, authenticated;

create function private.add_parent_child_draft(p_operation_id uuid, p_given_name text, p_family_name text, p_birth_date date)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  parent_id uuid := private.assert_parent_account();
  saved private.parent_child_drafts;
begin
  if p_operation_id is null or p_given_name is null or p_family_name is null
    or length(trim(p_given_name)) not between 1 and 100 or length(trim(p_family_name)) not between 1 and 100
    or p_birth_date is null or p_birth_date not between date '1900-01-01' and (now() at time zone 'Africa/Casablanca')::date then
    raise exception 'Child name and birth date required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('parent-draft:' || parent_id::text, 0));
  select * into saved from private.parent_child_drafts where guardian_id = parent_id and operation_id = p_operation_id;
  if found then
    if row(saved.given_name, saved.family_name, saved.birth_date) is distinct from
      row(trim(p_given_name), trim(p_family_name), p_birth_date) then
      raise exception 'Draft operation already used' using errcode = 'PT409';
    end if;
    return saved.id;
  end if;
  if (select count(*) from private.parent_child_drafts where guardian_id = parent_id and child_id is null) >= 20 then
    raise exception 'Too many outstanding drafts' using errcode = 'PT429';
  end if;
  -- The account label is editable and carries no guardianship authority.
  insert into private.guardian_profiles (user_id, display_name)
    values (parent_id, 'Responsable') on conflict (user_id) do nothing;
  insert into private.parent_child_drafts (guardian_id, operation_id, given_name, family_name, birth_date)
  values (parent_id, p_operation_id, trim(p_given_name), trim(p_family_name), p_birth_date)
  returning * into saved;
  return saved.id;
end;
$$;

create function private.list_parent_child_drafts()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare parent_id uuid := private.assert_parent_account();
begin
  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'given_name', d.given_name, 'family_name', d.family_name, 'birth_date', d.birth_date,
        'status', case when d.child_id is null then
          case when d.doctor_expires_at > now() and d.doctor_id is not null then 'with_doctor' else 'draft' end
          when private.can_access_as_guardian(d.child_id, false) then 'linked'
          when c.state = 'pending' then 'awaiting_review'
          else 'closed' end,
        'child_id', case when private.can_access_as_guardian(d.child_id, false) then d.child_id end
      ) order by d.created_at desc, d.id)
      from (select * from private.parent_child_drafts where guardian_id = parent_id
        order by created_at desc, id limit 50) d
      left join private.guardian_claims c on c.id = d.claim_id
    ), '[]'::jsonb)
  );
end;
$$;

create function private.issue_parent_child_draft(p_draft_id uuid, p_consent boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare parent_id uuid := private.assert_parent_account(); secret text; deadline timestamptz;
begin
  if p_consent is distinct from true then
    raise exception 'Explicit consent required' using errcode = '22023';
  end if;
  secret := rtrim(translate(encode(sha256(convert_to(
    gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'base64'), '+/', '-_'), '=');
  update private.parent_child_drafts
    set token_hash = sha256(convert_to(secret, 'UTF8')), token_expires_at = now() + interval '5 minutes',
        consent_at = now(), doctor_id = null, doctor_session = null, doctor_expires_at = null
    where id = p_draft_id and guardian_id = parent_id and child_id is null
    returning token_expires_at into deadline;
  if not found then raise exception 'Draft unavailable' using errcode = '42501'; end if;
  return jsonb_build_object('token', secret, 'expires_at', deadline);
end;
$$;

create function private.redeem_parent_child_draft(p_token text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare clinician_id uuid := private.assert_doctor(); draft_id uuid;
begin
  if not exists (select 1 from public.professional_profiles where user_id = clinician_id and role = 'doctor')
    or p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    return null;
  end if;
  update private.parent_child_drafts
    set doctor_id = clinician_id, doctor_session = (auth.jwt()->>'session_id')::uuid,
        doctor_expires_at = now() + interval '1 hour', token_hash = null, token_expires_at = null
    where token_hash = sha256(convert_to(p_token, 'UTF8')) and token_expires_at > now()
      and guardian_id <> clinician_id and doctor_id is null and child_id is null
    returning id into draft_id;
  return draft_id;
end;
$$;

create function private.get_parent_child_intake(p_draft_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare clinician_id uuid := private.assert_doctor(); intake jsonb;
begin
  select jsonb_build_object('given_name', d.given_name, 'family_name', d.family_name, 'birth_date', d.birth_date)
    into intake from private.parent_child_drafts d join public.professional_profiles p on p.user_id = clinician_id
    where d.id = p_draft_id and d.doctor_id = clinician_id and p.role = 'doctor'
      and d.doctor_session::text = auth.jwt()->>'session_id'
      and d.doctor_expires_at > now() and d.child_id is null;
  return intake;
end;
$$;

create or replace function private.prepare_child_registration(p_operation_id uuid,p_payload jsonb,p_mother_name text default null,p_birthplace text default null,p_request_review boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;item private.registration_cases;comparison jsonb;mother text:=nullif(trim(p_mother_name),'');place text:=nullif(trim(p_birthplace),'');dob date;phase text;
begin
 actor:=private.assert_doctor();
 if p_operation_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>15000
  or exists(select 1 from jsonb_object_keys(p_payload) k where k<>all(array['facility_id','register_year','register_book','local_number','given_name','family_name','name_status','birth_date','birth_date_precision','sex','history_status','source_type','paper_reference','provenance_note','guardian_name','guardian_phone','duplicate_override_reason','smi_reference','parent_draft_identity_checked']))
 then raise exception 'Valid registration context required' using errcode='22023';end if;
 perform private.assert_facility((p_payload->>'facility_id')::uuid);
 if p_payload->>'register_year' is null or (p_payload->>'register_year')::integer not between 1900 and 2200 or nullif(trim(p_payload->>'register_book'),'') is null or length(p_payload->>'register_book')>100 or nullif(trim(p_payload->>'local_number'),'') is null or length(p_payload->>'local_number')>100
  or length(coalesce(p_payload->>'given_name',''))>100 or length(coalesce(p_payload->>'family_name',''))>100
  or coalesce(p_payload->>'sex','') not in ('female','male','unknown') or coalesce(p_payload->>'name_status','confirmed') not in ('confirmed','provisional','unknown') or coalesce(p_payload->>'birth_date_precision','exact') not in ('exact','estimated','unknown')
  or (mother is not null and length(mother) not between 2 and 200) or (place is not null and length(place) not between 2 and 200)
  or length(coalesce(p_payload->>'smi_reference',''))>100
 then raise exception 'Registration details required' using errcode='22023';end if;
 if coalesce(p_payload->>'name_status','confirmed')<>'unknown' and (nullif(trim(p_payload->>'given_name'),'') is null or nullif(trim(p_payload->>'family_name'),'') is null) then raise exception 'Full name or explicit uncertainty required' using errcode='22023';end if;
 dob:=nullif(p_payload->>'birth_date','')::date;
 if (coalesce(p_payload->>'birth_date_precision','exact')='unknown')<>(dob is null) or dob>(now() at time zone 'Africa/Casablanca')::date or dob<date '1900-01-01' then raise exception 'Valid birth date and precision required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':registration_probe',0));
 select * into item from private.registration_cases where actor_id=actor and operation_id=p_operation_id for update;
 if found then
  if item.payload is distinct from p_payload then raise exception 'Registration operation reused with different identity or context' using errcode='22023';end if;
  if item.state='committed' then return jsonb_build_object('state','committed','operation_id',p_operation_id);end if;
  if item.expires_at<=now() then raise exception 'Registration case expired' using errcode='PT409';end if;
  if item.secondary_locked and (item.mother_name is distinct from mother or item.birthplace is distinct from place) then raise exception 'Secondary comparison already recorded; use controlled review' using errcode='22023';end if;
  if item.reviewed_revision is not null or (item.secondary_locked and item.mother_name is not distinct from mother and item.birthplace is not distinct from place) then return jsonb_build_object('state',item.state,'operation_id',p_operation_id);end if;
 end if;
 if (select count(*) from private.registration_probe_events where actor_id=actor and kind in ('checked','secondary','review_requested') and created_at>now()-interval '1 hour')>=60
 or (select count(*) from private.registration_probe_events where actor_id=actor and kind in ('checked','secondary','review_requested') and created_at>now()-interval '1 minute')>=10 then
  if not exists(select 1 from private.registration_probe_events where actor_id=actor and kind='rate_limited' and created_at>now()-interval '1 minute') then insert into private.registration_probe_events(actor_id,operation_id,kind,outcome) values(actor,p_operation_id,'rate_limited','rate_limited');end if;
  return jsonb_build_object('state','rate_limited','operation_id',p_operation_id);
 end if;
 comparison:=private.registration_candidates(p_payload,mother,place);phase:=comparison->>'state';
 if p_request_review and phase in ('needs_details','need_qr') then phase:='needs_review';end if;
 if item.actor_id is null then
  insert into private.registration_cases(actor_id,operation_id,payload,mother_name,birthplace,secondary_locked,state,candidate_ids,truncated,expires_at)
  values(actor,p_operation_id,p_payload,mother,place,mother is not null and place is not null,phase,array(select jsonb_array_elements_text(comparison->'ids')::uuid),(comparison->>'truncated')::boolean,now()+case when phase in ('needs_review','need_qr') then interval '7 days' else interval '30 minutes' end);
 else
  update private.registration_cases set mother_name=mother,birthplace=place,secondary_locked=mother is not null and place is not null,state=phase,candidate_ids=array(select jsonb_array_elements_text(comparison->'ids')::uuid),truncated=(comparison->>'truncated')::boolean,expires_at=now()+case when phase in ('needs_review','need_qr') then interval '7 days' else interval '30 minutes' end,revision=revision+1 where actor_id=actor and operation_id=p_operation_id;
 end if;
 insert into private.registration_probe_events(actor_id,operation_id,kind,outcome) values(actor,p_operation_id,case when p_request_review then 'review_requested' when item.actor_id is null then 'checked' else 'secondary' end,phase);
 return jsonb_build_object('state',phase,'operation_id',p_operation_id,'checked',(comparison->>'checked')::boolean);
end;$$;

create or replace function private.register_child(p_operation_id uuid,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid;item private.registration_cases;comparison jsonb;result uuid;base jsonb;
begin
 actor:=private.assert_doctor();
 select * into item from private.registration_cases where actor_id=actor and operation_id=p_operation_id for update;
 if not found then raise exception 'Registration-bound duplicate check required' using errcode='42501';end if;
 if item.payload is distinct from p_payload then raise exception 'Registration payload changed' using errcode='22023';end if;
 if item.state='committed' then return item.child_id;end if;
 if item.expires_at<=now() or item.state<>'ready' then raise exception 'Registration requires additional information or controlled review' using errcode='PT409';end if;
 -- All creators with the same birth date/sex serialize, including near-name matches.
 perform pg_advisory_xact_lock(hashtextextended(coalesce(p_payload->>'birth_date','unknown')||':'||coalesce(p_payload->>'sex','unknown')||':new_child',0));
 perform private.assert_facility((p_payload->>'facility_id')::uuid);
 comparison:=private.registration_candidates(p_payload,item.mother_name,item.birthplace);
 if item.reviewed_revision is null then
  if comparison->>'state'<>'ready' then raise exception 'A new possible duplicate requires another registration check' using errcode='PT409';end if;
 elsif (comparison->>'truncated')::boolean or exists(select 1 from jsonb_array_elements_text(comparison->'ids') i(id) where i.id::uuid<>all(item.candidate_ids)) then
  raise exception 'Candidate set changed after review' using errcode='PT409';
 end if;
 base:=p_payload-array['smi_reference','parent_draft_identity_checked'];
 if item.reviewed_revision is not null and nullif(trim(base->>'duplicate_override_reason'),'') is null then base:=base||jsonb_build_object('duplicate_override_reason','Dossier distinct après revue contrôlée de l’opération '||p_operation_id::text);end if;
 result:=private.register_child_before_duplicates(p_operation_id,base);
 insert into private.child_duplicate_identity(child_id,mother_name,birthplace,recorded_by) values(result,item.mother_name,item.birthplace,actor);
 update public.doctor_patient_registry set smi_reference=nullif(trim(p_payload->>'smi_reference'),'') where child_id=result and professional_id=actor;
 update private.registration_cases set state='committed',child_id=result,revision=revision+1 where actor_id=actor and operation_id=p_operation_id;
 insert into private.registration_probe_events(actor_id,operation_id,kind,outcome) values(actor,p_operation_id,'committed','created_new_child');
 return result;
end;$$;

-- Persist the registration and pending guardian claim in the same transaction.
-- The existing guardian review remains the only path to verified parent access.
create function private.attach_parent_draft_to_registration()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare draft private.parent_child_drafts; email text; invitation uuid; claim uuid;
begin
  select * into draft from private.parent_child_drafts where id = new.operation_id for update;
  if not found then return new; end if;
  if draft.child_id is not null or draft.doctor_id is distinct from new.actor_id
      or draft.doctor_session::text is distinct from auth.jwt()->>'session_id'
      or draft.doctor_expires_at is null or draft.doctor_expires_at <= now()
      or private.get_parent_child_intake(draft.id) is null
      or new.payload->'parent_draft_identity_checked' is distinct from 'true'::jsonb
      or new.payload->>'name_status' is distinct from 'confirmed'
      or new.payload->>'birth_date_precision' is distinct from 'exact' then
    raise exception 'Scan the current draft and confirm the child identity' using errcode = '42501';
  end if;
  select lower(u.email) into email from auth.users u where u.id = draft.guardian_id
    and u.email_confirmed_at is not null and u.email is not null and (u.banned_until is null or u.banned_until <= now());
  if not found then raise exception 'Confirmed parent account required' using errcode = '42501'; end if;
  insert into private.guardian_invitations (child_id, created_by, recipient_email, token_hash, reason,
      expires_at, consumed_at, consumed_by)
    values (new.child_id, new.actor_id, email, encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'),
      'Demande de liaison présentée par le parent en consultation.', now() + interval '24 hours', now(), draft.guardian_id)
    returning id into invitation;
  insert into private.guardian_claims (invitation_id, guardian_id, claimed_email, declared_relationship, consent_at)
    values (invitation, draft.guardian_id, email, 'other', draft.consent_at)
    returning id into claim;
  insert into private.guardian_events (actor_id, child_id, entity_id, kind)
    values (draft.guardian_id, new.child_id, claim, 'claimed');
  update private.parent_child_drafts set child_id = new.child_id, claim_id = claim
    where id = draft.id;
  return new;
end;
$$;

revoke all on function private.attach_parent_draft_to_registration() from public, anon, authenticated;
create trigger attach_parent_draft_to_registration after update of state on private.registration_cases
  for each row when (new.state = 'committed' and old.state is distinct from new.state)
  execute function private.attach_parent_draft_to_registration();

create function public.add_parent_child_draft(p_operation_id uuid, p_given_name text, p_family_name text, p_birth_date date)
returns uuid language sql security invoker set search_path = ''
as $$ select private.add_parent_child_draft(p_operation_id, p_given_name, p_family_name, p_birth_date); $$;
create function public.list_parent_child_drafts()
returns jsonb language sql security invoker set search_path = ''
as $$ select private.list_parent_child_drafts(); $$;
create function public.issue_parent_child_draft(p_draft_id uuid, p_consent boolean)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.issue_parent_child_draft(p_draft_id, p_consent); $$;
create function public.redeem_parent_child_draft(p_token text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.redeem_parent_child_draft(p_token); $$;
create function public.get_parent_child_intake(p_draft_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.get_parent_child_intake(p_draft_id); $$;

revoke all on function
  public.add_parent_child_draft(uuid, text, text, date), private.add_parent_child_draft(uuid, text, text, date),
  public.list_parent_child_drafts(), private.list_parent_child_drafts(),
  public.issue_parent_child_draft(uuid, boolean), private.issue_parent_child_draft(uuid, boolean),
  public.redeem_parent_child_draft(text), private.redeem_parent_child_draft(text),
  public.get_parent_child_intake(uuid), private.get_parent_child_intake(uuid)
from public, anon;
grant execute on function
  public.add_parent_child_draft(uuid, text, text, date), private.add_parent_child_draft(uuid, text, text, date),
  public.list_parent_child_drafts(), private.list_parent_child_drafts(),
  public.issue_parent_child_draft(uuid, boolean), private.issue_parent_child_draft(uuid, boolean),
  public.redeem_parent_child_draft(text), private.redeem_parent_child_draft(text),
  public.get_parent_child_intake(uuid), private.get_parent_child_intake(uuid)
to authenticated;

commit;
