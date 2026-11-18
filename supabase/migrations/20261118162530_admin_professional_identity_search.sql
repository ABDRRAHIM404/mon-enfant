begin;

-- Presentation fields only: names never participate in authorization decisions.
-- This helper is internal; callers must pass through a guarded admin RPC.
create function private.search_professional_accounts(p_query text)
returns table(user_id uuid, role text, professional_id text,
  verification_status text, created_at timestamptz, email text, display_name text)
language sql stable security invoker set search_path='' as $$
  select identity.*
  from (
    select p.user_id, p.role::text, p.professional_id,
      p.verification_status::text, p.created_at, u.email::text,
      regexp_replace(coalesce(
        nullif(btrim(v.display_name), ''),
        nullif(btrim(u.raw_user_meta_data->>'display_name'), ''),
        nullif(btrim(concat_ws(' ',
          coalesce(u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'given_name'),
          coalesce(u.raw_user_meta_data->>'last_name', u.raw_user_meta_data->>'family_name'))), ''),
        nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
        nullif(btrim(u.raw_user_meta_data->>'name'), '')
      ), '[[:space:]]+', ' ', 'g') as display_name
    from public.professional_profiles p
    left join auth.users u on u.id=p.user_id
    left join lateral (
      select r.display_name from public.verification_requests r
      where r.professional_id=p.user_id and nullif(btrim(r.display_name), '') is not null
      order by (r.status='approved') desc, r.submitted_at desc, r.id desc limit 1
    ) v on true
    where p.role in ('doctor','nurse')
  ) identity
  where strpos(lower(concat_ws(' ', identity.professional_id, identity.email, identity.display_name)),
    lower(regexp_replace(btrim(p_query), '[[:space:]]+', ' ', 'g'))) > 0;
$$;
revoke all on function private.search_professional_accounts(text) from public, anon, authenticated;

create or replace function private.list_clinical_permissions(p_query text default '',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.can_manage_clinical_permissions() then
    raise exception 'Clinical permission manager required' using errcode='42501';
  end if;
  if p_query is null or length(p_query)>254 or p_page is null or p_page not between 1 and 10000 then
    raise exception 'Invalid filters' using errcode='22023';
  end if;
  with matches as materialized (
    select * from private.search_professional_accounts(p_query) where professional_id is not null
  ), page as (
    select * from matches order by professional_id, user_id limit 30 offset (p_page-1)*30
  )
  select jsonb_build_object('items', coalesce((
    select jsonb_agg(to_jsonb(p)||jsonb_build_object('capabilities', coalesce((
      select jsonb_agg(jsonb_build_object('capability',c.capability,'enabled',c.enabled,'expires_at',c.expires_at) order by c.capability)
      from public.professional_capabilities c where c.professional_id=p.user_id
    ),'[]'::jsonb)) order by p.professional_id,p.user_id) from page p
  ), '[]'::jsonb), 'total', (select count(*) from matches)) into result;
  return result;
end;
$$;

create function private.list_admin_professionals(p_query text default '',p_status text default 'all',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.can_review_professionals() then
    raise exception 'Professional reviewer required' using errcode='42501';
  end if;
  if p_query is null or length(p_query)>254 or p_page is null or p_page not between 1 and 10000
    or p_status is null or p_status not in ('all','unverified','under_review','approved','rejected','suspended') then
    raise exception 'Invalid filters' using errcode='22023';
  end if;
  with matches as materialized (
    select * from private.search_professional_accounts(p_query)
    where p_status='all' or verification_status=p_status
  ), page as (
    select * from matches order by created_at desc,user_id limit 20 offset (p_page-1)*20
  )
  select jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.user_id) from page p),'[]'::jsonb),
    'total',(select count(*) from matches)) into result;
  return result;
end;
$$;
create function public.list_admin_professionals(p_query text default '',p_status text default 'all',p_page integer default 1)
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.list_admin_professionals(p_query,p_status,p_page);
$$;
revoke all on function private.list_admin_professionals(text,text,integer),public.list_admin_professionals(text,text,integer)
  from public,anon,authenticated;
grant execute on function private.list_admin_professionals(text,text,integer),public.list_admin_professionals(text,text,integer)
  to authenticated;

commit;
