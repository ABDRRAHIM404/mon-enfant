import { it, expect } from "vitest";
import { authDestination } from "../src/lib/auth-destination";
it("uses only fixed parent destinations and rejects arbitrary navigation", () => {
  expect(authDestination("account")).toBe("/account");
  expect(authDestination("parent")).toBe("/parent");
  expect(authDestination("parent-invitation")).toBe("/parent/invitation");
  for (const input of [
    undefined,
    null,
    "https://example.invalid",
    "//example.invalid",
    "/admin",
    "/patients/private",
    "parent?role=admin",
  ])
    expect(authDestination(input)).toBe("/parent");
});
