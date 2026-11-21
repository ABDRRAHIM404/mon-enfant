import { describe, expect, it } from "vitest";
import { vaccinationValidationMessage } from "../src/lib/vaccines/record-validation";

describe("vaccination validation feedback", () => {
  const input = {
    p_payload: {
      lot_status: "unknown",
      site_status: "unknown",
      provider_status: "unknown",
      administration_facility_status: "unknown",
      matching_status: "unmatched",
    },
    p_source_type: "observed",
    p_source_reference: null,
    p_source_verified: false,
    p_occurred_on: "2026-11-05",
    p_occurrence_precision: "exact",
  };

  it("names the field whose certainty disagrees with its value", () => {
    const error = {
      code: "22023",
      message:
        "Known/unknown lot, site, provider and facility must be explicit",
    };
    const withDetails = (details: Record<string, string>) =>
      vaccinationValidationMessage(error, {
        ...input,
        p_payload: { ...input.p_payload, ...details },
      });
    expect(withDetails({ site: "Fictif" })).toMatch(
      /^Site d’administration : choisissez/,
    );
    expect(withDetails({ administration_facility_status: "known" })).toMatch(
      /^Lieu réel d’administration : renseignez/,
    );
  });

  it("explains the source and reference rules without exposing database errors", () => {
    const message = (error: string) =>
      vaccinationValidationMessage({ code: "22023", message: error }, input);
    expect(
      message(
        "Matching needs active intended item, exact date, verified source and eligibility",
      ),
    ).toContain("contrôlez la source");
    expect(
      message(
        "Matching requires an exact intended item; uncertain entries remain unmatched",
      ),
    ).toContain("laissez la référence prévue vide");
    expect(message("Unexpected database detail")).toBeUndefined();
  });
});
