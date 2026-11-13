"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { authOrigin } from "@/lib/auth-origin";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { requireUser } from "@/lib/auth";
export type AuthState = { error?: string; message?: string };
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
