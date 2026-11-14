import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import jsQR from "jsqr";
import { QrCode } from "../src/components/qr/code";
import { clinicianLookupUrl } from "../src/lib/qr/symbol";
async function decode(value: string) {
  const svg = renderToStaticMarkup(
    createElement(QrCode, { value, label: "QR de test entièrement fictif" }),
  );
  const image = svg.slice(svg.indexOf("<svg"), svg.indexOf("</svg>") + 6);
  const { data, info } = await sharp(Buffer.from(image))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  expect(result).not.toBeNull();
  return result!.data;
}
describe("actual QR rendering and distinct payloads", () => {
  it("independently decodes the rendered personal invitation with its fragment intact", async () => {
    const value =
      "https://mon-enfant.vercel.app/parent/invitation#invite=" +
      "a".repeat(43);
    expect(await decode(value)).toBe(value);
  });
  it("decodes a clinician identifier URL with no clinical payload or guardian secret", async () => {
    const id = "11111111-2222-4333-8444-555555555555";
    const value = clinicianLookupUrl(
      "https://mon-enfant.vercel.app/ignored?discard=1",
      id,
    );
    expect(await decode(value)).toBe(
      `https://mon-enfant.vercel.app/patients/lookup/${id}`,
    );
    expect(new URL(value).hash).toBe("");
    expect(new URL(value).search).toBe("");
    expect(() =>
      clinicianLookupUrl("https://mon-enfant.vercel.app", "name-of-a-child"),
    ).toThrow();
    expect(() => clinicianLookupUrl("javascript:alert(1)", id)).toThrow();
  });
});
