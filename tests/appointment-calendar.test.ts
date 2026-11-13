import { describe, it, expect } from "vitest";
import {
  calendarRange,
  resolveAppointmentTime,
  todayCasablanca,
  localAppointmentInput,
  localAppointmentOffset,
} from "../src/lib/appointments/calendar";
describe("appointment calendar and explicit Casablanca instants", () => {
  it("keeps civil day/week/month boundaries including six-row and leap months", () => {
    expect(calendarRange("2026-11-13", "day").days).toEqual(["2026-11-13"]);
    expect(calendarRange("2026-11-15", "week")).toMatchObject({
      from: "2026-11-09",
      to: "2026-11-15",
      next: "2026-11-22",
    });
    const six = calendarRange("2026-03-31", "month");
    expect(six).toMatchObject({
      from: "2026-02-23",
      to: "2026-04-05",
      next: "2026-04-01",
    });
    expect(six.days).toHaveLength(42);
    expect(calendarRange("2024-02-29", "month").days).toContain("2024-02-29");
  });
  it("uses Morocco's local day instead of the server/browser timezone", () => {
    expect(todayCasablanca(new Date("2026-01-01T23:30:00Z"))).toBe(
      "2026-01-02",
    );
    expect(resolveAppointmentTime("2026-01-02T10:00")).toBe(
      "2026-01-02T10:00:00+01:00",
    );
  });
  it("rejects nonexistent clock-gap times and requires a choice for repeated times", () => {
    expect(() => resolveAppointmentTime("2025-04-06T02:30")).toThrow(
      /n’existe pas/,
    );
    expect(() => resolveAppointmentTime("2025-02-23T02:30")).toThrow(/répète/);
    expect(resolveAppointmentTime("2025-02-23T02:30", "+01:00")).toBe(
      "2025-02-23T02:30:00+01:00",
    );
    expect(resolveAppointmentTime("2025-02-23T02:30", "+00:00")).toBe(
      "2025-02-23T02:30:00+00:00",
    );
  });
  it("retains the original offset when editing an ambiguous stored slot", () => {
    for (const offset of ["+00:00", "+01:00"]) {
      const instant = `2025-02-23T02:30:00${offset}`;
      expect(localAppointmentInput(instant)).toBe("2025-02-23T02:30");
      expect(localAppointmentOffset(instant)).toBe(offset);
    }
  });
  it("rejects impossible dates, time values and an incorrect explicit offset", () => {
    for (const value of [
      "2025-02-30T10:00",
      "2026-01-02T24:00",
      "2026-01-02T10:99",
      "",
    ])
      expect(() => resolveAppointmentTime(value)).toThrow();
    expect(() => resolveAppointmentTime("2026-01-02T10:00", "+00:00")).toThrow(
      /décalage/,
    );
  });
});
