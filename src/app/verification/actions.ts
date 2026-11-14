"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { reportOperationalEvent } from "@/lib/operational-events";
import {
  EVIDENCE_BUCKET,
  EVIDENCE_SIZE_ERROR,
  validateEvidenceSize,
  evidenceExtension,
  normalizeRegistration,
  validateApplication,
} from "@/lib/verification/validation";
export type SubmissionState = { error?: string; success?: boolean };
export async function submitApplication(
  _: SubmissionState,
  form: FormData,
): Promise<SubmissionState> {
  const { user, supabase } = await requireUser();
  const displayName = String(form.get("displayName") ?? "");
  const registration = normalizeRegistration(
    String(form.get("registration") ?? ""),
  );
  const facility = String(form.get("facility") ?? "");
  const invalid = validateApplication(displayName, registration, facility);
  if (invalid) return { error: invalid };
  if (form.get("syntheticOnly") !== "on")
    return {
      error:
        "Confirmez l’utilisation de justificatifs fictifs pour cet environnement de test.",
    };
  const file = form.get("evidence");
  if (!(file instanceof File)) return { error: EVIDENCE_SIZE_ERROR };
  const invalidSize = validateEvidenceSize(file.size);
  if (invalidSize) return { error: invalidSize };
  const { data: profile, error: profileError } = await supabase
    .from("professional_profiles")
    .select("role,verification_status")
    .eq("user_id", user.id)
    .single();
  if (
    profileError ||
    !profile ||
    !["doctor", "nurse"].includes(profile.role) ||
    !["unverified", "rejected"].includes(profile.verification_status)
  )
    return { error: "Votre compte ne permet pas une nouvelle soumission." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = evidenceExtension(file.type, bytes);
  if (!extension)
    return {
      error:
        "Le contenu du fichier ne correspond pas à un PDF, JPEG ou PNG valide.",
    };
  const requestId = randomUUID();
  const path = `${user.id}/${requestId}/evidence.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) {
    const reference = reportOperationalEvent("verification_upload_failed");
    return {
      error: `Le document n’a pas pu être enregistré. Réessayez. Référence : ${reference}`,
    };
  }
  const { error } = await supabase.rpc("submit_verification", {
    p_request_id: requestId,
    p_display_name: displayName.trim(),
    p_registration_number: registration,
    p_facility_name: facility.trim(),
    p_evidence_path: path,
  });
  if (error) {
    await supabase.storage.from(EVIDENCE_BUCKET).remove([path]);
    if (error.code === "23505")
      return {
        error:
          "Un dossier actif existe déjà pour ce compte ou ce matricule. Contactez un administrateur pour une vérification manuelle.",
      };
    const reference = reportOperationalEvent("verification_submission_failed");
    return {
      error: `La soumission n’a pas abouti. Aucun accès clinique n’a été accordé. Référence : ${reference}`,
    };
  }
  revalidatePath("/account");
  revalidatePath("/verification");
  return { success: true };
}
