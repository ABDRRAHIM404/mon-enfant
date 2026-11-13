"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireVaccineCatalog } from "@/lib/auth";
import { uuidPattern } from "@/lib/registry/types";
import { reportOperationalEvent } from "@/lib/operational-events";
export type CatalogState = { error?: string };
export async function changeCatalog(
  _: CatalogState,
  form: FormData,
): Promise<CatalogState> {
  const { supabase } = await requireVaccineCatalog();
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const id = text("versionId"),
    op = text("operationId"),
    action = text("action");
  if (
    !uuidPattern.test(id) ||
    !uuidPattern.test(op) ||
    !["clone", "edit", "approve", "retire"].includes(action)
  )
    return { error: "Rechargez la version et sélectionnez une action valide." };
  const input: Record<string, unknown> = {
    reason: text("reason"),
    evidence_reference: text("evidence_reference"),
  };
  if (action === "clone") input.label = text("label");
  if (action === "edit")
    Object.assign(input, {
      dose_code: text("dose_code"),
      age:
        text("unit") === "first_4_weeks"
          ? { unit: "first_4_weeks" }
          : { unit: text("unit"), value: Number(text("age_value")) },
      eligibility: text("eligibility"),
      automatic_scheduling: text("automatic_scheduling") === "on",
    });
  if (action === "approve")
    Object.assign(input, {
      source_authenticated: text("source_authenticated") === "on",
      clinical_reviewed: text("clinical_reviewed") === "on",
      birth_window_reviewed: text("birth_window_reviewed") === "on",
    });
  const { data, error } = await supabase.rpc("change_vaccine_catalog", {
    p_operation_id: op,
    p_action: action,
    p_version_id: id,
    p_expected_revision: Number(text("revision")),
    p_input: input,
  });
  if (error) {
    if (error.code === "PT409")
      return {
        error:
          "Cette version a changé. Rechargez la page avant de modifier ou revoir le catalogue.",
      };
    if (error.code === "42501")
      return {
        error:
          "Cette action exige une permission actuelle distincte. Un brouillon est requis pour modifier ou approuver ; la revue doit être indépendante de l’édition.",
      };
    if (["22023", "23514", "23502", "22P02"].includes(error.code ?? ""))
      return {
        error:
          "Vérifiez le motif, la source contrôlée et les attestations. HB1 reste désactivé, les fenêtres de naissance, HPV et les mois du rotavirus doivent respecter les décisions confirmées.",
      };
    const ref = reportOperationalEvent("vaccine_catalog_failed");
    return { error: `Le catalogue n’a pas été modifié. Référence : ${ref}` };
  }
  revalidatePath("/vaccines");
  revalidatePath(`/vaccines/${id}`);
  redirect(`/vaccines/${data}`);
}
