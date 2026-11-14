import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import {
  scanAccessibility,
  assertAccessible,
  tabTo,
} from "../e2e-support/accessibility";
import { observeBrowserErrors } from "./browser-errors";

test("approved workspace supports accessible pages and keyboard-only account and practice actions", async ({
  page,
}, info) => {
  const email = process.env.MON_ENFANT_CLINICAL_BROWSER_A_EMAIL;
  const password = process.env.MON_ENFANT_CLINICAL_BROWSER_A_PASSWORD;
  if (!email || !password)
    throw new Error(
      "Dedicated fictional accessibility credentials are missing.",
    );
  const proofs = [];
  let errors = 0;
  observeBrowserErrors(page, "accessibility-fixture", () => errors++);
  for (const [path, screen] of [
    ["/", "home"],
    ["/login", "login"],
    ["/signup", "signup"],
    ["/forgot-password", "recovery"],
    ["/login?confirmation=invalid", "confirmation-error"],
    ["/forgot-password?recovery=invalid", "recovery-error"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    proofs.push(await scanAccessibility(page, screen, info));
  }
  await page.goto("/login");
  await tabTo(page, page.locator('input[name="email"]'));
  await page.keyboard.type(email);
  await page.keyboard.press("Tab");
  await expect(page.locator('input[name="password"]')).toBeFocused();
  await page.keyboard.type(password);
  await tabTo(
    page,
    page.getByRole("button", { name: "Se connecter", exact: true }),
  );
  await expect
    .poll(
      async () => (await page.locator('[name="email"]').inputValue()) === email,
    )
    .toBe(true);
  await expect
    .poll(
      async () =>
        (await page.locator('[name="password"]').inputValue()) === password,
    )
    .toBe(true);
  expect(
    await page
      .locator("form.auth-form")
      .evaluate((form) => (form as HTMLFormElement).checkValidity()),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Se connecter", exact: true }),
  ).toBeFocused();
  let releaseLogin = () => {};
  let requestHeld = false;
  const loginGate = new Promise<void>((resolve) => {
    releaseLogin = resolve;
  });
  await page.route(
    (url) => url.pathname === "/login",
    async (route) => {
      if (route.request().method() === "POST") {
        requestHeld = true;
        await loginGate;
      }
      await route.continue();
    },
  );
  try {
    await page.keyboard.press("Enter");
    await expect.poll(() => requestHeld).toBe(true);
    await expect(page.locator("form.auth-form")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(page.locator('button[type="submit"]')).toHaveAccessibleName(
      "Connexion en cours…",
    );
    proofs.push(await scanAccessibility(page, "login-pending", info));
  } finally {
    releaseLogin();
  }
  await expect(page).toHaveURL(/\/account$/);
  await page.unrouteAll({ behavior: "wait" });
  proofs.push(await scanAccessibility(page, "account", info));
  await tabTo(
    page,
    page.getByRole("link", { name: "Ouvrir mon espace", exact: true }),
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/dashboard");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", {
    name: "Aller au contenu principal",
    exact: true,
  });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();

  await page.goto("/practices");
  await tabTo(page, page.getByLabel("Nom du lieu d’exercice", { exact: true }));
  const name = `Centre fictif accessibilité ${info.project.name}`;
  await page.keyboard.type(name);
  await tabTo(page, page.getByLabel("Ville", { exact: true }));
  await page.keyboard.type("Rabat fictif");
  await tabTo(
    page,
    page.getByRole("button", { name: "Déclarer ce lieu", exact: true }),
  );
  await page.keyboard.press("Enter");
  await expect(page.locator("li").filter({ hasText: name })).toBeVisible();

  for (const [path, screen] of [
    ["/dashboard", "dashboard"],
    ["/patients", "patient-list"],
    ["/patients/new", "registration-form"],
    ["/patients/link", "link-request-form"],
    ["/practices", "practices"],
    ["/access-requests", "access-requests"],
    ["/appointments", "appointments"],
    ["/follow-up", "follow-up"],
    ["/account/clinical-permissions", "clinical-permissions"],
    ["/vaccines", "catalog-list"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    proofs.push(await scanAccessibility(page, screen, info));
  }
  await page.goto("/account");
  const logout = page.getByRole("button", {
    name: "Se déconnecter",
    exact: true,
  });
  await tabTo(page, logout);
  expect(
    await logout.evaluate((element) => {
      const style = getComputedStyle(element);
      return (
        style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2
      );
    }),
  ).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toBe(0);
  writeFileSync(
    info.outputPath("accessibility-proof.json"),
    JSON.stringify({
      viewport: info.project.name,
      screens: proofs.length,
      keyboard_login: true,
      pending_login_named: true,
      keyboard_practice_creation: true,
      keyboard_logout: true,
      protected_navigation_denied: true,
      page_errors: errors,
      automatic_violations: proofs.reduce(
        (count, proof) => count + proof.violations.length,
        0,
      ),
      manual_review_required: true,
      incomplete_results_present: proofs.some(
        (proof) => proof.incomplete.length > 0,
      ),
    }),
  );
  assertAccessible(proofs);
});
