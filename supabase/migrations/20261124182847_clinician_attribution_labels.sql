begin;

-- A name is presentation data. Eligibility comes from the existing record scopes.
create function private.clinician_attribution_labels(
 p_keys text[], p_children uuid[], p_share uuid, p_catalog uuid, p_page integer
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); share_context private.clinician_shares; projection jsonb; result jsonb;
begin
 if not private.has_live_session() then
  raise exception 'Live professional session required' using errcode='42501';
 end if;
 if p_keys is null or cardinality(p_keys)>300
  or p_children is null or cardinality(p_children)>100
  or p_page is null or p_page not between 1 and 10000
  or exists(select 1 from unnest(p_keys) key where length(key)>128) then
  raise exception 'Invalid attribution scope' using errcode='22023';
 end if;
 if cardinality(p_children)>0 or p_share is not null then perform private.assert_doctor(); end if;
 if p_catalog is not null then perform private.assert_vaccine_catalog_reader(); end if;
 if p_share is not null then
  perform private.assert_parent_account();
  select * into share_context from private.clinician_shares where id=p_share;
  if not found or share_context.recipient_id is distinct from actor
   or share_context.recipient_session is distinct from (auth.jwt()->>'session_id')::uuid
   or share_context.consumed_at is null or share_context.revoked_at is not null or share_context.expires_at<=now()
   or not private.share_authority_current(share_context) or not private.share_recipient_current(share_context) then
   raise exception 'Share unavailable' using errcode='42501';
  end if;
  if share_context.scope='vaccination_read' then
   projection:=jsonb_build_array(private.share_reference_projection(share_context.child_id,p_page),
    private.share_vaccination_projection(share_context.child_id,p_page));
  elsif share_context.scope='booklet_read' then
   projection:=private.share_booklet_projection(share_context.child_id,null,p_page);
  else
   raise exception 'Share unavailable' using errcode='42501';
  end if;
 end if;

 with requested as materialized (
  select distinct k as lookup_key from unnest(p_keys) k
 ), allowed_children as materialized (
  select distinct child from unnest(p_children) child where private.can_access_child(child,false)
 ), share_keys as materialized (
  select distinct val #>> '{}' as lookup_key
  from jsonb_path_query(projection,'lax $.**.professional_id') val
 ), relevant as materialized (
  select key.lookup_key,p.user_id,p.role,p.verification_status
  from requested key
  join public.professional_profiles p on p.professional_id=key.lookup_key or p.user_id::text=key.lookup_key
  where p.role in ('doctor','nurse') and (
   p.user_id=actor
   or exists(select 1 from share_keys s where s.lookup_key=key.lookup_key)
   or (p_catalog is not null and (
    exists(select 1 from public.vaccine_versions v where v.id=p_catalog and v.reviewed_by=p.user_id)
    or exists(select 1 from public.vaccine_catalog_changes v where v.version_id=p_catalog and v.actor_id=p.user_id)
   ))
   or exists (
    select 1 from allowed_children a where
     exists(select 1 from public.clinical_entries e where e.child_id=a.child and e.author_id=p.user_id)
     or exists(select 1 from public.appointments r where r.child_id=a.child and
      (r.responsible_id=p.user_id or exists(select 1 from public.appointment_events e where e.appointment_id=r.id and e.actor_id=p.user_id)))
     or exists(select 1 from public.child_vaccine_items i where i.child_id=a.child and
      (i.assigned_by=p.user_id or exists(select 1 from public.vaccine_item_changes c where c.item_id=i.id and c.actor_id=p.user_id)))
     or exists(select 1 from public.children c where c.id=a.child and c.created_by=p.user_id)
     or (private.can_access_child(a.child,true) and (
      exists(select 1 from public.access_grants g where g.child_id=a.child and g.professional_id=p.user_id)
      or exists(select 1 from public.child_access_requests r where r.child_id=a.child and r.requester_id=p.user_id and r.status='pending')
     ))
   )
  )
 )
 select coalesce(jsonb_object_agg(r.lookup_key,jsonb_build_object(
  'name',v.display_name,'role',r.role,'verified',r.verification_status='approved'
 )),'{}'::jsonb) into result
 from relevant r
 join lateral (
  select left(regexp_replace(btrim(request.display_name),'[[:space:]]+',' ','g'),150) display_name
  from public.verification_requests request where request.professional_id=r.user_id
   and (request.status='approved' or r.user_id=actor) and btrim(request.display_name)<>''
  order by (request.status='approved') desc,request.submitted_at desc,request.id desc limit 1
 ) v on true;
 return result;
end;
$$;

create function public.clinician_attribution_labels(
 p_keys text[], p_children uuid[] default '{}', p_share uuid default null,
 p_catalog uuid default null, p_page integer default 1
) returns jsonb language sql security invoker set search_path='' as $$
 select private.clinician_attribution_labels(p_keys,p_children,p_share,p_catalog,p_page);
$$;
revoke all on function public.clinician_attribution_labels(text[],uuid[],uuid,uuid,integer),
 private.clinician_attribution_labels(text[],uuid[],uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.clinician_attribution_labels(text[],uuid[],uuid,uuid,integer),
 private.clinician_attribution_labels(text[],uuid[],uuid,uuid,integer) to authenticated;
commit;
