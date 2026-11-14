import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  type Page,
  type TestInfo,
  type Locator,
} from "@playwright/test";
import { writeFileSync } from "node:fs";

const tags = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];
let sequence = 0;
const safeClasses = new Set([
  "muted",
  "fine",
  "eyebrow",
  "light",
  "story-footer",
  "story-feature",
  "form-error",
  "notice",
  "back-link",
  "status",
  "button",
  "primary",
  "secondary",
  "text-link",
  "hero-note",
  "auth-bottom",
  "brand-sub",
]);
export type AccessibilityProof = {
  screen: string;
  engine: string;
  violations: {
    rule: string;
    impact: string | null;
    elements: {
      tag: string;
      classes: string[];
      colors: {
        foreground: string | null;
        background: string | null;
        ratio: number | null;
      }[];
    }[];
  }[];
  incomplete: {
    rule: string;
    nodes: number;
    elements: { tag: string; classes: string[] }[];
  }[];
};

export async function scanAccessibility(
  page: Page,
  screen: string,
  info: TestInfo,
): Promise<AccessibilityProof> {
  if (!/^[a-z0-9-]{1,70}$/.test(screen))
    throw new Error("A fixed accessibility screen label is required.");
  let results;
  try {
    await page.evaluate(() => document.fonts.ready);
    results = await new AxeBuilder({ page }).withTags(tags).analyze();
  } catch {
    throw new Error(
      "Accessibility scan failed; page state and request details withheld.",
    );
  }
  const color = (value: unknown) =>
    typeof value === "string" && /^#[a-f0-9]{3,8}$/i.test(value) ? value : null;
  const proof: AccessibilityProof = {
    screen,
    engine: results.testEngine.version,
    violations: results.violations.map((violation) => ({
      rule: violation.id,
      impact: violation.impact ?? null,
      elements: violation.nodes.map((node) => ({
        tag: node.html.match(/^<([a-z0-9-]+)/i)?.[1] ?? "element",
        classes: (node.html.match(/\bclass="([^"]*)"/)?.[1] ?? "")
          .split(/\s+/)
          .filter((value) => safeClasses.has(value)),
        colors: node.any
          .filter((check) => check.id === "color-contrast")
          .map((check) => ({
            foreground: color(check.data?.fgColor),
            background: color(check.data?.bgColor),
            ratio:
              typeof check.data?.contrastRatio === "number"
                ? check.data.contrastRatio
                : null,
          })),
      })),
    })),
    incomplete: results.incomplete.map((result) => ({
      rule: result.id,
      nodes: result.nodes.length,
      elements: result.nodes.map((node) => ({
        tag: node.html.match(/^<([a-z0-9-]+)/i)?.[1] ?? "element",
        classes: (node.html.match(/\bclass="([^"]*)"/)?.[1] ?? "")
          .split(/\s+/)
          .filter((value) => safeClasses.has(value)),
      })),
    })),
  };
  // Raw results contain DOM/HTML, selectors and potentially entered values.
  // Persist only this explicit structural/count/color projection.
  writeFileSync(
    info.outputPath(`a11y-${screen}-${++sequence}.json`),
    JSON.stringify(proof),
  );
  console.log(
    JSON.stringify({
      event: "accessibility_scan",
      viewport: info.project.name,
      ...proof,
    }),
  );
  return proof;
}

export function assertAccessible(proofs: AccessibilityProof[]) {
  expect(proofs.length > 0).toBe(true);
  const failures = proofs.flatMap((proof) =>
    proof.violations.map((violation) => `${proof.screen}:${violation.rule}`),
  );
  expect(
    failures,
    "Automatically detectable accessibility violations; see classified scan reports.",
  ).toEqual([]);
}

export async function tabTo(page: Page, target: Locator, maximum = 60) {
  for (let step = 0; step < maximum; step++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => document.activeElement === element))
      return;
  }
  throw new Error(
    "The expected control was not reachable through the bounded keyboard tab order.",
  );
}
