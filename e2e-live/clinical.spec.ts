import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { writeFileSync } from "node:fs";
import type { ClinicalEntry } from "../src/lib/clinical/types";

const SITE = "https://mon-enfant.vercel.app";
const UUID = /^[a-f0-9-]{36}$/i;
type Role = "A" | "B" | "MANAGER" | "OUTSIDE";

async function login(page: Page, role: Role) {
  const prefix = `MON_ENFANT_CLINICAL_BROWSER_${role}_`;
  const email = process.env[prefix + "EMAIL"],
    password = process.env[prefix + "PASSWORD"];
  if (!email || !password)
    throw new Error("Dedicated fictional clinical credentials are missing.");
  await page.goto("/login");
  await page
    .getByLabel("Adresse e-mail professionnelle", { exact: true })
    .fill(email);
  await page.keyboard.press("Tab");
  await expect(page.locator('[name="password"]')).toBeFocused();
  await page.locator('[name="password"]').fill(password);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/account$/);
}

async function fit(page: Page) {
  await expect(page.getByRole("main")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const missingLabels = await page
    .locator("input:not([type=hidden]),select,textarea")
    .evaluateAll(
      (controls) =>
        controls.filter((control) => {
          const input = control as HTMLInputElement;
          return (
            !input.labels?.length &&
            !input.getAttribute("aria-label") &&
            !input.getAttribute("aria-labelledby")
          );
        }).length,
    );
  expect(missingLabels).toBe(0);
}

async function get(context: BrowserContext, path: string) {
  try {
    return await context.request.get(path);
  } catch {
    throw new Error(
      "Clinical API check failed; request credentials and response details withheld.",
    );
  }
}

async function facility(page: Page, name: string) {
  await page.goto("/practices");
  await page.getByLabel("Nom du lieu d’exercice", { exact: true }).fill(name);
  await page.getByLabel("Ville", { exact: true }).fill("Rabat fictif");
  await page.getByRole("button", { name: "Déclarer ce lieu" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Opération enregistrée" }),
  ).toBeVisible();
  await expect(page.locator("li").filter({ hasText: name })).toBeVisible();
}

async function permission(
  manager: Page,
  platform: string,
  capability: string,
  enable = true,
) {
  await manager.goto(
    `/admin/clinical-permissions?q=${encodeURIComponent(platform)}`,
  );
  await expect(
    manager.getByRole("heading", {
      name: `Modifier l’habilitation — ${platform}`,
    }),
  ).toBeVisible();
  await manager
    .getByLabel("Habilitation", { exact: true })
    .selectOption(capability);
  await manager
    .getByLabel("Décision", { exact: true })
    .selectOption(enable ? "enable" : "disable");
  await manager
    .locator('[name="evidence_reference"]')
    .fill(
      "Qualification entièrement fictive pour la vérification du logiciel.",
    );
  await manager
    .getByLabel("Motif historisé", { exact: true })
    .fill("Test technique fictif sans valeur de qualification clinique.");
  await manager.locator('[name="verified"]').check();
  await manager
    .getByRole("button", { name: "Enregistrer l’habilitation" })
    .click();
  await expect(
    manager.getByRole("status").filter({ hasText: "Habilitation historisée" }),
  ).toBeVisible();
  await fit(manager);
}

async function clinicalFields(page: Page, place: string) {
  await page
    .locator('[name="facility_id"]')
    .selectOption({ label: `${place} — Rabat fictif` });
  await page.locator('[name="occurred_on"]').fill("2026-01-02");
  await page.locator('[name="source_verified"]').check();
  await page.locator('[name="syntheticOnly"]').check();
}

test("two doctors preserve identity, amendments, appointments and private access", async ({
  page,
  browser,
}, info) => {
  const run = process.env.MON_ENFANT_QA_RUN!,
    viewport = info.project.name;
  const platformA = `QAB-${run}-A`,
    platformB = `QAB-${run}-B`;
  const placeA = `Centre fictif A ${viewport}`,
    placeB = `Centre fictif B ${viewport}`;
  const childName = `Enfant fictif ${run}-${viewport}`;
  const original = `Observation originale fictive ${viewport}`;
  const corrected = `Observation corrigée fictive ${viewport}`;
  const correctionReason =
    "Correction fictive par le second médecin, original conservé.";
  const contexts: BrowserContext[] = [];
  let pageErrors = 0;
  page.on("pageerror", () => pageErrors++);
  const timings: { screen: string; navigation_ms: number }[] = [];
  async function screen(
    target: Page,
    path: string,
    heading: string,
    label: string,
  ) {
    const start = Date.now();
    await target.goto(path);
    await expect(
      target.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    timings.push({ screen: label, navigation_ms: Date.now() - start });
    await fit(target);
  }
  async function actor(role: Role) {
    const use = info.project.use;
    const context = await browser.newContext({
      baseURL: SITE,
      viewport: page.viewportSize() ?? undefined,
      isMobile: use.isMobile,
      hasTouch: use.hasTouch,
      deviceScaleFactor: use.deviceScaleFactor,
      userAgent: use.userAgent,
    });
    contexts.push(context);
    const target = await context.newPage();
    target.on("pageerror", () => pageErrors++);
    await login(target, role);
    return target;
  }
  try {
    await login(page, "A");
    const a = page,
      b = await actor("B"),
      manager = await actor("MANAGER"),
      outside = await actor("OUTSIDE");
    await permission(manager, platformA, "consultation", false);
    await facility(a, placeA);
    await facility(b, placeB);
    await screen(a, "/patients/new", "Inscrire un enfant", "registration");
    await a
      .locator('[name="facility_id"]')
      .selectOption({ label: `${placeA} — Rabat fictif` });
    await a.getByLabel("Année du registre", { exact: true }).fill("2026");
    await a
      .getByLabel("Livre / série du registre", { exact: true })
      .fill(viewport);
    await a
      .getByLabel("Numéro local (zéros conservés)", { exact: true })
      .fill("125");
    await a
      .getByLabel("Prénom (si connu)", { exact: true })
      .fill("Enfant fictif");
    await a
      .getByLabel("Nom (si connu)", { exact: true })
      .fill(`${run}-${viewport}`);
    await a
      .getByLabel("Date de naissance (si connue)", { exact: true })
      .fill("2025-01-01");
    await a.locator('[name="syntheticOnly"]').check();
    await a
      .getByRole("button", { name: "Créer le dossier et le numéro local" })
      .click();
    await expect(a).toHaveURL(/\/patients\/[a-f0-9-]{36}$/i);
    const child = new URL(a.url()).pathname.split("/").at(-1)!;
    expect(UUID.test(child)).toBe(true);
    await expect(
      a.getByRole("heading", { name: childName, exact: true }),
    ).toBeVisible();
    const universal = await a
      .locator("dt")
      .filter({ hasText: /^Identifiant universel$/ })
      .locator("+ dd")
      .innerText();
    expect(UUID.test(universal)).toBe(true);
    await fit(a);
    await a.screenshot({
      path: info.outputPath("clinical-profile.png"),
      fullPage: true,
    });

    // Account approval plus child grant still do not confer clinical writing.
    await screen(
      a,
      `/patients/${child}/records/new?kind=consultation`,
      "Consultation",
      "capability-denial",
    );
    await expect(
      a.getByRole("button", { name: "Enregistrer le soin" }),
    ).toHaveCount(0);
    await expect(
      a.getByText(
        "L’habilitation consultation n’est pas active pour votre compte.",
      ),
    ).toBeVisible();
    expect((await get(b.context(), `/patients/${child}/export`)).status()).toBe(
      404,
    );
    await screen(
      b,
      "/patients/link",
      "Rattacher un dossier existant",
      "link-request",
    );
    await b.locator('[name="universal_id"]').fill(universal);
    await b
      .locator('[name="facility_id"]')
      .selectOption({ label: `${placeB} — Rabat fictif` });
    await b.locator('[name="register_year"]').fill("2026");
    await b.locator('[name="register_book"]').fill(viewport);
    await b.locator('[name="local_number"]').fill("078");
    await b
      .locator('[name="reason"]')
      .fill(
        "Continuité fictive de soins, autorisation à contrôler par le gestionnaire.",
      );
    await b.getByRole("button", { name: "Envoyer la demande d’accès" }).click();
    await expect(
      b.getByRole("status").filter({ hasText: "Opération enregistrée" }),
    ).toBeVisible();
    await b.goto("/access-requests");
    expect((await b.locator("main").innerText()).includes(childName)).toBe(
      false,
    );
    expect((await get(b.context(), `/patients/${child}/export`)).status()).toBe(
      404,
    );
    await a.goto("/access-requests");
    const request = a
      .locator("article")
      .filter({
        has: a.getByRole("heading", { name: childName, exact: true }),
      });
    await request
      .getByLabel("Décision", { exact: true })
      .selectOption("approve");
    await request.locator('[name="authorizationChecked"]').check();
    await request
      .locator('[name="reason"]')
      .fill(
        "Base légitime entièrement fictive vérifiée pour cette continuité.",
      );
    await request
      .getByRole("button", { name: "Enregistrer la décision" })
      .click();
    await expect(request).toHaveCount(0);
    await screen(
      b,
      `/patients/${child}`,
      childName,
      "authorized-second-doctor",
    );
    await expect(b.locator("dd").filter({ hasText: universal })).toBeVisible();
    await expect(b.getByText(/^078 ·/)).toBeVisible();

    for (const [platform, capabilities] of [
      [platformA, ["consultation", "growth", "appointment"]],
      [platformB, ["consultation"]],
    ] as const) {
      for (const capability of capabilities)
        await permission(manager, platform, capability);
    }
    await screen(
      a,
      `/patients/${child}/records/new?kind=consultation`,
      "Consultation",
      "consultation-form",
    );
    await clinicalFields(a, placeA);
    await a.getByRole("button", { name: "Enregistrer le soin" }).click();
    await expect(
      a.getByLabel("Motif de consultation", { exact: true }),
    ).toBeFocused();
    await a
      .getByLabel("Motif de consultation", { exact: true })
      .fill("Contrôle entièrement fictif");
    await a.getByLabel("Observations", { exact: true }).fill(original);
    await a.getByRole("button", { name: "Enregistrer le soin" }).click();
    await expect(a).toHaveURL(/\/records\/[a-f0-9-]{36}$/i);
    const entryPath = new URL(a.url()).pathname;
    await expect(
      a.getByRole("heading", { name: "Historique de la saisie", exact: true }),
    ).toBeVisible();
    await expect(
      a.locator(".clinical-entry").getByText(original, { exact: true }),
    ).toBeVisible();
    await b.goto(entryPath);
    await expect(
      b.getByRole("heading", { name: "Historique de la saisie", exact: true }),
    ).toBeVisible();
    await clinicalFields(b, placeB);
    await b.getByLabel("Observations", { exact: true }).fill(corrected);
    await b.locator('[name="amendment_reason"]').fill(correctionReason);
    await b.getByRole("button", { name: "Ajouter la révision" }).click();
    await expect(b.locator(".clinical-entry")).toHaveCount(2);
    await expect(
      b.locator(".clinical-entry").getByText(original, { exact: true }),
    ).toBeVisible();
    await expect(
      b.locator(".clinical-entry").getByText(corrected, { exact: true }),
    ).toBeVisible();
    await fit(b);
    await b.screenshot({
      path: info.outputPath("clinical-history.png"),
      fullPage: true,
    });

    await screen(
      a,
      `/patients/${child}/records/new?kind=growth`,
      "Mesures de croissance",
      "growth-form",
    );
    await clinicalFields(a, placeA);
    await a.getByLabel("Poids (kg)", { exact: true }).fill("9.25");
    await a.getByLabel("Taille (cm)", { exact: true }).fill("74.5");
    await a.getByRole("button", { name: "Enregistrer le soin" }).click();
    await expect(a).toHaveURL(/\/records\/[a-f0-9-]{36}$/i);
    await screen(a, `/patients/${child}/growth`, "Croissance", "growth-chart");
    await expect(
      a.getByRole("img", { name: /^Poids, valeurs enregistrées/ }),
    ).toBeVisible();
    await expect(
      a.getByRole("cell", { name: "9.25", exact: true }),
    ).toBeVisible();
    await a.screenshot({
      path: info.outputPath("clinical-growth.png"),
      fullPage: true,
    });

    await screen(
      a,
      `/patients/${child}/appointments/new`,
      `Planifier — ${childName}`,
      "appointment-form",
    );
    await a
      .locator('[name="facility_id"]')
      .selectOption({ label: `${placeA} — Rabat fictif` });
    await a.locator('[name="purpose_label"]').fill("Suivi entièrement fictif");
    await a.locator('[name="starts_local"]').fill("2027-01-12T10:00");
    await a.locator('[name="ends_local"]').fill("2027-01-12T10:30");
    await a
      .locator('[name="reason"]')
      .fill("Planification fictive après revue du dossier.");
    await a.locator('[name="reviewed"]').check();
    await a.locator('[name="syntheticOnly"]').check();
    await a.getByRole("button", { name: "Planifier le rendez-vous" }).click();
    await expect(a).toHaveURL(/\/appointments\/[a-f0-9-]{36}$/i);
    const appointmentPath = new URL(a.url()).pathname;
    await expect(
      a.getByRole("heading", { name: "Historique du rendez-vous" }),
    ).toBeVisible();
    await b.goto(appointmentPath);
    await expect(b.getByText(/Seul le médecin responsable/)).toBeVisible();
    await expect(
      b.getByRole("button", { name: "Ajouter la décision" }),
    ).toHaveCount(0);
    await a.locator('[name="starts_local"]').fill("2027-01-13T11:00");
    await a.locator('[name="ends_local"]').fill("2027-01-13T11:30");
    await a
      .locator('[name="reason"]')
      .fill("Replanification manuelle fictive, ancien créneau conservé.");
    await a.locator('[name="reviewed"]').check();
    await a.locator('[name="syntheticOnly"]').check();
    await a.getByRole("button", { name: "Ajouter la décision" }).click();
    await expect(
      a.getByRole("heading", { name: "Révision 2 — Replanification manuelle" }),
    ).toBeVisible();
    await fit(a);

    await screen(
      a,
      `/patients/${child}/summary`,
      childName,
      "clinical-summary",
    );
    await expect(a.locator(".clinical-entry")).toHaveCount(3);
    const response = await get(a.context(), `/patients/${child}/export`);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    const ledger = await response.json();
    expect(ledger.format).toBe("mon-enfant-clinical-ledger-v3");
    expect(
      ledger.child.id === child && ledger.child.universal_id === universal,
    ).toBe(true);
    const entries = ledger.clinical_entries as ClinicalEntry[];
    expect(entries.length).toBe(3);
    expect(
      entries.some(
        (entry) =>
          entry.professional_id === platformA &&
          entry.payload.findings === original,
      ),
    ).toBe(true);
    expect(
      entries.some(
        (entry) =>
          entry.professional_id === platformB &&
          entry.payload.findings === corrected &&
          entry.amendment_reason === correctionReason,
      ),
    ).toBe(true);
    expect(ledger.appointments_including_all_events.length).toBe(1);
    expect(ledger.appointments_including_all_events[0].events.length).toBe(2);
    expect(ledger.vaccine_items_including_all_decisions.length).toBe(0);
    await a.screenshot({
      path: info.outputPath("clinical-summary.png"),
      fullPage: true,
    });

    for (const denied of [outside, manager]) {
      const blocked = await get(denied.context(), `/patients/${child}/export`);
      // An admin is redirected out of the doctor workspace; unrelated doctors get a private 404.
      expect(
        blocked.status() === 404 ||
          new URL(blocked.url()).pathname === "/account",
      ).toBe(true);
      expect((await blocked.text()).includes(original)).toBe(false);
      await denied.goto(`/patients/${child}`);
      expect(
        (await denied.locator("main").innerText()).includes(childName),
      ).toBe(false);
    }
    await permission(manager, platformB, "consultation", false);
    await b.goto(entryPath);
    await expect(
      b.getByRole("button", { name: "Ajouter la révision" }),
    ).toHaveCount(0);
    await expect(b.locator(".clinical-entry")).toHaveCount(2);
    await a.goto(`/patients/${child}`);
    const grant = a.locator("article").filter({ hasText: platformB });
    await grant
      .locator('[name="reason"]')
      .fill("Fin de continuité fictive, révocation immédiate de cet accès.");
    await grant.getByRole("button", { name: "Révoquer cet accès" }).click();
    await expect(grant.getByText("Accès révoqué")).toBeVisible();
    expect((await get(b.context(), `/patients/${child}/export`)).status()).toBe(
      404,
    );
    await b.goto(`/patients/${child}`);
    await expect(
      b.getByRole("heading", { name: "Cette page est introuvable." }),
    ).toBeVisible();

    await a.goto("/account");
    await a.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(a).toHaveURL(/\/login$/);
    await a.goto(`/patients/${child}/summary`);
    await expect(a).toHaveURL(/\/login$/);
    expect(pageErrors).toBe(0);
    const proof = {
      mode: "clinical_acceptance",
      viewport,
      shared_identity: true,
      a_local_number: "125",
      b_local_number: "078",
      clinical_revisions: 3,
      appointment_events: 2,
      unauthorized_exports_denied: true,
      capability_revocation_verified: true,
      grant_revocation_verified: true,
      logout_denied: true,
      page_errors: pageErrors,
      timings,
    };
    writeFileSync(
      info.outputPath("clinical-proof.json"),
      JSON.stringify(proof),
    );
    console.log(JSON.stringify(proof));
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
