-- Read-only Phase 6 schema/ACL/Storage configuration review. No patient rows.
-- Fixed aggregate keys only; table/column privileges are both inspected.
with app_tables as (
  select c.* from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
), private_tables as (
  select c.* from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='private' and c.relkind in ('r','p')
), app_functions as (
  select p.* from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
), managed_functions as (
  select p.* from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','private')
)
select
  (select count(*)::integer from app_tables) public_table_count,
  (select count(*)::integer from app_tables where not relrowsecurity) public_tables_without_rls,
  (select count(*)::integer from app_tables where
    has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_any_column_privilege('anon',oid,'SELECT,INSERT,UPDATE,REFERENCES')) anonymous_table_or_column_access,
  (select count(*)::integer from app_tables where relname not in
    ('professional_profiles','professional_status_events','verification_requests','verification_decisions')
    and (has_table_privilege('authenticated',oid,'SELECT')
      or has_any_column_privilege('authenticated',oid,'SELECT'))) direct_clinical_read_grants,
  (select count(*)::integer from app_tables where
    has_table_privilege('authenticated',oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_any_column_privilege('authenticated',oid,'UPDATE,REFERENCES')
    or (relname<>'professional_profiles' and has_any_column_privilege('authenticated',oid,'INSERT')))
    unexpected_authenticated_write_grants,
  (select count(*)::integer from pg_attribute a where a.attrelid='public.professional_profiles'::regclass
    and a.attnum>0 and not a.attisdropped and a.attname<>'user_id'
    and has_column_privilege('authenticated',a.attrelid,a.attnum,'INSERT')) privileged_profile_insert_columns,
  has_column_privilege('authenticated','public.professional_profiles','user_id','INSERT') self_profile_id_insert,
  (select count(*)::integer from private_tables where
    has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_any_column_privilege('anon',oid,'SELECT,INSERT,UPDATE,REFERENCES')
    or has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_any_column_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,REFERENCES')) private_table_or_column_grants,
  (select count(*)::integer from app_functions where has_function_privilege('anon',oid,'EXECUTE')) anonymous_function_count,
  (select count(*)::integer from app_functions where has_function_privilege('anon',oid,'EXECUTE')
    and not (proname='operational_readiness' and pronargs=0 and not prosecdef and provolatile='s'))
    unexpected_anonymous_functions,
  (select count(*)::integer from managed_functions p where exists (
    select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where a.grantee=0 and a.privilege_type='EXECUTE')) public_default_execute_functions,
  (select count(*)::integer from managed_functions p where p.prosecdef and not exists (
    select 1 from unnest(p.proconfig) option where option like 'search_path=%')) definer_functions_without_search_path,
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('v','m')) public_view_count,
  (has_schema_privilege('anon','public','CREATE') or has_schema_privilege('authenticated','public','CREATE')
    or has_schema_privilege('anon','private','CREATE') or has_schema_privilege('authenticated','private','CREATE'))
    client_schema_create,
  has_schema_privilege('anon','private','USAGE') anonymous_private_schema_usage,
  (select count(*)::integer from pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls))
    client_rls_bypass_roles,
  (select relrowsecurity from pg_class where oid='storage.objects'::regclass) storage_objects_rls,
  (select count(*)::integer from storage.buckets where id='professional-evidence') evidence_bucket_count,
  (select not public and file_size_limit=4194304 and cardinality(allowed_mime_types)=3
    and allowed_mime_types @> array['application/pdf','image/jpeg','image/png']::text[]
    from storage.buckets where id='professional-evidence') evidence_bucket_contract;
