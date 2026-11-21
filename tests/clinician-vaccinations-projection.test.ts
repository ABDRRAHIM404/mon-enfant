import { describe, expect, it } from "vitest";
import {
  ageAtVaccination,
  vaccinationProjection,
} from "../src/components/clinician/vaccinations/projection";
import type { ClinicalEntry } from "../src/lib/clinical/types";
import type { Patient } from "../src/lib/registry/types";
import type { CatalogRule, CatalogSnapshot } from "../src/lib/vaccines/types";

const child: Patient = {
  id: "fictional-child",
  universal_id: "fixture-id",
  given_name: "Enfant",
  family_name: "Fictif",
  name_status: "recorded",
  birth_date: "2026-10-16",
  birth_date_precision: "exact",
  sex: "male",
  history_status: "reviewed",
  source_type: "new",
  registers: [],
};
const today = "2026-11-21";
function rule(
  dose: string,
  vaccine: string,
  age: CatalogRule["age"],
  automatic = true,
): CatalogRule {
  return {
    version_id: "fixture",
    dose_code: dose,
    vaccine_code: vaccine,
    age,
    source_age: age,
    source_row: {},
    eligibility: "all",
    automatic_scheduling: automatic,
  };
}
const catalog: CatalogSnapshot = {
  id: "fixture",
  parent_id: null,
  label: "Calendrier fictif",
  status: "approved",
  revision: 1,
  created_by: null,
  created_at: "2026-11-01",
  reviewed_by: "fixture",
  reviewed_at: "2026-11-02",
  review_reference: "fixture",
  review_verified: true,
  source_sha256: "fixture",
  source_document: {},
  rules: [
    rule("HB1", "HB", { unit: "first_4_weeks" }, false),
    rule("Penta1", "PENTA", { unit: "weeks", value: 8 }),
    rule("VPO1", "VPO", { unit: "weeks", value: 8 }),
    rule("Rota1", "ROTA", { unit: "months", value: 2 }),
    {
      ...rule("HPV", "HPV", { unit: "years", value: 11 }),
      eligibility: "female",
    },
  ],
};
const hb1: ClinicalEntry = {
  id: "fixture-1",
  root_id: "fixture-1",
  previous_id: null,
  revision: 1,
  child_id: child.id,
  kind: "vaccination",
  author_id: "fixture",
  professional_id: "PRO-FICTIF",
  facility_id: "fixture",
  facility_name: "Centre fictif",
  occurred_on: "2026-11-02",
  occurrence_precision: "exact",
  source_type: "observed",
  source_reference: null,
  source_verified: true,
  payload: { vaccine_code: "HB", dose_label: "HB1" },
  entry_state: "active",
  amendment_reason: null,
  recorded_at: "2026-11-02T12:00:00Z",
};

describe("clinician Vaccinations display", () => {
  it("keeps documented in-window HB1 out of manual guidance and preserves versioned dates", () => {
    const result = vaccinationProjection(child, catalog, [hb1], today);
    expect(ageAtVaccination(child, hb1)).toBe(17);
    expect(result.reviewHB1).toBe(false);
    expect(
      result.upcoming.map(({ rule, startOn }) => [rule.dose_code, startOn]),
    ).toEqual([
      ["Penta1", "2026-12-11"],
      ["VPO1", "2026-12-11"],
      ["Rota1", "2026-12-16"],
    ]);
    expect(
      vaccinationProjection(
        child,
        catalog,
        [{ ...hb1, occurred_on: "2026-11-12" }],
        today,
      ).reviewHB1,
    ).toBe(false);
  });

  it("asks for review with an uncertain, late or withdrawn HB1 when the context warrants", () => {
    for (const entry of [
      { ...hb1, occurrence_precision: "estimated" },
      { ...hb1, occurred_on: "2026-11-13" },
      { ...hb1, entry_state: "withdrawn" as const },
      { ...hb1, source_type: "reported_history", source_verified: false },
    ])
      expect(
        vaccinationProjection(child, catalog, [entry], today).reviewHB1,
      ).toBe(true);
    expect(
      vaccinationProjection(child, catalog, [], "2026-11-12").reviewHB1,
    ).toBe(false);
    expect(
      vaccinationProjection(
        { ...child, history_status: "unknown" },
        catalog,
        [],
        today,
      ).reviewHB1,
    ).toBe(false);
  });

  it("separates an identified uncertain declaration from a documented administration", () => {
    const penta = {
      ...hb1,
      payload: { vaccine_code: "PENTA", dose_label: "Penta1" },
    };
    const mapped = {
      ...penta,
      vaccine_mapping: {
        item_id: "fixture-item",
        version_id: catalog.id,
        version_label: catalog.label,
        dose_code: "Penta1",
        configured_age: { unit: "weeks", value: 8 },
        source_age: { unit: "weeks", value: 8 },
      },
    };
    const exact = vaccinationProjection(child, catalog, [hb1, mapped], today);
    expect(exact.upcoming.some(({ rule }) => rule.dose_code === "Penta1")).toBe(
      false,
    );
    expect(
      vaccinationProjection(child, catalog, [hb1, penta], today).upcoming.find(
        ({ rule }) => rule.dose_code === "Penta1",
      )?.needsReview,
    ).toBe(true);
    const uncertain = vaccinationProjection(
      child,
      catalog,
      [
        hb1,
        {
          ...penta,
          source_type: "paper_transcription",
          source_verified: false,
        },
      ],
      today,
    );
    expect(
      uncertain.upcoming.find(({ rule }) => rule.dose_code === "Penta1")
        ?.needsReview,
    ).toBe(true);
  });

  it("withholds calculated dates for draft rules, uncertain birth or incomplete history", () => {
    expect(
      vaccinationProjection(
        child,
        { ...catalog, status: "draft" },
        [hb1],
        today,
      ).upcoming,
    ).toEqual([]);
    expect(
      vaccinationProjection(
        child,
        { ...catalog, review_verified: false },
        [hb1],
        today,
      ).upcoming,
    ).toEqual([]);
    expect(
      vaccinationProjection(
        { ...child, birth_date_precision: "estimated" },
        catalog,
        [hb1],
        today,
      ).upcoming,
    ).toEqual([]);
    expect(vaccinationProjection(child, catalog, null, today)).toMatchObject({
      upcoming: [],
      reviewHB1: false,
    });
  });

  it("withholds HB1 follow-up when the documented HBn birth dose is present", () => {
    const birthDose = {
      ...hb1,
      occurred_on: "2026-10-16",
      payload: { vaccine_code: "HB", dose_label: "HBn" },
    };
    const revised = {
      ...catalog,
      rules: [
        ...catalog.rules,
        rule("HBn", "HB", { unit: "birth_24_hours" }, false),
      ],
    };
    const complete = vaccinationProjection(child, revised, [birthDose], today);
    expect(complete.reviewHB1).toBe(false);
    expect(
      complete.upcoming.some(({ rule }) =>
        ["HB1", "HBn"].includes(rule.dose_code),
      ),
    ).toBe(false);
    expect(
      vaccinationProjection(child, revised, [birthDose, hb1], today).reviewHB1,
    ).toBe(true);
    expect(
      vaccinationProjection(
        child,
        revised,
        [{ ...birthDose, occurrence_precision: "unknown", occurred_on: null }],
        today,
      ).reviewHB1,
    ).toBe(true);
  });
});
