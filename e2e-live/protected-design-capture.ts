import { expect, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
// Only synthetic fixture pages call this helper. Never capture account credentials or private token URLs.
export async function captureProtectedDesign(
  page: Page,
  route: string,
  screen: "parent" | "clinician" | "vaccination",
  info: TestInfo,
) {
  if (info.project.name === "tablet") return 0;
  const platform = info.project.name === "desktop" ? "web" : "mobile";
  const width = platform === "web" ? 1440 : 430,
    height = platform === "web" ? 900 : 940;
  await page.setViewportSize({ width, height });
  let count = 0;
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (value) => localStorage.setItem("mon-enfant-theme", value),
      theme,
    );
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByRole("main")).toBeVisible();
    await page
      .locator("img:visible")
      .evaluateAll((images) =>
        Promise.all(
          images.map((img) =>
            (img as HTMLImageElement).decode().catch(() => {}),
          ),
        ),
      );
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const actual = await page.screenshot({
      path: info.outputPath(
        `design-protected-${platform}-${theme}-${screen}.png`,
      ),
      scale: "css",
      animations: "disabled",
    });
    const reference = readFileSync(
      `updates/Mon_Enfant_Design_Update_3_Fresh_Copy/mockups/${platform}/${theme}/${screen}.png`,
    );
    const context = await page
      .context()
      .browser()!
      .newContext({
        viewport: { width: width * 2, height: height + 40 },
        deviceScaleFactor: 1,
      });
    try {
      const pair = await context.newPage();
      await pair.setContent(
        `<html><head><style>body{margin:0;background:white;font:14px Arial;color:black}main{display:flex}figure{margin:0;width:${width}px}figcaption{height:40px;display:flex;align-items:center;padding:0 15px}img{display:block;width:${width}px;height:${height}px}</style></head><body><main><figure><figcaption>Selected reference · ${platform} · ${theme}</figcaption><img src="data:image/png;base64,${reference.toString("base64")}"></figure><figure><figcaption>Actual · synthetic records · same viewport/theme</figcaption><img src="data:image/png;base64,${actual.toString("base64")}"></figure></main></body></html>`,
      );
      await pair
        .locator("img")
        .evaluateAll((images) =>
          Promise.all(images.map((img) => (img as HTMLImageElement).decode())),
        );
      await pair.screenshot({
        path: info.outputPath(
          `design-protected-pair-${platform}-${theme}-${screen}.png`,
        ),
        scale: "css",
      });
    } finally {
      await context.close();
    }
    count++;
  }
  return count;
}
