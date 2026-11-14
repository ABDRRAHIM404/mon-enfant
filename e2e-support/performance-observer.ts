export type Observation = {
  supported: boolean;
  lcp: number;
  cls: number;
  shiftStart: number;
  shiftLast: number;
  shiftSum: number;
  blocking: number;
  lastBusy: number;
};
export type ProbeWindow = Window & { __monEnfantPerformance?: Observation };

export function installPerformanceObserver() {
  const state: Observation = {
    supported: ["largest-contentful-paint", "layout-shift", "longtask"].every(
      (kind) => PerformanceObserver.supportedEntryTypes.includes(kind),
    ),
    lcp: 0,
    cls: 0,
    shiftStart: 0,
    shiftLast: 0,
    shiftSum: 0,
    blocking: 0,
    lastBusy: 0,
  };
  (window as ProbeWindow).__monEnfantPerformance = state;
  if (!state.supported) return;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      state.lcp = entry.startTime;
      state.lastBusy = performance.now();
    }
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      };
      if (shift.hadRecentInput) continue;
      if (
        state.shiftLast === 0 ||
        shift.startTime - state.shiftLast >= 1000 ||
        shift.startTime - state.shiftStart >= 5000
      ) {
        state.shiftStart = shift.startTime;
        state.shiftSum = shift.value;
      } else state.shiftSum += shift.value;
      state.shiftLast = shift.startTime;
      state.cls = Math.max(state.cls, state.shiftSum);
      state.lastBusy = performance.now();
    }
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      state.blocking += Math.max(0, entry.duration - 50);
    state.lastBusy = performance.now();
  }).observe({ type: "longtask", buffered: true });
}
