"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { reportOperationalEvent } from "@/lib/operational-events";
import { randomBytes, createHash } from "node:crypto";
import { requireApprovedDoctor } from "@/lib/auth";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type ParentState = { error?: string; success?: boolean };
export type InvitationState = ParentState & { invitationUrl?: string };
export async function addParentChildDraft(
  _: ParentState,
  form: FormData,
): Promise<ParentState> {
  const { supabase } = await requireUser();
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const operation = text("operationId");
  const given = text("givenName");
  const family = text("familyName");
  const birth = text("birthDate");
  if (
    !uuid.test(operation) ||
    !given ||
    !family ||
    given.length > 100 ||
    family.length > 100 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(birth)
  )
    return { error: "Vérifiez le prénom, le nom et la date de naissance." };
  const { data, error } = await supabase.rpc("add_parent_child_draft", {
    p_operation_id: operation,
    p_given_name: given,
    p_family_name: family,
    p_birth_date: birth,
  });
  if (
    error?.code === "22023" ||
    error?.code === "22007" ||
    error?.code === "22008"
  )
    return { error: "Saisissez une date de naissance valide." };
  if (error || typeof data !== "string" || !uuid.test(data))
    return failure(error?.code);
  revalidatePath("/parent");
  revalidatePath("/parent/add-child");
  redirect(`/parent/add-child?added=${data}#fiche-${data}`);
}

export async function issueParentChildDraft(
  draftId: string,
): Promise<{ url?: string; expiresAt?: string; error?: string }> {
  const { supabase } = await requireUser();
  const base = new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://mon-enfant.vercel.app",
  );
  if (
    !uuid.test(draftId) ||
    (base.protocol !== "https:" && process.env.NODE_ENV !== "development")
  )
    return { error: "Cette fiche est indisponible." };
  const { data, error } = await supabase.rpc("issue_parent_child_draft", {
    p_draft_id: draftId,
    p_consent: true,
  });
  if (error || !data?.token || !data.expires_at) return failure(error?.code);
  return {
    url: `${base.origin}/share#draft=${data.token}`,
    expiresAt: data.expires_at,
  };
}
function failure(code: string | undefined) {
  if (code === "42501" || code === "PT409")
    return {
      error:
        "Demande indisponible ou modifiée. Vérifiez vos autorisations et actualisez la page.",
    };
  if (code === "PT429")
    return {
      error:
        "Trop de demandes. Attendez avant de réessayer, ou contactez le professionnel pour une question urgente.",
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
  if (form.get("returnTo") === "parent") redirect("/parent");
  return { success: true };
}

export async function saveParentSettings(
  _: ParentState,
  form: FormData,
): Promise<ParentState> {
  const { supabase } = await requireUser();
  const phone = String(form.get("contactPhone") ?? "").trim(),
    days = Number(form.get("reminderDays"));
  if ((phone && !/^[+0-9 ()-]{5,32}$/.test(phone)) || ![1, 3, 7].includes(days))
    return failure("22023");
  const { error } = await supabase.rpc("save_parent_settings", {
    p_contact_phone: phone || null,
    p_email_updates: form.get("emailUpdates") === "on",
    p_reminder_days: days,
  });
  if (error) return failure(error.code);
  revalidatePath("/parent/settings");
  return { success: true };
}
export async function requestParentCorrection(
  _: ParentState,
  form: FormData,
): Promise<ParentState> {
  const { supabase } = await requireUser();
  const operation = String(form.get("operationId") ?? ""),
    child = String(form.get("childId") ?? ""),
    category = String(form.get("category") ?? ""),
    entry = String(form.get("entryId") ?? ""),
    message = String(form.get("message") ?? "").trim();
  if (
    !uuid.test(operation) ||
    !uuid.test(child) ||
    !["clinical", "identity", "access", "other"].includes(category) ||
    (entry && !uuid.test(entry)) ||
    message.length < 20 ||
    message.length > 2000
  )
    return failure("22023");
  const { error } = await supabase.rpc("request_parent_correction", {
    p_operation_id: operation,
    p_child_id: child,
    p_category: category,
    p_entry_id: entry || null,
    p_message: message,
  });
  if (error) return failure(error.code);
  revalidatePath(`/parent/children/${child}/requests`);
  revalidatePath("/parent/requests");
  revalidatePath("/parent-requests");
  return { success: true };
}
export async function respondParentCorrection(
  _: ParentState,
  form: FormData,
): Promise<ParentState> {
  const { supabase } = await requireUser();
  const operation = String(form.get("operationId") ?? ""),
    request = String(form.get("requestId") ?? ""),
    child = String(form.get("childId") ?? ""),
    outcome = String(form.get("outcome") ?? ""),
    entry = String(form.get("correctionEntryId") ?? ""),
    message = String(form.get("message") ?? "").trim();
  if (
    ![operation, request, child].every((id) => uuid.test(id)) ||
    !["answered", "rejected", "corrected", "withdrawn"].includes(outcome) ||
    (entry && !uuid.test(entry)) ||
    message.length < 10 ||
    message.length > 2000
  )
    return failure("22023");
  const { error } = await supabase.rpc("respond_parent_correction", {
    p_operation_id: operation,
    p_request_id: request,
    p_outcome: outcome,
    p_message: message,
    p_correction_entry_id: entry || null,
  });
  if (error) return failure(error.code);
  revalidatePath(`/parent/children/${child}/requests`);
  revalidatePath("/parent/requests");
  revalidatePath("/parent-requests");
  return { success: true };
}

export async function markParentUpdatesRead(
  _: ParentState,
  form: FormData,
): Promise<ParentState> {
  const { supabase } = await requireUser();
  const through = String(form.get("readThrough") ?? "");
  if (!Number.isFinite(Date.parse(through))) return failure("22023");
  const { error } = await supabase.rpc("mark_parent_updates_read", {
    p_read_through: through,
  });
  if (error) return failure(error.code);
  revalidatePath("/parent/notifications");
  return { success: true };
}
