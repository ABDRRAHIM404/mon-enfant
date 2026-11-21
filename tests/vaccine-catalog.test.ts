import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { vaccineDatabase, sessionActing } from "./helpers/database";
let db: PGlite;
type Actor = { id: string; session: string };
type Rule = {
  dose_code: string;
  source_row: unknown;
  source_age: unknown;
  age: unknown;
  automatic_scheduling: boolean;
};
type Version = {
  parent_id: string | null;
  id: string;
  status: string;
  revision: number;
  review_verified: boolean;
  rules: Rule[];
  source_sha256: string;
  source_document: unknown;
};
async function actor(
  role = "doctor",
  manage = false,
  review = false,
  capable = false,
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
    [id, role, `VACCINE-${id}`],
  );
  await db.query(
    "insert into private.staff_permissions(user_id,can_manage_vaccine_catalog,can_review_vaccine_catalog) values($1,$2,$3)",
    [id, manage, review],
  );
  if (capable)
    await db.query(
      "insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) values($1,'vaccination',true,$1)",
      [id],
    );
  return { id, session };
}
async function rpc(
  a: Actor,
  name: string,
  args: unknown[] = [],
): Promise<unknown> {
  const r = await sessionActing(
    db,
    a.id,
    a.session,
    `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`,
    args,
  );
  return (r.rows[0] as { value: unknown }).value;
}
const basis = {
  reason: "Modification fictive justifiée pour le test.",
  evidence_reference: "Référence fictive de revue de la source.",
};
async function change(
  a: Actor,
  action: string,
  id: string,
  revision: number,
  input: Record<string, unknown> = {},
  op = randomUUID(),
) {
  return rpc(a, "change_vaccine_catalog", [
    op,
    action,
    id,
    revision,
    { ...basis, ...input },
  ]) as Promise<string>;
}
async function detail(a: Actor, id: string) {
  return (await rpc(a, "vaccine_catalog", [id])) as {
    version: Version;
    history: { action: string; snapshot: Version }[];
  };
}
async function draft(editor: Actor) {
  const list = (await rpc(editor, "vaccine_catalog")) as {
    versions: { id: string; revision: number; parent_id: string | null }[];
  };
  const seed = list.versions.find((v) => !v.parent_id)!;
  return change(editor, "clone", seed.id, seed.revision, {
    label: "Version fictive de test",
  });
}
const reviewInput = {
  source_authenticated: true,
  clinical_reviewed: true,
  birth_window_reviewed: true,
};
beforeAll(async () => {
  db = await vaccineDatabase();
});
afterAll(async () => {
  await db?.close();
});
describe("versioned vaccine catalog", () => {
  it("paginates immutable snapshots without hiding the total or repeating decisions", async () => {
    const editor = await actor("admin", true),
      id = await draft(editor);
    for (let revision = 1; revision <= 25; revision++)
      await change(editor, "edit", id, revision, {
        dose_code: "VPO1",
        age: { unit: "weeks", value: revision % 2 ? 8 : 9 },
        eligibility: "all",
        automatic_scheduling: true,
      });
    const first = (await rpc(editor, "vaccine_catalog", [id, 1])) as {
      history_total: number;
      history: { id: string; revision: number; snapshot: Version }[];
    };
    const second = (await rpc(editor, "vaccine_catalog", [
      id,
      2,
    ])) as typeof first;
    expect(first.history_total).toBe(26);
    expect(first.history).toHaveLength(20);
    expect(second.history).toHaveLength(6);
    expect(
      new Set([...first.history, ...second.history].map((h) => h.id)).size,
    ).toBe(26);
    expect(second.history.at(-1)?.revision).toBe(26);
    expect(second.history.at(-1)?.snapshot.rules).toHaveLength(25);
    await expect(rpc(editor, "vaccine_catalog", [id, 0])).rejects.toThrow(
      /Invalid catalog page/,
    );
  });
  it("preserves the original complete source, all 25 mappings and a disabled draft", async () => {
    const a = await actor(),
      list = (await rpc(a, "vaccine_catalog")) as { versions: Version[] };
    expect(list.versions.filter((v) => !v.parent_id)).toHaveLength(1);
    const { version: v } = await detail(
      a,
      list.versions.find((v) => !v.parent_id)!.id,
    );
    const bytes = readFileSync("data-for-supa/MON_ENFANT_PNI_DATA.json"),
      source = JSON.parse(bytes.toString());
    expect(v.source_sha256).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
    expect(v.source_document).toEqual(source);
    expect(v).toMatchObject({ status: "draft", review_verified: false });
    expect(v.rules).toHaveLength(25);
    for (const row of source.schedule_2025)
      expect(v.rules.find((r) => r.dose_code === row.dose_code)).toMatchObject({
        source_row: row,
        source_age: row.source_age,
        age: row.age,
      });
    expect(
      v.rules.find((r) => r.dose_code === "HB1")?.automatic_scheduling,
    ).toBe(false);
    expect(v.rules.some((r) => r.dose_code === "HBn")).toBe(false);
  });
  it("requires explicit independent permissions, not a general admin or doctor role", async () => {
    const editor = await actor("admin", true),
      id = await draft(editor);
    for (const a of [
      await actor("admin"),
      await actor(),
      await actor("doctor", false, true),
      await actor("admin", false, true, true),
    ]) {
      await expect(change(a, "edit", id, 1, {})).rejects.toThrow(/permission/);
      await expect(change(a, "approve", id, 1, reviewInput)).rejects.toThrow(
        /permission/,
      );
    }
    await expect(change(editor, "approve", id, 1, reviewInput)).rejects.toThrow(
      /permission/,
    );
  });
  it("retains original/configured ages separately with immutable retry-safe change snapshots", async () => {
    const editor = await actor("admin", true),
      id = await draft(editor),
      op = randomUUID();
    const input = {
      dose_code: "VPO1",
      age: { unit: "weeks", value: 9 },
      eligibility: "all",
      automatic_scheduling: true,
    };
    expect(await change(editor, "edit", id, 1, input, op)).toBe(id);
    expect(await change(editor, "edit", id, 1, input, op)).toBe(id);
    const d = await detail(editor, id);
    expect(d.version.revision).toBe(2);
    expect(d.version.rules.find((r) => r.dose_code === "VPO1")).toMatchObject({
      source_age: { unit: "weeks", value: 8 },
      age: { unit: "weeks", value: 9 },
    });
    expect(d.history.map((h) => h.action)).toEqual(["clone", "edit"]);
    expect(
      d.history[0].snapshot.rules.find((r) => r.dose_code === "VPO1")?.age,
    ).toEqual({ unit: "weeks", value: 8 });
    await expect(
      change(
        editor,
        "edit",
        id,
        1,
        { ...input, automatic_scheduling: false },
        op,
      ),
    ).rejects.toThrow(/reused/);
    await expect(change(editor, "edit", id, 1, input)).rejects.toMatchObject({
      code: "PT409",
    });
  });
  it("enforces agreed HB1, birth-window, rotavirus and girls-only HPV invariants", async () => {
    const editor = await actor("admin", true),
      id = await draft(editor);
    for (const input of [
      {
        dose_code: "HB1",
        age: { unit: "first_4_weeks" },
        eligibility: "all",
        automatic_scheduling: true,
      },
      {
        dose_code: "BCG",
        age: { unit: "weeks", value: 1 },
        eligibility: "all",
        automatic_scheduling: true,
      },
      {
        dose_code: "VPO0",
        age: { unit: "weeks", value: 4 },
        eligibility: "all",
        automatic_scheduling: true,
      },
      {
        dose_code: "Rota1",
        age: { unit: "weeks", value: 8 },
        eligibility: "all",
        automatic_scheduling: true,
      },
      {
        dose_code: "Rota2",
        age: { unit: "months", value: 4 },
        eligibility: "all",
        automatic_scheduling: true,
      },
      {
        dose_code: "HPV",
        age: { unit: "years", value: 11 },
        eligibility: "all",
        automatic_scheduling: true,
      },
      {
        dose_code: "HPV",
        age: { unit: "years", value: 12 },
        eligibility: "female",
        automatic_scheduling: true,
      },
      {
        dose_code: "VPO1",
        age: { unit: "weeks", value: 0 },
        eligibility: "all",
        automatic_scheduling: true,
      },
      {
        dose_code: "HBn",
        age: { unit: "first_4_weeks" },
        eligibility: "all",
        automatic_scheduling: false,
      },
    ])
      await expect(change(editor, "edit", id, 1, input)).rejects.toThrow();
    expect((await detail(editor, id)).version.revision).toBe(1);
  });
  it("requires full independent qualified review and freezes approved content through retirement", async () => {
    const editor = await actor("admin", true),
      reviewer = await actor("doctor", false, true, true),
      id = await draft(editor);
    for (const input of [
      {},
      { ...reviewInput, birth_window_reviewed: false },
      { ...reviewInput, source_authenticated: false },
    ])
      await expect(change(reviewer, "approve", id, 1, input)).rejects.toThrow(
        /review/,
      );
    await change(reviewer, "approve", id, 1, reviewInput);
    const approved = (await detail(editor, id)).version;
    expect(approved).toMatchObject({
      status: "approved",
      revision: 2,
      review_verified: true,
      reviewed_by: reviewer.id,
    });
    await expect(
      change(editor, "edit", id, 2, {
        dose_code: "VPO1",
        age: { unit: "weeks", value: 9 },
        eligibility: "all",
        automatic_scheduling: true,
      }),
    ).rejects.toThrow(/Draft/);
    await expect(
      db.query("update public.vaccine_rules set age='{}' where version_id=$1", [
        id,
      ]),
    ).rejects.toThrow(/immutable/);
    await change(editor, "retire", id, 2);
    expect((await detail(editor, id)).version).toMatchObject({
      status: "retired",
      revision: 3,
      rules: approved.rules,
      review_verified: true,
    });
    const clone = await change(editor, "clone", id, 3, {
      label: "Nouvelle révision fictive",
    });
    expect((await detail(editor, clone)).version).toMatchObject({
      status: "draft",
      review_verified: false,
    });
  });
  it("rejects self review even for an actor with both flags and rechecks live capability/session", async () => {
    const editor = await actor("admin", true, true, true),
      id = await draft(editor);
    // A doctor who edited while appointed as an admin cannot approve their own version later.
    await db.query(
      "update public.professional_profiles set role='doctor' where user_id=$1",
      [editor.id],
    );
    await expect(change(editor, "approve", id, 1, reviewInput)).rejects.toThrow(
      /Independent/,
    );
    const reviewer = await actor("doctor", false, true, true);
    await db.query(
      "update public.professional_capabilities set expires_at=now()-interval '1 second' where professional_id=$1",
      [reviewer.id],
    );
    await expect(
      change(reviewer, "approve", id, 1, reviewInput),
    ).rejects.toThrow(/permission/);
    await db.query(
      "update public.professional_capabilities set expires_at=null where professional_id=$1",
      [reviewer.id],
    );
    await db.query("delete from auth.sessions where id=$1", [reviewer.session]);
    await expect(
      change(reviewer, "approve", id, 1, reviewInput),
    ).rejects.toThrow(/permission/);
  });
  it("denies direct tables, source edits and audit mutations, including to catalog staff", async () => {
    const editor = await actor("admin", true),
      id = await draft(editor);
    for (const table of [
      "vaccine_versions",
      "vaccine_rules",
      "vaccine_catalog_changes",
    ])
      await expect(
        sessionActing(
          db,
          editor.id,
          editor.session,
          `select * from public.${table}`,
        ),
      ).rejects.toThrow(/permission denied/);
    await expect(
      db.exec("delete from private.vaccine_sources"),
    ).rejects.toThrow(/Append-only/);
    await expect(
      db.query(
        "delete from public.vaccine_catalog_changes where version_id=$1",
        [id],
      ),
    ).rejects.toThrow(/Append-only/);
    await expect(
      db.query(
        "update public.vaccine_rules set dose_code='HBn' where version_id=$1 and dose_code='HB1'",
        [id],
      ),
    ).rejects.toThrow(/immutable/);
    const outsider = await actor();
    await db.query(
      "update public.professional_profiles set verification_status='suspended' where user_id=$1",
      [outsider.id],
    );
    await expect(rpc(outsider, "vaccine_catalog")).rejects.toThrow(
      /Approved doctor/,
    );
  });

  it("imports the revised HBn draft and keeps approval under independent review", async () => {
    await db.exec(
      readFileSync(
        "supabase/migrations/20261121174928_pni_hepatitis_b_birth_draft.sql",
        "utf8",
      ),
    );
    const id = "0c504568-7c67-49bb-b43b-c8382439a850";
    const reader = await actor("doctor");
    const editor = await actor("admin", true);
    const reviewer = await actor("doctor", false, true, true);
    const { version } = await detail(reader, id);
    expect(version).toMatchObject({
      status: "draft",
      review_verified: false,
      revision: 1,
    });
    expect(version.rules).toHaveLength(26);
    expect(
      version.rules.find((rule) => rule.dose_code === "HBn"),
    ).toMatchObject({
      age: { unit: "birth_24_hours" },
      automatic_scheduling: false,
    });
    expect(
      version.rules.find((rule) => rule.dose_code === "HB1"),
    ).toMatchObject({
      age: { unit: "first_4_weeks" },
      automatic_scheduling: false,
    });
    await expect(
      change(editor, "edit", id, 1, {
        dose_code: "HBn",
        age: { unit: "birth_24_hours" },
        eligibility: "all",
        automatic_scheduling: true,
      }),
    ).rejects.toThrow(/constraint/);
    await expect(change(editor, "approve", id, 1, reviewInput)).rejects.toThrow(
      /permission/,
    );
    await expect(
      change(reviewer, "approve", id, 1, {
        ...reviewInput,
        clinical_reviewed: false,
      }),
    ).rejects.toThrow(/clinical review/);
    await change(reviewer, "approve", id, 1, reviewInput);
    expect((await detail(reader, id)).version).toMatchObject({
      status: "approved",
      review_verified: true,
      revision: 2,
    });
  });
  it("lets a creator and editor with review permission approve and keeps their audit identity", async () => {
    await db.exec(
      readFileSync(
        "supabase/migrations/20261121175829_allow_catalog_review_by_creator.sql",
        "utf8",
      ),
    );
    const reviewer = await actor("admin", true, true, true);
    const id = await change(
      reviewer,
      "clone",
      "0c504568-7c67-49bb-b43b-c8382439a850",
      2,
      { label: "Brouillon fictif avec revue" },
    );
    await change(reviewer, "edit", id, 1, {
      dose_code: "VPO1",
      age: { unit: "weeks", value: 8 },
      eligibility: "all",
      automatic_scheduling: true,
    });
    await expect(
      change(reviewer, "approve", id, 2, reviewInput),
    ).rejects.toThrow(/permission/);
    await db.query(
      "update public.professional_profiles set role='doctor' where user_id=$1",
      [reviewer.id],
    );
    await expect(
      change(reviewer, "approve", id, 2, {
        ...reviewInput,
        birth_window_reviewed: false,
      }),
    ).rejects.toThrow(/review/);
    await change(reviewer, "approve", id, 2, reviewInput);
    const result = await detail(reviewer, id);
    expect(result.version).toMatchObject({
      revision: 3,
      status: "approved",
      reviewed_by: reviewer.id,
      review_verified: true,
    });
    expect(
      result.history.find(({ action }) => action === "approve")?.snapshot,
    ).toMatchObject({ reviewed_by: reviewer.id, review_verified: true });
  });
});
