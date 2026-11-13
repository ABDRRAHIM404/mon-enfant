import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  civilDay,
  addCivilDays,
  addCalendarMonths,
  addCalendarYears,
  routineReference,
  type RoutineRule,
} from "../src/lib/vaccines/calendar";
import { transcribedSourceRules } from "../src/lib/vaccines/source";
const child = {
  birthDate: "2024-01-31",
  birthPrecision: "exact",
  sex: "female",
} as const;
const approved = { status: "approved", reviewVerified: true } as const;
const rules = transcribedSourceRules();
function rule(code: string) {
  const found = rules.find((r) => r.doseCode === code);
  if (!found) throw new Error("Missing source rule");
  return found;
}
describe("routine date-only reference calculations", () => {
  it("preserves all 25 rows, source ages, PCV labels and source decisions", () => {
    expect(rules).toHaveLength(25);
    expect(new Set(rules.map((r) => r.doseCode)).size).toBe(25);
    expect(
      rules.filter((r) => r.vaccineCode === "PCV").map((r) => r.doseCode),
    ).toEqual(["PCV1", "PCV2", "PCV3", "PCV4"]);
    expect(
      rules
        .filter((r) => r.vaccineCode === "ROTA")
        .map((r) => [r.age, r.sourceAge]),
    ).toEqual([
      [
        { unit: "months", value: 2 },
        { unit: "weeks", value: 8 },
      ],
      [
        { unit: "months", value: 3 },
        { unit: "weeks", value: 12 },
      ],
      [
        { unit: "months", value: 4 },
        { unit: "weeks", value: 16 },
      ],
    ]);
    expect(rule("HPV")).toMatchObject({
      age: { unit: "years", value: 11 },
      eligibility: "female",
      decisionId: "PNI-HPV-GIRLS",
    });
    expect(rules.some((r) => r.doseCode === "HBn")).toBe(false);
    expect(
      createHash("sha256")
        .update(readFileSync("data-for-supa/MON_ENFANT_PNI_DATA.json"))
        .digest("hex"),
    ).toBe("e232057f6eb9118c8b2963d26f627249215749b9fcb293949ef773c81e591028");
  });
  it("uses calendar month-end clamping and leap-year arithmetic", () => {
    expect(addCalendarMonths("9999-12-01", 0)).toBe("9999-12-01");
    expect(addCalendarMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addCalendarMonths("2023-01-31", 1)).toBe("2023-02-28");
    expect(addCalendarMonths("2024-01-31", 2)).toBe("2024-03-31");
    expect(addCalendarMonths("2024-12-31", 2)).toBe("2025-02-28");
    expect(addCalendarYears("2024-02-29", 1)).toBe("2025-02-28");
    expect(addCalendarYears("2000-02-29", 100)).toBe("2100-02-28");
  });
  it("adds civil days without local-time/DST drift or automatic month grouping", () => {
    expect(addCivilDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addCivilDays("2024-03-09", 2)).toBe("2024-03-11");
    expect(addCivilDays("2024-12-31", 1)).toBe("2025-01-01");
    expect(routineReference(rule("Rota1"), child, approved).startOn).toBe(
      "2024-03-31",
    );
    expect(routineReference(rule("VPO1"), child, approved).startOn).toBe(
      "2024-03-27",
    );
    expect(routineReference(rule("Penta1"), child, approved).startOn).toBe(
      "2024-03-27",
    );
  });
  it("leaves draft/retired/unverified versions unusable for patient routine dates", () => {
    for (const version of [
      { status: "draft", reviewVerified: false },
      { status: "retired", reviewVerified: true },
      { status: "approved", reviewVerified: false },
    ] as const)
      expect(routineReference(rule("Rota1"), child, version)).toMatchObject({
        state: "unreviewed_version",
        startOn: null,
        endOn: null,
      });
  });
  it("never schedules HB1 even when a caller tries to enable the rule", () => {
    expect(
      routineReference(
        { ...rule("HB1"), automaticScheduling: true },
        child,
        approved,
      ),
    ).toMatchObject({
      state: "disabled_reference_only",
      startOn: null,
      endOn: null,
    });
  });
  it("retains the first four weeks as a window rather than an exact appointment", () => {
    expect(routineReference(rule("BCG"), child, approved)).toEqual({
      state: "routine_reference",
      startOn: "2024-01-31",
      endOn: "2024-02-27",
      isWindow: true,
    });
    expect(routineReference(rule("VPO0"), child, approved).isWindow).toBe(true);
  });
  it("does not compute dates for unknown/estimated birth dates", () => {
    for (const birthPrecision of ["unknown", "estimated"] as const)
      expect(
        routineReference(rule("Rota1"), { ...child, birthPrecision }, approved),
      ).toMatchObject({ state: "birth_date_uncertain", startOn: null });
    expect(
      routineReference(rule("Rota1"), { ...child, birthDate: null }, approved)
        .state,
    ).toBe("birth_date_uncertain");
  });
  it("limits HPV references to girls at 11 while unknown sex stays undetermined", () => {
    expect(routineReference(rule("HPV"), child, approved).startOn).toBe(
      "2035-01-31",
    );
    expect(
      routineReference(rule("HPV"), { ...child, sex: "male" }, approved),
    ).toMatchObject({ state: "ineligible", startOn: null });
    expect(
      routineReference(rule("HPV"), { ...child, sex: "unknown" }, approved),
    ).toMatchObject({ state: "eligibility_unknown", startOn: null });
  });
  it("rejects changed HPV/rotavirus constraints before producing a date", () => {
    expect(() =>
      routineReference({ ...rule("HPV"), eligibility: "all" }, child, approved),
    ).toThrow("HPV");
    expect(() =>
      routineReference(
        { ...rule("Rota1"), age: { unit: "weeks", value: 8 } },
        child,
        approved,
      ),
    ).toThrow("rotavirus");
  });
  it("rejects invalid civil dates and non-integer/invalid ages", () => {
    for (const date of [
      "0000-01-01",
      "2023-02-29",
      "2024-13-01",
      "31/01/2024",
      "2024-02-30",
      "2024-01-01T00:00:00Z",
    ])
      expect(() => civilDay(date)).toThrow();
    expect(() => addCalendarMonths("2024-01-01", 1.5)).toThrow();
    expect(() =>
      routineReference(
        { ...rule("Rota1"), age: { unit: "months", value: 0 } } as RoutineRule,
        child,
        approved,
      ),
    ).toThrow();
  });
});
