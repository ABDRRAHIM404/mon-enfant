import { randomBytes, createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { sessionActing, sharingDatabase } from "./helpers/database";
import {
  clinicianName,
  type ClinicalAttributions,
} from "../src/lib/clinical/attribution";
import {
  accountDisplayName,
  registeredAccountName,
} from "../src/lib/clinical/account-display-name";

let db: PGlite;
type Actor = { id: string; session: string; code: string; email: string };
const reason = "Décision fictive de vérification et de partage.";

async function rpc<T>(actor: Actor, name: string, args: unknown[] = []) {
  const data = await sessionActing(
    db,
    actor.id,
    actor.session,
    `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) value`,
    args,
  );
  return (data.rows[0] as { value: T }).value;
}

async function actor(
  role?: "doctor" | "nurse",
  status = "approved",
  displayName = "Nom vérifié fictif",
) {
  const id = randomUUID(),
    session = randomUUID(),
    code = `PRO-${id}`,
    email = `${id}@example.invalid`;
  const a = { id, session, code, email };
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
    [id, email],
  );
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    session,
    id,
  ]);
  if (!role) {
    await rpc(a, "save_parent_profile", ["Responsable fictif"]);
    return a;
  }
  await db.query(
    "insert into public.professional_profiles(user_id,role,verification_status,professional_id) values($1,$2,$3,$4)",
    [id, role, status, status === "approved" ? code : null],
  );
  const request = randomUUID();
  await db.query(
    "insert into public.verification_requests(id,professional_id,display_name,registration_number,facility_name,evidence_path,status) values($1,$2,$3,$4,$5,$6,$7)",
    [
      request,
      id,
      displayName,
      request.toUpperCase(),
      "Centre fictif",
      `${id}/${request}/doc.pdf`,
      status === "approved" ? "approved" : "under_review",
    ],
  );
  return a;
}

async function register(a: Actor) {
  const facility = await rpc<string>(a, "create_facility", [
    randomUUID(),
    "Centre fictif",
    "Belfaa",
  ]);
  const op = randomUUID(),
    body = {
      facility_id: facility,
      register_year: 2026,
      register_book: "QA",
      local_number: "40",
      given_name: "Enfant fictif",
      family_name: "Dossier",
      birth_date: "2025-10-15",
      birth_date_precision: "exact",
      sex: "unknown",
    };
  await rpc(a, "prepare_child_registration", [op, body]);
  return {
    facility,
    child: await rpc<string>(a, "register_child", [op, body]),
  };
}

const names = (
  a: Actor,
  keys: string[],
  children: string[] = [],
  share: string | null = null,
) =>
  rpc<ClinicalAttributions>(a, "clinician_attribution_labels", [
    keys,
    children,
    share,
    null,
    1,
  ]);

beforeAll(async () => {
  db = await sharingDatabase();
  await db.exec("create role service_role");
  for (const file of [
    "20261119150616_doctor_care_qr.sql",
    "20261119152628_parent_care_visit_qr.sql",
    "20261124182847_clinician_attribution_labels.sql",
  ])
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
});
afterAll(async () => {
  await db?.close();
});

it("resolves a verified name only inside an authorized child record and leaves ownership unchanged", async () => {
  const author = await actor("nurse", "approved", "Nour Fictive");
  const reader = await actor("doctor");
  const unrelated = await actor("doctor");
  const pending = await actor("nurse", "under_review", "Nom soumis fictif");
  const { child, facility } = await register(author);
  await db.query(
    "insert into public.access_grants(child_id,professional_id,granted_by) values($1,$2,$3)",
    [child, reader.id, author.id],
  );
  await db.query(
    "insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) values($1,'growth',true,$1)",
    [author.id],
  );
  const root = await rpc<string>(author, "write_clinical_entry", [
    randomUUID(),
    child,
    "growth",
    facility,
    "2026-10-25",
    "exact",
    "observed",
    null,
    true,
    { weight_kg: 8.02 },
  ]);
  expect(await names(reader, [author.code, unrelated.code])).toEqual({});
  const labels = await names(reader, [author.code, unrelated.code], [child]);
  expect(labels).toEqual({
    [author.code]: { name: "Nour Fictive", role: "nurse", verified: true },
  });
  expect(clinicianName(labels, author.code)).toBe(
    "Nour Fictive — Infirmier(e)",
  );
  expect(await names(unrelated, [author.code], [child])).toEqual({});
  expect((await names(pending, [pending.id]))[pending.id]?.name).toBe(
    "Nom soumis fictif",
  );
  await expect(names(pending, [author.code], [child])).rejects.toMatchObject({
    code: "42501",
  });
  const entries = await rpc<{ professional_id: string; author_id: string }[]>(
    reader,
    "clinical_entry_history",
    [child, root],
  );
  expect(entries[0]).toMatchObject({
    professional_id: author.code,
    author_id: author.id,
  });
});

it("keeps shared attribution limited to the actual read-only share and its current session", async () => {
  const author = await actor("doctor", "approved", "Samir Fictif");
  const guest = await actor("doctor");
  const stranger = await actor("doctor");
  const parent = await actor();
  const { child, facility } = await register(author);
  await db.query(
    "insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) values($1,'consultation',true,$1)",
    [author.id],
  );
  await rpc(author, "write_clinical_entry", [
    randomUUID(),
    child,
    "consultation",
    facility,
    "2026-10-25",
    "exact",
    "observed",
    null,
    true,
    { reason: "Consultation entièrement fictive." },
  ]);
  const token = randomBytes(32).toString("base64url");
  await rpc(author, "create_guardian_invitation", [
    child,
    parent.email,
    createHash("sha256").update(token).digest("hex"),
    reason,
  ]);
  const claim = await rpc<string>(parent, "claim_guardian_invitation", [
    randomUUID(),
    token,
    "mother",
    true,
  ]);
  const expires = (
    await db.query<{ valid_until: string }>(
      "select ((now() at time zone 'Africa/Casablanca')::date+30)::text as valid_until",
    )
  ).rows[0].valid_until;
  await rpc(author, "review_guardian_claim", [
    randomUUID(),
    claim,
    1,
    "approved",
    "mother",
    reason,
    reason,
    true,
    true,
    expires,
    true,
  ]);
  const narrow = await rpc<{ id: string; token: string }>(
    parent,
    "issue_clinician_share",
    [child, "vaccination_read", true],
  );
  await rpc(guest, "redeem_clinician_share", [narrow.token]);
  expect(await names(guest, [author.code], [], narrow.id)).toEqual({});
  const booklet = await rpc<{ id: string; token: string }>(
    parent,
    "issue_clinician_share",
    [child, "booklet_read", true],
  );
  await rpc(guest, "redeem_clinician_share", [booklet.token]);
  expect(
    clinicianName(
      await names(guest, [author.code, stranger.code], [], booklet.id),
      author.code,
    ),
  ).toBe("Samir Fictif — Médecin");
  await expect(
    names(stranger, [author.code], [], booklet.id),
  ).rejects.toMatchObject({ code: "42501" });
  await rpc(parent, "revoke_clinician_share", [booklet.id]);
  await expect(
    names(guest, [author.code], [], booklet.id),
  ).rejects.toMatchObject({ code: "42501" });
});

it("reads presentation metadata and gives a non-identifying fallback", () => {
  expect(
    registeredAccountName({ given_name: "Meriem", family_name: "Fictive" }),
  ).toBe("Meriem Fictive");
  expect(accountDisplayName("  Meriem   Fictive  ")).toBe("Meriem Fictive");
  expect(accountDisplayName("Ab\u202eCd")).toBeNull();
  expect(clinicianName({}, "PRO-SECRET")).not.toContain("PRO-");
});
