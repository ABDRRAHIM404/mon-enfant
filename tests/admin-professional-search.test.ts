import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { clinicalDatabase, sessionActing } from "./helpers/database";

let db: PGlite;
type Actor = { id: string; session: string };
type Result = {
  total: number;
  items: {
    user_id: string;
    email: string;
    display_name: string;
    capabilities?: unknown[];
  }[];
};
let manager: Actor, reviewer: Actor, nurse: Actor, doctor: Actor;

async function actor(
  role: string,
  email: string,
  name: object,
  professionalId: string,
): Promise<Actor> {
  const id = randomUUID(),
    session = randomUUID();
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
    [id, email, JSON.stringify(name)],
  );
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    session,
    id,
  ]);
  await db.query(
    "insert into public.professional_profiles(user_id,role,verification_status,professional_id) values($1,$2,'approved',$3)",
    [id, role, professionalId],
  );
  return { id, session };
}
async function search(
  a: Actor,
  query: string,
  directory = false,
  status = "all",
  page = 1,
) {
  const r = await sessionActing(
    db,
    a.id,
    a.session,
    directory
      ? "select public.list_admin_professionals($1,$2,$3) value"
      : "select public.list_clinical_permissions($1,$2) value",
    directory ? [query, status, page] : [query, page],
  );
  return (r.rows[0] as { value: Result }).value;
}
beforeAll(async () => {
  db = await clinicalDatabase();
  await db.exec(
    "alter table auth.users add column email text, add column raw_user_meta_data jsonb default '{}'::jsonb;",
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261114194747_clinician_role.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261118162530_admin_professional_identity_search.sql",
      "utf8",
    ),
  );
  manager = await actor(
    "admin",
    "manager@example.invalid",
    {},
    "SEARCH-MANAGER",
  );
  reviewer = await actor(
    "admin",
    "reviewer@example.invalid",
    {},
    "SEARCH-REVIEWER",
  );
  nurse = await actor(
    "nurse",
    "nadia.benali@example.invalid",
    { display_name: "Nadia Benali", role: "admin" },
    "SEARCH-NURSE",
  );
  doctor = await actor(
    "doctor",
    "omar@example.invalid",
    { first_name: "Omar", last_name: "Idrissi" },
    "SEARCH-DOCTOR",
  );
  await db.query(
    "insert into private.staff_permissions(user_id,can_manage_clinical_permissions,can_review_professionals) values($1,true,false),($2,false,true)",
    [manager.id, reviewer.id],
  );
});
afterAll(async () => {
  await db?.close();
});

describe("guarded professional identity search", () => {
  it("finds a nurse by email, first name, surname, full name or existing identifier", async () => {
    for (const q of [
      "nadia.benali@example.invalid",
      "NADIA",
      "Benali",
      "  Nadia   Benali  ",
      "SEARCH-NURSE",
    ])
      expect((await search(manager, q)).items.map((p) => p.user_id)).toEqual([
        nurse.id,
      ]);
  });
  it("supports separate first-name/surname metadata without making it authority", async () => {
    for (const q of ["Omar", "Idrissi", "Omar Idrissi"])
      expect((await search(manager, q)).items.map((p) => p.user_id)).toEqual([
        doctor.id,
      ]);
    await expect(search(nurse, "Nadia")).rejects.toThrow(
      "Clinical permission manager required",
    );
  });
  it("searches the recorded verification name when account metadata has no name", async () => {
    const a = await actor(
      "doctor",
      "documented@example.invalid",
      {},
      "SEARCH-VERIFIED",
    );
    const request = randomUUID();
    await db.query(
      "insert into public.verification_requests(id,professional_id,display_name,registration_number,facility_name,evidence_path,status) values($1,$2,'Salma El Amrani','TEST-123','Centre fictif',$3,'approved')",
      [request, a.id, `${a.id}/${request}/evidence.pdf`],
    );
    const r = await search(manager, "El Amrani");
    expect(r.items[0].user_id).toBe(a.id);
    expect(r.items[0].display_name).toBe("Salma El Amrani");
  });
  it("treats SQL-looking input and wildcard characters literally", async () => {
    for (const q of ["%", "_", "' or true --", "missing@example.invalid"])
      expect((await search(manager, q)).total).toBe(0);
  });
  it("preserves reviewer-only directory access and its status/page filters", async () => {
    expect((await search(reviewer, "benali", true)).items[0].email).toBe(
      "nadia.benali@example.invalid",
    );
    expect((await search(reviewer, "benali", true, "suspended")).total).toBe(0);
    const second = await search(reviewer, "benali", true, "approved", 2);
    expect(second.total).toBe(1);
    expect(second.items).toEqual([]);
    await expect(search(manager, "benali", true)).rejects.toThrow(
      "Professional reviewer required",
    );
    await expect(search(reviewer, "benali")).rejects.toThrow(
      "Clinical permission manager required",
    );
  });
  it("rejects expired/revoked sessions, invalid filters and direct helper access", async () => {
    await expect(search(manager, "x".repeat(255))).rejects.toThrow(
      "Invalid filters",
    );
    await expect(search(reviewer, "", true, "invalid")).rejects.toThrow(
      "Invalid filters",
    );
    await expect(
      sessionActing(
        db,
        manager.id,
        manager.session,
        "select * from private.search_professional_accounts('benali')",
      ),
    ).rejects.toThrow("permission denied");
    await db.query("delete from auth.sessions where id=$1", [manager.session]);
    await expect(search(manager, "benali")).rejects.toThrow(
      "Clinical permission manager required",
    );
  });
});
