import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { observeBrowserErrors } from "./browser-errors";
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

const seedLabel = "PNI 2025 — transcription initiale à revoir";
const basis =
  "Vérification QA entièrement fictive, sans approbation clinique réelle.";
function catalogForm(page: Page, action: string) {
  return page
    .locator("form")
    .filter({ has: page.locator(`input[name="action"][value="${action}"]`) });
}
async function catalogBasis(page: Page, action: string) {
  const form = catalogForm(page, action);
  await form.locator('[name="evidence_reference"]').fill(basis);
  await form.locator('textarea[name="reason"]').fill(basis);
  return form;
}
async function vaccineFields(
  page: Page,
  place: string,
  code: string,
  lot?: string,
) {
  await clinicalFields(page, place);
  await page.locator('[name="vaccine_code"]').fill(code);
  await page
    .locator('[name="vaccine_label"]')
    .fill(`Vaccin entièrement fictif ${code}`);
  if (lot) {
    await page.locator('[name="dose_label"]').fill("VPO1");
    for (const [status, field, value] of [
      ["lot_status", "lot_number", lot],
      ["site_status", "site", "Site fictif non clinique"],
      [
        "provider_status",
        "administered_by",
        "Administrateur fictif distinct de la transcription",
      ],
      [
        "administration_facility_status",
        "administration_facility",
        "Lieu fictif documenté",
      ],
    ]) {
      await page.locator(`[name="${status}"]`).selectOption("known");
      await page.locator(`[name="${field}"]`).fill(value);
    }
  }
}
function futureSlot(offset: number, hour = "10") {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + offset);
  const date = day.toISOString().slice(0, 10);
  return [`${date}T${hour}:00`, `${date}T${hour}:30`];
}

test("QA catalog review and cross-doctor vaccine continuity preserve every decision", async ({
  page,
  browser,
}, info) => {
  const run = process.env.MON_ENFANT_QA_RUN!,
    viewport = info.project.name;
  const platformA = `QAB-${run}-A`,
    platformB = `QAB-${run}-B`;
  const placeA = `Centre vaccinal fictif A ${viewport}`,
    placeB = `Centre vaccinal fictif B ${viewport}`;
  const childName = `Enfant fictif ${run}-${viewport}`;
  const label = `QA navigateur vaccinal ${run} ${viewport}`;
  const vaccineVisit = `Suivi vaccinal fictif ${viewport}`;
  const otherVisit = `Consultation indépendante fictive ${viewport}`;
  const lot = `QA-LOT-${viewport}`;
  const paper =
    "Registre fictif sans date lisible ; lot, site et administrateur inconnus.";
  const override =
    "Administration fictive distincte confirmée après relecture des doublons.";
  const correction = "Rapprochement fictif annulé après contrôle de la source.";
  const contexts: BrowserContext[] = [];
  const observedPages: { role: string; page: Page }[] = [{ role: "A", page }];
  let pageErrors = 0;
  const timings: { screen: string; navigation_ms: number }[] = [];
  observeBrowserErrors(page, "vaccine-A", () => pageErrors++);
  async function screen(
    target: Page,
    path: string,
    heading: string,
    label = "workspace",
  ) {
    const start = Date.now();
    await target.goto(path);
    await expect(
      target.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await fit(target);
    timings.push({ screen: label, navigation_ms: Date.now() - start });
    expect(pageErrors).toBe(0);
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
    context.setDefaultTimeout(20000);
    context.setDefaultNavigationTimeout(30000);
    const target = await context.newPage();
    observedPages.push({ role, page: target });
    observeBrowserErrors(target, `vaccine-${role}`, () => pageErrors++);
    await login(target, role);
    return target;
  }
  try {
    await login(page, "A");
    const a = page,
      b = await actor("B"),
      manager = await actor("MANAGER"),
      outside = await actor("OUTSIDE");
    await permission(manager, platformA, "vaccination", false);
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

    await screen(
      a,
      `/patients/${child}/records/new?kind=vaccination`,
      "Vaccination",
    );
    await expect(
      a.getByRole("button", { name: "Enregistrer le soin" }),
    ).toHaveCount(0);
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

    // Locate the immutable seed through actual catalog pagination.
    let found = false;
    for (let number = 1; number <= 30; number++) {
      await manager.goto(`/vaccines?page=${number}`);
      if (
        await manager
          .getByRole("link", { name: seedLabel, exact: true })
          .count()
      ) {
        found = true;
        break;
      }
      if (
        !(await manager
          .getByRole("link", { name: "Page suivante", exact: true })
          .count())
      )
        break;
    }
    expect(found).toBe(true);
    await manager.getByRole("link", { name: seedLabel, exact: true }).click();
    const seedPath = new URL(manager.url()).pathname;
    await expect(
      manager.getByText("Brouillon — non activé · révision 1", { exact: true }),
    ).toBeVisible();
    await a.goto(seedPath);
    await expect(
      a.getByRole("button", { name: "Approuver cette version", exact: true }),
    ).toHaveCount(0);
    const clone = await catalogBasis(manager, "clone");
    await clone.locator('[name="label"]').fill(label);
    await clone
      .getByRole("button", { name: "Créer le brouillon", exact: true })
      .click();
    await expect(
      manager.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
    const versionPath = new URL(manager.url()).pathname;
    const version = versionPath.split("/").at(-1)!;
    expect(UUID.test(version) && versionPath !== seedPath).toBe(true);
    await fit(manager);
    for (const [platform, capability] of [
      [platformA, "vaccination"],
      [platformA, "appointment"],
      [platformB, "vaccination"],
    ])
      await permission(manager, platform, capability);
    await manager.goto(versionPath);
    const rules = manager.locator("section").filter({
      has: manager.getByRole("heading", {
        name: "Règles de cette version",
        exact: true,
      }),
    });
    await expect(rules.locator(".record-list > article")).toHaveCount(25);
    for (const dose of ["PCV1", "PCV2", "PCV3", "PCV4"])
      await expect(
        rules.getByRole("heading", { name: `${dose} · PCV`, exact: true }),
      ).toBeVisible();
    await expect(
      rules
        .locator("article")
        .filter({
          has: manager.getByRole("heading", {
            name: "Rota1 · ROTA",
            exact: true,
          }),
        })
        .getByText("Âge configuré : 2 mois calendaires", { exact: true }),
    ).toBeVisible();
    await expect(
      rules
        .locator("article")
        .filter({
          has: manager.getByRole("heading", {
            name: "Rota1 · ROTA",
            exact: true,
          }),
        })
        .getByText("Âge de la source : 8 semaines", { exact: true }),
    ).toBeVisible();
    await expect(
      rules
        .locator("article")
        .filter({
          has: manager.getByRole("heading", { name: "HPV · HPV", exact: true }),
        })
        .getByText(/Filles uniquement/),
    ).toBeVisible();
    // An invalid HB1 activation is rejected without changing the source.
    await manager.goto(`${versionPath}?dose=HB1`);
    const invalid = await catalogBasis(manager, "edit");
    await invalid.locator('[name="automatic_scheduling"]').check();
    await invalid
      .getByRole("button", { name: "Enregistrer la règle", exact: true })
      .click();
    await expect(manager.getByRole("main").getByRole("alert")).toContainText(
      "HB1 reste désactivé",
    );
    for (const [value, revision] of [
      ["9", 2],
      ["8", 3],
    ] as const) {
      await manager.goto(`${versionPath}?dose=VPO1`);
      const form = await catalogBasis(manager, "edit");
      await form.locator('[name="age_value"]').fill(value);
      await form
        .getByRole("button", { name: "Enregistrer la règle", exact: true })
        .click();
      await expect(
        manager.getByRole("heading", {
          name: `Règle modifiée · révision ${revision}`,
          exact: true,
        }),
      ).toBeVisible();
    }
    await a.goto(versionPath);
    const approval = await catalogBasis(a, "approve");
    for (const name of [
      "source_authenticated",
      "clinical_reviewed",
      "birth_window_reviewed",
    ])
      await approval.locator(`[name="${name}"]`).check();
    await approval
      .getByRole("button", { name: "Approuver cette version", exact: true })
      .click();
    await expect(
      a.getByText("Approuvée · révision 4", { exact: true }),
    ).toBeVisible();
    await fit(a);
    await outside.goto(versionPath);
    await expect(
      outside.getByRole("button", {
        name: "Approuver cette version",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      outside.getByRole("button", { name: "Créer le brouillon", exact: true }),
    ).toHaveCount(0);

    const vaccinePath = `/patients/${child}/vaccinations`;
    await screen(
      a,
      `${vaccinePath}?version=${version}`,
      `Vaccinations — ${childName}`,
    );
    await expect(
      a.locator('[name="dose_code"] option[value="HB1"]'),
    ).toHaveCount(0);
    await a.locator('[name="dose_code"]').selectOption("VPO1");
    await a
      .locator('[name="facility_id"]')
      .selectOption({ label: `${placeA} — Rabat fictif` });
    await a.locator('textarea[name="reason"]').fill(basis);
    await a.locator('[name="eligibility_checked"]').check();
    await a.locator('[name="syntheticOnly"]').check();
    await a
      .getByRole("button", { name: "Assigner la référence", exact: true })
      .click();
    await expect(
      a.getByText("Administration non confirmée", { exact: true }),
    ).toBeVisible();
    await expect(
      a.getByText("Référence de routine : 2025-02-26", { exact: true }),
    ).toBeVisible();
    const itemPath = await a
      .getByRole("link", {
        name: "Décisions et historique de la référence",
        exact: true,
      })
      .getAttribute("href");
    expect(Boolean(itemPath)).toBe(true);
    const item = itemPath!.split("/").at(-1)!;
    expect(UUID.test(item)).toBe(true);

    const newRecord = `/patients/${child}/records/new?kind=vaccination`;
    await screen(a, newRecord, "Vaccination");
    await vaccineFields(a, placeA, "BCG");
    await a.locator('[name="occurrence_precision"]').selectOption("unknown");
    await a.locator('[name="occurred_on"]').fill("");
    await a.locator('[name="source_type"]').selectOption("paper_transcription");
    await a.locator('[name="source_reference"]').fill(paper);
    await a.locator('[name="source_verified"]').uncheck();
    await a
      .getByRole("button", { name: "Enregistrer le soin", exact: true })
      .click();
    await expect(a).toHaveURL(/\/records\/[a-f0-9-]{36}$/i);
    await a.goto(vaccinePath);
    await expect(
      a.getByText("Administration non confirmée", { exact: true }),
    ).toBeVisible();

    async function plan(label: string, slot: string[], itemId = "") {
      await screen(
        a,
        `/patients/${child}/appointments/new${itemId ? `?item=${itemId}` : ""}`,
        `Planifier — ${childName}`,
      );
      await a
        .locator('[name="facility_id"]')
        .selectOption({ label: `${placeA} — Rabat fictif` });
      await a
        .locator('[name="purpose"]')
        .selectOption(itemId ? "vaccination" : "consultation");
      if (itemId)
        await a.locator('[name="vaccine_item_id"]').selectOption(itemId);
      await a.locator('[name="purpose_label"]').fill(label);
      await a.locator('[name="starts_local"]').fill(slot[0]);
      await a.locator('[name="ends_local"]').fill(slot[1]);
      await a.locator('textarea[name="reason"]').fill(basis);
      await a.locator('[name="reviewed"]').check();
      await a.locator('[name="syntheticOnly"]').check();
      await a
        .getByRole("button", { name: "Planifier le rendez-vous", exact: true })
        .click();
      await expect(a).toHaveURL(/\/appointments\/[a-f0-9-]{36}$/i);
      return new URL(a.url()).pathname;
    }
    const appointmentPath = await plan(
      vaccineVisit,
      ["2026-01-01T10:00", "2026-01-01T10:30"],
      item,
    );
    await a.goto("/follow-up?bucket=missed_vaccinations");
    await expect(
      a.getByRole("heading", { name: vaccineVisit, exact: true }),
    ).toBeVisible();
    await a.goto(appointmentPath);
    const replacement = futureSlot(14);
    await a.locator('[name="starts_local"]').fill(replacement[0]);
    await a.locator('[name="ends_local"]').fill(replacement[1]);
    // A replacement date can use a different Casablanca offset from the old slot.
    await a.locator('[name="starts_offset"]').selectOption("auto");
    await a.locator('[name="ends_offset"]').selectOption("auto");
    await a.locator('textarea[name="reason"]').fill(basis);
    await a.locator('[name="reviewed"]').check();
    await a.locator('[name="syntheticOnly"]').check();
    await a
      .getByRole("button", { name: "Ajouter la décision", exact: true })
      .click();
    await expect(
      a.getByRole("heading", {
        name: "Révision 3 — Replanification manuelle",
        exact: true,
      }),
    ).toBeVisible();
    await plan(otherVisit, futureSlot(15, "11"));

    await screen(b, newRecord, "Vaccination");
    await vaccineFields(b, placeB, "VPO", lot);
    await b
      .locator('[name="matching_status"]')
      .selectOption("clinician_validated");
    await b.locator('[name="schedule_item_id"]').selectOption(item);
    await b
      .getByRole("button", {
        name: "Contrôler les doublons possibles",
        exact: true,
      })
      .click();
    await expect(b.getByRole("status")).toContainText(
      "Aucun doublon potentiel",
    );
    await expect(b.locator('[name="lot_number"]')).toHaveValue(lot);
    await b
      .getByRole("button", { name: "Enregistrer le soin", exact: true })
      .click();
    await expect(b).toHaveURL(/\/records\/[a-f0-9-]{36}$/i);
    const rootPath = new URL(b.url()).pathname;
    await a.goto(vaccinePath);
    await expect(
      a.getByText("Administration documentée et rapprochée", { exact: true }),
    ).toBeVisible();
    await expect(
      a.getByRole("link", { name: new RegExp(platformB) }),
    ).toBeVisible();
    await a.goto("/follow-up?bucket=resolved_by_other");
    await expect(
      a.getByRole("heading", { name: vaccineVisit, exact: true }),
    ).toBeVisible();
    await a.goto("/follow-up?bucket=upcoming");
    await expect(
      a.getByRole("heading", { name: otherVisit, exact: true }),
    ).toBeVisible();
    await expect(
      a.getByRole("heading", { name: vaccineVisit, exact: true }),
    ).toHaveCount(0);

    await a.goto(newRecord);
    await vaccineFields(a, placeA, "VPO", lot);
    await a
      .getByRole("button", { name: "Enregistrer le soin", exact: true })
      .click();
    await expect(a.getByRole("main").getByRole("alert")).toContainText(
      "potentiellement en doublon",
    );
    await expect(
      a.getByRole("region", { name: "Doublons possibles", exact: true }),
    ).toContainText(platformB);
    await expect(a.locator('[name="lot_number"]')).toHaveValue(lot);
    await a.locator('[name="duplicate_override_reason"]').fill(override);
    await a
      .getByRole("button", { name: "Enregistrer le soin", exact: true })
      .click();
    await expect(a).toHaveURL(/\/records\/[a-f0-9-]{36}$/i);
    await expect(a.locator(".clinical-entry")).toContainText(override);
    const stale = await b.context().newPage();
    observeBrowserErrors(stale, "vaccine-stale", () => pageErrors++);
    await stale.goto(rootPath);
    await b.goto(rootPath);
    await clinicalFields(b, placeB);
    await b.locator('[name="matching_status"]').selectOption("unmatched");
    await b.locator('[name="schedule_item_id"]').selectOption("");
    await b.locator('[name="duplicate_override_reason"]').fill(override);
    await b.locator('[name="amendment_reason"]').fill(correction);
    await b
      .getByRole("button", { name: "Ajouter la révision", exact: true })
      .click();
    await expect(b.locator(".clinical-entry")).toHaveCount(2);
    await clinicalFields(stale, placeB);
    await stale.locator('[name="amendment_reason"]').fill(correction);
    await stale
      .getByRole("button", { name: "Ajouter la révision", exact: true })
      .click();
    await expect(stale.getByRole("main").getByRole("alert")).toContainText(
      "Une autre correction a été enregistrée",
    );
    await stale.close();
    await a.goto(vaccinePath);
    await expect(
      a.getByText("Administration non confirmée", { exact: true }),
    ).toBeVisible();
    await a.goto("/follow-up?bucket=resolved_by_other");
    await expect(
      a.getByRole("heading", { name: vaccineVisit, exact: true }),
    ).toHaveCount(0);
    await a.goto("/follow-up?bucket=upcoming");
    await expect(
      a.getByRole("heading", { name: vaccineVisit, exact: true }),
    ).toBeVisible();
    await expect(
      a.getByRole("heading", { name: otherVisit, exact: true }),
    ).toBeVisible();
    await clinicalFields(b, placeB);
    await b.locator('[name="entry_state"]').selectOption("withdrawn");
    await b
      .locator('[name="notes"]')
      .fill("Modification fictive à ignorer lors du retrait.");
    await b
      .locator('[name="amendment_reason"]')
      .fill("Retrait fictif conservant les données et leur provenance.");
    await b
      .getByRole("button", { name: "Ajouter la révision", exact: true })
      .click();
    await expect(b.locator(".clinical-entry")).toHaveCount(3);
    await fit(b);

    for (const state of ["withdrawn", "active"]) {
      await a.goto(itemPath!);
      await a
        .locator('[name="facility_id"]')
        .selectOption({ label: `${placeA} — Rabat fictif` });
      await a.locator('textarea[name="reason"]').fill(basis);
      if (state === "active")
        await a.locator('[name="eligibility_checked"]').check();
      await a.locator('[name="syntheticOnly"]').check();
      await a
        .getByRole("button", {
          name:
            state === "active"
              ? "Réactiver avec historique"
              : "Retirer avec historique",
          exact: true,
        })
        .click();
      await expect(
        a.getByRole("heading", {
          name:
            state === "active" ? "Version 3 — Active" : "Version 2 — Retirée",
          exact: true,
        }),
      ).toBeVisible();
    }
    await manager.goto(versionPath);
    const retire = await catalogBasis(manager, "retire");
    await retire
      .getByRole("button", { name: "Retirer cette version", exact: true })
      .click();
    await expect(
      manager.getByText("Retirée · révision 5", { exact: true }),
    ).toBeVisible();
    await a.goto(`${vaccinePath}?version=${version}`);
    await expect(
      a.getByRole("button", { name: "Assigner la référence", exact: true }),
    ).toHaveCount(0);
    await expect(
      a.getByText(
        "Cette version n’est plus activable. Choisissez une version approuvée.",
        { exact: true },
      ),
    ).toBeVisible();
    await manager.goto(seedPath);
    await expect(
      manager.getByText("Brouillon — non activé · révision 1", { exact: true }),
    ).toBeVisible();
    const response = await get(a.context(), `/patients/${child}/export`);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"].includes("no-store")).toBe(true);
    const ledger = await response.json();
    const entries = ledger.clinical_entries as ClinicalEntry[];
    expect(
      ledger.format === "mon-enfant-clinical-ledger-v3" && entries.length === 5,
    ).toBe(true);
    const historical = entries.find((e) => e.payload.vaccine_code === "BCG")!;
    expect(
      Boolean(
        historical &&
        historical.occurred_on === null &&
        !historical.source_verified &&
        historical.source_reference === paper &&
        !historical.vaccine_mapping,
      ),
    ).toBe(true);
    const revisions = entries
      .filter((e) => e.professional_id === platformB)
      .sort((x, y) => x.revision - y.revision);
    expect(revisions.length).toBe(3);
    expect(
      revisions[0].vaccine_mapping?.version_id === version &&
        revisions[0].vaccine_mapping?.item_id === item &&
        !revisions[1].vaccine_mapping &&
        revisions[2].entry_state === "withdrawn",
    ).toBe(true);
    expect(
      JSON.stringify(revisions[1].payload) ===
        JSON.stringify(revisions[2].payload),
    ).toBe(true);
    expect(
      entries.some(
        (e) =>
          e.professional_id === platformA &&
          e.duplicate_review?.reason === override &&
          e.duplicate_review.conflicting_entry_ids.includes(revisions[0].id),
      ),
    ).toBe(true);
    const intended = ledger.vaccine_items_including_all_decisions;
    expect(
      intended.length === 1 &&
        intended[0].version_id === version &&
        intended[0].version_status === "retired",
    ).toBe(true);
    expect(
      intended[0].changes.map((c: { state: string }) => c.state).join(",") ===
        "active,withdrawn,active",
    ).toBe(true);
    const appointments = ledger.appointments_including_all_events;
    expect(appointments.length).toBe(2);
    const linked = appointments.find(
      (p: { purpose: string }) => p.purpose === "vaccination",
    );
    expect(
      linked.events.map((e: { state: string }) => e.state).join(",") ===
        "scheduled,missed,scheduled",
    ).toBe(true);
    expect(
      linked.events[2].previous_starts_at === linked.events[0].starts_at &&
        linked.events[2].professional_id === platformA,
    ).toBe(true);
    expect(
      appointments.every((p: { state: string }) => p.state === "scheduled"),
    ).toBe(true);
    await screen(a, `/patients/${child}/summary`, childName);
    await expect(a.locator(".clinical-entry")).toHaveCount(5);
    for (const denied of [outside, manager]) {
      const blocked = await get(denied.context(), `/patients/${child}/export`);
      expect(
        blocked.status() === 404 ||
          new URL(blocked.url()).pathname === "/account",
      ).toBe(true);
      expect((await blocked.text()).includes(paper)).toBe(false);
    }
    await permission(manager, platformB, "vaccination", false);
    await b.goto(rootPath);
    await expect(
      b.getByRole("button", { name: "Ajouter la révision", exact: true }),
    ).toHaveCount(0);
    await a.goto(`/patients/${child}`);
    const grant = a.locator("article").filter({ hasText: platformB });
    await grant
      .locator('textarea[name="reason"]')
      .fill("Fin de continuité fictive, révocation immédiate de cet accès.");
    await grant
      .getByRole("button", { name: "Révoquer cet accès", exact: true })
      .click();
    await expect(grant.getByText(/^Accès révoqué/)).toBeVisible();
    expect((await get(b.context(), `/patients/${child}/export`)).status()).toBe(
      404,
    );
    await a.goto("/account");
    await a
      .getByRole("button", { name: "Se déconnecter", exact: true })
      .click();
    await a.goto(vaccinePath);
    await expect(a).toHaveURL(/\/login$/);
    expect(pageErrors).toBe(0);
    const proof = {
      mode: "vaccination_acceptance",
      viewport,
      catalog_rules: 25,
      catalog_decisions: 5,
      original_source_stays_draft: true,
      hb1_activation_denied: true,
      hb1_assignment_absent: true,
      independent_qa_review: true,
      uncertain_paper_retained: true,
      duplicate_review_retained_inputs: true,
      duplicate_override_audited: true,
      stale_correction_denied: true,
      shared_completion_and_reopening: true,
      unrelated_consultation_preserved: true,
      missed_slot_and_manual_replacement_retained: true,
      clinical_revisions: 5,
      item_decisions: 3,
      appointment_events: 4,
      private_export_and_revocation: true,
      page_errors: pageErrors,
      clinical_approval_claimed: false,
      timings,
    };
    writeFileSync(
      info.outputPath("vaccination-proof.json"),
      JSON.stringify(proof),
    );
    console.log(JSON.stringify(proof));
  } catch (error) {
    // Classify known UI failures in memory; never emit message bodies or DOM.
    const classes: Record<string, string> = {
      offset_mismatch: "Le décalage choisi ne correspond pas",
      duplicate_review: "potentiellement en doublon",
      revision_conflict: "Une autre correction a été enregistrée",
      appointment_conflict: "Une autre décision a été enregistrée",
      catalog_conflict: "Cette version a changé",
      catalog_permission: "Cette action exige une permission actuelle",
      catalog_validation: "HB1 reste désactivé",
      clinical_validation: "Vérifiez les champs requis",
      appointment_validation: "Vérifiez le motif, l’attestation",
    };
    for (const target of observedPages) {
      try {
        if (target.page.isClosed()) continue;
        const messages = await target.page
          .getByRole("main")
          .locator('[role="alert"]')
          .allTextContents();
        if (messages.length) {
          const matched = Object.entries(classes)
            .filter(([, text]) =>
              messages.some((message) => message.includes(text)),
            )
            .map(([code]) => code);
          console.log(
            JSON.stringify({
              event: "vaccination_form_diagnostic",
              viewport,
              role: target.role,
              error_classes: matched.length
                ? matched
                : ["unclassified_form_error"],
            }),
          );
        }
      } catch {
        /* Preserve the original test failure. */
      }
    }
    throw error;
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});
