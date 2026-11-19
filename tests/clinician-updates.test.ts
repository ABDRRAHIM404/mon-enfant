import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { clinicianUpdatesDatabase, sessionActing } from "./helpers/database";
import { clinicalCapabilities } from "../src/lib/clinical/types";
let db: PGlite;
type Actor = { id: string; session: string };
async function actor(role?: string, status = "unverified"): Promise<Actor> {
  const a = { id: randomUUID(), session: randomUUID() };
  await db.query("insert into auth.users(id) values($1)", [a.id]);
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    a.session,
    a.id,
  ]);
  if (role)
    await db.query(
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
  const r = await sessionActing(
    db,
    a.id,
    a.session,
    `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) v`,
    args,
  );
  return (r.rows[0] as { v: T }).v;
}
const identity = () => ({
  given_name: "Prénom fictif",
  family_name: randomUUID(),
  name_status: "confirmed",
  birth_date: "2025-01-01",
  birth_date_precision: "exact",
  sex: "male",
});
async function child(a: Actor) {
  return rpc<string>(a, "create_provisional_child", [randomUUID(), identity()]);
}
function writeArgs(
  c: string,
  kind = "consultation",
  payload: Record<string, unknown> = { reason: "Motif fictif" },
): unknown[] {
  return [
    randomUUID(),
    c,
    kind,
    "2026-01-02",
    "exact",
    "observed",
    null,
    payload,
  ];
}
beforeAll(async () => {
  db = await clinicianUpdatesDatabase();
});
afterAll(async () => {
  await db?.close();
});
describe("requested clinician update on complete current PostgreSQL schema", () => {
  it("grants and audits a batch atomically, enforcing eligibility and idempotency", async () => {
    await db.exec(
      readFileSync(
        "supabase/migrations/20261119140847_bulk_clinical_permissions.sql",
        "utf8",
      ),
    );
    const manager = await actor("admin", "approved");
    const nurse = await actor("nurse", "approved");
    const doctor = await actor("doctor", "approved");
    await db.query(
      "insert into private.staff_permissions(user_id,can_manage_clinical_permissions) values($1,true)",
      [manager.id],
    );
    const operation = randomUUID();
    const args = [
      operation,
      nurse.id,
      clinicalCapabilities,
      true,
      "2090-01-01T23:59:59Z",
      "Source fictive de qualification",
      "Motif fictif d’attribution",
      true,
    ];
    const name = "set_clinical_capabilities";
    await expect(rpc(doctor, name, args)).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      rpc(manager, name, [...args.slice(0, -1), false]),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(rpc(manager, name, args)).resolves.toBe(nurse.id);
    await expect(
      rpc(manager, name, [
        operation,
        nurse.id,
        [...clinicalCapabilities].reverse(),
        ...args.slice(3),
      ]),
    ).resolves.toBe(nurse.id);
    await expect(
      rpc(manager, name, [
        operation,
        nurse.id,
        ["appointment"],
        ...args.slice(3),
      ]),
    ).rejects.toMatchObject({ code: "22023" });
    const status = await db.query(
      "select capability, enabled, expires_at from public.professional_capabilities where professional_id=$1 order by capability",
      [nurse.id],
    );
    expect(status.rows).toEqual(
      [...clinicalCapabilities].sort().map((capability) => ({
        capability,
        enabled: true,
        expires_at: new Date("2090-01-01T23:59:59Z"),
      })),
    );
    const history = await db.query(
      "select capability from public.capability_changes where professional_id=$1 order by capability",
      [nurse.id],
    );
    expect(history.rows).toEqual(
      [...clinicalCapabilities].sort().map((capability) => ({ capability })),
    );

    // Force the last permission to fail after the first has been processed.
    const blockedOperation = randomUUID();
    await db.query(
      "insert into private.operation_receipts(actor_id, operation_id, kind, payload, result_id) values($1, md5('clinical_permission_batch:' || $2 || ':vaccination')::uuid, 'fixture', '{}'::jsonb, $3)",
      [manager.id, blockedOperation, doctor.id],
    );
    await expect(
      rpc(manager, name, [
        blockedOperation,
        doctor.id,
        ["consultation", "vaccination"],
        ...args.slice(3),
      ]),
    ).rejects.toMatchObject({ code: "22023" });
    const failed = await db.query(
      "select capability from public.professional_capabilities where professional_id=$1 union all select capability from public.capability_changes where professional_id=$1",
      [doctor.id],
    );
    expect(failed.rows).toEqual([]);
  });
  it("enrolls only own declared doctor/nurse, never approval, admin or self role changes", async () => {
    const a = await actor();
    await rpc(a, "enroll_clinician", ["nurse"]);
    await rpc(a, "enroll_clinician", ["nurse"]);
    expect(
      (
        await db.query(
          "select role,verification_status,professional_id from public.professional_profiles where user_id=$1",
          [a.id],
        )
      ).rows,
    ).toEqual([
      {
        role: "nurse",
        verification_status: "unverified",
        professional_id: null,
      },
    ]);
    await expect(rpc(a, "enroll_clinician", ["doctor"])).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      rpc(await actor(), "enroll_clinician", ["admin"]),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(
      rpc(a, "create_facility", [randomUUID(), "Faux centre", "Rabat"]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("nurses submit private evidence, receive independent review and explicit staff capabilities", async () => {
    const nurse = await actor("nurse"),
      reviewer = await actor("admin", "approved"),
      c = await child(nurse),
      application = randomUUID();
    await db.query(
      "insert into private.staff_permissions(user_id,can_review_professionals,can_manage_clinical_permissions) values($1,true,true)",
      [reviewer.id],
    );
    const path = `${nurse.id}/${application}/evidence.pdf`;
    await sessionActing(
      db,
      nurse.id,
      nurse.session,
      "insert into storage.objects(bucket_id,name) values('professional-evidence',$1)",
      [path],
    );
    expect(
      await rpc(nurse, "submit_verification", [
        application,
        "Infirmier entièrement fictif",
        "QA-NURSE-123",
        "Centre entièrement fictif",
        path,
      ]),
    ).toBe(application);
    await rpc(reviewer, "review_verification", [
      application,
      "approved",
      "Qualifications entièrement fictives vérifiées pour le test",
      true,
      true,
    ]);
    expect(
      (
        await db.query(
          "select role,verification_status from public.professional_profiles where user_id=$1",
          [nurse.id],
        )
      ).rows,
    ).toEqual([{ role: "nurse", verification_status: "approved" }]);
    await rpc(reviewer, "set_clinical_capability", [
      randomUUID(),
      nurse.id,
      "vaccination",
      true,
      null,
      "Source de qualification entièrement fictive",
      "Habilitation de test entièrement fictive",
      true,
    ]);
    expect(
      (
        await db.query(
          "select capability,enabled from public.professional_capabilities where professional_id=$1",
          [nurse.id],
        )
      ).rows,
    ).toEqual([{ capability: "vaccination", enabled: true }]);
    expect(
      (
        await rpc<{ child: { validation_state: string } }>(
          nurse,
          "provisional_booklet",
          [c],
        )
      ).child.validation_state,
    ).toBe("unverified");
    await rpc(reviewer, "set_professional_suspension", [
      nurse.id,
      true,
      "Suspension de test entièrement fictive",
    ]);
    await expect(rpc(nurse, "provisional_booklet", [c])).rejects.toMatchObject({
      code: "42501",
    });
  });
  it("persists all six core workflows with nonverified role, source and date provenance", async () => {
    const a = await actor("nurse"),
      c = await child(a);
    const cases: [string, Record<string, unknown>][] = [
      ["consultation", { reason: "Motif fictif" }],
      [
        "prescription",
        {
          medication: "Traitement fictif",
          instructions: "Instructions fictives",
        },
      ],
      [
        "risk",
        {
          description: "Risque fictif",
          category: "other",
          severity: "unknown",
        },
      ],
      ["growth", { weight_kg: 4.5 }],
      [
        "vaccination",
        { vaccine_label: "Vaccin fictif", dose_label: "Dose fictive" },
      ],
      [
        "appointment",
        {
          purpose: "Visite fictive",
          scheduled_for: "2026-12-01T09:00+01:00",
          status: "planned",
        },
      ],
    ];
    for (const [kind, payload] of cases)
      await rpc(a, "write_provisional_entry", writeArgs(c, kind, payload));
    const b = await rpc<{
      child: { validation_state: string };
      entries: {
        validation_state: string;
        author_role: string;
        account_status: string;
      }[];
      total: number;
    }>(a, "provisional_booklet", [c]);
    expect(b.total).toBe(6);
    expect(b.child.validation_state).toBe("unverified");
    expect(
      b.entries.every(
        (e) =>
          e.validation_state === "unverified" &&
          e.author_role === "nurse" &&
          e.account_status === "unverified",
      ),
    ).toBe(true);
    expect(
      (
        await db.query(
          "select count(*)::int n from public.children where created_by=$1",
          [a.id],
        )
      ).rows,
    ).toEqual([{ n: 0 }]);
  });
  it("denies unrelated verified/unverified clinicians, parent and general admin through every boundary", async () => {
    const a = await actor("doctor"),
      c = await child(a);
    const root = await rpc<string>(a, "write_provisional_entry", writeArgs(c));
    for (const other of [
      await actor("doctor"),
      await actor("nurse", "approved"),
      await actor("admin", "approved"),
      await actor(),
    ]) {
      await expect(
        rpc(other, "provisional_booklet", [c]),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        rpc(other, "write_provisional_entry", writeArgs(c)),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(rpc(other, "get_child_profile", [c])).rejects.toMatchObject({
        code: "42501",
      });
      for (const name of [
        "clinical_export",
        "vaccine_items_export",
        "appointments_export",
      ])
        await expect(rpc(other, name, [c])).rejects.toMatchObject({
          code: "42501",
        });
      await expect(
        sessionActing(
          db,
          other.id,
          other.session,
          "select * from private.provisional_children",
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        sessionActing(
          db,
          other.id,
          other.session,
          "select * from private.provisional_entries",
        ),
      ).rejects.toMatchObject({ code: "42501" });
      if (other !== a) {
        try {
          const w = await rpc<{ items: unknown[] }>(
            other,
            "provisional_workspace",
          );
          expect(JSON.stringify(w)).not.toContain(c);
          expect(JSON.stringify(w)).not.toContain(root);
        } catch (e) {
          expect(e).toMatchObject({ code: "42501" });
        }
      }
    }
    await expect(
      rpc(a, "get_child_profile", [randomUUID()]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      rpc(a, "request_child_access", [
        randomUUID(),
        randomUUID(),
        randomUUID(),
        2026,
        "A",
        "1",
        "Faux motif de partage",
      ]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("keeps append-only originals, idempotent retries, frozen operation input and PT409 conflicts", async () => {
    const a = await actor("doctor"),
      operation = randomUUID(),
      id = identity();
    const c = await rpc<string>(a, "create_provisional_child", [operation, id]);
    expect(await rpc(a, "create_provisional_child", [operation, id])).toBe(c);
    await expect(
      rpc(a, "create_provisional_child", [
        operation,
        { ...id, given_name: "Autre nom" },
      ]),
    ).rejects.toMatchObject({ code: "22023" });
    const args = writeArgs(c);
    const root = await rpc(a, "write_provisional_entry", args);
    expect(await rpc(a, "write_provisional_entry", args)).toBe(root);
    const correction = [
      ...writeArgs(c, "consultation", { reason: "Motif corrigé fictif" }),
      root,
      1,
      "Correction de la source fictive",
      "active",
    ];
    const revision = await rpc(a, "write_provisional_entry", correction);
    expect(await rpc(a, "write_provisional_entry", correction)).toBe(revision);
    await expect(
      rpc(a, "write_provisional_entry", [randomUUID(), ...correction.slice(1)]),
    ).rejects.toMatchObject({ code: "PT409" });
    const b = await rpc<{
      entries: { revision: number; payload: { reason: string } }[];
    }>(a, "provisional_booklet", [c, 1, root]);
    expect(b.entries.map((e) => e.revision)).toEqual([2, 1]);
    expect(b.entries[1].payload.reason).toBe("Motif fictif");
    await expect(
      db.query(
        "update private.provisional_entries set payload='{}' where child_id=$1",
        [c],
      ),
    ).rejects.toThrow();
    await expect(
      db.query("delete from private.provisional_children where id=$1", [c]),
    ).rejects.toThrow();
  });
  it("never promotes earlier provisional records on approval and excludes them from duplicate probes", async () => {
    const a = await actor("nurse"),
      id = identity(),
      c = await rpc<string>(a, "create_provisional_child", [randomUUID(), id]);
    await rpc(a, "write_provisional_entry", writeArgs(c));
    await db.query(
      "update public.professional_profiles set verification_status='approved',professional_id=$2 where user_id=$1",
      [a.id, `QA-${a.id}`],
    );
    expect(
      (
        await rpc<{
          child: { validation_state: string; account_status: string };
        }>(a, "provisional_booklet", [c])
      ).child,
    ).toMatchObject({
      validation_state: "unverified",
      account_status: "unverified",
    });
    const other = await actor("doctor", "approved"),
      facility = await rpc(other, "create_facility", [
        randomUUID(),
        "Centre fictif",
        "",
      ]);
    expect(
      await rpc(other, "prepare_child_registration", [
        randomUUID(),
        {
          ...id,
          facility_id: facility,
          register_year: 2026,
          register_book: "A",
          local_number: "1",
          sex: "male",
        },
      ]),
    ).toMatchObject({ state: "ready" });
    await expect(rpc(other, "provisional_booklet", [c])).rejects.toMatchObject({
      code: "42501",
    });
    await expect(rpc(a, "get_child_profile", [c])).rejects.toMatchObject({
      code: "42501",
    });
  });
  it("verified nurses keep explicit capabilities and child grants, with doctor-equivalent writes", async () => {
    const a = await actor("nurse", "approved");
    const facility = await rpc(a, "create_facility", [
      randomUUID(),
      "Centre infirmier fictif",
      "",
    ]);
    const p = {
      ...identity(),
      facility_id: facility,
      register_year: 2026,
      register_book: "A",
      local_number: "1",
    };
    const op = randomUUID();
    await rpc(a, "prepare_child_registration", [op, p]);
    const c = await rpc(a, "register_child", [op, p]);
    await expect(
      rpc(a, "write_clinical_entry", [
        randomUUID(),
        c,
        "consultation",
        facility,
        "2026-01-02",
        "exact",
        "observed",
        null,
        false,
        { reason: "Motif fictif" },
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await db.query(
      "insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) values($1,'consultation',true,$1)",
      [a.id],
    );
    expect(
      await rpc(a, "write_clinical_entry", [
        randomUUID(),
        c,
        "consultation",
        facility,
        "2026-01-02",
        "exact",
        "observed",
        null,
        false,
        { reason: "Motif fictif" },
      ]),
    ).toEqual(expect.any(String));
    await db.query(
      "update public.access_grants set revoked_at=now() where professional_id=$1",
      [a.id],
    );
    await expect(rpc(a, "get_child_profile", [c])).rejects.toMatchObject({
      code: "42501",
    });
  });
  it("retains unknown identity and rejects fabricated dates, trusted fields and invalid payloads", async () => {
    const a = await actor("doctor");
    const c = await rpc<string>(a, "create_provisional_child", [
      randomUUID(),
      {
        name_status: "unknown",
        birth_date_precision: "unknown",
        sex: "unknown",
      },
    ]);
    await expect(
      rpc(a, "create_provisional_child", [
        randomUUID(),
        { ...identity(), name_status: "unknown" },
      ]),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(
      rpc(
        a,
        "write_provisional_entry",
        writeArgs(c, "vaccination", {
          vaccine_label: "Faux",
          dose_label: "Faux",
          schedule_item_id: randomUUID(),
        }),
      ),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(
      rpc(
        a,
        "write_provisional_entry",
        writeArgs(c, "growth", { weight_kg: -1 }),
      ),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(
      rpc(
        a,
        "write_provisional_entry",
        writeArgs(c, "appointment", {
          purpose: "Faux",
          scheduled_for: "date invalide",
          status: "planned",
        }),
      ),
    ).rejects.toMatchObject({ code: "22023" });
  });
  it("rechecks suspension, Auth bans and revoked sessions with existing JWT claims", async () => {
    for (const boundary of ["suspended", "ban", "session"]) {
      const a = await actor("nurse"),
        c = await child(a);
      if (boundary === "suspended")
        await db.query(
          "update public.professional_profiles set verification_status='suspended' where user_id=$1",
          [a.id],
        );
      if (boundary === "ban")
        await db.query(
          "update auth.users set banned_until=now()+interval '1 day' where id=$1",
          [a.id],
        );
      if (boundary === "session")
        await db.query("delete from auth.sessions where user_id=$1", [a.id]);
      await expect(rpc(a, "provisional_booklet", [c])).rejects.toMatchObject({
        code: "42501",
      });
      await expect(
        rpc(a, "create_provisional_child", [randomUUID(), identity()]),
      ).rejects.toMatchObject({ code: "42501" });
    }
  });
});
