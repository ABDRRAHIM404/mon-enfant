import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const SITE = "https://mon-enfant.vercel.app",
  MIB = 1024 * 1024;
function credentials(role: string) {
  const key = `MON_ENFANT_READINESS_${role.toUpperCase()}`;
  const email = process.env[key + "_EMAIL"],
    password = process.env[key + "_PASSWORD"];
  if (!email || !password)
    throw new Error("Dedicated synthetic account credentials are missing.");
  return { email, password };
}
async function login(page: Page, role: string) {
  const account = credentials(role);
  await page.goto("/login");
  await page.locator('input[name="email"]').focus();
  await page.locator('input[name="email"]').fill(account.email);
  await page.keyboard.press("Tab");
  await expect(page.locator('input[name="password"]')).toBeFocused();
  await page.locator('input[name="password"]').fill(account.password);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/account$/);
  await page.goto("/account");
  const activate = page.getByRole("button", {
    name: "Activer mon espace professionnel",
  });
  if (await activate.count()) {
    await activate.click();
    await expect(
      page.getByRole("link", { name: "Soumettre mes justificatifs" }),
    ).toBeVisible();
  }
}
function pdfOfSize(size: number) {
  const content =
    "BT /F1 12 Tf 20 150 Td (Synthetic fixture only - no real identity) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 250 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let prefix =
    "%PDF-1.4\n% Synthetic QA fixture - never an identity document\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(prefix));
    prefix += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const suffix = (padding: number) =>
    `xref\n0 6\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((offset) => String(offset).padStart(10, "0") + " 00000 n \n")
      .join(
        "",
      )}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${Buffer.byteLength(prefix) + padding}\n%%EOF\n`;
  let padding = size - Buffer.byteLength(prefix) - 250;
  for (let round = 0; round < 3; round++)
    padding +=
      size -
      Buffer.byteLength(prefix) -
      padding -
      Buffer.byteLength(suffix(padding));
  if (padding < 3) throw new Error("Fixture size is too small.");
  return Buffer.concat([
    Buffer.from(prefix),
    Buffer.from("%" + "x".repeat(padding - 2) + "\n"),
    Buffer.from(suffix(padding)),
  ]);
}
async function rawSubmission(
  page: Page,
  bytes: Buffer,
  fields: Record<string, string>,
) {
  let markup: string;
  try {
    markup = await (await page.request.get("/verification")).text();
  } catch {
    throw new Error(
      "Authenticated form preparation failed; request details omitted.",
    );
  }
  const hidden = await page.evaluate((html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const form = Array.from(doc.forms).find((element) =>
      element.querySelector('[name="evidence"]'),
    );
    if (!form)
      throw new Error("Submission form missing from authenticated response.");
    return Object.fromEntries(
      Array.from(
        form.querySelectorAll<HTMLInputElement>('input[type="hidden"][name]'),
      ).map((input) => [input.name, input.value]),
    );
  }, markup);
  try {
    return await page.request.post("/verification", {
      headers: { Origin: SITE },
      multipart: {
        ...hidden,
        ...fields,
        evidence: {
          name: "synthetic-identity.pdf",
          mimeType: "application/pdf",
          buffer: bytes,
        },
      },
    });
  } catch {
    throw new Error(
      "Authenticated form submission failed; request details omitted.",
    );
  }
}
async function privateDenied(
  context: BrowserContext,
  path: string,
  destination: string,
) {
  let response;
  try {
    response = await context.request.get(path);
  } catch {
    throw new Error(
      "Protected-download denial check failed; request details omitted.",
    );
  }
  expect(response.url().endsWith(destination)).toBe(true);
  expect((await response.body()).subarray(0, 5).toString() === "%PDF-").toBe(
    false,
  );
}
test("private evidence browser-to-storage boundary and review", async ({
  page,
  browser,
}, info) => {
  const role = info.project.name,
    run = process.env.MON_ENFANT_QA_RUN!;
  let pageErrors = 0;
  page.on("pageerror", () => {
    pageErrors++;
  });
  await login(page, role);
  const cookies = (await page.context().cookies()).filter(
    (cookie) =>
      cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
  );
  expect(
    cookies.length > 0 &&
      cookies.every(
        (cookie) =>
          cookie.secure && cookie.httpOnly && cookie.sameSite === "Lax",
      ),
  ).toBe(true);
  await page.goto("/verification");
  await expect(
    page.getByRole("heading", { name: "Présentez vos qualifications." }),
  ).toBeVisible();
  const displayName = `Professionnel fictif ${role}`,
    registration = `QAR-${run}-${role.toUpperCase()}`;
  const fields = {
    displayName,
    registration,
    facility: "Centre fictif de test navigateur",
    syntheticOnly: "on",
  };
  await page.getByLabel("Nom professionnel complet").fill(displayName);
  await page.keyboard.press("Tab");
  await expect(page.locator('[name="registration"]')).toBeFocused();
  await page
    .getByLabel("Matricule / numéro d’inscription professionnelle")
    .fill(registration);
  await page.getByLabel("Établissement d’exercice").fill(fields.facility);
  await page.locator('[name="syntheticOnly"]').check();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("verification-form.png"),
    fullPage: true,
  });
  if (process.env.MON_ENFANT_LIVE_PROBE === "evidence-reproduce") {
    await expect(page.locator("#evidence-help")).toContainText("5 Mo");
    const bytes = pdfOfSize(5 * MIB);
    expect(bytes.length).toBe(5 * MIB);
    await page.locator('[name="evidence"]').setInputFiles({
      name: "synthetic-identity.pdf",
      mimeType: "application/pdf",
      buffer: bytes,
    });
    const [response] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/verification",
      ),
      page.getByRole("button", { name: "Soumettre pour vérification" }).click(),
    ]);
    expect(response.status()).toBe(413);
    const proof = {
      mode: "known_upload_mismatch_observed",
      file_bytes: bytes.length,
      http_status: response.status(),
      flow_accepted: false,
    };
    writeFileSync(
      info.outputPath("evidence-proof.json"),
      JSON.stringify(proof),
    );
    console.log(JSON.stringify(proof));
    return;
  }
  await expect(page.locator("#evidence-help")).toContainText("4 Mio");
  let posts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/verification"
    )
      posts++;
  });
  await page.locator('[name="evidence"]').setInputFiles({
    name: "synthetic-too-large.pdf",
    mimeType: "application/pdf",
    buffer: pdfOfSize(4 * MIB + 1),
  });
  await page
    .getByRole("button", { name: "Soumettre pour vérification" })
    .click();
  await expect(page.getByRole("alert")).toContainText("4 Mio");
  expect(posts).toBe(0);
  const tooLarge = await rawSubmission(page, pdfOfSize(4 * MIB + 1), fields);
  expect(tooLarge.status()).toBe(200);
  expect((await tooLarge.text()).includes("4 Mio")).toBe(true);
  const spoof = await rawSubmission(
    page,
    Buffer.from("This is not a PDF file."),
    fields,
  );
  expect(spoof.status()).toBe(200);
  expect((await spoof.text()).includes("Le contenu du fichier")).toBe(true);
  const bytes = pdfOfSize(4 * MIB);
  expect(bytes.length).toBe(4 * MIB);
  await page.locator('[name="evidence"]').setInputFiles({
    name: "synthetic-identity.pdf",
    mimeType: "application/pdf",
    buffer: bytes,
  });
  await page
    .getByRole("button", { name: "Soumettre pour vérification" })
    .click();
  await expect(
    page
      .getByText(
        /Votre demande est enregistrée|Votre demande est en cours d’examen/,
      )
      .first(),
  ).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/account$/);
  const reviewerContext = await browser.newContext({
    baseURL: SITE,
    viewport: page.viewportSize() ?? undefined,
  });
  const reviewer = await reviewerContext.newPage();
  let reviewerErrors = 0;
  reviewer.on("pageerror", () => {
    reviewerErrors++;
  });
  await login(reviewer, "reviewer");
  await reviewer.goto("/admin/verifications");
  await reviewer.getByRole("link", { name: displayName, exact: true }).click();
  expect(
    await reviewer.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await reviewer.screenshot({
    path: info.outputPath("verification-review.png"),
    fullPage: true,
  });
  const evidencePath = await reviewer
    .getByRole("link", { name: "Télécharger le justificatif privé" })
    .getAttribute("href");
  expect(evidencePath?.startsWith("/admin/evidence/")).toBe(true);
  let redirect;
  try {
    redirect = await reviewerContext.request.get(evidencePath!, {
      maxRedirects: 0,
    });
  } catch {
    throw new Error(
      "Private-download authorization failed; request details omitted.",
    );
  }
  expect(redirect.status()).toBe(307);
  expect(redirect.headers()["cache-control"]).toContain("no-store");
  const signed = redirect.headers().location;
  const signedUrl = new URL(signed);
  expect(signedUrl.origin === "https://zkkasbxvdvecnafgjpxd.supabase.co").toBe(
    true,
  );
  let downloaded: Response, content: Buffer;
  try {
    downloaded = await fetch(signed, { redirect: "error" });
    content = Buffer.from(await downloaded.arrayBuffer());
  } catch {
    throw new Error("Private evidence download failed; signed URL omitted.");
  }
  expect(downloaded.status).toBe(200);
  expect(content.length).toBe(4 * MIB);
  expect(createHash("sha256").update(content).digest("hex")).toBe(
    createHash("sha256").update(bytes).digest("hex"),
  );
  const anonymous = await browser.newContext({ baseURL: SITE });
  await privateDenied(anonymous, evidencePath!, "/login");
  await privateDenied(page.context(), evidencePath!, "/account");
  const publicPath = signedUrl.pathname.replace(
    "/storage/v1/object/sign/",
    "/storage/v1/object/public/",
  );
  const publicResponse = await anonymous.request.get(
    signedUrl.origin + publicPath,
  );
  expect([400, 401, 403, 404].includes(publicResponse.status())).toBe(true);
  await anonymous.close();
  await reviewer.locator('[name="decision"]').selectOption("rejected");
  await reviewer
    .locator('[name="reason"]')
    .fill(
      "Justificatif entièrement fictif : clôture après vérification technique du navigateur.",
    );
  await reviewer
    .getByRole("button", { name: "Enregistrer la décision" })
    .click();
  await expect(
    reviewer.getByRole("heading", { name: "Décision enregistrée" }),
  ).toBeVisible();
  await page.goto("/verification");
  await expect(
    page.getByText(
      "Justificatif entièrement fictif : clôture après vérification technique du navigateur.",
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("verification-history.png"),
    fullPage: true,
  });
  expect(pageErrors).toBe(0);
  expect(reviewerErrors).toBe(0);
  await reviewerContext.close();
  const proof = {
    mode: "evidence_acceptance",
    viewport: role,
    file_bytes: content.length,
    server_oversize_rejected: true,
    public_read_denied: true,
    unrelated_download_denied: true,
    page_errors: pageErrors,
    reviewer_page_errors: reviewerErrors,
  };
  writeFileSync(info.outputPath("evidence-proof.json"), JSON.stringify(proof));
  console.log(JSON.stringify(proof));
});
