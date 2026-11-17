"use server";
import { authDestination } from "@/lib/auth-destination";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { emailSendingLimited, emailLimitMessage } from "@/lib/auth-email";
import { authOrigin } from "@/lib/auth-origin";
import { createClient } from "@/lib/supabase/server";
import {
  rememberedSeconds,
  sessionPreferenceCookie,
} from "@/lib/supabase/cookie-lifetime";
import { sessionCookieOptions } from "@/lib/supabase/config";
import { supabaseConfig } from "@/lib/supabase/config";
import { requireUser } from "@/lib/auth";
import { reportOperationalEvent } from "@/lib/operational-events";
export type AuthState = {
  error?: string;
  message?: string;
  passwordChanged?: boolean;
};
function credentials(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    email.length <= 254 &&
    password.length >= 8 &&
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
        "Vérifiez votre adresse e-mail et votre mot de passe (8 à 128 caractères).",
    };
  const remembered = form.get("remember") === "on";
  const client = await createClient(remembered);
  const { error } = await client.auth.signInWithPassword(input);
  if (error)
    return {
      error:
        "Connexion impossible. Vérifiez vos identifiants et la confirmation de votre e-mail.",
    };
  (await cookies()).set(
    sessionPreferenceCookie,
    remembered ? "persistent" : "session",
    {
      ...sessionCookieOptions(),
      ...(remembered ? { maxAge: rememberedSeconds } : {}),
    },
  );
  const destination = authDestination(form.get("destination"));
  if (destination === "/account") {
    const {
      data: { user },
    } = await client.auth.getUser();
    if (user) {
      const { data: profile } = await client
        .from("professional_profiles")
        .select("role,verification_status,professional_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile && ["doctor", "nurse"].includes(profile.role)) {
        if (
          profile.verification_status === "approved" &&
          profile.professional_id
        )
          redirect("/dashboard");
        if (
          ["unverified", "under_review"].includes(profile.verification_status)
        )
          redirect("/provisional");
      }
    }
  }
  redirect(destination);
}
export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  if (!supabaseConfig())
    return { error: "Le service de connexion est en cours de configuration." };
  const input = credentials(form);
  const destination = authDestination(form.get("destination"));
  const displayName = String(form.get("displayName") ?? "").trim();
  if (
    destination === "/account" &&
    (displayName.length < 2 ||
      displayName.length > 100 ||
      [...displayName].some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ))
  )
    return { error: "Indiquez votre nom complet (2 à 100 caractères)." };
  if (!input)
    return {
      error:
        "Indiquez un e-mail valide et un mot de passe de 8 à 128 caractères.",
    };
  const client = await createClient();
  let siteUrl: string;
  try {
    siteUrl = authOrigin(
      (await headers()).get("origin"),
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL],
      process.env.NODE_ENV === "development",
    );
  } catch {
    return {
      error:
        "L’origine de la demande ne correspond pas à cet espace. Rechargez la page.",
    };
  }
  const confirmation = new URL("/auth/callback", siteUrl);
  if (destination !== "/account")
    confirmation.searchParams.set(
      "next",
      destination === "/parent" ? "parent" : "parent-invitation",
    );
  else confirmation.searchParams.set("next", "account");
  const { error } = await client.auth.signUp({
    ...input,
    options: {
      emailRedirectTo: confirmation.toString(),
      // Self-declared presentation data only. Enrollment and authorization remain server-owned.
      ...(destination === "/account"
        ? { data: { display_name: displayName } }
        : {}),
    },
  });
  if (error)
    return {
      error: emailSendingLimited(error)
        ? emailLimitMessage
        : "Inscription indisponible. Réessayez dans quelques instants.",
    };
  return {
    message:
      "Si cette adresse peut être inscrite, un e-mail de confirmation vous sera envoyé. Confirmez votre adresse, puis connectez-vous.",
  };
}
export async function initializeProfile(form: FormData) {
  const { supabase } = await requireUser();
  const role = String(form.get("role") ?? "doctor");
  if (!["doctor", "nurse"].includes(role))
    throw new Error("Choisissez votre métier.");
  const { error } = await supabase.rpc("enroll_clinician", { p_role: role });
  if (error) throw new Error("Impossible de créer le profil soignant.");
  redirect("/provisional");
}
export async function signOut() {
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("Déconnexion impossible. Réessayez.");
  redirect("/login");
}

export async function requestPasswordRecovery(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  if (!supabaseConfig())
    return {
      error: "Le service de récupération est en cours de configuration.",
    };
  const email = String(form.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    return { error: "Indiquez une adresse e-mail valide." };
  let origin: string;
  try {
    origin = authOrigin(
      (await headers()).get("origin"),
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL],
      process.env.NODE_ENV === "development",
    );
  } catch {
    return { error: "Rechargez la page depuis votre espace habituel." };
  }
  const client = await createClient();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=reset-password`,
  });
  if (emailSendingLimited(error)) {
    reportOperationalEvent("auth_email_rate_limited");
    return { error: emailLimitMessage };
  }
  if (error) reportOperationalEvent("password_recovery_failed");
  return {
    message:
      "Si cette adresse correspond à un compte éligible, un lien de récupération sera envoyé. Ouvrez-le dans ce même navigateur.",
  };
}
export async function changePassword(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  const { supabase } = await requireUser();
  const password = String(form.get("password") ?? "");
  if (
    password.length < 8 ||
    password.length > 128 ||
    password !== String(form.get("confirmation") ?? "")
  )
    return {
      error:
        "Les deux mots de passe doivent être identiques et comporter 8 à 128 caractères.",
    };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    reportOperationalEvent("password_reset_failed");
    return {
      error:
        "Le mot de passe n’a pas pu être modifié. Choisissez un nouveau mot de passe ou demandez un nouveau lien.",
    };
  }
  const { error: logoutError } = await supabase.auth.signOut({
    scope: "global",
  });
  if (logoutError) {
    reportOperationalEvent("password_reset_failed");
    return { passwordChanged: true };
  }
  redirect("/login?password=updated");
}
