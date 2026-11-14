import { expect, type Page, type TestInfo } from "@playwright/test";
import { writeFileSync } from "node:fs";
import {
  installPerformanceObserver,
  type ProbeWindow,
} from "./performance-observer";

const installed = new WeakSet<Page>();
export type PerformanceProof = {
  screen: string;
  profile: "baseline" | "constrained";
  cpu_slowdown: number;
  latency_ms: number;
  download_bytes_per_second: number;
  upload_bytes_per_second: number;
  cache_disabled: true;
  document_ttfb_ms: number;
  fcp_ms: number;
  lcp_ms: number;
  cls: number;
  observed_long_task_blocking_ms: number;
  load_ms: number;
  observation_end_ms: number;
  reported_transfer_bytes: number;
  resource_count: number;
  performance_acceptance_claimed: false;
};

export async function measureClinicalRead(
  page: Page,
  path: string,
  heading: string,
  screen: string,
  info: TestInfo,
): Promise<PerformanceProof[]> {
  if (!/^[a-z0-9-]{1,70}$/.test(screen))
    throw new Error("A fixed performance screen label is required.");
  if (!installed.has(page)) {
    await page.addInitScript(installPerformanceObserver);
    installed.add(page);
  }
  const session = await page.context().newCDPSession(page);
  const proofs: PerformanceProof[] = [];
  let stage = "configure";
  try {
    await session.send("Network.enable");
    await session.send("Network.setCacheDisabled", { cacheDisabled: true });
    for (const profile of ["baseline", "constrained"] as const) {
      const constrained = profile === "constrained";
      const conditions = {
        latency: constrained ? 150 : 0,
        downloadThroughput: constrained ? 200000 : -1,
        uploadThroughput: constrained ? 93750 : -1,
        connectionType: constrained
          ? ("cellular4g" as const)
          : ("wifi" as const),
      };
      stage = "profile";
      await session.send("Emulation.setCPUThrottlingRate", {
        rate: constrained ? 4 : 1,
      });
      await session.send("Network.emulateNetworkConditionsByRule", {
        offline: false,
        matchedNetworkConditions: constrained
          ? [{ urlPattern: "", ...conditions }]
          : [],
      });
      await session.send("Network.overrideNetworkState", {
        offline: false,
        ...conditions,
      });
      stage = "navigate";
      const response = await page.goto(path);
      if (!response?.ok()) throw new Error("Document navigation failed.");
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      stage = "observe";
      await page.waitForFunction(
        () => {
          const state = (window as ProbeWindow).__monEnfantPerformance;
          const navigation = performance.getEntriesByType("navigation")[0] as
            PerformanceNavigationTiming | undefined;
          return (
            state?.supported &&
            state.lcp > 0 &&
            document.readyState === "complete" &&
            navigation?.loadEventEnd &&
            performance.now() -
              Math.max(state.lastBusy, navigation.loadEventEnd) >=
              1000
          );
        },
        undefined,
        { timeout: 30000, polling: 100 },
      );
      stage = "read";
      const metrics = await page.evaluate(() => {
        const state = (window as ProbeWindow).__monEnfantPerformance!;
        const navigation = performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming;
        const resources = performance.getEntriesByType(
          "resource",
        ) as PerformanceResourceTiming[];
        const firstPaint = performance.getEntriesByName(
          "first-contentful-paint",
        )[0];
        return {
          document_ttfb_ms: navigation.responseStart,
          fcp_ms: firstPaint?.startTime ?? 0,
          lcp_ms: state.lcp,
          cls: state.cls,
          observed_long_task_blocking_ms: state.blocking,
          load_ms: navigation.loadEventEnd,
          observation_end_ms: performance.now(),
          reported_transfer_bytes:
            navigation.transferSize +
            resources.reduce((sum, entry) => sum + entry.transferSize, 0),
          resource_count: resources.length,
        };
      });
      if (
        !Object.values(metrics).every(
          (value) => Number.isFinite(value) && value >= 0,
        ) ||
        metrics.fcp_ms <= 0 ||
        metrics.lcp_ms <= 0
      )
        throw new Error("Required numeric observations were not proven.");
      const proof: PerformanceProof = {
        screen,
        profile,
        cpu_slowdown: constrained ? 4 : 1,
        latency_ms: conditions.latency,
        download_bytes_per_second: conditions.downloadThroughput,
        upload_bytes_per_second: conditions.uploadThroughput,
        cache_disabled: true,
        ...metrics,
        performance_acceptance_claimed: false,
      };
      proofs.push(proof);
      console.log(
        JSON.stringify({
          event: "synthetic_performance_observation",
          viewport: info.project.name,
          ...proof,
        }),
      );
    }
    writeFileSync(
      info.outputPath(`performance-${screen}.json`),
      JSON.stringify(proofs),
    );
    return proofs;
  } catch {
    console.log(
      JSON.stringify({
        event: "synthetic_performance_observation_failed",
        screen,
        stage,
      }),
    );
    throw new Error(
      "Synthetic performance observation failed; browser/request details withheld.",
    );
  } finally {
    try {
      await session.send("Network.emulateNetworkConditionsByRule", {
        offline: false,
        matchedNetworkConditions: [],
      });
      await session.send("Network.overrideNetworkState", {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
        connectionType: "wifi",
      });
      await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await session.send("Network.setCacheDisabled", { cacheDisabled: false });
    } catch {
      throw new Error(
        "Browser profiling conditions could not be restored; details withheld.",
      );
    } finally {
      await session.detach();
    }
  }
}
