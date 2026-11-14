import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { parentUpdatesDatabase } from "./helpers/database";

let db: PGlite;
const review = readFileSync("supabase/checks/security-baseline.sql", "utf8");
async function inspect() {
  return (await db.query<Record<string, unknown>>(review)).rows[0];
}
beforeAll(async () => {
  db = await parentUpdatesDatabase();
});
afterAll(async () => {
  await db?.close();
});

describe("read-only catalog review against actual migrated PostgreSQL", () => {
  it("detects a private definer with inherited PUBLIC execution", async () => {
    await db.exec(
      "begin; create function private.unsafe_fixture() returns boolean language sql security definer as $$ select true $$;",
    );
    try {
      const row = await inspect();
      expect(row.public_default_execute_functions).toBe(1);
      expect(row.definer_functions_without_search_path).toBe(1);
      expect(row.unexpected_anonymous_functions).toBe(0);
    } finally {
      await db.exec("rollback");
    }
  });
  it("detects private column privileges and client schema creation", async () => {
    await db.exec(
      "begin; grant select(can_review_professionals) on private.staff_permissions to authenticated; grant create on schema public to authenticated;",
    );
    try {
      const row = await inspect();
      expect(row.private_table_or_column_grants).toBe(1);
      expect(row.client_schema_create).toBe(true);
    } finally {
      await db.exec("rollback");
    }
  });
  it("recognizes the intentional profile column grant and constant anonymous beacon", async () => {
    const row = await inspect();
    expect(row.public_table_count).toBe(24);
    expect(row.self_profile_id_insert).toBe(true);
    expect(row.anonymous_function_count).toBe(1);
    expect(row.evidence_bucket_contract).toBe(true);
    for (const key of [
      "public_tables_without_rls",
      "anonymous_table_or_column_access",
      "direct_clinical_read_grants",
      "unexpected_authenticated_write_grants",
      "privileged_profile_insert_columns",
      "private_table_or_column_grants",
      "unexpected_anonymous_functions",
      "public_default_execute_functions",
      "definer_functions_without_search_path",
      "public_view_count",
      "client_rls_bypass_roles",
    ])
      expect(row[key], key).toBe(0);
    for (const key of [
      "client_schema_create",
      "anonymous_private_schema_usage",
    ])
      expect(row[key], key).toBe(false);
    expect(row.storage_objects_rls).toBe(true);
    expect(row.evidence_bucket_count).toBe(1);
  });
  it("detects column-only anonymous clinical reads and privileged profile writes", async () => {
    await db.exec(
      "begin; grant select(given_name) on public.children to anon; grant insert(role) on public.professional_profiles to authenticated;",
    );
    try {
      const row = await inspect();
      expect(row.anonymous_table_or_column_access).toBe(1);
      expect(row.privileged_profile_insert_columns).toBe(1);
    } finally {
      await db.exec("rollback");
    }
  });
  it("detects column-only authenticated clinical reads and disabled RLS", async () => {
    await db.exec(
      "begin; grant select(given_name) on public.children to authenticated; alter table public.children disable row level security;",
    );
    try {
      const row = await inspect();
      expect(row.direct_clinical_read_grants).toBe(1);
      expect(row.public_tables_without_rls).toBe(1);
    } finally {
      await db.exec("rollback");
    }
  });
  it("detects a newly default-public definer and public evidence bucket", async () => {
    await db.exec(
      "begin; create function public.unsafe_fixture() returns boolean language sql security definer as $$ select true $$; update storage.buckets set public=true where id='professional-evidence';",
    );
    try {
      const row = await inspect();
      expect(row.unexpected_anonymous_functions).toBe(1);
      expect(row.public_default_execute_functions).toBe(1);
      expect(row.definer_functions_without_search_path).toBe(1);
      expect(row.evidence_bucket_contract).toBe(false);
    } finally {
      await db.exec("rollback");
    }
  });
});
