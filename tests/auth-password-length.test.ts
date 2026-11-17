import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/supabase/config", () => ({
  supabaseConfig: () => ({ url: "configured", key: "public" }),
  sessionCookieOptions: () => ({}),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: sdk }),
}));
vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({ supabase: { auth: sdk } }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "https://mon-enfant.vercel.app" }),
  cookies: async () => ({ set: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("REDIRECT");
  },
}));
vi.mock("@/lib/operational-events", () => ({
  reportOperationalEvent: vi.fn(),
}));
import { signIn, signUp, changePassword } from "../src/app/auth/actions";
function form(password: string) {
  const f = new FormData();
  f.set("email", "fictional@example.invalid");
  f.set("password", password);
  f.set("confirmation", password);
  f.set("destination", "parent");
  return f;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://mon-enfant.vercel.app");
  sdk.signInWithPassword.mockResolvedValue({
    error: { code: "invalid_credentials" },
  });
  sdk.signUp.mockResolvedValue({ error: null });
  sdk.updateUser.mockResolvedValue({ error: null });
  sdk.signOut.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe("eight-character password boundary in actual auth actions", () => {
  it.each([7, 129])(
    "rejects %i characters before sign-in and signup SDK calls",
    async (length) => {
      await expect(signIn({}, form("x".repeat(length)))).resolves.toMatchObject(
        { error: expect.stringContaining("8 à 128") },
      );
      await expect(signUp({}, form("x".repeat(length)))).resolves.toMatchObject(
        { error: expect.stringContaining("8 à 128") },
      );
      expect(sdk.signInWithPassword).not.toHaveBeenCalled();
      expect(sdk.signUp).not.toHaveBeenCalled();
    },
  );
  it.each([8, 12, 128])(
    "accepts %i characters for sign-in and signup validation",
    async (length) => {
      const value = "x".repeat(length);
      await signIn({}, form(value));
      await signUp({}, form(value));
      expect(sdk.signInWithPassword).toHaveBeenCalledWith({
        email: "fictional@example.invalid",
        password: value,
      });
      expect(sdk.signUp).toHaveBeenCalledWith(
        expect.objectContaining({ password: value }),
      );
    },
  );
  it("accepts eight matching reset characters and preserves global signout", async () => {
    await expect(changePassword({}, form("Abcdef1!"))).rejects.toThrow(
      "REDIRECT",
    );
    expect(sdk.updateUser).toHaveBeenCalledWith({ password: "Abcdef1!" });
    expect(sdk.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
  it("rejects short or mismatched reset passwords without changing the credential", async () => {
    await changePassword({}, form("Abcde1!"));
    const mismatch = form("Abcdef1!");
    mismatch.set("confirmation", "different");
    await changePassword({}, mismatch);
    expect(sdk.updateUser).not.toHaveBeenCalled();
  });
});
