import {
  routinePreviewReference,
  type RoutineAge,
  type RoutineReference,
} from "./calendar";
export type ProvisionalFollowup = {
  version: {
    id: string;
    label: string;
    status: "draft" | "approved";
    review_verified: boolean;
  } | null;
  rules: {
    dose_code: string;
    vaccine_code: string;
    label: string;
    age: RoutineAge;
    eligibility: "all" | "female";
    automatic_scheduling: boolean;
  }[];
  declarations_complete: boolean;
  declarations: {
    id: string;
    dose_code: string | null;
    dose_label: string | null;
    vaccine_code: string | null;
    occurred_on: string | null;
    occurrence_precision: string;
    source_type: string;
  }[];
  appointments_total: number;
  appointments: { id: string; purpose: string; scheduled_for: string }[];
};
export function provisionalRoutineRows(
  data: ProvisionalFollowup,
  identity: Record<string, string>,
  today: string,
) {
  if (!data.version) return [];
  const version = data.version;
  const child = {
    birthDate: identity.birth_date || null,
    birthPrecision:
      identity.birth_date_precision === "exact"
        ? ("exact" as const)
        : ("unknown" as const),
    sex:
      identity.sex === "female"
        ? ("female" as const)
        : identity.sex === "male"
          ? ("male" as const)
          : ("unknown" as const),
  };
  return data.rules
    .filter(
      (r) =>
        r.dose_code !== "HB1" &&
        !(r.eligibility === "female" && child.sex === "male"),
    )
    .map((rule) => {
      const reference: RoutineReference = routinePreviewReference(
        {
          doseCode: rule.dose_code,
          vaccineCode: rule.vaccine_code,
          age: rule.age,
          eligibility: rule.eligibility,
          automaticScheduling: rule.automatic_scheduling,
        },
        child,
      );
      return {
        ...rule,
        previewOnly: version.status !== "approved" || !version.review_verified,
        reference,
        past: reference.endOn !== null && reference.endOn < today,
        declared: data.declarations.some(
          (e) =>
            e.vaccine_code === rule.vaccine_code &&
            e.dose_code === rule.dose_code,
        ),
      };
    })
    .filter((r) => r.reference.state !== "ineligible")
    .sort((a, b) => {
      if (a.reference.startOn && b.reference.startOn)
        return (
          a.reference.startOn.localeCompare(b.reference.startOn) ||
          a.dose_code.localeCompare(b.dose_code)
        );
      const unit = { first_4_weeks: 0, weeks: 7, months: 31, years: 366 };
      return (
        (a.age.unit === "first_4_weeks" ? 0 : a.age.value * unit[a.age.unit]) -
          (b.age.unit === "first_4_weeks"
            ? 0
            : b.age.value * unit[b.age.unit]) ||
        a.dose_code.localeCompare(b.dose_code)
      );
    });
}
