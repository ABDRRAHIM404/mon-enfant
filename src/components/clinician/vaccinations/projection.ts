import type { ClinicalEntry } from "@/lib/clinical/types";
import type { Patient } from "@/lib/registry/types";
import {
  addCivilDays,
  civilDay,
  routinePreviewReference,
  routineReference,
} from "@/lib/vaccines/calendar";
import type { CatalogSnapshot } from "@/lib/vaccines/types";

const hasDocumentedDate = (
  entry: ClinicalEntry,
  today: string,
): entry is ClinicalEntry & { occurred_on: string } =>
  entry.occurrence_precision === "exact" &&
  entry.occurred_on !== null &&
  entry.occurred_on <= today &&
  (entry.source_verified || entry.source_type === "observed");

function matches(entry: ClinicalEntry, vaccine: string, dose: string) {
  const normalized = (value: string | number | undefined) =>
    String(value ?? "")
      .trim()
      .toUpperCase();
  return (
    normalized(entry.payload.vaccine_code) === normalized(vaccine) &&
    [entry.vaccine_mapping?.dose_code, entry.payload.dose_label].some(
      (code) => normalized(code) === normalized(dose),
    )
  );
}

export function vaccinationProjection(
  child: Patient,
  catalog: CatalogSnapshot | null,
  history: ClinicalEntry[] | null,
  today: string,
  betaDraft: CatalogSnapshot | null = null,
) {
  const birth =
    child.birth_date_precision === "exact" ? child.birth_date : null;
  const active =
    history?.filter((entry) => entry.entry_state === "active") ?? [];
  const approved =
    catalog?.status === "approved" && catalog.review_verified ? catalog : null;
  const draft =
    !approved && betaDraft?.status === "draft" && !betaDraft.review_verified
      ? betaDraft
      : null;
  const schedule = approved ?? draft;
  const hb1 = active.filter((entry) => matches(entry, "HB", "HB1"));
  const hbn = active.filter((entry) => matches(entry, "HB", "HBn"));
  const birthDoseRecorded =
    birth !== null &&
    hbn.some(
      (entry) =>
        hasDocumentedDate(entry, today) &&
        entry.occurred_on >= birth &&
        entry.occurred_on <= addCivilDays(birth, 1),
    );
  const hb1Window = birth ? addCivilDays(birth, 27) : null;
  const onTime = Boolean(
    birth &&
    hb1Window &&
    hb1.some(
      (entry) =>
        hasDocumentedDate(entry, today) &&
        entry.occurred_on >= birth &&
        entry.occurred_on <= hb1Window,
    ),
  );
  const missingAfterWindow =
    child.history_status === "reviewed" &&
    hb1Window !== null &&
    today > hb1Window &&
    approved?.rules.some(
      (rule) => rule.dose_code === "HB1" && rule.age.unit === "first_4_weeks",
    );
  const reviewHB1 =
    history !== null &&
    (hbn.length > 0
      ? !birthDoseRecorded || hb1.length > 0
      : !onTime && (hb1.length > 0 || missingAfterWindow === true));

  const vaccines = schedule?.source_document.vaccines as
    Record<string, { label_fr?: string }> | undefined;
  const upcoming =
    !history || !birth || !schedule
      ? []
      : schedule.rules
          .flatMap((rule) => {
            const routineRule = {
              doseCode: rule.dose_code,
              vaccineCode: rule.vaccine_code,
              age: rule.age,
              eligibility: rule.eligibility,
              automaticScheduling: rule.automatic_scheduling,
            };
            const routineChild: Parameters<typeof routineReference>[1] = {
              birthDate: birth,
              birthPrecision: "exact",
              sex:
                child.sex === "female" || child.sex === "male"
                  ? child.sex
                  : "unknown",
            };
            const ref = approved
              ? routineReference(routineRule, routineChild, {
                  status: approved.status,
                  reviewVerified: approved.review_verified,
                })
              : routinePreviewReference(routineRule, routineChild);
            if (!ref.startOn || !ref.endOn || ref.endOn < today) return [];
            const evidence = active.filter((entry) =>
              matches(entry, rule.vaccine_code, rule.dose_code),
            );
            if (
              evidence.some(
                (entry) =>
                  hasDocumentedDate(entry, today) &&
                  entry.occurred_on >= birth &&
                  entry.vaccine_mapping?.dose_code === rule.dose_code,
              )
            )
              return [];
            return [
              {
                rule,
                startOn: ref.startOn,
                endOn: ref.endOn,
                needsReview: evidence.length > 0,
                label: vaccines?.[rule.vaccine_code]?.label_fr,
              },
            ];
          })
          .sort(
            (a, b) =>
              a.startOn.localeCompare(b.startOn) ||
              a.rule.dose_code.localeCompare(b.rule.dose_code),
          );

  return { upcoming, reviewHB1, schedule, draftPreview: draft !== null };
}

export function ageAtVaccination(child: Patient, entry: ClinicalEntry) {
  if (
    !child.birth_date ||
    child.birth_date_precision !== "exact" ||
    !entry.occurred_on ||
    entry.occurrence_precision !== "exact"
  )
    return null;
  const age = civilDay(entry.occurred_on) - civilDay(child.birth_date);
  return age >= 0 ? age : null;
}

export type VaccinationOverview = {
  history: { items: ClinicalEntry[]; total: number };
  projection: ReturnType<typeof vaccinationProjection>;
  historyComplete: boolean;
  catalogSearchComplete: boolean;
};
