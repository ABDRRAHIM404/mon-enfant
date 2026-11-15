import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";

test("provisional child controls remain separated and usable on desktop and Android web", async ({
  page,
}, info) => {
  const run = process.env.MON_ENFANT_QA_RUN!;
  const email = process.env.MON_ENFANT_PARENT_BROWSER_SECOND_EMAIL!;
  const password = process.env.MON_ENFANT_PARENT_BROWSER_SECOND_PASSWORD!;
  expect(email).toBe(`qa-parent-${run}-second@example.invalid`);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  await page.goto("/login?audience=clinician");
  await page.locator('[name="email"]').fill(email);
  await page.locator('[name="password"]').fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/(account|provisional)$/);
  if (new URL(page.url()).pathname === "/account") {
    await page.locator('[name="role"]').selectOption("doctor");
    await page
      .getByRole("button", { name: "Activer mon espace soignant", exact: true })
      .click();
  }
  await page.goto("/provisional?new=1");
  const form = page.locator("#new-child form");
  await expect(form).toBeVisible();
  await form.locator('[name="given_name"]').fill("Enfant fictif");
  await form
    .locator('[name="family_name"]')
    .fill("Famille fictive — mise en page");
  await form
    .locator('[name="source_reference"]')
    .fill(
      "Source entièrement fictive, saisie longue pour vérifier la largeur des champs",
    );
  const captures: string[] = [];
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((value) => {
      localStorage.setItem("mon-enfant-theme", value);
      document.documentElement.dataset.theme = value;
      document.documentElement.style.colorScheme = value;
      window.dispatchEvent(new Event("storage"));
    }, theme);
    await form.scrollIntoViewIfNeeded();
    const geometry = await form.evaluate((element) => {
      const frame = element.getBoundingClientRect();
      const labels = Array.from(
        element.querySelectorAll("label:not(.checkbox)"),
      );
      const controls = labels.map((label) => {
        const control = label.querySelector(
          "input,select,textarea",
        ) as HTMLElement;
        const rect = control.getBoundingClientRect();
        const text = Array.from(label.childNodes).find(
          (node) =>
            node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        );
        const range = document.createRange();
        if (text) range.selectNodeContents(text);
        const textRect = range.getBoundingClientRect();
        const style = getComputedStyle(control);
        return {
          width: rect.width,
          height: rect.height,
          inside: rect.left >= frame.left - 1 && rect.right <= frame.right + 1,
          belowLabel: rect.top >= textRect.bottom + 3,
          border: Number.parseFloat(style.borderTopWidth),
          background: style.backgroundColor,
        };
      });
      const checkbox = element
        .querySelector('input[type="checkbox"]')!
        .getBoundingClientRect();
      return {
        controls,
        checkbox: { width: checkbox.width, height: checkbox.height },
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    expect(geometry.controls).toHaveLength(8);
    for (const control of geometry.controls) {
      expect(control.inside).toBe(true);
      expect(control.belowLabel).toBe(true);
      expect(control.height).toBeGreaterThanOrEqual(44);
      expect(control.width).toBeGreaterThan(120);
      expect(control.border).toBeGreaterThanOrEqual(1);
      expect(control.background).not.toBe("rgba(0, 0, 0, 0)");
    }
    expect(geometry.checkbox.width).toBeGreaterThanOrEqual(18);
    expect(geometry.checkbox.width).toBeLessThanOrEqual(24);
    expect(geometry.overflow).toBe(false);
    const name = `form-layout-${info.project.name}-${theme}.png`;
    await form.screenshot({ path: info.outputPath(name) });
    captures.push(name);
  }
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath("forms-proof.json"),
    JSON.stringify(
      {
        passed: true,
        device: info.project.name,
        synthetic_only: true,
        fixture_run: run,
        actual_provisional_form: true,
        border_and_label_geometry: true,
        horizontal_overflow: false,
        themes: ["light", "dark"],
        created_children: 0,
        page_errors: errors.length,
        captures,
      },
      null,
      2,
    ),
  );
});
