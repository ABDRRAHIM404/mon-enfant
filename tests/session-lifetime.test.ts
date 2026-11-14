import { it, expect } from "vitest";
import {
  authCookieLifetime,
  rememberedSeconds,
  rememberedPreference,
} from "../src/lib/supabase/cookie-lifetime";
it("session-only mode removes retention from all Auth chunks without touching security flags", () => {
  for (const name of [
    "sb-project-auth-token",
    "sb-project-auth-token.0",
    "sb-project-auth-token.1",
  ]) {
    const original = {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 400 * 86400,
      expires: new Date("2099-01-01"),
    };
    expect(authCookieLifetime(name, original, false)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    expect(original.maxAge).toBe(400 * 86400);
  }
});
it("remembered mode caps retention but never extends a shorter provider lifetime", () => {
  expect(
    authCookieLifetime(
      "sb-project-auth-token",
      { httpOnly: true, maxAge: 400 * 86400 },
      true,
    ),
  ).toEqual({ httpOnly: true, maxAge: rememberedSeconds });
  expect(
    authCookieLifetime("sb-project-auth-token", { maxAge: 120 }, true).maxAge,
  ).toBe(120);
});
it("PKCE verifiers, legacy preferences and expired/deletion cookies retain the provider contract", () => {
  const options = { maxAge: 400 * 86400 };
  expect(
    authCookieLifetime("sb-project-auth-token-code-verifier", options, false),
  ).toBe(options);
  expect(authCookieLifetime("sb-project-auth-token", options, undefined)).toBe(
    options,
  );
  for (const cookie of [{ maxAge: 0 }, { expires: new Date(0) }])
    expect(authCookieLifetime("sb-project-auth-token.1", cookie, false)).toBe(
      cookie,
    );
  expect(rememberedPreference("session")).toBe(false);
  expect(rememberedPreference("persistent")).toBe(true);
  expect(rememberedPreference("invalid")).toBeUndefined();
});
