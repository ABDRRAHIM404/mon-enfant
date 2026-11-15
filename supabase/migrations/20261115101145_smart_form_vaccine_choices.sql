begin;
-- Bounded vocabulary only: no clinical records, source document, ages, approval rights or schedules.
create function private.vaccine_form_choices() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.assert_provisional_author();
 return coalesce((select jsonb_agg(jsonb_build_object('version_id',v.id,'version_label',v.label,'status',v.status,'vaccine_code',r.vaccine_code,'vaccine_label',coalesce(s.document#>>array['vaccines',r.vaccine_code,'label_fr'],r.vaccine_code),'dose_code',r.dose_code) order by v.status,v.label,r.vaccine_code,r.dose_code)
 from (select * from public.vaccine_versions where (status='approved' and review_verified) or (parent_id is null and status='draft') order by (status='approved') desc,created_at desc,id limit 20) v
 join public.vaccine_rules r on r.version_id=v.id join private.vaccine_sources s on s.id=v.source_id),'[]'::jsonb);
end;$$;
create function public.vaccine_form_choices() returns jsonb language sql stable security invoker set search_path='' as $$select private.vaccine_form_choices();$$;
revoke all on function private.vaccine_form_choices(),public.vaccine_form_choices() from public,anon,authenticated;
grant execute on function private.vaccine_form_choices(),public.vaccine_form_choices() to authenticated;

create or replace function private.write_provisional_entry(p_operation_id uuid,p_child_id uuid,p_kind text,p_occurred_on date,p_occurrence_precision text,p_source_type text,p_source_reference text,p_payload jsonb,p_root_id uuid default null,p_expected_revision integer default null,p_reason text default null,p_entry_state text default 'active') returns uuid language plpgsql security definer set search_path='' as $$
declare profile public.professional_profiles; prior private.provisional_entries; receipt private.provisional_entries; result uuid:=gen_random_uuid(); root uuid; rev integer:=1; key text; val jsonb;
begin
 profile:=private.assert_provisional_author();
 -- Check ownership BEFORE validating or probing entry IDs. Missing and foreign IDs have identical behavior.
 if not exists(select 1 from private.provisional_children where id=p_child_id and owner_id=profile.user_id) then raise exception 'Record unavailable' using errcode='42501';end if;
 if p_operation_id is null or p_kind is null or p_kind not in ('consultation','prescription','risk','growth','vaccination','appointment') or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>16000 or coalesce(p_occurrence_precision,'') not in ('exact','estimated','unknown') or coalesce(p_source_type,'') not in ('observed','paper_transcription','reported') or coalesce(p_entry_state,'') not in ('active','withdrawn') or length(coalesce(p_source_reference,''))>1000 then raise exception 'Invalid entry' using errcode='22023';end if;
 if (p_occurrence_precision='unknown')<>(p_occurred_on is null) or (p_kind<>'appointment' and p_occurred_on>current_date) then raise exception 'Invalid occurrence date' using errcode='22023';end if;
 if p_occurred_on<date '1900-01-01' or p_occurred_on>current_date+interval '10 years' then raise exception 'Invalid occurrence date' using errcode='22023';end if;
 if p_source_type='paper_transcription' and coalesce(length(trim(p_source_reference)),0)<3 then raise exception 'Paper source required' using errcode='22023';end if;
 if p_kind in ('consultation','prescription','risk','growth') then perform private.validate_clinical_payload(p_kind,p_payload);
 elsif p_kind='vaccination' then
  for key,val in select * from jsonb_each(p_payload) loop
   if key<>all(array['vaccine_label','dose_label','lot_number','site','administered_by','administration_facility','notes','catalog_version_id','catalog_status','vaccine_code','dose_code']) or jsonb_typeof(val)<>'string' or length(val#>>'{}')>2000 then raise exception 'Invalid vaccine details' using errcode='22023';end if;
  end loop;
  if coalesce(length(trim(p_payload->>'vaccine_label')),0) not between 1 and 200 or coalesce(length(trim(p_payload->>'dose_label')),0) not between 1 and 100 then raise exception 'Vaccine and dose required' using errcode='22023';end if;
  -- These fields describe vocabulary provenance only; the ledger remains quarantined.
  if p_payload ?| array['catalog_version_id','catalog_status','vaccine_code','dose_code'] then
   if not exists(select 1 from public.vaccine_versions v join public.vaccine_rules r on r.version_id=v.id join private.vaccine_sources s on s.id=v.source_id
    where v.id::text=p_payload->>'catalog_version_id' and v.status=p_payload->>'catalog_status'
    and ((v.status='approved' and v.review_verified) or (v.parent_id is null and v.status='draft'))
    and r.vaccine_code=p_payload->>'vaccine_code' and coalesce(s.document#>>array['vaccines',r.vaccine_code,'label_fr'],r.vaccine_code)=p_payload->>'vaccine_label'
    and (not p_payload ? 'dose_code' or (r.dose_code=p_payload->>'dose_code' and r.dose_code=p_payload->>'dose_label')))
   then raise exception 'Vaccine vocabulary changed or incompatible dose' using errcode='22023';end if;
  end if;
 else
  for key,val in select * from jsonb_each(p_payload) loop
   if key<>all(array['purpose','scheduled_for','status','notes']) or jsonb_typeof(val)<>'string' or length(val#>>'{}')>2000 then raise exception 'Invalid appointment details' using errcode='22023';end if;
  end loop;
  if coalesce(length(trim(p_payload->>'purpose')),0) not between 1 and 200 or coalesce(p_payload->>'status','') not in ('planned','completed','missed','cancelled','rescheduled') or coalesce(p_payload->>'scheduled_for','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$' then raise exception 'Appointment purpose, time and disposition required' using errcode='22023';end if;
  if (p_payload->>'scheduled_for')::timestamptz not between timestamptz '1900-01-01' and now()+interval '10 years' then raise exception 'Invalid scheduled time' using errcode='22023';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('provisional-entry:'||profile.user_id::text||p_operation_id::text,0));
 select * into receipt from private.provisional_entries where owner_id=profile.user_id and operation_id=p_operation_id;
 if found then
  if receipt.child_id<>p_child_id or receipt.kind<>p_kind or receipt.occurred_on is distinct from p_occurred_on or receipt.occurrence_precision<>p_occurrence_precision or receipt.source_type<>p_source_type or receipt.source_reference is distinct from nullif(trim(p_source_reference),'') or receipt.payload is distinct from p_payload or receipt.reason is distinct from nullif(trim(p_reason),'') or receipt.entry_state<>p_entry_state or (p_root_id is null and receipt.revision<>1) or (p_root_id is not null and (receipt.root_id<>p_root_id or receipt.revision<>coalesce(p_expected_revision,0)+1)) then raise exception 'Operation input changed' using errcode='22023';end if;
  return receipt.id;
 end if;
 if p_root_id is null then
  if p_expected_revision is not null or p_entry_state<>'active' then raise exception 'Invalid first revision' using errcode='22023';end if;
  root:=result;
 else
  perform pg_advisory_xact_lock(hashtextextended('provisional-root:'||p_root_id::text,0));
  select * into prior from private.provisional_entries where child_id=p_child_id and owner_id=profile.user_id and root_id=p_root_id order by revision desc limit 1;
  if not found then raise exception 'Record unavailable' using errcode='42501';end if;
  if prior.revision is distinct from p_expected_revision then raise exception 'Revision changed' using errcode='PT409';end if;
  if prior.kind<>p_kind or coalesce(length(trim(p_reason)),0) not between 10 and 1000 then raise exception 'Amendment reason required' using errcode='22023';end if;
  root:=prior.root_id;rev:=prior.revision+1;
 end if;
 insert into private.provisional_entries(id,child_id,owner_id,operation_id,root_id,previous_id,revision,kind,occurred_on,occurrence_precision,source_type,source_reference,payload,reason,entry_state,author_role,account_status)
 values(result,p_child_id,profile.user_id,p_operation_id,root,prior.id,rev,p_kind,p_occurred_on,p_occurrence_precision,p_source_type,nullif(trim(p_source_reference),''),p_payload,nullif(trim(p_reason),''),p_entry_state,profile.role,profile.verification_status);
 insert into private.provisional_audit(actor_id,child_id,action) values(profile.user_id,p_child_id,case when rev=1 then 'entry_created' else 'entry_revised' end);
 return result;
end;$$;
commit;
