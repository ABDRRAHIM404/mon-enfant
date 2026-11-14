"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { reportOperationalEvent } from "@/lib/operational-events";
export type ParentState = { error?: string; success?: boolean };
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
