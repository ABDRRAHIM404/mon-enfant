"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { reportOperationalEvent } from "@/lib/operational-events";
import { randomBytes, createHash } from "node:crypto";
import { requireApprovedDoctor } from "@/lib/auth";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type ParentState = { error?: string; success?: boolean };
export type InvitationState = ParentState & { invitationUrl?: string };
function failure(code: string | undefined) {
  if (code === "42501" || code === "PT409")
    return {
      error:
        "Demande indisponible ou modifiée. Vérifiez vos autorisations et actualisez la page.",
    };
  if (code === "22023")
    return {
      error: "Vérifiez les informations, le motif et les contrôles requis.",
    };
  const reference = reportOperationalEvent("parent_action_failed");
  return {
    error: `L’opération n’a pas pu être enregistrée. Référence : ${reference}`,
  };
}
export async function saveParentProfile(
  _: ParentState,
  form: FormData,
): Promise<ParentState> {
  const { supabase } = await requireUser();
  const name = String(form.get("displayName") ?? "").trim();
  if (name.length < 2 || name.length > 150)
    return { error: "Indiquez votre nom (2 à 150 caractères)." };
  const { error } = await supabase.rpc("save_parent_profile", {
    p_display_name: name,
  });
  if (error) {
    if (error.code === "42501")
      return {
        error:
          "Confirmez votre adresse e-mail et reconnectez-vous pour continuer.",
      };
    const reference = reportOperationalEvent("parent_action_failed");
    return {
      error: `Le profil n’a pas pu être enregistré. Référence : ${reference}`,
    };
  }
  revalidatePath("/parent");
  return { success: true };
}

export async function createGuardianInvitation(
  _: InvitationState,
  form: FormData,
): Promise<InvitationState> {
  const { supabase } = await requireApprovedDoctor();
  const child = String(form.get("childId") ?? ""),
    email = String(form.get("recipientEmail") ?? "").trim(),
    reason = String(form.get("reason") ?? "").trim();
  if (
    !uuid.test(child) ||
    !/^[^\s<>]+@[^\s<>]+\.[^\s<>]+$/.test(email) ||
    email.length > 254 ||
    reason.length < 10 ||
    reason.length > 1000
  )
    return failure("22023");
  const token = randomBytes(32).toString("base64url");
  const { error } = await supabase.rpc("create_guardian_invitation", {
    p_child_id: child,
    p_recipient_email: email,
    p_token_hash: createHash("sha256").update(token).digest("hex"),
    p_reason: reason,
  });
  if (error) return failure(error.code);
  const site = new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://mon-enfant.vercel.app",
  ).origin;
  revalidatePath(`/patients/${child}/guardians`);
  return {
    success: true,
    invitationUrl: `${site}/parent/invitation#invite=${token}`,
  };
}

export async function claimGuardianInvitation(
  _: ParentState,
  form: FormData,
): Promise<ParentState> {
  const { supabase } = await requireUser();
  const token = String(form.get("token") ?? ""),
    relationship = String(form.get("relationship") ?? "").trim(),
    operation = String(form.get("operationId") ?? "");
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(token) ||
    !uuid.test(operation) ||
    relationship.length < 2 ||
    relationship.length > 100 ||
    form.get("consent") !== "on"
  )
    return { error: "Vérifiez votre invitation et confirmez votre demande." };
  const { error } = await supabase.rpc("claim_guardian_invitation", {
    p_operation_id: operation,
    p_token: token,
    p_relationship: relationship,
    p_consent: true,
  });
  if (error) {
    if (error.message === "Parent profile required")
      return {
        error:
          "Activez d’abord votre profil dans l’espace parent, puis revenez à cette invitation.",
      };
    if (["42501", "PT409"].includes(error.code ?? ""))
      return {
        error:
          "Invitation indisponible, expirée ou déjà utilisée. Connectez-vous avec l’adresse destinataire, ou demandez une nouvelle invitation.",
      };
    return failure(error.code);
  }
  revalidatePath("/parent");
  revalidatePath("/parent/invitation");
  return { success: true };
}

export async function reviewGuardianClaim(
  _: ParentState,
  form: FormData,
): Promise<ParentState> {
  const { supabase } = await requireApprovedDoctor();
  const claim = String(form.get("claimId") ?? ""),
    child = String(form.get("childId") ?? ""),
    operation = String(form.get("operationId") ?? ""),
    revision = Number(form.get("revision"));
  if (
    ![claim, child, operation].every((id) => uuid.test(id)) ||
    !Number.isInteger(revision) ||
    revision < 1
  )
    return failure("22023");
  const { error } = await supabase.rpc("review_guardian_claim", {
    p_operation_id: operation,
    p_claim_id: claim,
    p_expected_revision: revision,
    p_decision: String(form.get("decision") ?? ""),
    p_relationship: String(form.get("relationship") ?? ""),
    p_authority_reference: String(form.get("authorityReference") ?? "").trim(),
    p_reason: String(form.get("reason") ?? "").trim(),
    p_identity_checked: form.get("identityChecked") === "on",
    p_guardianship_checked: form.get("guardianshipChecked") === "on",
    p_expires_on: String(form.get("expiresOn") ?? "") || null,
    p_can_export: form.get("canExport") === "on",
  });
  if (error) return failure(error.code);
  revalidatePath(`/patients/${child}/guardians`);
  revalidatePath("/parent");
  return { success: true };
}

export async function revokeGuardianAccess(
  _: ParentState,
  form: FormData,
): Promise<ParentState> {
  const { supabase } = await requireUser();
  const id = String(form.get("id") ?? ""),
    kind = String(form.get("kind") ?? ""),
    child = String(form.get("childId") ?? ""),
    reason = String(form.get("reason") ?? "").trim();
  if (
    !uuid.test(id) ||
    !uuid.test(child) ||
    !["invitation", "link"].includes(kind) ||
    reason.length < 10 ||
    reason.length > 1000
  )
    return failure("22023");
  const { error } = await supabase.rpc(
    kind === "invitation"
      ? "revoke_guardian_invitation"
      : "revoke_guardian_link",
    { p_id: id, p_reason: reason },
  );
  if (error) return failure(error.code);
  revalidatePath(`/patients/${child}/guardians`);
  revalidatePath(`/parent/children/${child}`);
  revalidatePath("/parent");
  return { success: true };
}
