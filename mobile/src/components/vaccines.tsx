import { Card, Copy, Title } from "./ui";
import {
  routineReference,
  ageLabel,
  catalogStatus,
  type ParentChild,
  type PatientVaccineItem,
} from "../lib/domain";
import { today } from "../lib/format";
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
export function VaccineReference({
  item,
  child,
}: {
  item: PatientVaccineItem;
  child: ParentChild;
}) {
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
  return (
    <Card>
      <Title small>
        {item.dose_code} · {item.vaccine_code}
      </Title>
      <Copy>
        {item.state === "withdrawn"
          ? "Référence retirée"
          : item.documented_entries.length
            ? "Administration documentée et rapprochée"
            : "Administration non confirmée"}
      </Copy>
      <Copy>
        {item.state === "withdrawn"
          ? "Référence retirée : aucune nouvelle date calculée."
          : !reference.startOn
            ? (unavailable[reference.state] ?? "Date non calculée.")
            : reference.isWindow
              ? `Fenêtre de routine : ${reference.startOn} au ${reference.endOn} inclus`
              : `Date de référence de routine : ${reference.startOn}`}
      </Copy>
      {item.state !== "withdrawn" &&
        reference.endOn &&
        reference.endOn >= today() &&
        !item.documented_entries.length && (
          <Copy>
            Référence à venir ou en cours. Le professionnel confirme les soins
            et le rendez-vous à prévoir.
          </Copy>
        )}
      <Copy small muted>
        {item.version_label} · {catalogStatus[item.version_status]} · Âge
        configuré : {ageLabel(item.age)} · Source : {ageLabel(item.source_age)}{" "}
        · Décision de {item.professional_id}, révision {item.revision}
      </Copy>
      {item.documented_entries.map((e) => (
        <Copy small key={e.id}>
          {e.occurred_on || "Date inconnue"} · {e.professional_id}
        </Copy>
      ))}
    </Card>
  );
}
