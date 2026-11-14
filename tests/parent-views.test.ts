import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { parentViewsDatabase, sessionActing } from "./helpers/database";
import type { PatientVaccineItem } from "../src/lib/vaccines/patient-types";
import { routineReference } from "../src/lib/vaccines/calendar";
let db: PGlite;
type Actor = { id: string; session: string; email: string };
const reason = "Vérification entièrement fictive pour le test.";
async function actor(role?: string): Promise<Actor> {
  const a = {
    id: randomUUID(),
    session: randomUUID(),
    email: `fictional-${randomUUID()}@example.invalid`,
  };
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
    [a.id, a.email],
  );
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    a.session,
    a.id,
  ]);
  if (role)
    await db.query(
      "insert into public.professional_profiles(user_id,role,verification_status,professional_id) values($1,$2,'approved',$3)",
      [a.id, role, `GUARDIAN-${a.id}`],
    );
  else await rpc(a, "save_parent_profile", ["Responsable entièrement fictif"]);
  return a;
}
async function rpc<T = unknown>(
  a: Actor,
  name: string,
  args: unknown[] = [],
): Promise<T> {
  const result = await sessionActing(
    db,
    a.id,
    a.session,
    `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) value`,
    args,
  );
  return (result.rows[0] as { value: T }).value;
}
async function setup() {
  const doctor = await actor("doctor"),
    parent = await actor();
  const facility = await rpc<string>(doctor, "create_facility", [
    randomUUID(),
    "Centre entièrement fictif",
    "",
  ]);
  const child = await rpc<string>(doctor, "register_child", [
    randomUUID(),
    {
      facility_id: facility,
      register_year: 2026,
      register_book: "A",
      local_number: "1",
      given_name: "Enfant fictif",
      family_name: "Test synthétique",
      birth_date: "2025-01-01",
      birth_date_precision: "exact",
      sex: "unknown",
    },
  ]);
  return { doctor, parent, facility, child };
}
async function invite(doctor: Actor, parent: Actor, child: string) {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const id = await rpc<string>(doctor, "create_guardian_invitation", [
    child,
    parent.email,
    hash,
    reason,
  ]);
  return { id, token, hash };
}
async function claim(parent: Actor, token: string, operation = randomUUID()) {
  return rpc<string>(parent, "claim_guardian_invitation", [
    operation,
    token,
    "mother",
    true,
  ]);
}
async function approve(
  doctor: Actor,
  claimId: string,
  canExport = false,
  identity = true,
  guardianship = true,
) {
  const expiry = (
    await db.query<{ expires_on: string }>(
      "select ((now() at time zone 'Africa/Casablanca')::date+30)::text as expires_on",
    )
  ).rows[0].expires_on;
  return rpc<string>(doctor, "review_guardian_claim", [
    randomUUID(),
    claimId,
    1,
    "approved",
    "mother",
    reason,
    reason,
    identity,
    guardianship,
    expiry,
    canExport,
  ]);
}
async function linked() {
  const fixture = await setup();
  const invitation = await invite(
    fixture.doctor,
    fixture.parent,
    fixture.child,
  );
  await approve(
    fixture.doctor,
    await claim(fixture.parent, invitation.token),
    true,
  );
  return fixture;
}
async function care(f: Awaited<ReturnType<typeof linked>>, root?: string) {
  await db.query(
    "insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) values($1,'consultation',true,$1) on conflict(professional_id,capability) do update set enabled=true",
    [f.doctor.id],
  );
  return rpc<string>(f.doctor, "write_clinical_entry", [
    randomUUID(),
    f.child,
    "consultation",
    f.facility,
    "2026-01-02",
    "exact",
    "observed",
    null,
    true,
    { reason: root ? "Motif fictif corrigé" : "Motif entièrement fictif" },
    ...(root ? [root, 1, reason, "active"] : []),
  ]);
}
async function appointment(
  who: Actor,
  child: string,
  facility: string,
  label: string,
) {
  await db.query(
    "insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) values($1,'appointment',true,$1) on conflict(professional_id,capability) do update set enabled=true",
    [who.id],
  );
  return rpc<string>(who, "create_appointment", [
    randomUUID(),
    child,
    facility,
    "consultation",
    label,
    null,
    "2026-01-02T10:00:00+01:00",
    "2026-01-02T10:30:00+01:00",
    reason,
    true,
  ]);
}
beforeAll(async () => {
  db = await parentViewsDatabase();
});
afterAll(async () => {
  await db?.close();
});
describe("parent calendars, reviewed references and current Auth account state", () => {
  it("shows both providers' appointments only for the verified child, with shared effective states and date counts", async () => {
    const f = await linked(),
      second = await actor("doctor"),
      stranger = await actor();
    const facility = await rpc<string>(second, "create_facility", [
      randomUUID(),
      "Deuxième centre fictif",
      "",
    ]);
    await db.query(
      "insert into public.access_grants(child_id,professional_id,granted_by) values($1,$2,$3)",
      [f.child, second.id, f.doctor.id],
    );
    await appointment(f.doctor, f.child, f.facility, "Visite fictive A");
    await appointment(second, f.child, facility, "Visite fictive B");
    const result = await rpc<{
      items: {
        child_id: string;
        effective_state: string;
        professional_id: string;
      }[];
      total: number;
      days: { day: string; count: number }[];
    }>(f.parent, "parent_appointment_calendar", [
      f.child,
      "2026-01-01",
      "2026-01-31",
      1,
      "all",
    ]);
    expect(result.total).toBe(2);
    expect(
      result.items.every(
        (row) => row.child_id === f.child && row.effective_state === "missed",
      ),
    ).toBe(true);
    expect(new Set(result.items.map((row) => row.professional_id))).toEqual(
      new Set([`GUARDIAN-${f.doctor.id}`, `GUARDIAN-${second.id}`]),
    );
    expect(result.days).toEqual([{ day: "2026-01-02", count: 2 }]);
    expect(
      await rpc(f.parent, "parent_appointment_calendar", [
        f.child,
        "2026-01-01",
        "2026-01-31",
        1,
        "completed",
      ]),
    ).toMatchObject({ total: 0, items: [], days: [] });
    await expect(
      rpc(stranger, "parent_appointment_calendar", [
        f.child,
        "2026-01-01",
        "2026-01-31",
        1,
        "all",
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      rpc(f.parent, "create_appointment", [
        randomUUID(),
        f.child,
        f.facility,
        "consultation",
        "Tentative fictive",
        null,
        "2026-01-02T10:00:00+01:00",
        "2026-01-02T10:30:00+01:00",
        reason,
        true,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("bounds the calendar and revokes both read projections with the guardian link", async () => {
    const f = await linked();
    await expect(
      rpc(f.parent, "parent_appointment_calendar", [
        f.child,
        "2026-01-01",
        "2026-03-01",
        1,
        "all",
      ]),
    ).rejects.toMatchObject({ code: "22023" });
    expect(
      await rpc(f.parent, "parent_vaccine_items", [f.child, 1]),
    ).toMatchObject({ items: [], total: 0 });
    const link = (
      await db.query<{ id: string }>(
        "select id from private.guardian_links where guardian_id=$1 and child_id=$2",
        [f.parent.id, f.child],
      )
    ).rows[0].id;
    await rpc(f.parent, "revoke_guardian_link", [link, reason]);
    await expect(
      rpc(f.parent, "parent_vaccine_items", [f.child, 1]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      rpc(f.parent, "parent_appointment_calendar", [
        f.child,
        "2026-01-01",
        "2026-01-31",
        1,
        "all",
      ]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("returns assigned version/source/professional attribution without activation, and reflects retirement", async () => {
    const f = await linked(),
      editor = await actor("admin"),
      reviewer = await actor("doctor");
    await db.query(
      "insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) values($1,'vaccination',true,$1),($2,'vaccination',true,$2)",
      [f.doctor.id, reviewer.id],
    );
    await db.query(
      "insert into private.staff_permissions(user_id,can_manage_vaccine_catalog,can_review_vaccine_catalog) values($1,true,false),($2,false,true)",
      [editor.id, reviewer.id],
    );
    const seed = (
      await db.query<{ id: string; revision: number }>(
        "select id,revision from public.vaccine_versions where parent_id is null",
      )
    ).rows[0];
    const version = await rpc<string>(editor, "change_vaccine_catalog", [
      randomUUID(),
      "clone",
      seed.id,
      seed.revision,
      {
        label: "Références parent entièrement fictives",
        reason,
        evidence_reference: reason,
      },
    ]);
    await rpc(reviewer, "change_vaccine_catalog", [
      randomUUID(),
      "approve",
      version,
      1,
      {
        reason,
        evidence_reference: reason,
        source_authenticated: true,
        clinical_reviewed: true,
        birth_window_reviewed: true,
      },
    ]);
    await rpc(f.doctor, "assign_vaccine_item", [
      randomUUID(),
      f.child,
      version,
      "VPO1",
      f.facility,
      reason,
      true,
    ]);
    const result = await rpc<{ items: PatientVaccineItem[]; total: number }>(
      f.parent,
      "parent_vaccine_items",
      [f.child, 1],
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      version_id: version,
      dose_code: "VPO1",
      version_status: "approved",
      review_verified: true,
      professional_id: `GUARDIAN-${f.doctor.id}`,
      state: "active",
      documented_entries: [],
    });
    await expect(
      rpc(f.parent, "assign_vaccine_item", [
        randomUUID(),
        f.child,
        version,
        "VPO2",
        f.facility,
        reason,
        true,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      rpc(f.parent, "patient_vaccine_items", [f.child, 1]),
    ).rejects.toMatchObject({ code: "42501" });
    await rpc(editor, "change_vaccine_catalog", [
      randomUUID(),
      "retire",
      version,
      2,
      { reason, evidence_reference: reason },
    ]);
    const retired = (
      await rpc<{ items: PatientVaccineItem[] }>(
        f.parent,
        "parent_vaccine_items",
        [f.child, 1],
      )
    ).items[0];
    expect(retired.version_status).toBe("retired");
    expect(
      routineReference(
        {
          doseCode: retired.dose_code,
          vaccineCode: retired.vaccine_code,
          age: retired.age,
          eligibility: retired.eligibility,
          automaticScheduling: retired.automatic_scheduling,
        },
        { birthDate: "2025-01-01", birthPrecision: "exact", sex: "unknown" },
        {
          status: retired.version_status,
          reviewVerified: retired.review_verified,
        },
      ),
    ).toMatchObject({ state: "unreviewed_version", startOn: null });
    expect(
      (
        await db.query(
          "select status,revision from public.vaccine_versions where id=$1",
          [seed.id],
        )
      ).rows,
    ).toEqual([{ status: "draft", revision: 1 }]);
    expect(
      (
        await db.query<{ n: number }>(
          "select count(*)::integer n from public.vaccine_rules where version_id=$1",
          [seed.id],
        )
      ).rows[0].n,
    ).toBe(25);
  });
  it("denies old professional JWTs when Auth is banned even with an existing session row", async () => {
    const f = await linked();
    await care(f);
    await db.query(
      "update auth.users set banned_until=now()+interval '1 hour' where id=$1",
      [f.doctor.id],
    );
    expect(
      (
        await db.query("select id from auth.sessions where id=$1", [
          f.doctor.session,
        ])
      ).rows,
    ).toHaveLength(1);
    for (const name of ["get_child_profile", "clinical_export"])
      await expect(rpc(f.doctor, name, [f.child])).rejects.toMatchObject({
        code: "42501",
      });
    await expect(
      rpc(f.doctor, "create_facility", [
        randomUUID(),
        "Tentative sous bannissement",
        "",
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await db.query("update auth.users set banned_until=null where id=$1", [
      f.doctor.id,
    ]);
    expect(await rpc(f.doctor, "get_child_profile", [f.child])).toMatchObject({
      id: f.child,
    });
  });
});
