"use client";

import { useActionState, useState, useTransition } from "react";
import { QrCode } from "@/components/qr/code";
import { cancelDoctorCareQr, issueDoctorCareQr } from "@/app/share/actions";

export function DoctorCareQr({ childId }: { childId: string }) {
  const [state, issue, issuing] = useActionState(issueDoctorCareQr, {});
  const [cancelling, startCancelling] = useTransition();
  const [cancelled, setCancelled] = useState("");
  const [cancelError, setCancelError] = useState("");
  const invitation =
    state.invitation?.id === cancelled ? undefined : state.invitation;

  return (
    <section className="panel" aria-labelledby="doctor-care-share-heading">
      <h2 id="doctor-care-share-heading">
        Inviter un médecin à poursuivre les soins
      </h2>
      <p>
        Le médecin vérifié que vous désignez pourra consulter ce dossier et
        ajouter des soins selon ses habilitations jusqu’à une heure après
        l’ouverture du code. Le QR lui-même expire après cinq minutes.
      </p>
      {invitation ? (
        <div className="share-secret">
          <QrCode
            value={invitation.url}
            label="QR personnel d’invitation aux soins"
          />
          <p className="fine">
            QR valable jusqu’à{" "}
            {new Date(invitation.expires_at).toLocaleTimeString("fr-MA", {
              timeZone: "Africa/Casablanca",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            (heure du Maroc).
          </p>
          <label htmlFor="doctor-care-link">Lien personnel</label>
          <input
            id="doctor-care-link"
            readOnly
            value={invitation.url}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            className="button secondary"
            type="button"
            disabled={cancelling}
            onClick={() => {
              setCancelError("");
              startCancelling(async () => {
                try {
                  const form = new FormData();
                  form.set("id", invitation.id);
                  const result = await cancelDoctorCareQr(form);
                  if (result.cancelled) setCancelled(invitation.id);
                  else
                    setCancelError(
                      result.error ?? "Impossible d’annuler l’invitation.",
                    );
                } catch {
                  setCancelError(
                    "Impossible d’annuler l’invitation. Réessayez.",
                  );
                }
              });
            }}
          >
            {cancelling ? "Annulation…" : "Annuler le QR"}
          </button>
          {cancelError && (
            <p role="alert" className="form-error">
              {cancelError}
            </p>
          )}
        </div>
      ) : (
        <form action={issue} className="auth-form" aria-busy={issuing}>
          <input type="hidden" name="childId" value={childId} />
          <label>
            Identifiant professionnel du médecin destinataire
            <input
              name="recipient"
              placeholder="PRO-…"
              maxLength={100}
              required
              autoComplete="off"
            />
          </label>
          <label>
            Motif du partage
            <textarea
              name="reason"
              rows={2}
              minLength={10}
              maxLength={1000}
              required
            />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="confirmed" required />
            J’ai vérifié l’autorisation de transmettre le dossier à ce médecin
            pour le suivi des soins.
          </label>
          {state.error && (
            <p role="alert" className="form-error">
              {state.error}
            </p>
          )}
          <button className="button primary" disabled={issuing}>
            {issuing ? "Création…" : "Afficher le QR de soins"}
          </button>
        </form>
      )}
    </section>
  );
}
