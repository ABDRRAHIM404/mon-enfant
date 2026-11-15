import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { sharingDatabase, sessionActing } from "./helpers/database";
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
type Receipt = {
  accepted: boolean;
  id: string;
  token: string;
  scope: string;
  expires_at: string;
  server_now: string;
};
async function issue(
  f: Awaited<ReturnType<typeof linked>>,
  scope = "vaccination_read",
) {
  return rpc<Receipt>(f.parent, "issue_clinician_share", [
    f.child,
    scope,
    true,
  ]);
}
async function consume(a: Actor, r: Receipt) {
  expect(await rpc(a, "redeem_clinician_share", [r.token])).toMatchObject({
    accepted: true,
    id: r.id,
    scope: r.scope,
    expires_at: r.expires_at,
  });
  return rpc<Record<string, unknown>>(a, "read_clinician_share", [r.id, 1]);
}
const denied = { code: "42501" };
beforeAll(async () => {
  db = await sharingDatabase();
});
afterAll(async () => {
  await db?.close();
});
describe("temporary sharing on complete schema", () => {
  it("keeps original parent projections and audits unchanged while isolating read-only scopes", async () => {
    const f = await linked(),
      reader = await actor("nurse");
    await appointment(f, 2);
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
    const entry = await rpc<string>(f.doctor, "write_clinical_entry", [
      randomUUID(),
      f.child,
      "vaccination",
      f.facility,
      null,
      "unknown",
      "paper_transcription",
      "Source fictive",
      false,
      payload,
    ]);
    const parentBook = await rpc<Record<string, unknown>>(
      f.parent,
      "parent_child_booklet",
      [f.child, 1],
    );
    const history = await rpc(f.parent, "parent_vaccination_history", [
        f.child,
        1,
      ]),
      references = await rpc(f.parent, "parent_vaccine_items", [f.child, 1]);
    expect(parentBook).toMatchObject({
      child: { id: f.child },
      link: { id: f.link, can_export: true },
      entry_total: 1,
      appointment_total: 1,
    });
    expect(history).toMatchObject({
      items: [
        {
          id: entry,
          occurrence_precision: "unknown",
          source_verified: false,
          payload,
        },
      ],
    });
    const before = await db.query(
      "select count(*) count from public.access_grants",
    );
    const r = await issue(f);
    const view = await consume(reader, r);
    expect(view).toMatchObject({
      scope: "vaccination_read",
      professional_id: `QA-${reader.id}`,
      data: { history, references },
    });
    expect(view.data as object).not.toHaveProperty("appointments");
    await expect(rpc(reader, "get_child", [f.child])).rejects.toMatchObject(
      denied,
    );
    await expect(
      rpc(reader, "write_clinical_entry", [
        randomUUID(),
        f.child,
        "vaccination",
        f.facility,
        null,
        "unknown",
        "paper_transcription",
        "Source fictive",
        false,
        payload,
      ]),
    ).rejects.toMatchObject(denied);
    expect(
      (await db.query("select count(*) count from public.access_grants")).rows,
    ).toEqual(before.rows);
    const full = await issue(f, "booklet_read"),
      fullView = await consume(reader, full);
    const { link: _, ...expected } = parentBook;
    void _;
    expect(fullView.data).toEqual(expected);
    expect(fullView.data).not.toHaveProperty("link");
    const audit = await rpc<{
      items: {
        actor_type: string;
        professional_id: string;
        entity_type: string;
      }[];
    }>(f.parent, "parent_access_history", [f.child, 1]);
    expect(audit.items).toContainEqual(
      expect.objectContaining({
        entity_type: "guardian_share_read",
        actor_type: "professional",
        professional_id: `QA-${reader.id}`,
      }),
    );
    expect(JSON.stringify(audit)).not.toContain(r.token);
    await expect(
      rpc(reader, "parent_child_booklet", [f.child, 1]),
    ).rejects.toMatchObject(denied);
  });
  it("requires actual export authority, explicit consent and fixed purpose; stores only digest", async () => {
    const f = await linked(),
      outsider = await actor();
    for (const consent of [false, null])
      await expect(
        rpc(f.parent, "issue_clinician_share", [
          f.child,
          "vaccination_read",
          consent,
        ]),
      ).rejects.toMatchObject({ code: "22023" });
    await expect(
      rpc(f.parent, "issue_clinician_share", [f.child, "write", true]),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(
      rpc(outsider, "issue_clinician_share", [
        f.child,
        "vaccination_read",
        true,
      ]),
    ).rejects.toMatchObject(denied);
    const r = await issue(f);
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(
      Date.parse(r.expires_at) - Date.parse(r.server_now),
    ).toBeLessThanOrEqual(300000);
    const row = (
      await db.query<{ token_hash: string }>(
        "select * from private.clinician_shares where id=$1",
        [r.id],
      )
    ).rows[0];
    expect(row.token_hash).toBe(
      createHash("sha256").update(r.token).digest("hex"),
    );
    expect(JSON.stringify(row)).not.toContain(r.token);
    await db.query(
      "update private.guardian_links set can_export=false where id=$1",
      [f.link],
    );
    await expect(issue(f)).rejects.toMatchObject(denied);
    expect(
      await rpc(await actor("doctor"), "redeem_clinician_share", [r.token]),
    ).toEqual({ accepted: false });
  });
  it("limits issuance and invalidates replaced unused codes", async () => {
    const f = await linked(),
      reader = await actor("doctor"),
      old = await issue(f),
      current = await issue(f);
    expect(await rpc(reader, "redeem_clinician_share", [old.token])).toEqual({
      accepted: false,
    });
    await consume(reader, current);
    for (let i = 0; i < 3; i++) expect((await issue(f)).accepted).toBe(true);
    expect(await issue(f)).toEqual({ accepted: false });
    expect(
      await rpc(reader, "read_clinician_share", [current.id, 1]),
    ).toMatchObject({ id: current.id });
  });
  it("requires current approved clinician, binds one claim to user AND session, denies direct projections", async () => {
    const f = await linked(),
      reader = await actor("doctor"),
      other = await actor("nurse"),
      r = await issue(f);
    for (const a of [
      f.parent,
      await actor("admin"),
      await actor("doctor", "unverified"),
      await actor("nurse", "rejected"),
      await actor("doctor", "suspended"),
    ])
      await expect(
        rpc(a, "redeem_clinician_share", [r.token]),
      ).rejects.toMatchObject(denied);
    await consume(reader, r);
    expect(await rpc(other, "redeem_clinician_share", [r.token])).toEqual({
      accepted: false,
    });
    await expect(
      rpc(other, "read_clinician_share", [r.id, 1]),
    ).rejects.toMatchObject(denied);
    const second = { ...reader, session: randomUUID() };
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
      second.session,
      second.id,
    ]);
    await expect(
      rpc(second, "read_clinician_share", [r.id, 1]),
    ).rejects.toMatchObject(denied);
    for (const sql of [
      "select * from private.clinician_shares",
      "select * from private.clinician_share_attempts",
      `select private.share_child_projection('${f.child}')`,
      `select private.share_booklet_projection('${f.child}',null,1)`,
      `select private.share_reference_projection('${f.child}',1)`,
      `select private.share_vaccination_projection('${f.child}',1)`,
      `select * from private.share_appointment_projection('${f.child}')`,
    ])
      await expect(
        sessionActing(db, reader.id, reader.session, sql),
      ).rejects.toMatchObject(denied);
    await expect(
      db.query(
        "update private.clinician_shares set scope='booklet_read' where id=$1",
        [r.id],
      ),
    ).rejects.toMatchObject(denied);
  });
  it("commits denied-guess receipts and enforces redemption limit without exposing child existence", async () => {
    const f = await linked(),
      reader = await actor("nurse"),
      r = await issue(f);
    for (let i = 0; i < 10; i++)
      expect(
        await rpc(reader, "redeem_clinician_share", [
          randomBytes(32).toString("base64url"),
        ]),
      ).toEqual({ accepted: false });
    expect(await rpc(reader, "redeem_clinician_share", [r.token])).toEqual({
      accepted: false,
    });
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::integer count from private.clinician_share_attempts where actor_id=$1",
          [reader.id],
        )
      ).rows[0].count,
    ).toBe(10);
  });
  it.each([
    "parent_logout",
    "parent_expired_session",
    "parent_ban",
    "parent_unconfirmed",
    "link_revoke",
    "link_expire",
    "link_export",
    "reader_logout",
    "reader_expired_session",
    "reader_ban",
    "reader_unconfirmed",
    "reader_suspended",
    "explicit_revoke",
  ])("cuts off an existing ticket after %s", async (boundary) => {
    const f = await linked(),
      reader = await actor("nurse"),
      r = await issue(f);
    await consume(reader, r);
    if (boundary === "parent_logout" || boundary === "reader_logout")
      await db.query("delete from auth.sessions where id=$1", [
        boundary === "parent_logout" ? f.parent.session : reader.session,
      ]);
    if (boundary.endsWith("expired_session"))
      await db.query(
        "update auth.sessions set not_after=now()-interval '1 minute' where id=$1",
        [boundary.startsWith("parent") ? f.parent.session : reader.session],
      );
    if (boundary.endsWith("ban"))
      await db.query(
        "update auth.users set banned_until=now()+interval '1 day' where id=$1",
        [boundary.startsWith("parent") ? f.parent.id : reader.id],
      );
    if (boundary.endsWith("unconfirmed"))
      await db.query(
        "update auth.users set email_confirmed_at=null where id=$1",
        [boundary.startsWith("parent") ? f.parent.id : reader.id],
      );
    if (boundary === "reader_suspended")
      await db.query(
        "update public.professional_profiles set verification_status='suspended' where user_id=$1",
        [reader.id],
      );
    if (boundary === "link_revoke")
      await rpc(f.parent, "revoke_guardian_link", [f.link, reason]);
    if (boundary === "link_expire")
      await db.query(
        "update private.guardian_links set expires_at=now()-interval '1 minute' where id=$1",
        [f.link],
      );
    if (boundary === "link_export")
      await db.query(
        "update private.guardian_links set can_export=false where id=$1",
        [f.link],
      );
    if (boundary === "explicit_revoke")
      await rpc(f.parent, "revoke_clinician_share", [r.id]);
    await expect(
      rpc(reader, "read_clinician_share", [r.id, 1]),
    ).rejects.toMatchObject(denied);
  });
  it("denies expired codes/tickets and never shares a provisional workspace", async () => {
    const f = await linked(),
      reader = await actor("doctor"),
      r = await issue(f);
    const expired = randomBytes(32).toString("base64url"),
      id = randomUUID();
    await db.query(
      "insert into private.clinician_shares(id,child_id,guardian_id,guardian_link_id,issuer_session,token_hash,scope,created_at,expires_at,consumed_at,recipient_id,recipient_session,professional_id) values($1,$2,$3,$4,$5,$6,'vaccination_read',now()-interval '10 minutes',now()-interval '5 minutes',now()-interval '9 minutes',$7,$8,$9)",
      [
        id,
        f.child,
        f.parent.id,
        f.link,
        f.parent.session,
        createHash("sha256").update(expired).digest("hex"),
        reader.id,
        reader.session,
        `QA-${reader.id}`,
      ],
    );
    expect(await rpc(reader, "redeem_clinician_share", [expired])).toEqual({
      accepted: false,
    });
    await expect(
      rpc(reader, "read_clinician_share", [id, 1]),
    ).rejects.toMatchObject(denied);
    const unverified = await actor("nurse", "unverified");
    const child = await rpc<string>(unverified, "create_provisional_child", [
      randomUUID(),
      {
        given_name: "Enfant fictif",
        family_name: randomUUID(),
        name_status: "confirmed",
        birth_date: "2025-01-01",
        birth_date_precision: "exact",
        sex: "unknown",
      },
    ]);
    await expect(
      rpc(f.parent, "issue_clinician_share", [child, "booklet_read", true]),
    ).rejects.toMatchObject(denied);
    await expect(
      rpc(unverified, "redeem_clinician_share", [r.token]),
    ).rejects.toMatchObject(denied);
    await db.query(
      "update public.professional_profiles set verification_status='approved',professional_id=$2 where user_id=$1",
      [unverified.id, `QA-${unverified.id}`],
    );
    await expect(
      rpc(f.parent, "issue_clinician_share", [child, "booklet_read", true]),
    ).rejects.toMatchObject(denied);
  });
});
