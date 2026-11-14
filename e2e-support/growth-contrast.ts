import { expect, type Page, type TestInfo } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { contrastRatio, type RGB } from "./contrast-math";
import { tabTo } from "./accessibility";
import { exerciseScrollRegion } from "./keyboard-region";
import { collectSolidTextSamples } from "./solid-text-colors";

export async function reviewGrowthContrast(
  page: Page,
  screen: "growth-chart" | "corrected-growth-chart" | "withdrawn-growth-chart",
  info: TestInfo,
) {
  const samples = await collectSolidTextSamples(page, "growth");
  expect(samples.length > 0).toBe(true);
  expect(samples.filter((sample) => sample.tag === "text").length).toBe(
    screen === "withdrawn-growth-chart" ? 0 : 8,
  );
  expect(samples.filter((sample) => sample.tag !== "text").length).toBe(13);
  expect(samples.every((sample) => !sample.unsupported && sample.has_box)).toBe(
    true,
  );
  const measured = samples.map((sample) => {
    if (!sample.foreground || !sample.background)
      throw new Error("Opaque solid text colors were not proven.");
    const foreground: RGB = [
      sample.foreground[0],
      sample.foreground[1],
      sample.foreground[2],
    ];
    const background: RGB = [
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

  const regionProof = await exerciseScrollRegion(
    page,
    page.getByRole("region", {
      name: "Valeurs et provenance des mesures",
      exact: true,
    }),
  );
  const history = page.locator(".table-scroll a");
  const before = await history.evaluate((element) => {
    const scroller = element.closest(".table-scroll") as HTMLElement | null;
    if (!scroller) return null;
    const link = element.getBoundingClientRect(),
      box = scroller.getBoundingClientRect();
    return {
      link_clipped: link.left < box.left - 1 || link.right > box.right + 1,
      container_overflow: scroller.scrollWidth > scroller.clientWidth + 1,
      scroll_left: scroller.scrollLeft,
    };
  });
  expect(before !== null).toBe(true);
  await tabTo(page, history);
  await expect(history).toBeFocused();
  await expect(history).toBeInViewport({ ratio: 1 });
  const keyboard = await history.evaluate((element) => {
    const scroller = element.closest(".table-scroll") as HTMLElement | null;
    if (!scroller) return null;
    const link = element.getBoundingClientRect(),
      box = scroller.getBoundingClientRect();
    const style = getComputedStyle(element);
    const outline = style.outlineColor.match(
      /^rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)$/,
    );
    return {
      outline_rgb: outline
        ? [Number(outline[1]), Number(outline[2]), Number(outline[3])]
        : null,
      container_overflow: scroller.scrollWidth > scroller.clientWidth + 1,
      scroll_advanced: scroller.scrollLeft > 0,
      link_within_scroller:
        link.left >= box.left - 1 && link.right <= box.right + 1,
      focus_visible:
        style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2,
    };
  });
  console.log(
    JSON.stringify({
      event: "growth_keyboard_geometry",
      viewport: info.project.name,
      screen,
      before,
      after: keyboard,
    }),
  );
  expect(
    before !== null &&
      keyboard !== null &&
      keyboard.link_within_scroller &&
      keyboard.focus_visible &&
      (!before.link_clipped || keyboard.scroll_advanced),
  ).toBe(true);
  if (!keyboard?.outline_rgb)
    throw new Error("The rendered keyboard focus color was not proven.");
  const outline: RGB = [
    keyboard.outline_rgb[0],
    keyboard.outline_rgb[1],
    keyboard.outline_rgb[2],
  ];
  const linkColors = measured.find((sample) => sample.tag === "a");
  if (!linkColors)
    throw new Error("The history-link background was not proven.");
  const focusRatio = contrastRatio(outline, linkColors.background);
  expect(focusRatio).toBeGreaterThanOrEqual(3);
  const report = {
    screen,
    text_samples: measured.length,
    minimum_ratio: Math.min(...measured.map((sample) => sample.ratio)),
    colors: [
      ...new Map(
        measured.map((sample) => [JSON.stringify(sample), sample]),
      ).values(),
    ],
    focus_contrast_ratio: focusRatio,
    ...regionProof,
    keyboard_history_visible: true,
    horizontal_scroll_required: before?.link_clipped ?? null,
    initial_geometry: before,
    ...keyboard,
    scope: "opaque-solid-srgb-growth-text-and-table-only",
    axe_incomplete_results_retained: true,
  };
  writeFileSync(
    info.outputPath(`contrast-${screen}.json`),
    JSON.stringify(report),
  );
  console.log(
    JSON.stringify({
      event: "growth_contrast_review",
      viewport: info.project.name,
      ...report,
    }),
  );
}
