"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedDoctor } from "@/lib/auth";
import { uuidPattern } from "@/lib/registry/types";

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
  if (
    ![child, version, operation].every((id) => uuidPattern.test(id)) ||
    (previous && !uuidPattern.test(previous)) ||
    !dose ||
    dose.length > 100 ||
    !["confirm", "retract"].includes(decision) ||
    reason.length < 10 ||
    reason.length > 1000 ||
    form.get("reviewed") !== "on"
  )
    return {
      error:
        "Vérifiez le dossier et saisissez un motif de 10 à 1 000 caractères.",
    };
  const { supabase } = await requireApprovedDoctor();
  const { error } = await supabase.rpc("review_booklet_dose", {
    p_operation_id: operation,
    p_child_id: child,
    p_version_id: version,
    p_dose_code: dose,
    p_expected_id: previous || null,
    p_outstanding: decision === "confirm",
    p_reason: reason,
  });
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
        "La décision n’a pas été enregistrée. Vérifiez la référence avant de réessayer.",
    };
  revalidatePath(`/patients/${child}/vaccinations`);
  return { saved: true };
}
