import { describe, expect, it } from "vitest";
import { contrastRatio } from "../e2e-support/contrast-math";

describe("WCAG sRGB reference contrast", () => {
  it("gives 21 for black and white in either direction", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBe(21);
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBe(21);
  });
  it("gives 1 for equal colors", () => {
    expect(contrastRatio([18, 107, 92], [18, 107, 92])).toBe(1);
  });
  it("does not round a failing near-threshold gray into a pass", () => {
    expect(contrastRatio([118, 118, 118], [255, 255, 255])).toBeGreaterThan(
      4.5,
    );
    const failing = contrastRatio([119, 119, 119], [255, 255, 255]);
    expect(failing).toBeLessThan(4.5);
    expect(Number(failing.toFixed(1))).toBe(4.5);
  });
  it("rejects invalid channels instead of silently treating them as black", () => {
    for (const invalid of [-1, 256, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => contrastRatio([invalid, 0, 0], [255, 255, 255])).toThrow();
  });
});
