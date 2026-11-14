import { test, expect } from "@playwright/test";
test("landing, auth navigation, and explicit unconfigured state", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Le carnet de santé de votre enfant/ }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("home.png"),
    fullPage: true,
  });
  await expect(
    page.getByRole("link", { name: "Espace soignant", exact: true }).first(),
  ).toHaveAttribute("href", "/login?audience=clinician");
  await page.getByRole("link", { name: /Accéder à mon espace/ }).click();
  await expect(page.getByText("ESPACE PARENT", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Se connecter" }),
  ).toBeVisible();
  await expect(page.getByText("Configuration en cours")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Se connecter" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Créer un compte parent" }).click();
  await expect(
    page.getByRole("heading", { name: "Créer mon compte" }),
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
  for (const path of [
    "/provisional",
    "/provisional/00000000-0000-4000-8000-000000000000",
    "/parent/account",
    "/appointments",
    "/follow-up",
    "/patients/00000000-0000-4000-8000-000000000000/appointments",
    "/patients/00000000-0000-4000-8000-000000000000/appointments/new",
    "/patients/00000000-0000-4000-8000-000000000000/appointments/00000000-0000-4000-8000-000000000000",
    "/vaccines",
    "/vaccines/00000000-0000-4000-8000-000000000000",
    "/account/clinical-permissions",
    "/admin/clinical-permissions",
    "/patients/00000000-0000-4000-8000-000000000000/records",
    "/patients/00000000-0000-4000-8000-000000000000/records/new?kind=growth",
    "/patients/00000000-0000-4000-8000-000000000000/growth",
    "/patients/00000000-0000-4000-8000-000000000000/vaccinations",
    "/patients/00000000-0000-4000-8000-000000000000/vaccinations/00000000-0000-4000-8000-000000000000",
    "/patients/00000000-0000-4000-8000-000000000000/records/new?kind=vaccination",
    "/patients/00000000-0000-4000-8000-000000000000/summary",
    "/patients/00000000-0000-4000-8000-000000000000/export",
    "/patients",
    "/patients/new",
    "/patients/link",
    "/patients/00000000-0000-4000-8000-000000000000",
    "/practices",
    "/access-requests",
    "/dashboard",
    "/account",
    "/verification",
    "/admin",
    "/auth/reset-password",
    "/admin/verifications",
    "/admin/professionals",
    "/admin/evidence/00000000-0000-4000-8000-000000000000",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Se connecter" }),
    ).toBeVisible();
  }
});
test("invalid confirmation tokens return to login with feedback", async ({
  page,
}) => {
  await page.goto("/auth/confirm?token_hash=invalid&type=signup");
  await expect(page).toHaveURL(/confirmation=invalid/);
  await expect(
    page.getByRole("alert").filter({ hasText: "Le lien de confirmation" }),
  ).toContainText("invalide ou a expiré");
});

test("missing PKCE callback codes fail closed", async ({ page }) => {
  await page.goto("/auth/callback");
  await expect(page).toHaveURL(/confirmation=invalid/);
  await expect(
    page.getByRole("alert").filter({ hasText: "Le lien de confirmation" }),
  ).toContainText("invalide ou a expiré");
});

test("recovery setup state and invalid recovery tokens", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(
    page.getByRole("heading", { name: "Mot de passe oublié ?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Demander un lien de récupération" }),
  ).toBeDisabled();
  await page.goto("/auth/confirm?type=recovery&token_hash=invalid");
  await expect(page).toHaveURL(/recovery=invalid/);
  await expect(
    page.getByRole("alert").filter({ hasText: "Ce lien de récupération" }),
  ).toContainText("déjà utilisé ou expiré");
  await page.goto("/auth/callback?next=reset-password");
  await expect(page).toHaveURL(/recovery=invalid/);
  await page.goto("/auth/callback?next=https://attacker.invalid");
  await expect(page).toHaveURL(/confirmation=invalid/);
});

test("public readiness fails closed without configuration and exposes no details", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({ status: "unavailable" });
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["set-cookie"]).toBeUndefined();
});

test("clinician authentication stays separate and discoverable", async ({
  page,
}) => {
  await page.goto("/login?audience=clinician");
  await expect(
    page.getByText("ESPACE SOIGNANT", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Créer un compte soignant", exact: true })
    .click();
  await expect(page).toHaveURL(/audience=clinician/);
  await expect(
    page.getByLabel("Adresse e-mail professionnelle", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Accéder à l’espace parent", exact: true })
    .click();
  await expect(page.getByText("ESPACE PARENT", { exact: true })).toBeVisible();
});
