begin;

create function private.registration_identity_normal(p_value text) returns text
language sql immutable set search_path='' as $$select nullif(lower(regexp_replace(normalize(trim(p_value),NFKC),'[[:space:]]+',' ','g')),'');$$;
revoke all on function private.registration_identity_normal(text) from public,anon,authenticated;
create index children_registration_match_idx on public.children(birth_date,sex,private.registration_identity_normal(family_name),private.registration_identity_normal(given_name));
alter table public.doctor_patient_registry add column smi_reference text check(smi_reference is null or length(smi_reference) between 1 and 100);

-- Comparison details stay private; SMI is never an identity key or search predicate.
create table private.child_duplicate_identity (
 child_id uuid primary key references public.children(id),mother_name text,birthplace text,
 recorded_by uuid not null references public.professional_profiles(user_id),created_at timestamptz not null default now(),
 check(mother_name is null or length(trim(mother_name)) between 2 and 200),
 check(birthplace is null or length(trim(birthplace)) between 2 and 200)
);
create table private.registration_cases (
 actor_id uuid not null references public.professional_profiles(user_id),operation_id uuid not null,
 payload jsonb not null,mother_name text,birthplace text,secondary_locked boolean not null default false,
 state text not null check(state in ('ready','needs_details','need_qr','needs_review','committed')),
 candidate_ids uuid[] not null default '{}',truncated boolean not null default false,
 revision integer not null default 1,reviewed_revision integer,child_id uuid references public.children(id),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 minutes',
 primary key(actor_id,operation_id),check(expires_at>created_at)
);
create table private.registration_probe_events (
 id uuid primary key default gen_random_uuid(),actor_id uuid not null references public.professional_profiles(user_id),
 operation_id uuid not null,kind text not null check(kind in ('checked','secondary','review_requested','reviewed','committed','rate_limited')),
 outcome text not null,created_at timestamptz not null default now()
);
create index registration_probes_actor_time_idx on private.registration_probe_events(actor_id,created_at desc);
create table private.registration_reviews (
 id uuid primary key default gen_random_uuid(),actor_id uuid not null,operation_id uuid not null,
 reviewer_id uuid not null references public.professional_profiles(user_id),revision integer not null,
 decision text not null check(decision in ('distinct','existing_qr','unresolved')),
 authority_reference text not null check(length(trim(authority_reference)) between 10 and 1000),
 reason text not null check(length(trim(reason)) between 10 and 1000),created_at timestamptz not null default now(),
 foreign key(actor_id,operation_id) references private.registration_cases(actor_id,operation_id),unique(actor_id,operation_id,revision)
);
create trigger duplicate_identity_immutable before update or delete on private.child_duplicate_identity for each row execute function private.prevent_mutation();
create trigger registration_reviews_immutable before update or delete on private.registration_reviews for each row execute function private.prevent_mutation();
create trigger registration_probes_immutable before update or delete on private.registration_probe_events for each row execute function private.prevent_mutation();
create trigger registration_cases_no_delete before delete on private.registration_cases for each row execute function private.prevent_mutation();
alter table private.child_duplicate_identity enable row level security;
alter table private.registration_cases enable row level security;
alter table private.registration_probe_events enable row level security;
alter table private.registration_reviews enable row level security;
revoke all on private.child_duplicate_identity,private.registration_cases,private.registration_probe_events,private.registration_reviews from public,anon,authenticated;

create function private.registration_candidates(p_payload jsonb,p_mother text,p_birthplace text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare ids uuid[];phase text:='ready';initial_complete boolean;
begin
 initial_complete:=coalesce(p_payload->>'name_status','confirmed')<>'unknown' and coalesce(p_payload->>'birth_date_precision','exact')='exact' and nullif(p_payload->>'birth_date','') is not null and p_payload->>'sex' in ('female','male');
 -- Unknown/estimated identity is preserved, never converted to invented dates.
 -- Provisional author-only records live outside public.children and are never probed.
 if not initial_complete then return jsonb_build_object('state','ready','ids','[]'::jsonb,'truncated',false,'checked',false);end if;
 select coalesce(array_agg(c.id),'{}'::uuid[]) into ids from(
  select c.id from public.children c where c.birth_date=(p_payload->>'birth_date')::date and c.birth_date_precision='exact' and c.sex=p_payload->>'sex'
   and ((private.registration_identity_normal(c.given_name)=private.registration_identity_normal(p_payload->>'given_name') and private.registration_identity_normal(c.family_name)=private.registration_identity_normal(p_payload->>'family_name'))
    or (private.registration_identity_normal(c.family_name)=private.registration_identity_normal(p_payload->>'family_name') and left(private.registration_identity_normal(c.given_name),3)=left(private.registration_identity_normal(p_payload->>'given_name'),3))
    or (private.registration_identity_normal(c.given_name)=private.registration_identity_normal(p_payload->>'given_name') and left(private.registration_identity_normal(c.family_name),3)=left(private.registration_identity_normal(p_payload->>'family_name'),3)))
  order by c.id limit 51)c;
 if cardinality(ids)>50 then phase:='needs_review';
 elsif cardinality(ids)>0 then
  if private.registration_identity_normal(p_mother) is null or private.registration_identity_normal(p_birthplace) is null then phase:='needs_details';
  elsif exists(select 1 from private.child_duplicate_identity d where d.child_id=any(ids) and private.registration_identity_normal(d.mother_name)=private.registration_identity_normal(p_mother) and private.registration_identity_normal(d.birthplace)=private.registration_identity_normal(p_birthplace)) then phase:='need_qr';
  elsif exists(select 1 from unnest(ids) i(id) left join private.child_duplicate_identity d on d.child_id=i.id where d.child_id is null or d.mother_name is null or d.birthplace is null or private.registration_identity_normal(d.mother_name)=private.registration_identity_normal(p_mother) or private.registration_identity_normal(d.birthplace)=private.registration_identity_normal(p_birthplace)) then phase:='needs_review';
  end if;
 end if;
 return jsonb_build_object('state',phase,'ids',to_jsonb(ids),'truncated',cardinality(ids)>50,'checked',true);
end;$$;
revoke all on function private.registration_candidates(jsonb,text,text) from public,anon,authenticated;

create function private.prepare_child_registration(p_operation_id uuid,p_payload jsonb,p_mother_name text default null,p_birthplace text default null,p_request_review boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;item private.registration_cases;comparison jsonb;mother text:=nullif(trim(p_mother_name),'');place text:=nullif(trim(p_birthplace),'');dob date;phase text;
begin
 actor:=private.assert_doctor();
 if p_operation_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>15000
  or exists(select 1 from jsonb_object_keys(p_payload) k where k<>all(array['facility_id','register_year','register_book','local_number','given_name','family_name','name_status','birth_date','birth_date_precision','sex','history_status','source_type','paper_reference','provenance_note','guardian_name','guardian_phone','duplicate_override_reason','smi_reference']))
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

alter function private.register_child(uuid,jsonb) rename to register_child_before_duplicates;
revoke all on function private.register_child_before_duplicates(uuid,jsonb) from public,anon,authenticated;
create function private.register_child(p_operation_id uuid,p_payload jsonb) returns uuid
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
 base:=p_payload-'smi_reference';
 if item.reviewed_revision is not null and nullif(trim(base->>'duplicate_override_reason'),'') is null then base:=base||jsonb_build_object('duplicate_override_reason','Dossier distinct après revue contrôlée de l’opération '||p_operation_id::text);end if;
 result:=private.register_child_before_duplicates(p_operation_id,base);
 insert into private.child_duplicate_identity(child_id,mother_name,birthplace,recorded_by) values(result,item.mother_name,item.birthplace,actor);
 update public.doctor_patient_registry set smi_reference=nullif(trim(p_payload->>'smi_reference'),'') where child_id=result and professional_id=actor;
 update private.registration_cases set state='committed',child_id=result,revision=revision+1 where actor_id=actor and operation_id=p_operation_id;
 insert into private.registration_probe_events(actor_id,operation_id,kind,outcome) values(actor,p_operation_id,'committed','created_new_child');
 return result;
end;$$;
create or replace function public.register_child(p_operation_id uuid,p_payload jsonb) returns uuid language sql security invoker set search_path='' as $$select private.register_child(p_operation_id,p_payload);$$;
revoke all on function private.register_child(uuid,jsonb),public.register_child(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.register_child(uuid,jsonb),public.register_child(uuid,jsonb) to authenticated;

create function private.registration_review_queue(p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;result jsonb;
begin
 actor:=private.assert_doctor();if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid review page' using errcode='22023';end if;
 with visible as materialized(select c.* from private.registration_cases c where c.actor_id<>actor and c.state in ('needs_review','need_qr') and c.expires_at>now() and cardinality(c.candidate_ids)>0 and not c.truncated and not exists(select 1 from unnest(c.candidate_ids) i(id) where not private.can_access_child(i.id,true))),
 items as(select * from visible order by created_at,actor_id,operation_id limit 30 offset (p_page-1)*30)
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('actor_id',i.actor_id,'operation_id',i.operation_id,'revision',i.revision,'submitted',jsonb_build_object('given_name',i.payload->>'given_name','family_name',i.payload->>'family_name','birth_date',i.payload->>'birth_date','sex',i.payload->>'sex','mother_name',i.mother_name,'birthplace',i.birthplace),'authorized_candidates',i.candidate_ids,'expires_at',i.expires_at) order by i.created_at) from items i),'[]'::jsonb),'total',(select count(*) from visible),'page',p_page) into result;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,actor,'registration_review_queue','accessed');return result;
end;$$;
create function private.review_child_registration(p_actor_id uuid,p_operation_id uuid,p_expected_revision integer,p_decision text,p_authority_reference text,p_reason text,p_identity_checked boolean) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid;item private.registration_cases;
begin
 actor:=private.assert_doctor();select * into item from private.registration_cases where actor_id=p_actor_id and operation_id=p_operation_id for update;
 if item.actor_id is null or actor=item.actor_id or cardinality(item.candidate_ids)=0 or item.truncated or exists(select 1 from unnest(item.candidate_ids) i(id) where not private.can_access_child(i.id,true)) then raise exception 'Independent current candidate access manager required' using errcode='42501';end if;
 if item.revision is distinct from p_expected_revision or item.state not in ('needs_review','need_qr') or item.expires_at<=now() then raise exception 'Registration review changed or expired' using errcode='PT409';end if;
 if p_decision is null or p_decision not in ('distinct','existing_qr','unresolved') or p_identity_checked is distinct from true or p_authority_reference is null or length(trim(p_authority_reference)) not between 10 and 1000 or p_reason is null or length(trim(p_reason)) not between 10 and 1000 then raise exception 'Verified identity basis and reason required' using errcode='22023';end if;
 insert into private.registration_reviews(actor_id,operation_id,reviewer_id,revision,decision,authority_reference,reason) values(item.actor_id,item.operation_id,actor,item.revision,p_decision,trim(p_authority_reference),trim(p_reason));
 update private.registration_cases set state=case p_decision when 'distinct' then 'ready' when 'existing_qr' then 'need_qr' else 'needs_review' end,reviewed_revision=case when p_decision='distinct' then item.revision else null end,secondary_locked=true,revision=revision+1 where actor_id=item.actor_id and operation_id=item.operation_id;
 insert into private.registration_probe_events(actor_id,operation_id,kind,outcome) values(actor,item.operation_id,'reviewed',p_decision);
end;$$;

create function public.prepare_child_registration(p_operation_id uuid,p_payload jsonb,p_mother_name text default null,p_birthplace text default null,p_request_review boolean default false) returns jsonb language sql security invoker set search_path='' as $$select private.prepare_child_registration(p_operation_id,p_payload,p_mother_name,p_birthplace,p_request_review);$$;
create function public.registration_review_queue(p_page integer default 1) returns jsonb language sql security invoker set search_path='' as $$select private.registration_review_queue(p_page);$$;
create function public.review_child_registration(p_actor_id uuid,p_operation_id uuid,p_expected_revision integer,p_decision text,p_authority_reference text,p_reason text,p_identity_checked boolean) returns void language sql security invoker set search_path='' as $$select private.review_child_registration(p_actor_id,p_operation_id,p_expected_revision,p_decision,p_authority_reference,p_reason,p_identity_checked);$$;
revoke all on function private.prepare_child_registration(uuid,jsonb,text,text,boolean),public.prepare_child_registration(uuid,jsonb,text,text,boolean),private.registration_review_queue(integer),public.registration_review_queue(integer),private.review_child_registration(uuid,uuid,integer,text,text,text,boolean),public.review_child_registration(uuid,uuid,integer,text,text,text,boolean) from public,anon,authenticated;
grant execute on function private.prepare_child_registration(uuid,jsonb,text,text,boolean),public.prepare_child_registration(uuid,jsonb,text,text,boolean),private.registration_review_queue(integer),public.registration_review_queue(integer),private.review_child_registration(uuid,uuid,integer,text,text,text,boolean),public.review_child_registration(uuid,uuid,integer,text,text,text,boolean) to authenticated;


create function private.my_registration_cases(p_operation_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;result jsonb;
begin
 actor:=private.assert_doctor();
 select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('operation_id',c.operation_id,'payload',c.payload,'mother_name',c.mother_name,'birthplace',c.birthplace,'secondary_locked',c.secondary_locked,'state',c.state,'revision',c.revision,'expires_at',c.expires_at) order by c.created_at desc),'[]'::jsonb)) into result
 from(select * from private.registration_cases where actor_id=actor and state<>'committed' and (p_operation_id is null or operation_id=p_operation_id) order by created_at desc limit 30)c;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(actor,actor,'registration_case_read','accessed');return result;
end;$$;
create function private.finish_child_registration(p_operation_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid;body jsonb;
begin
 actor:=private.assert_doctor();select payload into body from private.registration_cases where actor_id=actor and operation_id=p_operation_id;
 if body is null then raise exception 'Own registration case required' using errcode='42501';end if;
 return private.register_child(p_operation_id,body);
end;$$;
create function public.my_registration_cases(p_operation_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.my_registration_cases(p_operation_id);$$;
create function public.finish_child_registration(p_operation_id uuid) returns uuid language sql security invoker set search_path='' as $$select private.finish_child_registration(p_operation_id);$$;
revoke all on function private.my_registration_cases(uuid),public.my_registration_cases(uuid),private.finish_child_registration(uuid),public.finish_child_registration(uuid) from public,anon,authenticated;
grant execute on function private.my_registration_cases(uuid),public.my_registration_cases(uuid),private.finish_child_registration(uuid),public.finish_child_registration(uuid) to authenticated;

create or replace function private.get_child_profile(p_child_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.can_access_child(p_child_id,false) then raise exception 'Child access denied' using errcode='42501'; end if;
  select to_jsonb(c)||jsonb_build_object('can_manage_access',private.can_access_child(c.id,true),'created_by_professional_id',p.professional_id,
    'registers',coalesce((select jsonb_agg(jsonb_build_object('facility_id',r.facility_id,'facility_name',f.name,'year',r.register_year,'book',r.register_book,'number',r.local_number,'smi_reference',r.smi_reference)) from public.doctor_patient_registry r join public.facilities f on f.id=r.facility_id where r.child_id=c.id and r.professional_id=auth.uid()),'[]'::jsonb))
    into result from public.children c join public.professional_profiles p on p.user_id=c.created_by where c.id=p_child_id;
  insert into public.audit_events(actor_id,entity_id,entity_type,action) values (auth.uid(),p_child_id,'child_profile_read','accessed');
  return result;
end;
$$;

commit;
