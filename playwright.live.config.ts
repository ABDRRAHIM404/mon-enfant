import { defineConfig, devices } from "@playwright/test";
const probe = process.env.MON_ENFANT_LIVE_PROBE;
if (
  ![
    "updates-cloud-accept",
    "updates-accept",
    "parent-accept",
    "evidence-reproduce",
    "evidence-accept",
    "evidence-accessibility",
    "clinical-accept",
    "clinical-accessibility",
    "clinical-performance",
    "accessibility-accept",
    "vaccination-accept",
    "vaccine-accessibility",
    "clinical-inspect",
    "session-reproduce",
    "session-accept",
  ].includes(probe ?? "")
)
  throw new Error("An explicit supported live evidence mode is required.");
if (!/^[a-f0-9]{16}$/.test(process.env.MON_ENFANT_QA_RUN ?? ""))
  throw new Error("A dedicated synthetic fixture run is required.");
export default defineConfig({
  testDir: "./e2e-live",
  testMatch:
    probe === "updates-accept" || probe === "updates-cloud-accept"
      ? "updates.spec.ts"
      : probe === "parent-accept"
        ? "parent.spec.ts"
        : probe?.startsWith("session-")
          ? "session.spec.ts"
          : probe === "accessibility-accept"
            ? "accessibility.spec.ts"
            : probe === "vaccination-accept" ||
                probe === "vaccine-accessibility"
              ? "vaccination.spec.ts"
              : probe === "clinical-inspect"
                ? "clinical-inspect.spec.ts"
                : probe === "clinical-accept" ||
                    probe === "clinical-accessibility" ||
                    probe === "clinical-performance"
                  ? "clinical.spec.ts"
                  : "evidence.spec.ts",
  webServer:
    probe === "updates-cloud-accept"
      ? [
          {
            command: "npm run start -- --hostname 127.0.0.1",
            url: "http://127.0.0.1:3000/login",
            reuseExistingServer: false,
            timeout: 120000,
            stdout: "ignore",
            stderr: "ignore",
          },
          {
            command: "node scripts/cloud-https-proxy.mjs",
            url: "https://localhost:3443/login",
            ignoreHTTPSErrors: true,
            reuseExistingServer: false,
            timeout: 120000,
            stdout: "ignore",
            stderr: "ignore",
          },
        ]
      : undefined,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  maxFailures: [
    "accessibility-accept",
    "clinical-accessibility",
    "vaccine-accessibility",
    "evidence-accessibility",
    "clinical-performance",
  ].includes(probe ?? "")
    ? 0
    : 1,
  timeout:
    probe === "parent-accept" ||
    probe === "updates-accept" ||
    probe === "updates-cloud-accept"
      ? 480000
      : probe === "clinical-performance"
        ? 480000
        : probe === "evidence-accessibility"
          ? 240000
          : probe === "vaccine-accessibility"
            ? 480000
            : probe === "clinical-accessibility"
              ? 360000
              : probe === "accessibility-accept"
                ? 180000
                : probe === "vaccination-accept"
                  ? 360000
                  : probe === "clinical-accept"
                    ? 240000
                    : 120000,
  expect: { timeout: 20000 },
  outputDir: "test-results/live",
  use: {
    baseURL:
      probe === "updates-cloud-accept"
        ? "https://localhost:3443"
        : "https://mon-enfant.vercel.app",
    ignoreHTTPSErrors: probe === "updates-cloud-accept",
    actionTimeout: 20000,
    navigationTimeout: 30000,
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  reporter: [["list"]],
  projects: [
    "evidence-reproduce",
    "clinical-inspect",
    "session-reproduce",
  ].includes(probe ?? "")
    ? [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }]
    : [
        { name: "desktop", use: { ...devices["Desktop Chrome"] } },
        {
          name: "tablet",
          use: { ...devices["iPad Mini"], defaultBrowserType: "chromium" },
        },
        { name: "mobile", use: { ...devices["Pixel 7"] } },
      ],
});
