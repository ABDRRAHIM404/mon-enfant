import type { ClinicalEntry } from "@/lib/clinical/types";
import type { Patient } from "@/lib/registry/types";
import {
  addCalendarMonths,
  addCivilDays,
  civilDay,
  routineReference,
} from "./calendar";
import type { VaccineItemExport } from "./patient-types";
import type { CatalogRule, CatalogSnapshot } from "./types";

export type DoseReview = {
  id: string;
  dose_code: string;
  outstanding: boolean;
  recommended_end: string;
};
export type BookletStatus =
  | "completed"
  | "upcoming"
  | "overdue"
  | "review"
  | "manual"
  | "withdrawn"
  | "not_applicable";
export const bookletStatus: Record<BookletStatus, string> = {
  completed: "Réalisée",
  upcoming: "À venir",
  overdue: "En retard",
  review: "À vérifier",
  manual: "Examen clinique",
  withdrawn: "Référence retirée",
  not_applicable: "Non applicable",
};

const dateFormatter = new Intl.DateTimeFormat("fr-MA", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});
export const bookletDate = (date: string) =>
  dateFormatter.format(new Date(date.slice(0, 10) + "T00:00:00Z"));

export function bookletAge(birth: string, date: string) {
  const days = civilDay(date) - civilDay(birth);
  if (days < 0) return null;
  if (days < 28) return `${days} jour${days > 1 ? "s" : ""}`;
  let months =
    (Number(date.slice(0, 4)) - Number(birth.slice(0, 4))) * 12 +
    Number(date.slice(5, 7)) -
    Number(birth.slice(5, 7));
  if (addCalendarMonths(birth, months) > date) months--;
  if (months < 1) return "Moins d’un mois";
  if (months < 12) return `${months} mois`;
  const years = Math.floor(months / 12);
  return `${years} an${years > 1 ? "s" : ""}${months % 12 ? ` et ${months % 12} mois` : ""}`;
}

function stage(rule: CatalogRule) {
  const { age } = rule;
  switch (age.unit) {
    case "birth_24_hours":
      return { label: "À la naissance", order: 0 };
    case "first_4_weeks":
      return { label: "4 premières semaines", order: 1 };
    case "weeks":
      return { label: `${age.value} semaines`, order: age.value * 7 };
    case "months":
      return { label: `${age.value} mois`, order: age.value * 30.44 };
    case "years":
      return {
        label: `${age.value} an${age.value === 1 ? "" : "s"}`,
        order: age.value * 365.25,
      };
  }
}

const code = (input: string | number | undefined) =>
  String(input ?? "")
    .trim()
    .toUpperCase();

function matches(entry: ClinicalEntry, rule: CatalogRule) {
  return (
    code(entry.payload.vaccine_code) === code(rule.vaccine_code) &&
    code(entry.vaccine_mapping?.dose_code ?? entry.payload.dose_label) ===
      code(rule.dose_code)
  );
}

export function recordedAdministration(
  entry: ClinicalEntry,
  child: Patient,
  today: string,
) {
  return (
    entry.occurrence_precision === "exact" &&
    entry.occurred_on !== null &&
    entry.occurred_on <= today &&
    (child.birth_date_precision !== "exact" ||
      !child.birth_date ||
      entry.occurred_on >= child.birth_date) &&
    (entry.source_verified || entry.source_type === "observed")
  );
}

export function vaccinationBooklet(
  child: Patient,
  schedule: CatalogSnapshot | null,
  entries: ClinicalEntry[],
  complete: boolean,
  items: VaccineItemExport[],
  reviews: DoseReview[],
  today: string,
) {
  const approved =
    schedule?.status === "approved" && schedule.review_verified
      ? schedule
      : null;
  const active = entries.filter((entry) => entry.entry_state === "active");
  const birth =
    child.birth_date_precision === "exact" ? child.birth_date : null;
  const birthDoseRecorded =
    birth !== null &&
    active.some(
      (entry) =>
        code(entry.payload.vaccine_code) === "HB" &&
        code(entry.vaccine_mapping?.dose_code ?? entry.payload.dose_label) ===
          "HBN" &&
        recordedAdministration(entry, child, today) &&
        entry.occurred_on! <= addCivilDays(birth, 1),
    );
  const vaccines = approved?.source_document.vaccines as
    Record<string, { label_fr?: string }> | undefined;
  const rows = (approved?.rules ?? [])
    .flatMap((rule) => {
      const evidence = active.filter((entry) => matches(entry, rule));
      const entry =
        evidence.find((entry) => recordedAdministration(entry, child, today)) ??
        evidence[0];
      if (rule.eligibility === "female" && child.sex === "male" && !entry)
        return [];
      const item = items.find(
        (item) =>
          item.version_id === rule.version_id &&
          item.dose_code === rule.dose_code,
      );
      const ref = routineReference(
        {
          doseCode: rule.dose_code,
          vaccineCode: rule.vaccine_code,
          age: rule.age,
          eligibility: rule.eligibility,
          automaticScheduling: rule.automatic_scheduling,
        },
        {
          birthDate: child.birth_date,
          birthPrecision:
            child.birth_date_precision === "exact" ? "exact" : "unknown",
          sex:
            child.sex === "female" || child.sex === "male"
              ? child.sex
              : "unknown",
        },
        { status: "approved", reviewVerified: true },
      );
      const review = reviews.find(
        (review) => review.dose_code === rule.dose_code,
      );
      const past = !!ref.endOn && ref.endOn < today;
      const withdrawn = item?.changes.at(-1)?.state === "withdrawn";
      const canReview = complete && !entry && past && !withdrawn;
      const manual = ref.state === "disabled_reference_only";
      const status: BookletStatus =
        entry &&
        (rule.eligibility !== "female" || child.sex === "female") &&
        recordedAdministration(entry, child, today)
          ? "completed"
          : (rule.eligibility === "female" && child.sex === "male") ||
              (rule.dose_code === "HB1" && !entry && birthDoseRecorded)
            ? "not_applicable"
            : withdrawn && !entry
              ? "withdrawn"
              : entry || !complete
                ? "review"
                : canReview &&
                    review?.outstanding &&
                    review.recommended_end === ref.endOn
                  ? "overdue"
                  : manual
                    ? "manual"
                    : past || !ref.startOn
                      ? "review"
                      : "upcoming";
      return [
        {
          rule,
          stage: stage(rule),
          entry,
          item,
          ref,
          review,
          canReview,
          status,
          label: vaccines?.[rule.vaccine_code]?.label_fr ?? rule.vaccine_code,
          condition:
            rule.dose_code === "HB1"
              ? "Uniquement si la dose de naissance a été omise, après vérification clinique."
              : rule.eligibility === "female"
                ? "Référence réservée aux filles."
                : null,
        },
      ];
    })
    .sort(
      (a, b) =>
        a.stage.order - b.stage.order ||
        a.rule.dose_code.localeCompare(b.rule.dose_code),
    );
  const upcoming = rows
    .filter((row) => row.status === "upcoming")
    .sort((a, b) => a.ref.startOn!.localeCompare(b.ref.startOn!));
  const unlisted = active.filter(
    (entry) => !rows.some((row) => row.entry?.root_id === entry.root_id),
  );
  return {
    approved,
    rows,
    upcoming,
    unlisted,
    completed: active.filter((entry) =>
      recordedAdministration(entry, child, today),
    ).length,
    overdue: rows.filter((row) => row.status === "overdue").length,
    needsReview:
      !complete ||
      child.history_status !== "reviewed" ||
      rows.some((row) => row.status === "review" || row.status === "manual") ||
      unlisted.some((entry) => !recordedAdministration(entry, child, today)),
  };
}
