"use client";
import { useActionState, useState } from "react";
import { submitApplication } from "@/app/verification/actions";
import {
  EVIDENCE_SIZE_ERROR,
  validateEvidenceSize,
} from "@/lib/verification/validation";
export function SubmissionForm() {
  const [state, action, pending] = useActionState(submitApplication, {});
  const [clientError, setClientError] = useState<string | null>(null);
  if (state.success)
    return (
      <div className="notice" role="status">
        Votre demande est enregistrée. Un administrateur doit vérifier votre
        identité et vos qualifications avant tout accès clinique.
      </div>
    );
  return (
    <form
      action={action}
      className="auth-form"
      onReset={(event) => event.preventDefault()}
      onSubmit={(event) => {
        const input = event.currentTarget.elements.namedItem(
          "evidence",
        ) as HTMLInputElement | null;
        const file = input?.files?.[0];
        const error = file
          ? validateEvidenceSize(file.size)
          : EVIDENCE_SIZE_ERROR;
        setClientError(error);
        if (error) event.preventDefault();
      }}
    >
      <fieldset disabled={pending}>
        <legend className="sr-only">
          Justificatifs professionnels fictifs
        </legend>
        <label htmlFor="displayName">Nom professionnel complet</label>
        <input
          id="displayName"
          name="displayName"
          minLength={3}
          maxLength={150}
          autoComplete="name"
          required
        />
        <label htmlFor="registration">
          Matricule / numéro d’inscription professionnelle
        </label>
        <input
          id="registration"
          name="registration"
          minLength={4}
          maxLength={64}
          required
          aria-describedby="registration-help"
        />
        <p id="registration-help" className="fine">
          Votre matricule sera contrôlé par un administrateur habilité. Il ne
          constitue pas une validation à lui seul.
        </p>
        <label htmlFor="facility">Établissement d’exercice</label>
        <input
          id="facility"
          name="facility"
          minLength={3}
          maxLength={200}
          required
        />
        <label htmlFor="evidence">Justificatif d’identité fictif</label>
        <input
          id="evidence"
          name="evidence"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          required
          aria-describedby="evidence-help"
          onChange={() => setClientError(null)}
        />
        <p id="evidence-help" className="fine">
          PDF, JPEG ou PNG · 4 Mio maximum (4 194 304 octets) · Stockage privé.
          N’envoyez pas de véritable pièce d’identité dans cet environnement de
          développement.
        </p>
        <label className="checkbox-label">
          <input type="checkbox" name="syntheticOnly" required /> Je confirme
          que les informations et le justificatif sont fictifs.
        </label>
      </fieldset>
      {(clientError || state.error) && (
        <p className="form-error" role="alert">
          {clientError || state.error}
        </p>
      )}
      <button className="button primary" disabled={pending}>
        {pending ? "Envoi en cours…" : "Soumettre pour vérification"}
      </button>
    </form>
  );
}
