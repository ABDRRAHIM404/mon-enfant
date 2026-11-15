import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { observeBrowserErrors } from "./browser-errors";
const acceptance = process.env.MON_ENFANT_LIVE_PROBE === "stabilization-accept";
const navigationSelector =
  ".workspace-sidebar nav > a, .workspace-mobile-nav > a, .workspace-account > a" +
  (acceptance ? ", .workspace-mobile-menu nav > a" : "");
async function openMobileMenu(page: Page) {
  if (!acceptance) return;
  const menu = page.locator(".workspace-mobile-menu");
  if ((await menu.isVisible()) && (await menu.getAttribute("open")) === null)
    await menu.locator("summary").click();
}
const SITE = "https://mon-enfant.vercel.app";
async function theme(page: Page, value: "light" | "dark") {
  await page.evaluate((v) => {
    document.documentElement.dataset.theme = v;
    document.documentElement.style.colorScheme = v;
    localStorage.setItem("mon-enfant-theme", v);
    window.dispatchEvent(new Event("storage"));
  }, value);
}
test(
  acceptance
    ? "accept canonical navigation and saved provisional HB1 history after fixes"
    : "reproduce canonical clinician navigation and saved provisional HB1 history before fixes",
  async ({ page }, info) => {
    test.setTimeout(300000);
    const run = process.env.MON_ENFANT_QA_RUN!;
    const captures: string[] = [];
    let errors = 0;
    observeBrowserErrors(page, "stabilization-reproduction", () => errors++);
    const findings: Record<string, unknown>[] = [];
    for (const role of ["DOCTOR", "SECOND"] as const) {
      await page.goto("/login?audience=clinician");
      const email = process.env[`MON_ENFANT_PARENT_BROWSER_${role}_EMAIL`]!,
        password = process.env[`MON_ENFANT_PARENT_BROWSER_${role}_PASSWORD`]!;
      expect(email).toBe(
        `qa-parent-${run}-${role.toLowerCase()}@example.invalid`,
      );
      await page.locator('[name="email"]').fill(email);
      await page.locator('[name="password"]').fill(password);
      await page
        .getByRole("button", { name: "Se connecter", exact: true })
        .click();
      await expect(page).toHaveURL(/\/(dashboard|account|provisional)$/);
      if (role === "SECOND" && new URL(page.url()).pathname === "/account") {
        await page.locator('[name="role"]').selectOption("nurse");
        await page
          .getByRole("button", {
            name: "Activer mon espace soignant",
            exact: true,
          })
          .click();
        await expect(page).toHaveURL(/\/provisional$/);
      }
      const home = role === "DOCTOR" ? "/dashboard" : "/provisional";
      for (const mode of ["light", "dark"] as const) {
        await page.goto(home);
        await theme(page, mode);
        await expect(
          page.getByRole("main").getByRole("heading", { level: 1 }),
        ).toBeVisible();
        const homeHeading = await page
          .getByRole("main")
          .getByRole("heading", { level: 1 })
          .innerText();
        await openMobileMenu(page);
        const links = await page
          .locator(navigationSelector)
          .evaluateAll((elements) =>
            elements
              .map((el, index) => ({
                index,
                visible: el.getClientRects().length > 0,
                label: el.textContent?.trim() ?? "",
                href: el.getAttribute("href")!,
              }))
              .filter((el) => el.visible),
          );
        const first = `stabilization-${info.project.name}-${role}-${mode}-01-home.png`;
        await page.screenshot({ path: info.outputPath(first) });
        captures.push(first);
        if (links.length < 3) {
          const observation = {
            role,
            theme: mode,
            current_route: new URL(page.url()).pathname,
            heading: homeHeading,
            visible_workspace_links: links.length,
            page_errors: errors,
          };
          writeFileSync(
            info.outputPath("stabilization-repro.json"),
            JSON.stringify(
              {
                fixture_run: run,
                device: info.project.name,
                status: "navigation_missing_observed",
                observation,
                findings,
                captures,
              },
              null,
              2,
            ),
          );
          console.log(
            JSON.stringify({
              event: "canonical_navigation_missing",
              ...observation,
            }),
          );
          throw new Error(
            "Canonical workspace navigation missing; classified capture saved",
          );
        }
        for (let i = 0; i < links.length; i++) {
          const link = links[i];
          await page.goto(home);
          await theme(page, mode);
          await openMobileMenu(page);
          const target = page.locator(navigationSelector).nth(link.index);
          await expect(target).toBeVisible();
          if (info.project.name === "android") await target.tap();
          else if (i % 2 === 0) {
            await target.focus();
            await page.keyboard.press("Enter");
          } else await target.click();
          await expect(
            page.getByRole("main").getByRole("heading", { level: 1 }),
          ).toBeVisible();
          await expect(page).toHaveURL(new URL(link.href, SITE).href);
          if (new URL(link.href, SITE).pathname === home) {
            await expect(
              page
                .locator(`a[href="${link.href}"][aria-current="page"]`)
                .first(),
            ).toHaveAttribute("aria-current", "page");
            if (
              acceptance &&
              role === "SECOND" &&
              link.href.includes("?view=")
            ) {
              await expect(
                page.getByRole("main").getByRole("heading", { level: 1 }),
              ).not.toHaveText(homeHeading);
            }
          } else {
            await expect(
              page.getByRole("main").getByRole("heading", { level: 1 }),
            ).not.toHaveText(homeHeading);
          }
          const url = new URL(page.url());
          expect(url.origin).toBe(SITE);
          const heading = await page
            .getByRole("main")
            .getByRole("heading", { level: 1 })
            .innerText();
          const main = await page.getByRole("main").innerText();
          findings.push({
            role,
            theme: mode,
            label: link.label,
            requested: link.href,
            actual: url.pathname + url.search,
            heading,
            home_heading_unchanged: heading === homeHeading,
            main_signature: createHash("sha256").update(main).digest("hex"),
            interaction:
              info.project.name === "android"
                ? "touch"
                : i % 2 === 0
                  ? "keyboard"
                  : "mouse",
          });
          if (role === "SECOND" && link.href.includes("view=vaccination")) {
            const shot = `stabilization-${info.project.name}-${role}-${mode}-02-vaccination-view.png`;
            await page.screenshot({ path: info.outputPath(shot) });
            captures.push(shot);
          }
        }
      }
      if (role === "SECOND") {
        if (acceptance) {
          await page.goto(home);
          await openMobileMenu(page);
          await expect(
            page.locator('a[href="/provisional?view=documents"]'),
          ).toHaveCount(0);
          await expect(
            page.locator(".workspace-nav-unavailable:visible").first(),
          ).toContainText("Indisponible en provisoire");
        }
        await page.goto("/provisional?new=1");
        const form = page.locator("#new-child form");
        await form.locator('[name="given_name"]').fill("Enfant fictif");
        await form
          .locator('[name="family_name"]')
          .fill(`HB1 ${run} ${info.project.name}`);
        await form.locator('[name="birth_date"]').fill("2025-01-01");
        await form.locator('[name="syntheticOnly"]').check();
        await form
          .getByRole("button", {
            name: "Créer le dossier provisoire",
            exact: true,
          })
          .click();
        await expect(page).toHaveURL(/\/provisional\/[a-f0-9-]{36}$/);
        const childPath = new URL(page.url()).pathname;
        await page.goto(childPath + "?kind=vaccination");
        await page.getByRole("combobox", { name: /^Vaccin/ }).fill("HB");
        await page.getByRole("option", { name: /· HB/ }).first().click();
        await page
          .getByRole("combobox", { name: /^Dose déclarée/ })
          .fill("HB1");
        await page.getByRole("option", { name: /HB1/ }).first().click();
        await page
          .locator('[name="occurrence_precision"]')
          .selectOption("unknown");
        await page
          .locator('[name="source_type"]')
          .selectOption("paper_transcription");
        await page
          .locator('[name="source_reference"]')
          .fill("Document entièrement fictif HB1, source non contrôlée");
        await page
          .getByRole("button", {
            name: "Enregistrer l’entrée provisoire",
            exact: true,
          })
          .click();
        await expect(page).toHaveURL(new RegExp(childPath + "$"));
        await page.reload();
        await expect(page.locator(".record-list")).toContainText("HB1");
        const body = await page.getByRole("main").innerText();
        const explained =
          /HB1[^\n]*(?:automatique|rattrapage|planifi|calcul)/i.test(body);
        if (acceptance) {
          expect(explained).toBe(true);
          expect(
            await page.evaluate(() =>
              Boolean(
                document
                  .querySelector("#entry-history")!
                  .compareDocumentPosition(
                    document.querySelector("#entry-form")!,
                  ) & Node.DOCUMENT_POSITION_FOLLOWING,
              ),
            ),
          ).toBe(true);
        }
        findings.push({
          role,
          action: "provisional_HB1_save_hard_reload",
          history_visible: true,
          explicit_HB1_next_step_explanation:
            /HB1[^\n]*(?:automatique|rattrapage|planifi|calcul)/i.test(body),
          trusted_schedule_claimed: false,
        });
        const shot = `stabilization-${info.project.name}-${role}-03-HB1-saved-history.png`;
        await page.screenshot({ path: info.outputPath(shot), fullPage: true });
        captures.push(shot);
      }
      await page.goto(home);
      const directLogout = page.getByRole("button", {
        name: "Se déconnecter",
        exact: true,
      });
      if (!(await directLogout.isVisible())) {
        await page
          .getByRole("link", { name: "Compte soignant", exact: true })
          .click();
        await expect(page).toHaveURL(SITE + "/account");
        findings.push({
          role,
          action: "mobile_logout_via_visible_account_link",
          home_logout_visible: false,
        });
      }
      await page
        .getByRole("button", { name: "Se déconnecter", exact: true })
        .click();
      await expect(page).toHaveURL(/\/login/);
      await page.goto(home);
      await expect(page).toHaveURL(/\/login/);
    }
    expect(errors).toBe(0);
    writeFileSync(
      info.outputPath("stabilization-repro.json"),
      JSON.stringify(
        {
          fixture_run: run,
          canonical: SITE,
          device: info.project.name,
          status: acceptance
            ? "scoped_navigation_provisional_HB1_pass"
            : "observations_captured_not_fix_acceptance",
          findings,
          captures,
          page_errors: errors,
        },
        null,
        2,
      ),
    );
  },
);
