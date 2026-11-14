"use client";
import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { signIn, signUp } from "@/app/auth/actions";
export function AuthForm({
  mode,
  configured,
  destination = "parent",
}: {
  mode: "login" | "signup";
  configured: boolean;
  destination?: "account" | "parent" | "parent-invitation";
}) {
  const [state, action, pending] = useActionState(
    mode === "login" ? signIn : signUp,
    {},
  );
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      <input type="hidden" name="destination" value={destination} />
      <label htmlFor="email">
        {destination === "account"
          ? "Adresse e-mail professionnelle"
          : "Adresse e-mail"}
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder={
          destination === "account" ? "soignant@exemple.ma" : "vous@exemple.ma"
        }
        required
        maxLength={254}
        disabled={!configured}
      />
      <label htmlFor="password">Mot de passe</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        minLength={12}
        maxLength={128}
        required
        placeholder="12 caractères minimum"
        disabled={!configured}
      />
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="notice" role="status">
          {state.message}
        </p>
      )}
      <button
        className="button primary"
        type="submit"
        disabled={pending || !configured || !!state.message}
      >
        {pending ? (
          <>
            <LoaderCircle className="spin" size={18} aria-hidden="true" />
            {mode === "login" ? "Connexion en cours…" : "Création en cours…"}
          </>
        ) : (
          <>
            {mode === "login" ? "Se connecter" : "Créer mon compte"}
            <ArrowRight size={18} />
          </>
        )}
      </button>
      {mode === "login" && (
        <Link className="text-link" href="/forgot-password">
          Mot de passe oublié ?
        </Link>
      )}
      <p className="fine">
        {destination !== "account"
          ? "Confirmez votre e-mail. Chaque carnet nécessite ensuite une vérification distincte de votre qualité de responsable."
          : mode === "signup"
            ? "Votre compte sera non vérifié. Vos premiers dossiers resteront provisoires et privés."
            : "Médecins et infirmier(e)s · Les accès partagés nécessitent une vérification."}
      </p>
    </form>
  );
}
