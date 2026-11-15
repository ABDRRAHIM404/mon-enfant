import { beforeAll, afterAll, beforeEach, afterEach, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { clinicianUpdatesDatabase } from "./helpers/database";
let db: PGlite;
type Actor = { id: string; session: string };
async function actor(role = "doctor", approved = true): Promise<Actor> {
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
    [
      a.id,
      role,
      approved ? "approved" : "unverified",
      approved ? `QA-${a.id}` : null,
    ],
  );
  return a;
}
async function read(a: Actor, limit = 6) {
  await db.exec("savepoint overview_read");
  try {
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.session_id',$2,false)",
      [a.id, a.session],
    );
    await db.exec("set role authenticated");
    const r = await db.query<{
      value: {
        total: number;
        items: {
          id: string;
          root_id: string;
          revision: number;
          reason: string;
        }[];
      };
    }>("select public.clinician_recent_consultations($1) value", [limit]);
    await db.exec("reset role;release savepoint overview_read");
    return r.rows[0].value;
  } catch (e) {
    await db.exec(
      "rollback to savepoint overview_read;reset role;release savepoint overview_read",
    );
    throw e;
  }
}
async function seed(a: Actor) {
  const child = randomUUID(),
    facility = randomUUID(),
    entry = randomUUID();
  await db.query(
    "insert into public.facilities(id,name,city,created_by) values($1,'Centre fictif','Ville fictive',$2)",
    [facility, a.id],
  );
  await db.query(
    "insert into public.children(id,given_name,family_name,name_status,birth_date,birth_date_precision,sex,history_status,source_type,created_by) values($1,'Enfant','Fictif','confirmed','2025-01-01','exact','unknown','unknown','new_registration',$2)",
    [child, a.id],
  );
  await db.query(
    "insert into public.access_grants(child_id,professional_id,granted_by) values($1,$2,$2)",
    [child, a.id],
  );
  await db.query(
    "insert into public.clinical_entries(id,root_id,revision,child_id,kind,author_id,professional_id,facility_id,occurred_on,occurrence_precision,source_type,source_verified,payload) values($1,$1,1,$2,'consultation',$3,$4,$5,null,'unknown','paper_transcription',false,$6)",
    [
      entry,
      child,
      a.id,
      `QA-${a.id}`,
      facility,
      JSON.stringify({ reason: "Consultation entièrement fictive originale" }),
    ],
  );
  return { child, facility, entry };
}
beforeAll(async () => {
  db = await clinicianUpdatesDatabase();
  await db.exec(
    readFileSync(
      "supabase/migrations/20261115172000_clinician_recent_consultations.sql",
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
  it(`${role} overview follows grants and latest clinical revisions without provisional promotion`, async () => {
    const a = await actor(role),
      b = await actor();
    const f = await seed(a);
    await read(a);
    const privateChild = await db.query<{ id: string }>(
      "select public.create_provisional_child($1,$2) id",
      [
        randomUUID(),
        {
          name_status: "unknown",
          birth_date_precision: "unknown",
          sex: "unknown",
        },
      ],
    );
    await db.query(
      "select public.write_provisional_entry($1,$2,'consultation',null,'unknown','reported','Source privée fictive',$3)",
      [
        randomUUID(),
        privateChild.rows[0].id,
        { reason: "Consultation provisoire entièrement fictive" },
      ],
    );
    await seed(b);
    expect((await read(a)).total).toBe(1);
    const correction = randomUUID();
    await db.query(
      "insert into public.clinical_entries(id,root_id,previous_id,revision,child_id,kind,author_id,professional_id,facility_id,occurred_on,occurrence_precision,source_type,source_verified,payload,amendment_reason) values($1,$2,$2,2,$3,'consultation',$4,$5,$6,null,'unknown','paper_transcription',false,$7,'Correction entièrement fictive historisée')",
      [
        correction,
        f.entry,
        f.child,
        a.id,
        `QA-${a.id}`,
        f.facility,
        JSON.stringify({ reason: "Motif fictif corrigé" }),
      ],
    );
    const r = await read(a);
    expect(r.total).toBe(1);
    expect(r.items[0]).toMatchObject({
      id: correction,
      root_id: f.entry,
      revision: 2,
      reason: "Motif fictif corrigé",
    });
    await db.query(
      "update public.access_grants set revoked_at=now() where child_id=$1",
      [f.child],
    );
    expect((await read(a)).items).toEqual([]);
    expect((await read(b)).total).toBe(1);
  });
it("rejects admin alone, unverified users, invalid limits and signed-out sessions", async () => {
  const admin = await actor("admin"),
    unverified = await actor("nurse", false),
    a = await actor();
  await expect(read(admin)).rejects.toMatchObject({ code: "42501" });
  await expect(read(unverified)).rejects.toMatchObject({ code: "42501" });
  await expect(read(a, 13)).rejects.toMatchObject({ code: "22023" });
  await db.query("delete from auth.sessions where id=$1", [a.session]);
  await expect(read(a)).rejects.toMatchObject({ code: "42501" });
});
