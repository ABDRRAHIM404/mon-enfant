import { test, expect } from "@playwright/test";
import {
  scanAccessibility,
  assertAccessible,
} from "../e2e-support/accessibility";
test("light appearance ignores old dark preference and device appearance", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("mon-enfant-theme", "dark"));
  for (const path of ["/", "/login", "/forgot-password"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: /Thème/ })).toHaveCount(0);
    expect(
      await page
        .locator("html")
        .evaluate((el) => getComputedStyle(el).colorScheme),
    ).toBe("light");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  }
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
test("light appearance preserves public accessibility and clinician entry", async ({
  page,
}, info) => {
  const proofs = [];
  await page.emulateMedia({ colorScheme: "dark" });
  for (const path of [
    "/",
    "/login",
    "/signup?audience=clinician",
    "/forgot-password",
  ]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    proofs.push(
      await scanAccessibility(
        page,
        `light-${path.replace(/[^a-z]/g, "") || "home"}`,
        info,
      ),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  assertAccessible(proofs);
});
test("small-screen menu exposes both account journeys", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 940 });
  await page.goto("/login");
  await page.getByLabel("Ouvrir le menu", { exact: true }).click();
  const menu = page.getByRole("navigation", { name: "Menu mobile" });
  await expect(
    menu.getByRole("link", { name: "Espace parent", exact: true }),
  ).toBeVisible();
  await menu
    .getByRole("link", { name: "Espace soignant", exact: true })
    .click();
  await expect(page).toHaveURL(/audience=clinician/);
  await expect(page.getByRole("main")).toContainText(
    "médecin / infirmier(ère)",
  );
});

test("mobile parent shortcuts retain guarded destinations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 430, height: 940 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Accès rapides parent" });
  await expect(nav).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Accueil", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    nav.getByRole("link", { name: "Rendez-vous", exact: true }),
  ).toHaveAttribute("href", "/parent?view=appointments");
  await expect(
    nav.getByRole("link", { name: "Documents", exact: true }),
  ).toHaveAttribute("href", "/parent?view=documents");
  await nav.getByRole("link", { name: "Enfants", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Se connecter" }),
  ).toBeVisible();
});
