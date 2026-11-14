import { it, expect } from "vitest";
import { authDestination } from "../src/lib/auth-destination";
it("uses only fixed parent destinations and preserves the professional default", () => {
  expect(authDestination("parent")).toBe("/parent");
  expect(authDestination("parent-invitation")).toBe("/parent/invitation");
  for (const input of [
    undefined,
    null,
    "account",
    "https://example.invalid",
    "//example.invalid",
    "/admin",
    "/patients/private",
    "parent?role=admin",
  ])
    expect(authDestination(input)).toBe("/account");
});
