begin;
create table public.child_vaccine_items (
 id uuid primary key default gen_random_uuid(),child_id uuid not null references public.children(id),
 version_id uuid not null,dose_code text not null,
 assigned_by uuid not null references public.professional_profiles(user_id),professional_id text not null,
 facility_id uuid not null references public.facilities(id),created_at timestamptz not null default now(),
 foreign key(version_id,dose_code) references public.vaccine_rules(version_id,dose_code),
 unique(child_id,version_id,dose_code)
);
create index child_vaccine_items_version_idx on public.child_vaccine_items(version_id,dose_code);
create index child_vaccine_items_actor_idx on public.child_vaccine_items(assigned_by);
create index child_vaccine_items_facility_idx on public.child_vaccine_items(facility_id);
create table public.vaccine_item_changes (
 id uuid primary key default gen_random_uuid(),item_id uuid not null references public.child_vaccine_items(id),
 revision integer not null check(revision>=1),state text not null check(state in ('active','withdrawn')),
 actor_id uuid not null references public.professional_profiles(user_id),professional_id text not null,
 facility_id uuid not null references public.facilities(id),reason text not null check(length(trim(reason)) between 10 and 1000),
 created_at timestamptz not null default now(),unique(item_id,revision)
);
create index vaccine_item_changes_actor_idx on public.vaccine_item_changes(actor_id);
create index vaccine_item_changes_facility_idx on public.vaccine_item_changes(facility_id);
create table public.vaccination_entry_links (
 entry_id uuid primary key references public.clinical_entries(id),item_id uuid not null references public.child_vaccine_items(id)
);
create index vaccination_entry_links_item_idx on public.vaccination_entry_links(item_id);
create table public.vaccination_duplicate_overrides (
 entry_id uuid primary key references public.clinical_entries(id),conflicting_entry_ids uuid[] not null check(cardinality(conflicting_entry_ids)>0),
 reason text not null check(length(trim(reason)) between 10 and 1000)
);
alter table public.child_vaccine_items enable row level security;
alter table public.vaccine_item_changes enable row level security;
alter table public.vaccination_entry_links enable row level security;
alter table public.vaccination_duplicate_overrides enable row level security;
revoke all on public.child_vaccine_items,public.vaccine_item_changes,public.vaccination_entry_links,public.vaccination_duplicate_overrides from public,anon,authenticated;
create trigger child_vaccine_items_immutable before update or delete on public.child_vaccine_items for each row execute function private.prevent_mutation();
create trigger vaccine_item_changes_immutable before update or delete on public.vaccine_item_changes for each row execute function private.prevent_mutation();
create trigger vaccination_entry_links_immutable before update or delete on public.vaccination_entry_links for each row execute function private.prevent_mutation();
create trigger vaccination_duplicate_overrides_immutable before update or delete on public.vaccination_duplicate_overrides for each row execute function private.prevent_mutation();
create trigger child_vaccine_items_audit after insert on public.child_vaccine_items for each row execute function private.audit_change();
create trigger vaccine_item_changes_audit after insert on public.vaccine_item_changes for each row execute function private.audit_change();

create function private.vaccine_item_active(p_item_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select state='active' from public.vaccine_item_changes where item_id=p_item_id order by revision desc limit 1),false);
$$;
create function private.assert_vaccine_item_rule(p_child_id uuid,p_version_id uuid,p_dose_code text) returns void
language plpgsql stable security definer set search_path='' as $$
declare rule public.vaccine_rules; version public.vaccine_versions; child public.children;
begin
 select * into version from public.vaccine_versions where id=p_version_id;
 select * into rule from public.vaccine_rules where version_id=p_version_id and dose_code=p_dose_code;
 select * into child from public.children where id=p_child_id;
 if version.status is distinct from 'approved' or not version.review_verified or rule.version_id is null or not rule.automatic_scheduling or rule.dose_code='HB1' then raise exception 'Approved routine rule required; HB1 remains disabled' using errcode='22023'; end if;
 if rule.eligibility='female' and child.sex is distinct from 'female' then raise exception 'Eligibility unknown or not established' using errcode='22023'; end if;
 if exists(select 1 from public.child_vaccine_items i where i.child_id=p_child_id and i.dose_code=p_dose_code and private.vaccine_item_active(i.id)) then raise exception 'An active item already exists for this dose' using errcode='PT409'; end if;
end;$$;
create function private.assign_vaccine_item(p_operation_id uuid,p_child_id uuid,p_version_id uuid,p_dose_code text,p_facility_id uuid,p_reason text,p_eligibility_checked boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; platform text; result uuid; payload jsonb:=jsonb_build_object('child',p_child_id,'version',p_version_id,'dose',p_dose_code,'facility',p_facility_id,'reason',p_reason,'eligibility_checked',p_eligibility_checked);
begin
 actor:=private.assert_doctor();perform pg_advisory_xact_lock(hashtextextended(p_child_id::text,0));
 if not private.can_access_child(p_child_id,false) or not private.has_clinical_capability('vaccination') then raise exception 'Vaccination capability and child access required' using errcode='42501'; end if;
 perform private.assert_facility(p_facility_id);
 result:=private.operation_result(p_operation_id,'vaccine_item',payload);if result is not null then return result;end if;
 if p_reason is null or length(trim(p_reason)) not between 10 and 1000 or p_eligibility_checked is distinct from true then raise exception 'Eligibility review and assignment reason required' using errcode='22023'; end if;
 perform 1 from public.vaccine_versions where id=p_version_id for share;
 perform private.assert_vaccine_item_rule(p_child_id,p_version_id,p_dose_code);
 if exists(select 1 from public.child_vaccine_items where child_id=p_child_id and version_id=p_version_id and dose_code=p_dose_code) then raise exception 'Existing item must be reviewed instead of duplicated' using errcode='PT409';end if;
 select professional_id into platform from public.professional_profiles where user_id=actor;
 insert into public.child_vaccine_items(child_id,version_id,dose_code,assigned_by,professional_id,facility_id) values(p_child_id,p_version_id,p_dose_code,actor,platform,p_facility_id) returning id into result;
 insert into public.vaccine_item_changes(item_id,revision,state,actor_id,professional_id,facility_id,reason) values(result,1,'active',actor,platform,p_facility_id,trim(p_reason));
 insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id) values(actor,p_operation_id,'vaccine_item',payload,result);return result;
end;$$;
create function private.change_vaccine_item(p_operation_id uuid,p_item_id uuid,p_expected_revision integer,p_state text,p_facility_id uuid,p_reason text,p_eligibility_checked boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; item public.child_vaccine_items; prior public.vaccine_item_changes; platform text; result uuid;
 payload jsonb:=jsonb_build_object('item',p_item_id,'revision',p_expected_revision,'state',p_state,'facility',p_facility_id,'reason',p_reason,'eligibility_checked',p_eligibility_checked);
begin
 actor:=private.assert_doctor();select * into item from public.child_vaccine_items where id=p_item_id;
 if not found then raise exception 'Vaccine item denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(item.child_id::text,0));
 if not private.can_access_child(item.child_id,false) or not private.has_clinical_capability('vaccination') then raise exception 'Vaccination capability and child access required' using errcode='42501';end if;
 perform private.assert_facility(p_facility_id);
 result:=private.operation_result(p_operation_id,'vaccine_item_change',payload);if result is not null then return result;end if;
 select * into prior from public.vaccine_item_changes where item_id=item.id order by revision desc limit 1;
 if p_expected_revision is distinct from prior.revision then raise exception 'Stale vaccine item revision' using errcode='PT409';end if;
 if p_state is null or p_state not in ('active','withdrawn') or p_state=prior.state or p_reason is null or length(trim(p_reason)) not between 10 and 1000 then raise exception 'New item state and reason required' using errcode='22023';end if;
 if p_state='active' then
  if p_eligibility_checked is distinct from true then raise exception 'Eligibility review required' using errcode='22023';end if;
  perform 1 from public.vaccine_versions where id=item.version_id for share;
  perform private.assert_vaccine_item_rule(item.child_id,item.version_id,item.dose_code);
 end if;
 select professional_id into platform from public.professional_profiles where user_id=actor;
 insert into public.vaccine_item_changes(item_id,revision,state,actor_id,professional_id,facility_id,reason) values(item.id,prior.revision+1,p_state,actor,platform,p_facility_id,trim(p_reason)) returning id into result;
 insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id) values(actor,p_operation_id,'vaccine_item_change',payload,result);return result;
end;$$;

create function private.validate_vaccination_payload(p_payload jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare key text; value jsonb; status_key text; value_key text;
 allowed text[]:=array['vaccine_code','vaccine_label','dose_label','lot_status','lot_number','site_status','site','provider_status','administered_by','administration_facility_status','administration_facility','matching_status','schedule_item_id','duplicate_override_reason','notes'];
begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>20000 or exists(select 1 from jsonb_object_keys(p_payload) k where k<>all(allowed)) then raise exception 'Invalid vaccination fields' using errcode='22023';end if;
 for key,value in select * from jsonb_each(p_payload) loop
  if jsonb_typeof(value)<>'string' or length(value#>>'{}')>(case key when 'notes' then 2000 when 'duplicate_override_reason' then 1000 else 200 end) then raise exception 'Invalid vaccination text' using errcode='22023';end if;
 end loop;
 if coalesce(p_payload->>'vaccine_code','') !~ '^[A-Za-z0-9_-]{1,32}$' or coalesce(length(trim(p_payload->>'vaccine_label')),0)<1 or coalesce(p_payload->>'matching_status','') not in ('unmatched','clinician_validated') then raise exception 'Vaccine identity and explicit matching state required' using errcode='22023';end if;
 for status_key,value_key in select * from (values('lot_status','lot_number'),('site_status','site'),('provider_status','administered_by'),('administration_facility_status','administration_facility')) x(a,b) loop
  if coalesce(p_payload->>status_key,'') not in ('known','unknown','not_applicable') or (status_key<>'lot_status' and p_payload->>status_key='not_applicable') or ((p_payload->>status_key='known')<>(coalesce(length(trim(p_payload->>value_key)),0)>0)) then raise exception 'Known/unknown lot, site, provider and facility must be explicit' using errcode='22023';end if;
 end loop;
 if (p_payload->>'matching_status'='unmatched' and coalesce(p_payload->>'schedule_item_id','')<>'') or (p_payload->>'matching_status'='clinician_validated' and coalesce(p_payload->>'schedule_item_id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') then raise exception 'Matching requires an exact intended item; uncertain entries remain unmatched' using errcode='22023';end if;
end;$$;

alter table public.clinical_entries drop constraint clinical_entries_kind_check;
alter table public.clinical_entries add constraint clinical_entries_kind_check check(kind in ('consultation','prescription','risk','growth','vaccination'));

create function private.vaccination_conflicts(p_child_id uuid,p_payload jsonb,p_occurred_on date,p_exclude_root uuid default null) returns uuid[]
language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(e.id order by e.id),'{}'::uuid[])
 from (select distinct on(root_id) * from public.clinical_entries where child_id=p_child_id and kind='vaccination' and root_id is distinct from p_exclude_root order by root_id,revision desc) e
 left join public.vaccination_entry_links link on link.entry_id=e.id
 left join public.child_vaccine_items old_item on old_item.id=link.item_id
 left join public.child_vaccine_items new_item on new_item.id=nullif(p_payload->>'schedule_item_id','')::uuid
 where e.entry_state='active' and upper(e.payload->>'vaccine_code')=upper(p_payload->>'vaccine_code')
 and (p_occurred_on is null or e.occurred_on is null or e.occurred_on=p_occurred_on
  or (coalesce(p_payload->>'dose_label','')<>'' and lower(trim(e.payload->>'dose_label'))=lower(trim(p_payload->>'dose_label')))
  or (new_item.id is not null and old_item.dose_code=new_item.dose_code));
$$;

-- Preserve the existing four-kind core behind the checked vaccination wrapper.
alter function private.write_clinical_entry(uuid,uuid,text,uuid,date,text,text,text,boolean,jsonb,uuid,integer,text,text) rename to write_clinical_entry_base;
revoke all on function private.write_clinical_entry_base(uuid,uuid,text,uuid,date,text,text,text,boolean,jsonb,uuid,integer,text,text) from public,anon,authenticated;

create function private.write_clinical_entry(p_operation_id uuid,p_child_id uuid,p_kind text,p_facility_id uuid,p_occurred_on date,p_occurrence_precision text,p_source_type text,p_source_reference text,p_source_verified boolean,p_payload jsonb,p_root_id uuid default null,p_expected_revision integer default null,p_amendment_reason text default null,p_entry_state text default 'active') returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; item public.child_vaccine_items; rule public.vaccine_rules; version public.vaccine_versions; prior public.clinical_entries; duplicates uuid[]; override_reason text;
 operation_payload jsonb:=jsonb_build_object('child',p_child_id,'kind',p_kind,'facility',p_facility_id,'occurred_on',p_occurred_on,'precision',p_occurrence_precision,'source',p_source_type,'reference',p_source_reference,'verified',p_source_verified,'payload',p_payload,'root',p_root_id,'revision',p_expected_revision,'reason',p_amendment_reason,'state',p_entry_state);
begin
 if p_kind is distinct from 'vaccination' then return private.write_clinical_entry_base(p_operation_id,p_child_id,p_kind,p_facility_id,p_occurred_on,p_occurrence_precision,p_source_type,p_source_reference,p_source_verified,p_payload,p_root_id,p_expected_revision,p_amendment_reason,p_entry_state);end if;
 perform private.assert_doctor();perform pg_advisory_xact_lock(hashtextextended(p_child_id::text,0));
 if not private.can_access_child(p_child_id,false) or not private.has_clinical_capability('vaccination') then raise exception 'Vaccination capability and child access required' using errcode='42501';end if;
 perform private.assert_facility(p_facility_id);
 result:=private.operation_result(p_operation_id,'clinical_entry',operation_payload);if result is not null then return result;end if;
 perform private.validate_vaccination_payload(p_payload);
 if p_root_id is not null then
  select * into prior from public.clinical_entries where root_id=p_root_id order by revision desc limit 1;
  if not found or prior.child_id<>p_child_id or prior.kind<>'vaccination' then raise exception 'Vaccination entry denied' using errcode='42501';end if;
  if p_expected_revision is distinct from prior.revision then raise exception 'Stale clinical revision' using errcode='PT409';end if;
 end if;
 if p_entry_state='withdrawn' and (prior.id is null or prior.payload is distinct from p_payload or prior.occurred_on is distinct from p_occurred_on or prior.occurrence_precision is distinct from p_occurrence_precision or prior.source_type is distinct from p_source_type or prior.source_reference is distinct from nullif(trim(p_source_reference),'') or prior.source_verified is distinct from p_source_verified) then raise exception 'Withdrawal retains the last clinical data and provenance' using errcode='22023';end if;
 if p_payload->>'matching_status'='clinician_validated' then
  select * into item from public.child_vaccine_items where id=(p_payload->>'schedule_item_id')::uuid;
  if not found or item.child_id<>p_child_id then raise exception 'Intended item denied' using errcode='42501';end if;
  select * into rule from public.vaccine_rules where version_id=item.version_id and dose_code=item.dose_code;
  select * into version from public.vaccine_versions where id=item.version_id;
  if upper(rule.vaccine_code) is distinct from upper(p_payload->>'vaccine_code') then raise exception 'Vaccine does not match the intended item' using errcode='22023';end if;
  if p_entry_state='withdrawn' then
   if prior.id is null or prior.payload is distinct from p_payload then raise exception 'Withdrawal must retain the last payload and mapping' using errcode='22023';end if;
  elsif not private.vaccine_item_active(item.id) or not version.review_verified or version.status not in ('approved','retired') or p_source_verified is distinct from true or p_occurrence_precision is distinct from 'exact' or p_occurred_on is null
   or (rule.eligibility='female' and not exists(select 1 from public.children where id=p_child_id and sex='female')) then raise exception 'Matching needs active intended item, exact date, verified source and eligibility' using errcode='22023';end if;
 end if;
 if p_entry_state='active' then
  duplicates:=private.vaccination_conflicts(p_child_id,p_payload,p_occurred_on,p_root_id);
  override_reason:=trim(p_payload->>'duplicate_override_reason');
  if cardinality(duplicates)>0 and (override_reason is null or length(override_reason) not between 10 and 1000) then raise exception 'Potential duplicate vaccination' using errcode='PT409',hint='vaccine_duplicate_review';end if;
 end if;
 result:=private.write_clinical_entry_base(p_operation_id,p_child_id,p_kind,p_facility_id,p_occurred_on,p_occurrence_precision,p_source_type,p_source_reference,p_source_verified,p_payload,p_root_id,p_expected_revision,p_amendment_reason,p_entry_state);
 if item.id is not null then insert into public.vaccination_entry_links(entry_id,item_id) values(result,item.id);end if;
 if cardinality(duplicates)>0 then insert into public.vaccination_duplicate_overrides(entry_id,conflicting_entry_ids,reason) values(result,duplicates,override_reason);end if;
 return result;
end;$$;

create function private.guard_vaccination_link() returns trigger
language plpgsql set search_path='' as $$
declare entry public.clinical_entries; item public.child_vaccine_items;
begin
 select * into entry from public.clinical_entries where id=new.entry_id;
 select * into item from public.child_vaccine_items where id=new.item_id;
 if entry.kind is distinct from 'vaccination' or item.child_id is distinct from entry.child_id or entry.payload->>'matching_status' is distinct from 'clinician_validated' or nullif(entry.payload->>'schedule_item_id','')::uuid is distinct from item.id then raise exception 'Vaccination mapping must identify the same child and intended item' using errcode='22023';end if;
 return new;
end;$$;
create trigger vaccination_link_guard before insert on public.vaccination_entry_links for each row execute function private.guard_vaccination_link();
create function private.guard_vaccination_override() returns trigger
language plpgsql set search_path='' as $$
declare entry public.clinical_entries;
begin
 select * into entry from public.clinical_entries where id=new.entry_id;
 if entry.kind is distinct from 'vaccination' or trim(entry.payload->>'duplicate_override_reason') is distinct from new.reason or exists(select 1 from unnest(new.conflicting_entry_ids) as ids(entry_id) left join public.clinical_entries e on e.id=ids.entry_id where e.id is null or e.child_id<>entry.child_id or e.kind<>'vaccination' or e.id=entry.id) then raise exception 'Duplicate review must retain the exact same-child conflict entries and reason' using errcode='22023';end if;
 return new;
end;$$;
create trigger vaccination_override_guard before insert on public.vaccination_duplicate_overrides for each row execute function private.guard_vaccination_override();

create function private.vaccination_metadata(p_entry_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('vaccine_mapping',(select jsonb_build_object('item_id',i.id,'version_id',i.version_id,'version_label',v.label,'dose_code',i.dose_code,'vaccine_code',r.vaccine_code,'source_age',r.source_age,'configured_age',r.age,'source_row',r.source_row) from public.vaccination_entry_links l join public.child_vaccine_items i on i.id=l.item_id join public.vaccine_versions v on v.id=i.version_id join public.vaccine_rules r on r.version_id=i.version_id and r.dose_code=i.dose_code where l.entry_id=p_entry_id),
 'duplicate_review',(select jsonb_build_object('conflicting_entry_ids',d.conflicting_entry_ids,'reason',d.reason) from public.vaccination_duplicate_overrides d where d.entry_id=p_entry_id));
$$;
create function private.patient_vaccine_items(p_child_id uuid,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare items jsonb;total bigint;
begin
 if not private.can_access_child(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid item page' using errcode='22023';end if;
 select count(*) into total from public.child_vaccine_items where child_id=p_child_id;
 select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('version_status',v.status,'review_verified',v.review_verified,'version_label',v.label,'age',r.age,'source_age',r.source_age,'vaccine_code',r.vaccine_code,'eligibility',r.eligibility,'automatic_scheduling',r.automatic_scheduling,'state',c.state,'revision',c.revision,
  'documented_entries',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'root_id',e.root_id,'professional_id',e.professional_id,'occurred_on',e.occurred_on)) from public.vaccination_entry_links l join public.clinical_entries e on e.id=l.entry_id where l.item_id=i.id and e.entry_state='active' and not exists(select 1 from public.clinical_entries newer where newer.root_id=e.root_id and newer.revision>e.revision)),'[]'::jsonb)) order by i.created_at,i.id),'[]'::jsonb) into items
 from (select * from public.child_vaccine_items where child_id=p_child_id order by created_at,id limit 20 offset (p_page-1)*20) i
 join public.vaccine_versions v on v.id=i.version_id join public.vaccine_rules r on r.version_id=i.version_id and r.dose_code=i.dose_code
 join lateral (select * from public.vaccine_item_changes where item_id=i.id order by revision desc limit 1) c on true;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'vaccine_items_read','accessed');
 return jsonb_build_object('items',items,'total',total,'page',p_page);
end;$$;
create function private.vaccine_item_history(p_child_id uuid,p_item_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.can_access_child(p_child_id,false) or not exists(select 1 from public.child_vaccine_items where id=p_item_id and child_id=p_child_id) then raise exception 'Vaccine item denied' using errcode='42501';end if;
 if (select count(*) from public.vaccine_item_changes where item_id=p_item_id)>5000 then raise exception 'Item history exceeds interactive limit' using errcode='54000';end if;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'vaccine_item_history_read','accessed');
 return coalesce((select jsonb_agg(to_jsonb(c) order by revision) from public.vaccine_item_changes c where item_id=p_item_id),'[]'::jsonb);
end;$$;
create function private.check_vaccination_duplicates(p_child_id uuid,p_payload jsonb,p_occurred_on date,p_exclude_root uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ids uuid[];
begin
 if not private.can_access_child(p_child_id,false) or not private.has_clinical_capability('vaccination') then raise exception 'Vaccination capability and child access required' using errcode='42501';end if;
 perform private.validate_vaccination_payload(p_payload);
 if coalesce(p_payload->>'schedule_item_id','')<>'' and not exists(select 1 from public.child_vaccine_items where id=(p_payload->>'schedule_item_id')::uuid and child_id=p_child_id) then raise exception 'Intended item denied' using errcode='42501';end if;
 ids:=private.vaccination_conflicts(p_child_id,p_payload,p_occurred_on,p_exclude_root);
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'vaccination_duplicate_check','accessed');
 return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'root_id',e.root_id,'professional_id',e.professional_id,'occurred_on',e.occurred_on,'vaccine_label',e.payload->>'vaccine_label','dose_label',e.payload->>'dose_label')) from public.clinical_entries e where e.id=any(ids)),'[]'::jsonb);
end;$$;

create function public.assign_vaccine_item(p_operation_id uuid,p_child_id uuid,p_version_id uuid,p_dose_code text,p_facility_id uuid,p_reason text,p_eligibility_checked boolean) returns uuid language sql security invoker set search_path='' as $$select private.assign_vaccine_item(p_operation_id,p_child_id,p_version_id,p_dose_code,p_facility_id,p_reason,p_eligibility_checked);$$;
create function public.change_vaccine_item(p_operation_id uuid,p_item_id uuid,p_expected_revision integer,p_state text,p_facility_id uuid,p_reason text,p_eligibility_checked boolean) returns uuid language sql security invoker set search_path='' as $$select private.change_vaccine_item(p_operation_id,p_item_id,p_expected_revision,p_state,p_facility_id,p_reason,p_eligibility_checked);$$;
create function public.patient_vaccine_items(p_child_id uuid,p_page integer default 1) returns jsonb language sql security invoker set search_path='' as $$select private.patient_vaccine_items(p_child_id,p_page);$$;
create function public.vaccine_item_history(p_child_id uuid,p_item_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.vaccine_item_history(p_child_id,p_item_id);$$;
create function public.check_vaccination_duplicates(p_child_id uuid,p_payload jsonb,p_occurred_on date,p_exclude_root uuid default null) returns jsonb language sql security invoker set search_path='' as $$select private.check_vaccination_duplicates(p_child_id,p_payload,p_occurred_on,p_exclude_root);$$;

-- Replacement of the existing validator/read wrappers is appended below.

create or replace function private.validate_clinical_payload(p_kind text,p_payload jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare keys text[]; key text; value jsonb; n numeric;
begin
 if p_kind='vaccination' then perform private.validate_vaccination_payload(p_payload);return;end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>20000 then raise exception 'Invalid clinical payload' using errcode='22023'; end if;
 keys:=case p_kind when 'consultation' then array['reason','findings','assessment','plan'] when 'prescription' then array['medication','instructions','duration'] when 'risk' then array['category','description','severity'] when 'growth' then array['weight_kg','height_cm','head_cm'] else null end;
 if keys is null or exists(select 1 from jsonb_object_keys(p_payload) k where k<>all(keys)) then raise exception 'Unsupported clinical fields' using errcode='22023'; end if;
 if p_kind='growth' then
  if p_payload='{}'::jsonb then raise exception 'At least one measurement required' using errcode='22023'; end if;
  for key,value in select * from jsonb_each(p_payload) loop
   if jsonb_typeof(value)<>'number' then raise exception 'Numeric measurements required' using errcode='22023'; end if;
   n:=value::text::numeric;
   if (key='weight_kg' and n not between 0.1 and 250) or (key='height_cm' and n not between 20 and 250) or (key='head_cm' and n not between 10 and 100) then raise exception 'Measurement outside input bounds' using errcode='22023'; end if;
  end loop;
 else
  for key,value in select * from jsonb_each(p_payload) loop
   if jsonb_typeof(value)<>'string' or length(value#>>'{}')>(case key when 'findings' then 8000 when 'assessment' then 4000 when 'plan' then 4000 when 'reason' then 1000 when 'medication' then 200 when 'duration' then 200 else 2000 end) then raise exception 'Invalid clinical text' using errcode='22023'; end if;
  end loop;
  if p_kind='consultation' and coalesce(length(trim(p_payload->>'reason')),0)<1 then raise exception 'Consultation reason required' using errcode='22023'; end if;
  if p_kind='prescription' and (coalesce(length(trim(p_payload->>'medication')),0)<1 or coalesce(length(trim(p_payload->>'instructions')),0)<1) then raise exception 'Medication and instructions required' using errcode='22023'; end if;
  if p_kind='risk' and (coalesce(length(trim(p_payload->>'description')),0)<1 or coalesce(p_payload->>'category','') not in ('allergy','medical','social','other') or coalesce(p_payload->>'severity','') not in ('unknown','low','moderate','high')) then raise exception 'Risk details required' using errcode='22023'; end if;
 end if;
end;$$;


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

create or replace function public.write_clinical_entry(p_operation_id uuid,p_child_id uuid,p_kind text,p_facility_id uuid,p_occurred_on date,p_occurrence_precision text,p_source_type text,p_source_reference text,p_source_verified boolean,p_payload jsonb,p_root_id uuid default null,p_expected_revision integer default null,p_amendment_reason text default null,p_entry_state text default 'active') returns uuid language sql security invoker set search_path='' as $$select private.write_clinical_entry(p_operation_id,p_child_id,p_kind,p_facility_id,p_occurred_on,p_occurrence_precision,p_source_type,p_source_reference,p_source_verified,p_payload,p_root_id,p_expected_revision,p_amendment_reason,p_entry_state);$$;

create or replace function private.clinical_timeline(p_child_id uuid,p_page integer default 1,p_kind text default 'all') returns jsonb
language plpgsql security definer set search_path='' as $$
declare items jsonb;total bigint;
begin
 if not private.can_access_child(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 10000 or p_kind is null or p_kind not in ('all','consultation','prescription','risk','growth','vaccination') then raise exception 'Invalid timeline filters' using errcode='22023';end if;
 select count(*) into total from public.clinical_entries e where e.child_id=p_child_id and e.revision=1 and (p_kind='all' or e.kind=p_kind);
 select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('facility_name',f.name)||private.vaccination_metadata(e.id) order by e.occurred_on desc nulls last,e.recorded_at desc,e.id),'[]'::jsonb) into items
 from (select latest.* from (select distinct on(root_id) * from public.clinical_entries where child_id=p_child_id and (p_kind='all' or kind=p_kind) order by root_id,revision desc) latest order by occurred_on desc nulls last,recorded_at desc,id limit 30 offset (p_page-1)*30) e join public.facilities f on f.id=e.facility_id;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'clinical_timeline_read','accessed');
 return jsonb_build_object('items',items,'total',total,'page',p_page);
end;$$;
create or replace function public.clinical_timeline(p_child_id uuid,p_page integer default 1,p_kind text default 'all') returns jsonb language sql security invoker set search_path='' as $$select private.clinical_timeline(p_child_id,p_page,p_kind);$$;
create or replace function private.clinical_entry_history(p_child_id uuid,p_root_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_access_child(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('facility_name',f.name)||private.vaccination_metadata(e.id) order by e.revision),'[]'::jsonb) into result from public.clinical_entries e join public.facilities f on f.id=e.facility_id where e.child_id=p_child_id and e.root_id=p_root_id;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'clinical_history_read','accessed');return result;
end;$$;
create or replace function public.clinical_entry_history(p_child_id uuid,p_root_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.clinical_entry_history(p_child_id,p_root_id);$$;
create or replace function private.clinical_export(p_child_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_access_child(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 if (select count(*) from public.clinical_entries where child_id=p_child_id)>5000 then raise exception 'Export exceeds interactive limit; use approved scoped export procedure' using errcode='54000';end if;
 select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('facility_name',f.name)||private.vaccination_metadata(e.id) order by e.root_id,e.revision),'[]'::jsonb) into result from public.clinical_entries e join public.facilities f on f.id=e.facility_id where e.child_id=p_child_id;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'clinical_export','accessed');return result;
end;$$;
create or replace function public.clinical_export(p_child_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.clinical_export(p_child_id);$$;



-- Complete intended-item history for authorized exports; never silently truncate.
create function private.vaccine_items_export(p_child_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_access_child(p_child_id,false) then raise exception 'Child access denied' using errcode='42501';end if;
 if (select count(*) from public.child_vaccine_items where child_id=p_child_id)>5000 or (select count(*) from public.vaccine_item_changes c join public.child_vaccine_items i on i.id=c.item_id where i.child_id=p_child_id)>5000 then raise exception 'Item export exceeds interactive limit' using errcode='54000';end if;
 select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('version_label',v.label,'version_status',v.status,'review_verified',v.review_verified,'rule',to_jsonb(r),'changes',(select jsonb_agg(to_jsonb(c) order by revision) from public.vaccine_item_changes c where c.item_id=i.id)) order by i.created_at,i.id),'[]'::jsonb) into result
 from public.child_vaccine_items i join public.vaccine_versions v on v.id=i.version_id join public.vaccine_rules r on r.version_id=i.version_id and r.dose_code=i.dose_code where i.child_id=p_child_id;
 insert into public.audit_events(actor_id,entity_id,entity_type,action) values(auth.uid(),p_child_id,'vaccine_items_export','accessed');
 return result;
end;$$;
create function public.vaccine_items_export(p_child_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.vaccine_items_export(p_child_id);$$;

do $$declare fn record;begin
 for fn in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname=any(array['vaccine_item_active','assert_vaccine_item_rule','assign_vaccine_item','change_vaccine_item','validate_vaccination_payload','vaccination_conflicts','write_clinical_entry','write_clinical_entry_base','guard_vaccination_link','guard_vaccination_override','vaccination_metadata','patient_vaccine_items','vaccine_item_history','check_vaccination_duplicates','vaccine_items_export']) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
  if fn.proname=any(array['assign_vaccine_item','change_vaccine_item','write_clinical_entry','patient_vaccine_items','vaccine_item_history','check_vaccination_duplicates','vaccine_items_export']) then execute format('grant execute on function %s to authenticated',fn.signature);end if;
 end loop;
end$$;
commit;
