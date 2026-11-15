import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { observeBrowserErrors } from "./browser-errors";
const run = process.env.MON_ENFANT_QA_RUN!;
async function login(page: Page, role: "A" | "MANAGER") {
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
test("canonical trusted HB1 historical save and next-reference reproduction", async ({
  page,
}, info) => {
  test.skip(
    Boolean(process.env.MON_ENFANT_STABILIZATION_CHILD),
    "Existing-child inspection selected",
  );
  test.setTimeout(240000);
  let errors = 0;
  observeBrowserErrors(page, "trusted-HB1", () => errors++);
  await page.emulateMedia({ colorScheme: "dark" });
  await login(page, "MANAGER");
  await page.goto(
    `/admin/clinical-permissions?q=${encodeURIComponent(`QAB-${run}-A`)}`,
  );
  await page.locator('[name="capability"]').selectOption("vaccination");
  await page.locator('[name="decision"]').selectOption("enable");
  await page
    .locator('[name="evidence_reference"]')
    .fill("Habilitation entièrement fictive pour test logiciel Update 5.");
  await page
    .getByLabel("Motif historisé", { exact: true })
    .fill(
      "Vérification technique fictive, sans qualification clinique réelle.",
    );
  await page.locator('[name="verified"]').check();
  await page
    .getByRole("button", { name: "Enregistrer l’habilitation" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Habilitation historisée" }),
  ).toBeVisible();
  await logout(page);
  await login(page, "A");
  const place = `Centre fictif U5 ${run} ${info.project.name}`;
  await page.goto("/practices");
  await page.getByLabel("Nom du lieu d’exercice", { exact: true }).fill(place);
  await page.getByLabel("Ville", { exact: true }).fill("Rabat fictif");
  await page.getByRole("button", { name: "Déclarer ce lieu" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Opération enregistrée" }),
  ).toBeVisible();
  await page.goto("/patients/new");
  await page
    .locator('[name="facility_id"]')
    .selectOption({ label: `${place} — Rabat fictif` });
  await page.getByLabel("Année du registre", { exact: true }).fill("2026");
  await page
    .getByLabel("Livre / série du registre", { exact: true })
    .fill("U5");
  await page
    .getByLabel("Numéro local (zéros conservés)", { exact: true })
    .fill("001");
  await page
    .getByLabel("Prénom (si connu)", { exact: true })
    .fill("Enfant fictif");
  await page
    .getByLabel("Nom (si connu)", { exact: true })
    .fill(`HB1 ${run} ${info.project.name}`);
  await page
    .getByLabel("Date de naissance (si connue)", { exact: true })
    .fill("2025-01-01");
  await page.locator('[name="syntheticOnly"]').check();
  await page
    .getByRole("button", { name: "Créer le dossier et le numéro local" })
    .click();
  await expect(page).toHaveURL(/\/patients\/[a-f0-9-]{36}$/);
  const childPath = new URL(page.url()).pathname;
  await page.goto(childPath + "/records/new?kind=vaccination");
  await page
    .locator('[name="facility_id"]')
    .selectOption({ label: `${place} — Rabat fictif` });
  await page.getByRole("combobox", { name: /^Vaccin/ }).fill("HB");
  await page
    .getByRole("option", { name: /· HB\b/ })
    .first()
    .click();
  await page.getByRole("combobox", { name: /^Dose déclarée/ }).fill("HB1");
  await page.getByRole("option", { name: /HB1/ }).first().click();
  await page.locator('[name="occurrence_precision"]').selectOption("unknown");
  await page
    .locator('[name="source_type"]')
    .selectOption("paper_transcription");
  await page
    .locator('[name="source_reference"]')
    .fill("Papier fictif HB1 Update 5, sans date contrôlée.");
  await page.locator('[name="source_verified"]').uncheck();
  await page.locator('[name="syntheticOnly"]').check();
  await page
    .getByRole("button", { name: "Enregistrer le soin", exact: true })
    .click();
  await expect(page).toHaveURL(/\/records\/[a-f0-9-]{36}$/);
  const entryPath = new URL(page.url()).pathname;
  await page.reload();
  await expect(page.locator(".clinical-entry")).toContainText("HB1");
  await expect(page.locator(".clinical-entry")).toContainText(
    "Source non confirmée",
  );
  const response = await page.request.get(childPath + "/export");
  expect(response.status()).toBe(200);
  const ledger = await response.json();
  const history = ledger.clinical_entries as {
    payload: { dose_label?: string };
    occurred_on: string | null;
    source_verified: boolean;
    vaccine_mapping?: unknown;
  }[];
  expect(
    history.some(
      (e) =>
        e.payload.dose_label === "HB1" &&
        e.occurred_on === null &&
        !e.source_verified &&
        !e.vaccine_mapping,
    ),
  ).toBe(true);
  expect(ledger.vaccine_items_including_all_decisions.length).toBe(0);
  expect(ledger.appointments_including_all_events.length).toBe(0);
  await page.goto(childPath + "/vaccinations");
  await page.reload();
  const text = await page.getByRole("main").innerText();
  const proof = {
    fixture_run: run,
    canonical: "https://mon-enfant.vercel.app",
    device: info.project.name,
    status: "trusted_before_fix_observations",
    child_path: childPath,
    entry_path: entryPath,
    HB1_saved_and_reloaded: true,
    unknown_unverified_unmatched: true,
    assigned_routine_items: 0,
    appointments: 0,
    HB1_inline_on_vaccination_page:
      (await page
        .locator(".clinical-entry")
        .filter({ hasText: "HB1" })
        .count()) > 0,
    HB1_specific_next_state: /HB1[^\n]*(?:automatique|rattrapage|calcul)/.test(
      text,
    ),
    history_link_visible: await page
      .getByRole("link", {
        name: "Administrations et corrections",
        exact: true,
      })
      .isVisible(),
    page_errors: errors,
  };
  writeFileSync(
    info.outputPath("trusted-HB1-before.json"),
    JSON.stringify(proof, null, 2),
  );
  await page.screenshot({
    path: info.outputPath("trusted-HB1-vaccinations-before.png"),
    scale: "css",
    timeout: 10000,
  });
  await page
    .getByRole("link", { name: "Administrations et corrections", exact: true })
    .click();
  await expect(page.locator(".clinical-entry")).toContainText("HB1");
  await page.screenshot({
    path: info.outputPath("trusted-HB1-history-before.png"),
    scale: "css",
    timeout: 10000,
  });
  expect(errors).toBe(0);
  console.log(JSON.stringify({ event: "trusted_HB1_reproduction", ...proof }));
  await logout(page);
});

test("inspect the same saved HB1 on the canonical vaccination page", async ({
  page,
}, info) => {
  const child = process.env.MON_ENFANT_STABILIZATION_CHILD;
  test.skip(!child, "No existing synthetic child selected");
  expect(child).toMatch(/^\/patients\/[a-f0-9-]{36}$/);
  const fixed = process.env.MON_ENFANT_STABILIZATION_EXPECT_FIXED === "1";
  await login(page, "A");
  await page.goto(child + "/vaccinations");
  await page.reload();
  const cards = page.locator(".clinical-entry");
  const inline = await cards.filter({ hasText: "HB1" }).count();
  const text = await page.getByRole("main").innerText();
  const explained = /HB1[^\n]*(?:automatique|rattrapage|calcul)/.test(text);
  expect(inline > 0).toBe(fixed);
  expect(explained).toBe(fixed);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  writeFileSync(
    info.outputPath("trusted-HB1-inspection.json"),
    JSON.stringify(
      {
        fixture_run: run,
        device: info.project.name,
        child_path: child,
        stage: fixed ? "after" : "before",
        HB1_history_cards: inline,
        HB1_specific_next_state: explained,
        measurement_scope: "clinical-entry cards, excludes child heading",
        rendered_theme: "light",
      },
      null,
      2,
    ),
  );
  await page.screenshot({
    path: info.outputPath(`trusted-HB1-${fixed ? "after" : "before"}.png`),
    scale: "css",
    timeout: 10000,
  });
  await page
    .getByRole("link", { name: "Administrations et corrections", exact: true })
    .click();
  await expect(page.locator(".clinical-entry")).toContainText("HB1");
  await logout(page);
});
