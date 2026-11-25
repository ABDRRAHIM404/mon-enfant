import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { sharingDatabase, sessionActing } from "./helpers/database";
import {
  resolveAppointmentTime,
  appointmentWorkspaceRange,
  todayCasablanca,
} from "../src/lib/appointments/calendar";
import { addCivilDays, routineReference } from "../src/lib/vaccines/calendar";
import type {
  AppointmentWorkspace,
  RoutineAppointmentProposals,
} from "../src/lib/appointments/types";
import type { CatalogSnapshot } from "../src/lib/vaccines/types";
let db: PGlite, version: string, seed: string, editor: Actor, reviewer: Actor;
type Actor = { id: string; session: string };
type Row = {
  id: string;
  child_id: string;
  effective_state: string;
  state: string;
  revision: number;
  responsible_id: string;
  documentation: null | { professional_id: string };
  recorded_by_other: boolean;
};
type Work = { items: Row[]; total: number; counts: Record<string, number> };
type Event = {
  id: string;
  revision: number;
  action: string;
  state: string;
  starts_at: string;
  ends_at: string;
  previous_starts_at: string;
  professional_id: string;
  reason: string;
};
type History = { appointment: Row; events: Event[] };
const reason = "Décision fictive relue sans valeur clinique.";
const start = "2026-01-02T10:00:00+01:00",
  end = "2026-01-02T10:30:00+01:00";
const futureStart = resolveAppointmentTime("2030-01-03T10:00"),
  futureEnd = resolveAppointmentTime("2030-01-03T10:30");
async function actor(
  role = "doctor",
  status = "approved",
  appointment = true,
): Promise<Actor> {
  const id = randomUUID(),
    session = randomUUID();
  await db.query("insert into auth.users(id) values($1)", [id]);
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    session,
    id,
  ]);
  await db.query(
    "insert into public.professional_profiles(user_id,role,verification_status,professional_id) values($1,$2,$3,$4)",
    [id, role, status, status === "approved" ? `APT-${id}` : null],
  );
  if (appointment && role === "doctor")
    await cap({ id, session }, "appointment");
  return { id, session };
}
async function cap(a: Actor, kind: string, enabled = true) {
  await db.query(
    "insert into public.professional_capabilities(professional_id,capability,enabled,granted_by) values($1,$2,$3,$1) on conflict(professional_id,capability) do update set enabled=excluded.enabled",
    [a.id, kind, enabled],
  );
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
async function setup(dob: string | null = "2025-01-01", sex = "female") {
  const a = await actor(),
    facility = await rpc<string>(a, "create_facility", [
      randomUUID(),
      "Centre de rendez-vous fictif",
      "Rabat",
    ]);
  const operation = randomUUID();
  const registration = {
    facility_id: facility,
    register_year: 2026,
    register_book: "A",
    local_number: "125",
    given_name: `Enfant fictif ${randomUUID()}`,
    family_name: randomUUID(),
    birth_date: dob,
    birth_date_precision: dob ? "exact" : "unknown",
    sex,
  };
  await rpc(a, "prepare_child_registration", [
    operation,
    registration,
    `Mère fictive ${randomUUID()}`,
    "Maternité fictive",
    false,
  ]);
  const child = await rpc<string>(a, "register_child", [
    operation,
    registration,
  ]);
  return { a, facility, child };
}
async function item(a: Actor, child: string, facility: string, dose = "VPO1") {
  await cap(a, "vaccination");
  const id = await rpc<string>(a, "assign_vaccine_item", [
    randomUUID(),
    child,
    version,
    dose,
    facility,
    reason,
    true,
  ]);
  await cap(a, "vaccination", false);
  return id;
}
function createArgs(
  child: string,
  facility: string,
  itemId: string | null = null,
  from = start,
  to = end,
  op = randomUUID(),
) {
  return [
    op,
    child,
    facility,
    itemId ? "vaccination" : "consultation",
    itemId ? "Vaccination fictive" : "Consultation fictive",
    itemId,
    from,
    to,
    reason,
    true,
  ];
}
function decision(
  id: string,
  revision: number,
  action = "reschedule",
  from: string | null = futureStart,
  to: string | null = futureEnd,
  op = randomUUID(),
) {
  return [op, id, revision, action, from, to, reason, true];
}
function payload(itemId = "") {
  return {
    vaccine_code: "VPO",
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
    matching_status: itemId ? "clinician_validated" : "unmatched",
    schedule_item_id: itemId,
    duplicate_override_reason: "",
    notes: "Données fictives",
  };
}
function dose(child: string, facility: string, itemId = "") {
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
    payload(itemId),
  ];
}
async function link(a: Actor, b: Actor, child: string) {
  await db.query(
    "insert into public.access_grants(child_id,professional_id,granted_by) values($1,$2,$3)",
    [child, b.id, a.id],
  );
}
beforeAll(async () => {
  db = await sharingDatabase();
  await db.exec("create role service_role");
  for (const file of [
    "20261119150616_doctor_care_qr.sql",
    "20261119152628_parent_care_visit_qr.sql",
    "20261119164356_parent_child_drafts.sql",
    "20261121174928_pni_hepatitis_b_birth_draft.sql",
    "20261121183740_routine_appointment_proposals.sql",
    "20261121190310_appointment_workspace_filters.sql",
    "20261124192109_vaccination_booklet_reviews.sql",
    "20261124195146_patient_routine_appointment_proposals.sql",
    "20261125174814_booklet_history_verification.sql",
    "20261125190338_quick_child_registration.sql",
  ])
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  editor = await actor("admin");
  reviewer = await actor();
  await cap(reviewer, "vaccination");
  await db.query(
    "insert into private.staff_permissions(user_id,can_manage_vaccine_catalog,can_review_vaccine_catalog) values($1,true,false),($2,false,true)",
    [editor.id, reviewer.id],
  );
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
    {
      label: "Version de rendez-vous fictifs",
      reason,
      evidence_reference: reason,
    },
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
it("audits and retracts explicit overdue findings without assuming missing history is a missed dose", async () => {
  const { a, child, facility } = await setup();
  const outsider = await actor();
  const unverified = await actor("doctor", "unverified");
  const read = (actor = a) =>
    rpc<
      {
        id: string;
        dose_code: string;
        outstanding: boolean;
        recommended_end: string;
      }[]
    >(actor, "vaccination_booklet_reviews", [child, version]);
  const review = (
    actor: Actor,
    code: string,
    outstanding: boolean,
    previous: string | null = null,
    operation = randomUUID(),
  ) =>
    rpc<string>(actor, "review_booklet_dose", [
      operation,
      child,
      version,
      code,
      previous,
      outstanding,
      reason,
    ]);

  expect(await read()).toEqual([]);
  await expect(read(outsider)).rejects.toMatchObject({ code: "42501" });
  await expect(read(unverified)).rejects.toMatchObject({ code: "42501" });
  await expect(review(a, "VPO1", true)).rejects.toMatchObject({
    code: "42501",
  });
  await cap(a, "vaccination");
  await expect(review(a, "HB1", true)).rejects.toMatchObject({ code: "22023" });
  const operation = randomUUID();
  const confirmed = await review(a, "VPO1", true, null, operation);
  expect(await review(a, "VPO1", true, null, operation)).toEqual(confirmed);
  expect(await read()).toEqual([
    {
      id: confirmed,
      dose_code: "VPO1",
      outstanding: true,
      recommended_end: "2025-02-26",
    },
  ]);
  await expect(review(a, "VPO1", true)).rejects.toMatchObject({
    code: "PT409",
  });
  const retracted = await review(a, "VPO1", false, confirmed);
  expect(await read()).toEqual([
    {
      id: retracted,
      dose_code: "VPO1",
      outstanding: false,
      recommended_end: "2025-02-26",
    },
  ]);
  await review(a, "VPO1", true, retracted);
  const administration = dose(child, facility);
  administration[9] = { ...payload(), dose_label: "VPO1" };
  await rpc(a, "write_clinical_entry", administration);
  const current = (await read())[0];
  expect(current.outstanding).toBe(false);
  await expect(review(a, "VPO1", true, current.id)).rejects.toMatchObject({
    code: "PT409",
  });
  expect(
    (
      await db.query(
        "select outstanding from private.vaccination_booklet_reviews where child_id=$1 order by recorded_at",
        [child],
      )
    ).rows,
  ).toEqual([
    { outstanding: true },
    { outstanding: false },
    { outstanding: true },
  ]);
});

it("transcribes one paper dose using the authorized ledger and preserves audited verification decisions", async () => {
  const today = todayCasablanca();
  const date = addCivilDays(today, -1);
  const { a, child, facility } = await setup(addCivilDays(today, -90));
  const other = await actor();
  const verify = (
    decision: string,
    dose: string,
    date: string | null = null,
    previous: string | null = null,
    operation = randomUUID(),
    actor = a,
  ) =>
    rpc<string>(actor, "verify_booklet_dose", [
      operation,
      child,
      version,
      dose,
      previous,
      decision,
      date,
      decision === "uncertain" ? null : reason,
    ]);
  const review = async () =>
    rpc<
      {
        id: string;
        dose_code: string;
        outstanding: boolean;
        uncertain?: boolean;
      }[]
    >(a, "vaccination_booklet_reviews", [child, version]);
  await expect(verify("uncertain", "VPO1")).rejects.toMatchObject({
    code: "42501",
  });
  await cap(a, "vaccination");
  await expect(
    verify("uncertain", "VPO1", null, null, randomUUID(), other),
  ).rejects.toMatchObject({ code: "42501" });
  const overdue = await verify("not_administered", "VPO1");
  const future = await verify("not_administered", "RR1");
  expect(await review()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: overdue,
        dose_code: "VPO1",
        outstanding: true,
      }),
      expect.objectContaining({
        id: future,
        dose_code: "RR1",
        outstanding: true,
      }),
    ]),
  );
  const uncertain = await verify("uncertain", "VPO1", null, overdue);
  expect(await review()).toContainEqual(
    expect.objectContaining({
      id: uncertain,
      outstanding: false,
      uncertain: true,
    }),
  );
  await expect(
    verify("administered", "VPO1", null, uncertain),
  ).rejects.toMatchObject({ code: "22023" });
  const proposalsBefore = await rpc<RoutineAppointmentProposals>(
    a,
    "patient_routine_appointment_proposals",
    [child],
  );
  const group = proposalsBefore.items.find(({ doses }) => doses.length === 1)!;
  const next = group.doses[0].code;
  const appointment = await rpc<string>(a, "confirm_routine_appointment", [
    randomUUID(),
    child,
    version,
    group.recommended_on,
    [next],
    facility,
    resolveAppointmentTime(`${group.recommended_on}T10:00`),
    resolveAppointmentTime(`${group.recommended_on}T10:30`),
    reason,
    true,
  ]);
  const prior = await rpc<History>(a, "appointment_history", [
    child,
    appointment,
  ]);
  const operation = randomUUID();
  const result = await verify("administered", next, date, null, operation);
  expect(await verify("administered", next, date, null, operation)).toBe(
    result,
  );
  await expect(verify("administered", next, date)).rejects.toMatchObject({
    code: "PT409",
  });
  const projection = await rpc<{
    items: {
      id: string;
      occurred_on: string;
      source_type: string;
      source_verified: boolean;
      payload: Record<string, string>;
      vaccine_mapping: { dose_code: string };
    }[];
  }>(a, "clinical_timeline", [child, 1, "vaccination"]);
  expect(projection.items).toHaveLength(1);
  expect(projection.items[0]).toMatchObject({
    id: result,
    occurred_on: date,
    source_type: "paper_transcription",
    source_verified: true,
    payload: {
      lot_status: "unknown",
      provider_status: "unknown",
      administration_facility_status: "unknown",
    },
    vaccine_mapping: { dose_code: next },
  });
  const reconciled = await rpc<History>(a, "appointment_history", [
    child,
    appointment,
  ]);
  expect(reconciled.events).toEqual(prior.events);
  expect(reconciled.appointment).toMatchObject({
    state: "scheduled",
    effective_state: "dose_documented",
  });
  const after = await rpc<{ items: { doses: { code: string }[] }[] }>(
    a,
    "patient_routine_appointment_proposals",
    [child],
  );
  expect(
    after.items.some((row) => row.doses.some((dose) => dose.code === next)),
  ).toBe(false);
});

describe("quick registration and deferred dossier completion", () => {
  it("keeps complete and paper registration on the original register path", async () => {
    const { a, facility, child } = await setup();
    const op = randomUUID();
    const paper = {
      facility_id: facility,
      register_year: 2026,
      register_book: "P",
      local_number: "004",
      name_status: "unknown",
      birth_date_precision: "unknown",
      sex: "unknown",
      source_type: "paper_transcription",
      paper_reference: "Carnet de test fictif",
      history_status: "partial",
    };
    expect(
      await rpc(a, "prepare_child_registration", [op, paper]),
    ).toMatchObject({ state: "ready" });
    const id = await rpc<string>(a, "register_child", [op, paper]);
    expect(id).not.toBe(child);
    expect(await rpc(a, "get_child_profile", [id])).toMatchObject({
      birth_date: null,
      given_name: null,
      source_type: paper.source_type,
      paper_reference: paper.paper_reference,
      registers: [{ facility_id: facility, number: "004" }],
    });
    expect(await rpc(a, "get_child_profile", [child])).toMatchObject({
      source_type: "new_registration",
      registers: [{ number: "125" }],
    });
  });

  it("opens a readable booklet and eligible proposals before local registration, then preserves care and identity on completion", async () => {
    const a = await actor("nurse");
    const operation = randomUUID();
    const body = {
      quick_registration: true,
      given_name: "Enfant fictif",
      family_name: randomUUID(),
      birth_date: todayCasablanca(),
      sex: "unknown",
    };
    const prepare = (who: Actor, op: string, details = body) =>
      rpc<{ state: string }>(who, "prepare_child_registration", [
        op,
        details,
        null,
        null,
        false,
      ]);
    expect(await prepare(a, operation)).toMatchObject({ state: "ready" });
    const id = await rpc<string>(a, "register_child", [operation, body]);
    expect(await rpc(a, "register_child", [operation, body])).toBe(id);
    const profile = () =>
      rpc<{ id: string; universal_id: string }>(a, "get_child_profile", [id]);
    const minimal = await profile();
    expect(minimal).toMatchObject({
      id,
      sex: "unknown",
      history_status: "unknown",
      can_manage_access: true,
      registers: [],
    });
    expect(
      await rpc(a, "list_patients", [body.family_name, "all", "all", 1]),
    ).toMatchObject({ total: 1, items: [{ id }] });

    const other = await actor();
    const blockedOp = randomUUID();
    const known = { ...body, sex: "female" };
    const duplicate = await prepare(other, blockedOp, known);
    expect(duplicate).toEqual({
      state: "needs_details",
      operation_id: blockedOp,
      checked: true,
    });
    await expect(
      rpc(other, "register_child", [blockedOp, known]),
    ).rejects.toMatchObject({ code: "PT409" });
    await expect(rpc(other, "get_child_profile", [id])).rejects.toMatchObject({
      code: "42501",
    });
    const pending = await actor("doctor", "unverified");
    await expect(prepare(pending, randomUUID())).rejects.toMatchObject({
      code: "42501",
    });

    const scoped = await rpc<RoutineAppointmentProposals>(
      a,
      "patient_routine_appointment_proposals",
      [id, 1],
    );
    expect(scoped).toMatchObject({ version, preview: false });
    expect(
      scoped.items.some(
        (group) =>
          group.child_id === id &&
          group.doses.some(({ code }) => code === "VPO1"),
      ),
    ).toBe(true);
    expect(
      scoped.items.every((group) =>
        group.doses.every(({ code }) => !code.startsWith("HPV")),
      ),
    ).toBe(true);
    expect(await rpc(a, "routine_appointment_proposals", [1])).toEqual(scoped);
    expect(
      await rpc(a, "clinical_timeline", [id, 1, "vaccination"]),
    ).toMatchObject({ total: 0 });
    const facility = await rpc<string>(a, "create_facility", [
      randomUUID(),
      "Centre fictif",
      "Belfaa",
    ]);
    await cap(a, "vaccination");
    const recordedDose = dose(id, facility);
    recordedDose[4] = body.birth_date;
    const care = await rpc<string>(a, "write_clinical_entry", recordedDose);

    const revision = 0;
    const details = {
      given_name: "Enfant fictif corrigé",
      family_name: body.family_name,
      birth_date: body.birth_date,
      birth_date_precision: "exact",
      sex: "unknown",
      name_status: "confirmed",
      history_status: "partial",
    };
    const register = {
      facility_id: facility,
      year: "2026",
      book: "A",
      number: "0005",
    };
    const update = [randomUUID(), id, revision, details, register];
    await expect(
      rpc(other, "update_child_information", update),
    ).rejects.toMatchObject({ code: "42501" });
    await db.query(
      "insert into public.access_grants(child_id,professional_id,granted_by) values($1,$2,$3)",
      [id, other.id, a.id],
    );
    await expect(
      rpc(other, "update_child_information", update),
    ).rejects.toMatchObject({ code: "42501" });
    expect(await rpc(a, "update_child_information", update)).toBe(id);
    expect(await rpc(a, "update_child_information", update)).toBe(id);
    await expect(
      rpc(a, "update_child_information", [randomUUID(), ...update.slice(1)]),
    ).rejects.toMatchObject({ code: "PT409" });
    expect(await profile()).toMatchObject({
      id,
      universal_id: minimal.universal_id,
      profile_revision: 1,
      given_name: details.given_name,
      registers: [{ number: "0005", facility_id: facility }],
    });
    expect(
      await rpc(a, "clinical_timeline", [id, 1, "vaccination"]),
    ).toMatchObject({ total: 1, items: [{ id: care }] });
    expect(
      await rpc(a, "list_patients", ["0005", "all", "all", 1]),
    ).toMatchObject({ total: 1, items: [{ id }] });

    const registerId = (
      await rpc<{ registers: { id: string }[] }>(a, "get_child_profile", [id])
    ).registers[0].id;
    await rpc(a, "update_child_information", [
      randomUUID(),
      id,
      1,
      details,
      { ...register, id: registerId, number: "0006" },
    ]);
    expect(await profile()).toMatchObject({
      registers: [{ id: registerId, number: "0006" }],
    });
    expect(
      await rpc(a, "list_patients", ["0005", "all", "all", 1]),
    ).toMatchObject({ total: 0 });
  });
});

describe("automatic routine offers and grouped booking", () => {
  it("groups dates, enforces rights, confirms idempotently and preserves the recommendation", async () => {
    const today = todayCasablanca();
    const { a, child, facility } = await setup(today);
    const outsider = await actor();
    const unverified = await actor("doctor", "unverified");
    type Proposals = {
      version: string;
      preview: boolean;
      items: {
        child_id: string;
        recommended_on: string;
        doses: { code: string }[];
      }[];
    };
    const fetch = (who = a) =>
      rpc<Proposals>(who, "routine_appointment_proposals");
    const read = (
      date: string,
      view: "day" | "week" | "month" = "day",
      state = "all",
      who = a,
      proposalPage = 1,
    ) => {
      const { period, month } = appointmentWorkspaceRange(date, view);
      return rpc<AppointmentWorkspace>(who, "appointment_workspace", [
        period.from,
        period.to,
        month,
        1,
        proposalPage,
        state,
      ]);
    };
    const scoped = (id = child, who = a, page = 1) =>
      rpc<Proposals>(who, "patient_routine_appointment_proposals", [id, page]);
    const otherChild = (await setup(today)).child;
    await expect(scoped(otherChild)).rejects.toMatchObject({ code: "42501" });
    await expect(scoped(child, outsider)).rejects.toMatchObject({
      code: "42501",
    });
    await expect(scoped(child, unverified)).rejects.toMatchObject({
      code: "42501",
    });
    await expect(scoped(child, a, 0)).rejects.toMatchObject({ code: "22023" });
    const first = await fetch();
    expect(await scoped()).toEqual(first);
    expect(
      (await scoped(child, a, 2)).items.every(
        (group) => group.child_id === child,
      ),
    ).toBe(true);
    expect(first).toEqual(await fetch());
    expect(first).toMatchObject({ version, preview: false });
    const offer = first.items.find((entry) =>
      entry.doses.some(({ code }) => code === "VPO1"),
    )!;
    expect(offer).toMatchObject({ child_id: child });
    const codes = offer.doses.map(({ code }) => code);
    expect(codes).toContain("VPO1");
    expect(codes).not.toContain("HB1");
    expect(codes).not.toContain("HBn");
    expect(codes.length).toBeGreaterThan(1);
    const selected = await read(offer.recommended_on);
    expect(selected.proposals.items).toHaveLength(1);
    expect(selected.proposals.items[0]).toMatchObject({
      child_id: child,
      recommended_on: offer.recommended_on,
    });
    expect(selected.days).toContainEqual({
      day: offer.recommended_on,
      appointments: 0,
      proposals: 1,
    });
    expect(selected.appointments.total).toBe(0);
    for (const mode of ["week", "month"] as const) {
      const result = await read(offer.recommended_on, mode);
      const { period } = appointmentWorkspaceRange(offer.recommended_on, mode);
      expect(
        result.proposals.items.every(
          (group) =>
            group.recommended_on >= period.from &&
            group.recommended_on <= period.to,
        ),
      ).toBe(true);
      expect(result.proposals.total).toBeGreaterThan(0);
    }
    expect(
      (await read(offer.recommended_on, "day", "pending")).proposals.total,
    ).toBe(1);
    expect(
      (await read(offer.recommended_on, "day", "indicative")).proposals.total,
    ).toBe(0);
    expect(
      (await read(offer.recommended_on, "day", "scheduled")).days.every(
        ({ proposals }) => proposals === 0,
      ),
    ).toBe(true);
    expect(
      (await read(offer.recommended_on, "month", "all", outsider)).proposals
        .total,
    ).toBe(0);
    await expect(
      read(offer.recommended_on, "day", "all", unverified),
    ).rejects.toThrow();

    expect((await fetch(outsider)).items).toEqual([]);
    await expect(fetch(unverified)).rejects.toThrow();
    const date = new Date(`${offer.recommended_on}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 2);
    const modified = date.toISOString().slice(0, 10);
    const args = [
      randomUUID(),
      child,
      version,
      offer.recommended_on,
      codes,
      facility,
      resolveAppointmentTime(`${modified}T10:00`),
      resolveAppointmentTime(`${modified}T10:30`),
      reason,
      true,
    ];
    const confirm = (input = args, who = a) =>
      rpc<string>(who, "confirm_routine_appointment", input);
    await expect(confirm(args, outsider)).rejects.toThrow(/child access/);
    await expect(confirm()).rejects.toThrow(/Vaccination capability/);
    await cap(a, "vaccination");
    await expect(
      confirm(args.map((arg, i) => (i === 4 ? ["VPO1"] : arg))),
    ).rejects.toThrow(/Proposal changed/);
    const appointment = await confirm();
    expect(await confirm()).toBe(appointment);
    await expect(
      confirm(args.map((arg, i) => (i === 0 ? randomUUID() : arg))),
    ).rejects.toThrow(/Proposal changed/);
    expect(
      (await fetch()).items.find(
        (entry) => entry.recommended_on === offer.recommended_on,
      ),
    ).toBeUndefined();
    expect(await scoped()).toEqual(await fetch());
    expect(
      (await scoped()).items.some(
        (row) => row.recommended_on === offer.recommended_on,
      ),
    ).toBe(false);
    const detail = await rpc<History>(a, "appointment_history", [
      child,
      appointment,
    ]);
    expect(detail.appointment).toMatchObject({
      recommended_on: offer.recommended_on,
      starts_on: modified,
      dose_codes: codes,
      state: "scheduled",
    });
    const groupedItems = await db.query<{ item_id: string; dose_code: string }>(
      "select d.item_id,i.dose_code from private.appointment_routine_doses d join public.child_vaccine_items i on i.id=d.item_id where appointment_id=$1",
      [appointment],
    );
    expect(groupedItems.rows).toHaveLength(codes.length);
    const calendar = await rpc<Work>(a, "appointment_calendar", [
      modified,
      modified,
    ]);
    expect(calendar.items.map(({ id }) => id)).toEqual([appointment]);
    expect((await read(offer.recommended_on)).proposals.items).toEqual([]);
    const afterBooking = await read(modified, "day", "confirmed");
    expect(afterBooking.appointments.items.map(({ id }) => id)).toEqual([
      appointment,
    ]);
    expect(afterBooking.days).toContainEqual({
      day: modified,
      appointments: 1,
      proposals: 0,
    });
    expect(await read(modified, "day", "confirmed")).toEqual(afterBooking);
    expect((await read(modified, "day", "cancelled")).appointments.total).toBe(
      0,
    );
    const sameDateOffer = (await fetch()).items[0];
    expect(sameDateOffer).toBeDefined();
    const sameDate = sameDateOffer.recommended_on;
    const sameDateBooking = await confirm([
      randomUUID(),
      child,
      version,
      sameDate,
      sameDateOffer.doses.map(({ code }) => code),
      facility,
      resolveAppointmentTime(`${sameDate}T15:00`),
      resolveAppointmentTime(`${sameDate}T15:30`),
      reason,
      true,
    ]);
    expect(
      (await read(sameDate, "day", "confirmed")).appointments.items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: sameDateBooking,
          recommended_on: sameDate,
          starts_on: sameDate,
        }),
      ]),
    );

    const vpo = groupedItems.rows.find(
      ({ dose_code }) => dose_code === "VPO1",
    )!;
    const record = dose(child, facility, vpo.item_id);
    record[4] = today;
    await rpc(a, "write_clinical_entry", record);
    expect(
      (await rpc<History>(a, "appointment_history", [child, appointment]))
        .appointment.effective_state,
    ).toBe("scheduled");
    const available = await fetch();
    expect(
      available.items.flatMap((offer) => offer.doses).map(({ code }) => code),
    ).not.toContain("VPO1");
  });
});

describe("appointments, independent clinical permissions and cross-doctor continuity", () => {
  it("keeps all direct appointment data and projection helpers private with RLS", async () => {
    const { a } = await setup();
    for (const table of ["appointments", "appointment_events"])
      await expect(
        sessionActing(db, a.id, a.session, `select * from public.${table}`),
      ).rejects.toThrow(/permission denied/);
    for (const call of [
      "private.appointment_rows()",
      "private.item_documentation(null)",
      "private.item_reference(null)",
      "private.list_patients_base()",
    ])
      await expect(
        sessionActing(db, a.id, a.session, `select ${call}`),
      ).rejects.toThrow(/permission denied/);
    const r = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
    );
    expect(r.rows.every((row) => row.relrowsecurity)).toBe(true);
  });
  it("requires a separate appointment capability, current grant/facility and approved doctor", async () => {
    const { a, child, facility } = await setup(),
      outside = await actor(),
      unverified = await actor("doctor", "unverified");
    await cap(a, "appointment", false);
    await cap(a, "vaccination");
    await expect(
      rpc(a, "create_appointment", createArgs(child, facility)),
    ).rejects.toThrow(/Appointment capability/);
    await cap(a, "appointment");
    await cap(a, "vaccination", false);
    await expect(
      rpc(a, "write_clinical_entry", dose(child, facility)),
    ).rejects.toThrow(/capability/);
    for (const who of [outside, editor, unverified])
      await expect(
        rpc(who, "create_appointment", createArgs(child, facility)),
      ).rejects.toThrow(/required/);
    const other = await setup();
    await expect(
      rpc(a, "create_appointment", createArgs(child, other.facility)),
    ).rejects.toThrow(/facility/);
  });
  it("uses the checked permission manager workflow without implying vaccination privileges", async () => {
    const { a } = await setup();
    await cap(a, "appointment", false);
    const manager = await actor("admin");
    await db.query(
      "insert into private.staff_permissions(user_id,can_manage_clinical_permissions) values($1,true)",
      [manager.id],
    );
    await rpc(manager, "set_clinical_capability", [
      randomUUID(),
      a.id,
      "appointment",
      true,
      null,
      reason,
      reason,
      true,
    ]);
    expect(await rpc(a, "my_clinical_capabilities")).toEqual(["appointment"]);
    expect(await rpc(a, "clinical_capability_history", [a.id])).toMatchObject([
      { capability: "appointment", enabled: true },
    ]);
    await expect(
      rpc(editor, "set_clinical_capability", [
        randomUUID(),
        a.id,
        "appointment",
        true,
        null,
        reason,
        reason,
        true,
      ]),
    ).rejects.toThrow(/manager required/);
  });
  it("binds creation retries to one immutable appointment and exact input", async () => {
    const { a, child, facility } = await setup(),
      args = createArgs(child, facility),
      id = await rpc(a, "create_appointment", args);
    expect(await rpc(a, "create_appointment", args)).toBe(id);
    const changed = [...args];
    changed[4] = "Changed label";
    await expect(rpc(a, "create_appointment", changed)).rejects.toThrow(
      /reused/,
    );
    expect(await rpc(a, "appointment_history", [child, id])).toMatchObject({
      appointment: {
        id,
        revision: 1,
        responsible_id: a.id,
        effective_state: "missed",
      },
      events: [{ action: "created", professional_id: `APT-${a.id}` }],
    });
    await expect(
      db.query(
        "update public.appointments set purpose_label='Other' where id=$1",
        [id],
      ),
    ).rejects.toThrow(/Append-only/);
    await expect(
      db.query(
        "delete from public.appointment_events where appointment_id=$1",
        [id],
      ),
    ).rejects.toThrow(/Append-only/);
  });
  it("validates local offsets, repeated Casablanca times, clock gaps and slot bounds", async () => {
    const { a, child, facility } = await setup();
    for (const [from, to] of [
      ["2026-01-02T10:00:00+00:00", "2026-01-02T10:30:00+00:00"],
      ["2025-04-06T02:15:00+00:00", "2025-04-06T02:45:00+00:00"],
      ["2025-04-06T02:15:00+01:00", "2025-04-06T02:45:00+01:00"],
      [start, start],
      [end, start],
      [start, "2026-01-04T10:30:00+01:00"],
      ["2026-01-02T10:00:00", end],
    ])
      await expect(
        rpc(
          a,
          "create_appointment",
          createArgs(child, facility, null, from, to),
        ),
      ).rejects.toThrow();
    for (const offset of ["+01:00", "+00:00"])
      await rpc(
        a,
        "create_appointment",
        createArgs(
          child,
          facility,
          null,
          `2025-02-23T02:15:00${offset}`,
          `2025-02-23T02:45:00${offset}`,
        ),
      );
    const r = await rpc<{ items: Row[]; total: number }>(
      a,
      "appointment_calendar",
      ["2025-02-23", "2025-02-23"],
    );
    expect(r.total).toBe(2);
  });
  it("preserves the original missed slot, actor and old/new dates while rescheduling leaves the dose pending", async () => {
    const { a, child, facility } = await setup(),
      reference = await item(a, child, facility),
      id = await rpc<string>(
        a,
        "create_appointment",
        createArgs(child, facility, reference),
      );
    expect(
      (await rpc<Work>(a, "appointment_worklist", ["missed_vaccinations"]))
        .total,
    ).toBe(1);
    const args = decision(id, 1);
    const result = await rpc(a, "change_appointment", args);
    expect(await rpc(a, "change_appointment", args)).toBe(result);
    const history = await rpc<History>(a, "appointment_history", [child, id]);
    expect(history.events).toMatchObject([
      { revision: 1, state: "scheduled" },
      { revision: 2, state: "missed", professional_id: `APT-${a.id}` },
      { revision: 3, action: "rescheduled", state: "scheduled", reason },
    ]);
    expect(new Date(history.events[2].previous_starts_at).toISOString()).toBe(
      "2026-01-02T09:00:00.000Z",
    );
    expect(new Date(history.events[2].starts_at).toISOString()).toBe(
      new Date(futureStart).toISOString(),
    );
    expect(history.appointment).toMatchObject({
      effective_state: "scheduled",
      revision: 3,
      documentation: null,
    });
    expect(
      (await rpc<Work>(a, "appointment_worklist", ["missed_vaccinations"]))
        .total,
    ).toBe(0);
    expect(
      (
        await rpc<{ items: { followup_state: string }[] }>(
          a,
          "vaccine_followup_worklist",
        )
      ).items[0].followup_state,
    ).toBe("potentially_overdue_unconfirmed");
    expect(await rpc(a, "clinical_export", [child])).toEqual([]);
    await expect(
      rpc(a, "change_appointment", decision(id, 1)),
    ).rejects.toMatchObject({ code: "PT409" });
  });
  it("does not manufacture vaccine completion or miss a future slot; records non-vaccination visit dispositions", async () => {
    const { a, child, facility } = await setup(),
      reference = await item(a, child, facility),
      vax = await rpc(
        a,
        "create_appointment",
        createArgs(child, facility, reference),
      );
    await expect(
      rpc(
        a,
        "change_appointment",
        decision(String(vax), 1, "complete", null, null),
      ),
    ).rejects.toThrow(/document doses/);
    const future = await rpc<string>(
      a,
      "create_appointment",
      createArgs(child, facility, null, futureStart, futureEnd),
    );
    await expect(
      rpc(
        a,
        "change_appointment",
        decision(future, 1, "mark_missed", null, null),
      ),
    ).rejects.toThrow(/passed/);
    await expect(
      rpc(a, "change_appointment", decision(future, 1, "complete", null, null)),
    ).rejects.toThrow(/past/);
    await rpc(
      a,
      "change_appointment",
      decision(future, 1, "cancel", null, null),
    );
    expect(
      (await rpc<History>(a, "appointment_history", [child, future]))
        .appointment.effective_state,
    ).toBe("cancelled");
    const past = await rpc<string>(
      a,
      "create_appointment",
      createArgs(child, facility),
    );
    await rpc(
      a,
      "change_appointment",
      decision(past, 1, "complete", null, null),
    );
    expect(
      (await rpc<History>(a, "appointment_history", [child, past])).events,
    ).toMatchObject([
      { state: "scheduled" },
      { state: "missed" },
      { state: "completed" },
    ]);
    expect(await rpc(a, "clinical_export", [child])).toEqual([]);
  });
  it("prevents duplicate owner/item reminders and denies another doctor's appointment changes", async () => {
    const { a, child, facility } = await setup(),
      reference = await item(a, child, facility),
      id = await rpc<string>(
        a,
        "create_appointment",
        createArgs(child, facility, reference),
      ),
      b = await actor();
    await link(a, b, child);
    await expect(
      rpc(a, "create_appointment", createArgs(child, facility, reference)),
    ).rejects.toMatchObject({ code: "PT409", hint: "appointment_duplicate" });
    const fb = await rpc<string>(b, "create_facility", [
      randomUUID(),
      "Centre B fictif",
      "Rabat",
    ]);
    await rpc(b, "create_appointment", createArgs(child, fb, reference));
    await expect(
      rpc(b, "change_appointment", decision(id, 1, "cancel", null, null)),
    ).rejects.toThrow(/Responsible/);
    expect(
      (await rpc<{ total: number }>(b, "patient_appointments", [child])).total,
    ).toBe(2);
    expect((await rpc<Work>(a, "appointment_worklist", ["all"])).total).toBe(1);
    expect((await rpc<Work>(b, "appointment_worklist", ["all"])).total).toBe(1);
  });
  it("A's queue resolves B's qualifying dose while retaining an independent consultation and raw appointment history", async () => {
    const { a, child, facility } = await setup(),
      reference = await item(a, child, facility),
      vax = await rpc<string>(
        a,
        "create_appointment",
        createArgs(child, facility, reference),
      );
    const consultation = await rpc<string>(
      a,
      "create_appointment",
      createArgs(child, facility, null, futureStart, futureEnd),
    );
    const b = await actor();
    await link(a, b, child);
    await cap(b, "vaccination");
    const fb = await rpc<string>(b, "create_facility", [
      randomUUID(),
      "Centre B fictif",
      "Rabat",
    ]);
    await rpc(b, "write_clinical_entry", dose(child, fb, reference));
    const work = await rpc<Work>(a, "appointment_worklist", [
      "resolved_by_other",
    ]);
    expect(work).toMatchObject({
      total: 1,
      counts: { missed_vaccinations: 0, resolved_by_other: 1 },
      items: [
        {
          id: vax,
          effective_state: "dose_documented",
          state: "scheduled",
          recorded_by_other: true,
          documentation: { professional_id: `APT-${b.id}` },
        },
      ],
    });
    const history = await rpc<History>(a, "appointment_history", [child, vax]);
    expect(history.events).toHaveLength(1);
    expect(history.events[0].state).toBe("scheduled");
    expect(
      (await rpc<History>(a, "appointment_history", [child, consultation]))
        .appointment.effective_state,
    ).toBe("scheduled");
    expect(
      (
        await rpc<{ items: { followup_state: string }[] }>(
          a,
          "vaccine_followup_worklist",
        )
      ).items[0].followup_state,
    ).toBe("documented");
    const overview = await rpc<{
      last_documented_care: string;
      next_own_appointment: Row;
    }>(a, "patient_visit_overview", [child]);
    expect(overview).toMatchObject({
      last_documented_care: "2026-01-02",
      next_own_appointment: { id: consultation },
    });
    const registry = await rpc<{
      items: { last_documented_care: string; next_own_appointment: Row }[];
    }>(a, "list_patients");
    expect(registry.items[0]).toMatchObject(overview);
  });
  it("reopens an outstanding vaccine follow-up on correction/withdrawal and keeps explicit cancellations", async () => {
    const { a, child, facility } = await setup(),
      reference = await item(a, child, facility),
      id = await rpc<string>(
        a,
        "create_appointment",
        createArgs(child, facility, reference),
      );
    await cap(a, "vaccination");
    const original = dose(child, facility, reference),
      root = await rpc<string>(a, "write_clinical_entry", original);
    expect(
      (await rpc<History>(a, "appointment_history", [child, id])).appointment
        .effective_state,
    ).toBe("dose_documented");
    await rpc(a, "write_clinical_entry", [
      ...dose(child, facility),
      root,
      1,
      reason,
      "active",
    ]);
    expect(
      (await rpc<Work>(a, "appointment_worklist", ["missed_vaccinations"]))
        .total,
    ).toBe(1);
    await rpc(a, "write_clinical_entry", [
      ...dose(child, facility, reference),
      root,
      2,
      reason,
      "active",
    ]);
    expect(
      (await rpc<Work>(a, "appointment_worklist", ["missed_vaccinations"]))
        .total,
    ).toBe(0);
    await rpc(a, "write_clinical_entry", [
      ...dose(child, facility, reference),
      root,
      3,
      reason,
      "withdrawn",
    ]);
    expect(
      (await rpc<Work>(a, "appointment_worklist", ["missed_vaccinations"]))
        .total,
    ).toBe(1);
    await rpc(a, "change_appointment", decision(id, 1, "cancel", null, null));
    await rpc(a, "write_clinical_entry", [
      ...dose(child, facility, reference),
      root,
      4,
      reason,
      "active",
    ]);
    expect(
      (await rpc<History>(a, "appointment_history", [child, id])).appointment
        .effective_state,
    ).toBe("cancelled");
  });
  it("keeps unknown history and potentially overdue references distinct from actual missed appointments", async () => {
    const { a, child, facility } = await setup();
    await item(a, child, facility);
    expect(
      (await rpc<Work>(a, "appointment_worklist", ["missed_vaccinations"]))
        .total,
    ).toBe(0);
    expect(await rpc(a, "vaccine_followup_worklist")).toMatchObject({
      total: 1,
      counts: { potentially_overdue_unconfirmed: 1, unknown_history: 1 },
      items: [
        {
          followup_state: "potentially_overdue_unconfirmed",
          history_status: "unknown",
        },
      ],
    });
    const unknown = await setup(null);
    await item(unknown.a, unknown.child, unknown.facility);
    expect(await rpc(unknown.a, "vaccine_followup_worklist")).toMatchObject({
      items: [
        {
          followup_state: "reference_review",
          reference: {
            state: "birth_date_uncertain",
            start_on: null,
            end_on: null,
          },
        },
      ],
    });
  });
  it("keeps SQL routine dates/windows equal to the reviewed date-only kernel, including leap/year/month ends", async () => {
    const { a, child, facility } = await setup("2024-01-31"),
      detail = await rpc<{ version: CatalogSnapshot }>(a, "vaccine_catalog", [
        version,
      ]);
    for (const rule of detail.version.rules.filter(
      (r) => r.automatic_scheduling && r.dose_code !== "HB1",
    )) {
      const id = await item(a, child, facility, rule.dose_code),
        r = await db.query<{
          value: {
            state: string;
            start_on: string;
            end_on: string;
            is_window: boolean;
          };
        }>("select private.item_reference($1) value", [id]);
      const expected = routineReference(
        {
          doseCode: rule.dose_code,
          vaccineCode: rule.vaccine_code,
          age: rule.age,
          eligibility: rule.eligibility,
          automaticScheduling: rule.automatic_scheduling,
        },
        { birthDate: "2024-01-31", birthPrecision: "exact", sex: "female" },
        { status: "approved", reviewVerified: true },
      );
      expect(r.rows[0].value).toEqual({
        state: expected.state,
        start_on: expected.startOn,
        end_on: expected.endOn,
        is_window: expected.isWindow,
      });
    }
    const leap = await setup("2024-02-29"),
      id = await item(leap.a, leap.child, leap.facility, "HPV");
    const r = await db.query<{ value: { start_on: string } }>(
      "select private.item_reference($1) value",
      [id],
    );
    expect(r.rows[0].value.start_on).toBe("2035-02-28");
  });
  it("paginates full calendar/day counts and shared history without hiding totals or repeating rows", async () => {
    const { a, child, facility } = await setup();
    for (let n = 0; n < 55; n++)
      await rpc(
        a,
        "create_appointment",
        createArgs(child, facility, null, futureStart, futureEnd),
      );
    const one = await rpc<{
        items: Row[];
        total: number;
        days: { day: string; count: number }[];
      }>(a, "appointment_calendar", ["2030-01-01", "2030-01-31", 1]),
      two = await rpc<{ items: Row[]; total: number }>(
        a,
        "appointment_calendar",
        ["2030-01-01", "2030-01-31", 2],
      );
    expect(one).toMatchObject({
      total: 55,
      days: [{ day: "2030-01-03", count: 55 }],
    });
    expect(one.items).toHaveLength(50);
    expect(two.items).toHaveLength(5);
    expect(
      new Set([...one.items, ...two.items].map((row) => row.id)).size,
    ).toBe(55);
    expect(
      (
        await rpc<{ items: Row[]; total: number }>(a, "patient_appointments", [
          child,
          2,
        ])
      ).items,
    ).toHaveLength(25);
    expect(await rpc(a, "appointments_export", [child])).toHaveLength(55);
    await expect(
      rpc(a, "appointment_calendar", ["2030-01-01", "2030-03-01"]),
    ).rejects.toThrow(/Invalid calendar/);
  });
  it("fails complete export explicitly beyond the interactive limit", async () => {
    const { a, child, facility } = await setup();
    await db.query(
      "insert into public.appointments(child_id,responsible_id,professional_id,facility_id,purpose,purpose_label) select $1,$2,$3,$4,'other','Fixture volumétrique' from generate_series(1,5001)",
      [child, a.id, `APT-${a.id}`, facility],
    );
    await expect(rpc(a, "appointments_export", [child])).rejects.toMatchObject({
      code: "54000",
    });
  });
  it("cuts writes on capability/facility revocation and all child data on expired grants or logout", async () => {
    const { a, child, facility } = await setup(),
      id = await rpc<string>(
        a,
        "create_appointment",
        createArgs(child, facility),
      );
    await cap(a, "appointment", false);
    await expect(rpc(a, "change_appointment", decision(id, 1))).rejects.toThrow(
      /capability/,
    );
    expect(
      (await rpc<History>(a, "appointment_history", [child, id])).events,
    ).toHaveLength(1);
    await cap(a, "appointment");
    await db.query(
      "update public.professional_facilities set revoked_at=now() where professional_id=$1",
      [a.id],
    );
    await expect(rpc(a, "change_appointment", decision(id, 1))).rejects.toThrow(
      /facility/,
    );
    await db.query(
      "update public.access_grants set granted_at=now()-interval '2 days',expires_at=now()-interval '1 second' where child_id=$1",
      [child],
    );
    await expect(rpc(a, "appointment_history", [child, id])).rejects.toThrow(
      /denied/,
    );
    await expect(rpc(a, "appointments_export", [child])).rejects.toThrow(
      /denied/,
    );
    expect((await rpc<Work>(a, "appointment_worklist", ["all"])).total).toBe(0);
    await db.query("delete from auth.sessions where id=$1", [a.session]);
    await expect(
      rpc(a, "appointment_calendar", ["2030-01-01", "2030-01-31"]),
    ).rejects.toThrow(/required/);
  });
  it("keeps retired-version mappings but requires review for withdrawn/ineligible references", async () => {
    const { a, child, facility } = await setup(),
      reference = await item(a, child, facility, "HPV");
    const beforeChange = await rpc<string>(
      a,
      "create_appointment",
      createArgs(child, facility, reference),
    );
    await db.query("update public.children set sex='male' where id=$1", [
      child,
    ]);
    expect(
      (await rpc<History>(a, "appointment_history", [child, beforeChange]))
        .appointment.effective_state,
    ).toBe("reference_review");
    expect(
      (await rpc<Work>(a, "appointment_worklist", ["missed_vaccinations"]))
        .total,
    ).toBe(0);

    await expect(
      rpc(a, "create_appointment", createArgs(child, facility, reference)),
    ).rejects.toThrow(/Active reviewed/);
    const current = await setup(),
      id = await item(current.a, current.child, current.facility);
    await rpc(editor, "change_vaccine_catalog", [
      randomUUID(),
      "retire",
      version,
      2,
      { reason, evidence_reference: reason },
    ]);
    const appointment = await rpc<string>(
      current.a,
      "create_appointment",
      createArgs(current.child, current.facility, id),
    );
    expect(await rpc(current.a, "vaccine_followup_worklist")).toMatchObject({
      items: [
        {
          followup_state: "reference_review",
          reference: { state: "unreviewed_version", start_on: null },
        },
      ],
    });
    await cap(current.a, "vaccination");
    await rpc(current.a, "change_vaccine_item", [
      randomUUID(),
      id,
      1,
      "withdrawn",
      current.facility,
      reason,
      false,
    ]);
    expect(
      (
        await rpc<History>(current.a, "appointment_history", [
          current.child,
          appointment,
        ])
      ).appointment.effective_state,
    ).toBe("reference_review");
    await expect(
      rpc(current.a, "change_appointment", decision(appointment, 1)),
    ).rejects.toThrow(/Active reviewed/);
  });
});

describe("routine offers from the beta catalogue", () => {
  it("offers an indicative revised beta date while refusing booking when no approved version exists", async () => {
    const { a, child, facility } = await setup(todayCasablanca());
    await cap(a, "vaccination");
    const result = await rpc<{
      version: string;
      preview: boolean;
      items: { recommended_on: string; doses: { code: string }[] }[];
    }>(a, "routine_appointment_proposals");
    expect(result).toMatchObject({
      version: "0c504568-7c67-49bb-b43b-c8382439a850",
      preview: true,
    });
    const offer = result.items[0];
    expect(offer).toBeDefined();
    const day = offer.recommended_on;
    const read = (state: string) =>
      rpc<AppointmentWorkspace>(a, "appointment_workspace", [
        day,
        day,
        day.slice(0, 7) + "-01",
        1,
        1,
        state,
      ]);
    expect(await read("indicative")).toMatchObject({
      proposals: {
        preview: true,
        total: 1,
        items: [expect.objectContaining({ recommended_on: day })],
      },
      appointments: { total: 0, items: [] },
    });
    expect((await read("pending")).proposals.total).toBe(0);

    await expect(
      rpc(a, "confirm_routine_appointment", [
        randomUUID(),
        child,
        result.version,
        offer.recommended_on,
        offer.doses.map(({ code }) => code),
        facility,
        resolveAppointmentTime(`${offer.recommended_on}T10:00`),
        resolveAppointmentTime(`${offer.recommended_on}T10:30`),
        reason,
        true,
      ]),
    ).rejects.toThrow(/Approved reference changed or unavailable/);
  });
});
