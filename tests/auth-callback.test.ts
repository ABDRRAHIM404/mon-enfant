import { it, expect } from "vitest";
import { callbackFailurePath } from "../src/lib/auth-callback";
it("returns password recovery failures to the self-service request page", () => {
  expect(callbackFailurePath(true)).toBe("/forgot-password?recovery=invalid");
  expect(callbackFailurePath(true, "otp_expired")).toBe(
    "/forgot-password?recovery=invalid",
  );
});
it("distinguishes missing/mismatched browser proof without exposing provider messages", () => {
  for (const code of ["pkce_code_verifier_not_found", "bad_code_verifier"])
    expect(callbackFailurePath(true, code)).toBe(
      "/forgot-password?recovery=browser",
    );
  expect(callbackFailurePath(true, "untrusted arbitrary text")).toBe(
    "/forgot-password?recovery=invalid",
  );
});
it("retains signup feedback and only fixed internal redirect destinations", () => {
  expect(callbackFailurePath(false, "pkce_code_verifier_not_found")).toBe(
    "/login?confirmation=invalid",
  );
  expect(callbackFailurePath(true, "https://attacker.invalid")).toBe(
    "/forgot-password?recovery=invalid",
  );
});

import { emailSendingLimited } from "../src/lib/auth-email";
it("shows non-enumerating sending-limit feedback only for explicit throttle signals", () => {
  expect(emailSendingLimited(null)).toBe(false);
  expect(emailSendingLimited({ status: 429 })).toBe(true);
  expect(emailSendingLimited({ code: "over_email_send_rate_limit" })).toBe(
    true,
  );
  expect(emailSendingLimited({ code: "over_request_rate_limit" })).toBe(true);
  expect(
    emailSendingLimited({ status: 400, code: "invalid_credentials" }),
  ).toBe(false);
});
