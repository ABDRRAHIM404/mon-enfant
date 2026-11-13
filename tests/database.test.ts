import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
let db: PGlite;
const ids = {
  doctor: "10000000-0000-4000-8000-000000000001",
  other: "10000000-0000-4000-8000-000000000002",
  pending: "10000000-0000-4000-8000-000000000003",
  admin: "10000000-0000-4000-8000-000000000004",
  fresh: "10000000-0000-4000-8000-000000000005",
  suspended: "10000000-0000-4000-8000-000000000006",
  child: "20000000-0000-4000-8000-000000000001",
  hidden: "20000000-0000-4000-8000-000000000002",
  facility: "30000000-0000-4000-8000-000000000001",
};
async function asUser(id: string, sql: string) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`,
  );
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role");
  }
}
beforeAll(async () => {
  db = new PGlite();
  // Minimal Supabase auth contract, using real Postgres roles and RLS, not mocked SQL.
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select '{"is_anonymous":false}'::jsonb $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid(), auth.jwt() to authenticated, anon;`);
  await db.exec(
    readFileSync("supabase/migrations/20261113021114_foundation.sql", "utf8"),
  );
  await db.exec(`insert into auth.users values ${["doctor", "other", "pending", "admin", "fresh", "suspended"].map((k) => `('${ids[k as keyof typeof ids]}')`).join(",")};
    insert into public.professional_profiles(user_id, role, verification_status, professional_id) values
    ('${ids.doctor}', 'doctor', 'approved', 'PRO-001'), ('${ids.other}', 'doctor', 'approved', 'PRO-002'),
    ('${ids.pending}', 'doctor', 'under_review', null), ('${ids.admin}', 'admin', 'approved', 'ADMIN-001'),
    ('${ids.suspended}', 'doctor', 'suspended', 'PRO-006');
    insert into public.facilities(id, name) values ('${ids.facility}', 'Centre fictif');
    insert into public.children(id, given_name, family_name, birth_date, sex, created_by) values
    ('${ids.child}', 'Test', 'Fictif', '2026-01-01', 'female', '${ids.doctor}'),
    ('${ids.hidden}', 'Test', 'Autre', '2026-01-01', 'male', '${ids.other}');
    insert into public.access_grants(child_id, professional_id, granted_by) values
    ${["doctor", "pending", "admin", "suspended"].map((k) => `('${ids.child}', '${ids[k as keyof typeof ids]}', '${ids.doctor}')`).join(",")};
    insert into public.doctor_patient_registry(professional_id, child_id, facility_id, register_year, register_book, local_number)
    values ('${ids.doctor}', '${ids.child}', '${ids.facility}', 2026, 'A', '125');`);
});
afterAll(async () => {
  await db.close();
});
describe("database access boundaries", () => {
  it("enables RLS for every public table", async () => {
    const result = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='public' and c.relkind='r'",
    );
    expect(result.rows.length).toBe(6);
    expect(result.rows.every((r) => r.relrowsecurity)).toBe(true);
  });
  it("allows approved doctors to see only granted children", async () => {
    expect(
      (await asUser(ids.doctor, "select id from public.children")).rows,
    ).toEqual([{ id: ids.child }]);
  });
  for (const key of ["other", "pending", "admin", "suspended"] as const) {
    it(`denies child access for ${key}`, async () =>
      expect(
        (await asUser(ids[key], "select id from public.children")).rows,
      ).toEqual([]));
  }
  it("does not expose another professional profile", async () => {
    expect(
      (
        await asUser(
          ids.doctor,
          "select user_id from public.professional_profiles",
        )
      ).rows,
    ).toEqual([{ user_id: ids.doctor }]);
  });
  it("blocks privilege self-escalation", async () => {
    await expect(
      asUser(
        ids.pending,
        "update public.professional_profiles set verification_status='approved', professional_id='FAKE'",
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("blocks child creation through the public API", async () => {
    await expect(
      asUser(
        ids.doctor,
        `insert into public.children(given_name,family_name,birth_date,sex,created_by) values ('x','y','2026-01-01','unknown','${ids.doctor}')`,
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("creates only an unverified doctor profile and audits it", async () => {
    await asUser(
      ids.fresh,
      `insert into public.professional_profiles(user_id) values ('${ids.fresh}')`,
    );
    const result = await asUser(
      ids.fresh,
      "select role, verification_status, professional_id from public.professional_profiles",
    );
    expect(result.rows).toEqual([
      {
        role: "doctor",
        verification_status: "unverified",
        professional_id: null,
      },
    ]);
    expect(
      (
        await db.query(
          `select id from public.audit_events where actor_id='${ids.fresh}' and entity_type='professional_profiles'`,
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("blocks creating another user’s profile", async () => {
    await expect(
      asUser(
        ids.pending,
        `insert into public.professional_profiles(user_id) values ('99999999-0000-4000-8000-000000000001')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("blocks assigning privileged fields during profile creation", async () => {
    await expect(
      asUser(
        ids.pending,
        `insert into public.professional_profiles(user_id, role) values ('${ids.pending}', 'admin')`,
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("hides operational audit rows from clients", async () => {
    await expect(
      asUser(ids.admin, "select * from public.audit_events"),
    ).rejects.toThrow(/permission denied/);
  });
  it("keeps audit events append-only even for privileged updates", async () => {
    await expect(
      db.exec("update public.audit_events set action='updated'"),
    ).rejects.toThrow("Append-only record");
    await expect(db.exec("delete from public.audit_events")).rejects.toThrow(
      "Append-only record",
    );
  });
  it("keeps the universal child identity immutable", async () => {
    await expect(
      db.exec(
        `update public.children set universal_id=gen_random_uuid() where id='${ids.child}'`,
      ),
    ).rejects.toThrow("Child identity is immutable");
  });
  it("allows another authorized doctor to retain a separate local register number", async () => {
    await db.exec(`insert into public.access_grants(child_id,professional_id,granted_by) values ('${ids.child}','${ids.other}','${ids.doctor}');
      insert into public.doctor_patient_registry(professional_id,child_id,facility_id,register_year,register_book,local_number) values ('${ids.other}','${ids.child}','${ids.facility}',2026,'A','78');`);
    expect(
      (
        await asUser(
          ids.other,
          "select child_id, local_number from public.doctor_patient_registry",
        )
      ).rows,
    ).toEqual([{ child_id: ids.child, local_number: "78" }]);
    await db.exec(
      `update public.access_grants set revoked_at=now() where professional_id='${ids.other}'`,
    );
    expect(
      (await asUser(ids.other, "select id from public.children")).rows,
    ).toEqual([]);
  });
  it("suspension immediately removes existing child access", async () => {
    await db.exec(
      `update public.professional_profiles set verification_status='suspended' where user_id='${ids.doctor}'`,
    );
    expect(
      (await asUser(ids.doctor, "select id from public.children")).rows,
    ).toEqual([]);
    await db.exec(
      `update public.professional_profiles set verification_status='approved' where user_id='${ids.doctor}'`,
    );
    expect(
      (await asUser(ids.doctor, "select id from public.children")).rows,
    ).toEqual([{ id: ids.child }]);
  });
  it("cannot turn a registry association into permission to see another child", async () => {
    await db.exec(
      `insert into public.doctor_patient_registry(professional_id,child_id,facility_id,register_year,register_book,local_number) values ('${ids.doctor}','${ids.hidden}','${ids.facility}',2026,'B','1')`,
    );
    expect(
      (await asUser(ids.doctor, "select id from public.children")).rows,
    ).toEqual([{ id: ids.child }]);
    expect(
      (
        await asUser(
          ids.doctor,
          "select child_id from public.doctor_patient_registry",
        )
      ).rows,
    ).toEqual([{ child_id: ids.child }]);
  });
  it("rejects duplicate register numbers within the same scope", async () => {
    await expect(
      db.exec(
        `insert into public.doctor_patient_registry(professional_id,child_id,facility_id,register_year,register_book,local_number) values ('${ids.doctor}','${ids.hidden}','${ids.facility}',2026,'A','125')`,
      ),
    ).rejects.toThrow(/unique constraint/);
  });
  it("denies anonymous access", async () => {
    await db.exec("set role anon");
    try {
      await expect(db.query("select id from public.children")).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
  it("honors grant expiry", async () => {
    await db.exec(
      `update public.access_grants set granted_at=now()-interval '2 days',expires_at=now()-interval '1 day' where professional_id='${ids.doctor}'`,
    );
    expect(
      (await asUser(ids.doctor, "select id from public.children")).rows,
    ).toEqual([]);
    expect(
      (
        await asUser(
          ids.doctor,
          "select id from public.doctor_patient_registry",
        )
      ).rows,
    ).toEqual([]);
    expect(
      (await asUser(ids.doctor, "select id from public.facilities")).rows,
    ).toEqual([]);
  });
});
