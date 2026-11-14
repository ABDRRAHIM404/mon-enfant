import { test, expect } from "@playwright/test";
import { observeBrowserErrors } from "./browser-errors";

test("inspect existing fictional clinical screens without clinical mutations", async ({
  page,
}) => {
  let errors = 0;
  observeBrowserErrors(page, "A", () => errors++);
  const email = process.env.MON_ENFANT_CLINICAL_BROWSER_A_EMAIL;
  const password = process.env.MON_ENFANT_CLINICAL_BROWSER_A_PASSWORD;
  if (!email || !password)
    throw new Error("Dedicated clinical diagnostic credentials missing.");
  await page.goto("/login?audience=clinician");
  await page.locator('[name="email"]').fill(email);
  await page.locator('[name="password"]').fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/(account|dashboard|provisional)$/);
  await page.goto("/patients");
  const childPath = await page
    .locator('a[href^="/patients/"]')
    .filter({ hasText: "Enfant fictif" })
    .first()
    .getAttribute("href");
  if (!childPath || !/^\/patients\/[a-f0-9-]{36}$/i.test(childPath))
    throw new Error("No existing synthetic clinical record found.");
  for (const suffix of [
    "",
    "/records",
    "/growth",
    "/appointments",
    "/summary",
    "/records/new?kind=consultation",
    "/appointments/new",
  ]) {
    await page.goto(childPath + suffix);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    console.log(
      JSON.stringify({
        event: "diagnostic_screen_rendered",
        screen: suffix || "profile",
        browser_errors: errors,
      }),
    );
    expect(errors).toBe(0);
    if (suffix === "/records") {
      await page
        .getByRole("link", { name: "Historique et correction" })
        .first()
        .click();
      await expect(
        page.getByRole("heading", { name: "Historique de la saisie" }),
      ).toBeVisible();
      expect(errors).toBe(0);
    }
    if (suffix === "/appointments") {
      const link = page
        .locator('a[href^="' + childPath + '/appointments/"]')
        .filter({ hasText: /Historique/ })
        .first();
      if (await link.count()) {
        await link.click();
        await expect(
          page.getByRole("heading", { name: "Historique du rendez-vous" }),
        ).toBeVisible();
        expect(errors).toBe(0);
      }
    }
  }
});
