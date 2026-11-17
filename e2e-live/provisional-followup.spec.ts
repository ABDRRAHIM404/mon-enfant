import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { observeBrowserErrors } from "./browser-errors";
const run = process.env.MON_ENFANT_QA_RUN!;
test("unverified nurse sees routine calendar after HB1 and saved future follow-up", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  let errors = 0;
  observeBrowserErrors(page, "provisional-followup", () => errors++);
  const prefix = "MON_ENFANT_CLINICAL_BROWSER_A_";
  expect(process.env[prefix + "EMAIL"]).toBe(
    `qa-cbrowser-${run}-a@example.invalid`,
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login?audience=clinician");
  await page.locator('[name="email"]').fill(process.env[prefix + "EMAIL"]!);
  await page
    .locator('[name="password"]')
    .fill(process.env[prefix + "PASSWORD"]!);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/(provisional|account)$/);
  await page.goto(
    "/provisional/children?q=" + encodeURIComponent(`Suivi-${run}`),
  );
  const existing = page.locator('main table a[href^="/provisional/"]');
  expect(await existing.count()).toBeLessThanOrEqual(1);
  let path = "";
  if (await existing.count())
    path = (await existing.first().getAttribute("href"))!;
  else {
    await page.goto("/provisional?new=1");
    const create = page.locator("#new-child form");
    await create.locator('[name="given_name"]').fill("Enfant fictif");
    await create.locator('[name="family_name"]').fill(`Suivi-${run}`);
    await create.locator('[name="birth_date"]').fill("2026-11-01");
    await create.locator('[name="syntheticOnly"]').check();
    await create
      .getByRole("button", { name: "Créer le dossier provisoire", exact: true })
      .click();
    await expect(page).toHaveURL(/\/provisional\/[a-f0-9-]{36}$/);
    path = new URL(page.url()).pathname;
  }
  const child = path.split("/").at(-1)!;
  await page.goto(path);
  let form = page.locator("#entry-form form");
  if (
    !(await page.getByRole("main").innerText()).includes(
      `HB1 fictive de routine ${run}`,
    )
  ) {
    await page.goto(path + "?kind=vaccination#entry-form");
    form = page.locator("#entry-form form");
    await form
      .locator('[name="source_reference"]')
      .fill(`HB1 fictive de routine ${run}`);
    await form.locator('[name="source_type"]').selectOption("observed");
    await form.locator('[name="occurrence_precision"]').selectOption("exact");
    await form.locator('[name="occurred_on"]').fill("2026-11-01");
    await form.getByRole("combobox", { name: /^Vaccin/ }).fill("HB");
    await page
      .getByRole("listbox")
      .getByRole("option", { name: /· HB\b/ })
      .first()
      .click();
    await form.getByRole("combobox", { name: /^Dose déclarée/ }).fill("HB1");
    await page
      .getByRole("listbox")
      .getByRole("option", { name: /HB1/ })
      .first()
      .click();
    await form
      .getByRole("button", {
        name: "Enregistrer l’entrée provisoire",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(path + "$"));
  }
  const followup = "/provisional/vaccinations?child=" + child;
  await page.goto(followup);
  await expect(page.locator("#routine-followup")).toContainText(
    "Calendrier en attente de validation clinique",
  );
  await expect(
    page.locator("#routine-followup").getByText("VPO1", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("HB1");
  const purpose = `Suivi vaccinal fictif ${run}`;
  const day = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  if (
    !(await page.locator("#planned-followup").innerText()).includes(purpose)
  ) {
    await page
      .getByRole("link", {
        name: "Planifier un suivi dans ce dossier",
        exact: true,
      })
      .click();
    form = page.locator("#entry-form form");
    await form
      .locator('[name="source_reference"]')
      .fill(`Planification fictive ${run}`);
    await form.locator('[name="occurrence_precision"]').selectOption("unknown");
    await form.locator('[name="purpose"]').fill(purpose);
    await form.locator('[name="scheduled_local"]').fill(day + "T10:00");
    await form.locator('[name="status"]').selectOption("planned");
    await form
      .getByRole("button", {
        name: "Enregistrer l’entrée provisoire",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(path + "$"));
  }
  await page.goto(followup);
  await page.reload();
  await expect(page.locator("#planned-followup")).toContainText(purpose);
  for (const [device, width, height] of [
    ["desktop", 1280, 900],
    ["phone", 412, 839],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(followup);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.locator("#routine-followup").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(`followup-${device}.png`),
      scale: "css",
    });
    await page.locator("#planned-followup").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(`planned-${device}.png`),
      scale: "css",
    });
  }
  await page.goto("/account");
  await page
    .getByRole("button", { name: "Se déconnecter", exact: true })
    .click();
  await page.goto(followup);
  await expect(page).toHaveURL(/\/login/);
  expect(errors).toBe(0);
  writeFileSync(
    info.outputPath("provisional-followup.json"),
    JSON.stringify(
      {
        run,
        child,
        purpose,
        scheduled_local: day + "T10:00",
        account: "unverified nurse",
        normal_hb1_saved: true,
        routine_other_doses_visible: true,
        draft_dates_not_activated: true,
        manual_future_visit_survives_reload: true,
        viewports: ["desktop", "phone"],
        signed_out_denied: true,
        page_errors: errors,
      },
      null,
      2,
    ),
  );
});
