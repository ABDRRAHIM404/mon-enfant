"use client";
import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { signIn, signUp } from "@/app/auth/actions";
export function AuthForm({
  mode,
  configured,
}: {
  mode: "login" | "signup";
  configured: boolean;
}) {
  const [state, action, pending] = useActionState(
    mode === "login" ? signIn : signUp,
    {},
  );
  return (
    <form action={action} className="auth-form">
      <label htmlFor="email">Adresse e-mail professionnelle</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="docteur@exemple.ma"
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
          <LoaderCircle className="spin" size={18} />
        ) : (
          <>
            {mode === "login" ? "Se connecter" : "Créer mon compte"}
            <ArrowRight size={18} />
          </>
        )}
      </button>
      {mode === "login" && <Link className="text-link" href="/forgot-password">Mot de passe oublié ?</Link>}
      <p className="fine">
        {mode === "signup"
          ? "Votre compte sera non vérifié. L’accès clinique nécessite une validation professionnelle."
          : "Espace réservé aux professionnels de santé."}
      </p>
    </form>
  );
}
