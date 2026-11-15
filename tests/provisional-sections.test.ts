import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { clinicianUpdatesDatabase } from "./helpers/database";
let db: PGlite;
type Actor = { id: string; session: string };
async function actor(role = "doctor", status = "unverified"): Promise<Actor> {
  const a = { id: randomUUID(), session: randomUUID() };
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
    [a.id, `qa-${a.id}@example.invalid`],
  );
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    a.session,
    a.id,
  ]);
  await db.query(
    "insert into public.professional_profiles(user_id,role,verification_status,professional_id) values($1,$2,$3,$4)",
    [a.id, role, status, status === "approved" ? `QA-${a.id}` : null],
  );
  return a;
}
async function rpc<T = unknown>(
  a: Actor,
  name: string,
  args: unknown[],
): Promise<T> {
  await db.exec("savepoint section_rpc");
  try {
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.session_id',$2,false)",
      [a.id, a.session],
    );
    await db.exec("set role authenticated");
    const r = await db.query<{ value: T }>(
      `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) value`,
      args,
    );
    await db.exec("reset role; release savepoint section_rpc");
    return r.rows[0].value;
  } catch (e) {
    await db.exec(
      "rollback to savepoint section_rpc; reset role; release savepoint section_rpc",
    );
    throw e;
  }
}
const child = (a: Actor, identity: object = {}) =>
  rpc<string>(a, "create_provisional_child", [
    randomUUID(),
    {
      name_status: "unknown",
      birth_date_precision: "unknown",
      sex: "unknown",
      ...identity,
    },
  ]);
const section = (
  a: Actor,
  id: string | null,
  kind = "vaccination",
  page = 1,
  query = "",
) =>
  rpc<{
    children: { id: string }[];
    children_total: number;
    selected_child: { id: string } | null;
    entries: { revision: number; payload: { dose_label?: string } }[];
    total: number;
  }>(a, "provisional_section", [kind, id, page, query, 1]);
beforeAll(async () => {
  db = await clinicianUpdatesDatabase();
  await db.exec(
    readFileSync(
      "supabase/migrations/20261115161000_provisional_feature_views.sql",
      "utf8",
    ),
  );
});
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("begin");
});
afterEach(async () => {
  await db.exec("rollback");
});
for (const role of ["doctor", "nurse"])
  it(`${role} gets feature-filtered latest history before pagination, never another author's children`, async () => {
    const a = await actor(role),
      b = await actor();
    const own = await child(a, {
        name_status: "confirmed",
        given_name: "Enfant",
        family_name: "Fictif",
      }),
      other = await child(b);
    const original = await rpc<string>(a, "write_provisional_entry", [
      randomUUID(),
      own,
      "vaccination",
      null,
      "unknown",
      "paper_transcription",
      "Papier entièrement fictif",
      { vaccine_label: "HB fictif", dose_label: "HB1" },
    ]);
    for (let i = 0; i < 31; i++)
      await rpc(a, "write_provisional_entry", [
        randomUUID(),
        own,
        "consultation",
        null,
        "unknown",
        "reported",
        null,
        { reason: "Consultation entièrement fictive" },
      ]);
    await rpc(a, "write_provisional_entry", [
      randomUUID(),
      own,
      "vaccination",
      null,
      "unknown",
      "paper_transcription",
      "Papier entièrement fictif corrigé",
      { vaccine_label: "HB fictif", dose_label: "HB1" },
      original,
      1,
      "Précision entièrement fictive de la provenance.",
    ]);
    const r = await section(a, own);
    expect(r.children.map((c) => c.id)).toEqual([own]);
    expect(r.total).toBe(1);
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].revision).toBe(2);
    expect(r.entries[0].payload.dose_label).toBe("HB1");
    expect((await section(a, own, "consultation", 2)).entries).toHaveLength(1);
    expect((await section(a, null, "all", 1, "absent")).children_total).toBe(0);
    expect((await section(a, null, "all", 1, "Fictif")).children_total).toBe(1);
    await expect(section(a, other)).rejects.toMatchObject({ code: "42501" });
    await db.query(
      "update public.professional_profiles set verification_status='approved',professional_id=$1 where user_id=$2",
      [`QA-${a.id}`, a.id],
    );
    expect((await section(a, own)).total).toBe(1);
    await expect(section(b, own)).rejects.toMatchObject({ code: "42501" });
    expect(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from public.children",
        )
      ).rows[0].n,
    ).toBe(0);
  });
it("requires a current clinician session and rejects administrative role alone", async () => {
  const a = await actor(),
    admin = await actor("admin", "approved"),
    own = await child(a);
  await expect(section(admin, own)).rejects.toMatchObject({ code: "42501" });
  await db.query("delete from auth.sessions where id=$1", [a.session]);
  await expect(section(a, own)).rejects.toMatchObject({ code: "42501" });
});
it("rejects malformed feature and pagination queries", async () => {
  const a = await actor();
  await expect(section(a, null, "unsupported")).rejects.toMatchObject({
    code: "22023",
  });
  await expect(section(a, null, "all", 0)).rejects.toMatchObject({
    code: "22023",
  });
  await expect(
    section(a, null, "all", 1, "x".repeat(101)),
  ).rejects.toMatchObject({ code: "22023" });
});
