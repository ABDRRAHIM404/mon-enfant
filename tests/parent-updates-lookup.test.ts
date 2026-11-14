import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { parentUpdatesDatabase, sessionActing } from "./helpers/database";
import type { ParentUpdates } from "../src/lib/parents/types";
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
  db = await parentUpdatesDatabase();
});
afterAll(async () => {
  await db?.close();
});
describe("QR lookup authority and current parent notification scope", () => {
  it("resolves an identifier only for an authorized current doctor, treating unknown and unauthorized identically", async () => {
    const f = await linked(),
      unrelated = await actor("doctor"),
      admin = await actor("admin");
    const universal = (
      await db.query<{ universal_id: string }>(
        "select universal_id from public.children where id=$1",
        [f.child],
      )
    ).rows[0].universal_id;
    expect(await rpc(f.doctor, "lookup_authorized_child", [universal])).toBe(
      f.child,
    );
    expect(
      await rpc(unrelated, "lookup_authorized_child", [universal]),
    ).toBeNull();
    expect(
      await rpc(unrelated, "lookup_authorized_child", [randomUUID()]),
    ).toBeNull();
    for (const who of [f.parent, admin])
      await expect(
        rpc(who, "lookup_authorized_child", [universal]),
      ).rejects.toMatchObject({ code: "42501" });
    await db.query("delete from auth.sessions where id=$1", [f.doctor.session]);
    await expect(
      rpc(f.doctor, "lookup_authorized_child", [universal]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("derives permitted care, appointment and own-response updates without clinical/message payloads", async () => {
    const f = await linked(),
      entry = await care(f),
      request = randomUUID();
    await rpc(f.parent, "request_parent_correction", [
      request,
      f.child,
      "clinical",
      entry,
      reason,
    ]);
    await rpc(f.doctor, "respond_parent_correction", [
      randomUUID(),
      request,
      "answered",
      reason,
      null,
    ]);
    await db.query(
      "insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) values($1,'appointment',true,$1)",
      [f.doctor.id],
    );
    await rpc(f.doctor, "create_appointment", [
      randomUUID(),
      f.child,
      f.facility,
      "consultation",
      "Visite fictive",
      null,
      "2026-01-02T10:00:00+01:00",
      "2026-01-02T10:30:00+01:00",
      reason,
      true,
    ]);
    const feed = await rpc<ParentUpdates>(f.parent, "parent_updates");
    expect(new Set(feed.items.map((e) => e.kind))).toEqual(
      new Set([
        "access_approved",
        "care_recorded",
        "appointment_updated",
        "request_answered",
      ]),
    );
    expect(feed.items.every((e) => e.child_id === f.child && e.unread)).toBe(
      true,
    );
    expect(feed.unread_total).toBe(4);
    expect(JSON.stringify(feed)).not.toContain(reason);
    expect(JSON.stringify(feed)).not.toContain("Motif entièrement fictif");
    const stranger = await actor();
    expect(
      (await rpc<ParentUpdates>(stranger, "parent_updates")).items,
    ).toEqual([]);
  });
  it("marks only through the supplied server snapshot and never moves the read cursor backward", async () => {
    const f = await linked();
    const first = await rpc<ParentUpdates>(f.parent, "parent_updates");
    await rpc(f.parent, "mark_parent_updates_read", [first.generated_at]);
    expect(
      (await rpc<ParentUpdates>(f.parent, "parent_updates")).unread_total,
    ).toBe(0);
    await care(f);
    const second = await rpc<ParentUpdates>(f.parent, "parent_updates");
    expect(second.unread_total).toBe(1);
    await rpc(f.parent, "mark_parent_updates_read", ["2000-01-01T00:00:00Z"]);
    expect(
      (await rpc<ParentUpdates>(f.parent, "parent_updates")).unread_total,
    ).toBe(1);
    await expect(
      rpc(f.parent, "mark_parent_updates_read", ["2099-01-01T00:00:00Z"]),
    ).rejects.toMatchObject({ code: "22023" });
    await rpc(f.parent, "mark_parent_updates_read", [second.generated_at]);
    expect(
      (await rpc<ParentUpdates>(f.parent, "parent_updates")).unread_total,
    ).toBe(0);
  });
  it("keeps another guardian's private request replies out of the shared child feed", async () => {
    const f = await linked(),
      second = await actor();
    const invitation = await invite(f.doctor, second, f.child);
    await approve(f.doctor, await claim(second, invitation.token));
    const request = randomUUID();
    await rpc(f.parent, "request_parent_correction", [
      request,
      f.child,
      "identity",
      null,
      reason,
    ]);
    await rpc(f.doctor, "respond_parent_correction", [
      randomUUID(),
      request,
      "answered",
      reason,
      null,
    ]);
    expect(
      (await rpc<ParentUpdates>(f.parent, "parent_updates")).items.some(
        (e) => e.kind === "request_answered",
      ),
    ).toBe(true);
    expect(
      (await rpc<ParentUpdates>(second, "parent_updates")).items.some(
        (e) => e.kind === "request_answered",
      ),
    ).toBe(false);
  });
  it("removes child data immediately on revocation, retaining only a generic own-access status", async () => {
    const f = await linked();
    await care(f);
    const link = (
      await db.query<{ id: string }>(
        "select id from private.guardian_links where child_id=$1 and guardian_id=$2",
        [f.child, f.parent.id],
      )
    ).rows[0].id;
    await rpc(f.doctor, "revoke_guardian_link", [link, reason]);
    const feed = await rpc<ParentUpdates>(f.parent, "parent_updates");
    expect(feed.items).toMatchObject([
      {
        kind: "access_revoked",
        child_id: null,
        given_name: null,
        family_name: null,
      },
    ]);
    expect(feed.items).toHaveLength(1);
    expect(JSON.stringify(feed)).not.toContain(f.child);
    expect(JSON.stringify(feed)).not.toContain("Enfant fictif");
  });
  it("keeps rejected claims generic and denies stale/banned/direct-table access", async () => {
    const f = await setup();
    const invitation = await invite(f.doctor, f.parent, f.child);
    const id = await claim(f.parent, invitation.token);
    await rpc(f.doctor, "review_guardian_claim", [
      randomUUID(),
      id,
      1,
      "rejected",
      null,
      reason,
      reason,
      false,
      false,
      null,
      false,
    ]);
    const feed = await rpc<ParentUpdates>(f.parent, "parent_updates");
    expect(feed.items).toMatchObject([
      { kind: "claim_rejected", child_id: null, given_name: null },
    ]);
    expect(JSON.stringify(feed)).not.toContain(f.child);
    await expect(
      sessionActing(
        db,
        f.parent.id,
        f.parent.session,
        "select * from private.guardian_notification_reads",
      ),
    ).rejects.toThrow(/permission denied/);
    await db.query(
      "update auth.users set banned_until=now()+interval '1 hour' where id=$1",
      [f.parent.id],
    );
    await expect(rpc(f.parent, "parent_updates")).rejects.toMatchObject({
      code: "42501",
    });
    await db.query("update auth.users set banned_until=null where id=$1", [
      f.parent.id,
    ]);
    await db.query("delete from auth.sessions where id=$1", [f.parent.session]);
    await expect(rpc(f.parent, "parent_updates")).rejects.toMatchObject({
      code: "42501",
    });
  });
});
