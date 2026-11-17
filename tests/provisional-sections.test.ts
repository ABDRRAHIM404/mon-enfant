import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { clinicianUpdatesDatabase } from "./helpers/database";
import type { ProvisionalFollowup } from "../src/lib/vaccines/provisional-followup";
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
  await db.exec(
    readFileSync(
      "supabase/migrations/20261117172314_provisional_vaccination_followup.sql",
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

for (const role of ["doctor", "nurse"])
  it(`${role} can read routine ages for only their private child without account approval`, async () => {
    const a = await actor(role),
      b = await actor(),
      own = await child(a),
      other = await child(b);
    const r = await rpc<ProvisionalFollowup>(
      a,
      "provisional_vaccination_followup",
      [own],
    );
    expect(r.version).toMatchObject({
      status: "draft",
      review_verified: false,
    });
    expect(r.rules).toHaveLength(25);
    expect(
      r.rules.find((x) => x.dose_code === "HB1")?.automatic_scheduling,
    ).toBe(false);
    expect(r.appointments).toEqual([]);
    expect(r.declarations_complete).toBe(true);
    for (const id of [other, randomUUID(), null])
      await expect(
        rpc(a, "provisional_vaccination_followup", [id]),
      ).rejects.toMatchObject({ code: "42501" });
    expect(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from public.children",
        )
      ).rows[0].n,
    ).toBe(0);
  });
it("reads only independently approved QA clone or original draft, never activates the source", async () => {
  const a = await actor(),
    editor = await actor("admin", "approved"),
    reviewer = await actor("doctor", "approved"),
    own = await child(a),
    id = randomUUID();
  await db.query(
    "insert into public.vaccine_versions(id,source_id,parent_id,label,status,revision,created_by,reviewed_by,reviewed_at,review_reference,review_verified) select $1,source_id,id,'QA local read projection','approved',2,$2,$3,now(),'Revue fictive de test uniquement',true from public.vaccine_versions where parent_id is null limit 1",
    [id, editor.id, reviewer.id],
  );
  await db.query(
    "insert into public.vaccine_rules select $1,dose_code,vaccine_code,source_row,source_age,age,eligibility,automatic_scheduling from public.vaccine_rules where version_id=(select parent_id from public.vaccine_versions where id=$1)",
    [id],
  );
  expect(
    (
      await rpc<ProvisionalFollowup>(a, "provisional_vaccination_followup", [
        own,
      ])
    ).version?.id,
  ).toBe(id);
  await db.query(
    "update public.vaccine_versions set status='retired',revision=3 where id=$1",
    [id],
  );
  expect(
    (
      await rpc<ProvisionalFollowup>(a, "provisional_vaccination_followup", [
        own,
      ])
    ).version?.status,
  ).toBe("draft");
  expect(
    (
      await db.query<{ status: string; revision: number }>(
        "select status,revision from public.vaccine_versions where parent_id is null",
      )
    ).rows[0],
  ).toEqual({ status: "draft", revision: 1 });
});
it("uses latest active declarations and appointments independently of feature pagination, and denies stale sessions/admins", async () => {
  const a = await actor(),
    own = await child(a),
    admin = await actor("admin", "approved");
  const write = (
    kind: string,
    payload: object,
    root: string | null = null,
    revision: number | null = null,
    state = "active",
  ) =>
    rpc<string>(a, "write_provisional_entry", [
      randomUUID(),
      own,
      kind,
      null,
      "unknown",
      "reported",
      null,
      payload,
      root,
      revision,
      root ? "Correction fictive pour vérifier le suivi" : null,
      state,
    ]);
  const vaccine = await write("vaccination", {
    vaccine_label: "HB fictif",
    dose_label: "HB1",
  });
  for (let i = 0; i < 31; i++)
    await write("consultation", {
      reason: "Consultation entièrement fictive de pagination",
    });
  let r = await rpc<ProvisionalFollowup>(
    a,
    "provisional_vaccination_followup",
    [own],
  );
  expect(r.declarations).toHaveLength(1);
  await write(
    "vaccination",
    { vaccine_label: "HB fictif", dose_label: "HB1" },
    vaccine,
    1,
    "withdrawn",
  );
  const payload = {
    purpose: "Suivi fictif",
    scheduled_for: new Date(Date.now() + 30 * 86400000)
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z"),
    status: "planned",
  };
  const appointment = await write("appointment", payload);
  await write(
    "appointment",
    { ...payload, status: "cancelled" },
    appointment,
    1,
  );
  await write("appointment", { ...payload, purpose: "Autre suivi conservé" });
  r = await rpc<ProvisionalFollowup>(a, "provisional_vaccination_followup", [
    own,
  ]);
  expect(r.declarations).toHaveLength(0);
  expect(r.appointments_total).toBe(1);
  expect(r.appointments[0].purpose).toBe("Autre suivi conservé");
  await expect(
    rpc(admin, "provisional_vaccination_followup", [own]),
  ).rejects.toMatchObject({ code: "42501" });
  await db.query("delete from auth.sessions where id=$1", [a.session]);
  await expect(
    rpc(a, "provisional_vaccination_followup", [own]),
  ).rejects.toMatchObject({ code: "42501" });
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from public.appointments",
      )
    ).rows[0].n,
  ).toBe(0);
});
