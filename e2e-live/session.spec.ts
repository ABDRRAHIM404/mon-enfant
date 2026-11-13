import { test, expect, type BrowserContext } from "@playwright/test";
import { createChunks } from "@supabase/ssr";
import { writeFileSync } from "node:fs";
import { observeBrowserErrors } from "./browser-errors";

const KEY = "sb-zkkasbxvdvecnafgjpxd-auth-token";
const names = new RegExp(`^${KEY}(?:\\.\\d+)?$`);
type StoredSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  [key: string]: unknown;
};

async function storedSession(context: BrowserContext) {
  try {
    const cookies = (await context.cookies()).filter((cookie) =>
      names.test(cookie.name),
    );
    const direct = cookies.find((cookie) => cookie.name === KEY);
    const encoded =
      direct?.value ??
      cookies
        .sort(
          (a, b) =>
            Number(a.name.slice(KEY.length + 1)) -
            Number(b.name.slice(KEY.length + 1)),
        )
        .map((cookie) => cookie.value)
        .join("");
    if (!encoded.startsWith("base64-")) throw new Error();
    const session = JSON.parse(
      Buffer.from(encoded.slice(7), "base64url").toString("utf8"),
    ) as StoredSession;
    if (
      typeof session.access_token !== "string" ||
      typeof session.refresh_token !== "string" ||
      typeof session.expires_at !== "number"
    )
      throw new Error();
    return { session, cookies, encoded };
  } catch {
    throw new Error(
      "Synthetic session decoding failed; cookie contents withheld.",
    );
  }
}

async function expireStoredSession(context: BrowserContext) {
  const original = await storedSession(context);
  const stale = { ...original.session, expires_at: 1, expires_in: 0 };
  const encoded =
    "base64-" + Buffer.from(JSON.stringify(stale)).toString("base64url");
  // Exercise auth-js's stored-expiry branch. The provider-signed JWT, real
  // refresh token and all authorization claims stay byte-identical.
  await context.clearCookies({ name: names });
  await context.addCookies(
    createChunks(KEY, encoded).map((chunk) => ({
      ...original.cookies[0],
      ...chunk,
    })),
  );
  const result = await storedSession(context);
  expect(
    result.session.access_token === original.session.access_token &&
      result.session.refresh_token === original.session.refresh_token &&
      result.session.expires_at === 1,
  ).toBe(true);
  return result;
}

test("workspace refresh persists real provider sessions without a public health refresh", async ({
  page,
}, info) => {
  const email = process.env.MON_ENFANT_CLINICAL_BROWSER_A_EMAIL;
  const password = process.env.MON_ENFANT_CLINICAL_BROWSER_A_PASSWORD;
  if (!email || !password)
    throw new Error("Dedicated synthetic session credentials missing.");
  let errors = 0;
  observeBrowserErrors(page, "session-fixture", () => errors++);
  // Isolate explicit document navigation from Next's background link prefetch.
  // A prefetched route can refresh cookies before the route under test runs.
  await page.route("**/*", async (route) => {
    const headers = route.request().headers();
    if (
      headers["next-router-prefetch"] === "1" ||
      headers.purpose === "prefetch"
    )
      await route.abort();
    else await route.continue();
  });
  await page.goto("/login");
  await page.locator('[name="email"]').fill(email);
  await page.keyboard.press("Tab");
  await expect(page.locator('[name="password"]')).toBeFocused();
  await page.locator('[name="password"]').fill(password);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/account$/);

  const routes = [
    ["/vaccines", "Catalogue vaccinal"],
    ["/appointments", "Mes rendez-vous"],
    ["/follow-up", "Suivis et alertes"],
  ] as const;
  const proof: {
    path: string;
    refresh_persisted: boolean;
    secure_cookie: boolean;
  }[] = [];
  for (const [path, heading] of routes) {
    // Stop the preceding page before changing its stored session expiry.
    await page.goto("about:blank");
    const stale = await expireStoredSession(page.context());
    let health;
    try {
      health = await page.context().request.get("/api/health");
    } catch {
      throw new Error(
        "Public readiness check failed; request details withheld.",
      );
    }
    expect(health.status()).toBe(200);
    expect(!health.headers()["set-cookie"]).toBe(true);
    const afterPublic = await storedSession(page.context());
    expect(afterPublic.encoded === stale.encoded).toBe(true);
    const response = await page.goto(path);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    const updated = await storedSession(page.context());
    const cookieWritten = Boolean(
      (await response?.headersArray())?.some(
        (header) => header.name.toLowerCase() === "set-cookie",
      ),
    );
    const persisted =
      updated.session.expires_at > Date.now() / 1000 &&
      updated.encoded !== stale.encoded &&
      cookieWritten;
    if (process.env.MON_ENFANT_LIVE_PROBE === "session-reproduce") {
      expect(persisted).toBe(false);
      expect(updated.session.expires_at === 1).toBe(true);
      const result = {
        mode: "known_session_refresh_gap_observed",
        path,
        page_rendered: true,
        refreshed_cookie_persisted: false,
        flow_accepted: false,
        page_errors: errors,
      };
      writeFileSync(
        info.outputPath("session-proof.json"),
        JSON.stringify(result),
      );
      console.log(JSON.stringify(result));
      return;
    }
    expect(persisted).toBe(true);
    expect(
      (response?.headers()["cache-control"] ?? "").includes("no-store"),
    ).toBe(true);
    const secure =
      updated.cookies.length > 0 &&
      updated.cookies.every(
        (cookie) =>
          cookie.secure && cookie.httpOnly && cookie.sameSite === "Lax",
      );
    expect(secure).toBe(true);
    expect(errors).toBe(0);
    proof.push({ path, refresh_persisted: persisted, secure_cookie: secure });
  }
  await page.goto("/account");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
  for (const [path] of routes) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  expect(
    (await page.context().cookies()).filter((cookie) => names.test(cookie.name))
      .length,
  ).toBe(0);
  expect(errors).toBe(0);
  const result = {
    mode: "session_refresh_acceptance",
    viewport: info.project.name,
    public_health_did_not_refresh: true,
    logout_denied_all_routes: true,
    routes: proof,
    page_errors: errors,
  };
  writeFileSync(info.outputPath("session-proof.json"), JSON.stringify(result));
  console.log(JSON.stringify(result));
});
