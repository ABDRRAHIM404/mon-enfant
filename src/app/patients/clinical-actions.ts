"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  requireApprovedDoctor,
  requireClinicalPermissionManager,
} from "@/lib/auth";
import { reportOperationalEvent } from "@/lib/operational-events";
import { uuidPattern } from "@/lib/registry/types";
import { clinicalKinds } from "@/lib/clinical/types";
export type ClinicalState = { error?: string; success?: boolean };
export async function recordClinical(
  _: ClinicalState,
  form: FormData,
): Promise<ClinicalState> {
  const { supabase } = await requireApprovedDoctor();
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const child = text("childId"),
    operation = text("operationId"),
    root = text("rootId"),
    kind = text("kind");
  if (
    !uuidPattern.test(child) ||
    !uuidPattern.test(operation) ||
    (root && !uuidPattern.test(root)) ||
    !clinicalKinds.includes(kind as (typeof clinicalKinds)[number])
  )
    return {
      error: "Identifiants ou type de saisie invalides. Rechargez le dossier.",
    };
  if (text("syntheticOnly") !== "on")
    return { error: "Confirmez l’utilisation de données fictives." };
  const keys: Record<string, string[]> = {
    consultation: ["reason", "findings", "assessment", "plan"],
    prescription: ["medication", "instructions", "duration"],
    risk: ["category", "description", "severity"],
    growth: ["weight_kg", "height_cm", "head_cm"],
  };
  const payload: Record<string, string | number> = {};
  for (const key of keys[kind])
    if (kind === "growth") {
      if (text(key)) payload[key] = Number(text(key));
    } else payload[key] = text(key);
  const { data, error } = await supabase.rpc("write_clinical_entry", {
    p_operation_id: operation,
    p_child_id: child,
    p_kind: kind,
    p_facility_id: text("facility_id"),
    p_occurred_on: text("occurred_on") || null,
    p_occurrence_precision: text("occurrence_precision"),
    p_source_type: text("source_type"),
    p_source_reference: text("source_reference") || null,
    p_source_verified: text("source_verified") === "on",
    p_payload: payload,
    p_root_id: root || null,
    p_expected_revision: root ? Number(text("expected_revision")) : null,
    p_amendment_reason: root ? text("amendment_reason") : null,
    p_entry_state: root ? text("entry_state") : "active",
  });
  if (error) {
    if (["40001", "PT409"].includes(error.code ?? ""))
      return {
        error:
          "Une autre correction a été enregistrée. Ouvrez de nouveau l’historique avant de modifier la dernière version.",
      };
    if (error.code === "42501")
      return {
        error:
          "L’accès au dossier, le lieu d’exercice ou votre habilitation ne permet plus cette saisie.",
      };
    if (
      ["22023", "23514", "23502", "22P02", "22007", "22008"].includes(
        error.code ?? "",
      )
    )
      return {
        error:
          "Vérifiez les champs requis, les valeurs, la date, sa certitude et la provenance. Les dates inconnues restent vides.",
      };
    const ref = reportOperationalEvent("clinical_write_failed");
    return { error: `La saisie n’a pas abouti. Référence : ${ref}` };
  }
  revalidatePath(`/patients/${child}`);
  revalidatePath(`/patients/${child}/records`);
  revalidatePath(`/patients/${child}/growth`);
  if (root) revalidatePath(`/patients/${child}/records/${root}`);
  redirect(`/patients/${child}/records/${root || data}`);
}
export async function changeClinicalPermission(
  _: ClinicalState,
  form: FormData,
): Promise<ClinicalState> {
  const { supabase } = await requireClinicalPermissionManager();
  const text = (key: string) => String(form.get(key) ?? "").trim();
  if (
    !uuidPattern.test(text("operationId")) ||
    !uuidPattern.test(text("professionalId")) ||
    !["enable", "disable"].includes(text("decision"))
  )
    return { error: "Vérifiez le professionnel et la décision." };
  const { error } = await supabase.rpc("set_clinical_capability", {
    p_operation_id: text("operationId"),
    p_professional_id: text("professionalId"),
    p_capability: text("capability"),
    p_enabled: text("decision") === "enable",
    p_expires_at: text("expires_at") ? `${text("expires_at")}T23:59:59Z` : null,
    p_evidence_reference: text("evidence_reference"),
    p_reason: text("reason"),
    p_verified: text("verified") === "on",
  });
  if (error) {
    if (error.code === "22023")
      return {
        error:
          "Indiquez la source contrôlée, le motif et une échéance future. L’attestation est obligatoire pour accorder une habilitation.",
      };
    const ref = reportOperationalEvent("clinical_permission_failed");
    return { error: `L’habilitation n’a pas été modifiée. Référence : ${ref}` };
  }
  revalidatePath("/admin/clinical-permissions");
  return { success: true };
}
