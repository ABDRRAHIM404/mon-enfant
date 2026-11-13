import source from "../../../data-for-supa/MON_ENFANT_PNI_DATA.json";
import type { RoutineAge, RoutineRule } from "./calendar";
export type SourceRule = RoutineRule & {
  sourceAge: RoutineAge;
  sourceRow: Record<string, unknown>;
  sourceSlide: number;
  decisionId: string | null;
  label: string;
};
export function transcribedSourceRules(): SourceRule[] {
  return source.schedule_2025.map((row) => ({
    doseCode: row.dose_code,
    vaccineCode: row.vaccine_code,
    age: row.age as RoutineAge,
    sourceAge: row.source_age as RoutineAge,
    eligibility: row.dose_code === "HPV" ? "female" : "all",
    automaticScheduling: row.dose_code !== "HB1",
    sourceSlide: row.source_slide,
    decisionId: row.decision_id ?? null,
    label:
      source.vaccines[row.vaccine_code as keyof typeof source.vaccines]
        .label_fr,
    sourceRow: row,
  }));
}
