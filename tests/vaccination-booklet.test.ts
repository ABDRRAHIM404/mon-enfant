import { expect, it } from "vitest";
import type { ClinicalEntry } from "../src/lib/clinical/types";
import type { Patient } from "../src/lib/registry/types";
import { bookletAge, vaccinationBooklet } from "../src/lib/vaccines/booklet";
import { transcribedSourceRules } from "../src/lib/vaccines/source";
import type { CatalogSnapshot } from "../src/lib/vaccines/types";

const child: Patient = {
  id: "fictional",
  universal_id: "fixture",
  given_name: "Enfant",
  family_name: "Fictif",
  name_status: "confirmed",
  birth_date: "2026-10-16",
  birth_date_precision: "exact",
  sex: "female",
  history_status: "reviewed",
  source_type: "new_registration",
  registers: [],
};
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
  rules: transcribedSourceRules().map((rule) => ({
    version_id: "fixture",
    dose_code: rule.doseCode,
    vaccine_code: rule.vaccineCode,
    age: rule.age,
    source_age: rule.sourceAge,
    source_row: rule.sourceRow,
    eligibility: rule.eligibility,
    automatic_scheduling: rule.automaticScheduling,
  })),
};
const entry: ClinicalEntry = {
  id: "entry",
  root_id: "entry",
  previous_id: null,
  revision: 1,
  child_id: child.id,
  kind: "vaccination",
  author_id: "fixture",
  professional_id: "PRO-FICTIF",
  facility_id: "fixture",
  facility_name: "Centre fictif",
  occurred_on: "2026-12-11",
  occurrence_precision: "exact",
  source_type: "observed",
  source_reference: null,
  source_verified: true,
  payload: { vaccine_code: "VPO", dose_label: "VPO1", lot_status: "unknown" },
  entry_state: "active",
  amendment_reason: null,
  recorded_at: "2026-12-11T12:00:00Z",
};

it("uses every applicable approved rule, including six months, and preserves weeks", () => {
  const result = vaccinationBooklet(
    child,
    catalog,
    [],
    true,
    [],
    [],
    "2026-11-24",
  );
  expect(result.rows).toHaveLength(catalog.rules.length);
  expect(
    result.rows.find((row) => row.rule.dose_code === "PCV3")?.ref.startOn,
  ).toBe("2027-04-16");
  expect(
    result.rows.find((row) => row.rule.dose_code === "VPO1")?.ref.startOn,
  ).toBe("2026-12-11");
  expect(
    result.rows.find((row) => row.rule.dose_code === "Rota1")?.ref.startOn,
  ).toBe("2026-12-16");
  expect(
    vaccinationBooklet(
      { ...child, sex: "male" },
      catalog,
      [],
      true,
      [],
      [],
      "2026-11-24",
    ).rows.some((row) => row.rule.dose_code === "HPV"),
  ).toBe(false);
  expect(
    vaccinationBooklet(
      child,
      { ...catalog, status: "draft" },
      [],
      true,
      [],
      [],
      "2026-11-24",
    ).rows,
  ).toEqual([]);
});

it("uses clinical evidence and explicit confirmation for date colors", () => {
  const status = (
    today: string,
    evidence: ClinicalEntry[] = [],
    reviewed = false,
    complete = true,
  ) =>
    vaccinationBooklet(
      child,
      catalog,
      evidence,
      complete,
      [],
      reviewed
        ? [
            {
              id: "review",
              dose_code: "VPO1",
              outstanding: true,
              recommended_end: "2026-12-11",
            },
          ]
        : [],
      today,
    ).rows.find((row) => row.rule.dose_code === "VPO1")?.status;
  expect(status("2026-12-11")).toBe("upcoming");
  expect(status("2026-12-12")).toBe("review");
  expect(status("2026-12-12", [], true)).toBe("overdue");
  expect(status("2026-12-12", [], true, false)).toBe("review");
  expect(status("2026-12-12", [entry], true)).toBe("completed");
  expect(
    status("2026-12-12", [
      { ...entry, source_type: "reported_history", source_verified: false },
    ]),
  ).toBe("review");
  expect(status("2026-12-12", [{ ...entry, entry_state: "withdrawn" }])).toBe(
    "review",
  );
});

it("computes age at administration across birth, weeks and month boundaries", () => {
  expect(bookletAge("2026-10-16", "2026-10-16")).toBe("0 jour");
  expect(bookletAge("2026-10-16", "2026-11-01")).toBe("16 jours");
  expect(bookletAge("2026-10-16", "2026-11-14")).toBe("Moins d’un mois");
  expect(bookletAge("2026-01-31", "2026-02-28")).toBe("1 mois");
  expect(bookletAge("2026-10-16", "2027-12-16")).toBe("1 an et 2 mois");
  expect(bookletAge("2026-10-16", "2026-10-15")).toBeNull();
});

it("treats upcoming non-administrations and explicit uncertainty distinctly", () => {
  const find = (today: string, review: { uncertain?: boolean }) =>
    vaccinationBooklet(
      child,
      catalog,
      [],
      true,
      [],
      [
        {
          id: "review",
          dose_code: "VPO1",
          outstanding: !review.uncertain,
          recommended_end: "2026-12-11",
          ...review,
        },
      ],
      today,
    ).rows.find((r) => r.rule.dose_code === "VPO1");
  expect(find("2026-12-10", {})?.status).toBe("upcoming");
  expect(find("2026-12-12", {})?.status).toBe("overdue");
  expect(find("2026-12-10", { uncertain: true })?.status).toBe("review");
  expect(find("2026-12-10", {})?.stage.label).toBe("≈ 2 mois");
  expect(find("2026-12-10", {})?.ref.startOn).toBe("2026-12-11");
});
