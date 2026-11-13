"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireApprovedDoctor } from "@/lib/auth";
import { uuidPattern } from "@/lib/registry/types";
import { resolveAppointmentTime } from "@/lib/appointments/calendar";
import { reportOperationalEvent } from "@/lib/operational-events";
export type AppointmentFormState = { error?: string };
export async function saveAppointment(
  _: AppointmentFormState,
  form: FormData,
): Promise<AppointmentFormState> {
  const { supabase } = await requireApprovedDoctor();
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const child = text("childId"),
    id = text("appointmentId"),
    operation = text("operationId"),
    decision = text("decision");
  if (
    !uuidPattern.test(child) ||
    !uuidPattern.test(operation) ||
    (id && !uuidPattern.test(id))
  )
    return { error: "Identifiants invalides. Rechargez le dossier." };
  if (text("syntheticOnly") !== "on")
    return { error: "Confirmez l’utilisation de données fictives." };
  let start: string | null = null,
    end: string | null = null;
  if (!id || decision === "reschedule") {
    try {
      start = resolveAppointmentTime(
        text("starts_local"),
        text("starts_offset") || "auto",
      );
      end = resolveAppointmentTime(
        text("ends_local"),
        text("ends_offset") || "auto",
      );
    } catch (error) {
      return {
        error:
          error instanceof RangeError
            ? error.message
            : "Vérifiez la date et les heures du créneau.",
      };
    }
  }
  if (id) {
    const access = await supabase.rpc("appointment_history", {
      p_child_id: child,
      p_appointment_id: id,
    });
    if (access.error)
      return { error: "Ce rendez-vous est indisponible pour ce dossier." };
  }
  const common = {
    p_operation_id: operation,
    p_starts_at: start,
    p_ends_at: end,
    p_reason: text("reason"),
    p_reviewed: text("reviewed") === "on",
  };
  const result = id
    ? await supabase.rpc("change_appointment", {
        ...common,
        p_appointment_id: id,
        p_expected_revision: Number(text("expected_revision")),
        p_action: decision,
      })
    : await supabase.rpc("create_appointment", {
        ...common,
        p_child_id: child,
        p_facility_id: text("facility_id"),
        p_purpose: text("purpose"),
        p_purpose_label: text("purpose_label"),
        p_vaccine_item_id:
          text("purpose") === "vaccination"
            ? text("vaccine_item_id") || null
            : null,
      });
  if (result.error) {
    if (result.error.code === "PT409")
      return {
        error:
          result.error.hint === "vaccine_item_documented"
            ? "La dose est déjà documentée. Examinez le dossier et le suivi actualisé avant de planifier."
            : result.error.hint === "appointment_duplicate"
              ? "Vous avez déjà un rendez-vous ouvert pour cette référence. Ouvrez-le pour le replanifier."
              : "Une autre décision a été enregistrée. Rechargez l’historique avant de poursuivre.",
      };
    if (result.error.code === "42501")
      return {
        error:
          "Le médecin responsable, le lieu, votre accès au dossier ou l’habilitation ne permet plus cette décision.",
      };
    if (
      ["22023", "22P02", "22007", "22008", "23514", "23502"].includes(
        result.error.code ?? "",
      )
    )
      return {
        error:
          "Vérifiez le motif, l’attestation, la référence et le créneau (fin après début, durée maximale 24 heures). Une vaccination se documente dans le dossier clinique ; replanifier ne l’administre pas.",
      };
    return {
      error: `La décision n’a pas abouti. Référence : ${reportOperationalEvent("appointment_action_failed")}`,
    };
  }
  for (const path of [
    "/appointments",
    "/follow-up",
    "/dashboard",
    "/patients",
    `/patients/${child}`,
    `/patients/${child}/appointments`,
    `/patients/${child}/summary`,
  ])
    revalidatePath(path);
  redirect(`/patients/${child}/appointments/${id || result.data}`);
}
