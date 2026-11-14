"use client";
import Link from "next/link";
import { QrCode } from "@/components/qr/code";
import { useActionState, useEffect, useRef } from "react";
import {
  createGuardianInvitation,
  claimGuardianInvitation,
  reviewGuardianClaim,
  revokeGuardianAccess,
} from "@/app/parent/actions";

export function GuardianInviteForm({ childId }: { childId: string }) {
  const [state, action, pending] = useActionState(createGuardianInvitation, {});
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      <input type="hidden" name="childId" value={childId} />
      <label htmlFor="guardian-email">Adresse e-mail du responsable</label>
      <input
        id="guardian-email"
        name="recipientEmail"
        type="email"
        maxLength={254}
        required
        autoComplete="off"
      />
      <label htmlFor="invite-reason">Motif de l’invitation</label>
      <textarea
        id="invite-reason"
        name="reason"
        minLength={10}
        maxLength={1000}
        required
      />
      <p className="fine">
        Le lien est personnel et expire après 24 heures. Une nouvelle invitation
        remplace le précédent lien inutilisé pour cette adresse. Elle n’accorde
        aucun accès avant la vérification du responsable.
      </p>
      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
      {state.invitationUrl ? (
        <div className="notice">
          <p role="status">
            Invitation créée. Transmettez ce lien au destinataire par un canal
            approprié.
          </p>
          <QrCode
            value={state.invitationUrl}
            label="Invitation personnelle du responsable — valable 24 heures"
          />
          <label htmlFor="invitation-url">Lien personnel</label>
          <input
            id="invitation-url"
            value={state.invitationUrl}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(state.invitationUrl!)
                .catch(() => {});
            }}
          >
            Copier le lien
          </button>
        </div>
      ) : null}
      <button
        className="button primary"
        disabled={pending || !!state.invitationUrl}
      >
        {pending ? "Création…" : "Créer ou remplacer l’invitation"}
      </button>
    </form>
  );
}

const pendingInvitation = "mon-enfant-parent-invitation";
export function GuardianClaimForm({ operationId }: { operationId: string }) {
  const [state, action, pending] = useActionState(claimGuardianInvitation, {});
  const tokenInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const candidate = new URLSearchParams(window.location.hash.slice(1)).get(
      "invite",
    );
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(pendingInvitation) ?? "null",
      ) as { token?: string; at?: number } | null;
      const value =
        candidate ??
        (saved?.at && Date.now() - saved.at < 24 * 60 * 60 * 1000
          ? saved.token
          : "");
      if (value && /^[A-Za-z0-9_-]{43}$/.test(value)) {
        if (tokenInput.current) tokenInput.current.value = value;
        sessionStorage.setItem(
          pendingInvitation,
          JSON.stringify({ token: value, at: Date.now() }),
        );
      }
    } catch {
      if (candidate && /^[A-Za-z0-9_-]{43}$/.test(candidate))
        if (tokenInput.current) tokenInput.current.value = candidate;
    }
    if (candidate)
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
  }, []);
  useEffect(() => {
    if (state.success) {
      try {
        sessionStorage.removeItem(pendingInvitation);
      } catch {
        /* A blocked browser store does not grant access. */
      }
    }
  }, [state.success]);
  if (state.success)
    return (
      <div className="notice">
        <p role="status">
          Votre demande a été enregistrée. Le professionnel doit encore vérifier
          votre identité et votre qualité de responsable avant d’ouvrir le
          carnet.
        </p>
        <Link className="button primary" href="/parent">
          Voir mon espace parent
        </Link>
      </div>
    );
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      <input type="hidden" name="operationId" value={operationId} />
      <label htmlFor="invitation-code">Code personnel d’invitation</label>
      <input
        id="invitation-code"
        name="token"
        type="password"
        ref={tokenInput}
        maxLength={43}
        required
        autoComplete="off"
        spellCheck={false}
      />
      <label htmlFor="declared-relationship">Lien déclaré avec l’enfant</label>
      <select
        id="declared-relationship"
        name="relationship"
        defaultValue=""
        required
      >
        <option value="" disabled>
          Choisir
        </option>
        <option value="mother">Mère</option>
        <option value="father">Père</option>
        <option value="legal_guardian">Représentant légal</option>
        <option value="other">Autre responsable</option>
      </select>
      <label className="checkbox-label">
        <input name="consent" type="checkbox" required /> Je demande l’accès au
        carnet en qualité de responsable et accepte la vérification de mon
        identité et de mon lien avec l’enfant.
      </label>
      <p className="fine">
        Connectez-vous avec l’adresse e-mail destinataire. Votre déclaration
        seule ne prouve pas la qualité de responsable et ne donne pas accès au
        dossier.
      </p>
      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
      <button className="button primary" disabled={pending}>
        {pending ? "Enregistrement…" : "Soumettre ma demande"}
      </button>
      <Link href="/login?audience=parent&next=invitation" className="text-link">
        Me connecter
      </Link>
      <Link
        href="/signup?audience=parent&next=invitation"
        className="text-link"
      >
        Créer mon compte parent
      </Link>
      <Link href="/parent" className="text-link">
        Activer ou consulter mon profil parent
      </Link>
    </form>
  );
}

export function GuardianReviewForm({
  claimId,
  revision,
  childId,
  operationId,
  expiresOn,
}: {
  claimId: string;
  revision: number;
  childId: string;
  operationId: string;
  expiresOn: string;
}) {
  const [state, action, pending] = useActionState(reviewGuardianClaim, {});
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="revision" value={revision} />
      <input type="hidden" name="operationId" value={operationId} />
      <label>
        Décision
        <select name="decision" defaultValue="" required>
          <option value="" disabled>
            Choisir
          </option>
          <option value="approved">Autoriser l’accès au carnet</option>
          <option value="rejected">Refuser la demande</option>
        </select>
      </label>
      <label>
        Qualité vérifiée
        <select name="relationship" defaultValue="" required>
          <option value="" disabled>
            Choisir
          </option>
          <option value="mother">Mère</option>
          <option value="father">Père</option>
          <option value="legal_guardian">Représentant légal</option>
          <option value="other">Autre responsable autorisé</option>
        </select>
      </label>
      <label className="checkbox-label">
        <input type="checkbox" name="identityChecked" /> J’ai vérifié l’identité
        du demandeur auprès d’une source appropriée.
      </label>
      <label className="checkbox-label">
        <input type="checkbox" name="guardianshipChecked" /> J’ai vérifié sa
        qualité de responsable et l’autorité légitime pour cet accès.
      </label>
      <label>
        Référence des vérifications
        <textarea
          name="authorityReference"
          minLength={10}
          maxLength={1000}
          required
        />
      </label>
      <label>
        Motif de la décision
        <textarea name="reason" minLength={10} maxLength={1000} required />
      </label>
      <p className="fine">
        Ne recopiez pas les pièces d’identité. L’approbation exige les deux
        contrôles et doit être effectuée par un professionnel distinct du
        demandeur.
      </p>
      <label>
        Accès autorisé jusqu’au (si approbation)
        <input type="date" name="expiresOn" defaultValue={expiresOn} />
      </label>
      <label className="checkbox-label">
        <input type="checkbox" name="canExport" /> Autoriser le téléchargement
        du carnet
      </label>
      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="notice">
          Décision enregistrée.
        </p>
      ) : null}
      <button className="button primary" disabled={pending || state.success}>
        {pending ? "Enregistrement…" : "Enregistrer la vérification"}
      </button>
    </form>
  );
}

export function GuardianRevokeForm({
  id,
  childId,
  kind,
  returnToParent = false,
}: {
  id: string;
  childId: string;
  kind: "invitation" | "link";
  returnToParent?: boolean;
}) {
  const [state, action, pending] = useActionState(revokeGuardianAccess, {});
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="kind" value={kind} />
      {returnToParent && <input type="hidden" name="returnTo" value="parent" />}
      <label>
        Motif du retrait
        <textarea name="reason" minLength={10} maxLength={1000} required />
      </label>
      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="notice">
          Retrait enregistré.
        </p>
      ) : null}
      <button className="button secondary" disabled={pending || state.success}>
        {pending
          ? "Enregistrement…"
          : kind === "invitation"
            ? "Annuler l’invitation"
            : "Retirer cet accès"}
      </button>
    </form>
  );
}
