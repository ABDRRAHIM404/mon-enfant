import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installPerformanceObserver,
  type ProbeWindow,
} from "../e2e-support/performance-observer";

type Entry = {
  startTime: number;
  duration?: number;
  value?: number;
  hadRecentInput?: boolean;
};
const callbacks = new Map<
  string,
  (list: { getEntries: () => PerformanceEntry[] }) => void
>();
class Observer {
  static supportedEntryTypes = [
    "largest-contentful-paint",
    "layout-shift",
    "longtask",
  ];
  constructor(
    private callback: (list: { getEntries: () => PerformanceEntry[] }) => void,
  ) {}
  observe(options: { type: string }) {
    callbacks.set(options.type, this.callback);
  }
}
function emit(type: string, entries: Entry[]) {
  const callback = callbacks.get(type);
  if (!callback) throw new Error("Missing performance observation type.");
  callback({ getEntries: () => entries as PerformanceEntry[] });
}
const state = () => (window as ProbeWindow).__monEnfantPerformance!;
beforeEach(() => {
  callbacks.clear();
  Observer.supportedEntryTypes = [
    "largest-contentful-paint",
    "layout-shift",
    "longtask",
  ];
  vi.stubGlobal("window", {});
  vi.stubGlobal("PerformanceObserver", Observer);
});
afterEach(() => vi.unstubAllGlobals());

describe("the actual injected numeric performance observer", () => {
  it("starts at the first shift and retains the largest session", () => {
    installPerformanceObserver();
    emit("layout-shift", [{ startTime: 100, value: 0.1 }]);
    expect(state().shiftStart).toBe(100);
    emit(
      "layout-shift",
      [900, 1700, 2500, 3300, 4100, 4900, 5700].map((startTime) => ({
        startTime,
        value: 0.1,
      })),
    );
    expect(state().cls).toBeCloseTo(0.7);
    expect(state().shiftStart).toBe(5700);
  });
  it("ignores recent input and splits at the one-second gap boundary", () => {
    installPerformanceObserver();
    emit("layout-shift", [
      { startTime: 50, value: 0.8, hadRecentInput: true },
      { startTime: 100, value: 0.1 },
      { startTime: 1100, value: 0.2 },
    ]);
    expect(state().cls).toBeCloseTo(0.2);
    expect(state().shiftStart).toBe(1100);
  });
  it("splits at the five-second session boundary even without a long gap", () => {
    installPerformanceObserver();
    emit(
      "layout-shift",
      [100, 1000, 1900, 2800, 3700, 4600, 5100].map((startTime) => ({
        startTime,
        value: 0.1,
      })),
    );
    expect(state().cls).toBeCloseTo(0.6);
    expect(state().shiftStart).toBe(5100);
  });
  it("records only LCP timing and blocking beyond the fifty-millisecond task threshold", () => {
    installPerformanceObserver();
    emit("largest-contentful-paint", [{ startTime: 100 }, { startTime: 200 }]);
    emit("longtask", [
      { startTime: 100, duration: 49 },
      { startTime: 200, duration: 75 },
      { startTime: 300, duration: 100 },
    ]);
    expect(state().lcp).toBe(200);
    expect(state().blocking).toBe(75);
  });
  it("marks unsupported observation types instead of inventing zero metrics", () => {
    Observer.supportedEntryTypes = ["paint"];
    installPerformanceObserver();
    expect(state().supported).toBe(false);
    expect(callbacks.size).toBe(0);
  });
});
