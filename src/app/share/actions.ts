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
};
const unavailable =
  "Partage indisponible, expiré ou non autorisé. Demandez un nouveau code au responsable.";
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
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { error: unavailable };
  const { data, error } = await supabase.rpc("redeem_clinician_share", {
    p_token: token,
  });
  if (error || !(data as ShareReceipt)?.accepted) return { error: unavailable };
  return { share: data as ShareReceipt };
}
