import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { observeBrowserErrors } from "./browser-errors";
const SITE = "https://mon-enfant.vercel.app",
  API = "https://zkkasbxvdvecnafgjpxd.supabase.co";
type Role = "DOCTOR" | "OUTSIDE" | "PARENT" | "SECOND";
const credential = (role: Role, field: string) => {
  const v = process.env[`MON_ENFANT_PARENT_BROWSER_${role}_${field}`];
  if (!v) throw new Error("Missing temporary fixture");
  return v;
};
async function login(page: Page, role: Role, parent = false) {
  await page.goto(parent ? "/login" : "/login?audience=clinician");
  await page.locator('[name="email"]').fill(credential(role, "EMAIL"));
  await page.locator('[name="password"]').fill(credential(role, "PASSWORD"));
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(
    parent ? /\/parent$/ : /\/(dashboard|account|provisional)$/,
  );
}
async function rpc(
  context: BrowserContext,
  name: string,
  args: Record<string, unknown>,
) {
  const key = "sb-zkkasbxvdvecnafgjpxd-auth-token";
  const cookies = (await context.cookies()).filter(
    (c) => c.name === key || c.name.startsWith(key + "."),
  );
  const encoded =
    cookies.find((c) => c.name === key)?.value ??
    cookies
      .sort(
        (a, b) =>
          Number(a.name.slice(key.length + 1)) -
          Number(b.name.slice(key.length + 1)),
      )
      .map((c) => c.value)
      .join("");
  if (!encoded.startsWith("base64-"))
    throw new Error("Missing private session");
  const token = (
    JSON.parse(Buffer.from(encoded.slice(7), "base64url").toString("utf8")) as {
      access_token: string;
    }
  ).access_token;
  const response = await context.request.post(`${API}/rest/v1/rpc/${name}`, {
    headers: {
      apikey: process.env.MON_ENFANT_PARENT_BROWSER_PUBLIC_KEY!,
      Authorization: `Bearer ${token}`,
    },
    data: args,
  });
  return { status: response.status(), body: await response.json() };
}
async function practice(page: Page, name: string) {
  await page.goto("/practices");
  await page.getByLabel("Nom du lieu d’exercice", { exact: true }).fill(name);
  await page.getByLabel("Ville", { exact: true }).fill("Rabat fictif");
  await page.getByRole("button", { name: "Déclarer ce lieu" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Opération enregistrée" }),
  ).toBeVisible();
}
async function trustedForm(
  page: Page,
  place: string,
  family: string,
  device: string,
) {
  await page.goto("/patients/new");
  await page
    .locator('[name="facility_id"]')
    .selectOption({ label: `${place} — Rabat fictif` });
  await page.locator('[name="register_year"]').fill("2026");
  await page.locator('[name="register_book"]').fill(device);
  await page.locator('[name="local_number"]').fill("125");
  await page.locator('[name="given_name"]').fill(family);
  await page.locator('[name="family_name"]').fill(family);
  await page.locator('[name="birth_date"]').fill("2025-01-01");
  await page.locator('[name="sex"]').selectOption("male");
  await page.locator('[name="syntheticOnly"]').check();
}
test("requested duplicate and provisional onboarding fixes preserve private boundaries", async ({
  browser,
  page,
}, info) => {
  const proof: Record<string, unknown> = {
    passed: false,
    synthetic_only: true,
    device: info.project.name,
  };
  let stage = "parent-entry",
    errors = 0;
  const contexts: BrowserContext[] = [];
  try {
    observeBrowserErrors(page, "updates", () => errors++);
    await page.goto("/");
    await page.getByRole("link", { name: /Accéder à mon espace/ }).click();
    await expect(
      page.getByText("MON ENFANT · PARENTS", { exact: true }),
    ).toBeVisible();
    await login(page, "PARENT", true);
    await page.getByRole("link", { name: "Mon compte", exact: true }).click();
    await expect(
      page.getByText("COMPTE PARENT", { exact: true }),
    ).toBeVisible();
    expect(await page.locator("body").innerText()).not.toContain(
      "Soumettre mes justificatifs",
    );
    proof.parent_separate = true;
    stage = "nurse-enrollment";
    await login(page, "SECOND");
    if (new URL(page.url()).pathname === "/account") {
      await page.locator('[name="role"]').selectOption("nurse");
      await page
        .getByRole("button", {
          name: "Activer mon espace soignant",
          exact: true,
        })
        .click();
    }
    await expect(page).toHaveURL(/\/provisional$/);
    await expect(page.getByText(/Compte : Non vérifié/)).toBeVisible();
    const family = `${process.env.MON_ENFANT_QA_RUN}-${info.project.name}`;
    await page.locator('[name="given_name"]').fill(family);
    await page.locator('[name="family_name"]').fill(family);
    await page.locator('[name="birth_date"]').fill("2025-01-01");
    await page.locator('[name="syntheticOnly"]').check();
    await page
      .getByRole("button", { name: "Créer le dossier provisoire", exact: true })
      .click();
    await expect(page).toHaveURL(/\/provisional\/[a-f0-9-]{36}$/);
    const child = new URL(page.url()).pathname.split("/").at(-1)!;
    stage = "persistent-core-workflows";
    const cases: [string, Record<string, string>][] = [
      ["consultation", { reason: "Motif entièrement fictif" }],
      [
        "prescription",
        {
          medication: "Traitement fictif",
          instructions: "Instructions fictives",
        },
      ],
      ["risk", { description: "Risque fictif" }],
      ["growth", { weight_kg: "4.5" }],
      [
        "vaccination",
        { vaccine_label: "Vaccin fictif", dose_label: "Dose fictive" },
      ],
      [
        "appointment",
        { purpose: "Visite fictive", scheduled_for: "2026-12-01T09:00+01:00" },
      ],
    ];
    for (const [kind, fields] of cases) {
      await page.locator('[name="kind"]').selectOption(kind);
      for (const [k, v] of Object.entries(fields))
        await page.locator(`[name="${k}"]`).fill(v);
      await page.locator('[name="occurred_on"]').fill("2026-01-02");
      await page
        .getByRole("button", {
          name: "Enregistrer l’entrée provisoire",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("heading", {
          name: new RegExp(
            `Historique immuable \\(${cases.findIndex((c) => c[0] === kind) + 1} révisions\\)`,
          ),
        }),
      ).toBeVisible();
    }
    await page.reload();
    const booklet = await rpc(page.context(), "provisional_booklet", {
      p_child_id: child,
    });
    expect(booklet.status).toBe(200);
    expect(booklet.body.total).toBe(6);
    expect(
      booklet.body.entries.every(
        (e: { validation_state: string; author_role: string }) =>
          e.validation_state === "unverified" && e.author_role === "nurse",
      ),
    ).toBe(true);
    proof.persistent_core_workflows = true;
    stage = "immutable-correction";
    const entry = booklet.body.entries.find(
      (e: { kind: string }) => e.kind === "appointment",
    );
    await page.goto(`/provisional/${child}?edit=${entry.root_id}`);
    await page.locator('[name="status"]').selectOption("rescheduled");
    await page.locator('[name="scheduled_for"]').fill("2026-12-02T09:00+01:00");
    await page
      .locator('[name="reason"]')
      .fill("Changement entièrement fictif et tracé.");
    await page
      .getByRole("button", { name: "Enregistrer la correction", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: /Historique immuable \(7 révisions\)/,
      }),
    ).toBeVisible();
    const stale = await rpc(page.context(), "write_provisional_entry", {
      p_operation_id: crypto.randomUUID(),
      p_child_id: child,
      p_kind: "appointment",
      p_occurred_on: "2026-01-02",
      p_occurrence_precision: "exact",
      p_source_type: "observed",
      p_source_reference: null,
      p_payload: entry.payload,
      p_root_id: entry.root_id,
      p_expected_revision: 1,
      p_reason: "Correction concurrente entièrement fictive",
      p_entry_state: "active",
    });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("PT409");
    proof.immutable_history_http409 = true;
    stage = "cross-author-denial";
    const outsideContext = await browser.newContext({
      baseURL: SITE,
      viewport: info.project.use.viewport,
      isMobile: info.project.use.isMobile,
      hasTouch: info.project.use.hasTouch,
      userAgent: info.project.use.userAgent,
      deviceScaleFactor: info.project.use.deviceScaleFactor,
    });
    contexts.push(outsideContext);
    const outside = await outsideContext.newPage();
    observeBrowserErrors(outside, "outside", () => errors++);
    await login(outside, "OUTSIDE");
    expect(
      (await rpc(outsideContext, "provisional_booklet", { p_child_id: child }))
        .status,
    ).toBe(403);
    const response = await outside.goto(`/provisional/${child}`);
    expect(response?.status()).toBe(404);
    expect(await outside.locator("body").innerText()).not.toContain(family);
    expect(
      (await outside.request.get(`/patients/${child}/export`)).status(),
    ).toBe(404);
    expect(
      (await rpc(page.context(), "get_child_profile", { p_child_id: child }))
        .status,
    ).toBe(403);
    proof.cross_author_api_ui_export_denial = true;
    stage = "duplicate-registration";
    const doctorContext = await browser.newContext({
      baseURL: SITE,
      viewport: info.project.use.viewport,
      isMobile: info.project.use.isMobile,
      hasTouch: info.project.use.hasTouch,
      userAgent: info.project.use.userAgent,
      deviceScaleFactor: info.project.use.deviceScaleFactor,
    });
    contexts.push(doctorContext);
    const doctor = await doctorContext.newPage();
    observeBrowserErrors(doctor, "doctor", () => errors++);
    await login(doctor, "DOCTOR");
    const place = `Centre fictif ${family}`;
    await practice(doctor, place);
    await trustedForm(doctor, place, family, info.project.name);
    await doctor
      .locator("summary")
      .filter({ hasText: "Informations de naissance" })
      .click();
    await doctor
      .locator('[name="mother_name"]')
      .fill("Mère entièrement fictive");
    await doctor
      .locator('[name="birthplace"]')
      .fill("Maternité entièrement fictive");
    await doctor
      .getByRole("button", { name: "Créer le dossier et le numéro local" })
      .click();
    await expect(doctor).toHaveURL(/\/patients\/[a-f0-9-]{36}$/);
    const trusted = new URL(doctor.url()).pathname.split("/").at(-1)!;
    const otherPlace = `Autre centre fictif ${family}`;
    await practice(outside, otherPlace);
    await trustedForm(outside, otherPlace, family, info.project.name);
    await outside
      .getByRole("button", { name: "Créer le dossier et le numéro local" })
      .click();
    await expect(
      outside
        .getByRole("alert")
        .filter({ hasText: "A child with similar details" }),
    ).toBeVisible();
    expect(await outside.locator("body").innerText()).not.toContain(trusted);
    await outside
      .locator('[name="mother_name"]')
      .fill("Mère entièrement fictive");
    await outside
      .locator('[name="birthplace"]')
      .fill("Maternité entièrement fictive");
    await outside
      .getByRole("button", { name: "Créer le dossier et le numéro local" })
      .click();
    await expect(outside.locator("body")).toContainText("QR");
    expect(
      (await rpc(outsideContext, "get_child_profile", { p_child_id: trusted }))
        .status,
    ).toBe(403);
    proof.duplicate_private_warning_secondary_no_access = true;
    expect(errors).toBe(0);
    proof.page_errors = errors;
    proof.passed = true;
  } catch (error) {
    proof.failed_stage = stage;
    if (
      error instanceof Error &&
      error.message.includes("strict mode violation")
    )
      proof.failure_code = "selector_not_unique";
    throw new Error(
      `Synthetic update acceptance failed at ${stage}; private URLs, credentials, payloads and DOM withheld.`,
    );
  } finally {
    writeFileSync(
      info.outputPath("updates-proof.json"),
      JSON.stringify(proof, null, 2),
    );
    await Promise.all(contexts.map((c) => c.close()));
  }
});
