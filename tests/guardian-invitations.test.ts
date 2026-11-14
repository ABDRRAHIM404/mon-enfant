import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { guardianDatabase, sessionActing } from "./helpers/database";
import type {
  ParentBooklet,
  ParentWorkspaceData,
} from "../src/lib/parents/types";
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
    await db.query<{ day: string }>(
      "select ((now() at time zone 'Africa/Casablanca')::date+30)::text day",
    )
  ).rows[0].day;
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
beforeAll(async () => {
  db = await guardianDatabase();
});
afterAll(async () => {
  await db?.close();
});
describe("separate verified guardian authority", () => {
  it("stores only a hash, binds the verified recipient and keeps pending claims private and retry-safe", async () => {
    const { doctor, parent, child } = await setup(),
      other = await actor();
    const invitation = await invite(doctor, parent, child),
      op = randomUUID();
    await expect(claim(other, invitation.token)).rejects.toMatchObject({
      code: "42501",
    });
    const claimId = await claim(parent, invitation.token, op);
    expect(await claim(parent, invitation.token, op)).toBe(claimId);
    await expect(claim(parent, invitation.token)).rejects.toMatchObject({
      code: "PT409",
    });
    const workspace = await rpc<ParentWorkspaceData>(
      parent,
      "parent_workspace",
    );
    expect(workspace.children).toEqual([]);
    expect(workspace.claims).toEqual([
      { id: claimId, state: "pending", created_at: expect.any(String) },
    ]);
    await expect(
      rpc(parent, "parent_child_booklet", [child, 1]),
    ).rejects.toMatchObject({ code: "42501" });
    const stored = await db.query<{ token_hash: string }>(
      "select token_hash from private.guardian_invitations where id=$1",
      [invitation.id],
    );
    expect(stored.rows[0].token_hash).toBe(invitation.hash);
    const receipts = await db.query<{ payload: unknown }>(
      "select payload from private.guardian_claim_operations where actor_id=$1",
      [parent.id],
    );
    expect(JSON.stringify(receipts.rows)).not.toContain(invitation.token);
    expect(
      (
        await db.query(
          "select * from public.professional_profiles where user_id=$1",
          [parent.id],
        )
      ).rows,
    ).toEqual([]);
  });
  it("rejects expired and replaced invitations without exposing a child", async () => {
    const { doctor, parent, child } = await setup();
    const old = await invite(doctor, parent, child);
    await invite(doctor, parent, child);
    await expect(claim(parent, old.token)).rejects.toMatchObject({
      code: "42501",
    });
    // Historical expiry fixture is inserted directly; immutable facts are not edited.
    const token = randomBytes(32).toString("base64url");
    await db.query(
      "insert into private.guardian_invitations(child_id,created_by,recipient_email,token_hash,reason,created_at,expires_at) values($1,$2,$3,$4,$5,now()-interval '2 days',now()-interval '1 day')",
      [
        child,
        doctor.id,
        parent.email,
        createHash("sha256").update(token).digest("hex"),
        reason,
      ],
    );
    await expect(claim(parent, token)).rejects.toMatchObject({ code: "42501" });
  });
  it("requires current child-management permission and both independent checks", async () => {
    const { doctor, parent, child } = await setup(),
      admin = await actor("admin"),
      unrelated = await actor("doctor");
    const invitation = await invite(doctor, parent, child),
      id = await claim(parent, invitation.token);
    await expect(approve(admin, id)).rejects.toMatchObject({ code: "42501" });
    await expect(approve(unrelated, id)).rejects.toMatchObject({
      code: "42501",
    });
    await expect(approve(doctor, id, false, false, true)).rejects.toMatchObject(
      { code: "22023" },
    );
    await expect(approve(doctor, id, false, true, false)).rejects.toMatchObject(
      { code: "22023" },
    );
    await db.query("update auth.users set email=$2 where id=$1", [
      parent.id,
      "changed@example.invalid",
    ]);
    await expect(approve(doctor, id)).rejects.toMatchObject({ code: "PT409" });
    await db.query("update auth.users set email=$2 where id=$1", [
      parent.id,
      parent.email,
    ]);
    await approve(doctor, id);
    expect(
      (await rpc<ParentWorkspaceData>(parent, "parent_workspace")).children.map(
        (c) => c.id,
      ),
    ).toEqual([child]);
    await expect(approve(doctor, id)).rejects.toMatchObject({ code: "PT409" });
  });
  it("denies self-review even to an approved doctor managing the child", async () => {
    const { doctor, child } = await setup();
    await rpc(doctor, "save_parent_profile", ["Responsable médecin fictif"]);
    const invitation = await invite(doctor, doctor, child),
      id = await claim(doctor, invitation.token);
    await expect(approve(doctor, id)).rejects.toMatchObject({ code: "42501" });
  });
  it("supports multiple independently approved guardians without clinical writes or cross-child reads", async () => {
    const { doctor, parent, child, facility } = await setup(),
      second = await actor();
    for (const who of [parent, second]) {
      const invitation = await invite(doctor, who, child);
      await approve(doctor, await claim(who, invitation.token));
    }
    for (const who of [parent, second]) {
      expect(
        (await rpc<ParentBooklet>(who, "parent_child_booklet", [child, 1]))
          .child.id,
      ).toBe(child);
      await expect(
        rpc(who, "parent_child_booklet", [randomUUID(), 1]),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        rpc(who, "parent_child_export", [child]),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        rpc(who, "write_clinical_entry", [
          randomUUID(),
          child,
          "consultation",
          facility,
          "2026-01-02",
          "exact",
          "observed",
          null,
          true,
          { reason: "Contrôle fictif" },
        ]),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        sessionActing(
          db,
          who.id,
          who.session,
          "select * from private.guardian_links",
        ),
      ).rejects.toThrow(/permission denied/);
    }
    const link = (
      await rpc<ParentBooklet>(parent, "parent_child_booklet", [child, 1])
    ).link;
    await rpc(parent, "revoke_guardian_link", [link.id, reason]);
    await expect(
      rpc(parent, "parent_child_booklet", [child, 1]),
    ).rejects.toMatchObject({ code: "42501" });
    expect(
      (await rpc<ParentBooklet>(second, "parent_child_booklet", [child, 1]))
        .child.id,
    ).toBe(child);
  });
  it("returns attributed current care and shared appointment states, with separate permitted export", async () => {
    const { doctor, parent, child, facility } = await setup();
    for (const capability of ["consultation", "appointment"])
      await db.query(
        "insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) values($1,$2,true,$1)",
        [doctor.id, capability],
      );
    const entry = await rpc<string>(doctor, "write_clinical_entry", [
      randomUUID(),
      child,
      "consultation",
      facility,
      "2026-01-02",
      "exact",
      "observed",
      null,
      true,
      { reason: "Contrôle entièrement fictif" },
    ]);
    await rpc(doctor, "create_appointment", [
      randomUUID(),
      child,
      facility,
      "consultation",
      "Visite fictive",
      null,
      "2026-01-02T10:00:00+01:00",
      "2026-01-02T10:30:00+01:00",
      reason,
      true,
    ]);
    const invitation = await invite(doctor, parent, child);
    await approve(doctor, await claim(parent, invitation.token), true);
    const booklet = await rpc<ParentBooklet>(parent, "parent_child_booklet", [
      child,
      1,
    ]);
    expect(booklet.entries).toMatchObject([
      {
        id: entry,
        author_id: doctor.id,
        facility_name: "Centre entièrement fictif",
      },
    ]);
    expect(booklet.appointments).toMatchObject([
      { effective_state: "missed", professional_id: `GUARDIAN-${doctor.id}` },
    ]);
    const exported = await rpc<{
      clinical_entries: { id: string }[];
      appointments: unknown[];
    }>(parent, "parent_child_export", [child]);
    expect(exported.clinical_entries.map((e) => e.id)).toEqual([entry]);
    expect(exported.appointments).toHaveLength(1);
    const unrelated = await actor();
    await expect(
      rpc(unrelated, "parent_child_export", [child]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("honors ban, session expiry and professional revocation, preserving immutable decision facts", async () => {
    const { doctor, parent, child } = await setup();
    const invitation = await invite(doctor, parent, child);
    const decision = await approve(
      doctor,
      await claim(parent, invitation.token),
      true,
    );
    await expect(
      db.query(
        "update private.guardian_links set can_export=false where id=$1",
        [decision],
      ),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(
      db.query("delete from private.guardian_decisions where id=$1", [
        decision,
      ]),
    ).rejects.toThrow(/Append-only/);
    await db.query(
      "update auth.users set banned_until=now()+interval '1 hour' where id=$1",
      [parent.id],
    );
    await expect(
      rpc(parent, "parent_child_export", [child]),
    ).rejects.toMatchObject({ code: "42501" });
    await db.query("update auth.users set banned_until=null where id=$1", [
      parent.id,
    ]);
    await rpc(doctor, "revoke_guardian_link", [decision, reason]);
    await expect(
      rpc(parent, "parent_child_export", [child]),
    ).rejects.toMatchObject({ code: "42501" });
    await db.query("delete from auth.sessions where id=$1", [parent.session]);
    await expect(rpc(parent, "parent_workspace")).rejects.toMatchObject({
      code: "42501",
    });
  });
});
