import {
  expect,
  type Page,
  type Locator,
  type TestInfo,
} from "@playwright/test";
import { writeFileSync } from "node:fs";
import { collectSolidTextSamples } from "./solid-text-colors";
import { contrastRatio, type RGB } from "./contrast-math";
import { tabTo } from "./accessibility";
import { exerciseScrollRegion } from "./keyboard-region";

export async function reviewQueueContrast(
  page: Page,
  link: Locator,
  info: TestInfo,
) {
  const samples = await collectSolidTextSamples(page, "reviewer-queue");
  for (const [tag, count] of [
    ["th", 5],
    ["td", 5],
    ["strong", 1],
    ["a", 1],
  ] as const)
    expect(samples.filter((sample) => sample.tag === tag).length).toBe(count);
  expect(samples.every((sample) => !sample.unsupported && sample.has_box)).toBe(
    true,
  );
  const measured = samples.map((sample) => {
    if (!sample.foreground || !sample.background)
      throw new Error("Opaque queue text colors were not proven.");
    const foreground: RGB = [
        sample.foreground[0],
        sample.foreground[1],
        sample.foreground[2],
      ],
      background: RGB = [
        sample.background[0],
        sample.background[1],
        sample.background[2],
      ];
    return {
      tag: sample.tag,
      foreground,
      background,
      ratio: contrastRatio(foreground, background),
    };
  });
  expect(measured.every((sample) => sample.ratio >= 4.5)).toBe(true);
  const region = page.getByRole("region", {
    name: "Demandes de vérification",
    exact: true,
  });
  const regionProof = await exerciseScrollRegion(page, region);
  const before = await link.evaluate((element) => {
    const container = element.closest(".table-scroll");
    if (!container) return null;
    const a = element.getBoundingClientRect(),
      b = container.getBoundingClientRect();
    return {
      clipped: a.left < b.left - 1 || a.right > b.right + 1,
      left: container.scrollLeft,
    };
  });
  await tabTo(page, link);
  await expect(link).toBeFocused();
  await expect(link).toBeInViewport({ ratio: 1 });
  const after = await link.evaluate((element) => {
    const container = element.closest(".table-scroll");
    if (!container) return null;
    const a = element.getBoundingClientRect(),
      b = container.getBoundingClientRect(),
      style = getComputedStyle(element);
    const match = style.outlineColor.match(
      /^rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)$/,
    );
    return {
      left: container.scrollLeft,
      fully_visible: a.left >= b.left - 1 && a.right <= b.right + 1,
      focus_visible:
        style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2,
      outline_rgb: match
        ? [Number(match[1]), Number(match[2]), Number(match[3])]
        : null,
    };
  });
  expect(
    before !== null &&
      after !== null &&
      after.fully_visible &&
      after.focus_visible &&
      (!before.clipped || Math.abs(after.left - before.left) > 0.5),
  ).toBe(true);
  if (!after?.outline_rgb) throw new Error("Queue focus color was not proven.");
  const colors = measured.find((sample) => sample.tag === "a");
  if (!colors) throw new Error("Queue history-link background was not proven.");
  const focusRatio = contrastRatio(
    [after.outline_rgb[0], after.outline_rgb[1], after.outline_rgb[2]],
    colors.background,
  );
  expect(focusRatio).toBeGreaterThanOrEqual(3);
  const proof = {
    screen: "reviewer-synthetic-queue",
    text_samples: measured.length,
    minimum_ratio: Math.min(...measured.map((sample) => sample.ratio)),
    colors: [
      ...new Map(
        measured.map((sample) => [JSON.stringify(sample), sample]),
      ).values(),
    ],
    focus_contrast_ratio: focusRatio,
    ...regionProof,
    keyboard_review_link_visible: true,
    axe_incomplete_results_retained: true,
    scope: "opaque-solid-srgb-reviewer-queue-only",
  };
  writeFileSync(
    info.outputPath("contrast-reviewer-queue.json"),
    JSON.stringify(proof),
  );
  console.log(
    JSON.stringify({
      event: "reviewer_queue_contrast_review",
      viewport: info.project.name,
      ...proof,
    }),
  );
}
