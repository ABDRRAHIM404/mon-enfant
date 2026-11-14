import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
const SITE =
  process.env.MON_ENFANT_LIVE_PROBE === "updates-cloud-accept"
    ? "https://localhost:3443"
    : "https://mon-enfant.vercel.app";
const root = "updates/Mon_Enfant_Design_Update_3_Fresh_Copy/mockups";
test("capture configured public screens and paired selected references", async ({
  page,
  browser,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "One exact-density visual set; functional story still runs on all three devices.",
  );
  const proof = {
    source_runtime: SITE.startsWith("https://localhost")
      ? "github-cloud-production"
      : "canonical-vercel",
    screens: 0,
    comparisons: 0,
    page_errors: 0,
  };
  page.on("pageerror", () => proof.page_errors++);
  for (const platform of ["web", "mobile"]) {
    const width = platform === "web" ? 1440 : 430,
      height = platform === "web" ? 900 : 940;
    await page.setViewportSize({ width, height });
    for (const theme of ["light", "dark"]) {
      await page.addInitScript(
        (t) => localStorage.setItem("mon-enfant-theme", t),
        theme,
      );
      for (const [route, screen] of [
        ["/", "landing"],
        ["/login", "login"],
        ["/login?audience=clinician", "clinician_login"],
        ["/signup?audience=clinician", "clinician_register"],
      ]) {
        await page.goto(SITE + route);
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
          path: info.outputPath(`design-${platform}-${theme}-${screen}.png`),
          scale: "css",
          animations: "disabled",
        });
        proof.screens++;
        const reference = readFileSync(
          `${root}/${platform}/${theme}/${screen}.png`,
        );
        const context = await browser.newContext({
          viewport: { width: width * 2, height: height + 40 },
          deviceScaleFactor: 1,
        });
        const pair = await context.newPage();
        await pair.setContent(
          `<html><head><style>body{margin:0;background:#fff;font:14px Arial;color:#000}main{display:flex}figure{margin:0;width:${width}px}figcaption{height:40px;display:flex;align-items:center;padding:0 15px}img{display:block;width:${width}px;height:${height}px}</style></head><body><main><figure><figcaption>Selected reference · ${platform} · ${theme}</figcaption><img src="data:image/png;base64,${reference.toString("base64")}"/></figure><figure><figcaption>Actual application · same viewport and theme</figcaption><img src="data:image/png;base64,${actual.toString("base64")}"/></figure></main></body></html>`,
        );
        await pair
          .locator("img")
          .evaluateAll((images) =>
            Promise.all(
              images.map((img) => (img as HTMLImageElement).decode()),
            ),
          );
        await pair.screenshot({
          path: info.outputPath(
            `design-pair-${platform}-${theme}-${screen}.png`,
          ),
          scale: "css",
        });
        await context.close();
        proof.comparisons++;
      }
    }
  }
  expect(proof.page_errors).toBe(0);
  writeFileSync(
    info.outputPath("design-proof.json"),
    JSON.stringify(proof, null, 2),
  );
});
