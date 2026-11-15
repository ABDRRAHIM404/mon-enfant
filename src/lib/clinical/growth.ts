import type { ClinicalEntry } from "./types";
/** Recorded values only. Unknown/estimated dates remain in the ledger, never guessed onto a chart. */
export function growthPoints(entries: ClinicalEntry[], field: string) {
  return entries
    .filter(
      (e) =>
        e.entry_state === "active" &&
        e.occurrence_precision === "exact" &&
        e.occurred_on &&
        typeof e.payload[field] === "number",
    )
    .map((e) => ({
      date: e.occurred_on!,
      value: Number(e.payload[field]),
      confirmed: e.source_verified,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
