import { routineReference } from "@/lib/vaccines/calendar";
import type { PatientVaccineItem } from "@/lib/vaccines/patient-types";
import type { ParentChild } from "@/lib/parents/types";
const unavailable: Record<string, string> = {
  unreviewed_version:
    "Version non approuvée ou retirée : nouvelle date non calculée.",
  disabled_reference_only:
    "Calcul automatique désactivé : décision du professionnel nécessaire.",
  birth_date_uncertain: "Naissance incertaine : date non calculée.",
  eligibility_unknown: "Éligibilité inconnue : date non calculée.",
  ineligible:
    "Éligibilité non établie : réexamen par le professionnel nécessaire.",
};
export function VaccineRoutineReference({
  item,
  child,
  today,
}: {
  item: PatientVaccineItem;
  child: ParentChild;
  today: string;
}) {
  if (item.state === "withdrawn")
    return <p>Référence retirée : aucune nouvelle date calculée.</p>;
  const reference = routineReference(
    {
      doseCode: item.dose_code,
      vaccineCode: item.vaccine_code,
      age: item.age,
      eligibility: item.eligibility,
      automaticScheduling: item.automatic_scheduling,
    },
    {
      birthDate: child.birth_date,
      birthPrecision: child.birth_date_precision as
        "exact" | "estimated" | "unknown",
      sex: child.sex as "female" | "male" | "unknown",
    },
    { status: item.version_status, reviewVerified: item.review_verified },
  );
  if (!reference.startOn)
    return <p>{unavailable[reference.state] ?? "Date non calculée."}</p>;
  return (
    <>
      <p>
        {reference.isWindow
          ? `Fenêtre de routine : ${reference.startOn} au ${reference.endOn} inclus`
          : `Date de référence de routine : ${reference.startOn}`}
      </p>
      {reference.endOn &&
        reference.endOn >= today &&
        !item.documented_entries.length && (
          <p className="notice">
            Référence à venir ou en cours. Le professionnel confirme les soins
            et le rendez-vous à prévoir.
          </p>
        )}
    </>
  );
}
