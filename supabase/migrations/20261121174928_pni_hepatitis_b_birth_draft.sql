begin;

create or replace function private.guard_vaccine_rule() returns trigger
language plpgsql set search_path='' as $$
declare v public.vaccine_versions; original jsonb; n integer;
begin
 if tg_op='DELETE' then raise exception 'Catalog rules cannot be deleted' using errcode='42501'; end if;
 select * into v from public.vaccine_versions where id=new.version_id for update;
 if v.status is distinct from 'draft' then raise exception 'Published catalog content is immutable' using errcode='42501'; end if;
 if tg_op='UPDATE' and (new.version_id<>old.version_id or new.dose_code<>old.dose_code or new.vaccine_code<>old.vaccine_code or new.source_row<>old.source_row or new.source_age<>old.source_age) then raise exception 'Source mapping is immutable' using errcode='42501'; end if;
 select r into original from private.vaccine_sources s cross join lateral jsonb_array_elements(s.document->'schedule_2025') r where s.id=v.source_id and r->>'dose_code'=new.dose_code;
 if original is null or new.source_row is distinct from original or new.source_age is distinct from original->'source_age' or new.vaccine_code is distinct from original->>'vaccine_code' then raise exception 'Original source mapping required' using errcode='22023'; end if;
 if jsonb_typeof(new.age) is distinct from 'object' or new.age->>'unit' is null or new.age->>'unit' not in ('birth_24_hours','first_4_weeks','weeks','months','years') or (new.age-'unit'-'value')<>'{}'::jsonb then raise exception 'Invalid routine age' using errcode='22023'; end if;
 if new.age->>'unit' in ('birth_24_hours','first_4_weeks') then
  if new.age ? 'value' then raise exception 'Birth window has no exact age' using errcode='22023'; end if;
 else
  if jsonb_typeof(new.age->'value') is distinct from 'number' or (new.age->>'value') !~ '^[1-9][0-9]{0,3}$' then raise exception 'Integer routine age required' using errcode='22023'; end if;
  n:=(new.age->>'value')::integer;
  if n>(case new.age->>'unit' when 'years' then 20 when 'months' then 240 else 1040 end) then raise exception 'Routine age outside bounds' using errcode='22023'; end if;
 end if;
 if (new.dose_code in ('HB1','HBn') and (new.automatic_scheduling or new.age is distinct from original->'age'))
  or (new.dose_code <> 'HBn' and new.age->>'unit' = 'birth_24_hours')
  or (new.dose_code in ('BCG','VPO0') and new.age is distinct from '{"unit":"first_4_weeks"}'::jsonb)
  or (new.dose_code='HPV' and (new.age is distinct from '{"unit":"years","value":11}'::jsonb or new.eligibility<>'female'))
  or (new.dose_code<>'HPV' and new.eligibility<>'all')
  or (new.dose_code in ('Rota1','Rota2','Rota3') and new.age is distinct from original->'age') then raise exception 'Agreed HB1/birth-window/HPV/rotavirus constraint' using errcode='22023'; end if;
 return new;
end;$$;
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
  if v.created_by=auth.uid() or exists(select 1 from public.vaccine_catalog_changes where version_id=v.id and actor_id=auth.uid() and action in ('clone','edit')) then raise exception 'Independent clinical reviewer required' using errcode='42501'; end if;
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

-- Preserve the original source, versions and rules. Import a traceable, separate draft.
do $$
declare
  original private.vaccine_sources;
  revised jsonb;
  new_source uuid;
  draft_id constant uuid := '0c504568-7c67-49bb-b43b-c8382439a850';
  birth_age constant jsonb := '{"unit":"birth_24_hours"}';
  birth_rule jsonb;
begin
  select * into strict original from private.vaccine_sources
  where sha256='e232057f6eb9118c8b2963d26f627249215749b9fcb293949ef773c81e591028';
  birth_rule := jsonb_build_object(
    'dose_code','HBn','vaccine_code','HB','source_slide',73,
    'decision_id','PNI-HBN-HB1','age',birth_age,'source_age',birth_age,
    'condition','Dose monovalente à la naissance, dans les 24 heures. Si elle a été omise, le soignant vérifie le registre avant d’envisager HB1 avec le BCG.',
    'automatic_scheduling',false
  );
  revised := jsonb_set(original.document,'{schedule_2025}',
    (original.document->'schedule_2025') || jsonb_build_array(birth_rule));
  revised := jsonb_set(revised,'{usage,hepatitis_b_exception}',to_jsonb(
    'HBn and conditional HB1 are separate manual references. Neither generates dates or appointments.'::text
  ));
  revised := jsonb_set(revised,'{schedule_coverage,separate_HBn_birth_dose_row}',to_jsonb('included_manual'::text));
  revised := jsonb_set(revised,'{schedule_coverage,transcribed_dose_rows}','26'::jsonb);
  revised := revised || jsonb_build_object('catalogue_revision',jsonb_build_object(
      'base_transcription_sha256',original.sha256,
      'presentation_sha256','143e6e86a2d7457bd29deaa2896cf2b292f35ff671e86dac0474a109c79a44c5',
      'slides',jsonb_build_array(67,73)
    ));
  insert into private.vaccine_sources(sha256,document)
  values(encode(sha256(convert_to(revised::text,'UTF8')),'hex'),revised)
  returning id into new_source;
  insert into public.vaccine_versions(id,source_id,label)
  values(draft_id,new_source,'PNI 2025 — brouillon avec HBn et HB1');
  insert into public.vaccine_rules
    (version_id,dose_code,vaccine_code,source_row,source_age,age,eligibility,automatic_scheduling)
  select draft_id,r->>'dose_code',r->>'vaccine_code',r,r->'source_age',r->'age',
    case when r->>'dose_code'='HPV' then 'female' else 'all' end,
    r->>'dose_code' not in ('HBn','HB1')
  from jsonb_array_elements(revised->'schedule_2025') r;
end;
$$;

commit;
