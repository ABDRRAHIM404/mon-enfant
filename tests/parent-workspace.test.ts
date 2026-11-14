import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { parentDatabase, sessionActing } from "./helpers/database";
let db: PGlite;
type Actor = { id: string; session: string };
async function actor(confirmed = true): Promise<Actor> {
  const id = randomUUID(),
    session = randomUUID();
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)",
    [
      id,
      `parent-${id}@example.invalid`,
      confirmed ? "2026-01-01T00:00:00Z" : null,
    ],
  );
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    session,
    id,
  ]);
  return { id, session };
}
const rpc = async (a: Actor, name: string, args: unknown[] = []) =>
  sessionActing(
    db,
    a.id,
    a.session,
    `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) value`,
    args,
  );
beforeAll(async () => {
  db = await parentDatabase();
});
afterAll(async () => {
  await db.close();
});
describe("parent account is independent from professional and guardian authority", () => {
  it("saves and reads only the current parent's own label", async () => {
    const a = await actor(),
      b = await actor();
    await rpc(a, "save_parent_profile", ["Parent entièrement fictif"]);
    expect((await rpc(a, "parent_workspace")).rows[0]).toMatchObject({
      value: { profile: { display_name: "Parent entièrement fictif" } },
    });
    expect((await rpc(b, "parent_workspace")).rows).toEqual([
      { value: { profile: null } },
    ]);
    await expect(
      sessionActing(
        db,
        b.id,
        b.session,
        "select * from private.guardian_profiles",
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("does not create a professional profile, clinical capability or child grant", async () => {
    const a = await actor();
    await rpc(a, "save_parent_profile", ["Responsable fictif"]);
    const rows = await db.query<{
      profiles: number;
      capabilities: number;
      grants: number;
    }>(
      "select (select count(*)::integer from public.professional_profiles where user_id=$1) profiles,(select count(*)::integer from public.professional_capabilities where professional_id=$1) capabilities,(select count(*)::integer from public.access_grants where professional_id=$1) grants",
      [a.id],
    );
    expect(rows.rows).toEqual([{ profiles: 0, capabilities: 0, grants: 0 }]);
    await expect(
      rpc(a, "get_child_profile", [randomUUID()]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("requires confirmed accounts and denies stale or banned sessions", async () => {
    const unconfirmed = await actor(false);
    await expect(
      rpc(unconfirmed, "save_parent_profile", ["Parent fictif"]),
    ).rejects.toMatchObject({ code: "42501" });
    const a = await actor();
    await rpc(a, "save_parent_profile", ["Parent fictif"]);
    await db.query("delete from auth.sessions where id=$1", [a.session]);
    await expect(rpc(a, "parent_workspace")).rejects.toMatchObject({
      code: "42501",
    });
    const banned = await actor();
    await db.query(
      "update auth.users set banned_until=now()+interval '1 hour' where id=$1",
      [banned.id],
    );
    await expect(rpc(banned, "parent_workspace")).rejects.toMatchObject({
      code: "42501",
    });
  });
});
