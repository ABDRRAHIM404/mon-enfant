import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
export async function verificationDatabase() {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select '{"is_anonymous":false}'::jsonb $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;`);
  for (const file of [
    "20261113021114_foundation.sql",
    "20261113030711_professional_verification.sql",
  ])
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  return db;
}
export async function acting(db: PGlite, user: string, sql: string) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role");
  }
}

export async function registryDatabase() {
  const db = await verificationDatabase();
  await db.exec(`create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),not_after timestamptz);
    create or replace function auth.jwt() returns jsonb language sql stable as $$
      select jsonb_build_object('is_anonymous',false,'session_id',nullif(current_setting('request.jwt.claim.session_id',true),'')) $$;`);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261113042732_patient_registry.sql",
      "utf8",
    ),
  );
  return db;
}
export async function sessionActing(
  db: PGlite,
  user: string,
  session: string,
  sql: string,
  params: unknown[] = [],
) {
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.session_id',$2,false)",
    [user, session],
  );
  await db.exec("set role authenticated");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
export async function clinicalDatabase() {
  const db = await registryDatabase();
  await db.exec(
    readFileSync(
      "supabase/migrations/20261113045412_clinical_records.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261113051659_clinical_revision_conflict.sql",
      "utf8",
    ),
  );
  return db;
}

export async function vaccineDatabase() {
  const db = await clinicalDatabase();
  await db.exec(
    readFileSync(
      "supabase/migrations/20261113091129_vaccine_catalog.sql",
      "utf8",
    ),
  );
  return db;
}

export async function vaccinationDatabase() {
  const db = await vaccineDatabase();
  await db.exec(
    readFileSync(
      "supabase/migrations/20261113145142_vaccination_records.sql",
      "utf8",
    ),
  );
  return db;
}
