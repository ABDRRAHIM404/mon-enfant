import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { mobileDatabase, sessionActing } from "./helpers/database";
import {
  localAppointmentInput,
  localAppointmentOffset,
  resolveAppointmentTime,
} from "../src/lib/appointments/calendar";
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
    await db.query<{ current_day: string }>(
      "select ((now() at time zone 'Africa/Casablanca')::date+30)::text current_day",
    )
  ).rows[0].current_day;
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
  const start = new Date(Date.now() + days * 86400000);
  start.setUTCSeconds(0, 0);
  const end = new Date(start.getTime() + 1800000);
  const explicit = (date: Date) => {
    const instant = date.toISOString();
    return resolveAppointmentTime(
      localAppointmentInput(instant),
      localAppointmentOffset(instant),
    );
  };
  const times = { starts: explicit(start), ends: explicit(end) };
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
  db = await mobileDatabase();
});
afterAll(async () => {
  await db?.close();
});
describe("native parent read projections", () => {
  it("preserves parent data/order and supplies canonical hosted-zone appointment labels and civil day", async () => {
    const f = await linked();
    const appointmentId = await appointment(f, 2);
    const original = await rpc<{
      appointments: Record<string, unknown>[];
      child: unknown;
    }>(f.parent, "parent_child_booklet", [f.child, 1]);
    const native = await rpc<{
      appointments: Record<string, unknown>[];
      child: unknown;
      server_current_civil_day: string;
      timezone: string;
    }>(f.parent, "parent_mobile_view", ["booklet", f.child, 1]);
    expect(native.child).toEqual(original.child);
    expect(native.timezone).toBe("Africa/Casablanca");
    const expected = (
      await db.query<{
        local_stamp: string;
        current_civil_day: string;
        offset: number;
      }>(
        "select to_char(e.starts_at at time zone 'Africa/Casablanca','DD/MM/YYYY HH24:MI') as local_stamp,(now() at time zone 'Africa/Casablanca')::date::text as current_civil_day,extract(epoch from((e.starts_at at time zone 'Africa/Casablanca')-(e.starts_at at time zone 'UTC')))::integer as zone_offset_seconds from public.appointment_events e where e.appointment_id=$1 order by revision desc limit 1",
        [appointmentId],
      )
    ).rows[0];
    expect(native.server_day).toBe(expected.current_civil_day);
    expect(native.appointments[0].starts_display).toContain(
      expected.local_stamp,
    );
    expect(native.appointments[0].starts_offset_seconds).toBe(
      expected.zone_offset_seconds,
    );
    const strip = (row: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(row).filter(
          ([key]) =>
            ![
              "starts_display",
              "ends_display",
              "starts_offset_seconds",
            ].includes(key),
        ),
      );
    expect(native.appointments.map(strip)).toEqual(original.appointments);
    expect(await rpc(f.parent, "parent_mobile_view", ["home"])).toMatchObject({
      next_appointment: {
        id: appointmentId,
        starts_display: native.appointments[0].starts_display,
      },
      server_day: expected.current_civil_day,
    });
    expect(
      await rpc(f.parent, "parent_mobile_view", ["calendar", f.child, 1]),
    ).toMatchObject({
      items: [
        {
          id: appointmentId,
          starts_display: native.appointments[0].starts_display,
        },
      ],
    });
    expect(
      await rpc(f.parent, "parent_mobile_view", [
        "vaccine_references",
        f.child,
        1,
      ]),
    ).toMatchObject({ items: [], server_day: expected.current_civil_day });
  });
  it("never substitutes a clinical grant, parent profile or metadata for a current guardian link", async () => {
    const f = await linked(),
      other = await actor();
    for (const a of [f.doctor, other])
      for (const kind of [
        "booklet",
        "calendar",
        "vaccine_references",
        "vaccination_history",
      ])
        await expect(
          rpc(a, "parent_mobile_view", [kind, f.child, 1]),
        ).rejects.toMatchObject({ code: "42501" });
    await rpc(f.parent, "revoke_guardian_link", [f.link, reason]);
    for (const kind of [
      "booklet",
      "calendar",
      "vaccine_references",
      "vaccination_history",
    ])
      await expect(
        rpc(f.parent, "parent_mobile_view", [kind, f.child, 1]),
      ).rejects.toMatchObject({ code: "42501" });
    expect(await rpc(f.parent, "parent_mobile_view", ["home"])).toMatchObject({
      children: [],
      next_appointment: null,
    });
  });
  it("denies internal projection execution, invalid inputs and existing JWTs after logout", async () => {
    const f = await linked();
    for (const kind of ["anything", "private_clinical", "provisional_booklet"])
      await expect(
        rpc(f.parent, "parent_mobile_view", [kind, f.child, 1]),
      ).rejects.toMatchObject({ code: "22023" });
    await expect(
      rpc(f.parent, "parent_mobile_view", ["booklet", f.child, 0]),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(
      sessionActing(
        db,
        f.parent.id,
        f.parent.session,
        "select private.mobile_appointment('{}'::jsonb)",
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      sessionActing(
        db,
        f.parent.id,
        f.parent.session,
        "select private.mobile_local_time(now())",
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await db.query("delete from auth.sessions where id=$1", [f.parent.session]);
    await expect(
      rpc(f.parent, "parent_mobile_view", ["home"]),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
