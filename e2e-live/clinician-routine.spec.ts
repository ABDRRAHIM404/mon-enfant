import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { observeBrowserErrors } from "./browser-errors";
const run = process.env.MON_ENFANT_QA_RUN!;
const seed = process.env.MON_ENFANT_QA_VACCINE_SEED!;
const child = "37bea915-aaf1-40f8-9145-c18f03c8dc0e";
const patient = `/patients/${child}`;
const label = `QA navigateur vaccinal ${run} stabilisation`;
const basis =
  "Vérification QA entièrement fictive, sans approbation clinique réelle.";
const placeA = `Centre fictif U5 ${run} desktop — Rabat fictif`;
const placeB = `Centre fictif continuité U5 ${run} — Rabat fictif`;
const vaccineVisit = `Suivi vaccinal fictif U5-${run}`;
const independentVisit = `Consultation indépendante fictive U5-${run}`;
const doseSource = `Administration entièrement fictive U5-${run} par B`;
const lot = `QA-LOT-U5-${run}`;
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    writeFileSync(
      info.outputPath("routine-failure.json"),
      JSON.stringify({
        route: new URL(page.url()).pathname,
        status: info.status,
      }),
    );
    await page
      .screenshot({
        path: info.outputPath("routine-failure.png"),
        scale: "css",
        timeout: 10000,
      })
      .catch(() => undefined);
  }
});
async function login(page: Page, role: "A" | "B" | "MANAGER") {
  expect(run).toBe("5d4ec565b0864dce");
  expect(seed).toMatch(/^[a-f0-9-]{36}$/);
  const prefix = `MON_ENFANT_CLINICAL_BROWSER_${role}_`;
  expect(process.env[prefix + "EMAIL"]).toBe(
    `qa-cbrowser-${run}-${role.toLowerCase()}@example.invalid`,
  );
  await page.goto("/login?audience=clinician");
  await page.locator('[name="email"]').fill(process.env[prefix + "EMAIL"]!);
  await page
    .locator('[name="password"]')
    .fill(process.env[prefix + "PASSWORD"]!);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/(account|dashboard)$/);
}
async function logout(page: Page) {
  await page.goto("/account");
  await page
    .getByRole("button", { name: "Se déconnecter", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login/);
}
function receipt(info: TestInfo, name: string, data: object) {
  writeFileSync(
    info.outputPath(`${name}.json`),
    JSON.stringify(
      {
        run,
        child,
        qa_only: true,
        genuine_clinical_approval_claimed: false,
        ...data,
      },
      null,
      2,
    ),
  );
}
async function findCatalog(page: Page, name: string) {
  for (let n = 1; n <= 30; n++) {
    await page.goto(`/vaccines?page=${n}`);
    const entry = page.getByRole("link", { name, exact: true });
    if (await entry.count()) return (await entry.getAttribute("href"))!;
    if (
      !(await page
        .getByRole("link", { name: "Page suivante", exact: true })
        .count())
    )
      return null;
  }
  throw new Error("QA catalog not found within its bounded pagination");
}
function catalogForm(page: Page, action: string) {
  return page
    .locator("form")
    .filter({ has: page.locator(`input[name="action"][value="${action}"]`) });
}
async function evidence(page: Page, action: string) {
  const form = catalogForm(page, action);
  await form.locator('[name="evidence_reference"]').fill(basis);
  await form.locator('textarea[name="reason"]').fill(basis);
  return form;
}
async function plan(page: Page, name: string, day: string, item = "") {
  await page.goto(`${patient}/appointments`);
  const existing = page.locator("main article.panel").filter({ hasText: name });
  expect(await existing.count()).toBeLessThanOrEqual(1);
  if (await existing.count())
    return (await existing
      .getByRole("link", {
        name: "Historique et décision / replanifier",
        exact: true,
      })
      .getAttribute("href"))!;
  await page.goto(`${patient}/appointments/new${item ? `?item=${item}` : ""}`);
  const form = page.locator("main form.auth-form");
  await form.locator('[name="facility_id"]').selectOption({ label: placeA });
  await form
    .locator('[name="purpose"]')
    .selectOption(item ? "vaccination" : "consultation");
  if (item) await form.locator('[name="vaccine_item_id"]').selectOption(item);
  await form.locator('[name="purpose_label"]').fill(name);
  await form.locator('[name="starts_local"]').fill(`${day}T10:00`);
  await form.locator('[name="ends_local"]').fill(`${day}T10:30`);
  await form.locator('[name="starts_offset"]').selectOption("auto");
  await form.locator('[name="ends_offset"]').selectOption("auto");
  await form.locator('[name="reason"]').fill(basis);
  await form.locator('[name="reviewed"]').check();
  await form.locator('[name="syntheticOnly"]').check();
  await form
    .getByRole("button", { name: "Planifier le rendez-vous", exact: true })
    .click();
  await expect(page).toHaveURL(/\/appointments\/[a-f0-9-]{36}$/);
  return new URL(page.url()).pathname;
}
test("QA clone independent review, permitted routine reference and manually chosen appointments", async ({
  page,
}, info) => {
  test.setTimeout(300000);
  let errors = 0;
  observeBrowserErrors(page, "routine-source", () => errors++);
  await login(page, "MANAGER");
  let versionPath = await findCatalog(page, label);
  if (!versionPath) {
    await page.goto(`/vaccines/${seed}`);
    await expect(
      page.getByText("Brouillon — non activé · révision 1", { exact: true }),
    ).toBeVisible();
    const clone = await evidence(page, "clone");
    await clone.locator('[name="label"]').fill(label);
    await clone
      .getByRole("button", { name: "Créer le brouillon", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
    versionPath = new URL(page.url()).pathname;
  }
  expect(versionPath).not.toBe(`/vaccines/${seed}`);
  await page.goto(versionPath);
  const rules = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Règles de cette version",
      exact: true,
    }),
  });
  await expect(rules.locator(".record-list > article")).toHaveCount(25);
  await page.goto(
    `/admin/clinical-permissions?q=${encodeURIComponent(`QAB-${run}-B`)}`,
  );
  if (
    !(await page.locator(".record-list").first().innerText()).includes(
      "vaccination : accordée",
    )
  ) {
    await page.locator('[name="capability"]').selectOption("vaccination");
    await page.locator('[name="decision"]').selectOption("enable");
    await page.locator('[name="evidence_reference"]').fill(basis);
    await page.getByLabel("Motif historisé", { exact: true }).fill(basis);
    await page.locator('[name="verified"]').check();
    await page
      .getByRole("button", { name: "Enregistrer l’habilitation" })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Habilitation historisée" }),
    ).toBeVisible();
  }
  await logout(page);
  await login(page, "A");
  await page.goto(versionPath);
  if (await catalogForm(page, "approve").count()) {
    const approval = await evidence(page, "approve");
    for (const key of [
      "source_authenticated",
      "clinical_reviewed",
      "birth_window_reviewed",
    ])
      await approval.locator(`[name="${key}"]`).check();
    await approval
      .getByRole("button", { name: "Approuver cette version", exact: true })
      .click();
  }
  await expect(
    page.getByText("Approuvée · révision 2", { exact: true }),
  ).toBeVisible();
  const version = versionPath.split("/").at(-1)!;
  await page.goto(`${patient}/vaccinations?version=${version}`);
  await expect(
    page.locator('[name="dose_code"] option[value="HB1"]'),
  ).toHaveCount(0);
  const itemLinks = page.getByRole("link", {
    name: "Décisions et historique de la référence",
    exact: true,
  });
  expect(await itemLinks.count()).toBeLessThanOrEqual(1);
  if (!(await itemLinks.count())) {
    await page.locator('[name="dose_code"]').selectOption("VPO1");
    await page.locator('[name="facility_id"]').selectOption({ label: placeA });
    await page.locator('textarea[name="reason"]').fill(basis);
    await page.locator('[name="eligibility_checked"]').check();
    await page.locator('[name="syntheticOnly"]').check();
    await page
      .getByRole("button", { name: "Assigner la référence", exact: true })
      .click();
    await expect(
      page.getByText("Administration non confirmée", { exact: true }),
    ).toBeVisible();
  }
  const itemPath = (await itemLinks.getAttribute("href"))!;
  const item = itemPath.split("/").at(-1)!;
  expect(item).toMatch(/^[a-f0-9-]{36}$/);
  const vaccinePath = await plan(page, vaccineVisit, "2026-12-08", item);
  const otherPath = await plan(page, independentVisit, "2026-12-09");
  await page.goto(`/vaccinations?child=${child}`);
  await expect(page.getByRole("main")).toContainText("HB1");
  await expect(page.getByRole("main")).toContainText("VPO1");
  await page.reload();
  await expect(page.getByRole("main")).toContainText(
    "Administration non confirmée",
  );
  await page.screenshot({
    path: info.outputPath("reviewed-reference-before-administration.png"),
    scale: "css",
    timeout: 10000,
  });
  await logout(page);
  expect(errors).toBe(0);
  receipt(info, "routine-reference", {
    seed,
    version,
    versionPath,
    item,
    itemPath,
    vaccinePath,
    otherPath,
    independent_reviewer: true,
    source_rules: 25,
    hb1_not_assignable: true,
    manually_chosen_slots: true,
    independent_database_readback: "pending",
  });
});
test("explicit second-clinician access and documented dose update only the linked vaccine follow-up", async ({
  page,
}, info) => {
  test.setTimeout(480000);
  let errors = 0;
  observeBrowserErrors(page, "routine-continuity", () => errors++);
  await login(page, "A");
  await page.goto(patient);
  const childName = await page.getByRole("heading", { level: 1 }).innerText();
  expect(childName).toContain(run);
  const universal = (
    await page
      .locator("dt")
      .filter({ hasText: "Identifiant universel" })
      .locator("xpath=following-sibling::dd[1]")
      .innerText()
  ).trim();
  await page.goto(`${patient}/vaccinations`);
  const itemPath = (await page
    .getByRole("link", {
      name: "Décisions et historique de la référence",
      exact: true,
    })
    .getAttribute("href"))!;
  const item = itemPath.split("/").at(-1)!;
  await page.goto(`${patient}/appointments`);
  const vaccinePath = (await page
    .locator("main article.panel")
    .filter({ hasText: vaccineVisit })
    .getByRole("link", {
      name: "Historique et décision / replanifier",
      exact: true,
    })
    .getAttribute("href"))!;
  const otherPath = (await page
    .locator("main article.panel")
    .filter({ hasText: independentVisit })
    .getByRole("link", {
      name: "Historique et décision / replanifier",
      exact: true,
    })
    .getAttribute("href"))!;
  await logout(page);
  await login(page, "B");
  await page.goto("/practices");
  if (
    !(await page
      .locator("li")
      .filter({ hasText: `Centre fictif continuité U5 ${run}` })
      .count())
  ) {
    await page
      .getByLabel("Nom du lieu d’exercice", { exact: true })
      .fill(`Centre fictif continuité U5 ${run}`);
    await page.getByLabel("Ville", { exact: true }).fill("Rabat fictif");
    await page
      .getByRole("button", { name: "Déclarer ce lieu", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Opération enregistrée" }),
    ).toBeVisible();
  }
  await page.goto(patient);
  const alreadyAuthorized = (await page.getByRole("main").innerText()).includes(
    childName,
  );
  let explicitAccessExercised = false;
  if (!alreadyAuthorized) {
    await expect(page.locator(".clinical-entry")).toHaveCount(0);
    await page.goto("/access-requests");
    const pending = page
      .locator("article")
      .filter({ hasText: universal })
      .filter({
        has: page.getByRole("button", {
          name: "Retirer cette demande",
          exact: true,
        }),
      });
    if (!(await pending.count())) {
      await page.goto("/patients/link");
      await page.locator('[name="universal_id"]').fill(universal);
      await page
        .locator('[name="facility_id"]')
        .selectOption({ label: placeB });
      await page.locator('[name="register_year"]').fill("2026");
      await page.locator('[name="register_book"]').fill("U5-REF");
      await page.locator('[name="local_number"]').fill("078");
      await page.locator('[name="reason"]').fill(basis);
      await page
        .getByRole("button", {
          name: "Envoyer la demande d’accès",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: "Opération enregistrée" }),
      ).toBeVisible();
    }
    await page.goto("/access-requests");
    await expect(page.getByRole("main")).not.toContainText(childName);
    await logout(page);
    await login(page, "A");
    await page.goto("/access-requests");
    const request = page
      .locator("article")
      .filter({
        has: page.getByRole("heading", { name: childName, exact: true }),
      })
      .filter({ hasText: `QAB-${run}-B` });
    await expect(request).toHaveCount(1);
    await request.locator('[name="decision"]').selectOption("approve");
    await request.locator('[name="authorizationChecked"]').check();
    await request.locator('[name="reason"]').fill(basis);
    await request
      .getByRole("button", { name: "Enregistrer la décision", exact: true })
      .click();
    await expect(request).toHaveCount(0);
    explicitAccessExercised = true;
    await logout(page);
    await login(page, "B");
  }
  await page.goto(patient);
  await expect(page.getByRole("main")).toContainText(childName);
  await expect(page.getByRole("main")).toContainText(universal);
  await page.goto(`/vaccinations?child=${child}`);
  const prior = page.locator(".clinical-entry").filter({ hasText: doseSource });
  let rootPath: string;
  if (await prior.count())
    rootPath = (await prior
      .getByRole("link", { name: "Historique et correction", exact: true })
      .getAttribute("href"))!;
  else {
    await page
      .getByRole("link", { name: "Enregistrer une vaccination", exact: true })
      .click();
    const form = page.locator("main form.auth-form");
    await form.locator('[name="facility_id"]').selectOption({ label: placeB });
    await form.locator('[name="occurred_on"]').fill("2026-11-16");
    await form.locator('[name="source_type"]').selectOption("observed");
    await form.locator('[name="source_reference"]').fill(doseSource);
    await form.locator('[name="source_verified"]').check();
    await form.getByRole("combobox", { name: /^Vaccin/ }).fill("VPO");
    await page
      .getByRole("listbox")
      .getByRole("option")
      .filter({ hasText: label })
      .click();
    await form.getByRole("combobox", { name: /^Dose déclarée/ }).fill("VPO1");
    await page
      .getByRole("listbox")
      .getByRole("option", { name: /VPO1/ })
      .first()
      .click();
    for (const [status, field, value] of [
      ["lot_status", "lot_number", lot],
      ["site_status", "site", "Site fictif non clinique"],
      ["provider_status", "administered_by", "Soignant entièrement fictif B"],
      [
        "administration_facility_status",
        "administration_facility",
        "Centre entièrement fictif B",
      ],
    ]) {
      await form.locator(`[name="${status}"]`).selectOption("known");
      await form.locator(`[name="${field}"]`).fill(value);
    }
    await form
      .locator('[name="matching_status"]')
      .selectOption("clinician_validated");
    await form.locator('[name="schedule_item_id"]').selectOption(item);
    await form.locator('[name="syntheticOnly"]').check();
    await form
      .getByRole("button", {
        name: "Contrôler les doublons possibles",
        exact: true,
      })
      .click();
    await expect(form.getByRole("status")).toContainText(
      "Aucun doublon potentiel",
    );
    await expect(form.locator('[name="lot_number"]')).toHaveValue(lot);
    await form
      .getByRole("button", { name: "Enregistrer le soin", exact: true })
      .click();
    await expect(page).toHaveURL(/\/records\/[a-f0-9-]{36}$/);
    rootPath = new URL(page.url()).pathname;
  }
  await page.goto(rootPath);
  await page.reload();
  await expect(page.locator(".clinical-entry")).toContainText(`QAB-${run}-B`);
  await logout(page);
  await login(page, "A");
  await page.goto(`/vaccinations?child=${child}`);
  await page.reload();
  await expect(page.locator(".clinical-entry")).toHaveCount(2);
  await expect(page.getByRole("main")).toContainText(
    "Administration documentée et rapprochée",
  );
  await expect(
    page.locator(".clinical-entry").filter({ hasText: doseSource }),
  ).toContainText(`QAB-${run}-B`);
  await page.screenshot({
    path: info.outputPath("cross-clinician-recorded-history.png"),
    scale: "css",
    timeout: 10000,
  });
  await page.goto(vaccinePath);
  await expect(page.locator("main article.panel").first()).toContainText(
    "Dose documentée — suivi vaccinal résolu",
  );
  await page.goto(otherPath);
  await expect(page.locator("main article.panel").first()).toContainText(
    "Planifié",
  );
  await expect(
    page.getByRole("heading", {
      name: "Révision 1 — Planification",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/follow-up?bucket=resolved_by_other");
  await expect(
    page.getByRole("heading", { name: vaccineVisit, exact: true }),
  ).toBeVisible();
  await logout(page);
  expect(errors).toBe(0);
  receipt(info, "routine-continuity", {
    rootPath,
    item,
    vaccinePath,
    otherPath,
    explicit_access_exercised_this_run: explicitAccessExercised,
    same_child_universal_id: true,
    second_author: `QAB-${run}-B`,
    hb1_still_separate: true,
    linked_followup_resolved_without_attendance_claim: true,
    independent_visit_still_scheduled: true,
    independent_database_readback: "pending",
  });
});
test("revoked grant blocks the same live clinical session while preserving recorded authorship", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180000);
  const options = {
    baseURL: "https://mon-enfant.vercel.app",
    viewport: page.viewportSize() ?? undefined,
    ...(process.env.MON_ENFANT_QA_PROXY
      ? { proxy: { server: process.env.MON_ENFANT_QA_PROXY } }
      : {}),
  };
  const original = await browser.newContext(options);
  let restored: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  try {
    const reader = await original.newPage();
    await login(reader, "B");
    await reader.goto(`/vaccinations?child=${child}`);
    await expect(
      reader.locator(".clinical-entry").filter({ hasText: doseSource }),
    ).toHaveCount(1);
    // Keep this session live on the server; hold its state only in process memory.
    const state = await original.storageState();
    await original.close();
    await login(page, "A");
    await page.goto(patient);
    const grants = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", {
          name: "Autorisations du dossier",
          exact: true,
        }),
      });
    const grant = grants.locator("article").filter({ hasText: `QAB-${run}-B` });
    await grant
      .locator('[name="reason"]')
      .fill(
        "Fin de continuité entièrement fictive, révocation explicite pour test.",
      );
    await grant
      .getByRole("button", { name: "Révoquer cet accès", exact: true })
      .click();
    await expect(grant).toContainText("Accès révoqué");
    try {
      restored = await browser.newContext({ ...options, storageState: state });
    } catch {
      throw new Error(
        "Synthetic session restore failed; cookie details withheld.",
      );
    }
    const revoked = await restored.newPage();
    await revoked.goto("/account");
    await expect(revoked).toHaveURL(/\/account$/);
    await expect(revoked.getByRole("main")).toContainText("Vérifié");
    await revoked.goto(`/vaccinations?child=${child}`);
    await expect(revoked.getByRole("main")).toContainText(
      "Dossier indisponible",
    );
    await expect(revoked.locator(".clinical-entry")).toHaveCount(0);
    await revoked.goto(`/patients?q=${run}`);
    await expect(revoked.locator(`main a[href="${patient}"]`)).toHaveCount(0);
    await logout(revoked);
    await restored.close();
    restored = undefined;
    await page.goto(`/vaccinations?child=${child}`);
    await expect(
      page.locator(".clinical-entry").filter({ hasText: doseSource }),
    ).toContainText(`QAB-${run}-B`);
    await logout(page);
    receipt(info, "routine-revocation", {
      original_live_session_restored: true,
      account_still_verified: true,
      patient_and_registry_denied: true,
      recorded_authorship_retained: true,
      authentication_state_persisted_to_file: false,
    });
  } finally {
    await restored?.close();
    await original.close();
  }
});
