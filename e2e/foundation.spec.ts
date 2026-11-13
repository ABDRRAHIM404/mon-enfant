import { test, expect } from "@playwright/test";
test("landing, auth navigation, and explicit unconfigured state", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Grandir en confiance/ }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true });
  await page.getByRole("link", { name: /Accéder à mon espace/ }).click();
  await expect(
    page.getByRole("heading", { name: "Heureux de vous retrouver." }),
  ).toBeVisible();
  await expect(page.getByText("Configuration en cours")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Se connecter" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Créer un compte" }).click();
  await expect(
    page.getByRole("heading", { name: "Votre espace commence ici." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Créer mon compte" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("protected routes fail closed without Supabase", async ({ page }) => {
  for (const path of ["/dashboard", "/account"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Heureux de vous retrouver." }),
    ).toBeVisible();
  }
});
test("invalid confirmation tokens return to login with feedback", async ({
  page,
}) => {
  await page.goto("/auth/confirm?token_hash=invalid&type=signup");
  await expect(page).toHaveURL(/confirmation=invalid/);
  await expect(page.getByRole("alert")).toContainText("invalide ou a expiré");
});
