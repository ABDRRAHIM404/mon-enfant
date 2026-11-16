import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { observeBrowserErrors } from "./browser-errors";
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    writeFileSync(
      info.outputPath("trusted-care-failure.json"),
      JSON.stringify({
        route: new URL(page.url()).pathname,
        status: info.status,
      }),
    );
    await page
      .screenshot({
        path: info.outputPath("trusted-care-failure.png"),
        scale: "css",
        timeout: 10000,
      })
      .catch(() => undefined);
  }
});
const run = process.env.MON_ENFANT_QA_RUN!;
const child = "37bea915-aaf1-40f8-9145-c18f03c8dc0e";
const childPath = `/patients/${child}`;
const place = `Centre fictif U5 ${run} desktop — Rabat fictif`;
const marker = (kind: string) => `Source fictive U5-${run} clinique ${kind}`;
async function login(page: Page, role: "A" | "B" | "MANAGER") {
  expect(run).toBe("5d4ec565b0864dce");
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
function save(info: TestInfo, name: string, details: object) {
  writeFileSync(
    info.outputPath(`${name}.json`),
    JSON.stringify({ run, child, ...details }, null, 2),
  );
}
async function grantCapabilities(page: Page) {
  await login(page, "MANAGER");
  for (const capability of ["consultation", "growth", "appointment"]) {
    await page.goto(
      `/admin/clinical-permissions?q=${encodeURIComponent(`QAB-${run}-A`)}`,
    );
    const current = await page.locator(".record-list").first().innerText();
    if (current.includes(`${capability} : accordée`)) continue;
    await page.locator('[name="capability"]').selectOption(capability);
    await page.locator('[name="decision"]').selectOption("enable");
    await page
      .locator('[name="evidence_reference"]')
      .fill(
        "Habilitation entièrement fictive pour validation logicielle Update 5.",
      );
    await page
      .getByLabel("Motif historisé", { exact: true })
      .fill(
        "Test logiciel fictif, aucune qualification clinique réelle attestée.",
      );
    await page.locator('[name="verified"]').check();
    await page
      .getByRole("button", { name: "Enregistrer l’habilitation" })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Habilitation historisée" }),
    ).toBeVisible();
  }
  await logout(page);
}
async function fillClinical(
  page: Page,
  kind: string,
  fields: Record<string, string>,
) {
  const form = page.locator("main form.auth-form");
  await form.locator('[name="facility_id"]').selectOption({ label: place });
  await form
    .locator('[name="occurred_on"]')
    .fill(kind === "growth" ? "2026-11-02" : "2026-11-01");
  await form.locator('[name="source_type"]').selectOption("observed");
  await form.locator('[name="source_reference"]').fill(marker(kind));
  for (const [key, value] of Object.entries(fields))
    await form.locator(`[name="${key}"]`).fill(value);
  await form.locator('[name="syntheticOnly"]').check();
  return form;
}
async function clinicalCase(
  page: Page,
  section: "consultations" | "growth",
  kind: string,
  fields: Record<string, string>,
) {
  await page.goto(`${childPath}`);
  await expect(page.getByRole("main")).toContainText(run);
  await page.goto(`/${section}?child=${child}`);
  const card = page
    .locator(".clinical-entry")
    .filter({ hasText: marker(kind) });
  expect(await card.count()).toBeLessThanOrEqual(1);
  let path: string;
  if (await card.count()) {
    path = (await card
      .getByRole("link", { name: "Historique et correction", exact: true })
      .getAttribute("href"))!;
    await page.goto(path);
  } else {
    await page
      .getByRole("link", {
        name:
          section === "growth" ? "Nouvelle mesure" : "Nouvelle consultation",
        exact: true,
      })
      .click();
    const form = await fillClinical(page, kind, fields);
    await form
      .getByRole("button", { name: "Enregistrer le soin", exact: true })
      .click();
    await expect(page).toHaveURL(/\/records\/[a-f0-9-]{36}$/);
    path = new URL(page.url()).pathname;
  }
  await page.reload();
  await expect(
    page.locator(".clinical-entry").filter({ hasText: marker(kind) }),
  ).not.toHaveCount(0);
  return path;
}
test("authorized consultation, immutable correction, dashboard and other-clinician denial", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  let errors = 0;
  observeBrowserErrors(page, "clinician-care-consultation", () => errors++);
  await grantCapabilities(page);
  await login(page, "A");
  const initial = `Motif original fictif U5-${run}`;
  const corrected = `Motif corrigé fictif U5-${run}`;
  const path = await clinicalCase(page, "consultations", "consultation", {
    reason: initial,
    findings:
      "Observation entièrement fictive, sans diagnostic ni conduite thérapeutique.",
  });
  const form = page.locator("main form.auth-form");
  if ((await form.locator('[name="reason"]').inputValue()) !== corrected) {
    await form.locator('[name="reason"]').fill(corrected);
    await form
      .locator('[name="amendment_reason"]')
      .fill(
        "Correction entièrement fictive avec original et attribution conservés.",
      );
    await form.locator('[name="syntheticOnly"]').check();
    await form
      .getByRole("button", { name: "Ajouter la révision", exact: true })
      .click();
  }
  await expect(page.getByRole("main")).toContainText("Dernière version : 2");
  await page.reload();
  await expect(page.locator(".clinical-entry")).toHaveCount(2);
  await expect(page.locator(".clinical-entry").first()).toContainText(initial);
  await expect(page.locator(".clinical-entry").last()).toContainText(corrected);
  await page
    .locator("header.workspace-header")
    .getByRole("link", { name: "Tableau de bord", exact: true })
    .click();
  const recent = page.locator(".soignant-recent-list");
  await expect(recent).toContainText(corrected);
  await recent.locator(`a[href="${path}"]`).click();
  await expect(page.locator(".clinical-entry")).toHaveCount(2);
  await logout(page);
  await login(page, "A");
  await page.goto(`/consultations?child=${child}`);
  await expect(
    page.locator(".clinical-entry").filter({ hasText: marker("consultation") }),
  ).toHaveCount(1);
  await expect(page.locator(".clinical-entry")).toContainText(corrected);
  await page.screenshot({
    path: info.outputPath("trusted-consultation.png"),
    scale: "css",
    timeout: 10000,
  });
  await logout(page);
  await login(page, "B");
  await page.goto(`/consultations?child=${child}`);
  await expect(page.getByRole("main")).toContainText("Dossier indisponible");
  await expect(page.locator(".clinical-entry")).toHaveCount(0);
  await page.goto(`/patients?q=${run}`);
  await expect(page.locator(`main a[href="${childPath}"]`)).toHaveCount(0);
  await page.goto("/dashboard");
  await expect(page.locator(".soignant-recent-list")).not.toContainText(
    corrected,
  );
  await logout(page);
  expect(errors).toBe(0);
  save(info, "trusted-consultation", {
    path,
    source_reference: marker("consultation"),
    latest_revision: 2,
    original_and_correction_retained: true,
    dashboard_recent_link: true,
    fresh_session: true,
    other_clinician_denied: true,
  });
});
test("authorized raw growth measure and correction persist without diagnostic inference", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  let errors = 0;
  observeBrowserErrors(page, "clinician-care-growth", () => errors++);
  await login(page, "A");
  const path = await clinicalCase(page, "growth", "growth", {
    weight_kg: "12.7",
    height_cm: "89",
  });
  const form = page.locator("main form.auth-form");
  if ((await form.locator('[name="height_cm"]').inputValue()) !== "89.5") {
    await form.locator('[name="height_cm"]').fill("89.5");
    await form
      .locator('[name="amendment_reason"]')
      .fill("Correction technique fictive de la mesure, original conservé.");
    await form.locator('[name="syntheticOnly"]').check();
    await form
      .getByRole("button", { name: "Ajouter la révision", exact: true })
      .click();
  }
  await expect(page.getByRole("main")).toContainText("Dernière version : 2");
  await page.reload();
  await expect(page.locator(".clinical-entry")).toHaveCount(2);
  await logout(page);
  await login(page, "A");
  await page.goto(`/growth?child=${child}`);
  await expect(
    page.locator('svg[aria-labelledby="chart-height_cm"] circle title'),
  ).toContainText("89.5 cm");
  await expect(
    page.locator('svg[aria-labelledby="chart-weight_kg"] circle title'),
  ).toContainText("12.7 kg");
  await expect(page.getByRole("main")).toContainText("aucun percentile");
  await page.locator("svg.growth-chart").first().scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("trusted-growth.png"),
    scale: "css",
    timeout: 10000,
  });
  await logout(page);
  expect(errors).toBe(0);
  save(info, "trusted-growth", {
    path,
    source_reference: marker("growth"),
    latest_revision: 2,
    weight_kg: 12.7,
    corrected_height_cm: 89.5,
    original_height_cm: 89,
    raw_observations_only: true,
    fresh_session: true,
  });
});
async function appointmentCase(
  page: Page,
  label: string,
  starts: string,
  ends: string,
  purpose: "other" | "consultation",
) {
  await page.goto(`${childPath}/appointments`);
  const existing = page
    .locator("main article.panel")
    .filter({ hasText: label });
  expect(await existing.count()).toBeLessThanOrEqual(1);
  if (await existing.count()) {
    const path = (await existing
      .getByRole("link", {
        name: "Historique et décision / replanifier",
        exact: true,
      })
      .getAttribute("href"))!;
    await page.goto(path);
    return path;
  }
  await page
    .getByRole("link", { name: "Planifier un rendez-vous", exact: true })
    .click();
  const form = page.locator("main form.auth-form");
  await form.locator('[name="purpose"]').selectOption(purpose);
  await form.locator('[name="purpose_label"]').fill(label);
  await form.locator('[name="facility_id"]').selectOption({ label: place });
  await form.locator('[name="starts_local"]').fill(starts);
  await form.locator('[name="ends_local"]').fill(ends);
  await form.locator('[name="starts_offset"]').selectOption("auto");
  await form.locator('[name="ends_offset"]').selectOption("auto");
  await form
    .locator('[name="reason"]')
    .fill(
      "Créneau entièrement fictif choisi manuellement pour le test logiciel.",
    );
  await form.locator('[name="reviewed"]').check();
  await form.locator('[name="syntheticOnly"]').check();
  await form
    .getByRole("button", { name: "Planifier le rendez-vous", exact: true })
    .click();
  await expect(page).toHaveURL(/\/appointments\/[a-f0-9-]{36}$/);
  return new URL(page.url()).pathname;
}
async function disposition(page: Page, action: string, reason: string) {
  const form = page.locator("main form.auth-form");
  await form.locator('[name="decision"]').selectOption(action);
  await form.locator('[name="reason"]').fill(reason);
  await form.locator('[name="reviewed"]').check();
  await form.locator('[name="syntheticOnly"]').check();
  return form;
}
test("manual follow-up preserves original slots, denies future missed, reschedules, cancels and records a past visit", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  let errors = 0;
  observeBrowserErrors(page, "clinician-care-appointments", () => errors++);
  await login(page, "A");
  const futureLabel = `Suivi fictif U5-${run} HB1 manuel`;
  const pastLabel = `Visite fictive U5-${run} passée`;
  let futureDenialExercised = false;
  const futurePath = await appointmentCase(
    page,
    futureLabel,
    "2026-12-03T09:30",
    "2026-12-03T10:00",
    "other",
  );
  if (
    !(await page.locator("main article.panel").first().innerText()).includes(
      "Annulé",
    )
  ) {
    const previous = Number(
      await page.locator('[name="expected_revision"]').inputValue(),
    );
    let form = await disposition(
      page,
      "mark_missed",
      "Tentative fictive de marquer un créneau futur, attendue refusée.",
    );
    await form
      .getByRole("button", { name: "Ajouter la décision", exact: true })
      .click();
    await expect(
      page.locator("main form.auth-form").getByRole("alert"),
    ).toBeVisible();
    futureDenialExercised = true;
    save(info, "trusted-future-appointment-denial", {
      futurePath,
      future_mark_missed_denied: true,
    });
    if (previous === 1) {
      form = await disposition(
        page,
        "reschedule",
        "Replanification manuelle entièrement fictive, ancien créneau conservé.",
      );
      // Check visible civil defaults before changing them; do not hide timezone drift.
      await expect(form.locator('[name="starts_local"]')).toHaveValue(
        "2026-12-03T09:30",
      );
      await expect(form.locator('[name="starts_offset"]')).toHaveValue(
        "+00:00",
      );
      await form.locator('[name="starts_local"]').fill("2026-12-04T11:00");
      await form.locator('[name="ends_local"]').fill("2026-12-04T11:30");
      await form.locator('[name="starts_offset"]').selectOption("auto");
      await form.locator('[name="ends_offset"]').selectOption("auto");
      await form
        .getByRole("button", { name: "Ajouter la décision", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Révision 2 — Replanification manuelle",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.locator("main form.auth-form").getByRole("alert"),
      ).toHaveCount(0);
      await page.reload();
    }
    form = await disposition(
      page,
      "cancel",
      "Annulation entièrement fictive avec motif et historique conservés.",
    );
    await form
      .getByRole("button", { name: "Ajouter la décision", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Révision 3 — Annulation",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator("main form.auth-form").getByRole("alert"),
    ).toHaveCount(0);
  }
  await page.reload();
  await expect(page.locator("main article.panel").first()).toContainText(
    "Annulé",
  );
  await expect(page.getByRole("main")).toContainText("Ancien créneau");
  const pastPath = await appointmentCase(
    page,
    pastLabel,
    "2026-11-10T14:00",
    "2026-11-10T14:30",
    "consultation",
  );
  if (
    !(await page.locator("main article.panel").first().innerText()).includes(
      "Visite déclarée réalisée",
    )
  ) {
    if (
      await page
        .locator('[name="decision"] option[value="mark_missed"]')
        .count()
    ) {
      const form = await disposition(
        page,
        "mark_missed",
        "Créneau passé fictif sans disposition, aucune dose manquée déduite.",
      );
      await form
        .getByRole("button", { name: "Ajouter la décision", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Révision 2 — Créneau passé sans disposition",
          exact: true,
        }),
      ).toBeVisible();
      await page.reload();
    }
    const form = await disposition(
      page,
      "complete",
      "Visite entièrement fictive déclarée réalisée pour test, aucun soin créé.",
    );
    await form
      .getByRole("button", { name: "Ajouter la décision", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Révision 3 — Visite déclarée réalisée",
        exact: true,
      }),
    ).toBeVisible();
  }
  await page.reload();
  await logout(page);
  await login(page, "A");
  await page.goto(futurePath);
  await expect(page.locator("main article.panel").first()).toContainText(
    "Annulé",
  );
  await page.goto(pastPath);
  await expect(page.locator("main article.panel").first()).toContainText(
    "Visite déclarée réalisée",
  );
  await page.goto("/appointments?date=2026-12-04&view=day&state=cancelled");
  const primary = page.getByRole("link", {
    name: "Nouveau rendez-vous",
    exact: true,
  });
  const contrast = await primary.evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    foreground: getComputedStyle(el).color,
  }));
  expect(["rgb(8, 127, 91)", "rgb(13, 86, 73)"]).toContain(contrast.background);
  expect(contrast.foreground).toBe("rgb(255, 255, 255)");

  await expect(page.getByRole("main")).toContainText(futureLabel);
  for (const view of ["week", "month"]) {
    await page
      .getByRole("combobox", { name: "Vue", exact: true })
      .selectOption(view);
    await page.getByRole("button", { name: "Afficher", exact: true }).click();
    await expect(page.locator(`.appointment-calendar.${view}`)).toBeVisible();
    await expect(page.getByRole("main")).toContainText(futureLabel);
  }
  await page.screenshot({
    path: info.outputPath("trusted-appointment-calendar.png"),
    scale: "css",
    timeout: 10000,
  });
  await logout(page);
  expect(errors).toBe(0);
  save(info, "trusted-appointments", {
    futurePath,
    pastPath,
    futureLabel,
    pastLabel,
    original_starts_local: "2026-12-03T09:30",
    rescheduled_starts_local: "2026-12-04T11:00",
    future_mark_missed_denial_exercised_this_run: futureDenialExercised,
    future_final_state: "cancelled",
    past_final_state: "completed",
    expected_events_each: 3,
    fresh_session: true,
    calendar_views: ["day", "week", "month"],
    manual_followup_purpose: "other",
    independent_database_readback: "pending",
  });
});

test("remaining clinician account actions and export retain current authorization", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  let errors = 0;
  observeBrowserErrors(page, "clinician-actions", () => errors++);
  await login(page, "A");
  await page.goto("/account");
  await page
    .getByRole("link", { name: "Mes habilitations cliniques", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account\/clinical-permissions$/);
  await expect(page.getByRole("main")).toContainText("Gestion des rendez-vous");
  await page
    .locator("section.panel")
    .getByRole("link", { name: "Mon compte", exact: true })
    .click();
  await page
    .getByRole("link", {
      name: "Changer ou récupérer mon mot de passe",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/forgot-password\?audience=clinician$/);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  // Recovery delivery is external; do not submit or send mail.
  await page.goto("/documents");
  await page
    .getByRole("link", { name: "Ouvrir mon registre", exact: true })
    .click();
  await expect(page).toHaveURL(/\/patients$/);
  const header = page.locator(".soignant-header");
  await header.locator('input[name="q"]').fill(run);
  await header.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/patients\\?q=" + run));
  await expect(page.getByRole("main")).toContainText("Enfant fictif");
  await page
    .getByRole("link", { name: "Rendez-vous et suivis", exact: true })
    .click();
  await expect(page).toHaveURL(/\/follow-up$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto(childPath + "/summary");
  await expect(page.getByRole("main")).toContainText("HB1");
  await expect(page.getByRole("main")).toContainText("VPO1");
  const response = await page.request.get(childPath + "/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const ledger = await response.json();
  expect(ledger.clinical_entries).toHaveLength(6);
  expect(ledger.vaccine_items_including_all_decisions).toHaveLength(1);
  expect(ledger.appointments_including_all_events).toHaveLength(4);
  expect(
    ledger.clinical_entries.some(
      (e: { professional_id: string; payload: { dose_label?: string } }) =>
        e.professional_id.endsWith("-B") && e.payload.dose_label === "VPO1",
    ),
  ).toBe(true);
  for (const [name, width, height] of [
    ["desktop", 1280, 720],
    ["tablet", 768, 1024],
    ["phone", 412, 839],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/growth?child=" + child);
    const charts = page.locator("svg.growth-chart");
    await expect(charts).toHaveCount(2);
    for (const chart of await charts.all())
      expect(
        await chart.evaluate((el) => el.getBoundingClientRect().width),
      ).toBeGreaterThanOrEqual(280);
    for (const text of await charts.locator("text").all())
      expect(
        await text.evaluate((el) => {
          const transform = (el as SVGGraphicsElement).getScreenCTM();
          return (
            parseFloat(getComputedStyle(el).fontSize) * (transform?.a ?? 0)
          );
        }),
      ).toBeGreaterThanOrEqual(10.5);
    await charts.first().scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath("trusted-growth-" + name + ".png"),
      scale: "css",
    });
  }
  await logout(page);
  await login(page, "B");
  const denied = await page.request.get(childPath + "/export");
  expect(denied.status()).toBe(404);
  expect(await denied.text()).not.toContain("HB1");
  await logout(page);
  expect(errors).toBe(0);
  save(info, "clinician-actions", {
    account_permissions: true,
    recovery_entry_only_no_email: true,
    documents_register_link: true,
    scoped_header_search: true,
    followup_header_link: true,
    summary_and_export_current_history: true,
    revoked_export_denied: true,
    raw_growth_three_viewports: true,
    page_errors: errors,
  });
});
