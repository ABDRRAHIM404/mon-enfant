"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireApprovedDoctor } from "@/lib/auth";
import { uuidPattern } from "@/lib/registry/types";
import { reportOperationalEvent } from "@/lib/operational-events";
export type VaccineItemState = { error?: string };
export async function changePatientVaccineItem(
  _: VaccineItemState,
  form: FormData,
): Promise<VaccineItemState> {
  const { supabase } = await requireApprovedDoctor();
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const child = text("childId"),
    item = text("itemId"),
    operation = text("operationId"),
    facility = text("facility_id");
  if (
    ![child, operation, facility].every((value) => uuidPattern.test(value)) ||
    (item && !uuidPattern.test(item))
  )
    return { error: "Identifiants invalides. Rechargez le dossier." };
  if (text("syntheticOnly") !== "on")
    return { error: "Confirmez l’utilisation de données fictives." };
  // The item RPC resolves its actual child again; this route value only controls navigation.
  if (item) {
    const access = await supabase.rpc("vaccine_item_history", {
      p_child_id: child,
      p_item_id: item,
    });
    if (access.error)
      return { error: "La référence est indisponible pour ce dossier." };
  }
  const common = {
    p_operation_id: operation,
    p_facility_id: facility,
    p_reason: text("reason"),
    p_eligibility_checked: text("eligibility_checked") === "on",
  };
  const result = item
    ? await supabase.rpc("change_vaccine_item", {
        ...common,
        p_item_id: item,
        p_expected_revision: Number(text("expected_revision")),
        p_state: text("state"),
      })
    : await supabase.rpc("assign_vaccine_item", {
        ...common,
        p_child_id: child,
        p_version_id: text("version_id"),
        p_dose_code: text("dose_code"),
      });
  if (result.error) {
    if (result.error.code === "PT409")
      return {
        error:
          "La référence a changé ou cette dose possède déjà une référence. Rechargez les références et leur historique.",
      };
    if (result.error.code === "42501")
      return {
        error:
          "Votre habilitation, le lieu ou l’accès au dossier ne permet plus cette décision.",
      };
    if (["22023", "22P02", "23514"].includes(result.error.code ?? ""))
      return {
        error:
          "Une version approuvée, une dose éligible, un motif et l’attestation clinique sont nécessaires pour activer une référence. HB1 reste désactivé.",
      };
    return {
      error: `La décision n’a pas abouti. Référence : ${reportOperationalEvent("patient_vaccine_item_failed")}`,
    };
  }
  revalidatePath(`/patients/${child}/vaccinations`);
  revalidatePath(`/patients/${child}/summary`);
  if (item) revalidatePath(`/patients/${child}/vaccinations/${item}`);
  redirect(`/patients/${child}/vaccinations${item ? `/${item}` : ""}`);
}
