import { describe, it, expect } from "vitest";
import { invitationToken, SITE, civilAdd } from "../src/lib/format";
import {
  growthPoints,
  routineReference,
  type ClinicalEntry,
} from "../src/lib/domain";
const secret = "A".repeat(43);
describe("mobile input and shared clinical projections", () => {
  it("accepts only the existing parent invitation purpose, never another URL or child identification QR", () => {
    expect(invitationToken(secret)).toBe(secret);
    expect(invitationToken(`${SITE}/parent/invitation#invite=${secret}`)).toBe(
      secret,
    );
    for (const value of [
      `${SITE}/share#share=${secret}`,
      `https://foreign.invalid/parent/invitation#invite=${secret}`,
      `${SITE}/parent/invitation?invite=${secret}`,
      `${SITE}/parent/invitation#invite=${secret}&child=hidden`,
      `${SITE}/parent/invitation#invite=${secret}&invite=${secret}`,
      "short",
      "javascript:alert(1)",
    ])
      expect(invitationToken(value)).toBeNull();
  });
  it("keeps uncertain dates and withdrawn measurements out of plots while retaining source certainty", () => {
    const base: ClinicalEntry = {
      id: "00000000-0000-4000-8000-000000000001",
      root_id: "00000000-0000-4000-8000-000000000001",
      previous_id: null,
      revision: 1,
      child_id: "00000000-0000-4000-8000-000000000002",
      kind: "growth",
      author_id: "00000000-0000-4000-8000-000000000003",
      professional_id: "QA-ONLY",
      facility_id: "00000000-0000-4000-8000-000000000004",
      facility_name: "Centre fictif",
      entry_state: "active",
      occurrence_precision: "exact",
      occurred_on: "2026-01-02",
      source_verified: false,
      source_type: "observed",
      source_reference: null,
      amendment_reason: null,
      recorded_at: "2026-01-02T12:00:00Z",
      payload: { weight_kg: 6 },
    };
    const points = growthPoints(
      [
        base,
        { ...base, occurred_on: null },
        { ...base, occurrence_precision: "estimated" },
        { ...base, entry_state: "withdrawn" },
        {
          ...base,
          occurred_on: "2026-01-01",
          source_verified: true,
          payload: { weight_kg: 5 },
        },
        { ...base, payload: { weight_kg: "6" } },
      ],
      "weight_kg",
    );
    expect(points).toEqual([
      { date: "2026-01-01", value: 5, confirmed: true },
      { date: "2026-01-02", value: 6, confirmed: false },
    ]);
  });
  it("uses the same guarded routine calculation instead of inventing mobile schedule/catch-up dates", () => {
    const result = routineReference(
      {
        doseCode: "HB1",
        vaccineCode: "HB",
        age: { value: 0, unit: "months" },
        eligibility: "all",
        automaticScheduling: false,
      },
      { birthDate: "2025-01-01", birthPrecision: "exact", sex: "unknown" },
      { status: "draft", reviewVerified: false },
    );
    expect(result.startOn).toBeNull();
    expect(civilAdd("2024-02-28", 1)).toBe("2024-02-29");
  });
});
