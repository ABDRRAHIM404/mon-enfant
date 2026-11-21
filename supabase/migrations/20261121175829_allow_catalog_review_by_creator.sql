begin;

-- A qualified reviewer may approve a draft they created or edited.
create or replace function private.change_vaccine_catalog(p_operation_id uuid,p_action text,p_version_id uuid,p_expected_revision integer,p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare rights jsonb:=private.vaccine_catalog_permissions(); v public.vaccine_versions; result uuid; receipt private.operation_receipts;
 payload jsonb:=jsonb_build_object('action',p_action,'version',p_version_id,'revision',p_expected_revision,'input',p_input);
 reason text:=trim(p_input->>'reason'); evidence text:=trim(p_input->>'evidence_reference');
begin
 if p_action is null or p_action not in ('clone','edit','approve','retire') then raise exception 'Unknown catalog action' using errcode='22023'; end if;
 if not coalesce((rights->>(case when p_action='approve' then 'review' else 'manage' end))::boolean,false) then raise exception 'Explicit catalog permission required' using errcode='42501'; end if;
 if p_operation_id is null or p_input is null or jsonb_typeof(p_input)<>'object' or reason is null or length(reason) not between 10 and 1000 or evidence is null or length(evidence) not between 10 and 1000 then raise exception 'Operation, reason and evidence required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation_id::text,0));
 select * into receipt from private.operation_receipts where actor_id=auth.uid() and operation_id=p_operation_id;
 if found then
  if receipt.kind<>'vaccine_catalog' or receipt.payload is distinct from payload then raise exception 'Operation ID reused with different input' using errcode='22023'; end if;
  return receipt.result_id;
 end if;
 select * into v from public.vaccine_versions where id=p_version_id for update;
 if not found then raise exception 'Unknown catalog version' using errcode='22023'; end if;
 if p_expected_revision is distinct from v.revision then raise exception 'Stale catalog revision' using errcode='PT409'; end if;
 if p_action='clone' then
  if p_input->>'label' is null or length(trim(p_input->>'label')) not between 3 and 120 then raise exception 'Version label required' using errcode='22023'; end if;
  insert into public.vaccine_versions(source_id,parent_id,label,created_by) values(v.source_id,v.id,trim(p_input->>'label'),auth.uid()) returning id into result;
  insert into public.vaccine_rules select result,dose_code,vaccine_code,source_row,source_age,age,eligibility,automatic_scheduling from public.vaccine_rules where version_id=v.id;
 elsif p_action='edit' then
  if v.status<>'draft' then raise exception 'Draft version required' using errcode='42501'; end if;
  if p_input->>'dose_code' is null or p_input->'age' is null or p_input->>'eligibility' is null or jsonb_typeof(p_input->'automatic_scheduling') is distinct from 'boolean' then raise exception 'Complete rule required' using errcode='22023'; end if;
  update public.vaccine_rules set age=p_input->'age',eligibility=p_input->>'eligibility',automatic_scheduling=(p_input->>'automatic_scheduling')::boolean where version_id=v.id and dose_code=p_input->>'dose_code';
  if not found then raise exception 'Unknown source dose' using errcode='22023'; end if;
  update public.vaccine_versions set revision=revision+1 where id=v.id;
  result:=v.id;
 elsif p_action='approve' then
  if v.status<>'draft' then raise exception 'Draft version required' using errcode='42501'; end if;
  if p_input->'source_authenticated' is distinct from 'true'::jsonb or p_input->'clinical_reviewed' is distinct from 'true'::jsonb or p_input->'birth_window_reviewed' is distinct from 'true'::jsonb then raise exception 'Source, complete clinical review and birth-window interpretation required' using errcode='22023'; end if;
  if exists (
    select 1 from private.vaccine_sources s
    cross join lateral jsonb_array_elements(s.document->'schedule_2025') source_rule
    where s.id=v.source_id and not exists (
      select 1 from public.vaccine_rules r where r.version_id=v.id and r.dose_code=source_rule->>'dose_code'
    )
  ) then raise exception 'Complete source catalog required' using errcode='22023'; end if;
  update public.vaccine_versions set revision=revision+1,status='approved',reviewed_by=auth.uid(),reviewed_at=now(),review_reference=evidence,review_verified=true where id=v.id;
  result:=v.id;
 else
  if v.status='retired' then raise exception 'Version already retired' using errcode='PT409'; end if;
  update public.vaccine_versions set revision=revision+1,status='retired' where id=v.id;
  result:=v.id;
 end if;
 insert into public.vaccine_catalog_changes(version_id,actor_id,action,revision,reason,evidence_reference,snapshot)
 select result,auth.uid(),p_action,revision,reason,evidence,private.vaccine_version_snapshot(result) from public.vaccine_versions where id=result;
 insert into private.operation_receipts(actor_id,operation_id,kind,payload,result_id) values(auth.uid(),p_operation_id,'vaccine_catalog',payload,result);
 return result;
end;$$;

commit;
