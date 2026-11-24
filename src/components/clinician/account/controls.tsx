"use client";

import { useActionState, useId, useRef, useState } from "react";
import { Check, Copy, Pencil, Save } from "lucide-react";
import { updateClinicianDisplayName } from "@/app/account/clinician-actions";

export function DisplayNameForm({ name }: { name: string | null }) {
  const [state, action, pending] = useActionState(
    updateClinicianDisplayName,
    {},
  );
  const inputId = useId();
  return (
    <details className="clinician-name-edit">
      <summary className="clinician-account-button clinician-account-emphasis">
        <Pencil size={17} aria-hidden="true" /> Modifier mes informations
      </summary>
      <form
        action={action}
        className="clinician-name-form"
        onReset={(event) => event.preventDefault()}
        aria-busy={pending}
      >
        <fieldset disabled={pending}>
          <label htmlFor={inputId}>Nom d’affichage</label>
          <input
            id={inputId}
            name="displayName"
            autoComplete="name"
            defaultValue={name ?? ""}
            minLength={3}
            maxLength={150}
            required
          />
          <p>
            Ce nom apparaît sur votre compte. Les dossiers utilisent le nom
            contrôlé lors de la vérification professionnelle.
          </p>
        </fieldset>
        {state.error && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}
        {state.saved && (
          <p className="clinician-copy-status" role="status">
            Nom d’affichage enregistré.
          </p>
        )}
        <button
          className="clinician-account-button clinician-account-emphasis"
          disabled={pending}
        >
          <Save size={17} aria-hidden="true" />{" "}
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </details>
  );
}

export function ProfessionalIdCopy({ id }: { id: string | null }) {
  const value = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"copied" | "manual" | null>(null);
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  if (!id)
    return (
      <p className="clinician-account-id-unavailable">
        Identifiant non attribué.
      </p>
    );
  async function copy() {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setStatus("copied");
    } catch {
      setExpanded(true);
      setStatus("manual");
    }
  }
  return (
    <div className="clinician-account-id-controls">
      <div className="clinician-account-id-actions">
        <button
          type="button"
          className="clinician-account-button clinician-id-toggle"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="clinician-id-preview" aria-hidden="true">
            {id}
          </span>
          <span className="sr-only">Afficher l’identifiant complet</span>
        </button>
        <button
          type="button"
          className="clinician-account-button clinician-icon-button"
          aria-label="Copier l’identifiant professionnel"
          onClick={() => {
            void copy();
          }}
        >
          {status === "copied" ? (
            <Check size={19} aria-hidden="true" />
          ) : (
            <Copy size={19} aria-hidden="true" />
          )}
        </button>
      </div>
      <div id={contentId} hidden={!expanded}>
        <input
          ref={value}
          aria-label="Identifiant professionnel complet"
          readOnly
          value={id}
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>
      {status && (
        <p className="clinician-copy-status" role="status">
          {status === "copied"
            ? "Identifiant copié."
            : "Sélectionnez l’identifiant complet pour le copier."}
        </p>
      )}
    </div>
  );
}
