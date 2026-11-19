create function private.set_clinical_capabilities(
  p_operation_id uuid,
  p_professional_id uuid,
  p_capabilities text[],
  p_enabled boolean,
  p_expires_at timestamptz,
  p_evidence_reference text,
  p_reason text,
  p_verified boolean
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  capabilities text[];
  capability text;
  receipt private.operation_receipts;
  payload jsonb;
begin
  if not private.can_manage_clinical_permissions() then
    raise exception 'Clinical permission manager required' using errcode = '42501';
  end if;
  if p_operation_id is null or p_capabilities is null
     or cardinality(p_capabilities) not between 1 and 6
     or (not p_enabled and cardinality(p_capabilities) <> 1) then
    raise exception 'Invalid capability selection' using errcode = '22023';
  end if;

  -- A consistent order prevents opposing batches from locking rows in different orders.
  select array_agg(distinct item order by item) into capabilities
    from unnest(p_capabilities) as selected(item);
  if cardinality(p_capabilities) <> cardinality(capabilities)
     or array_position(capabilities, null) is not null
     or not capabilities <@ array['consultation', 'prescription', 'risk', 'growth', 'vaccination', 'appointment'] then
    raise exception 'Invalid capability selection' using errcode = '22023';
  end if;

  payload := jsonb_build_object(
    'professional', p_professional_id, 'capabilities', capabilities,
    'enabled', p_enabled, 'expires_at', p_expires_at,
    'evidence', p_evidence_reference, 'reason', p_reason, 'verified', p_verified
  );
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_operation_id::text, 0));
  select * into receipt from private.operation_receipts
    where actor_id = auth.uid() and operation_id = p_operation_id;
  if found then
    if receipt.kind <> 'clinical_permission_batch' or receipt.payload is distinct from payload then
      raise exception 'Operation ID reused with different input' using errcode = '22023';
    end if;
    return receipt.result_id;
  end if;

  foreach capability in array capabilities loop
    perform private.set_clinical_capability(
      md5('clinical_permission_batch:' || p_operation_id::text || ':' || capability)::uuid,
      p_professional_id, capability, p_enabled, p_expires_at,
      p_evidence_reference, p_reason, p_verified
    );
  end loop;

  insert into private.operation_receipts (actor_id, operation_id, kind, payload, result_id)
    values (auth.uid(), p_operation_id, 'clinical_permission_batch', payload, p_professional_id);
  return p_professional_id;
end;
$$;

create function public.set_clinical_capabilities(
  p_operation_id uuid,
  p_professional_id uuid,
  p_capabilities text[],
  p_enabled boolean,
  p_expires_at timestamptz,
  p_evidence_reference text,
  p_reason text,
  p_verified boolean
) returns uuid
language sql security invoker set search_path = ''
as $$
  select private.set_clinical_capabilities(
    p_operation_id, p_professional_id, p_capabilities, p_enabled, p_expires_at,
    p_evidence_reference, p_reason, p_verified
  );
$$;

revoke execute on function private.set_clinical_capabilities(uuid, uuid, text[], boolean, timestamptz, text, text, boolean) from public, anon;
revoke execute on function public.set_clinical_capabilities(uuid, uuid, text[], boolean, timestamptz, text, text, boolean) from public, anon;
grant execute on function private.set_clinical_capabilities(uuid, uuid, text[], boolean, timestamptz, text, text, boolean) to authenticated;
grant execute on function public.set_clinical_capabilities(uuid, uuid, text[], boolean, timestamptz, text, text, boolean) to authenticated;
