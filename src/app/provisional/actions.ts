"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProfessional } from "@/lib/auth";
import { provisionalFields } from "@/lib/provisional";
const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export type ProvisionalState = { error?: string };
const text = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
function errorMessage(code?: string) {
  if (code === "PT409")
    return "Ce dossier a changé. Rechargez la page avant de corriger la dernière révision.";
  if (code === "42501")
    return "Ce dossier est indisponible pour votre compte actuel.";
  return "Vérifiez les champs, les dates et les informations de source. Aucun dossier partagé n’a été modifié.";
}
export async function createProvisional(
  _: ProvisionalState,
  form: FormData,
): Promise<ProvisionalState> {
  const { supabase } = await getProfessional();
  if (form.get("syntheticOnly") !== "on")
    return { error: "Confirmez l’utilisation de données fictives." };
  const operation = text(form, "operationId");
  if (!isUuid(operation)) return { error: "Rechargez le formulaire." };
  const identity = Object.fromEntries(
    [
      "given_name",
      "family_name",
      "name_status",
      "birth_date",
      "birth_date_precision",
      "sex",
      "source_reference",
      "local_reference",
    ].map((k) => [k, text(form, k)]),
  );
  const { data, error } = await supabase.rpc("create_provisional_child", {
    p_operation_id: operation,
    p_identity: identity,
  });
  if (error) return { error: errorMessage(error.code) };
  if (!isUuid(data)) return { error: "Réponse indisponible." };
  redirect(`/provisional/${data}`);
}
export async function writeProvisional(
  _: ProvisionalState,
  form: FormData,
): Promise<ProvisionalState> {
  const { supabase } = await getProfessional();
  const child = text(form, "childId"),
    operation = text(form, "operationId"),
    kind = text(form, "kind"),
    root = text(form, "rootId");
  if (
    !isUuid(child) ||
    !isUuid(operation) ||
    (root && !isUuid(root)) ||
    !provisionalFields[kind]
  )
    return { error: "Rechargez le formulaire." };
  const payload: Record<string, string | number> = {};
  for (const field of provisionalFields[kind]) {
    const value = text(form, field.key);
    if (value)
      payload[field.key] = field.type === "number" ? Number(value) : value;
  }
  if (kind === "risk") {
    payload.category = text(form, "category");
    payload.severity = text(form, "severity");
  }
  if (kind === "appointment") payload.status = text(form, "status");
  const { error } = await supabase.rpc("write_provisional_entry", {
    p_operation_id: operation,
    p_child_id: child,
    p_kind: kind,
    p_occurred_on: text(form, "occurred_on") || null,
    p_occurrence_precision: text(form, "occurrence_precision"),
    p_source_type: text(form, "source_type"),
    p_source_reference: text(form, "source_reference") || null,
    p_payload: payload,
    p_root_id: root || null,
    p_expected_revision: root ? Number(text(form, "revision")) : null,
    p_reason: text(form, "reason") || null,
    p_entry_state: text(form, "entry_state") || "active",
  });
  if (error) return { error: errorMessage(error.code) };
  revalidatePath(`/provisional/${child}`);
  redirect(`/provisional/${child}`);
}
