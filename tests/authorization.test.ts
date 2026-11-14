import { describe, expect, it } from "vitest";
import {
  canAccessClinicalWorkspace,
  verificationStates,
  type Professional,
} from "../src/lib/authorization";
describe("professional authorization", () => {
  it("denies missing profiles", () =>
    expect(canAccessClinicalWorkspace(null)).toBe(false));
  for (const verification_status of verificationStates) {
    it(`checks the ${verification_status} state`, () => {
      const profile: Professional = {
        user_id: "a",
        role: "doctor",
        professional_id: "PRO-001",
        verification_status,
      };
      expect(canAccessClinicalWorkspace(profile)).toBe(
        verification_status === "approved",
      );
    });
  }
  it("allows verified nurses under the same workspace conditions", () => {
    expect(
      canAccessClinicalWorkspace({
        user_id: "n",
        role: "nurse",
        verification_status: "approved",
        professional_id: "N-001",
      }),
    ).toBe(true);
    expect(
      canAccessClinicalWorkspace({
        user_id: "n",
        role: "nurse",
        verification_status: "unverified",
        professional_id: null,
      }),
    ).toBe(false);
  });
  it("does not give administrators clinical access", () => {
    expect(
      canAccessClinicalWorkspace({
        user_id: "a",
        role: "admin",
        professional_id: "ADMIN-001",
        verification_status: "approved",
      }),
    ).toBe(false);
  });
  it("requires an assigned professional ID", () => {
    expect(
      canAccessClinicalWorkspace({
        user_id: "a",
        role: "doctor",
        professional_id: null,
        verification_status: "approved",
      }),
    ).toBe(false);
  });
});
