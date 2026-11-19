"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const RevealIcon = showPassword ? EyeOff : Eye;
  return (
    <form
      action={action}
      className="auth-form"
      aria-busy={pending}
      onSubmit={() => setShowPassword(false)}
    >
      <input type="hidden" name="destination" value={destination} />
      {mode === "signup" && destination === "account" && (
        <>
          <label htmlFor="display-name">Nom complet</label>
          <input
            id="display-name"
            name="displayName"
            autoComplete="name"
            placeholder="Prénom et nom"
            minLength={2}
            maxLength={100}
            required
            disabled={!configured}
          />
        </>
      )}
      <label htmlFor="email">
        {destination === "account"
          ? "Adresse e-mail professionnelle"
          : "Adresse e-mail"}
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete={mode === "login" ? "username" : "email"}
        placeholder={"exemple@email.ma"}
        required
        maxLength={254}
        disabled={!configured}
      />
      <label htmlFor="password">Mot de passe</label>
      <div className="auth-password-field">
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={8}
          maxLength={128}
          required
          placeholder="8 caractères minimum"
          disabled={!configured}
        />
        <button
          type="button"
          className="auth-password-toggle"
          aria-label={
            showPassword
              ? "Masquer le mot de passe"
              : "Afficher le mot de passe"
          }
          aria-controls="password"
          disabled={!configured}
          onClick={() => setShowPassword((visible) => !visible)}
        >
          <RevealIcon size={19} aria-hidden="true" />
        </button>
      </div>
      {mode === "login" && (
        <div className="auth-options">
          <label className="remember-option">
            <input
              type="checkbox"
              name="remember"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              disabled={!configured}
            />
            Rester connecté sur cet appareil
          </label>
          <Link className="text-link" href="/forgot-password">
            Mot de passe oublié ?
          </Link>
        </div>
      )}
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
      {mode === "signup" && (
        <p className="fine">
          {destination !== "account"
            ? "Confirmez votre e-mail. Chaque carnet nécessite ensuite une vérification distincte de votre qualité de responsable."
            : mode === "signup"
              ? "Votre compte sera non vérifié. Vos premiers dossiers resteront provisoires et privés."
              : "Médecins et infirmier(e)s · Les accès partagés nécessitent une vérification."}
        </p>
      )}
    </form>
  );
}
