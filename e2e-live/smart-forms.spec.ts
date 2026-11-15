import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
async function choose(
  page: Page,
  label: string,
  query: string,
  option: RegExp,
) {
  const combo = page.getByRole("combobox", { name: new RegExp(`^${label}`) });
  await combo.fill(query);
  await page.getByRole("option", { name: option }).first().click();
}
test("smart vaccine selections preserve uncertainty and provisional isolation", async ({
  page,
}, info) => {
  const run = process.env.MON_ENFANT_QA_RUN!;
  const email = process.env.MON_ENFANT_PARENT_BROWSER_SECOND_EMAIL!;
  expect(email).toBe(`qa-parent-${run}-second@example.invalid`);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.name));
  await page.goto("/login?audience=clinician");
  await page.locator('[name="email"]').fill(email);
  await page
    .locator('[name="password"]')
    .fill(process.env.MON_ENFANT_PARENT_BROWSER_SECOND_PASSWORD!);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/(account|provisional)$/);
  if (new URL(page.url()).pathname === "/account") {
    await page.locator('[name="role"]').selectOption("doctor");
    await page
      .getByRole("button", { name: "Activer mon espace soignant", exact: true })
      .click();
  }
  await page.goto("/provisional?new=1");
  const childForm = page.locator("#new-child form");
  await childForm.locator('[name="given_name"]').fill("Enfant fictif");
  await childForm
    .locator('[name="family_name"]')
    .fill(`Smart forms ${run} ${info.project.name}`);
  await childForm.locator('[name="birth_date"]').fill("2025-01-01");
  await childForm.locator('[name="syntheticOnly"]').check();
  await childForm
    .getByRole("button", { name: "Créer le dossier provisoire", exact: true })
    .click();
  await expect(page).toHaveURL(/\/provisional\/[a-f0-9-]{36}$/);
  const path = new URL(page.url()).pathname;
  const open = async () => {
    await page.goto(`${path}?kind=vaccination`);
    await expect(page.getByRole("combobox", { name: /^Vaccin/ })).toBeVisible();
    await page.locator('[name="occurrence_precision"]').selectOption("unknown");
    await page
      .locator('[name="source_type"]')
      .selectOption("paper_transcription");
    await page
      .locator('[name="source_reference"]')
      .fill("Papier entièrement fictif Update 4");
  };
  await open();
  const captures: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
      localStorage.setItem("mon-enfant-theme", value);
    }, theme);
    const combo = page.getByRole("combobox", { name: /^Vaccin/ });
    await combo.fill("polio");
    await expect(
      page.getByRole("option", { name: /· VPO/ }).first(),
    ).toBeVisible();
    const menu = page.getByRole("listbox");
    const geometry = await menu.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        inside:
          r.left >= 0 &&
          r.right <= innerWidth + 1 &&
          r.top >= 0 &&
          r.bottom <= innerHeight + 1,
        portal: el.parentElement === document.body,
        scroll: getComputedStyle(el).overflowY,
      };
    });
    expect(geometry).toEqual({ inside: true, portal: true, scroll: "auto" });
    const capture = `smart-forms-${info.project.name}-${theme}.png`;
    await page.screenshot({ path: info.outputPath(capture) });
    captures.push(capture);
    await combo.press("Escape");
    await expect(menu).toHaveCount(0);
  }
  // Keyboard selection: searching by code retains native text editing and Enter chooses an explicit option.
  const vaccine = page.getByRole("combobox", { name: /^Vaccin/ });
  await vaccine.fill("VPO");
  await vaccine.press("Enter");
  await choose(page, "Dose déclarée", "VPO1", /VPO1/);
  await expect(page.locator('[name="dose_choice"]')).toHaveValue("VPO1");
  await choose(page, "Vaccin", "PCV", /· PCV/);
  await expect(page.locator('[name="dose_choice"]')).toHaveValue("");
  const dose = page.getByRole("combobox", { name: /^Dose déclarée/ });
  await dose.fill("VPO");
  await expect(page.getByRole("option", { name: /VPO1/ })).toHaveCount(0);
  await dose.press("Escape");
  await page
    .getByRole("button", {
      name: "Enregistrer l’entrée provisoire",
      exact: true,
    })
    .click();
  await expect(page.locator(".smart-field").getByRole("alert")).toContainText(
    "Choisissez une option",
  );
  await expect(page).toHaveURL(new RegExp(`${path}\\?kind=vaccination$`));
  await choose(page, "Dose déclarée", "PCV1", /PCV1/);
  await page
    .getByRole("button", {
      name: "Enregistrer l’entrée provisoire",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(
    page.getByRole("heading", { name: /Historique immuable \(1 révisions\)/ }),
  ).toBeVisible();
  await expect(page.locator(".record-list")).toContainText("PCV1");
  await open();
  await choose(page, "Vaccin", "", /^Autre \(préciser\)/);
  await page
    .locator('[name="vaccine_label"]')
    .fill("Vaccin fictif ORIGINAL non catalogué");
  await choose(page, "Dose déclarée", "", /^Dose inconnue/);
  await page
    .getByRole("button", {
      name: "Enregistrer l’entrée provisoire",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.locator(".record-list")).toContainText(
    "Dose inconnue / non précisée",
  );
  await open();
  await choose(page, "Vaccin", "", /^Autre \(préciser\)/);
  await page
    .locator('[name="vaccine_label"]')
    .fill("Autre vaccin fictif déclaré");
  await choose(page, "Dose déclarée", "", /^Autre \(préciser\)/);
  await page
    .locator('[name="dose_label"]')
    .fill("Rappel fictif, source incertaine");
  await page
    .getByRole("button", {
      name: "Enregistrer l’entrée provisoire",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(
    page.getByRole("heading", { name: /Historique immuable \(3 révisions\)/ }),
  ).toBeVisible();
  await expect(page.locator(".record-list")).toContainText(
    "Vaccin fictif ORIGINAL non catalogué",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath("smart-forms-proof.json"),
    JSON.stringify(
      {
        fixture_run: run,
        device: info.project.name,
        passed: true,
        synthetic_only: true,
        catalog_and_dependent_dose: true,
        incompatible_dose_cleared: true,
        custom_unknown_preserved: true,
        keyboard_portal_viewport: true,
        captures,
        page_errors: 0,
      },
      null,
      2,
    ),
  );
});

test("trusted vaccine choices retain explicit validation and immutable corrections", async ({
  page,
}, info) => {
  const run = process.env.MON_ENFANT_QA_RUN!;
  const email = process.env.MON_ENFANT_PARENT_BROWSER_DOCTOR_EMAIL!;
  expect(email).toBe(`qa-parent-${run}-doctor@example.invalid`);
  const password = process.env.MON_ENFANT_PARENT_BROWSER_DOCTOR_PASSWORD!;
  const api = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.MON_ENFANT_PARENT_BROWSER_PUBLIC_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const login = await api.auth.signInWithPassword({ email, password });
  expect(login.error).toBeNull();
  let child: string, facility: string;
  try {
    const f = await api.rpc("create_facility", {
      p_operation_id: randomUUID(),
      p_name: "Centre entièrement fictif smart forms",
      p_city: "Rabat fictif",
    });
    expect(f.error).toBeNull();
    facility = f.data as string;
    const operation = randomUUID(),
      payload = {
        facility_id: facility,
        register_year: 2026,
        register_book: "SMART-QA",
        local_number: randomUUID(),
        given_name: "Enfant fictif",
        family_name: `Smart ${randomUUID()}`,
        birth_date: "2025-01-01",
        birth_date_precision: "exact",
        sex: "unknown",
      };
    const prepared = await api.rpc("prepare_child_registration", {
      p_operation_id: operation,
      p_payload: payload,
    });
    expect(prepared.error).toBeNull();
    expect(prepared.data).toMatchObject({ state: "ready" });
    const record = await api.rpc("register_child", {
      p_operation_id: operation,
      p_payload: payload,
    });
    expect(record.error).toBeNull();
    child = record.data as string;
  } finally {
    expect((await api.auth.signOut({ scope: "local" })).error).toBeNull();
  }
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.name));
  await page.goto("/login?audience=clinician");
  await page.locator('[name="email"]').fill(email);
  await page.locator('[name="password"]').fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/(dashboard|account)$/);
  const path = `/patients/${child}/records/new?kind=vaccination`;
  const prepare = async () => {
    await page.goto(path);
    await page.locator('[name="facility_id"]').selectOption(facility);
    await page.locator('[name="occurrence_precision"]').selectOption("unknown");
    await page
      .locator('[name="source_type"]')
      .selectOption("paper_transcription");
    await page
      .locator('[name="source_reference"]')
      .fill("Source entièrement fictive smart forms");
    await page.locator('[name="syntheticOnly"]').check();
  };
  await prepare();
  await choose(page, "Vaccin", "VPO", /· VPO/);
  await choose(page, "Dose déclarée", "VPO1", /VPO1/);
  await expect(page.locator('[name="matching_status"]')).toHaveValue(
    "unmatched",
  );
  await page
    .getByRole("button", {
      name: "Contrôler les doublons possibles",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Aucun doublon potentiel trouvé avec ces champs.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Enregistrer le soin", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/patients/${child}/records/[a-f0-9-]{36}$`),
  );
  await expect(
    page.getByText("Dernière version : 1.", { exact: false }),
  ).toBeVisible();
  const form = page
    .locator("form")
    .filter({ has: page.locator('[name="amendment_reason"]') });
  await form
    .locator('[name="amendment_reason"]')
    .fill("Correction entièrement fictive de la note");
  await form
    .locator('[name="notes"]')
    .fill("Nouvelle note fictive, source inchangée");
  await form.locator('[name="syntheticOnly"]').check();
  await form
    .getByRole("button", { name: "Ajouter la révision", exact: true })
    .click();
  await expect(
    page.getByText("Dernière version : 2.", { exact: false }),
  ).toBeVisible();
  await prepare();
  await choose(page, "Vaccin", "", /^Autre \(préciser\)/);
  await page
    .locator('[name="vaccine_label"]')
    .fill("Vaccin clinique fictif hors catalogue");
  await choose(page, "Dose déclarée", "", /^Dose inconnue/);
  await expect(page.locator('[name="matching_status"]')).toHaveValue(
    "unmatched",
  );
  await page
    .getByRole("button", { name: "Enregistrer le soin", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/patients/${child}/records/[a-f0-9-]{36}$`),
  );
  await expect(page.locator('[name="dose_choice"]')).toHaveValue("unknown");
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath("smart-forms-clinical-proof.json"),
    JSON.stringify(
      {
        fixture_run: run,
        device: info.project.name,
        passed: true,
        synthetic_only: true,
        real_clinical_entry_and_correction: true,
        duplicate_check_preserved: true,
        custom_unknown_remains_unmatched: true,
        page_errors: 0,
      },
      null,
      2,
    ),
  );
});
