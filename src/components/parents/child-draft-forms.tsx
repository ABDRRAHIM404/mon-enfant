"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  addParentChildDraft,
  issueParentChildDraft,
} from "@/app/parent/actions";
import { QrCode } from "@/components/qr/code";

export function AddChildDraftForm({
  operationId,
  today,
}: {
  operationId: string;
  today: string;
}) {
  const [state, save, pending] = useActionState(addParentChildDraft, {});
  return (
    <form
      action={save}
      className="auth-form"
      onReset={(event) => event.preventDefault()}
    >
      <input type="hidden" name="operationId" value={operationId} />
      <label>
        Prénom
        <input name="givenName" maxLength={100} required />
      </label>
      <label>
        Nom
        <input name="familyName" maxLength={100} required />
      </label>
      <label>
        Date de naissance
        <input
          name="birthDate"
          type="date"
          min="1900-01-01"
          max={today}
          required
        />
      </label>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      <button className="button primary" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer la fiche"}
      </button>
    </form>
  );
}

export function ChildDraftQr({ draftId }: { draftId: string }) {
  const [code, setCode] = useState<{ url: string; expiresAt: string }>();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!code) return;
    const timer = setTimeout(
      () => setCode(undefined),
      Math.max(0, Date.parse(code.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [code]);
  return (
    <div className="actions">
      {code ? (
        <div className="share-secret">
          <QrCode
            value={code.url}
            label="QR de la fiche à montrer au médecin"
          />
          <p className="fine">
            Ce QR est utilisable une fois, pendant cinq minutes.
          </p>
          <label>
            Lien temporaire
            <input
              readOnly
              value={code.url}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
        </div>
      ) : (
        <button
          className="button secondary"
          type="button"
          disabled={pending}
          onClick={() => {
            setError("");
            startTransition(async () => {
              try {
                const result = await issueParentChildDraft(draftId);
                if (result.url && result.expiresAt)
                  setCode({ url: result.url, expiresAt: result.expiresAt });
                else setError(result.error ?? "Impossible d’afficher le QR.");
              } catch {
                setError("Impossible d’afficher le QR. Réessayez.");
              }
            });
          }}
        >
          {pending ? "Préparation…" : "Afficher le QR pour le médecin"}
        </button>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
