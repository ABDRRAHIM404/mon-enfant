"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedDoctor } from "@/lib/auth";
import { uuidPattern } from "@/lib/registry/types";
import { parseAppointmentDate } from "@/lib/appointments/calendar";

type ReviewState = { error?: string; saved?: boolean };

export async function reviewBookletDose(
  _: ReviewState,
  form: FormData,
): Promise<ReviewState> {
  const text = (field: string) => String(form.get(field) ?? "").trim();
  const child = text("child"),
    version = text("version"),
    operation = text("operation"),
    previous = text("previous"),
    dose = text("dose"),
    reason = text("reason"),
    decision = text("decision");
  let date: string | null = null;
  if (
    ![child, version, operation].every((id) => uuidPattern.test(id)) ||
    (previous && !uuidPattern.test(previous)) ||
    !dose ||
    dose.length > 100 ||
    !["administered", "not_administered", "uncertain"].includes(decision) ||
    (decision !== "uncertain" && reason.length < 10) ||
    reason.length > 1000
  )
    return {
      error:
        "Choisissez une décision et renseignez le motif et la source si nécessaire.",
    };
  if (decision === "administered") {
    try {
      date = parseAppointmentDate(text("administeredOn"));
    } catch {
      return {
        error:
          "Indiquez la date exacte figurant sur le carnet ou utilisez la saisie avec date incertaine.",
      };
    }
  }
  const { supabase } = await requireApprovedDoctor();
  const { error } = await supabase.rpc("verify_booklet_dose", {
    p_operation_id: operation,
    p_child_id: child,
    p_version_id: version,
    p_dose_code: dose,
    p_expected_id: previous || null,
    p_decision: decision,
    p_administered_on: decision === "administered" ? date : null,
    p_reason: reason || null,
  });
  if (error?.hint === "booklet_facility")
    return {
      error:
        "Le lieu de saisie ne peut pas être identifié. Ouvrez la saisie complète pour sélectionner votre lieu d’exercice.",
    };
  if (
    error?.hint === "booklet_existing_record" ||
    error?.hint === "vaccine_duplicate_review"
  )
    return {
      error:
        "Une saisie correspondante ou potentiellement en doublon existe. Consultez l’historique et corrigez la saisie existante si nécessaire.",
    };
  if (error?.code === "42501")
    return {
      error: "L’accès au dossier ou l’habilitation vaccinale est indisponible.",
    };
  if (error?.code === "PT409")
    return {
      error:
        "Le dossier ou la référence a changé. Rechargez la page et consultez les saisies avant de réessayer.",
    };
  if (error)
    return {
      error:
        "La décision n’a pas été enregistrée. Vérifiez la date d’administration et la référence.",
    };
  for (const path of [
    `/patients/${child}`,
    `/patients/${child}/vaccinations`,
    `/patients/${child}/records`,
    `/patients/${child}/appointments`,
    `/patients/${child}/summary`,
    "/appointments",
    "/follow-up",
    "/dashboard",
  ])
    revalidatePath(path);
  return { saved: true };
}
