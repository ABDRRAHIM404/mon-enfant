import { it, expect } from "vitest";
import { transcribedSourceRules } from "../src/lib/vaccines/source";
import {
  provisionalRoutineRows,
  type ProvisionalFollowup,
} from "../src/lib/vaccines/provisional-followup";
const identity = {
  birth_date: "2026-11-01",
  birth_date_precision: "exact",
  sex: "unknown",
};
function data(): ProvisionalFollowup {
  return {
    version: {
      id: "qa",
      label: "Revue fictive, aucun avis clinique",
      status: "approved",
      review_verified: true,
    },
    rules: transcribedSourceRules().map((r) => ({
      dose_code: r.doseCode,
      vaccine_code: r.vaccineCode,
      label: r.label,
      age: r.age,
      eligibility: r.eligibility,
      automatic_scheduling: r.automaticScheduling,
    })),
    declarations_complete: true,
    declarations: [],
    appointments_total: 0,
    appointments: [],
  };
}
it("normal declared HB1 does not hide other future routine vaccines or create an HB1/catch-up reference", () => {
  const d = data();
  d.declarations = [
    {
      id: "qa-entry",
      dose_code: "HB1",
      dose_label: "HB1",
      vaccine_code: "HB",
      occurred_on: "2026-11-01",
      occurrence_precision: "exact",
      source_type: "observed",
    },
  ];
  const rows = provisionalRoutineRows(d, identity, "2026-11-17");
  expect(rows.find((r) => r.dose_code === "VPO1")).toMatchObject({
    past: false,
    reference: { state: "routine_reference", startOn: "2026-12-27" },
  });
  expect(rows.some((r) => r.dose_code === "HB1")).toBe(false);
});
it("missing, uncertain and later HB1 history never shifts age-based dates into catch-up appointments", () => {
  const d = data(),
    base = provisionalRoutineRows(d, identity, "2026-11-17");
  for (const date of [null, "2026-11-15"]) {
    d.declarations = [
      {
        id: "qa",
        dose_code: "HB1",
        dose_label: "HB1",
        vaccine_code: "HB",
        occurred_on: date,
        occurrence_precision: date ? "exact" : "unknown",
        source_type: "paper_transcription",
      },
    ];
    expect(provisionalRoutineRows(d, identity, "2026-11-17")).toEqual(base);
  }
  expect(d.appointments).toEqual([]);
});
it("draft calendar preview shows dates while uncertain birth and unknown eligibility stay explicit", () => {
  const d = data();
  d.version = { ...d.version!, status: "draft", review_verified: false };
  expect(
    provisionalRoutineRows(d, identity, "2026-11-17").find(
      (r) => r.dose_code === "VPO1",
    ),
  ).toMatchObject({ previewOnly: true, reference: { startOn: "2026-12-27" } });
  expect(d.version.status).toBe("draft");
  expect(d.version.review_verified).toBe(false);
  d.version = { ...d.version!, status: "approved", review_verified: true };
  expect(
    provisionalRoutineRows(
      d,
      { ...identity, birth_date_precision: "estimated" },
      "2026-11-17",
    ).every((r) => r.reference.startOn === null),
  ).toBe(true);
  expect(
    provisionalRoutineRows(d, identity, "2026-11-17").find(
      (r) => r.dose_code === "HPV",
    )?.reference.state,
  ).toBe("eligibility_unknown");
});
it("a private declaration stays a declaration, and past references never become missed doses", () => {
  const d = data();
  d.declarations = [
    {
      id: "qa",
      dose_code: "VPO1",
      vaccine_code: "VPO",
      dose_label: "VPO1",
      occurred_on: "2026-12-27",
      occurrence_precision: "exact",
      source_type: "reported",
    },
  ];
  const row = provisionalRoutineRows(d, identity, "2027-01-01").find(
    (r) => r.dose_code === "VPO1",
  )!;
  expect(row.declared).toBe(true);
  expect(row.past).toBe(true);
  expect(row.reference.state).toBe("routine_reference");
  expect(row).not.toHaveProperty("completed");
  expect(row).not.toHaveProperty("missed");
});
