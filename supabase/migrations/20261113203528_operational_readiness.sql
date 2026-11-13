begin;

-- A constant, read-only database round trip for operational readiness. It does
-- not inspect identities, clinical records, counts, settings or permissions.
create function public.operational_readiness() returns boolean
language sql stable parallel safe security invoker set search_path=''
as $$ select true; $$;

revoke all on function public.operational_readiness() from public,anon,authenticated;
grant execute on function public.operational_readiness() to anon,authenticated;

comment on function public.operational_readiness() is
  'Public constant readiness beacon; grants no access to application data.';

commit;
