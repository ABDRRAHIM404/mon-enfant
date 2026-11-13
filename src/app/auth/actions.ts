"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { authOrigin } from "@/lib/auth-origin";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { requireUser } from "@/lib/auth";
import { reportOperationalEvent } from "@/lib/operational-events";
export type AuthState = { error?: string; message?: string; passwordChanged?: boolean };
function credentials(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    email.length <= 254 &&
    password.length >= 12 &&
    password.length <= 128
    ? { email, password }
    : null;
}
export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  if (!supabaseConfig())
    return { error: "Le service de connexion est en cours de configuration." };
  const input = credentials(form);
  if (!input)
    return {
      error:
        "Vérifiez votre adresse e-mail et votre mot de passe (12 à 128 caractères).",
    };
  const client = await createClient();
  const { error } = await client.auth.signInWithPassword(input);
  if (error)
    return {
      error:
        "Connexion impossible. Vérifiez vos identifiants et la confirmation de votre e-mail.",
    };
  redirect("/account");
}
export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  if (!supabaseConfig())
    return { error: "Le service de connexion est en cours de configuration." };
  const input = credentials(form);
  if (!input)
    return {
      error:
        "Indiquez un e-mail valide et un mot de passe de 12 à 128 caractères.",
    };
  const client = await createClient();
  let siteUrl: string;
  try {
    siteUrl = authOrigin((await headers()).get("origin"), process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000", [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL], process.env.NODE_ENV === "development");
  } catch { return { error: "L’origine de la demande ne correspond pas à cet espace. Rechargez la page." }; }
  const { error } = await client.auth.signUp({
    ...input,
    options: { emailRedirectTo: new URL("/auth/callback", siteUrl).toString() },
  });
  if (error)
    return {
      error: "Inscription indisponible. Réessayez dans quelques instants.",
    };
  return {
    message:
      "Si cette adresse peut être inscrite, un e-mail de confirmation vous sera envoyé. Confirmez votre adresse, puis connectez-vous.",
  };
}
export async function initializeProfile() {
  const { user, supabase } = await requireUser();
  // RLS and column grants enforce unverified doctor defaults, even for direct API calls.
  const { error } = await supabase
    .from("professional_profiles")
    .upsert(
      { user_id: user.id },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (error) throw new Error("Impossible de créer le profil professionnel.");
  redirect("/account");
}
export async function signOut() {
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("Déconnexion impossible. Réessayez.");
  redirect("/login");
}

export async function requestPasswordRecovery(_:AuthState,form:FormData):Promise<AuthState> {
  if (!supabaseConfig()) return { error:"Le service de récupération est en cours de configuration." };
  const email=String(form.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254) return { error:"Indiquez une adresse e-mail valide." };
  let origin:string;
  try { origin=authOrigin((await headers()).get("origin"),process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",[process.env.VERCEL_URL,process.env.VERCEL_BRANCH_URL],process.env.NODE_ENV==="development"); }
  catch { return { error:"Rechargez la page depuis votre espace habituel." }; }
  const client=await createClient();
  const { error }=await client.auth.resetPasswordForEmail(email,{ redirectTo:`${origin}/auth/callback?next=reset-password` });
  if (error) reportOperationalEvent("password_recovery_failed");
  return { message:"Si cette adresse correspond à un compte éligible, un lien de récupération sera envoyé. Ouvrez-le dans ce même navigateur." };
}
export async function changePassword(_:AuthState,form:FormData):Promise<AuthState> {
  const { supabase }=await requireUser();
  const password=String(form.get("password") ?? "");
  if (password.length<12 || password.length>128 || password!==String(form.get("confirmation") ?? "")) return { error:"Les deux mots de passe doivent être identiques et comporter 12 à 128 caractères." };
  const { error }=await supabase.auth.updateUser({ password });
  if (error) { reportOperationalEvent("password_reset_failed");return { error:"Le mot de passe n’a pas pu être modifié. Choisissez un nouveau mot de passe ou demandez un nouveau lien." }; }
  const { error:logoutError }=await supabase.auth.signOut({ scope:"global" });
  if (logoutError) { reportOperationalEvent("password_reset_failed");return { passwordChanged:true }; }
  redirect("/login?password=updated");
}
