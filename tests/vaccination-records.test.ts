import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { vaccinationDatabase, sessionActing } from "./helpers/database";
let db: PGlite;
type Actor = { id: string; session: string };
type Payload = Record<string, string>;
type Item = {
  id: string;
  version_id: string;
  state: string;
  revision: number;
  documented_entries: { id: string; professional_id: string }[];
};
async function actor(
  role = "doctor",
  manage = false,
  review = false,
  capable = true,
): Promise<Actor> {
  const id = randomUUID(),
    session = randomUUID();
  await db.query("insert into auth.users(id) values($1)", [id]);
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    session,
    id,
  ]);
  await db.query(
    "insert into public.professional_profiles(user_id,role,verification_status,professional_id) values($1,$2,'approved',$3)",
    [id, role, `VAX-${id}`],
  );
  await db.query(
    "insert into private.staff_permissions(user_id,can_manage_vaccine_catalog,can_review_vaccine_catalog) values($1,$2,$3)",
    [id, manage, review],
  );
  if (capable && role === "doctor")
    await db.query(
      "insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) values($1,'vaccination',true,$1)",
      [id],
    );
  return { id, session };
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
    `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`,
    args,
  );
  return (result.rows[0] as { value: T }).value;
}
let version: string, seed: string, editor: Actor, reviewer: Actor;
const reason = "Décision fictive documentée pour le test technique.";
async function setup(sex = "female", precision = "exact") {
  const a = await actor(),
    facility = await rpc<string>(a, "create_facility", [
      randomUUID(),
      "Centre fictif",
      "Rabat",
    ]);
  const child = await rpc<string>(a, "register_child", [
    randomUUID(),
    {
      facility_id: facility,
      register_year: 2026,
      register_book: "V",
      local_number: "125",
      given_name: "Enfant",
      family_name: randomUUID(),
      birth_date: precision === "unknown" ? null : "2025-01-01",
      birth_date_precision: precision,
      sex,
      source_type:
        precision === "unknown" ? "paper_transcription" : "new_registration",
      paper_reference:
        precision === "unknown" ? "Registre fictif page 1" : null,
    },
  ]);
  return { a, facility, child };
}
async function assign(
  a: Actor,
  child: string,
  facility: string,
  dose = "VPO1",
  v = version,
  op = randomUUID(),
) {
  return rpc<string>(a, "assign_vaccine_item", [
    op,
    child,
    v,
    dose,
    facility,
    reason,
    true,
  ]);
}
function payload(item = "", code = "VPO"): Payload {
  return {
    vaccine_code: code,
    vaccine_label: "Vaccin fictif",
    dose_label: "",
    lot_status: "unknown",
    lot_number: "",
    site_status: "unknown",
    site: "",
    provider_status: "unknown",
    administered_by: "",
    administration_facility_status: "unknown",
    administration_facility: "",
    matching_status: item ? "clinician_validated" : "unmatched",
    schedule_item_id: item,
    duplicate_override_reason: "",
    notes: "Saisie fictive",
  };
}
function entry(child: string, facility: string, p = payload()): unknown[] {
  return [
    randomUUID(),
    child,
    "vaccination",
    facility,
    "2026-01-02",
    "exact",
    "observed",
    null,
    true,
    p,
  ];
}
async function items(a: Actor, child: string) {
  return (await rpc<{ items: Item[] }>(a, "patient_vaccine_items", [child]))
    .items;
}
beforeAll(async () => {
  db = await vaccinationDatabase();
  editor = await actor("admin", true);
  reviewer = await actor("doctor", false, true);
  const list = await rpc<{
    versions: { id: string; revision: number; parent_id: string | null }[];
  }>(reviewer, "vaccine_catalog");
  const source = list.versions.find((v) => !v.parent_id)!;
  seed = source.id;
  version = await rpc<string>(editor, "change_vaccine_catalog", [
    randomUUID(),
    "clone",
    seed,
    source.revision,
    { label: "Version fictive de tests", reason, evidence_reference: reason },
  ]);
  await rpc(reviewer, "change_vaccine_catalog", [
    randomUUID(),
    "approve",
    version,
    1,
    {
      reason,
      evidence_reference: reason,
      source_authenticated: true,
      clinical_reviewed: true,
      birth_window_reviewed: true,
    },
  ]);
});
afterAll(async () => {
  await db?.close();
});
describe("current vaccination records and intended items", () => {
  it("keeps new tables private with RLS and prevents bypassing the clinical wrapper", async () => {
    const a = await actor();
    for (const table of [
      "child_vaccine_items",
      "vaccine_item_changes",
      "vaccination_entry_links",
      "vaccination_duplicate_overrides",
    ])
      await expect(
        sessionActing(db, a.id, a.session, `select * from public.${table}`),
      ).rejects.toThrow(/permission denied/);
    await expect(
      sessionActing(
        db,
        a.id,
        a.session,
        "select private.write_clinical_entry_base(null,null,'vaccination',null,null,'unknown','reported_history','test',false,'{}')",
      ),
    ).rejects.toThrow(/permission denied/);
    const r = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r'",
    );
    expect(r.rows.every((t) => t.relrowsecurity)).toBe(true);
  });
  it("requires vaccination capability, child authorization, facility and reviewed source", async () => {
    const { a, child, facility } = await setup(),
      outside = await actor();
    await expect(assign(a, child, facility, "VPO1", seed)).rejects.toThrow(
      /Approved routine/,
    );
    await expect(assign(a, child, facility, "HB1")).rejects.toThrow(/HB1/);
    await expect(assign(outside, child, facility)).rejects.toThrow(
      /child access/,
    );
    await expect(assign(editor, child, facility)).rejects.toThrow(
      /Approved doctor/,
    );
    await db.query(
      "update public.professional_capabilities set enabled=false where professional_id=$1",
      [a.id],
    );
    await expect(assign(a, child, facility)).rejects.toThrow(/capability/);
    await expect(
      rpc(a, "write_clinical_entry", entry(child, facility)),
    ).rejects.toThrow(/capability/);
  });
  it("assigns an immutable versioned item without inventing an appointment or administration", async () => {
    const { a, child, facility } = await setup(),
      op = randomUUID(),
      id = await assign(a, child, facility, "VPO1", version, op);
    expect(await assign(a, child, facility, "VPO1", version, op)).toBe(id);
    expect(await items(a, child)).toMatchObject([
      {
        id,
        version_id: version,
        dose_code: "VPO1",
        state: "active",
        revision: 1,
        documented_entries: [],
      },
    ]);
    await expect(assign(a, child, facility)).rejects.toMatchObject({
      code: "PT409",
    });
    await expect(
      db.query(
        "update public.child_vaccine_items set dose_code='VPO2' where id=$1",
        [id],
      ),
    ).rejects.toThrow(/Append-only/);
    await expect(
      db.query("delete from public.vaccine_item_changes where item_id=$1", [
        id,
      ]),
    ).rejects.toThrow(/Append-only/);
  });
  it("keeps HPV eligibility unknown/ineligible and does not invent dates for paper history", async () => {
    for (const sex of ["unknown", "male"]) {
      const { a, child, facility } = await setup(sex);
      await expect(assign(a, child, facility, "HPV")).rejects.toThrow(
        /Eligibility/,
      );
    }
    const { a, child, facility } = await setup("female", "unknown");
    await assign(a, child, facility, "HPV");
    expect((await items(a, child))[0]).not.toHaveProperty("due_on");
  });
  it("does not fulfill an item from an unmatched or uncertain historical entry", async () => {
    const { a, child, facility } = await setup(),
      item = await assign(a, child, facility);
    const args = entry(child, facility);
    args[4] = null;
    args[5] = "unknown";
    args[6] = "paper_transcription";
    args[7] = "Registre fictif page 15";
    args[8] = false;
    const id = await rpc<string>(a, "write_clinical_entry", args);
    expect((await items(a, child))[0].documented_entries).toEqual([]);
    expect(await rpc(a, "clinical_entry_history", [child, id])).toMatchObject([
      {
        occurred_on: null,
        source_verified: false,
        payload: { matching_status: "unmatched" },
        vaccine_mapping: null,
      },
    ]);
    const matched = entry(child, facility, payload(item));
    matched[8] = false;
    await expect(rpc(a, "write_clinical_entry", matched)).rejects.toThrow(
      /verified source/,
    );
  });
  it("records lot/site/provider uncertainty explicitly and rejects forged or contradictory data", async () => {
    const { a, child, facility } = await setup();
    for (const p of [
      { ...payload(), lot_status: "known", lot_number: "" },
      { ...payload(), site: "Bras fictif" },
      { ...payload(), vaccine_code: "" },
      {
        ...payload(),
        matching_status: "clinician_validated",
        schedule_item_id: "",
      },
      { ...payload(), source_author: "forged" },
    ])
      await expect(
        rpc(a, "write_clinical_entry", entry(child, facility, p)),
      ).rejects.toThrow();
    const p = {
      ...payload(),
      lot_status: "known",
      lot_number: "LOT-FICTIF",
      site_status: "known",
      site: "Site fictif",
      provider_status: "known",
      administered_by: "Professionnel externe fictif",
      administration_facility_status: "known",
      administration_facility: "Centre externe fictif",
    };
    const id = await rpc(a, "write_clinical_entry", entry(child, facility, p));
    expect(await rpc(a, "clinical_entry_history", [child, id])).toMatchObject([
      {
        author_id: a.id,
        professional_id: `VAX-${a.id}`,
        facility_id: facility,
        payload: p,
      },
    ]);
  });
  it("lets an authorized second doctor fulfill the exact shared item with their own attribution", async () => {
    const { a, child, facility } = await setup(),
      item = await assign(a, child, facility),
      b = await actor(),
      fb = await rpc<string>(b, "create_facility", [
        randomUUID(),
        "Centre B fictif",
        "Rabat",
      ]);
    await db.query(
      "insert into public.access_grants(child_id,professional_id,granted_by) values($1,$2,$3)",
      [child, b.id, a.id],
    );
    const args = entry(child, fb, payload(item)),
      id = await rpc<string>(b, "write_clinical_entry", args);
    expect(await rpc(b, "write_clinical_entry", args)).toBe(id);
    expect(await items(a, child)).toMatchObject([
      {
        id: item,
        documented_entries: [{ id, professional_id: `VAX-${b.id}` }],
      },
    ]);
    expect(await rpc(a, "clinical_export", [child])).toMatchObject([
      {
        id,
        author_id: b.id,
        vaccine_mapping: {
          item_id: item,
          version_id: version,
          dose_code: "VPO1",
        },
      },
    ]);
    const other = await setup();
    await expect(
      rpc(
        other.a,
        "write_clinical_entry",
        entry(other.child, other.facility, payload(item)),
      ),
    ).rejects.toThrow(/Intended item denied/);
  });
  it("requires audited review for potential duplicate administrations and preserves retry safety", async () => {
    const { a, child, facility } = await setup(),
      item = await assign(a, child, facility),
      p = payload(item);
    const original = await rpc<string>(
      a,
      "write_clinical_entry",
      entry(child, facility, p),
    );
    await expect(
      rpc(a, "write_clinical_entry", entry(child, facility, p)),
    ).rejects.toMatchObject({
      code: "PT409",
      hint: "vaccine_duplicate_review",
    });
    expect(
      await rpc(a, "check_vaccination_duplicates", [child, p, "2026-01-02"]),
    ).toMatchObject([{ id: original }]);
    const override = {
        ...p,
        duplicate_override_reason:
          "Doublon potentiel relu, administration distincte fictive justifiée.",
      },
      args = entry(child, facility, override),
      id = await rpc<string>(a, "write_clinical_entry", args);
    expect(await rpc(a, "write_clinical_entry", args)).toBe(id);
    expect(await rpc(a, "clinical_entry_history", [child, id])).toMatchObject([
      {
        duplicate_review: {
          conflicting_entry_ids: [original],
          reason: override.duplicate_override_reason,
        },
      },
    ]);
    await expect(
      db.query(
        "delete from public.vaccination_duplicate_overrides where entry_id=$1",
        [id],
      ),
    ).rejects.toThrow(/Append-only/);
  });
  it("recomputes matching on corrections/withdrawals without changing original version links", async () => {
    const { a, child, facility } = await setup(),
      item = await assign(a, child, facility),
      p = payload(item),
      id = await rpc<string>(
        a,
        "write_clinical_entry",
        entry(child, facility, p),
      );
    const correction = [
      ...entry(child, facility, payload()),
      id,
      1,
      reason,
      "active",
    ];
    await rpc(a, "write_clinical_entry", correction);
    expect((await items(a, child))[0].documented_entries).toEqual([]);
    expect(await rpc(a, "clinical_entry_history", [child, id])).toMatchObject([
      { vaccine_mapping: { version_id: version, item_id: item } },
      { vaccine_mapping: null },
    ]);
    await expect(
      rpc(a, "write_clinical_entry", [
        ...entry(child, facility, p),
        id,
        1,
        reason,
        "active",
      ]),
    ).rejects.toMatchObject({ code: "PT409" });
  });
  it("withdraws an invalidated old mapping while retaining the clinical data and every previous revision", async () => {
    const { a, child, facility } = await setup(),
      item = await assign(a, child, facility),
      p = payload(item),
      original = entry(child, facility, p),
      id = await rpc<string>(a, "write_clinical_entry", original);
    await rpc(a, "change_vaccine_item", [
      randomUUID(),
      item,
      1,
      "withdrawn",
      facility,
      reason,
      false,
    ]);
    await db.query(
      "update public.children set birth_date='2026-02-01' where id=$1",
      [child],
    );
    await rpc(a, "write_clinical_entry", [
      ...entry(child, facility, p),
      id,
      1,
      reason,
      "withdrawn",
    ]);
    expect((await items(a, child))[0]).toMatchObject({
      state: "withdrawn",
      documented_entries: [],
    });
    expect(await rpc(a, "clinical_entry_history", [child, id])).toMatchObject([
      { vaccine_mapping: { item_id: item }, entry_state: "active" },
      { vaccine_mapping: { item_id: item }, entry_state: "withdrawn" },
    ]);
  });
  it("records item withdrawal/reactivation as revisions and rejects stale decisions", async () => {
    const { a, child, facility } = await setup(),
      id = await assign(a, child, facility);
    await rpc(a, "change_vaccine_item", [
      randomUUID(),
      id,
      1,
      "withdrawn",
      facility,
      reason,
      false,
    ]);
    await expect(
      rpc(a, "change_vaccine_item", [
        randomUUID(),
        id,
        1,
        "active",
        facility,
        reason,
        true,
      ]),
    ).rejects.toMatchObject({ code: "PT409" });
    await rpc(a, "change_vaccine_item", [
      randomUUID(),
      id,
      2,
      "active",
      facility,
      reason,
      true,
    ]);
    expect(await rpc(a, "vaccine_item_history", [child, id])).toMatchObject([
      { revision: 1, state: "active" },
      { revision: 2, state: "withdrawn" },
      { revision: 3, state: "active" },
    ]);
    expect((await items(a, child))[0]).toMatchObject({
      id,
      state: "active",
      revision: 3,
      documented_entries: [],
    });
  });
  it("retains all legacy clinical kinds and audits current-schema reads", async () => {
    const { a, child, facility } = await setup();
    await db.query(
      "insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) values($1,'consultation',true,$1)",
      [a.id],
    );
    const args = entry(child, facility);
    args[2] = "consultation";
    args[9] = { reason: "Contrôle fictif" };
    await rpc(a, "write_clinical_entry", args);
    expect(await rpc(a, "clinical_timeline", [child, 1, "all"])).toMatchObject({
      total: 1,
    });
    expect(
      await rpc(a, "clinical_timeline", [child, 1, "vaccination"]),
    ).toMatchObject({ total: 0 });
    await items(a, child);
    const audit = await db.query<{ n: number }>(
      "select count(*)::integer n from public.audit_events where entity_id=$1 and entity_type='vaccine_items_read'",
      [child],
    );
    expect(audit.rows[0].n).toBeGreaterThan(0);
  });
  it("cuts item/record access on capability expiry, patient-grant revocation and logout", async () => {
    const { a, child, facility } = await setup();
    await assign(a, child, facility);
    await db.query(
      "update public.professional_capabilities set expires_at=now()-interval '1 second' where professional_id=$1",
      [a.id],
    );
    await expect(
      rpc(a, "write_clinical_entry", entry(child, facility)),
    ).rejects.toThrow(/capability/);
    await db.query(
      "update public.access_grants set revoked_at=now() where child_id=$1",
      [child],
    );
    await expect(items(a, child)).rejects.toThrow(/Child access denied/);
    await db.query("delete from auth.sessions where id=$1", [a.session]);
    await expect(rpc(a, "clinical_export", [child])).rejects.toThrow(/denied/);
  });
});
