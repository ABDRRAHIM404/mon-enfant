"use client";
import { useActionState } from "react";
import { saveParentProfile } from "@/app/parent/actions";
export function ParentProfileForm({ name = "" }: { name?: string }) {
  const [state, action, pending] = useActionState(saveParentProfile, {});
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      <label htmlFor="parent-name">Votre nom</label>
      <input
        id="parent-name"
        name="displayName"
        autoComplete="name"
        defaultValue={name}
        minLength={2}
        maxLength={150}
        required
      />
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="notice" role="status">
          Votre profil parent est enregistré.
        </p>
      ) : null}
      <button className="button primary" disabled={pending}>
        {pending
          ? "Enregistrement…"
          : name
            ? "Enregistrer mon profil"
            : "Activer mon espace parent"}
      </button>
    </form>
  );
}
