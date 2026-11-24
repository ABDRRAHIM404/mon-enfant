"use server";

import { revalidatePath } from "next/cache";
import { getProfessional } from "@/lib/auth";
import { accountDisplayName } from "@/lib/clinical/account-display-name";

export type AccountEditState = { error?: string; saved?: string };

export async function updateClinicianDisplayName(
  _: AccountEditState,
  form: FormData,
): Promise<AccountEditState> {
  const { profile, supabase } = await getProfessional();
  if (
    !profile ||
    !["doctor", "nurse"].includes(profile.role) ||
    profile.verification_status === "suspended"
  )
    return { error: "Votre compte ne peut pas modifier ce profil." };
  const name = accountDisplayName(form.get("displayName"));
  if (!name) return { error: "Indiquez un nom de 3 à 150 caractères." };
  const { error } = await supabase.auth.updateUser({
    data: { display_name: name },
  });
  if (error)
    return {
      error: "Le nom d’affichage n’a pas pu être enregistré. Réessayez.",
    };
  revalidatePath("/account");
  return { saved: name };
}
