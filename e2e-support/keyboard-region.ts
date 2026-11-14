import { expect, type Page, type Locator } from "@playwright/test";
import { tabTo } from "./accessibility";

// Use native keyboard scrolling only; never set scrollLeft or force focus.
export async function exerciseScrollRegion(page: Page, region: Locator) {
  await tabTo(page, region);
  await expect(region).toBeFocused();
  await expect(region).toBeInViewport();
  const initial = await region.evaluate((element) => ({
    left: element.scrollLeft,
    maximum: element.scrollWidth - element.clientWidth,
  }));
  let scrolled = false;
  if (initial.maximum > 1) {
    const right = initial.left < initial.maximum - 0.5;
    await page.keyboard.press(right ? "ArrowRight" : "ArrowLeft");
    if (right)
      await expect
        .poll(() => region.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(initial.left);
    else
      await expect
        .poll(() => region.evaluate((element) => element.scrollLeft))
        .toBeLessThan(initial.left);
    scrolled = true;
  }
  return {
    keyboard_region_focused: true,
    horizontal_scroll_needed: initial.maximum > 1,
    keyboard_region_scrolled: scrolled,
  };
}
