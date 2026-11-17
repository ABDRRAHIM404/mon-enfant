"use client";
import { useActionState, useState, type ReactNode } from "react";
import { saveParentProfile } from "@/app/parent/actions";
export function ParentProfileForm({ name = "" }: { name?: string }) {
  const [state, action, pending] = useActionState(saveParentProfile, {});
  return (
    <form
      action={action}
      className="auth-form"
      aria-busy={pending}
      onReset={(event) => event.preventDefault()}
    >
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

// Keep the user's disclosure choice across server-action revalidation so a
// successful first save does not hide its own confirmation.
export function ParentProfileDisclosure({
  initiallyOpen,
  children,
}: {
  initiallyOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <details
      className="workspace-surface workspace-secondary"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Mon profil et relier un carnet</summary>
      {children}
    </details>
  );
}
