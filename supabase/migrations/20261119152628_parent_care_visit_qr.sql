begin;

alter table private.clinician_shares
  drop constraint clinician_shares_scope_check,
  add constraint clinician_shares_scope_check
    check (scope in ('vaccination_read', 'booklet_read', 'care_visit'));

create index clinician_shares_care_visit_idx
  on private.clinician_shares (recipient_id, child_id, consumed_at)
  where scope = 'care_visit' and revoked_at is null;

create function private.has_standard_child_access(p_child_id uuid, p_manage boolean default false)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.has_live_session() and exists (
    select 1 from public.professional_profiles p
    join public.access_grants g on g.professional_id = p.user_id
    where p.user_id = auth.uid() and p.role in ('doctor', 'nurse')
      and p.verification_status = 'approved' and p.professional_id is not null
      and g.child_id = p_child_id and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
      and (not p_manage or g.can_manage_access)
  );
$$;

create function public.has_standard_child_access(p_child_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.has_standard_child_access(p_child_id, false); $$;

revoke all on function private.has_standard_child_access(uuid, boolean), public.has_standard_child_access(uuid) from public, anon;
grant execute on function private.has_standard_child_access(uuid, boolean), public.has_standard_child_access(uuid) to authenticated;

-- The visit extends clinical access for one live doctor session only.
create or replace function private.can_access_child(p_child_id uuid, p_manage boolean default false)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.has_standard_child_access(p_child_id, p_manage)
    or (not p_manage and private.has_live_session() and exists (
      select 1 from private.clinician_shares s
      join public.professional_profiles p on p.user_id = s.recipient_id and p.role = 'doctor'
      where s.recipient_id = auth.uid()
        and s.recipient_session::text = auth.jwt()->>'session_id'
        and s.child_id = p_child_id and s.scope = 'care_visit'
        and s.revoked_at is null and s.consumed_at > now() - interval '1 hour'
        and private.share_authority_current(s) and private.share_recipient_current(s)
    ));
$$;

create or replace function private.issue_clinician_share(p_child_id uuid,p_scope text,p_consent boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;link private.guardian_links;secret text;item private.clinician_shares;
begin
 actor:=private.assert_parent_account();
 if not private.can_access_as_guardian(p_child_id,true) then raise exception 'Share authority required' using errcode='42501';end if;
 if p_consent is distinct from true or coalesce(p_scope,'') not in ('vaccination_read','booklet_read','care_visit') then raise exception 'Explicit purpose and consent required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('clinician-share-issue:'||actor::text,0));
 select * into link from private.guardian_links where guardian_id=actor and child_id=p_child_id and revoked_at is null and expires_at>now() and can_export for update;
 if not found then raise exception 'Share authority required' using errcode='42501';end if;
 if (select count(*) from private.clinician_shares where guardian_id=actor and created_at>now()-interval '10 minutes')>=5 then return jsonb_build_object('accepted',false);end if;
 -- Three independent cryptographic v4 UUID seeds provide >256 bits of entropy; SHA-256 conditions to a portable 32-byte secret, without a new extension.
 secret:=rtrim(translate(encode(sha256(convert_to(gen_random_uuid()::text||gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'base64'),'+/','-_'),'=');
 update private.clinician_shares set revoked_at=now() where guardian_id=actor and child_id=p_child_id and consumed_at is null and revoked_at is null;
 insert into private.clinician_shares(child_id,guardian_id,guardian_link_id,issuer_session,token_hash,scope,expires_at)
 values(p_child_id,actor,link.id,(auth.jwt()->>'session_id')::uuid,encode(sha256(convert_to(secret,'UTF8')),'hex'),p_scope,least(now()+interval '5 minutes',link.expires_at)) returning * into item;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,p_child_id,'guardian_share_issued','created');
 return jsonb_build_object('accepted',true,'id',item.id,'token',secret,'scope',item.scope,'expires_at',item.expires_at,'server_now',now());
end;$$;

create or replace function private.redeem_clinician_share(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;item private.clinician_shares;platform text;
begin
 actor:=private.assert_doctor();
 perform private.assert_parent_account(); -- Confirmed active Auth account; this does not confer parent/guardian rights.
 perform pg_advisory_xact_lock(hashtextextended('clinician-share-redeem:'||actor::text,0));
 if (select count(*) from private.clinician_share_attempts where actor_id=actor and created_at>now()-interval '10 minutes')>=10 then return jsonb_build_object('accepted',false);end if;
 insert into private.clinician_share_attempts(actor_id) values(actor);
 if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then return jsonb_build_object('accepted',false);end if;
 select * into item from private.clinician_shares where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if not found or item.revoked_at is not null or item.consumed_at is not null or item.expires_at<=now() or not private.share_authority_current(item) then return jsonb_build_object('accepted',false);end if;
 select professional_id into platform from public.professional_profiles
   where user_id=actor and (item.scope <> 'care_visit' or role = 'doctor');
 if not found then return jsonb_build_object('accepted', false); end if;
 update private.clinician_shares set consumed_at=now(),recipient_id=actor,recipient_session=(auth.jwt()->>'session_id')::uuid,professional_id=platform where id=item.id;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,item.child_id,'guardian_share_redeemed','accessed');
 return jsonb_build_object('accepted',true,'id',item.id,'scope',item.scope,'expires_at',item.expires_at,'server_now',now()) ||
   case when item.scope = 'care_visit' then jsonb_build_object('child_id', item.child_id)
        else '{}'::jsonb end;
end;$$;

create or replace function private.list_clinician_shares(p_child_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;result jsonb;
begin
 actor:=private.assert_parent_account();
 if not private.can_access_as_guardian(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'scope',s.scope,'expires_at',deadline.deadline,'professional_id',s.professional_id,'consumed_at',s.consumed_at,'revoked_at',s.revoked_at,'active',deadline.deadline>now() and s.revoked_at is null and private.share_authority_current(s) and private.share_recipient_current(s))), '[]'::jsonb) into result
 from (select * from private.clinician_shares where child_id=p_child_id and guardian_id=actor order by created_at desc,id limit 20) s
 cross join lateral (
   select case when s.scope = 'care_visit' and s.consumed_at is not null
     then least(s.consumed_at + interval '1 hour', (
       select expires_at from private.guardian_links where id = s.guardian_link_id
     )) else s.expires_at end as deadline
 ) deadline;
 return jsonb_build_object('items',result,'can_share',private.can_access_as_guardian(p_child_id,true),'server_now',now());
end;$$;

create or replace function private.link_child(p_operation_id uuid,p_universal_id uuid,p_facility_id uuid,p_year integer,p_book text,p_number text) returns uuid
language plpgsql security definer set search_path='' as $$
declare child uuid; result uuid; payload jsonb:=jsonb_build_object('universal_id',p_universal_id,'facility_id',p_facility_id,'year',p_year,'book',p_book,'number',p_number);
begin
  perform private.assert_doctor(); perform private.assert_facility(p_facility_id);
  result:=private.operation_result(p_operation_id,'link_child',payload); if result is not null then return result; end if;
  select id into child from public.children where universal_id=p_universal_id;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(child::text,''),0));
  if child is null or not private.has_standard_child_access(child,false) then raise exception 'Existing authorization required' using errcode='42501'; end if;
  insert into public.doctor_patient_registry(professional_id,child_id,facility_id,register_year,register_book,local_number) values (auth.uid(),child,p_facility_id,p_year,trim(p_book),trim(p_number)) returning id into result;
  insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id) values (auth.uid(),p_operation_id,'link_child',payload,child);
  return child;
end;
$$;

create or replace function private.write_clinical_entry_base(p_operation_id uuid,p_child_id uuid,p_kind text,p_facility_id uuid,p_occurred_on date,p_occurrence_precision text,p_source_type text,p_source_reference text,p_source_verified boolean,p_payload jsonb,p_root_id uuid default null,p_expected_revision integer default null,p_amendment_reason text default null,p_entry_state text default 'active') returns uuid
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
 if not (p_kind='vaccination' and p_entry_state='withdrawn') and (p_occurrence_precision is null or p_occurrence_precision not in ('exact','estimated','unknown') or (p_occurrence_precision='unknown')<>(p_occurred_on is null) or (p_occurred_on is not null and (p_occurred_on>(now() at time zone 'Africa/Casablanca')::date or p_occurred_on<date '1900-01-01' or (child.birth_date_precision='exact' and p_occurred_on<child.birth_date)))) then raise exception 'Invalid occurrence date or certainty' using errcode='22023';end if;
 if p_source_type is null or p_source_type not in ('observed','paper_transcription','reported_history') or p_source_verified is null or (p_source_type='observed' and p_occurrence_precision<>'exact') or (p_source_type<>'observed' and coalesce(length(trim(p_source_reference)),0)<3) or length(p_source_reference)>1000 or p_entry_state is null or p_entry_state not in ('active','withdrawn') then raise exception 'Invalid provenance or entry state' using errcode='22023';end if;
 if p_root_id is not null then
  perform pg_advisory_xact_lock(hashtextextended(p_root_id::text,1));
  select * into prior from public.clinical_entries where root_id=p_root_id order by revision desc limit 1;
  if not found or prior.child_id<>p_child_id or prior.kind<>p_kind then raise exception 'Clinical entry denied' using errcode='42501';end if;
  if prior.author_id <> actor and not private.has_standard_child_access(p_child_id, false) then
    raise exception 'Visit access only allows corrections to your own entries' using errcode = '42501';
  end if;
  if p_expected_revision is null or prior.revision<>p_expected_revision then raise exception 'Stale clinical revision' using errcode='PT409';end if;
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


-- Retire the superseded doctor-issued QR endpoints without deleting their audit history.
revoke execute on function
  public.issue_doctor_care_qr(uuid, text, text, boolean), private.issue_doctor_care_qr(uuid, text, text, boolean),
  public.redeem_doctor_care_qr(text), private.redeem_doctor_care_qr(text),
  public.cancel_doctor_care_qr(uuid), private.cancel_doctor_care_qr(uuid)
from public, anon, authenticated, service_role;

-- Revoke only still-active grants written by redemption of a retired QR.
-- Newer ordinary grants have a different grant timestamp and are preserved.
update public.access_grants g set revoked_at = now()
where g.revoked_at is null and g.expires_at > now()
  and exists (
    select 1 from private.doctor_care_invitations i
    where i.child_id = g.child_id and i.recipient_id = g.professional_id
      and i.issuer_id = g.granted_by and i.redeemed_at = g.granted_at
  );

commit;
