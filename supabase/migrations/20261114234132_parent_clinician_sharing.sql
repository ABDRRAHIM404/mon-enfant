begin;

-- Internal, non-executable projections share data code, never caller identities or authority.


create function private.share_child_projection(p_child_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 return (select jsonb_build_object('id',c.id,'universal_id',c.universal_id,'given_name',c.given_name,'family_name',c.family_name,'name_status',c.name_status,'birth_date',c.birth_date,'birth_date_precision',c.birth_date_precision,'sex',c.sex,'history_status',c.history_status) from public.children c where c.id=p_child_id);
end;$$;

create function private.share_appointment_projection(p_child_id uuid) returns setof jsonb
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
 where a.child_id=p_child_id;
$$;

create function private.share_booklet_projection(p_child_id uuid,p_guardian_id uuid,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;result jsonb;
begin
 actor:=p_guardian_id;
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid booklet page' using errcode='22023';end if;
 with current_entries as materialized(
  select e.*,f.name facility_name from public.clinical_entries e join public.facilities f on f.id=e.facility_id
 where e.child_id=p_child_id and e.entry_state='active' and not exists(select 1 from public.clinical_entries n where n.root_id=e.root_id and n.revision>e.revision)
 ),entries as(select * from current_entries order by recorded_at desc,id limit 30 offset (p_page-1)*30),
 growth as(select * from current_entries where kind='growth' order by occurred_on desc nulls last,recorded_at desc limit 60),
 appointments as materialized(select data from private.share_appointment_projection(p_child_id) r(data)),
 slots as(select data from appointments order by (data->>'starts_at')::timestamptz desc,data->>'id' limit 30 offset (p_page-1)*30)
 select jsonb_build_object(
 'child',(select jsonb_build_object('id',c.id,'universal_id',c.universal_id,'given_name',c.given_name,'family_name',c.family_name,'name_status',c.name_status,'birth_date',c.birth_date,'birth_date_precision',c.birth_date_precision,'sex',c.sex,'history_status',c.history_status) from public.children c where c.id=p_child_id),
 'link',(select jsonb_build_object('id',g.id,'relationship',g.relationship,'expires_at',g.expires_at,'can_export',g.can_export) from private.guardian_links g where g.child_id=p_child_id and g.guardian_id=actor and g.revoked_at is null and g.expires_at>now()),
 'entries',coalesce((select jsonb_agg(to_jsonb(e)||private.vaccination_metadata(e.id) order by e.recorded_at desc,e.id) from entries e),'[]'::jsonb),
 'growth',coalesce((select jsonb_agg(to_jsonb(g) order by g.occurred_on,g.recorded_at) from growth g),'[]'::jsonb),
 'appointments',coalesce((select jsonb_agg(data order by (data->>'starts_at')::timestamptz desc,data->>'id') from slots),'[]'::jsonb),
 'entry_total',(select count(*) from current_entries),'appointment_total',(select count(*) from appointments),'page',p_page) into result;
 return result;
end;$$;

create function private.share_reference_projection(p_child_id uuid,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare items jsonb;total bigint;child jsonb;
begin
 child:=private.share_child_projection(p_child_id);
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid item page' using errcode='22023';end if;
 select count(*) into total from public.child_vaccine_items where child_id=p_child_id;
 select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('version_status',v.status,'review_verified',v.review_verified,'version_label',v.label,'age',r.age,'source_age',r.source_age,'vaccine_code',r.vaccine_code,'eligibility',r.eligibility,'automatic_scheduling',r.automatic_scheduling,'state',c.state,'revision',c.revision,
  'documented_entries',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'root_id',e.root_id,'professional_id',e.professional_id,'occurred_on',e.occurred_on)) from public.vaccination_entry_links l join public.clinical_entries e on e.id=l.entry_id where l.item_id=i.id and e.entry_state='active' and not exists(select 1 from public.clinical_entries newer where newer.root_id=e.root_id and newer.revision>e.revision)),'[]'::jsonb)) order by i.created_at,i.id),'[]'::jsonb) into items
 from (select * from public.child_vaccine_items where child_id=p_child_id order by created_at,id limit 20 offset (p_page-1)*20) i
 join public.vaccine_versions v on v.id=i.version_id join public.vaccine_rules r on r.version_id=i.version_id and r.dose_code=i.dose_code
 join lateral (select * from public.vaccine_item_changes where item_id=i.id order by revision desc limit 1) c on true;
 return jsonb_build_object('child',child,'items',items,'total',total,'page',p_page);
end;$$;

create function private.share_vaccination_projection(p_child_id uuid,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare child jsonb;result jsonb;
begin
 child:=private.share_child_projection(p_child_id);
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid history page' using errcode='22023';end if;
 with current_entries as materialized (
  select e.*,f.name facility_name from public.clinical_entries e join public.facilities f on f.id=e.facility_id
  where e.child_id=p_child_id and e.kind='vaccination' and e.entry_state='active'
   and not exists(select 1 from public.clinical_entries n where n.root_id=e.root_id and n.revision>e.revision)
 ), items as (select * from current_entries order by occurred_on desc nulls last,recorded_at desc,id limit 20 offset (p_page-1)*20)
 select jsonb_build_object('child',child,'items',coalesce((select jsonb_agg(to_jsonb(i)||private.vaccination_metadata(i.id) order by i.occurred_on desc nulls last,i.recorded_at desc,i.id) from items i),'[]'::jsonb),'total',(select count(*) from current_entries),'page',p_page) into result;
 return result;
end;$$;

revoke all on function private.share_child_projection(uuid),private.share_appointment_projection(uuid),private.share_booklet_projection(uuid,uuid,integer),private.share_reference_projection(uuid,integer),private.share_vaccination_projection(uuid,integer) from public,anon,authenticated;

create or replace function private.parent_child_booklet(p_child_id uuid,p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;actor uuid;
begin
 actor:=private.assert_parent_account();
 if not private.can_access_as_guardian(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 result:=private.share_booklet_projection(p_child_id,actor,p_page);
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,p_child_id,'guardian_booklet_read','accessed');return result;
end;$$;
create or replace function private.parent_vaccine_items(p_child_id uuid,p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.parent_child_header(p_child_id);
 result:=private.share_reference_projection(p_child_id,p_page);
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'guardian_vaccine_references_read','accessed');return result;
end;$$;
create or replace function private.parent_vaccination_history(p_child_id uuid,p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.parent_child_header(p_child_id);
 result:=private.share_vaccination_projection(p_child_id,p_page);
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'guardian_booklet_read','accessed');return result;
end;$$;

create table private.clinician_shares (
 id uuid primary key default gen_random_uuid(),child_id uuid not null references public.children(id),
 guardian_id uuid not null references private.guardian_profiles(user_id),guardian_link_id uuid not null references private.guardian_links(id),issuer_session uuid not null,
 token_hash text not null unique check(token_hash~'^[0-9a-f]{64}$'),
 scope text not null check(scope in ('vaccination_read','booklet_read')),
 created_at timestamptz not null default now(),expires_at timestamptz not null,
 consumed_at timestamptz,recipient_id uuid references public.professional_profiles(user_id),recipient_session uuid,professional_id text,
 revoked_at timestamptz,
 check(expires_at>created_at and expires_at<=created_at+interval '5 minutes'),
 check((consumed_at is null and recipient_id is null and recipient_session is null and professional_id is null) or
       (consumed_at is not null and recipient_id is not null and recipient_session is not null and professional_id is not null))
);
create index clinician_shares_owner_idx on private.clinician_shares(guardian_id,child_id,created_at desc);
create table private.clinician_share_attempts (
 id uuid primary key default gen_random_uuid(),actor_id uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index clinician_share_attempts_actor_idx on private.clinician_share_attempts(actor_id,created_at);
alter table private.clinician_shares enable row level security;
alter table private.clinician_share_attempts enable row level security;
revoke all on private.clinician_shares,private.clinician_share_attempts from public,anon,authenticated;
create trigger clinician_share_attempts_immutable before update or delete on private.clinician_share_attempts for each row execute function private.prevent_mutation();

create function private.guard_clinician_share_facts() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Share history is retained' using errcode='42501';end if;
 if row(new.id,new.child_id,new.guardian_id,new.guardian_link_id,new.issuer_session,new.token_hash,new.scope,new.created_at,new.expires_at) is distinct from row(old.id,old.child_id,old.guardian_id,old.guardian_link_id,old.issuer_session,old.token_hash,old.scope,old.created_at,old.expires_at)
 or (old.consumed_at is not null and row(new.consumed_at,new.recipient_id,new.recipient_session,new.professional_id) is distinct from row(old.consumed_at,old.recipient_id,old.recipient_session,old.professional_id))
 or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) then raise exception 'Share facts are immutable' using errcode='42501';end if;
 return new;
end;$$;
revoke all on function private.guard_clinician_share_facts() from public,anon,authenticated;
create trigger clinician_share_facts before update or delete on private.clinician_shares for each row execute function private.guard_clinician_share_facts();

create function private.share_authority_current(p_share private.clinician_shares) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.guardian_links g join auth.users u on u.id=g.guardian_id join auth.sessions s on s.user_id=u.id and s.id=(p_share).issuer_session
 where g.id=(p_share).guardian_link_id and g.child_id=(p_share).child_id and g.guardian_id=(p_share).guardian_id and g.can_export and g.revoked_at is null and g.expires_at>now()
 and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now()) and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function private.share_authority_current(private.clinician_shares) from public,anon,authenticated;

create function private.share_recipient_current(p_share private.clinician_shares) returns boolean language sql stable security definer set search_path='' as $$
 select (p_share).consumed_at is null or exists(select 1 from public.professional_profiles p join auth.users u on u.id=p.user_id join auth.sessions s on s.user_id=u.id and s.id=(p_share).recipient_session
 where p.user_id=(p_share).recipient_id and p.role in ('doctor','nurse') and p.verification_status='approved' and p.professional_id is not null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now()) and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function private.share_recipient_current(private.clinician_shares) from public,anon,authenticated;

create function private.issue_clinician_share(p_child_id uuid,p_scope text,p_consent boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;link private.guardian_links;secret text;item private.clinician_shares;
begin
 actor:=private.assert_parent_account();
 if not private.can_access_as_guardian(p_child_id,true) then raise exception 'Share authority required' using errcode='42501';end if;
 if p_consent is distinct from true or coalesce(p_scope,'') not in ('vaccination_read','booklet_read') then raise exception 'Explicit purpose and consent required' using errcode='22023';end if;
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

-- Failed guesses return a generic denied result so their rate-limit receipt commits instead of rolling back with an exception.
create function private.redeem_clinician_share(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
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
 select professional_id into platform from public.professional_profiles where user_id=actor;
 update private.clinician_shares set consumed_at=now(),recipient_id=actor,recipient_session=(auth.jwt()->>'session_id')::uuid,professional_id=platform where id=item.id;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,item.child_id,'guardian_share_redeemed','accessed');
 return jsonb_build_object('accepted',true,'id',item.id,'scope',item.scope,'expires_at',item.expires_at,'server_now',now());
end;$$;

create function private.read_clinician_share(p_share_id uuid,p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;item private.clinician_shares;data jsonb;
begin
 actor:=private.assert_doctor();
 perform private.assert_parent_account(); -- Confirmed active Auth account; this does not confer parent/guardian rights.
 select * into item from private.clinician_shares where id=p_share_id;
 if not found or item.recipient_id is distinct from actor or item.recipient_session is distinct from (auth.jwt()->>'session_id')::uuid or item.consumed_at is null or item.revoked_at is not null or item.expires_at<=now() or not private.share_authority_current(item) or not private.share_recipient_current(item) then raise exception 'Share unavailable' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid share page' using errcode='22023';end if;
 if item.scope='vaccination_read' then data:=jsonb_build_object('references',private.share_reference_projection(item.child_id,p_page),'history',private.share_vaccination_projection(item.child_id,p_page));
 elsif item.scope='booklet_read' then data:=private.share_booklet_projection(item.child_id,null,p_page)-'link';
 else raise exception 'Share unavailable' using errcode='42501';end if;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,item.child_id,'guardian_share_read','accessed');
 return jsonb_build_object('id',item.id,'scope',item.scope,'expires_at',item.expires_at,'server_now',now(),'professional_id',item.professional_id,'data',data);
end;$$;

create function private.list_clinician_shares(p_child_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;result jsonb;
begin
 actor:=private.assert_parent_account();
 if not private.can_access_as_guardian(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'scope',s.scope,'expires_at',s.expires_at,'professional_id',s.professional_id,'consumed_at',s.consumed_at,'revoked_at',s.revoked_at,'active',s.expires_at>now() and s.revoked_at is null and private.share_authority_current(s) and private.share_recipient_current(s))), '[]'::jsonb) into result
 from (select * from private.clinician_shares where child_id=p_child_id and guardian_id=actor order by created_at desc,id limit 20) s;
 return jsonb_build_object('items',result,'can_share',private.can_access_as_guardian(p_child_id,true),'server_now',now());
end;$$;

create function private.revoke_clinician_share(p_share_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid;item private.clinician_shares;
begin
 actor:=private.assert_parent_account();select * into item from private.clinician_shares where id=p_share_id for update;
 if not found or item.guardian_id is distinct from actor then raise exception 'Share unavailable' using errcode='42501';end if;
 if item.revoked_at is null then
  update private.clinician_shares set revoked_at=now() where id=item.id;
  insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,item.child_id,'guardian_share_revoked','updated');
 end if;
end;$$;

create function public.issue_clinician_share(p_child_id uuid,p_scope text,p_consent boolean) returns jsonb language sql security invoker set search_path='' as $$select private.issue_clinician_share(p_child_id,p_scope,p_consent);$$;
create function public.redeem_clinician_share(p_token text) returns jsonb language sql security invoker set search_path='' as $$select private.redeem_clinician_share(p_token);$$;
create function public.read_clinician_share(p_share_id uuid,p_page integer default 1) returns jsonb language sql security invoker set search_path='' as $$select private.read_clinician_share(p_share_id,p_page);$$;
create function public.list_clinician_shares(p_child_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.list_clinician_shares(p_child_id);$$;
create function public.revoke_clinician_share(p_share_id uuid) returns void language sql security invoker set search_path='' as $$select private.revoke_clinician_share(p_share_id);$$;
revoke all on function private.issue_clinician_share(uuid,text,boolean),public.issue_clinician_share(uuid,text,boolean),private.redeem_clinician_share(text),public.redeem_clinician_share(text),private.read_clinician_share(uuid,integer),public.read_clinician_share(uuid,integer),private.list_clinician_shares(uuid),public.list_clinician_shares(uuid),private.revoke_clinician_share(uuid),public.revoke_clinician_share(uuid) from public,anon,authenticated;
grant execute on function private.issue_clinician_share(uuid,text,boolean),public.issue_clinician_share(uuid,text,boolean),private.redeem_clinician_share(text),public.redeem_clinician_share(text),private.read_clinician_share(uuid,integer),public.read_clinician_share(uuid,integer),private.list_clinician_shares(uuid),public.list_clinician_shares(uuid),private.revoke_clinician_share(uuid),public.revoke_clinician_share(uuid) to authenticated;


create or replace function private.parent_access_history(p_child_id uuid,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;since_at timestamptz;result jsonb;
begin
 actor:=private.assert_parent_account();
 if not private.can_access_as_guardian(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid access history page' using errcode='22023';end if;
 select created_at into since_at from private.guardian_links where child_id=p_child_id and guardian_id=actor and revoked_at is null and expires_at>now();
 with visible as materialized(
  select a.id,a.occurred_at,a.entity_type,a.action,case when a.actor_id=actor then 'self' when p.role in ('doctor','nurse') and a.entity_type<>all(array['guardian_booklet_read','guardian_booklet_export','guardian_child_list_read','guardian_access_history_read','parent_correction_requested','parent_correction_responded','parent_requests_read','guardian_notifications_read','guardian_calendar_read','guardian_vaccine_references_read','guardian_share_issued','guardian_share_revoked']) then 'professional' else 'guardian' end actor_type,
   case when p.role in ('doctor','nurse') and a.entity_type<>all(array['guardian_booklet_read','guardian_booklet_export','guardian_child_list_read','guardian_access_history_read','parent_correction_requested','parent_correction_responded','parent_requests_read','guardian_notifications_read','guardian_calendar_read','guardian_vaccine_references_read','guardian_share_issued','guardian_share_revoked']) then p.professional_id else null end professional_id
  from public.audit_events a left join public.professional_profiles p on p.user_id=a.actor_id
  where a.entity_id=p_child_id and a.occurred_at>=since_at and a.entity_type=any(array['child_profile_read','clinical_timeline_read','clinical_history_read','clinical_export','vaccine_items_read','vaccine_item_history_read','vaccine_items_export','vaccination_duplicate_check','patient_appointments_read','appointment_history_read','appointments_export','appointment_calendar_read','appointment_worklist_read','vaccine_followup_read','patient_visit_overview_read','appointment_item_options_read','guardian_booklet_read','guardian_booklet_export','guardian_child_list_read','guardian_management_read','parent_correction_requested','parent_correction_responded','parent_requests_read','doctor_parent_requests_read','guardian_access_history_read','child_lookup_read','guardian_notifications_read','guardian_calendar_read','guardian_vaccine_references_read','guardian_share_issued','guardian_share_revoked','guardian_share_redeemed','guardian_share_read'])
 ),items as(select * from visible order by occurred_at desc,id limit 50 offset (p_page-1)*50)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i) order by i.occurred_at desc,i.id) from items i),'[]'::jsonb),'total',(select count(*) from visible),'page',p_page,'since',since_at) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,p_child_id,'guardian_access_history_read','accessed');
 return result;
end;$$;

commit;
