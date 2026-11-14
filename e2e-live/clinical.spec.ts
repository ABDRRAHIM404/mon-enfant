import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { observeBrowserErrors } from "./browser-errors";
import {
  scanAccessibility,
  assertAccessible,
  tabTo,
  type AccessibilityProof,
} from "../e2e-support/accessibility";
import { reviewGrowthContrast } from "../e2e-support/growth-contrast";
import {
  measureClinicalRead,
  type PerformanceProof,
} from "../e2e-support/performance";
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
  await manager.locator('[name="capability"]').selectOption(capability);
  await manager
    .locator('[name="decision"]')
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
  const medication = `Traitement fictif sans substance ${viewport}`;
  const instructions = "Instructions fictives sans posologie clinique.";
  const correctedInstructions =
    "Instructions fictives corrigées, sans posologie clinique.";
  const paperReference =
    "Papier fictif sans date lisible, aucune ordonnance réelle.";
  const riskOriginal = `Risque entièrement fictif ${viewport}`;
  const riskCorrected = `Signalement fictif corrigé ${viewport}`;
  const riskReference =
    "Signalement fictif rapporté, sans document clinique réel.";
  const withdrawalReason =
    "Retrait fictif pour erreur, toutes les versions conservées.";
  const correctionReason =
    "Correction fictive par le second médecin, original conservé.";
  const contexts: BrowserContext[] = [];
  let pageErrors = 0;
  observeBrowserErrors(page, "A", () => pageErrors++);
  const timings: { screen: string; navigation_ms: number }[] = [];
  const accessibility =
    process.env.MON_ENFANT_LIVE_PROBE === "clinical-accessibility";
  const accessibilityProofs: AccessibilityProof[] = [];
  const performanceMode =
    process.env.MON_ENFANT_LIVE_PROBE === "clinical-performance";
  const performanceProofs: PerformanceProof[] = [];
  const measuredScreens = new Set([
    "registration",
    "consultation-form",
    "growth-chart",
    "clinical-timeline",
    "appointment-form",
    "clinical-summary",
  ]);
  async function inspect(target: Page, label: string) {
    if (accessibility)
      accessibilityProofs.push(await scanAccessibility(target, label, info));
  }
  async function screen(
    target: Page,
    path: string,
    heading: string,
    label: string,
  ) {
    const start = Date.now();
    if (performanceMode && measuredScreens.has(label))
      performanceProofs.push(
        ...(await measureClinicalRead(target, path, heading, label, info)),
      );
    else await target.goto(path);
    await expect(
      target.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    timings.push({ screen: label, navigation_ms: Date.now() - start });
    await fit(target);
    expect(pageErrors).toBe(0);
    if (accessibility) {
      await target.keyboard.press("Tab");
      const bypass = target.getByRole("link", {
        name: "Aller au contenu principal",
        exact: true,
      });
      await expect(bypass).toBeFocused();
      await expect(bypass).toBeInViewport();
      await target.keyboard.press("Enter");
      await expect(target.getByRole("heading", { level: 1 })).toBeFocused();
      await inspect(target, label);
      if (
        label === "growth-chart" ||
        label === "corrected-growth-chart" ||
        label === "withdrawn-growth-chart"
      )
        await reviewGrowthContrast(target, label, info);
    }
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
    context.setDefaultTimeout(20000);
    context.setDefaultNavigationTimeout(30000);
    contexts.push(context);
    const target = await context.newPage();
    observeBrowserErrors(target, role, () => pageErrors++);
    await login(target, role);
    return target;
  }
  try {
    await login(page, "A");
    const a = page,
      b = await actor("B"),
      manager = await actor("MANAGER"),
      outside = await actor("OUTSIDE");
    console.log(
      JSON.stringify({ viewport, phase: "synthetic_actors_authenticated" }),
    );
    for (const kind of ["consultation", "prescription", "risk", "growth"])
      await permission(manager, platformA, kind, false);
    console.log(
      JSON.stringify({ viewport, phase: "explicit_capability_denial_set" }),
    );
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
    await inspect(a, "registered-child-profile");
    await a.screenshot({
      path: info.outputPath("clinical-profile.png"),
      fullPage: true,
    });

    // Approval plus a child grant does not confer any clinical entry capability.
    for (const [kind, label] of [
      ["consultation", "Consultation"],
      ["prescription", "Prescription / traitement"],
      ["risk", "Risque / allergie"],
      ["growth", "Mesures de croissance"],
    ]) {
      await screen(
        a,
        `/patients/${child}/records/new?kind=${kind}`,
        label,
        `capability-denial-${kind}`,
      );
      await expect(
        a.getByRole("button", { name: "Enregistrer le soin" }),
      ).toHaveCount(0);
      await expect(
        a.getByText(
          `L’habilitation ${label.toLowerCase()} n’est pas active pour votre compte.`,
        ),
      ).toBeVisible();
    }
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
    await inspect(b, "pending-request-receipt");
    expect((await b.locator("main").innerText()).includes(childName)).toBe(
      false,
    );
    expect((await get(b.context(), `/patients/${child}/export`)).status()).toBe(
      404,
    );
    await a.goto("/access-requests");
    await inspect(a, "access-review-form");
    const request = a.locator("article").filter({
      has: a.getByRole("heading", { name: childName, exact: true }),
    });
    await request.locator('[name="decision"]').selectOption("approve");
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
      [
        platformA,
        ["consultation", "prescription", "risk", "growth", "appointment"],
      ],
      [platformB, ["consultation", "prescription", "risk", "growth"]],
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
    await inspect(manager, "clinical-permission-decisions");
    await clinicalFields(a, placeA);
    await a.getByRole("button", { name: "Enregistrer le soin" }).click();
    await expect(
      a.getByLabel("Motif de consultation", { exact: true }),
    ).toBeFocused();
    await inspect(a, "consultation-required-motive");
    if (accessibility) {
      await expect(
        a.getByLabel("Motif de consultation", { exact: true }),
      ).toBeFocused();
      await a.keyboard.type("Contrôle entièrement fictif");
      await tabTo(a, a.getByLabel("Observations", { exact: true }));
      await a.keyboard.type(original);
      await tabTo(
        a,
        a.getByRole("button", { name: "Enregistrer le soin", exact: true }),
      );
      await a.keyboard.press("Enter");
    } else {
      await a
        .getByLabel("Motif de consultation", { exact: true })
        .fill("Contrôle entièrement fictif");
      await a.getByLabel("Observations", { exact: true }).fill(original);
      await a.getByRole("button", { name: "Enregistrer le soin" }).click();
    }
    await expect(a).toHaveURL(/\/records\/[a-f0-9-]{36}$/i);
    const entryPath = new URL(a.url()).pathname;
    await inspect(a, "consultation-original-and-amendment-form");
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
    await inspect(b, "second-doctor-consultation-amendment");
    await b.locator('[name="findings"]').fill(corrected);
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
    await inspect(b, "consultation-corrected-history");
    await b.screenshot({
      path: info.outputPath("clinical-history.png"),
      fullPage: true,
    });

    await screen(
      a,
      `/patients/${child}/records/new?kind=prescription`,
      "Prescription / traitement",
      "prescription-form",
    );
    await clinicalFields(a, placeA);
    await a.locator('[name="occurrence_precision"]').selectOption("unknown");
    await a.locator('[name="occurred_on"]').fill("");
    await a.locator('[name="source_type"]').selectOption("paper_transcription");
    await a.locator('[name="source_reference"]').fill(paperReference);
    await a.locator('[name="source_verified"]').uncheck();
    await a.getByRole("button", { name: "Enregistrer le soin" }).click();
    await expect(a.locator('[name="medication"]')).toBeFocused();
    await inspect(a, "paper-prescription-required-medication");
    await a.locator('[name="medication"]').fill(medication);
    await a.getByRole("button", { name: "Enregistrer le soin" }).click();
    await expect(a.locator('[name="instructions"]')).toBeFocused();
    await inspect(a, "paper-prescription-required-instructions");
    await a.locator('[name="instructions"]').fill(instructions);
    await a.getByRole("button", { name: "Enregistrer le soin" }).click();
    await expect(a).toHaveURL(/\/records\/[a-f0-9-]{36}$/i);
    const prescriptionPath = new URL(a.url()).pathname;
    await inspect(a, "uncertain-prescription-history");
    await expect(
      a
        .locator(".clinical-entry")
        .getByText("Source non confirmée", { exact: false }),
    ).toBeVisible();
    await b.goto(prescriptionPath);
    await clinicalFields(b, placeB);
    await b.locator('[name="occurrence_precision"]').selectOption("unknown");
    await b.locator('[name="occurred_on"]').fill("");
    await b.locator('[name="source_verified"]').uncheck();
    await b.locator('[name="instructions"]').fill(correctedInstructions);
    await b.locator('[name="amendment_reason"]').fill(correctionReason);
    await b.getByRole("button", { name: "Ajouter la révision" }).click();
    await expect(b.locator(".clinical-entry")).toHaveCount(2);
    await expect(
      b.locator(".clinical-entry").getByText(instructions, { exact: true }),
    ).toBeVisible();
    await expect(
      b
        .locator(".clinical-entry")
        .getByText(correctedInstructions, { exact: true }),
    ).toBeVisible();
    await fit(b);
    await inspect(b, "corrected-prescription-history");

    await screen(
      a,
      `/patients/${child}/records/new?kind=risk`,
      "Risque / allergie",
      "risk-form",
    );
    await clinicalFields(a, placeA);
    await a.locator('[name="source_type"]').selectOption("reported_history");
    await a.locator('[name="source_reference"]').fill(riskReference);
    await a.locator('[name="source_verified"]').uncheck();
    await a.locator('[name="occurrence_precision"]').selectOption("estimated");
    await a.locator('[name="category"]').selectOption("other");
    await a.locator('[name="severity"]').selectOption("unknown");
    await a.getByRole("button", { name: "Enregistrer le soin" }).click();
    await expect(a.locator('textarea[name="description"]')).toBeFocused();
    await inspect(a, "reported-risk-required-description");
    await a.locator('textarea[name="description"]').fill(riskOriginal);
    await a.getByRole("button", { name: "Enregistrer le soin" }).click();
    await expect(a).toHaveURL(/\/records\/[a-f0-9-]{36}$/i);
    const riskPath = new URL(a.url()).pathname;
    await inspect(a, "reported-risk-history");
    await b.goto(riskPath);
    await clinicalFields(b, placeB);
    await b.locator('textarea[name="description"]').fill(riskCorrected);
    await b.locator('[name="amendment_reason"]').fill(correctionReason);
    await b.getByRole("button", { name: "Ajouter la révision" }).click();
    await expect(b.locator(".clinical-entry")).toHaveCount(2);
    await expect(
      b.locator(".clinical-entry").getByText(riskOriginal, { exact: true }),
    ).toBeVisible();
    await expect(
      b.locator(".clinical-entry").getByText(riskCorrected, { exact: true }),
    ).toBeVisible();
    await clinicalFields(b, placeB);
    await b.locator('[name="entry_state"]').selectOption("withdrawn");
    await b.locator('[name="amendment_reason"]').fill(withdrawalReason);
    await b.getByRole("button", { name: "Ajouter la révision" }).click();
    await expect(b.locator(".clinical-entry")).toHaveCount(3);
    await expect(
      b.getByRole("heading", {
        name: "Risque / allergie — retirée",
        exact: true,
      }),
    ).toBeVisible();
    await fit(b);
    await inspect(b, "withdrawn-risk-history");

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
    const growthPath = new URL(a.url()).pathname;
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

    await b.goto(growthPath);
    await inspect(b, "growth-amendment-form");
    await clinicalFields(b, placeB);
    await b.locator('[name="weight_kg"]').fill("9.35");
    await b.locator('[name="amendment_reason"]').fill(correctionReason);
    await b.getByRole("button", { name: "Ajouter la révision" }).click();
    await expect(b.locator(".clinical-entry")).toHaveCount(2);
    await screen(
      a,
      `/patients/${child}/growth`,
      "Croissance",
      "corrected-growth-chart",
    );
    await expect(
      a.getByRole("cell", { name: "9.35", exact: true }),
    ).toBeVisible();
    await expect(
      a.getByRole("cell", { name: "9.25", exact: true }),
    ).toHaveCount(0);
    await b.goto(growthPath);
    await clinicalFields(b, placeB);
    await b.locator('[name="entry_state"]').selectOption("withdrawn");
    await b.locator('[name="amendment_reason"]').fill(withdrawalReason);
    await b.getByRole("button", { name: "Ajouter la révision" }).click();
    await expect(b.locator(".clinical-entry")).toHaveCount(3);
    await screen(
      a,
      `/patients/${child}/growth`,
      "Croissance",
      "withdrawn-growth-chart",
    );
    await expect(a.getByRole("img")).toHaveCount(0);
    await expect(
      a.getByRole("cell", { name: "Retirée", exact: true }),
    ).toBeVisible();
    await expect(
      a.getByRole("link", { name: "Version 3", exact: true }),
    ).toBeVisible();

    await screen(
      a,
      `/patients/${child}/records`,
      "Dossier clinique",
      "clinical-timeline",
    );
    await expect(a.locator(".clinical-entry")).toHaveCount(4);
    await expect(
      a.getByRole("heading", {
        name: "Risque / allergie — retirée",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      a.getByRole("heading", {
        name: "Mesures de croissance — retirée",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      a
        .locator(".clinical-entry")
        .getByText(correctedInstructions, { exact: true }),
    ).toBeVisible();

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
    await inspect(a, "appointment-history-and-decision-form");
    await expect(
      a.getByRole("heading", { name: "Historique du rendez-vous" }),
    ).toBeVisible();
    await b.goto(appointmentPath);
    await expect(b.getByText(/Seul le médecin responsable/)).toBeVisible();
    await inspect(b, "appointment-responsibility-denial");
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
    await inspect(a, "rescheduled-appointment-history");

    await screen(
      a,
      `/patients/${child}/summary`,
      childName,
      "clinical-summary",
    );
    await expect(a.locator(".clinical-entry")).toHaveCount(10);
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
    expect(entries.length).toBe(10);
    const prescriptions = entries.filter(
      (entry) => entry.kind === "prescription",
    );
    expect(prescriptions.length).toBe(2);
    expect(
      prescriptions.every(
        (entry) =>
          entry.occurred_on === null &&
          entry.occurrence_precision === "unknown" &&
          entry.source_type === "paper_transcription" &&
          entry.source_reference === paperReference &&
          !entry.source_verified &&
          entry.payload.medication === medication,
      ),
    ).toBe(true);
    expect(
      prescriptions.some(
        (entry) =>
          entry.professional_id === platformA &&
          entry.payload.instructions === instructions &&
          entry.revision === 1,
      ),
    ).toBe(true);
    expect(
      prescriptions.some(
        (entry) =>
          entry.professional_id === platformB &&
          entry.payload.instructions === correctedInstructions &&
          entry.revision === 2 &&
          entry.amendment_reason === correctionReason,
      ),
    ).toBe(true);
    const risks = entries.filter((entry) => entry.kind === "risk");
    expect(risks.length).toBe(3);
    expect(
      risks.every(
        (entry) =>
          entry.source_type === "reported_history" &&
          entry.source_reference === riskReference &&
          entry.occurrence_precision === "estimated",
      ),
    ).toBe(true);
    expect(
      risks.some(
        (entry) =>
          entry.professional_id === platformA &&
          entry.payload.description === riskOriginal &&
          entry.revision === 1 &&
          !entry.source_verified,
      ),
    ).toBe(true);
    expect(
      risks.some(
        (entry) =>
          entry.professional_id === platformB &&
          entry.payload.description === riskCorrected &&
          entry.revision === 3 &&
          entry.entry_state === "withdrawn" &&
          entry.amendment_reason === withdrawalReason,
      ),
    ).toBe(true);
    const growth = entries.filter((entry) => entry.kind === "growth");
    expect(growth.length).toBe(3);
    expect(
      growth.some(
        (entry) =>
          entry.professional_id === platformA &&
          entry.payload.weight_kg === 9.25 &&
          entry.revision === 1,
      ),
    ).toBe(true);
    expect(
      growth.some(
        (entry) =>
          entry.professional_id === platformB &&
          entry.payload.weight_kg === 9.35 &&
          entry.revision === 3 &&
          entry.entry_state === "withdrawn" &&
          entry.amendment_reason === withdrawalReason,
      ),
    ).toBe(true);
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
    await inspect(b, "revoked-capability-readable-history");
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

    await inspect(b, "revoked-grant-private-not-found");
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
      clinical_revisions: 10,
      entry_kinds: ["consultation", "prescription", "risk", "growth"],
      all_four_capability_denials: true,
      paper_prescription_unknown_date_retained: true,
      risk_correction_withdrawal_retained: true,
      growth_correction_withdrawal_projection: true,
      all_four_originals_and_corrections_exported: true,
      appointment_events: 2,
      unauthorized_exports_denied: true,
      capability_revocation_verified: true,
      grant_revocation_verified: true,
      logout_denied: true,
      page_errors: pageErrors,
      ...(accessibility
        ? {
            automatic_accessibility_screens: accessibilityProofs.length,
            automatic_violations: accessibilityProofs.reduce(
              (n, p) => n + p.violations.length,
              0,
            ),
            incomplete_rules: accessibilityProofs.reduce(
              (n, p) => n + p.incomplete.length,
              0,
            ),
            keyboard_bypass_on_screen_navigation: true,
            keyboard_consultation_after_provenance_setup: true,
            growth_text_contrast_and_keyboard_visibility: true,
            manual_review_required: true,
          }
        : {}),
      ...(performanceMode
        ? {
            performance_observations: performanceProofs.length,
            measured_screen_count: measuredScreens.size,
            performance_acceptance_claimed: false,
          }
        : {}),
      timings,
    };
    writeFileSync(
      info.outputPath("clinical-proof.json"),
      JSON.stringify(proof),
    );
    console.log(JSON.stringify(proof));
    if (performanceMode) expect(performanceProofs.length).toBe(12);
    if (accessibility) {
      expect(accessibilityProofs.length).toBeGreaterThanOrEqual(30);
      assertAccessible(accessibilityProofs);
    }
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});
