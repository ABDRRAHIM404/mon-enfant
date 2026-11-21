import { vaccinationDetails } from "./patient-types";

export function vaccinationValidationMessage(
  error: { code?: string; message: string },
  input: {
    p_payload: Record<string, unknown>;
    p_occurrence_precision: string;
    p_occurred_on: string | null;
    p_source_type: string;
    p_source_reference: string | null;
    p_source_verified: boolean;
  },
): string | undefined {
  if (error.code === "22007" || error.code === "22008")
    return "Date du soin : saisissez une date valide.";
  if (error.code !== "22023") return;

  switch (error.message) {
    case "Known/unknown lot, site, provider and facility must be explicit": {
      const { p_payload: payload } = input;
      const detail = vaccinationDetails.find(({ status, field }) => {
        const certainty = payload[status];
        const filled = String(payload[field] ?? "").trim() !== "";
        return (
          (certainty !== "known" &&
            certainty !== "unknown" &&
            !(status === "lot_status" && certainty === "not_applicable")) ||
          (certainty === "known") !== filled
        );
      });
      if (detail) {
        const { label, status } = detail;
        return payload[status] === "known"
          ? `${label} : renseignez la valeur ou choisissez « Inconnu » si elle est inconnue.`
          : `${label} : choisissez « Connu » pour saisir une valeur ou laissez la valeur vide si elle est inconnue.`;
      }
      return "Vérifiez la certitude et les valeurs du lot, du site, du professionnel et du lieu d’administration.";
    }
    case "Matching requires an exact intended item; uncertain entries remain unmatched":
      return input.p_payload.matching_status === "unmatched"
        ? "Rapprochement : laissez la référence prévue vide pour une vaccination non rapprochée."
        : "Rapprochement : choisissez la référence prévue pour cette dose.";
    case "Vaccine does not match the intended item":
      return "Référence prévue : elle doit correspondre au vaccin sélectionné.";
    case "Matching needs active intended item, exact date, verified source and eligibility":
      if (!input.p_occurred_on || input.p_occurrence_precision !== "exact")
        return "Rapprochement : renseignez une date de soin exacte pour valider la référence.";
      if (!input.p_source_verified)
        return "Rapprochement : contrôlez la source avant de valider la référence.";
      return "Rapprochement : vérifiez que la référence est active, que son catalogue a été validé et que l’enfant est éligible.";
    case "Vaccine identity and explicit matching state required":
      return "Vérifiez le vaccin sélectionné et la décision de rapprochement.";
    case "Invalid occurrence date or certainty":
      if (input.p_occurrence_precision === "unknown")
        return "Date du soin : laissez-la vide quand sa certitude est « Inconnue ».";
      if (!input.p_occurred_on)
        return "Date du soin : renseignez une date pour une certitude « Exacte » ou « Estimée ».";
      return "Date du soin : elle doit être comprise entre 1900 et aujourd’hui et ne peut pas précéder la date de naissance exacte du dossier.";
    case "Invalid provenance or entry state":
      if (
        input.p_source_type === "observed" &&
        input.p_occurrence_precision !== "exact"
      )
        return "Provenance : « Observé par le professionnel » exige une date de soin exacte.";
      if (
        input.p_source_type !== "observed" &&
        (input.p_source_reference?.length ?? 0) < 3
      )
        return "Référence de la source : indiquez au moins trois caractères pour une transcription papier ou un historique rapporté.";
      return "Vérifiez la provenance, la référence de la source et l’état de la saisie.";
    case "Amendment reason required":
      return "Motif de correction ou de retrait : renseignez au moins dix caractères.";
    case "Operation ID reused with different input":
      return "Cette saisie a déjà été utilisée. Rechargez le dossier avant de soumettre une nouvelle saisie.";
  }
}
