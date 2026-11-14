/** Cloud-only recovery mechanics for an isolated, entirely fictional database.
 * This archive is PGlite-specific; it is never a hosted Supabase restore image.
 */
import { PGlite } from "@electric-sql/pglite";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
import {
  parentPrivacyDatabase,
  sessionActing,
} from "../tests/helpers/database.ts";

const root = "test-results/recovery";
const bundle = join(root, "bundle");
const mode = process.argv[2];
let stage = "mode";
const knownBusinessErrors = new Set();
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function rpc(db, actor, name, args = []) {
  assert.match(name, /^[a-z_]+$/);
  stage = `${mode}-rpc-${name}`;
  const result = await sessionActing(
    db,
    actor.id,
    actor.session,
    `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) value`,
    args,
  );
  return result.rows[0].value;
}
async function actor(db, label, manager = false) {
  const value = { id: randomUUID(), session: randomUUID() };
  await db.query("insert into auth.users(id) values($1)", [value.id]);
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    value.session,
    value.id,
  ]);
  await db.query(
    "insert into public.professional_profiles(user_id,role,verification_status,professional_id) values($1,$2,'approved',$3)",
    [value.id, manager ? "admin" : "doctor", `RECOVERY-FICTIONAL-${label}`],
  );
  if (manager)
    await db.query(
      "insert into private.staff_permissions(user_id,can_manage_clinical_permissions) values($1,true)",
      [value.id],
    );
  return value;
}
async function fixtureAppointmentTime(db, wallTime) {
  const local = `${wallTime}:00`;
  const row = (
    await db.query(
      "select (($1::text||'+01:00')::timestamptz at time zone 'Africa/Casablanca'=$1::timestamp) plus_one, (($1::text||'+00:00')::timestamptz at time zone 'Africa/Casablanca'=$1::timestamp) utc_zero",
      [local],
    )
  ).rows[0];
  assert.equal(Number(row.plus_one) + Number(row.utc_zero), 1);
  return local + (row.plus_one ? "+01:00" : "+00:00");
}
async function fingerprint(db) {
  const tables = (
    await db.query(
      "select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' order by n.nspname,c.relname",
    )
  ).rows;
  const hashes = {};
  for (const { nspname, relname } of tables) {
    assert.match(nspname, /^(public|private)$/);
    assert.match(relname, /^[a-z_]+$/);
    const row = (
      await db.query(
        `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text rows from "${nspname}"."${relname}" t`,
      )
    ).rows[0];
    hashes[`${nspname}.${relname}`] = digest(row.rows);
  }
  return hashes;
}
async function security(db) {
  const row = (
    await db.query(
      await readFile("supabase/checks/security-baseline.sql", "utf8"),
    )
  ).rows[0];
  const positive = {
    public_table_count: 24,
    anonymous_function_count: 1,
    self_profile_id_insert: true,
    storage_objects_rls: true,
    evidence_bucket_count: 1,
    evidence_bucket_contract: true,
  };
  assert.equal(Object.keys(row).length, 19);
  for (const [key, value] of Object.entries(positive))
    assert.equal(row[key], value);
  for (const [key, value] of Object.entries(row))
    if (!Object.hasOwn(positive, key))
      assert.ok(value === 0 || value === false);
  return row;
}
function verifyBytes(manifest, database, object) {
  assert.equal(digest(database), manifest.database_sha256);
  assert.equal(digest(object), manifest.object_sha256);
  assert.equal(database.length, manifest.database_bytes);
  assert.equal(object.length, manifest.object_bytes);
}

async function backup() {
  stage = "backup-schema";
  const db = await parentPrivacyDatabase();
  try {
    stage = "backup-fixture";
    const doctor = await actor(db, "DOCTOR"),
      outside = await actor(db, "OUTSIDE"),
      manager = await actor(db, "MANAGER", true);
    const facility = await rpc(db, doctor, "create_facility", [
      randomUUID(),
      "Centre entièrement fictif de récupération",
      "Rabat",
    ]);
    const child = await rpc(db, doctor, "register_child", [
      randomUUID(),
      {
        facility_id: facility,
        register_year: 2026,
        register_book: "RECOVERY",
        local_number: "125",
        given_name: "Enfant entièrement fictif",
        family_name: "Test récupération",
        birth_date: "2025-01-01",
        sex: "unknown",
      },
    ]);
    for (const kind of ["consultation", "appointment"])
      await rpc(db, manager, "set_clinical_capability", [
        randomUUID(),
        doctor.id,
        kind,
        true,
        null,
        "Qualification fictive du seul test isolé.",
        "Attribution fictive pour récupération.",
        true,
      ]);
    const entry = (findings) => [
      randomUUID(),
      child,
      "consultation",
      facility,
      null,
      "unknown",
      "paper_transcription",
      "Source de papier entièrement fictive",
      false,
      { reason: "Contrôle entièrement fictif", findings },
    ];
    const clinicalRoot = await rpc(
      db,
      doctor,
      "write_clinical_entry",
      entry("Observation fictive originale"),
    );
    await rpc(db, doctor, "write_clinical_entry", [
      ...entry("Observation fictive corrigée"),
      clinicalRoot,
      1,
      "Correction fictive justifiée.",
      "active",
    ]);
    const appointment = await rpc(db, doctor, "create_appointment", [
      randomUUID(),
      child,
      facility,
      "consultation",
      "Rendez-vous fictif",
      null,
      await fixtureAppointmentTime(db, "2026-01-02T10:00"),
      await fixtureAppointmentTime(db, "2026-01-02T10:30"),
      "Création fictive pour récupération.",
      true,
    ]);
    await rpc(db, doctor, "change_appointment", [
      randomUUID(),
      appointment,
      1,
      "reschedule",
      await fixtureAppointmentTime(db, "2030-01-03T10:00"),
      await fixtureAppointmentTime(db, "2030-01-03T10:30"),
      "Déplacement entièrement fictif.",
      true,
    ]);
    const object = Buffer.from(
      "%PDF-1.4\nDocument entièrement fictif du test de récupération.\n%%EOF\n",
    );
    const objectName = `${doctor.id}/recovery-fixture.pdf`;
    await db.query(
      "insert into storage.objects(bucket_id,name) values('professional-evidence',$1)",
      [objectName],
    );
    const manifest = {
      version: 1,
      synthetic_only: true,
      engine: "pglite",
      source_commit: process.env.GITHUB_SHA,
      backup_job: process.env.GITHUB_JOB,
      context: {
        doctor,
        outside,
        manager,
        child,
        clinicalRoot,
        appointment,
        objectName,
      },
      row_hashes: await fingerprint(db),
      security: await security(db),
      object_sha256: digest(object),
      object_bytes: object.length,
    };
    stage = "backup-snapshot";
    const database = Buffer.from(
      await (await db.dumpDataDir("gzip")).arrayBuffer(),
    );
    manifest.database_sha256 = digest(database);
    manifest.database_bytes = database.length;
    stage = "backup-files";
    await mkdir(bundle, { recursive: true });
    await writeFile(join(bundle, "database.tar.gz"), database, { mode: 0o600 });
    // Object bytes are separate; the database contains only their metadata.
    await writeFile(join(bundle, "evidence-fixture.pdf"), object, {
      mode: 0o600,
    });
    await writeFile(join(bundle, "manifest.json"), JSON.stringify(manifest), {
      mode: 0o600,
    });
  } finally {
    await db.close();
  }
}

async function restore() {
  stage = "restore-integrity";
  const manifest = JSON.parse(
    await readFile(join(bundle, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.version, 1);
  assert.equal(manifest.synthetic_only, true);
  assert.equal(manifest.engine, "pglite");
  assert.match(manifest.source_commit, /^[a-f0-9]{40}$/);
  assert.equal(manifest.source_commit, process.env.GITHUB_SHA);
  const freshRunner = manifest.backup_job !== process.env.GITHUB_JOB;
  if (process.env.MON_ENFANT_REQUIRE_FRESH_RUNNER === "1")
    assert.equal(freshRunner, true);
  const database = await readFile(join(bundle, "database.tar.gz")),
    object = await readFile(join(bundle, "evidence-fixture.pdf"));
  verifyBytes(manifest, database, object);
  const corrupt = Buffer.from(database);
  corrupt[0] ^= 1;
  assert.throws(() => verifyBytes(manifest, corrupt, object));
  assert.throws(() => verifyBytes(manifest, database, Buffer.alloc(0)));
  stage = "restore-database";
  const started = performance.now();
  const db = await PGlite.create({ loadDataDir: new Blob([database]) });
  try {
    stage = "restore-row-integrity";
    assert.deepEqual(await fingerprint(db), manifest.row_hashes);
    stage = "restore-privileges";
    assert.deepEqual(await security(db), manifest.security);
    const { doctor, outside, manager, child, clinicalRoot, objectName } =
      manifest.context;
    // A restored snapshot can resurrect old session rows: invalidate them before
    // permitting application access, then model a new, trusted fixture sign-in.
    stage = "restore-session-containment";
    await db.exec("delete from auth.sessions");
    await assert.rejects(
      () => rpc(db, doctor, "clinical_export", [child]),
      /access denied/i,
    );
    const renewed = { ...doctor, session: randomUUID() };
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
      renewed.session,
      doctor.id,
    ]);
    for (const actor of [outside, manager])
      await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
        actor.session,
        actor.id,
      ]);
    stage = "restore-authorized-ledger";
    const ledger = await rpc(db, renewed, "clinical_export", [child]);
    assert.equal(ledger.length, 2);
    assert.equal(ledger[0].root_id, clinicalRoot);
    assert.equal(ledger[1].root_id, clinicalRoot);
    assert.deepEqual(ledger.map((entry) => entry.revision).sort(), [1, 2]);
    for (const entry of ledger) {
      assert.equal(entry.occurred_on, null);
      assert.equal(entry.occurrence_precision, "unknown");
      assert.equal(entry.source_verified, false);
      assert.equal(entry.author_id, doctor.id);
    }
    await assert.rejects(
      () => rpc(db, outside, "clinical_export", [child]),
      /access denied/i,
    );
    await assert.rejects(
      () => rpc(db, manager, "clinical_export", [child]),
      /access denied/i,
    );
    await db.exec("set role anon");
    try {
      await assert.rejects(
        () => db.query("select * from public.children"),
        /permission denied/i,
      );
    } finally {
      await db.exec("reset role");
    }
    stage = "restore-immutability";
    await assert.rejects(
      () =>
        db.query("delete from public.clinical_entries where root_id=$1", [
          clinicalRoot,
        ]),
      /Append-only/,
    );
    await assert.rejects(
      () => db.query("delete from public.appointment_events"),
      /Append-only/,
    );
    const rows = (
      await db.query(
        "select (select count(*)::integer from public.clinical_entries) clinical_revisions,(select count(*)::integer from public.appointments) appointments,(select count(*)::integer from public.appointment_events) appointment_events,(select count(*)::integer from public.audit_events) audit_events,(select count(*)::integer from public.vaccine_rules) vaccine_rules,(select count(*)::integer from public.vaccine_versions where status='draft' and revision=1) original_drafts",
      )
    ).rows[0];
    assert.equal(rows.clinical_revisions, 2);
    assert.equal(rows.appointments, 1);
    assert.equal(rows.appointment_events, 3);
    const appointmentActions = (
      await db.query(
        "select action from public.appointment_events order by revision",
      )
    ).rows.map((event) => event.action);
    assert.deepEqual(appointmentActions, ["created", "missed", "rescheduled"]);
    assert.ok(rows.audit_events > 0);
    assert.equal(rows.vaccine_rules, 25);
    assert.equal(rows.original_drafts, 1);
    stage = "restore-object";
    assert.equal(
      (
        await db.query(
          "select count(*)::integer n from storage.objects where bucket_id='professional-evidence' and name=$1",
          [objectName],
        )
      ).rows[0].n,
      1,
    );
    await mkdir(join(root, "restored-objects"), { recursive: true });
    await writeFile(
      join(root, "restored-objects/evidence-fixture.pdf"),
      object,
      { mode: 0o600 },
    );
    assert.equal(
      digest(
        await readFile(join(root, "restored-objects/evidence-fixture.pdf")),
      ),
      manifest.object_sha256,
    );
    stage = "restore-proof";
    const proof = {
      status: "passed",
      synthetic_only: true,
      source_commit: manifest.source_commit,
      fresh_cloud_runner_restore: freshRunner,
      data_and_acl_integrity: true,
      corrupted_archive_rejected: true,
      missing_object_rejected: true,
      stale_modeled_session_denied: true,
      renewed_modeled_session_read: true,
      unrelated_and_admin_denied: true,
      anonymous_table_denied: true,
      append_only_preserved: true,
      original_missed_slot_retained: true,
      original_draft_preserved: true,
      separate_object_bytes_recovered: true,
      ...rows,
      database_bytes: database.length,
      object_bytes: object.length,
      restore_elapsed_ms: Math.round(performance.now() - started),
      hosted_restore_acceptance_claimed: false,
      hosted_auth_storage_recovery_claimed: false,
    };
    await writeFile(join(root, "proof.json"), JSON.stringify(proof), {
      mode: 0o600,
    });
    console.log(JSON.stringify(proof));
  } finally {
    await db.close();
  }
}

try {
  assert.ok(process.env.GITHUB_ACTIONS === "true", "Cloud runner required.");
  assert.match(process.env.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/);
  assert.ok(["backup", "restore"].includes(mode));
  // Only exact, constant migration validation messages can enter diagnostics.
  // Interpolated messages and raw engine/provider details remain withheld.
  for (const file of await readdir("supabase/migrations")) {
    if (!/^\d{14}_[a-z_]+\.sql$/.test(file)) continue;
    const sql = await readFile(`supabase/migrations/${file}`, "utf8");
    for (const match of sql.matchAll(/raise exception '([^']+)'/g))
      knownBusinessErrors.add(match[1]);
  }
  if (mode === "backup") await backup();
  else await restore();
} catch (error) {
  console.error(
    JSON.stringify({
      status: "failed",
      stage,
      failure_code:
        typeof error?.code === "string" && /^[A-Z0-9]{5}$/.test(error.code)
          ? error.code
          : "unclassified",
      business_error: knownBusinessErrors.has(error?.message)
        ? error.message
        : "unclassified",
      synthetic_only: true,
      hosted_restore_acceptance_claimed: false,
    }),
  );
  process.exitCode = 1;
}
