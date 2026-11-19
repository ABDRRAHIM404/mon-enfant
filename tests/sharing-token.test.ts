import { describe, it, expect } from "vitest";
import { scanShareCode, shareToken } from "../src/lib/sharing/types";
const token = "aB0123456789_-".repeat(4).slice(0, 43);
const origin = "https://mon-enfant.vercel.app";
describe("temporary sharing scanner input", () => {
  it("accepts only a secret or the dedicated same-origin fragment", () => {
    expect(shareToken(token, origin)).toBe(token);
    expect(shareToken(` ${origin}/share#share=${token} `, origin)).toBe(token);
  });
  it("keeps a care invitation distinct from a parent share", () => {
    expect(scanShareCode(`${origin}/share#care=${token}`, origin)).toBe(
      `care:${token}`,
    );
    expect(scanShareCode(`care:${token}`, origin)).toBe(`care:${token}`);
    expect(scanShareCode(`${origin}/share#share=${token}`, origin)).toBe(token);
    expect(
      scanShareCode(`https://foreign.invalid/share#care=${token}`, origin),
    ).toBeNull();
    expect(
      scanShareCode(`${origin}/share#care=${token}&share=${token}`, origin),
    ).toBeNull();
    expect(shareToken(`${origin}/share#care=${token}`, origin)).toBeNull();
  });
  it.each([
    `${origin}/share?token=${token}`,
    `${origin}/share?tracking=1#share=${token}`,
    `https://foreign.invalid/share#share=${token}`,
    `${origin}/children/${token}`,
    `${origin}/share#share=${token}&share=${token}`,
    `${origin}/share#share=${token}&child=private`,
    `${origin}/share#share=short`,
    `javascript:alert(1)`,
    "",
    token + "a",
  ])("rejects arbitrary URLs and identification codes (%#)", (value) =>
    expect(shareToken(value, origin)).toBeNull(),
  );
});
