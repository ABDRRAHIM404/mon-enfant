import { defineConfig, devices } from "@playwright/test";
const probe = process.env.MON_ENFANT_LIVE_PROBE;
if (!["evidence-reproduce", "evidence-accept"].includes(probe ?? ""))
  throw new Error("An explicit supported live evidence mode is required.");
if (!/^[a-f0-9]{16}$/.test(process.env.MON_ENFANT_QA_RUN ?? ""))
  throw new Error("A dedicated synthetic fixture run is required.");
export default defineConfig({
  testDir: "./e2e-live",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120000,
  expect: { timeout: 20000 },
  outputDir: "test-results/live",
  use: {
    baseURL: "https://mon-enfant.vercel.app",
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  reporter: [["list"]],
  projects:
    probe === "evidence-reproduce"
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
