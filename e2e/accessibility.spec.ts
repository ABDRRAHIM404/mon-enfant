import { test, expect } from "@playwright/test";
import {
  scanAccessibility,
  assertAccessible,
  tabTo,
} from "../e2e-support/accessibility";

test("skip navigation reaches the visible primary page heading", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/missing-page",
  ]) {
    await page.goto(path);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", {
      name: "Aller au contenu principal",
      exact: true,
    });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  }
});

test("public pages and feedback have no automatic WCAG A/AA or best-practice violations", async ({
  page,
}, info) => {
  const proofs = [];
  for (const [path, screen] of [
    ["/", "home"],
    ["/login", "login"],
    ["/signup", "signup"],
    ["/forgot-password", "recovery"],
    ["/login?confirmation=invalid", "confirmation-error"],
    ["/login?password=updated", "password-updated"],
    ["/forgot-password?recovery=invalid", "recovery-error"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    proofs.push(await scanAccessibility(page, screen, info));
  }
  assertAccessible(proofs);
});

test("public authentication navigation is operable from the keyboard", async ({
  page,
}) => {
  await page.goto("/");
  const enter = page.getByRole("link", {
    name: "Accéder à mon espace",
    exact: true,
  });
  await tabTo(page, enter);
  await expect(enter).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/login$/);
  const signup = page.getByRole("link", {
    name: "Créer un compte",
    exact: true,
  });
  await tabTo(page, signup);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/signup$/);
  const login = page.getByRole("link", { name: "Se connecter", exact: true });
  await tabTo(page, login);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/login$/);
});
