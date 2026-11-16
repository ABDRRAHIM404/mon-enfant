import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";

// Inspect the existing synthetic case; never prepare a replacement fixture here.
test("inspect provisional correction reasons and verify the fixed save lifecycle", async ({
  page,
}, info) => {
  const run = process.env.MON_ENFANT_QA_RUN!;
  const prefix = "MON_ENFANT_CLINICAL_BROWSER_OUTSIDE_";
  expect(process.env[prefix + "EMAIL"]).toBe(
    `qa-cbrowser-${run}-outside@example.invalid`,
  );
  const signIn = async () => {
    await page.goto("/login?audience=clinician");
    await page.locator('[name="email"]').fill(process.env[prefix + "EMAIL"]!);
    await page
      .locator('[name="password"]')
      .fill(process.env[prefix + "PASSWORD"]!);
    await page
      .getByRole("button", { name: "Se connecter", exact: true })
      .click();
    await expect(page).toHaveURL(/\/(account|provisional)$/);
  };
  const signOut = async () => {
    await page.goto("/account");
    await page
      .getByRole("button", { name: "Se déconnecter", exact: true })
      .click();
    await expect(page).toHaveURL(/\/login/);
  };
  await signIn();
  await page.goto(
    `/provisional/children?q=${encodeURIComponent(`U5-${run}-desktop`)}`,
  );
  const children = page.locator('main table a[href^="/provisional/"]');
  await expect(children).toHaveCount(1);
  const childPath = (await children.first().getAttribute("href"))!;
  const child = childPath.split("/").at(-1)!;
  await page.goto(`/provisional/consultations?child=${child}`);
  const edit = page.locator('main a[href*="?edit="]').first();
  const editPath = (await edit.getAttribute("href"))!;
  await edit.click();
  const form = page.locator("#entry-form form");
  await expect(form.locator('textarea[name="reason"]')).toBeVisible();
  const originalClinicalReason = await form
    .locator('textarea[name="reason"]')
    .inputValue();
  const previousRevision = Number(
    await form.locator('input[name="revision"]').inputValue(),
  );
  await form
    .locator('textarea[name="reason"]')
    .fill("Motif clinique entièrement fictif distinct du motif de correction");
  await form
    .getByLabel("Motif de correction", { exact: true })
    .fill("Correction technique fictive motivée séparément");
  const fields = await form.evaluate((element) => {
    const data = new FormData(element as HTMLFormElement);
    return {
      reasonCount: data.getAll("reason").length,
      clinicalReason: data.get("reason"),
      amendmentReason: data.get("correction_reason"),
    };
  });
  const fixed = process.env.MON_ENFANT_CORRECTION_EXPECT_FIXED === "1";
  if (fixed) {
    expect(fields.reasonCount).toBe(1);
    expect(fields.amendmentReason).toBe(
      "Correction technique fictive motivée séparément",
    );
  } else {
    expect(fields.reasonCount).toBe(2);
    expect(fields.amendmentReason).toBeNull();
  }
  let submitted = false;
  let expectedRevision = previousRevision;
  if (fixed) {
    if (originalClinicalReason !== fields.clinicalReason) {
      await form
        .getByRole("button", { name: "Enregistrer la correction", exact: true })
        .click();
      await expect(page).toHaveURL(new URL(childPath, page.url()).toString());
      submitted = true;
      expectedRevision++;
    } else await page.goto(childPath);
    await page.reload();
    const verifyHistory = async () => {
      const heading = page.getByRole("heading", {
        level: 3,
        name: new RegExp(`Consultation\\s*·\\s*Révision ${expectedRevision}$`),
      });
      const entry = page
        .locator("#entry-history article")
        .filter({ has: heading });
      await expect(entry).toHaveCount(1);
      await expect(entry).toContainText(String(fields.clinicalReason));
      await expect(entry).toContainText(`Motif : ${fields.amendmentReason}`);
      await expect(page.locator("#entry-history")).toContainText("Révision 1");
    };
    await verifyHistory();
    await signOut();
    await signIn();
    await page.goto(childPath);
    await verifyHistory();
  }
  writeFileSync(
    info.outputPath("provisional-correction-fields.json"),
    JSON.stringify(
      {
        run,
        child,
        editPath,
        stage: fixed
          ? "correction_save_reload_new_session_pass"
          : "duplicate_reason_fields_reproduced",
        fields,
        submitted,
        previousRevision,
        expectedRevision,
      },
      null,
      2,
    ),
  );
  // The before-stage only inspects fields; fixed-stage writes one immutable correction.
  await signOut();
});
