import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
} from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { mobileDatabase } from "./helpers/database";
import {
  readVaccineSelection,
  vaccineKey,
  type VaccineChoice,
} from "../src/lib/vaccines/choices";
let db: PGlite;
type Actor = { id: string; session: string };
async function actor(role = "doctor", status = "unverified") {
  const a = { id: randomUUID(), session: randomUUID() };
  await db.query<Record<string, unknown>>(
    "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
    [a.id, `qa-${a.id}@example.invalid`],
  );
  await db.query<Record<string, unknown>>(
    "insert into auth.sessions(id,user_id) values($1,$2)",
    [a.session, a.id],
  );
  await db.query<Record<string, unknown>>(
    "insert into public.professional_profiles(user_id,role,verification_status,professional_id) values($1,$2,$3,$4)",
    [a.id, role, status, status === "approved" ? `QA-${a.id}` : null],
  );
  return a;
}
async function rpc<T = unknown>(
  a: Actor,
  name: string,
  args: unknown[] = [],
): Promise<T> {
  await db.exec("savepoint smart_form_rpc");
  try {
    await db.query<Record<string, unknown>>(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.session_id',$2,false)",
      [a.id, a.session],
    );
    await db.exec("set role authenticated");
    const result = await db.query<Record<string, unknown>>(
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) value`,
      args,
    );
    await db.exec("reset role; release savepoint smart_form_rpc");
    return result.rows[0].value as T;
  } catch (error) {
    await db.exec(
      "rollback to savepoint smart_form_rpc; reset role; release savepoint smart_form_rpc",
    );
    throw error;
  }
}
const create = (a: Actor) =>
  rpc<string>(a, "create_provisional_child", [
    randomUUID(),
    { name_status: "unknown", birth_date_precision: "unknown", sex: "unknown" },
  ]);
const write = (
  a: Actor,
  child: string,
  payload: object,
  operation = randomUUID(),
) =>
  rpc<string>(a, "write_provisional_entry", [
    operation,
    child,
    "vaccination",
    null,
    "unknown",
    "paper_transcription",
    "Source entièrement fictive",
    payload,
  ]);
beforeAll(async () => {
  db = await mobileDatabase();
  await db.exec(
    readFileSync(
      "supabase/migrations/20261115101145_smart_form_vaccine_choices.sql",
      "utf8",
    ),
  );
});
beforeEach(async () => {
  await db.exec("begin");
});
afterEach(async () => {
  await db.exec("rollback");
});
afterAll(async () => {
  await db?.close();
});
describe("smart vaccine vocabulary and quarantined recording on the complete schema", () => {
  it("exposes only the 25 source dose names/codes and truthful draft status to current clinicians", async () => {
    const choices = await rpc<VaccineChoice[]>(
      await actor(),
      "vaccine_form_choices",
    );
    expect(choices).toHaveLength(25);
    expect(choices.every((c) => c.status === "draft")).toBe(true);
    expect(choices.find((c) => c.dose_code === "BCG")?.vaccine_label).toContain(
      "Tuberculose",
    );
    for (const c of choices)
      expect(Object.keys(c).sort()).toEqual([
        "dose_code",
        "status",
        "vaccine_code",
        "vaccine_label",
        "version_id",
        "version_label",
      ]);
    expect(await rpc(await actor("nurse"), "vaccine_form_choices")).toEqual(
      choices,
    );
    for (const a of [
      await actor("admin", "approved"),
      await actor("doctor", "suspended"),
      await actor("doctor", "rejected"),
    ])
      await expect(rpc(a, "vaccine_form_choices")).rejects.toMatchObject({
        code: "42501",
      });
    const stale = await actor();
    await db.query<Record<string, unknown>>(
      "delete from auth.sessions where id=$1",
      [stale.session],
    );
    await expect(rpc(stale, "vaccine_form_choices")).rejects.toMatchObject({
      code: "42501",
    });
  });
  it("rejects a dose from another vaccine and never trusts submitted hidden labels", async () => {
    const a = await actor();
    const choices = await rpc<VaccineChoice[]>(a, "vaccine_form_choices");
    const vpo = choices.find((c) => c.dose_code === "VPO1")!;
    const form = new FormData();
    form.set("vaccine_choice", vaccineKey(vpo));
    form.set("dose_choice", "PCV1");
    expect(() => readVaccineSelection(form, choices)).toThrow();
    form.set("dose_choice", "VPO1");
    form.set("vaccine_label", "forged");
    const selection = readVaccineSelection(form, choices);
    expect(selection.vaccine_label).toBe(vpo.vaccine_label);
    const child = await create(a),
      operation = randomUUID();
    const entry = await write(a, child, selection, operation);
    expect(await write(a, child, selection, operation)).toBe(entry);
    const row = (
      await db.query<Record<string, unknown>>(
        "select payload,validation_state,revision from private.provisional_entries where id=$1",
        [entry],
      )
    ).rows[0];
    expect(row).toMatchObject({
      payload: selection,
      validation_state: "unverified",
      revision: 1,
    });
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select count(*)::integer n from public.clinical_entries where child_id=$1",
          [child],
        )
      ).rows[0].n,
    ).toBe(0);
    await expect(
      write(a, child, { ...selection, dose_code: "PCV1", dose_label: "PCV1" }),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(write(await actor(), child, selection)).rejects.toMatchObject({
      code: "42501",
    });
  });
  it("preserves exact custom wording and unknown dose without an official mapping or schedule", async () => {
    const a = await actor(),
      child = await create(a),
      form = new FormData();
    form.set("vaccine_choice", "other");
    form.set("vaccine_label", "Vaccin privé fictif — libellé ORIGINAL");
    form.set("dose_choice", "unknown");
    const selection = readVaccineSelection(form, []);
    const payload = {
      vaccine_label: selection.vaccine_label,
      dose_label: selection.dose_label,
    };
    const entry = await write(a, child, payload);
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select payload from private.provisional_entries where id=$1",
          [entry],
        )
      ).rows[0].payload,
    ).toEqual({
      vaccine_label: "Vaccin privé fictif — libellé ORIGINAL",
      dose_label: "Dose inconnue / non précisée",
    });
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select count(*)::integer n from public.child_vaccine_items where child_id=$1",
          [child],
        )
      ).rows[0].n,
    ).toBe(0);
    form.set("dose_choice", "other");
    form.set("dose_label", "Rappel déclaré, incertain");
    expect(readVaccineSelection(form, []).dose_label).toBe(
      "Rappel déclaré, incertain",
    );
    form.set("dose_label", "");
    expect(() => readVaccineSelection(form, [])).toThrow();
  });
  it("rejects invented catalog claims and retains append-only corrections and historical source", async () => {
    const a = await actor(),
      child = await create(a),
      choices = await rpc<VaccineChoice[]>(a, "vaccine_form_choices");
    const c = choices.find((c) => c.dose_code === "VPO1")!;
    const payload = {
      vaccine_label: c.vaccine_label,
      dose_label: c.dose_code,
      catalog_version_id: c.version_id,
      catalog_status: c.status,
      vaccine_code: c.vaccine_code,
      dose_code: c.dose_code,
    };
    await expect(
      write(a, child, { ...payload, catalog_status: "approved" }),
    ).rejects.toMatchObject({ code: "22023" });
    const entry = await write(a, child, payload);
    const next = await rpc<string>(a, "write_provisional_entry", [
      randomUUID(),
      child,
      "vaccination",
      null,
      "unknown",
      "paper_transcription",
      "Source fictive correction",
      {
        vaccine_label: "Nom manuel conservé",
        dose_label: "Dose inconnue / non précisée",
      },
      entry,
      1,
      "Correction entièrement fictive",
      "active",
    ]);
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select revision from private.provisional_entries where child_id=$1 order by revision",
          [child],
        )
      ).rows,
    ).toEqual([{ revision: 1 }, { revision: 2 }]);
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select previous_id from private.provisional_entries where id=$1",
          [next],
        )
      ).rows[0].previous_id,
    ).toBe(entry);
    await expect(
      rpc(a, "write_provisional_entry", [
        randomUUID(),
        child,
        "vaccination",
        null,
        "unknown",
        "paper_transcription",
        "Source fictive correction",
        payload,
        entry,
        1,
        "Correction fictive concurrente",
        "active",
      ]),
    ).rejects.toMatchObject({ code: "PT409" });
    expect(
      (
        await db.query<Record<string, unknown>>(
          "select status,revision,(select count(*)::integer from public.vaccine_rules r where r.version_id=v.id) rules from public.vaccine_versions v where parent_id is null",
        )
      ).rows,
    ).toEqual([{ status: "draft", revision: 1, rules: 25 }]);
  });
});
