"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { supabaseConfig } from "@/lib/supabase/config";
import {
  shareLabels,
  type ShareReceipt,
  type ShareScope,
} from "@/lib/sharing/types";
import { uuidPattern } from "@/lib/registry/types";
export type ShareActionState = {
  error?: string;
  needsLogin?: boolean;
  share?: ShareReceipt & { url?: string };
  success?: boolean;
  childId?: string;
};
const unavailable =
  "Partage indisponible, expiré ou non autorisé. Demandez un nouveau code au responsable.";
type CareQrState = {
  error?: string;
  cancelled?: boolean;
  invitation?: { id: string; url: string; expires_at: string };
};
export async function issueDoctorCareQr(
  _: CareQrState,
  form: FormData,
): Promise<CareQrState> {
  const { supabase } = await requireUser();
  const child = String(form.get("childId") ?? "");
  const recipient = String(form.get("recipient") ?? "").trim();
  const reason = String(form.get("reason") ?? "").trim();
  const base = new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://mon-enfant.vercel.app",
  );
  if (base.protocol !== "https:" && process.env.NODE_ENV !== "development")
    return { error: "Invitation momentanément indisponible." };
  if (
    !uuidPattern.test(child) ||
    !recipient ||
    recipient.length > 100 ||
    reason.length < 10 ||
    reason.length > 1000 ||
    form.get("confirmed") !== "on"
  )
    return {
      error: "Vérifiez l’identifiant du médecin, le motif et la confirmation.",
    };
  const { data, error } = await supabase.rpc("issue_doctor_care_qr", {
    p_child_id: child,
    p_recipient: recipient,
    p_reason: reason,
    p_confirmed: true,
  });
  if (error?.code === "PT409")
    return { error: "Ce médecin a déjà accès au dossier." };
  if (error || !data?.token)
    return {
      error:
        "Invitation indisponible. Vérifiez l’identifiant du médecin et vos droits sur ce dossier.",
    };
  return {
    invitation: {
      id: data.id,
      url: `${base.origin}/share#care=${data.token}`,
      expires_at: data.expires_at,
    },
  };
}

export async function cancelDoctorCareQr(form: FormData): Promise<CareQrState> {
  const { supabase } = await requireUser();
  const id = String(form.get("id") ?? "");
  if (!uuidPattern.test(id)) return { error: "Invitation indisponible." };
  const { data, error } = await supabase.rpc("cancel_doctor_care_qr", {
    p_id: id,
  });
  return !error && data
    ? { cancelled: true }
    : {
        error:
          "Si le médecin a déjà ouvert le QR, révoquez son accès dans les autorisations du dossier.",
      };
}
export async function issueParentShare(
  form: FormData,
): Promise<ShareActionState> {
  const { supabase } = await requireUser();
  const child = String(form.get("childId") ?? ""),
    scope = String(form.get("scope") ?? "") as ShareScope;
  if (
    !uuidPattern.test(child) ||
    !Object.hasOwn(shareLabels, scope) ||
    form.get("consent") !== "on"
  )
    return {
      error:
        "Choisissez les informations à partager et confirmez votre consentement.",
    };
  const { data, error } = await supabase.rpc("issue_clinician_share", {
    p_child_id: child,
    p_scope: scope,
    p_consent: true,
  });
  if (error) return { error: unavailable };
  const share = data as ShareReceipt;
  if (!share.accepted || !share.token)
    return {
      error:
        "Trop de créations rapprochées. Attendez dix minutes avant de créer un nouveau code.",
    };
  const base = new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://mon-enfant.vercel.app",
  );
  if (base.protocol !== "https:" && process.env.NODE_ENV !== "development")
    return { error: "Partage momentanément indisponible." };
  revalidatePath(`/parent/children/${child}/vaccinations`);
  return {
    share: { ...share, url: `${base.origin}/share#share=${share.token}` },
  };
}
export async function revokeParentShare(
  form: FormData,
): Promise<ShareActionState> {
  const { supabase } = await requireUser();
  const id = String(form.get("shareId") ?? "");
  if (!uuidPattern.test(id)) return { error: unavailable };
  const { error } = await supabase.rpc("revoke_clinician_share", {
    p_share_id: id,
  });
  return error ? { error: unavailable } : { success: true };
}
export async function redeemShare(form: FormData): Promise<ShareActionState> {
  if (!supabaseConfig()) return { error: unavailable };
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user || user.is_anonymous)
    return {
      error:
        "Connectez-vous comme soignant vérifié dans un autre onglet, puis revenez ici pour ouvrir le partage.",
      needsLogin: true,
    };
  const token = String(form.get("token") ?? "");
  if (/^care:[A-Za-z0-9_-]{43}$/.test(token)) {
    const { data, error } = await supabase.rpc("redeem_doctor_care_qr", {
      p_token: token.slice("care:".length),
    });
    if (!error && typeof data === "string" && uuidPattern.test(data)) {
      revalidatePath(`/patients/${data}`);
      return { childId: data };
    }
    return {
      error:
        "Invitation indisponible. Vérifiez votre compte médecin et demandez un nouveau QR si nécessaire.",
    };
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { error: unavailable };
  const { data, error } = await supabase.rpc("redeem_clinician_share", {
    p_token: token,
  });
  if (error || !(data as ShareReceipt)?.accepted) return { error: unavailable };
  return { share: data as ShareReceipt };
}
