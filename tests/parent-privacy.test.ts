import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { parentPrivacyDatabase, sessionActing } from "./helpers/database";
import type { CorrectionPage } from "../src/lib/parents/types";
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
beforeAll(async () => {
  db = await parentPrivacyDatabase();
});
afterAll(async () => {
  await db?.close();
});
describe("parent requests and privacy without clinical overwrite", () => {
  it("keeps contact preferences private and records changes without creating authority", async () => {
    const parent = await actor(),
      other = await actor();
    expect(await rpc(other, "parent_settings")).toMatchObject({
      settings: { contact_phone: null, email_updates: false, reminder_days: 1 },
      history: [],
      history_total: 0,
    });
    await rpc(parent, "save_parent_settings", ["+212 000 000 000", true, 3]);
    await rpc(parent, "save_parent_settings", [null, false, 7]);
    expect(await rpc(parent, "parent_settings")).toMatchObject({
      settings: { contact_phone: null, email_updates: false, reminder_days: 7 },
      history_total: 2,
    });
    expect(await rpc(other, "parent_settings")).toMatchObject({
      history_total: 0,
    });
    await expect(
      rpc(parent, "save_parent_settings", ["https://invalid", true, 2]),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(
      sessionActing(
        db,
        other.id,
        other.session,
        "select * from private.guardian_settings",
      ),
    ).rejects.toThrow(/permission denied/);
    expect(
      (
        await db.query(
          "select * from public.access_grants where professional_id=$1",
          [parent.id],
        )
      ).rows,
    ).toEqual([]);
  });
  it("creates an immutable, idempotent request only for the guardian's own child and entry", async () => {
    const f = await linked(),
      entry = await care(f),
      other = await actor(),
      op = randomUUID();
    const args = [op, f.child, "clinical", entry, reason];
    expect(await rpc(f.parent, "request_parent_correction", args)).toBe(op);
    expect(await rpc(f.parent, "request_parent_correction", args)).toBe(op);
    await expect(
      rpc(f.parent, "request_parent_correction", [
        op,
        f.child,
        "clinical",
        entry,
        reason + " Différent.",
      ]),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(
      rpc(other, "request_parent_correction", [
        randomUUID(),
        f.child,
        "clinical",
        entry,
        reason,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      rpc(f.parent, "request_parent_correction", [
        randomUUID(),
        f.child,
        "clinical",
        randomUUID(),
        reason,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query(
        "update private.parent_correction_requests set message=$2 where id=$1",
        [op, "Écrasement interdit fictif"],
      ),
    ).rejects.toThrow(/Append-only/);
    expect(
      (await rpc<CorrectionPage>(f.parent, "parent_corrections", [f.child, 1]))
        .items,
    ).toMatchObject([{ id: op, entry_revision: 1, response: null }]);
    expect(
      (await rpc<CorrectionPage>(other, "parent_corrections")).items,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "select revision from public.clinical_entries where child_id=$1",
          [f.child],
        )
      ).rows,
    ).toEqual([{ revision: 1 }]);
  });
  it("requires an actual attributed new amendment before a request can be marked corrected", async () => {
    const f = await linked(),
      entry = await care(f),
      request = randomUUID(),
      admin = await actor("admin"),
      otherDoctor = await actor("doctor");
    await rpc(f.parent, "request_parent_correction", [
      request,
      f.child,
      "clinical",
      entry,
      reason,
    ]);
    for (const who of [f.parent, admin, otherDoctor])
      await expect(
        rpc(who, "respond_parent_correction", [
          randomUUID(),
          request,
          "answered",
          reason,
          null,
        ]),
      ).rejects.toMatchObject({ code: "42501" });
    await expect(
      rpc(f.doctor, "respond_parent_correction", [
        randomUUID(),
        request,
        "corrected",
        reason,
        entry,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    const amendment = await care(f, entry);
    const queue = await rpc<CorrectionPage>(
      f.doctor,
      "doctor_parent_corrections",
      [f.child, 1],
    );
    expect(queue.items[0].correction_options).toMatchObject([
      { id: amendment, revision: 2 },
    ]);
    const op = randomUUID(),
      args = [op, request, "corrected", reason, amendment];
    expect(await rpc(f.doctor, "respond_parent_correction", args)).toBe(op);
    expect(await rpc(f.doctor, "respond_parent_correction", args)).toBe(op);
    await expect(
      rpc(f.doctor, "respond_parent_correction", [
        randomUUID(),
        request,
        "answered",
        reason,
        null,
      ]),
    ).rejects.toMatchObject({ code: "PT409" });
    expect(
      (await rpc<CorrectionPage>(f.parent, "parent_corrections", [f.child, 1]))
        .items[0].response,
    ).toMatchObject({
      outcome: "corrected",
      correction_entry_id: amendment,
      professional_id: `GUARDIAN-${f.doctor.id}`,
    });
    expect(
      (
        await db.query(
          "select revision from public.clinical_entries where child_id=$1 order by revision",
          [f.child],
        )
      ).rows,
    ).toEqual([{ revision: 1 }, { revision: 2 }]);
    await expect(
      db.query("delete from private.parent_correction_responses where id=$1", [
        op,
      ]),
    ).rejects.toThrow(/Append-only/);
  });
  it("lets the requester withdraw while keeping the original; another guardian cannot respond or read it", async () => {
    const f = await linked(),
      second = await actor(),
      request = randomUUID();
    const invitation = await invite(f.doctor, second, f.child);
    await approve(f.doctor, await claim(second, invitation.token));
    await rpc(f.parent, "request_parent_correction", [
      request,
      f.child,
      "identity",
      null,
      reason,
    ]);
    expect(
      (await rpc<CorrectionPage>(second, "parent_corrections", [f.child, 1]))
        .items,
    ).toEqual([]);
    await expect(
      rpc(second, "respond_parent_correction", [
        randomUUID(),
        request,
        "withdrawn",
        reason,
        null,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await rpc(f.parent, "respond_parent_correction", [
      randomUUID(),
      request,
      "withdrawn",
      reason,
      null,
    ]);
    expect(
      (await rpc<CorrectionPage>(f.parent, "parent_corrections", [f.child, 1]))
        .items[0].response,
    ).toMatchObject({ outcome: "withdrawn" });
    expect(
      (
        await db.query(
          "select id from private.parent_correction_requests where id=$1",
          [request],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("shows scoped access metadata after the guardian link without exposing other guardians' identities", async () => {
    const f = await linked(),
      second = await actor(),
      stranger = await actor();
    const invitation = await invite(f.doctor, second, f.child);
    await approve(f.doctor, await claim(second, invitation.token));
    await rpc(f.doctor, "get_child_profile", [f.child]);
    await rpc(second, "parent_child_booklet", [f.child, 1]);
    const view = await rpc<{
      items: {
        actor_type: string;
        professional_id: string | null;
        entity_type: string;
      }[];
      since: string;
    }>(f.parent, "parent_access_history", [f.child, 1]);
    expect(view.items).toContainEqual(
      expect.objectContaining({
        actor_type: "professional",
        professional_id: `GUARDIAN-${f.doctor.id}`,
        entity_type: "child_profile_read",
      }),
    );
    expect(view.items).toContainEqual(
      expect.objectContaining({
        actor_type: "guardian",
        professional_id: null,
        entity_type: "guardian_booklet_read",
      }),
    );
    expect(JSON.stringify(view)).not.toContain(second.id);
    expect(JSON.stringify(view)).not.toContain(second.email);
    await expect(
      rpc(stranger, "parent_access_history", [f.child, 1]),
    ).rejects.toMatchObject({ code: "42501" });
    const link = (
      await db.query<{ id: string }>(
        "select id from private.guardian_links where guardian_id=$1 and child_id=$2",
        [f.parent.id, f.child],
      )
    ).rows[0].id;
    await rpc(f.parent, "revoke_guardian_link", [link, reason]);
    await expect(
      rpc(f.parent, "parent_access_history", [f.child, 1]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      rpc(f.parent, "request_parent_correction", [
        randomUUID(),
        f.child,
        "other",
        null,
        reason,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("bounds pending requests and denies stale/banned accounts", async () => {
    const f = await linked();
    for (let i = 0; i < 10; i++)
      await rpc(f.parent, "request_parent_correction", [
        randomUUID(),
        f.child,
        "other",
        null,
        reason,
      ]);
    await expect(
      rpc(f.parent, "request_parent_correction", [
        randomUUID(),
        f.child,
        "other",
        null,
        reason,
      ]),
    ).rejects.toMatchObject({ code: "PT429" });
    await db.query(
      "update auth.users set banned_until=now()+interval '1 hour' where id=$1",
      [f.parent.id],
    );
    await expect(rpc(f.parent, "parent_settings")).rejects.toMatchObject({
      code: "42501",
    });
    await db.query("update auth.users set banned_until=null where id=$1", [
      f.parent.id,
    ]);
    await db.query("delete from auth.sessions where id=$1", [f.parent.session]);
    await expect(rpc(f.parent, "parent_corrections")).rejects.toMatchObject({
      code: "42501",
    });
  });
});
