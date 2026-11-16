import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { observeBrowserErrors } from "./browser-errors";
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    writeFileSync(
      info.outputPath("clinician-failure.json"),
      JSON.stringify(
        {
          route: new URL(page.url()).pathname,
          status: info.status,
          errors: info.errors.map((e) => ({
            name: e.value ? "test_failure" : "timeout_or_assertion",
          })),
        },
        null,
        2,
      ),
    );
    await page
      .screenshot({
        path: info.outputPath("clinician-failure.png"),
        scale: "css",
        timeout: 10000,
      })
      .catch(() => undefined);
  }
});
const run = process.env.MON_ENFANT_QA_RUN!;
const labels = [
  "Tableau de bord",
  "Enfants",
  "Consultations",
  "Vaccinations",
  "Rendez-vous",
  "Croissance",
  "Documents",
  "Mon compte soignant",
];
async function login(page: Page, role: "A" | "OUTSIDE") {
  const key = `MON_ENFANT_CLINICAL_BROWSER_${role}_`;
  expect(process.env[key + "EMAIL"]).toBe(
    `qa-cbrowser-${run}-${role.toLowerCase()}@example.invalid`,
  );
  await page.goto("/login?audience=clinician");
  await page.locator('[name="email"]').fill(process.env[key + "EMAIL"]!);
  await page.locator('[name="password"]').fill(process.env[key + "PASSWORD"]!);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/(account|dashboard|provisional)$/);
}
async function logout(page: Page) {
  await page.goto("/account");
  await page
    .getByRole("button", { name: "Se déconnecter", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login/);
}
async function menu(page: Page) {
  const mobile = page.locator(".soignant-mobile-menu");
  if (await mobile.isVisible()) {
    const details = mobile.locator("details");
    if ((await details.getAttribute("open")) === null)
      await details.locator("summary").click();
    return mobile.locator("nav");
  }
  return page.locator(".soignant-sidebar > nav");
}
test("each clinician section has dedicated scoped UI and provisional writes persist", async ({
  page,
}, info) => {
  test.setTimeout(480000);
  let errors = 0;
  observeBrowserErrors(page, "clinician-pages", () => errors++);
  await page.emulateMedia({ colorScheme: "dark" });
  const proof: {
    fixture_run: string;
    device: string;
    observations: Record<string, unknown>[];
    captures: string[];
    page_errors: number;
    status: string;
  } = {
    fixture_run: run,
    device: info.project.name,
    observations: [],
    captures: [],
    page_errors: 0,
    status: "in_progress",
  };
  const save = () => {
    proof.page_errors = errors;
    writeFileSync(
      info.outputPath("clinician-pages.json"),
      JSON.stringify(proof, null, 2),
    );
  };
  let privateChild = "";
  for (const role of ["A", "OUTSIDE"] as const) {
    await login(page, role);
    const provisional = role === "OUTSIDE",
      home = provisional ? "/provisional" : "/dashboard";
    if (provisional) {
      const marker = `U5-${run}-${info.project.name}`;
      await page.goto(`/provisional/children?q=${marker}`);
      const existing = page.locator('main table a[href^="/provisional/"]');
      expect(await existing.count()).toBeLessThanOrEqual(1);
      if (await existing.count())
        privateChild = (await existing.first().getAttribute("href"))!;
      else {
        await page.goto("/provisional?new=1");
        const form = page.locator("#new-child form");
        await form.locator('[name="given_name"]').fill("Enfant fictif");
        await form.locator('[name="family_name"]').fill(marker);
        await form.locator('[name="birth_date"]').fill("2025-01-01");
        await form.locator('[name="syntheticOnly"]').check();
        await form
          .getByRole("button", {
            name: "Créer le dossier provisoire",
            exact: true,
          })
          .click();
        await expect(page).toHaveURL(/\/provisional\/[a-f0-9-]{36}$/);
        privateChild = new URL(page.url()).pathname;
      }
      const id = privateChild.split("/").at(-1)!;
      for (const [kind, section] of [
        ["consultation", "consultations"],
        ["growth", "growth"],
        ["vaccination", "vaccinations"],
        ["appointment", "appointments"],
      ] as const) {
        const source = `Source fictive ${marker} ${kind}`,
          path = `/provisional/${section}?child=${id}`;
        await page.goto(path);
        const picker = page.locator(".soignant-phone-picker");
        if (await picker.isVisible()) {
          await picker.locator("summary").click();
          const search = picker.locator('input[type="search"]');
          await expect(search).toHaveCSS("border-top-style", "solid");
          await expect(search).toHaveCSS("border-top-width", "1px");
          expect(
            await search.evaluate((el) => el.getBoundingClientRect().height),
          ).toBeGreaterThanOrEqual(44);
          await picker.locator('select[name="child"]').selectOption(id);
          await picker
            .getByRole("button", { name: "Afficher cet enfant" })
            .click();
          await expect(page).toHaveURL(
            new RegExp(`/provisional/${section}\\?`),
          );
          expect(new URL(page.url()).searchParams.get("child")).toBe(id);
        } else {
          const search = page.locator(
            '.soignant-desktop-picker input[type="search"]',
          );
          await expect(search).toHaveCSS("border-top-style", "solid");
          await expect(search).toHaveCSS("border-top-width", "1px");
          expect(
            await search.evaluate((el) => el.getBoundingClientRect().height),
          ).toBeGreaterThanOrEqual(44);
          await page
            .locator(
              ".soignant-desktop-picker .soignant-child-list a[aria-current=page]",
            )
            .click();
          expect(new URL(page.url()).searchParams.get("child")).toBe(id);
        }
        const already = (await page.getByRole("main").innerText()).includes(
          source,
        );
        if (!already) {
          await page.goto(`${privateChild}?kind=${kind}#entry-form`);
          const form = page.locator("#entry-form form");
          await form.locator('[name="source_reference"]').fill(source);
          await form
            .locator('[name="source_type"]')
            .selectOption(
              kind === "vaccination" ? "paper_transcription" : "observed",
            );
          await form
            .locator('[name="occurrence_precision"]')
            .selectOption(
              kind === "vaccination" || kind === "appointment"
                ? "unknown"
                : "exact",
            );
          if (kind === "growth" || kind === "consultation")
            await form.locator('[name="occurred_on"]').fill("2026-11-01");
          if (kind === "consultation") {
            await form
              .locator('textarea[name="reason"]')
              .fill(`Consultation fictive ${marker}`);
            await form
              .locator('[name="findings"]')
              .fill(
                "Observation entièrement fictive, sans interprétation clinique.",
              );
          }
          if (kind === "growth") {
            await form.locator('[name="weight_kg"]').fill("12.4");
            await form.locator('[name="height_cm"]').fill("88");
          }
          if (kind === "appointment") {
            await form
              .locator('[name="purpose"]')
              .fill(`Suivi fictif ${marker}`);
            await form
              .locator('[name="scheduled_local"]')
              .fill("2026-12-01T10:00");
            await form.locator('[name="status"]').selectOption("planned");
          }
          if (kind === "vaccination") {
            await form.getByRole("combobox", { name: /^Vaccin/ }).fill("HB");
            await page
              .getByRole("option", { name: /· HB\b/ })
              .first()
              .click();
            await form
              .getByRole("combobox", { name: /^Dose déclarée/ })
              .fill("HB1");
            await page.getByRole("option", { name: /HB1/ }).first().click();
          }
          await form
            .getByRole("button", {
              name: "Enregistrer l’entrée provisoire",
              exact: true,
            })
            .click();
          await expect(page).toHaveURL(new RegExp(privateChild + "$"));
        }
        await page.goto(path);
        await page.reload();
        await expect(page.getByRole("main")).toContainText(source);
        if (kind === "growth") {
          const charts = page.locator("svg.growth-chart");
          await expect(charts).toHaveCount(2);
          for (const chart of await charts.all())
            expect(
              await chart.evaluate((el) => el.getBoundingClientRect().width),
            ).toBeGreaterThanOrEqual(280);
        }
        if (kind === "vaccination")
          await expect(page.getByRole("main")).toContainText(
            "HB1 : aucun calcul automatique",
          );
        if (kind === "appointment")
          await expect(page.getByRole("main")).toContainText("Planifié");
        proof.observations.push({
          role,
          action: "provisional_write_reload",
          kind,
          child_path: privateChild,
          newly_written: !already,
          source_marker: source,
          persistence_in_ui: true,
        });
        save();
      }
    }
    for (let index = 0; index < labels.length; index++) {
      const label = labels[index];
      await page.goto(home);
      const navigation = await menu(page);
      const visibleLabels = await navigation
        .locator(":scope > a, :scope > .soignant-nav-disabled")
        .evaluateAll((elements) =>
          elements.map(
            (el) =>
              el.querySelector("span")?.childNodes[0]?.textContent?.trim() ??
              el.textContent?.trim(),
          ),
        );
      expect(visibleLabels).toEqual(labels);
      if (provisional && label === "Documents") {
        await expect(
          navigation.locator('[aria-disabled="true"]'),
        ).toContainText("Indisponible en provisoire");
        await expect(
          navigation.locator('a[href="/provisional/documents"]'),
        ).toHaveCount(0);
        await page.goto("/provisional/documents");
        await expect(page.getByRole("main")).toContainText(
          "Bientôt disponible",
        );
      } else {
        const link = navigation.getByRole("link", { name: label, exact: true }),
          href = (await link.getAttribute("href"))!;
        if (info.project.name === "android") await link.tap();
        else if (index % 2 === 0) {
          await link.focus();
          await page.keyboard.press("Enter");
        } else await link.click();
        await expect(page).toHaveURL(
          new URL(href, "https://mon-enfant.vercel.app").href,
        );
        await page.reload();
        const current = page
          .locator('.soignant-sidebar > nav > a[aria-current="page"]')
          .first();
        await expect(current).toHaveAttribute("href", href);
      }
      await expect(
        page.getByRole("main").getByRole("heading", { level: 1 }),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      if (label === "Documents") {
        await expect(page.getByRole("main")).toContainText(
          "Bientôt disponible",
        );
        await expect(
          page.getByRole("main").locator('input[type="file"]'),
        ).toHaveCount(0);
      }
      if (
        label === "Consultations" ||
        label === "Vaccinations" ||
        label === "Croissance"
      )
        await expect(page.getByRole("main")).toContainText(
          "Sélectionner un enfant",
        );
      if (label === "Rendez-vous" && !provisional)
        await expect(page.locator(".appointment-calendar")).toBeVisible();
      if (label === "Mon compte soignant")
        await expect(page.getByRole("main")).toContainText(
          provisional ? "Non vérifié" : "Vérifié",
        );
      const heading = await page
        .getByRole("main")
        .getByRole("heading", { level: 1 })
        .innerText();
      proof.observations.push({
        role,
        label,
        route: new URL(page.url()).pathname,
        heading,
        navigation_and_reload: true,
      });
      save();
      const shot = `clinician-${info.project.name}-${role}-${index + 1}.png`;
      await page.screenshot({
        path: info.outputPath(shot),
        scale: "css",
        timeout: 10000,
      });
      proof.captures.push(shot);
      save();
      console.log(
        JSON.stringify({
          event: "clinician_page_verified",
          role,
          section: label,
          device: info.project.name,
        }),
      );
    }
    await logout(page);
    await page.goto(home);
    await expect(page).toHaveURL(/\/login/);
  }
  await login(page, "A");
  await page.goto(
    `/provisional/vaccinations?child=${privateChild.split("/").at(-1)}`,
  );
  await expect(
    page.getByRole("heading", { name: "Dossier indisponible", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".clinical-entry")).toHaveCount(0);
  proof.observations.push({
    action: "other_author_provisional_read_denied",
    child_path: privateChild,
  });
  await logout(page);
  expect(errors).toBe(0);
  proof.status =
    "navigation_and_provisional_lifecycle_pass_other_clinical_lifecycles_pending";
  save();
});
