import { test, expect } from "@playwright/test";
import { contrastRatio, type RGB } from "../e2e-support/contrast-math";
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
    name: "Accéder à mon espace parent",
    exact: true,
  });
  await tabTo(page, enter);
  await expect(enter).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/login$/);
  const signup = page.getByRole("link", {
    name: "Créer un compte parent",
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

test("authentication keyboard focus contrasts with light and dark panels", async ({
  page,
}) => {
  const rgb = (value: string): RGB => {
    const match = value.match(/^rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)$/);
    if (!match)
      throw new Error("The targeted opaque sRGB focus colors were not proven.");
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  };
  for (const path of ["/login", "/signup"]) {
    await page.goto(path);
    const brand = page.locator(".auth-story .brand");
    const targets = [page.locator(".auth-main .back-link")];
    if (await brand.isVisible()) targets.unshift(brand);
    for (const target of targets) {
      await tabTo(page, target);
      await expect(target).toBeFocused();
      await expect(target).toBeInViewport();
      const colors = await target.evaluate((element) => {
        const surface = element.closest(".auth-story") ?? document.body;
        const focus = getComputedStyle(element),
          background = getComputedStyle(surface);
        return {
          outline: focus.outlineColor,
          background: background.backgroundColor,
          solid:
            focus.outlineStyle === "solid" &&
            parseFloat(focus.outlineWidth) >= 2 &&
            background.backgroundImage === "none" &&
            Number(background.opacity) === 1,
        };
      });
      expect(colors.solid).toBe(true);
      expect(
        contrastRatio(rgb(colors.outline), rgb(colors.background)),
      ).toBeGreaterThanOrEqual(3);
    }
  }
});
