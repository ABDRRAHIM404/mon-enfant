import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { protectedDashboardDatabase, sessionActing } from "./helpers/database";
let db: PGlite;
type Actor = { id: string; session: string; email: string };
const reason = "Décision entièrement fictive du test de permissions.";
async function actor(role?: string, status = "approved"): Promise<Actor> {
  const a = {
    id: randomUUID(),
    session: randomUUID(),
    email: `qa-${randomUUID()}@example.invalid`,
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
      "insert into public.professional_profiles(user_id,role,verification_status,professional_id) values($1,$2,$3,$4)",
      [a.id, role, status, status === "approved" ? `QA-${a.id}` : null],
    );
  else await rpc(a, "save_parent_profile", ["Responsable fictif"]);
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
async function registered(doctor: Actor) {
  const facility = await rpc<string>(doctor, "create_facility", [
    randomUUID(),
    "Centre entièrement fictif",
    "",
  ]);
  const operation = randomUUID();
  const payload = {
    facility_id: facility,
    register_year: 2026,
    register_book: "QA",
    local_number: "001",
    given_name: "Enfant fictif",
    family_name: randomUUID(),
    birth_date: "2025-01-01",
    birth_date_precision: "exact",
    sex: "unknown",
  };
  expect(
    await rpc(doctor, "prepare_child_registration", [operation, payload]),
  ).toMatchObject({ state: "ready" });
  const child = await rpc<string>(doctor, "register_child", [
    operation,
    payload,
  ]);
  return { doctor, facility, child };
}
async function linked() {
  const doctor = await actor("doctor"),
    parent = await actor();
  const f = await registered(doctor);
  const token = randomBytes(32).toString("base64url");
  await rpc(doctor, "create_guardian_invitation", [
    f.child,
    parent.email,
    createHash("sha256").update(token).digest("hex"),
    reason,
  ]);
  const claim = await rpc<string>(parent, "claim_guardian_invitation", [
    randomUUID(),
    token,
    "mother",
    true,
  ]);
  const expires = (
    await db.query<{ day: string }>(
      "select ((now() at time zone 'Africa/Casablanca')::date+30)::text day",
    )
  ).rows[0].day;
  const link = await rpc<string>(doctor, "review_guardian_claim", [
    randomUUID(),
    claim,
    1,
    "approved",
    "mother",
    reason,
    reason,
    true,
    true,
    expires,
    true,
  ]);
  return { ...f, parent, link };
}
async function appointment(
  f: Awaited<ReturnType<typeof registered>>,
  days: number,
) {
  await db.query(
    "insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) values($1,'appointment',true,$1) on conflict(professional_id,capability) do update set enabled=true",
    [f.doctor.id],
  );
  const times = (
    await db.query<{ starts: string; ends: string }>(
      "select (now()+($1::integer||' days')::interval)::text starts,(now()+($1::integer||' days')::interval+interval '30 minutes')::text ends",
      [days],
    )
  ).rows[0];
  return rpc<string>(f.doctor, "create_appointment", [
    randomUUID(),
    f.child,
    f.facility,
    "consultation",
    "Consultation fictive",
    null,
    times.starts,
    times.ends,
    reason,
    true,
  ]);
}
beforeAll(async () => {
  db = await protectedDashboardDatabase();
});
afterAll(async () => {
  await db?.close();
});
describe("protected dashboard projections on the complete migrated schema", () => {
  it("counts only current own provisional revisions, excludes withdrawals and unknown dates, and denies stale sessions", async () => {
    const a = await actor("nurse", "unverified"),
      b = await actor("doctor", "unverified");
    const identity = {
      given_name: "Enfant fictif",
      family_name: randomUUID(),
      name_status: "confirmed",
      birth_date: "2025-01-01",
      birth_date_precision: "exact",
      sex: "unknown",
    };
    const child = await rpc<string>(a, "create_provisional_child", [
      randomUUID(),
      identity,
    ]);
    const today = (
      await db.query<{ day: string }>(
        "select (now() at time zone 'Africa/Casablanca')::date::text day",
      )
    ).rows[0].day;
    const future = (
      await db.query<{ time: string }>(
        "select to_char(now()+interval '2 days','YYYY-MM-DD\"T\"HH24:MI:SS')||'+00:00' time",
      )
    ).rows[0].time;
    const first = await rpc<string>(a, "write_provisional_entry", [
      randomUUID(),
      child,
      "consultation",
      today,
      "exact",
      "observed",
      null,
      { reason: "Motif fictif" },
    ]);
    await rpc(a, "write_provisional_entry", [
      randomUUID(),
      child,
      "consultation",
      today,
      "exact",
      "observed",
      null,
      { reason: "Motif corrigé fictif" },
      first,
      1,
      reason,
      "active",
    ]);
    await rpc(a, "write_provisional_entry", [
      randomUUID(),
      child,
      "consultation",
      null,
      "unknown",
      "reported",
      null,
      { reason: "Date inconnue fictive" },
    ]);
    const vaccine = await rpc<string>(a, "write_provisional_entry", [
      randomUUID(),
      child,
      "vaccination",
      today,
      "exact",
      "reported",
      null,
      { vaccine_label: "Vaccin fictif", dose_label: "Dose fictive" },
    ]);
    await rpc(a, "write_provisional_entry", [
      randomUUID(),
      child,
      "vaccination",
      today,
      "exact",
      "reported",
      null,
      { vaccine_label: "Vaccin fictif", dose_label: "Dose fictive" },
      vaccine,
      1,
      reason,
      "withdrawn",
    ]);
    await rpc(a, "write_provisional_entry", [
      randomUUID(),
      child,
      "appointment",
      today,
      "exact",
      "observed",
      null,
      { purpose: "Visite fictive", scheduled_for: future, status: "planned" },
    ]);
    expect(await rpc(a, "provisional_workspace")).toMatchObject({
      total: 1,
      summary: {
        consultations_week: 1,
        vaccinations: 0,
        appointments_upcoming: 1,
      },
    });
    expect(await rpc(b, "provisional_workspace")).toMatchObject({
      total: 0,
      items: [],
      summary: {
        consultations_week: 0,
        vaccinations: 0,
        appointments_upcoming: 0,
      },
    });
    await db.query(
      "update public.professional_profiles set verification_status='suspended' where user_id=$1",
      [a.id],
    );
    await expect(rpc(a, "provisional_workspace")).rejects.toMatchObject({
      code: "42501",
    });
    await db.query("delete from auth.sessions where id=$1", [b.session]);
    await expect(rpc(b, "provisional_workspace")).rejects.toMatchObject({
      code: "42501",
    });
  });
  it("shows the earliest guardian-scoped scheduled appointment, never a clinical-only child's visit, and cuts off revoked links", async () => {
    const f = await linked();
    const late = await appointment(f, 3),
      early = await appointment(f, 2);
    // A dual-role parent can have a clinical-only child; parent home still excludes it.
    await db.query(
      "insert into public.professional_profiles(user_id,role,verification_status,professional_id) values($1,'doctor','approved',$2)",
      [f.parent.id, `QA-${f.parent.id}`],
    );
    const clinicalOnly = await registered(f.parent);
    await appointment(clinicalOnly, 1);
    const home = await rpc<{
      children: { id: string }[];
      next_appointment: { id: string };
      unread_total: number;
    }>(f.parent, "parent_home_summary");
    expect(home.children.map((c) => c.id)).toEqual([f.child]);
    expect(home.next_appointment.id).toBe(early);
    expect(home.next_appointment.id).not.toBe(late);
    expect(JSON.stringify(home)).not.toContain(clinicalOnly.child);
    expect(home.unread_total).toBeGreaterThan(0);
    const outsider = await actor();
    expect(await rpc(outsider, "parent_home_summary")).toMatchObject({
      children: [],
      next_appointment: null,
      unread_total: 0,
    });
    await rpc(f.parent, "revoke_guardian_link", [f.link, reason]);
    expect(await rpc(f.parent, "parent_home_summary")).toMatchObject({
      children: [],
      next_appointment: null,
    });
    await expect(
      rpc(f.parent, "parent_vaccination_history", [f.child, 1]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("returns unassigned uncertain vaccination history with provenance and latest revisions, never another child's ledger", async () => {
    const f = await linked();
    await db.query(
      "insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) values($1,'vaccination',true,$1)",
      [f.doctor.id],
    );
    const payload = {
      vaccine_code: "UNKNOWN",
      vaccine_label: "Vaccin transcrit fictif",
      dose_label: "Dose inconnue",
      lot_status: "unknown",
      site_status: "unknown",
      provider_status: "unknown",
      administration_facility_status: "unknown",
      matching_status: "unmatched",
    };
    const args = [
      randomUUID(),
      f.child,
      "vaccination",
      f.facility,
      null,
      "unknown",
      "paper_transcription",
      "Référence papier fictive",
      false,
      payload,
    ];
    const entry = await rpc<string>(f.doctor, "write_clinical_entry", args);
    const history = await rpc<{
      total: number;
      items: {
        id: string;
        source_verified: boolean;
        occurrence_precision: string;
        payload: typeof payload;
      }[];
    }>(f.parent, "parent_vaccination_history", [f.child, 1]);
    expect(history).toMatchObject({
      total: 1,
      items: [
        {
          id: entry,
          source_verified: false,
          occurrence_precision: "unknown",
          payload,
        },
      ],
    });
    expect(
      await rpc(f.parent, "parent_vaccine_items", [f.child, 1]),
    ).toMatchObject({ total: 0 });
    const other = await actor();
    await expect(
      rpc(other, "parent_vaccination_history", [f.child, 1]),
    ).rejects.toMatchObject({ code: "42501" });
    await rpc(f.doctor, "write_clinical_entry", [
      randomUUID(),
      ...args.slice(1),
      entry,
      1,
      reason,
      "withdrawn",
    ]);
    expect(
      await rpc(f.parent, "parent_vaccination_history", [f.child, 1]),
    ).toMatchObject({ total: 0, items: [] });
    await expect(
      rpc(f.parent, "parent_vaccination_history", [f.child, 0]),
    ).rejects.toMatchObject({ code: "22023" });
    await db.query(
      "update auth.users set banned_until=now()+interval '1 day' where id=$1",
      [f.parent.id],
    );
    await expect(rpc(f.parent, "parent_home_summary")).rejects.toMatchObject({
      code: "42501",
    });
  });
});
