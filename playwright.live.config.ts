import { defineConfig, devices } from "@playwright/test";
const probe = process.env.MON_ENFANT_LIVE_PROBE;
const cloudRuntime = [
  "forms-cloud-accept",
  "smart-forms-cloud-accept",
  "updates-cloud-accept",
  "design-cloud-accept",
  "sharing-cloud-accept",
].includes(probe ?? "");
if (
  ![
    "stabilization-repro",
    "stabilization-accept",
    "stabilization-clinical",
    "clinician-pages",
    "provisional-correction",
    "clinician-care",
    "forms-cloud-accept",
    "smart-forms-cloud-accept",
    "sharing-cloud-accept",
    "design-cloud-accept",
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
    probe === "clinician-care"
      ? "clinician-care.spec.ts"
      : probe === "provisional-correction"
        ? "provisional-correction.spec.ts"
        : probe === "clinician-pages"
          ? "clinician-pages.spec.ts"
          : probe === "stabilization-clinical"
            ? "stabilization-clinical.spec.ts"
            : probe === "stabilization-repro" ||
                probe === "stabilization-accept"
              ? "stabilization-repro.spec.ts"
              : probe === "smart-forms-cloud-accept"
                ? "smart-forms.spec.ts"
                : probe === "forms-cloud-accept"
                  ? "form-layout.spec.ts"
                  : probe === "sharing-cloud-accept"
                    ? "sharing.spec.ts"
                    : probe === "design-cloud-accept"
                      ? "design.spec.ts"
                      : probe === "updates-accept" ||
                          probe === "updates-cloud-accept"
                        ? ["updates.spec.ts", "design.spec.ts"]
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
  webServer: cloudRuntime
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
    probe === "sharing-cloud-accept" ||
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
    baseURL: cloudRuntime
      ? "https://localhost:3443"
      : "https://mon-enfant.vercel.app",
    ignoreHTTPSErrors: cloudRuntime,
    ...(process.env.MON_ENFANT_QA_PROXY && !cloudRuntime
      ? { proxy: { server: process.env.MON_ENFANT_QA_PROXY } }
      : {}),
    actionTimeout: [
      "stabilization-accept",
      "clinician-pages",
      "clinician-care",
    ].includes(probe ?? "")
      ? 30000
      : 20000,
    navigationTimeout: 30000,
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  reporter: [["list"]],
  projects:
    probe === "clinician-pages"
      ? [
          {
            name: "desktop",
            use: {
              ...devices["Desktop Chrome"],
              viewport: { width: 1672, height: 941 },
            },
          },
          {
            name: "tablet",
            use: { ...devices["iPad Mini"], defaultBrowserType: "chromium" },
          },
          { name: "android", use: { ...devices["Pixel 7"] } },
        ]
      : [
            "forms-cloud-accept",
            "smart-forms-cloud-accept",
            "stabilization-repro",
            "stabilization-accept",
            "stabilization-clinical",
            "clinician-pages",
          ].includes(probe ?? "")
        ? [
            {
              name: "desktop",
              use: {
                ...devices["Desktop Chrome"],
                viewport: { width: 1366, height: 900 },
              },
            },
            { name: "android", use: { ...devices["Pixel 7"] } },
          ]
        : [
              "evidence-reproduce",
              "clinical-inspect",
              "session-reproduce",
            ].includes(probe ?? "")
          ? [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }]
          : [
              {
                name: "desktop",
                use: {
                  ...devices["Desktop Chrome"],
                  ...(probe === "sharing-cloud-accept"
                    ? { viewport: { width: 1440, height: 900 } }
                    : {}),
                },
              },
              {
                name: "tablet",
                use: {
                  ...devices["iPad Mini"],
                  defaultBrowserType: "chromium",
                },
              },
              {
                name: "mobile",
                use: {
                  ...devices["Pixel 7"],
                  ...(probe === "sharing-cloud-accept"
                    ? { viewport: { width: 430, height: 940 } }
                    : {}),
                },
              },
            ],
});
