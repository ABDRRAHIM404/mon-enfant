"use server";
import { resolveAppointmentTime } from "@/lib/appointments/calendar";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProfessional } from "@/lib/auth";
import {
  readVaccineSelection,
  type VaccineChoice,
} from "@/lib/vaccines/choices";
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
  const correctionReason = text(form, "correction_reason");
  if (
    root &&
    (form.getAll("correction_reason").length !== 1 ||
      correctionReason.length < 10 ||
      correctionReason.length > 1000)
  )
    return {
      error:
        "Précisez un motif de correction distinct (10 à 1 000 caractères). Rechargez le formulaire si ce champ est absent.",
    };
  const payload: Record<string, string | number> = {};
  for (const field of provisionalFields[kind]) {
    const value = text(form, field.key);
    if (value)
      payload[field.key] = field.type === "number" ? Number(value) : value;
  }
  if (kind === "vaccination" && form.has("vaccine_choice")) {
    const vocabulary = await supabase.rpc("vaccine_form_choices");
    if (vocabulary.error)
      return {
        error:
          "Le catalogue est indisponible. Rechargez la page avant d’enregistrer.",
      };
    try {
      const selected = readVaccineSelection(
        form,
        vocabulary.data as VaccineChoice[],
      );
      Object.assign(payload, selected);
      // Uncatalogued names carry no asserted official code or mapping.
      if (!selected.catalog_version_id) delete payload.vaccine_code;
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Choix vaccinaux invalides.",
      };
    }
  }
  if (kind === "risk") {
    payload.category = text(form, "category");
    payload.severity = text(form, "severity");
  }
  if (kind === "appointment") {
    payload.status = text(form, "status");
    if (form.has("scheduled_local")) {
      try {
        payload.scheduled_for = resolveAppointmentTime(
          text(form, "scheduled_local"),
          text(form, "scheduled_offset") || "auto",
        );
      } catch (error) {
        return {
          error:
            error instanceof RangeError
              ? error.message
              : "Vérifiez l’heure du rendez-vous.",
        };
      }
    }
  }
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
    p_reason: root ? correctionReason : null,
    p_entry_state: text(form, "entry_state") || "active",
  });
  if (error) return { error: errorMessage(error.code) };
  revalidatePath(`/provisional/${child}`);
  redirect(`/provisional/${child}`);
}
