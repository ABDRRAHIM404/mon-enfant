begin;

create table private.guardian_invitations (
 id uuid primary key default gen_random_uuid(),child_id uuid not null references public.children(id),
 created_by uuid not null references public.professional_profiles(user_id),recipient_email text not null,
 token_hash text not null unique check(token_hash~'^[a-f0-9]{64}$'),reason text not null check(length(trim(reason)) between 10 and 1000),
 created_at timestamptz not null default now(),expires_at timestamptz not null,
 revoked_at timestamptz,consumed_at timestamptz,consumed_by uuid references auth.users(id),
 check(expires_at>created_at and expires_at<=created_at+interval '48 hours'),
 check((consumed_at is null)=(consumed_by is null))
);
create index guardian_invitations_child_idx on private.guardian_invitations(child_id,created_at desc);
create table private.guardian_claims (
 id uuid primary key default gen_random_uuid(),invitation_id uuid not null unique references private.guardian_invitations(id),
 guardian_id uuid not null references private.guardian_profiles(user_id),claimed_email text not null,
 declared_relationship text not null check(length(trim(declared_relationship)) between 2 and 100),
 consent_at timestamptz not null default now(),created_at timestamptz not null default now(),
 state text not null default 'pending' check(state in ('pending','approved','rejected','cancelled')),
 revision integer not null default 1,decided_at timestamptz
);
create index guardian_claims_parent_idx on private.guardian_claims(guardian_id,created_at desc);
-- Parent operation receipts are separate from professional-only receipts.
create table private.guardian_claim_operations (
 actor_id uuid not null references auth.users(id),operation_id uuid not null,
 payload jsonb not null,result_id uuid not null references private.guardian_claims(id),
 created_at timestamptz not null default now(),primary key(actor_id,operation_id)
);
alter table private.guardian_claim_operations enable row level security;
revoke all on private.guardian_claim_operations from public,anon,authenticated;
create trigger guardian_claim_operations_immutable before update or delete on private.guardian_claim_operations for each row execute function private.prevent_mutation();
create table private.guardian_decisions (
 id uuid primary key default gen_random_uuid(),claim_id uuid not null unique references private.guardian_claims(id),
 actor_id uuid not null references public.professional_profiles(user_id),professional_id text not null,
 decision text not null check(decision in ('approved','rejected')),relationship text,
 authority_reference text not null check(length(trim(authority_reference)) between 10 and 1000),
 reason text not null check(length(trim(reason)) between 10 and 1000),
 identity_checked boolean not null,guardianship_checked boolean not null,
 expires_on date,can_export boolean not null default false,created_at timestamptz not null default now()
);
create table private.guardian_links (
 id uuid primary key references private.guardian_decisions(id),child_id uuid not null references public.children(id),
 guardian_id uuid not null references private.guardian_profiles(user_id),claim_id uuid not null unique references private.guardian_claims(id),
 granted_by uuid not null references public.professional_profiles(user_id),relationship text not null check(relationship in ('mother','father','legal_guardian','other')),
 can_export boolean not null default false,created_at timestamptz not null default now(),expires_at timestamptz not null,
 revoked_at timestamptz,revoked_by uuid references auth.users(id),revocation_reason text,
 check(expires_at>created_at),check((revoked_at is null)=(revoked_by is null)),
 check(revoked_at is null or length(trim(revocation_reason)) between 10 and 1000)
);
create unique index guardian_links_active_unique on private.guardian_links(child_id,guardian_id) where revoked_at is null;
create index guardian_links_parent_idx on private.guardian_links(guardian_id,expires_at) where revoked_at is null;
create table private.guardian_events (
 id uuid primary key default gen_random_uuid(),actor_id uuid not null references auth.users(id),
 child_id uuid not null references public.children(id),entity_id uuid not null,
 kind text not null check(kind in ('invited','replaced','claimed','approved','rejected','invitation_revoked','link_revoked')),
 reason text,created_at timestamptz not null default now()
);
alter table private.guardian_invitations enable row level security;
alter table private.guardian_claims enable row level security;
alter table private.guardian_decisions enable row level security;
alter table private.guardian_links enable row level security;
alter table private.guardian_events enable row level security;
revoke all on private.guardian_invitations,private.guardian_claims,private.guardian_decisions,private.guardian_links,private.guardian_events from public,anon,authenticated;
create trigger guardian_decisions_immutable before update or delete on private.guardian_decisions for each row execute function private.prevent_mutation();
create trigger guardian_events_immutable before update or delete on private.guardian_events for each row execute function private.prevent_mutation();

create function private.guard_guardian_facts() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='guardian_invitations' then
  if (to_jsonb(new)-array['revoked_at','consumed_at','consumed_by']) is distinct from (to_jsonb(old)-array['revoked_at','consumed_at','consumed_by'])
   or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at)
   or (old.consumed_at is not null and (new.consumed_at is distinct from old.consumed_at or new.consumed_by is distinct from old.consumed_by))
  then raise exception 'Invitation facts are immutable' using errcode='22023';end if;
 elsif tg_table_name='guardian_claims' then
  if (to_jsonb(new)-array['state','revision','decided_at']) is distinct from (to_jsonb(old)-array['state','revision','decided_at'])
   or old.state<>'pending' or new.state not in ('approved','rejected','cancelled') or new.revision<>old.revision+1 or new.decided_at is null
  then raise exception 'Guardian claim facts are immutable' using errcode='22023';end if;
 elsif tg_table_name='guardian_links' then
  if tg_op='INSERT' then
   if not exists(select 1 from private.guardian_decisions d join private.guardian_claims c on c.id=d.claim_id join private.guardian_invitations i on i.id=c.invitation_id
    where d.id=new.id and d.decision='approved' and d.identity_checked and d.guardianship_checked and c.id=new.claim_id and c.guardian_id=new.guardian_id
     and i.child_id=new.child_id and d.actor_id=new.granted_by and d.relationship=new.relationship and d.can_export=new.can_export
     and new.expires_at=((d.expires_on+1)::timestamp at time zone 'Africa/Casablanca'))
   then raise exception 'Verified guardian decision required' using errcode='42501';end if;
  elsif (to_jsonb(new)-array['revoked_at','revoked_by','revocation_reason']) is distinct from (to_jsonb(old)-array['revoked_at','revoked_by','revocation_reason'])
   or old.revoked_at is not null or new.revoked_at is null
  then raise exception 'Guardian link facts are immutable' using errcode='22023';end if;
 end if;
 return new;
end;$$;
revoke all on function private.guard_guardian_facts() from public,anon,authenticated;
create trigger guardian_invitation_facts before update on private.guardian_invitations for each row execute function private.guard_guardian_facts();
create trigger guardian_claim_facts before update on private.guardian_claims for each row execute function private.guard_guardian_facts();
create trigger guardian_link_facts before insert or update on private.guardian_links for each row execute function private.guard_guardian_facts();
create trigger guardian_invitation_no_delete before delete on private.guardian_invitations for each row execute function private.prevent_mutation();
create trigger guardian_claim_no_delete before delete on private.guardian_claims for each row execute function private.prevent_mutation();
create trigger guardian_link_no_delete before delete on private.guardian_links for each row execute function private.prevent_mutation();

create function private.can_access_as_guardian(p_child_id uuid,p_export boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_live_session() and exists(
  select 1 from private.guardian_links g join auth.users u on u.id=g.guardian_id
  where g.guardian_id=auth.uid() and g.child_id=p_child_id and g.revoked_at is null and g.expires_at>now()
   and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now()) and (not p_export or g.can_export)
 );
$$;
revoke all on function private.can_access_as_guardian(uuid,boolean) from public,anon,authenticated;

create function private.create_guardian_invitation(p_child_id uuid,p_recipient_email text,p_token_hash text,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;actor uuid;prior record;email text:=lower(trim(p_recipient_email));
begin
 actor:=private.assert_doctor();
 perform pg_advisory_xact_lock(hashtextextended(p_child_id::text,0));
 if not private.can_access_child(p_child_id,true) then raise exception 'Child access manager required' using errcode='42501';end if;
 if email is null or length(email)>254 or email!~'^[^[:space:]<>]+@[^[:space:]<>]+\.[^[:space:]<>]+$'
  or p_token_hash is null or p_token_hash!~'^[a-f0-9]{64}$' or p_reason is null or length(trim(p_reason)) not between 10 and 1000
 then raise exception 'Recipient and invitation basis required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_child_id::text||':guardian:'||email,0));
 for prior in update private.guardian_invitations set revoked_at=now()
  where child_id=p_child_id and recipient_email=email and revoked_at is null and consumed_at is null returning id
 loop
  insert into private.guardian_events(actor_id,child_id,entity_id,kind,reason) values(actor,p_child_id,prior.id,'replaced',trim(p_reason));
 end loop;
 insert into private.guardian_invitations(child_id,created_by,recipient_email,token_hash,reason,expires_at)
 values(p_child_id,actor,email,p_token_hash,trim(p_reason),now()+interval '24 hours') returning id into result;
 insert into private.guardian_events(actor_id,child_id,entity_id,kind,reason) values(actor,p_child_id,result,'invited',trim(p_reason));
 return result;
end;$$;

create function private.claim_guardian_invitation(p_operation_id uuid,p_token text,p_relationship text,p_consent boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid;email text;hashed text;item private.guardian_invitations;result uuid;payload jsonb;receipt private.guardian_claim_operations;
begin
 actor:=private.assert_parent_account();
 if not exists(select 1 from private.guardian_profiles where user_id=actor) then raise exception 'Parent profile required' using errcode='22023';end if;
 if p_token is null or p_token!~'^[A-Za-z0-9_-]{43}$' or p_consent is distinct from true or p_relationship is null or length(trim(p_relationship)) not between 2 and 100
 then raise exception 'Invitation and relationship declaration required' using errcode='22023';end if;
 hashed:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 payload:=jsonb_build_object('token_hash',hashed,'relationship',trim(p_relationship),'consent',true);
 if p_operation_id is null then raise exception 'Operation ID required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_operation_id::text,0));
 select * into receipt from private.guardian_claim_operations where actor_id=actor and operation_id=p_operation_id;
 if found then
  if receipt.payload is distinct from payload then raise exception 'Operation ID reused with different input' using errcode='22023';end if;
  return receipt.result_id;
 end if;
 select lower(u.email) into email from auth.users u where u.id=actor;
 select * into item from private.guardian_invitations where token_hash=hashed for update;
 if not found or item.recipient_email<>email or item.revoked_at is not null or item.expires_at<=now()
 then raise exception 'Invitation unavailable' using errcode='42501';end if;
 if item.consumed_at is not null then raise exception 'Invitation already consumed' using errcode='PT409';end if;
 insert into private.guardian_claims(invitation_id,guardian_id,claimed_email,declared_relationship)
 values(item.id,actor,email,trim(p_relationship)) returning id into result;
 update private.guardian_invitations set consumed_at=now(),consumed_by=actor where id=item.id;
 insert into private.guardian_events(actor_id,child_id,entity_id,kind) values(actor,item.child_id,result,'claimed');
 insert into private.guardian_claim_operations(actor_id,operation_id,payload,result_id) values(actor,p_operation_id,payload,result);
 return result;
end;$$;

create function private.review_guardian_claim(p_operation_id uuid,p_claim_id uuid,p_expected_revision integer,p_decision text,p_relationship text,p_authority_reference text,p_reason text,p_identity_checked boolean,p_guardianship_checked boolean,p_expires_on date,p_can_export boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid;item private.guardian_claims;invitation private.guardian_invitations;platform text;result uuid;prior private.guardian_links;deadline timestamptz;
 payload jsonb:=jsonb_build_object('claim',p_claim_id,'revision',p_expected_revision,'decision',p_decision,'relationship',p_relationship,'reference',p_authority_reference,'reason',p_reason,'identity',p_identity_checked,'guardianship',p_guardianship_checked,'expires_on',p_expires_on,'export',p_can_export);
begin
 actor:=private.assert_doctor();
 select * into item from private.guardian_claims where id=p_claim_id;
 select * into invitation from private.guardian_invitations where id=item.invitation_id;
 if invitation.id is null or not private.can_access_child(invitation.child_id,true) then raise exception 'Child access manager required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(invitation.child_id::text,0));
 if not private.can_access_child(invitation.child_id,true) then raise exception 'Child access manager required' using errcode='42501';end if;
 if item.guardian_id=actor then raise exception 'Independent guardian review required' using errcode='42501';end if;
 result:=private.operation_result(p_operation_id,'guardian_review',payload);if result is not null then return result;end if;
 select * into item from private.guardian_claims where id=p_claim_id for update;
 select * into invitation from private.guardian_invitations where id=item.invitation_id for update;
 if item.state<>'pending' or item.revision is distinct from p_expected_revision or invitation.revoked_at is not null
 then raise exception 'Guardian claim changed' using errcode='PT409';end if;
 if p_decision is null or p_decision not in ('approved','rejected') or p_reason is null or length(trim(p_reason)) not between 10 and 1000
  or p_authority_reference is null or length(trim(p_authority_reference)) not between 10 and 1000
 then raise exception 'Guardianship decision and source required' using errcode='22023';end if;
 if p_decision='approved' then
  if p_identity_checked is distinct from true or p_guardianship_checked is distinct from true or p_can_export is null
   or p_relationship is null or p_relationship not in ('mother','father','legal_guardian','other')
   or p_expires_on is null or p_expires_on<(now() at time zone 'Africa/Casablanca')::date or p_expires_on>(now() at time zone 'Africa/Casablanca')::date+366
  then raise exception 'Verified identity and guardian authority with bounded access required' using errcode='22023';end if;
  if not exists(select 1 from auth.users u where u.id=item.guardian_id and u.email_confirmed_at is not null and lower(u.email)=item.claimed_email and (u.banned_until is null or u.banned_until<=now()))
  then raise exception 'Guardian identity changed' using errcode='PT409';end if;
  select * into prior from private.guardian_links where child_id=invitation.child_id and guardian_id=item.guardian_id and revoked_at is null for update;
  if found and prior.expires_at>now() then raise exception 'Guardian already linked' using errcode='PT409';end if;
  if prior.id is not null then
   update private.guardian_links set revoked_at=now(),revoked_by=actor,revocation_reason='Accès expiré remplacé après une nouvelle vérification.' where id=prior.id;
   insert into private.guardian_events(actor_id,child_id,entity_id,kind,reason) values(actor,invitation.child_id,prior.id,'link_revoked','Accès expiré remplacé après vérification.');
  end if;
  deadline:=(p_expires_on+1)::timestamp at time zone 'Africa/Casablanca';
 end if;
 select professional_id into platform from public.professional_profiles where user_id=actor;
 result:=gen_random_uuid();
 insert into private.guardian_decisions(id,claim_id,actor_id,professional_id,decision,relationship,authority_reference,reason,identity_checked,guardianship_checked,expires_on,can_export)
 values(result,item.id,actor,platform,p_decision,p_relationship,trim(p_authority_reference),trim(p_reason),coalesce(p_identity_checked,false),coalesce(p_guardianship_checked,false),p_expires_on,coalesce(p_can_export,false));
 if p_decision='approved' then
  insert into private.guardian_links(id,child_id,guardian_id,claim_id,granted_by,relationship,can_export,expires_at)
  values(result,invitation.child_id,item.guardian_id,item.id,actor,p_relationship,p_can_export,deadline);
 end if;
 update private.guardian_claims set state=p_decision,revision=revision+1,decided_at=now() where id=item.id;
 insert into private.guardian_events(actor_id,child_id,entity_id,kind,reason) values(actor,invitation.child_id,result,p_decision,trim(p_reason));
 insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id) values(actor,p_operation_id,'guardian_review',payload,result);
 return result;
end;$$;

create function private.revoke_guardian_invitation(p_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare item private.guardian_invitations;actor uuid;
begin
 actor:=private.assert_doctor();select * into item from private.guardian_invitations where id=p_id;
 if not found then raise exception 'Child access manager required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(item.child_id::text,0));
 select * into item from private.guardian_invitations where id=p_id for update;
 if not private.can_access_child(item.child_id,true) then raise exception 'Child access manager required' using errcode='42501';end if;
 if p_reason is null or length(trim(p_reason)) not between 10 and 1000 then raise exception 'Revocation reason required' using errcode='22023';end if;
 if item.revoked_at is not null then return;end if;
 update private.guardian_invitations set revoked_at=now() where id=item.id;
 update private.guardian_claims set state='cancelled',revision=revision+1,decided_at=now() where invitation_id=item.id and state='pending';
 insert into private.guardian_events(actor_id,child_id,entity_id,kind,reason) values(actor,item.child_id,item.id,'invitation_revoked',trim(p_reason));
end;$$;

create function private.revoke_guardian_link(p_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare item private.guardian_links;actor uuid;
begin
 actor:=private.assert_parent_account();select * into item from private.guardian_links where id=p_id;
 if not found then raise exception 'Guardian link denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(item.child_id::text,0));
 select * into item from private.guardian_links where id=p_id for update;
 if (item.guardian_id<>actor and not private.can_access_child(item.child_id,true)) then raise exception 'Guardian link denied' using errcode='42501';end if;
 if p_reason is null or length(trim(p_reason)) not between 10 and 1000 then raise exception 'Revocation reason required' using errcode='22023';end if;
 if item.revoked_at is not null then return;end if;
 update private.guardian_links set revoked_at=now(),revoked_by=actor,revocation_reason=trim(p_reason) where id=item.id;
 insert into private.guardian_events(actor_id,child_id,entity_id,kind,reason) values(actor,item.child_id,item.id,'link_revoked',trim(p_reason));
end;$$;

create function private.doctor_guardian_overview(p_child_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.can_access_child(p_child_id,true) then raise exception 'Child access manager required' using errcode='42501';end if;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'guardian_management_read','accessed');
 return jsonb_build_object(
 'invitations',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'recipient_email',i.recipient_email,'created_at',i.created_at,'expires_at',i.expires_at,'revoked_at',i.revoked_at,'consumed_at',i.consumed_at) order by i.created_at desc) from private.guardian_invitations i where i.child_id=p_child_id),'[]'::jsonb),
 'claims',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'revision',c.revision,'state',c.state,'display_name',p.display_name,'email',c.claimed_email,'declared_relationship',c.declared_relationship,'created_at',c.created_at) order by c.created_at desc) from private.guardian_claims c join private.guardian_invitations i on i.id=c.invitation_id join private.guardian_profiles p on p.user_id=c.guardian_id where i.child_id=p_child_id),'[]'::jsonb),
 'links',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'display_name',p.display_name,'relationship',g.relationship,'expires_at',g.expires_at,'revoked_at',g.revoked_at,'can_export',g.can_export) order by g.created_at desc) from private.guardian_links g join private.guardian_profiles p on p.user_id=g.guardian_id where g.child_id=p_child_id),'[]'::jsonb));
end;$$;

create or replace function private.parent_workspace() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;result jsonb;
begin
 actor:=private.assert_parent_account();
 select jsonb_build_object('profile',(select jsonb_build_object('display_name',p.display_name,'created_at',p.created_at) from private.guardian_profiles p where p.user_id=actor),
 'children',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'universal_id',c.universal_id,'given_name',c.given_name,'family_name',c.family_name,'name_status',c.name_status,'birth_date',c.birth_date,'birth_date_precision',c.birth_date_precision,'link_id',g.id,'relationship',g.relationship,'expires_at',g.expires_at,'can_export',g.can_export) order by c.created_at,c.id) from private.guardian_links g join public.children c on c.id=g.child_id where g.guardian_id=actor and g.revoked_at is null and g.expires_at>now()),'[]'::jsonb),
 'claims',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'state',c.state,'created_at',c.created_at) order by c.created_at desc) from private.guardian_claims c where c.guardian_id=actor),'[]'::jsonb)) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) select actor,g.child_id,'guardian_child_list_read','accessed' from private.guardian_links g where g.guardian_id=actor and g.revoked_at is null and g.expires_at>now();
 return result;
end;$$;
create or replace function public.parent_workspace() returns jsonb language sql security invoker set search_path='' as $$select private.parent_workspace();$$;

-- Shared appointment projection is extended below to verified guardian scope.

create or replace function private.appointment_rows(p_child_id uuid default null,p_owned_only boolean default true) returns setof jsonb
language sql stable security definer set search_path='' as $$
 select to_jsonb(a)||jsonb_build_object('revision',e.revision,'event_id',e.id,'state',e.state,'starts_at',e.starts_at,'ends_at',e.ends_at,'starts_on',(e.starts_at at time zone 'Africa/Casablanca')::date,'reason',e.reason,'event_recorded_at',e.recorded_at,
 'effective_state',case when e.state in ('cancelled','completed') then e.state when a.purpose='vaccination' and (not private.vaccine_item_active(a.vaccine_item_id) or (rule.eligibility='female' and c.sex<>'female')) then 'reference_review' when a.purpose='vaccination' and doc.data is not null then 'dose_documented' when e.state='missed' or e.ends_at<=now() then 'missed' else 'scheduled' end,
 'is_mine',a.responsible_id=auth.uid(),'documentation',doc.data,'recorded_by_other',coalesce((doc.data->>'author_id')::uuid<>a.responsible_id,false),
 'was_missed',exists(select 1 from public.appointment_events past where past.appointment_id=a.id and past.state='missed'),
 'facility_name',f.name,'child_given_name',c.given_name,'child_family_name',c.family_name,'universal_id',c.universal_id,'history_status',c.history_status,
 'dose_code',i.dose_code,'version_id',i.version_id,'version_label',v.label)
 from public.appointments a join public.children c on c.id=a.child_id join public.facilities f on f.id=a.facility_id
 join lateral(select * from public.appointment_events where appointment_id=a.id order by revision desc limit 1) e on true
 left join public.child_vaccine_items i on i.id=a.vaccine_item_id left join public.vaccine_versions v on v.id=i.version_id
 left join public.vaccine_rules rule on rule.version_id=i.version_id and rule.dose_code=i.dose_code
 left join lateral(select private.item_documentation(a.vaccine_item_id) data) doc on a.purpose='vaccination'
 where (not p_owned_only or a.responsible_id=auth.uid()) and (p_child_id is null or a.child_id=p_child_id) and (private.can_access_child(a.child_id,false) or private.can_access_as_guardian(a.child_id,false));
$$;

create function private.parent_child_booklet(p_child_id uuid,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;result jsonb;
begin
 actor:=private.assert_parent_account();
 if not private.can_access_as_guardian(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid booklet page' using errcode='22023';end if;
 with current_entries as materialized(
  select e.*,f.name facility_name from public.clinical_entries e join public.facilities f on f.id=e.facility_id
 where e.child_id=p_child_id and e.entry_state='active' and not exists(select 1 from public.clinical_entries n where n.root_id=e.root_id and n.revision>e.revision)
 ),entries as(select * from current_entries order by recorded_at desc,id limit 30 offset (p_page-1)*30),
 growth as(select * from current_entries where kind='growth' order by occurred_on desc nulls last,recorded_at desc limit 60),
 appointments as materialized(select data from private.appointment_rows(p_child_id,false) r(data)),
 slots as(select data from appointments order by (data->>'starts_at')::timestamptz desc,data->>'id' limit 30 offset (p_page-1)*30)
 select jsonb_build_object(
 'child',(select jsonb_build_object('id',c.id,'universal_id',c.universal_id,'given_name',c.given_name,'family_name',c.family_name,'name_status',c.name_status,'birth_date',c.birth_date,'birth_date_precision',c.birth_date_precision,'sex',c.sex,'history_status',c.history_status) from public.children c where c.id=p_child_id),
 'link',(select jsonb_build_object('id',g.id,'relationship',g.relationship,'expires_at',g.expires_at,'can_export',g.can_export) from private.guardian_links g where g.child_id=p_child_id and g.guardian_id=actor and g.revoked_at is null and g.expires_at>now()),
 'entries',coalesce((select jsonb_agg(to_jsonb(e) order by e.recorded_at desc,e.id) from entries e),'[]'::jsonb),
 'growth',coalesce((select jsonb_agg(to_jsonb(g) order by g.occurred_on,g.recorded_at) from growth g),'[]'::jsonb),
 'appointments',coalesce((select jsonb_agg(data order by (data->>'starts_at')::timestamptz desc,data->>'id') from slots),'[]'::jsonb),
 'entry_total',(select count(*) from current_entries),'appointment_total',(select count(*) from appointments),'page',p_page) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,p_child_id,'guardian_booklet_read','accessed');
 return result;
end;$$;

create function private.parent_child_export(p_child_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;result jsonb;
begin
 actor:=private.assert_parent_account();
 if not private.can_access_as_guardian(p_child_id,true) then raise exception 'Child export denied' using errcode='42501';end if;
 if (select count(*) from public.clinical_entries where child_id=p_child_id)>5000
  or (select count(*) from public.appointment_events e join public.appointments a on a.id=e.appointment_id where a.child_id=p_child_id)>5000
  or (select count(*) from public.vaccine_item_changes v join public.child_vaccine_items i on i.id=v.item_id where i.child_id=p_child_id)>5000
 then raise exception 'Parent export exceeds interactive limit' using errcode='54000';end if;
 select jsonb_build_object('format','mon-enfant-parent-booklet-v1','generated_at',now(),'synthetic_environment',true,
 'child',(select jsonb_build_object('id',c.id,'universal_id',c.universal_id,'given_name',c.given_name,'family_name',c.family_name,'name_status',c.name_status,'birth_date',c.birth_date,'birth_date_precision',c.birth_date_precision,'sex',c.sex,'history_status',c.history_status) from public.children c where c.id=p_child_id),
 'clinical_entries',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('facility_name',f.name) order by e.recorded_at,e.id) from public.clinical_entries e join public.facilities f on f.id=e.facility_id where e.child_id=p_child_id),'[]'::jsonb),
 'appointments',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('events',coalesce((select jsonb_agg(to_jsonb(e) order by e.revision) from public.appointment_events e where e.appointment_id=a.id),'[]'::jsonb)) order by a.created_at,a.id) from public.appointments a where a.child_id=p_child_id),'[]'::jsonb),
 'vaccine_items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('decisions',coalesce((select jsonb_agg(to_jsonb(v) order by v.revision) from public.vaccine_item_changes v where v.item_id=i.id),'[]'::jsonb)) order by i.created_at,i.id) from public.child_vaccine_items i where i.child_id=p_child_id),'[]'::jsonb)) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,p_child_id,'guardian_booklet_export','accessed');
 return result;
end;$$;

create function public.create_guardian_invitation(p_child_id uuid,p_recipient_email text,p_token_hash text,p_reason text) returns uuid language sql security invoker set search_path='' as $$select private.create_guardian_invitation(p_child_id,p_recipient_email,p_token_hash,p_reason);$$;
create function public.claim_guardian_invitation(p_operation_id uuid,p_token text,p_relationship text,p_consent boolean) returns uuid language sql security invoker set search_path='' as $$select private.claim_guardian_invitation(p_operation_id,p_token,p_relationship,p_consent);$$;
create function public.review_guardian_claim(p_operation_id uuid,p_claim_id uuid,p_expected_revision integer,p_decision text,p_relationship text,p_authority_reference text,p_reason text,p_identity_checked boolean,p_guardianship_checked boolean,p_expires_on date,p_can_export boolean) returns uuid language sql security invoker set search_path='' as $$select private.review_guardian_claim(p_operation_id,p_claim_id,p_expected_revision,p_decision,p_relationship,p_authority_reference,p_reason,p_identity_checked,p_guardianship_checked,p_expires_on,p_can_export);$$;
create function public.revoke_guardian_invitation(p_id uuid,p_reason text) returns void language sql security invoker set search_path='' as $$select private.revoke_guardian_invitation(p_id,p_reason);$$;
create function public.revoke_guardian_link(p_id uuid,p_reason text) returns void language sql security invoker set search_path='' as $$select private.revoke_guardian_link(p_id,p_reason);$$;
create function public.doctor_guardian_overview(p_child_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.doctor_guardian_overview(p_child_id);$$;
create function public.parent_child_booklet(p_child_id uuid,p_page integer default 1) returns jsonb language sql security invoker set search_path='' as $$select private.parent_child_booklet(p_child_id,p_page);$$;
create function public.parent_child_export(p_child_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.parent_child_export(p_child_id);$$;

revoke all on function private.create_guardian_invitation(uuid,text,text,text),public.create_guardian_invitation(uuid,text,text,text),
 private.claim_guardian_invitation(uuid,text,text,boolean),public.claim_guardian_invitation(uuid,text,text,boolean),
 private.review_guardian_claim(uuid,uuid,integer,text,text,text,text,boolean,boolean,date,boolean),public.review_guardian_claim(uuid,uuid,integer,text,text,text,text,boolean,boolean,date,boolean),
 private.revoke_guardian_invitation(uuid,text),public.revoke_guardian_invitation(uuid,text),private.revoke_guardian_link(uuid,text),public.revoke_guardian_link(uuid,text),
 private.doctor_guardian_overview(uuid),public.doctor_guardian_overview(uuid),private.parent_child_booklet(uuid,integer),public.parent_child_booklet(uuid,integer),private.parent_child_export(uuid),public.parent_child_export(uuid) from public,anon,authenticated;
grant execute on function private.create_guardian_invitation(uuid,text,text,text),public.create_guardian_invitation(uuid,text,text,text),
 private.claim_guardian_invitation(uuid,text,text,boolean),public.claim_guardian_invitation(uuid,text,text,boolean),
 private.review_guardian_claim(uuid,uuid,integer,text,text,text,text,boolean,boolean,date,boolean),public.review_guardian_claim(uuid,uuid,integer,text,text,text,text,boolean,boolean,date,boolean),
 private.revoke_guardian_invitation(uuid,text),public.revoke_guardian_invitation(uuid,text),private.revoke_guardian_link(uuid,text),public.revoke_guardian_link(uuid,text),
 private.doctor_guardian_overview(uuid),public.doctor_guardian_overview(uuid),private.parent_child_booklet(uuid,integer),public.parent_child_booklet(uuid,integer),private.parent_child_export(uuid),public.parent_child_export(uuid) to authenticated;

commit;
