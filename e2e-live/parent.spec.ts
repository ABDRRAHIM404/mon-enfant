import {
  test,
  expect,
  type BrowserContext,
  type Page,
  type Locator,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import jsQR from "jsqr";
import { observeBrowserErrors } from "./browser-errors";
const SITE = "https://mon-enfant.vercel.app",
  API = "https://zkkasbxvdvecnafgjpxd.supabase.co";
type Role = "DOCTOR" | "PARENT" | "SECOND" | "OUTSIDE";
const reason =
  "Vérification entièrement fictive pour le test parent, sans valeur clinique.";
function credential(role: Role, field: "EMAIL" | "PASSWORD") {
  const value = process.env[`MON_ENFANT_PARENT_BROWSER_${role}_${field}`];
  if (!value) throw new Error("Missing temporary parent credentials");
  return value;
}
async function login(page: Page, role: Role) {
  await page.goto(
    role === "DOCTOR" || role === "OUTSIDE"
      ? "/login"
      : "/login?audience=parent",
  );
  await page.locator('[name="email"]').fill(credential(role, "EMAIL"));
  await page.locator('[name="password"]').fill(credential(role, "PASSWORD"));
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(
    role === "DOCTOR" || role === "OUTSIDE" ? /\/account$/ : /\/parent$/,
  );
}
async function token(context: BrowserContext) {
  const key = "sb-zkkasbxvdvecnafgjpxd-auth-token",
    cookies = (await context.cookies()).filter(
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
    throw new Error("Missing private browser session");
  return (
    JSON.parse(Buffer.from(encoded.slice(7), "base64url").toString("utf8")) as {
      access_token: string;
    }
  ).access_token;
}
async function rpc(
  context: BrowserContext,
  name: string,
  args: Record<string, unknown>,
  anonymous = false,
) {
  const publicKey = process.env.MON_ENFANT_PARENT_BROWSER_PUBLIC_KEY;
  if (!publicKey) throw new Error("Missing public application key");
  const headers: Record<string, string> = {
    apikey: publicKey,
    "Content-Type": "application/json",
  };
  if (!anonymous) headers.Authorization = `Bearer ${await token(context)}`;
  const response = await context.request.post(`${API}/rest/v1/rpc/${name}`, {
    headers,
    data: args,
  });
  const data = await response.json();
  if (response.status() >= 400)
    console.log(
      JSON.stringify({
        event: "synthetic_parent_rpc_result",
        operation: name,
        status: response.status(),
        code:
          typeof data?.code === "string" &&
          /^(?:[A-Z0-9]{5}|PGRST[0-9]{3})$/.test(data.code)
            ? data.code
            : null,
      }),
    );
  return { status: response.status(), data };
}
async function decode(svg: Locator) {
  const box = await svg.boundingBox();
  console.log(
    JSON.stringify({
      event: "synthetic_parent_qr_geometry",
      width: box?.width ?? 0,
      height: box?.height ?? 0,
    }),
  );
  const png = await svg.screenshot();
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  if (!decoded) throw new Error("PARENT_QR_DECODE_FAILED");
  return decoded.data;
}
async function profile(page: Page, name: string) {
  await page.goto("/parent");
  await page.locator('[name="displayName"]').fill(name);
  await page
    .getByRole("button", {
      name: /Activer mon espace parent|Enregistrer mon profil/,
    })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Votre profil parent est enregistré" }),
  ).toBeVisible();
}
async function invite(doctor: Page, child: string, role: "PARENT" | "SECOND") {
  await doctor.goto(`/patients/${child}/guardians`);
  await doctor
    .locator('[name="recipientEmail"]')
    .fill(credential(role, "EMAIL"));
  await doctor
    .locator("form")
    .filter({ has: doctor.locator('[name="recipientEmail"]') })
    .locator('[name="reason"]')
    .fill(reason);
  await doctor
    .getByRole("button", { name: "Créer ou remplacer l’invitation" })
    .click();
  await expect(doctor.locator("#invitation-url")).toBeVisible();
  const url = await doctor.locator("#invitation-url").inputValue();
  const scanned = await decode(doctor.locator(".qr-code svg"));
  expect(scanned === url).toBe(true);
  return url;
}
async function claim(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('[name="token"]')).not.toHaveValue("");
  const operation = await page.locator('[name="operationId"]').inputValue();
  await page.locator('[name="relationship"]').selectOption("mother");
  await page.locator('[name="consent"]').check();
  await page.getByRole("button", { name: "Soumettre ma demande" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Votre demande a été enregistrée" }),
  ).toBeVisible();
  return operation;
}
async function approve(
  doctor: Page,
  child: string,
  role: "PARENT" | "SECOND",
  canExport: boolean,
) {
  await doctor.goto(`/patients/${child}/guardians`);
  const article = doctor
    .locator("article")
    .filter({ has: doctor.locator('[name="claimId"]') })
    .filter({ hasText: credential(role, "EMAIL") });
  const claimId = await article.locator('[name="claimId"]').inputValue();
  const expires = await article.locator('[name="expiresOn"]').inputValue();
  await article.locator('[name="decision"]').selectOption("approved");
  await article.locator('[name="relationship"]').selectOption("mother");
  await article.locator('[name="identityChecked"]').check();
  await article.locator('[name="guardianshipChecked"]').check();
  await article.locator('[name="authorityReference"]').fill(reason);
  await article.locator('[name="reason"]').fill(reason);
  if (canExport) await article.locator('[name="canExport"]').check();
  await article
    .getByRole("button", { name: "Enregistrer la vérification" })
    .click();
  await expect(doctor.locator('[name="claimId"]')).toHaveCount(0);
  return { claimId, expires };
}

test("verified parents use an existing child; unrelated, replayed and revoked access stays denied", async ({
  browser,
  page,
}, info) => {
  const run = process.env.MON_ENFANT_QA_RUN!,
    device = info.project.name,
    contexts: BrowserContext[] = [];
  let stage = "setup",
    pageErrors = 0;
  const proof: Record<string, unknown> = {
    run,
    device,
    synthetic_only: true,
    passed: false,
  };
  try {
    const doctor = page;
    observeBrowserErrors(doctor, "parent-doctor", () => pageErrors++);
    const others: Page[] = [];
    for (const role of ["PARENT", "SECOND", "OUTSIDE"] as const) {
      const context = await browser.newContext({
        baseURL: SITE,
        viewport: info.project.use.viewport,
        isMobile: info.project.use.isMobile,
        hasTouch: info.project.use.hasTouch,
        userAgent: info.project.use.userAgent,
        deviceScaleFactor: info.project.use.deviceScaleFactor,
      });
      contexts.push(context);
      const p = await context.newPage();
      observeBrowserErrors(p, role, () => pageErrors++);
      await login(p, role);
      others.push(p);
    }
    const [parent, second, outside] = others;
    await login(doctor, "DOCTOR");
    stage = "parent-profile";
    await profile(parent, "Responsable fictif principal");
    await profile(second, "Responsable fictif secondaire");
    await profile(outside, "Demandeur fictif sans autorisation");
    stage = "doctor-register";
    const place = `Centre parent fictif ${run}-${device}`,
      family = `${run}-${device}`,
      childName = `Enfant fictif ${family}`;
    await doctor.goto("/practices");
    await doctor
      .getByLabel("Nom du lieu d’exercice", { exact: true })
      .fill(place);
    await doctor.getByLabel("Ville", { exact: true }).fill("Rabat fictif");
    await doctor.getByRole("button", { name: "Déclarer ce lieu" }).click();
    await expect(
      doctor.getByRole("status").filter({ hasText: "Opération enregistrée" }),
    ).toBeVisible();
    await doctor.goto("/patients/new");
    await doctor
      .locator('[name="facility_id"]')
      .selectOption({ label: `${place} — Rabat fictif` });
    const facility = await doctor.locator('[name="facility_id"]').inputValue();
    await doctor.getByLabel("Année du registre", { exact: true }).fill("2026");
    await doctor
      .getByLabel("Livre / série du registre", { exact: true })
      .fill(device);
    await doctor
      .getByLabel("Numéro local (zéros conservés)", { exact: true })
      .fill("125");
    await doctor
      .getByLabel("Prénom (si connu)", { exact: true })
      .fill("Enfant fictif");
    await doctor.getByLabel("Nom (si connu)", { exact: true }).fill(family);
    await doctor
      .getByLabel("Date de naissance (si connue)", { exact: true })
      .fill("2025-01-01");
    await doctor.locator('[name="syntheticOnly"]').check();
    await doctor
      .getByRole("button", { name: "Créer le dossier et le numéro local" })
      .click();
    await expect(doctor).toHaveURL(/\/patients\/[a-f0-9-]{36}$/i);
    const child = new URL(doctor.url()).pathname.split("/").at(-1)!;
    const universal = (
      await doctor
        .locator("dt")
        .filter({ hasText: /^Identifiant universel$/ })
        .locator("+ dd")
        .innerText()
    ).trim();
    stage = "identifier-qr";
    const identifierUrl = await decode(doctor.locator(".qr-code svg"));
    expect(identifierUrl === `${SITE}/patients/lookup/${universal}`).toBe(true);
    await outside.goto(identifierUrl);
    await expect(
      outside.getByRole("heading", { name: "Accès à vérifier", exact: true }),
    ).toBeVisible();
    expect(
      (await outside.locator("body").innerText()).includes(childName),
    ).toBe(false);
    await doctor.goto(identifierUrl);
    await expect(doctor).toHaveURL(new RegExp(`/patients/${child}$`));
    proof.identifier_qr_current_authority = true;
    stage = "seed-attributed-care";
    const base = {
      p_child_id: child,
      p_facility_id: facility,
      p_occurred_on: "2026-01-02",
      p_occurrence_precision: "exact",
      p_source_type: "observed",
      p_source_reference: null,
      p_source_verified: true,
    };
    const original = await rpc(doctor.context(), "write_clinical_entry", {
      ...base,
      p_operation_id: randomUUID(),
      p_kind: "consultation",
      p_payload: {
        reason: "Contrôle entièrement fictif",
        findings: "Observation fictive initiale",
      },
    });
    expect(original.status).toBe(200);
    const root = original.data as string;
    expect(
      (
        await rpc(doctor.context(), "write_clinical_entry", {
          ...base,
          p_operation_id: randomUUID(),
          p_kind: "growth",
          p_payload: { weight_kg: 9.25, height_cm: 73, head_cm: 44 },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await rpc(doctor.context(), "write_clinical_entry", {
          ...base,
          p_operation_id: randomUUID(),
          p_kind: "vaccination",
          p_source_type: "paper_transcription",
          p_source_reference: reason,
          p_source_verified: false,
          p_payload: {
            vaccine_code: "VPO",
            vaccine_label: "Vaccin entièrement fictif transcrit",
            dose_label: "Dose non confirmée",
            lot_status: "unknown",
            lot_number: "",
            site_status: "unknown",
            site: "",
            provider_status: "unknown",
            administered_by: "",
            administration_facility_status: "unknown",
            administration_facility: "",
            matching_status: "unmatched",
            schedule_item_id: "",
            notes: "Transcription entièrement fictive",
          },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await rpc(doctor.context(), "create_appointment", {
          p_operation_id: randomUUID(),
          p_child_id: child,
          p_facility_id: facility,
          p_purpose: "consultation",
          p_purpose_label: "Rendez-vous entièrement fictif",
          p_vaccine_item_id: null,
          p_starts_at: "2026-01-03T10:00:00+01:00",
          p_ends_at: "2026-01-03T10:30:00+01:00",
          p_reason: reason,
          p_reviewed: true,
        })
      ).status,
    ).toBe(200);
    stage = "invitation-create-and-decode";
    const url = await invite(doctor, child, "PARENT"),
      secret = new URL(url).hash.slice("#invite=".length);
    proof.invitation_qr_decoded = true;
    stage = "invitation-unrelated";
    await outside.goto(url);
    await outside.locator('[name="relationship"]').selectOption("other");
    await outside.locator('[name="consent"]').check();
    await outside.getByRole("button", { name: "Soumettre ma demande" }).click();
    await expect(outside.locator(".form-error[role=alert]")).toContainText(
      "Invitation indisponible",
    );
    expect(
      (await outside.locator("body").innerText()).includes(childName),
    ).toBe(false);
    proof.unrelated_business_error_count = await outside
      .locator(".form-error[role=alert]")
      .count();
    proof.unrelated_scanner_denied = true;
    stage = "claim-and-pending";
    const operation = await claim(parent, url);
    expect(
      (
        await parent.context().request.get(`/parent/children/${child}/export`)
      ).status(),
    ).toBe(404);
    const pending = await rpc(parent.context(), "parent_child_booklet", {
      p_child_id: child,
    });
    expect(pending.status).toBe(403);
    const retry = await rpc(parent.context(), "claim_guardian_invitation", {
      p_operation_id: operation,
      p_token: secret,
      p_relationship: "mother",
      p_consent: true,
    });
    expect(retry.status).toBe(200);
    const consumed = await rpc(parent.context(), "claim_guardian_invitation", {
      p_operation_id: randomUUID(),
      p_token: secret,
      p_relationship: "mother",
      p_consent: true,
    });
    expect(consumed.status).toBe(409);
    expect(consumed.data.code).toBe("PT409");
    proof.claim_idempotency_and_http_conflict = true;
    stage = "independent-approval";
    const review = await approve(doctor, child, "PARENT", true);
    const conflict = await rpc(doctor.context(), "review_guardian_claim", {
      p_operation_id: randomUUID(),
      p_claim_id: review.claimId,
      p_expected_revision: 1,
      p_decision: "approved",
      p_relationship: "mother",
      p_authority_reference: reason,
      p_reason: reason,
      p_identity_checked: true,
      p_guardianship_checked: true,
      p_expires_on: review.expires,
      p_can_export: true,
    });
    expect(conflict.status).toBe(409);
    expect(conflict.data.code).toBe("PT409");
    proof.review_http_conflict = true;
    stage = "parent-booklet";
    await parent.goto(`/parent/children/${child}`);
    await expect(
      parent.getByRole("heading", { name: childName, exact: true }),
    ).toBeVisible();
    await expect(
      parent.getByText("Observation fictive initiale", { exact: true }),
    ).toBeVisible();
    await expect(
      parent.getByText("Vaccin entièrement fictif transcrit", { exact: true }),
    ).toBeVisible();
    expect(await parent.locator(".growth-chart").count()).toBe(3);
    expect(
      await parent.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await parent.goto(
      `/parent/children/${child}/appointments?date=2026-01-03&view=month`,
    );
    await expect(
      parent.getByText("Rendez-vous entièrement fictif", { exact: true }),
    ).toBeVisible();
    await parent.goto(`/parent/children/${child}/vaccinations`);
    await expect(parent.getByText(/Aucune référence assignée/)).toBeVisible();
    proof.parent_views = true;
    stage = "correction-request";
    await parent.goto(`/parent/children/${child}/requests?entry=${root}`);
    await parent.locator('[name="message"]').fill(reason);
    await parent.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(
      parent.getByRole("status").filter({ hasText: "Demande enregistrée" }),
    ).toBeVisible();
    const amendment = await rpc(doctor.context(), "write_clinical_entry", {
      ...base,
      p_operation_id: randomUUID(),
      p_kind: "consultation",
      p_payload: {
        reason: "Contrôle entièrement fictif",
        findings: "Observation fictive corrigée",
      },
      p_root_id: root,
      p_expected_revision: 1,
      p_amendment_reason: reason,
      p_entry_state: "active",
    });
    expect(amendment.status).toBe(200);
    await doctor.goto("/parent-requests");
    const request = doctor
      .locator("article")
      .filter({
        has: doctor.getByRole("heading", {
          name: "Information clinique",
          exact: true,
        }),
      })
      .filter({ hasText: family });
    await request.locator('[name="outcome"]').selectOption("corrected");
    await request
      .locator('[name="correctionEntryId"]')
      .selectOption(amendment.data as string);
    await request.locator('[name="message"]').fill(reason);
    await request
      .getByRole("button", { name: "Enregistrer la réponse" })
      .click();
    await expect(
      request.getByRole("heading", { name: "Amendement clinique enregistré" }),
    ).toBeVisible();
    await parent.reload();
    await expect(
      parent.getByRole("heading", { name: "Amendement clinique enregistré" }),
    ).toBeVisible();
    proof.request_real_amendment = true;
    stage = "export-and-parent-write-denial";
    const exported = await parent
      .context()
      .request.get(`/parent/children/${child}/export`);
    expect(exported.status()).toBe(200);
    const ledger = await exported.json();
    expect(ledger.child.id === child).toBe(true);
    expect(ledger.clinical_entries.length).toBe(4);
    expect(
      ledger.clinical_entries.filter(
        (e: { root_id: string }) => e.root_id === root,
      ).length,
    ).toBe(2);
    expect(
      (
        await rpc(parent.context(), "write_clinical_entry", {
          ...base,
          p_operation_id: randomUUID(),
          p_kind: "consultation",
          p_payload: { reason },
        })
      ).status,
    ).toBe(403);
    const anonymous = await rpc(
      parent.context(),
      "parent_child_booklet",
      { p_child_id: child },
      true,
    );
    expect([401, 403].includes(anonymous.status)).toBe(true);
    proof.export_revisions_and_denials = true;
    stage = "notifications-preferences-history";
    await parent.goto("/parent/settings");
    await parent.locator('[name="reminderDays"]').selectOption("3");
    await parent
      .getByRole("button", { name: "Enregistrer mes préférences" })
      .click();
    await expect(parent.getByRole("status")).toContainText(
      "Préférences enregistrées",
    );
    await parent.goto(`/parent/children/${child}/privacy`);
    await expect(
      parent.getByRole("heading", {
        name: "Confidentialité et accès",
        exact: true,
      }),
    ).toBeVisible();
    await parent.goto("/parent/notifications");
    await expect(
      parent.getByRole("heading", {
        name: "Réponse à votre demande",
        exact: true,
      }),
    ).toBeVisible();
    await parent
      .getByRole("button", { name: "Tout marquer comme consulté" })
      .click();
    await expect(parent.getByText(/^0 non consultées/)).toBeVisible();
    proof.notifications_preferences_history = true;
    stage = "second-guardian";
    const secondUrl = await invite(doctor, child, "SECOND");
    await claim(second, secondUrl);
    await approve(doctor, child, "SECOND", false);
    await second.goto(`/parent/children/${child}`);
    await expect(
      second.getByRole("heading", { name: childName, exact: true }),
    ).toBeVisible();
    expect(
      (
        await second.context().request.get(`/parent/children/${child}/export`)
      ).status(),
    ).toBe(404);
    const privateReplies = await rpc(second.context(), "parent_corrections", {
      p_child_id: child,
    });
    expect(privateReplies.status).toBe(200);
    expect(privateReplies.data.total).toBe(0);
    proof.independent_guardian_export_and_message_scope = true;
    stage = "doctor-revocation";
    await doctor.goto(`/patients/${child}/guardians`);
    const linked = doctor.locator("article").filter({
      has: doctor.getByRole("heading", {
        name: "Responsable fictif principal",
        exact: true,
      }),
    });
    await linked.locator('[name="reason"]').fill(reason);
    await linked.getByRole("button", { name: "Retirer cet accès" }).click();
    await expect(linked.getByText(/retiré/)).toBeVisible();
    expect(
      (
        await parent.context().request.get(`/parent/children/${child}`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await parent.context().request.get(`/parent/children/${child}/export`)
      ).status(),
    ).toBe(404);
    const revokedFeed = await rpc(parent.context(), "parent_updates", {});
    expect(revokedFeed.status).toBe(200);
    expect(JSON.stringify(revokedFeed.data).includes(child)).toBe(false);
    await second.reload();
    await expect(
      second.getByRole("heading", { name: childName, exact: true }),
    ).toBeVisible();
    proof.current_revocation_without_harming_other_guardian = true;
    stage = "self-withdrawal";
    await second.locator('#access [name="reason"]').fill(reason);
    await second
      .locator("#access")
      .getByRole("button", { name: "Retirer cet accès" })
      .click();
    await expect(second).toHaveURL(/\/parent$/);
    expect(
      (
        await second.context().request.get(`/parent/children/${child}/export`)
      ).status(),
    ).toBe(404);
    proof.own_withdrawal = true;
    expect(pageErrors).toBe(0);
    proof.page_errors = pageErrors;
    proof.passed = true;
  } catch (error) {
    proof.failed_stage = stage;
    if (error instanceof Error && error.message === "PARENT_QR_DECODE_FAILED")
      proof.failure_code = "qr_decode_failed";
    throw new Error(
      `Synthetic parent workflow failed at ${stage}; private URLs, tokens, credentials and DOM withheld.`,
    );
  } finally {
    writeFileSync(
      info.outputPath("parent-proof.json"),
      JSON.stringify(proof, null, 2),
    );
    await Promise.all(contexts.map((context) => context.close()));
  }
});
