-- An expected-revision conflict is an HTTP 409, not a retryable serialization failure.
begin;
create or replace function private.write_clinical_entry(p_operation_id uuid,p_child_id uuid,p_kind text,p_facility_id uuid,p_occurred_on date,p_occurrence_precision text,p_source_type text,p_source_reference text,p_source_verified boolean,p_payload jsonb,p_root_id uuid default null,p_expected_revision integer default null,p_amendment_reason text default null,p_entry_state text default 'active') returns uuid
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
 if p_occurrence_precision is null or p_occurrence_precision not in ('exact','estimated','unknown') or (p_occurrence_precision='unknown')<>(p_occurred_on is null) or (p_occurred_on is not null and (p_occurred_on>(now() at time zone 'Africa/Casablanca')::date or p_occurred_on<date '1900-01-01' or (child.birth_date_precision='exact' and p_occurred_on<child.birth_date))) then raise exception 'Invalid occurrence date or certainty' using errcode='22023';end if;
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
commit;
