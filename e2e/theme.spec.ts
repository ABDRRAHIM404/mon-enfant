import { test, expect } from "@playwright/test";
import {
  scanAccessibility,
  assertAccessible,
} from "../e2e-support/accessibility";
test("system appearance and manual preference survive navigation and reload", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: /Thème système/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: /Thème clair/ }).click();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: /Thème sombre/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
test("both themes preserve public accessibility and discoverable clinician entry", async ({
  page,
}, info) => {
  const proofs = [];
  await page.goto("/");
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (t) => localStorage.setItem("mon-enfant-theme", t),
      theme,
    );
    for (const path of [
      "/",
      "/login",
      "/signup?audience=clinician",
      "/forgot-password",
    ]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      proofs.push(
        await scanAccessibility(
          page,
          `theme-${theme}-${path.replace(/[^a-z]/g, "") || "home"}`,
          info,
        ),
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
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
