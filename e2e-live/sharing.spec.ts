import {
  test,
  expect,
  type Page,
  type BrowserContext,
  type Locator,
} from "@playwright/test";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import jsQR from "jsqr";
import { observeBrowserErrors } from "./browser-errors";
import {
  localAppointmentInput,
  localAppointmentOffset,
  resolveAppointmentTime,
} from "../src/lib/appointments/calendar";
const SITE = "https://localhost:3443",
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
  if (role === "DOCTOR") await page.locator('input[name="remember"]').check();
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(
    parent ? /\/parent$/ : /\/(dashboard|account|provisional)$/,
  );
  await page.reload();
  const retained = (await page.context().cookies()).filter((c) =>
    /^sb-.+-auth-token(?:\.\d+)?$/.test(c.name),
  );
  expect(retained.length > 0).toBe(true);
  expect(
    retained.every((c) => c.httpOnly && c.secure && c.sameSite === "Lax"),
  ).toBe(true);
  expect(
    retained.every((c) =>
      role === "DOCTOR"
        ? c.expires > Date.now() / 1000 &&
          c.expires <= Date.now() / 1000 + 30 * 86400 + 60
        : c.expires === -1,
    ),
  ).toBe(true);
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
  const text = await response.text();
  return { status: response.status(), body: JSON.parse(text || "null") };
}

async function decode(svg: Locator) {
  const png = await svg.screenshot();
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const value = jsQR(
    new Uint8ClampedArray(data),
    info.width,
    info.height,
  )?.data;
  if (!value) throw new Error("SHARING_QR_DECODE_FAILED");
  return { value, png };
}
test("parent purpose-bound sharing, live concurrent claim and revocation", async ({
  browser,
}, info) => {
  const run = process.env.MON_ENFANT_QA_RUN!;
  const contexts: BrowserContext[] = [];
  let errors = 0;
  async function context() {
    const c = await browser.newContext({
      baseURL: SITE,
      ignoreHTTPSErrors: true,
      viewport: info.project.use.viewport,
      isMobile: info.project.use.isMobile,
      hasTouch: info.project.use.hasTouch,
      userAgent: info.project.use.userAgent,
      deviceScaleFactor: info.project.use.deviceScaleFactor,
    });
    contexts.push(c);
    return c;
  }
  try {
    const dc = await context(),
      pc = await context(),
      rc = await context();
    const doctor = await dc.newPage(),
      parent = await pc.newPage(),
      reader = await rc.newPage();
    for (const [page, role] of [
      [doctor, "doctor"],
      [parent, "parent"],
      [reader, "reader"],
    ] as const)
      observeBrowserErrors(page, role, () => errors++);
    await login(doctor, "DOCTOR");
    const role = info.project.name === "tablet" ? "SECOND" : "PARENT";
    await login(parent, role, true);
    expect(
      (
        await rpc(pc, "save_parent_profile", {
          p_display_name: "Responsable fictif",
        })
      ).status,
    ).toBe(200);
    const facility = await rpc(dc, "create_facility", {
      p_operation_id: randomUUID(),
      p_name: "Centre fictif partage " + info.project.name,
      p_city: "Rabat fictif",
    });
    expect(facility.status).toBe(200);
    const op = randomUUID(),
      payload = {
        facility_id: facility.body,
        register_year: 2026,
        register_book: "PARTAGE-" + info.project.name,
        local_number: "001",
        given_name: "Enfant fictif",
        family_name: run + "-" + info.project.name,
        birth_date: "2025-01-01",
        birth_date_precision: "exact",
        sex: "unknown",
      };
    expect(
      (
        await rpc(dc, "prepare_child_registration", {
          p_operation_id: op,
          p_payload: payload,
        })
      ).status,
    ).toBe(200);
    const registered = await rpc(dc, "register_child", {
      p_operation_id: op,
      p_payload: payload,
    });
    expect(registered.status).toBe(200);
    const child = registered.body as string;
    const invitationToken = randomBytes(32).toString("base64url");
    expect(
      (
        await rpc(dc, "create_guardian_invitation", {
          p_child_id: child,
          p_recipient_email: credential(role, "EMAIL"),
          p_token_hash: createHash("sha256")
            .update(invitationToken)
            .digest("hex"),
          p_reason: "Invitation synthétique sans valeur clinique",
        })
      ).status,
    ).toBe(200);
    const claim = await rpc(pc, "claim_guardian_invitation", {
      p_operation_id: randomUUID(),
      p_token: invitationToken,
      p_relationship: "mother",
      p_consent: true,
    });
    expect(claim.status).toBe(200);
    const decision = await rpc(dc, "review_guardian_claim", {
      p_operation_id: randomUUID(),
      p_claim_id: claim.body,
      p_expected_revision: 1,
      p_decision: "approved",
      p_relationship: "mother",
      p_authority_reference: "Contrôle entièrement fictif",
      p_reason: "Autorité et identité entièrement fictives",
      p_identity_checked: true,
      p_guardianship_checked: true,
      p_expires_on: new Date(Date.now() + 7 * 86400000)
        .toISOString()
        .slice(0, 10),
      p_can_export: true,
    });
    expect(decision.status).toBe(200);
    const vaccinePayload = {
      vaccine_code: "UNKNOWN",
      vaccine_label: "Vaccin transcrit fictif",
      dose_label: "Dose inconnue",
      lot_status: "unknown",
      site_status: "unknown",
      provider_status: "unknown",
      administration_facility_status: "unknown",
      matching_status: "unmatched",
    };
    expect(
      (
        await rpc(dc, "write_clinical_entry", {
          p_operation_id: randomUUID(),
          p_child_id: child,
          p_kind: "vaccination",
          p_facility_id: facility.body,
          p_occurred_on: null,
          p_occurrence_precision: "unknown",
          p_source_type: "paper_transcription",
          p_source_reference: "Source papier fictive",
          p_source_verified: false,
          p_payload: vaccinePayload,
        })
      ).status,
    ).toBe(200);
    const start = new Date(Date.now() + 2 * 86400000);
    start.setUTCSeconds(0, 0);
    const explicit = (d: Date) =>
      resolveAppointmentTime(
        localAppointmentInput(d.toISOString()),
        localAppointmentOffset(d.toISOString()),
      );
    expect(
      (
        await rpc(dc, "create_appointment", {
          p_operation_id: randomUUID(),
          p_child_id: child,
          p_facility_id: facility.body,
          p_purpose: "consultation",
          p_purpose_label: "Consultation fictive partagée",
          p_vaccine_item_id: null,
          p_starts_at: explicit(start),
          p_ends_at: explicit(new Date(start.getTime() + 1800000)),
          p_reason: "Rendez-vous entièrement fictif",
          p_reviewed: true,
        })
      ).status,
    ).toBe(200);
    await parent.goto(`/parent/children/${child}/vaccinations`);
    const panel = parent.getByRole("region", { name: "Partager le carnet" });
    await expect(
      panel.getByRole("button", { name: "Afficher mon QR sécurisé" }),
    ).toBeEnabled();
    await panel.locator('[name="consent"]').check();
    await panel
      .getByRole("button", { name: "Afficher mon QR sécurisé" })
      .click();
    await expect(panel.locator("svg")).toBeVisible();
    const qr = await decode(panel.locator("svg"));
    const u = new URL(qr.value);
    expect(u.pathname).toBe("/share");
    expect(u.search).toBe("");
    expect([...new URLSearchParams(u.hash.slice(1)).keys()]).toEqual(["share"]);
    const secret = new URLSearchParams(u.hash.slice(1)).get("share")!;
    expect(/^[A-Za-z0-9_-]{43}$/.test(secret)).toBe(true);
    expect(qr.value.includes(child)).toBe(false);
    // Open fragment without a session; it stays only in the original page memory while login happens in a separate tab.
    try {
      await reader.goto(qr.value);
    } catch {
      throw new Error("SHARING_ENTRY_NAVIGATION_FAILED");
    }
    await expect.poll(() => reader.evaluate(() => location.hash)).toBe("");
    await reader
      .getByRole("button", { name: "Ouvrir le partage", exact: true })
      .click();
    await expect(reader.getByRole("alert")).toContainText("autre onglet");
    const loginTab = await rc.newPage();
    await login(loginTab, "OUTSIDE");
    await loginTab.close();
    // Exercise the actual local image scanner as well as fragment extraction, without writing QR secrets to artifacts.
    await reader.locator('input[type="file"]').setInputFiles({
      name: "temporary-qr.png",
      mimeType: "image/png",
      buffer: qr.png,
    });
    await expect(reader.getByRole("status")).toContainText("Code lu");
    await reader
      .getByRole("button", { name: "Ouvrir le partage", exact: true })
      .click();
    await expect(reader).toHaveURL(/\/share\/view\/[a-f0-9-]{36}$/);
    const id = reader.url().split("/").at(-1)!;
    await expect(
      reader.getByRole("heading", { name: "Historique vaccinal partagé" }),
    ).toBeVisible();
    await expect(
      reader.getByText("Vaccin transcrit fictif", { exact: false }).first(),
    ).toBeVisible();
    await expect(
      reader.getByRole("heading", { name: "Rendez-vous partagés" }),
    ).toHaveCount(0);
    await reader.screenshot({
      path: info.outputPath("sharing-vaccination.png"),
      fullPage: true,
    });
    expect(
      (await rpc(dc, "redeem_clinician_share", { p_token: secret })).body
        .accepted,
    ).toBe(false);
    expect(
      (await rpc(rc, "get_child_profile", { p_child_id: child })).status,
    ).toBe(403);
    expect(
      (
        await rpc(rc, "write_clinical_entry", {
          p_operation_id: randomUUID(),
          p_child_id: child,
          p_kind: "vaccination",
          p_facility_id: facility.body,
          p_occurred_on: null,
          p_occurrence_precision: "unknown",
          p_source_type: "paper_transcription",
          p_source_reference: "Source fictive",
          p_source_verified: false,
          p_payload: vaccinePayload,
        })
      ).status,
    ).toBe(403);
    await panel
      .getByRole("button", { name: "Révoquer ce code", exact: true })
      .click();
    await expect(panel.getByRole("status")).toContainText("révoqué");
    expect(
      (await rpc(rc, "read_clinician_share", { p_share_id: id, p_page: 1 }))
        .status,
    ).toBe(403);
    await reader.reload();
    await expect(
      reader.getByRole("heading", { name: "Historique vaccinal partagé" }),
    ).toHaveCount(0);
    await panel.locator('[name="scope"]').selectOption("booklet_read");
    await panel.locator('[name="consent"]').check();
    await panel
      .getByRole("button", { name: "Afficher mon QR sécurisé" })
      .click();
    await expect(panel.locator("svg")).toBeVisible();
    const full = await decode(panel.locator("svg"));
    const second = new URLSearchParams(new URL(full.value).hash.slice(1)).get(
      "share",
    )!;
    // Independent hosted HTTP requests use different JWT/session connections; exactly one claim must commit.
    const race = await Promise.all([
      rpc(dc, "redeem_clinician_share", { p_token: second }),
      rpc(rc, "redeem_clinician_share", { p_token: second }),
    ]);
    expect(
      race.filter((r) => r.status === 200 && r.body.accepted === true).length,
    ).toBe(1);
    expect(race.filter((r) => r.body.accepted === false).length).toBe(1);
    const winner = race[0].body.accepted ? doctor : reader,
      winnerContext = race[0].body.accepted ? dc : rc,
      loserContext = race[0].body.accepted ? rc : dc;
    const fullId = race.find((r) => r.body.accepted)!.body.id as string;
    expect(
      (
        await rpc(loserContext, "read_clinician_share", {
          p_share_id: fullId,
          p_page: 1,
        })
      ).status,
    ).toBe(403);
    await winner.goto(`/share/view/${fullId}`);
    await expect(
      winner.getByRole("heading", { name: "Rendez-vous partagés" }),
    ).toBeVisible();
    await expect(
      winner.getByRole("heading", { name: "Consultation fictive partagée" }),
    ).toBeVisible();
    await winner.screenshot({
      path: info.outputPath("sharing-booklet.png"),
      fullPage: true,
    });
    expect(
      (
        await rpc(pc, "revoke_guardian_link", {
          p_id: decision.body,
          p_reason: "Retrait entièrement fictif du consentement",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await rpc(winnerContext, "read_clinician_share", {
          p_share_id: fullId,
          p_page: 1,
        })
      ).status,
    ).toBe(403);
    await winner.reload();
    await expect(
      winner.getByRole("heading", { name: "Soins partagés" }),
    ).toHaveCount(0);
    // Cancel the remaining code, even after guardianship has ended, and capture only the retired parent controls.
    await panel
      .getByRole("button", { name: "Révoquer ce code", exact: true })
      .click();
    expect(
      (await rpc(pc, "list_clinician_shares", { p_child_id: child })).status,
    ).toBe(403);
    expect(errors).toBe(0);
    writeFileSync(
      info.outputPath("sharing-proof.json"),
      JSON.stringify(
        {
          schema: 1,
          run,
          viewport: info.project.name,
          passed: true,
          qr_decoded: true,
          local_image_scanner: true,
          fragment_cleared: true,
          login_other_tab: true,
          single_use: true,
          http_concurrent_claim: true,
          vaccination_scope: true,
          booklet_appointments: true,
          no_clinical_grant_or_write: true,
          parent_revoke_existing_jwt: true,
          guardian_revoke_existing_jwt: true,
          page_errors: errors,
        },
        null,
        2,
      ),
    );
  } finally {
    for (const c of contexts) await c.close();
  }
});
