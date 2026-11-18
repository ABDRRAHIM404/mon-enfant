"use client";
import { useActionState } from "react";
import {
  reviewApplication,
  setSuspension,
  retryApprovalNotice,
} from "@/app/admin/actions";
export function ApprovalNoticeRetryForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(retryApprovalNotice, {});
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      <input type="hidden" name="requestId" value={requestId} />
      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="notice">
          Nouvelle tentative demandée. Actualisez le dossier pour consulter
          l’état de l’email.
        </p>
      ) : null}
      <button className="button secondary" disabled={pending || state.success}>
        {pending ? "Demande en cours…" : "Réessayer l’envoi de l’email"}
      </button>
    </form>
  );
}
export function ReviewForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(reviewApplication, {});
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      <input name="requestId" value={requestId} type="hidden" />
      <label htmlFor="decision">Décision</label>
      <select id="decision" name="decision" required defaultValue="">
        <option value="" disabled>
          Sélectionner une décision
        </option>
        <option value="approved">Approuver</option>
        <option value="needs_more_evidence">Demander un complément</option>
        <option value="rejected">Rejeter</option>
      </select>
      <label className="checkbox-label">
        <input name="identityChecked" type="checkbox" /> J’ai contrôlé
        l’identité et le justificatif.
      </label>
      <label className="checkbox-label">
        <input name="registrationChecked" type="checkbox" /> J’ai vérifié le
        matricule et les qualifications auprès d’une source appropriée.
      </label>
      <p className="fine">
        Ces deux contrôles sont obligatoires pour approuver. Un numéro de
        matricule seul ne prouve pas l’autorisation d’exercice.
      </p>
      <label htmlFor="reason">Motif et source des contrôles</label>
      <textarea
        id="reason"
        name="reason"
        minLength={10}
        maxLength={1000}
        rows={4}
        required
        aria-describedby="reason-help"
      />
      <p id="reason-help" className="fine">
        Le motif est conservé dans l’historique et visible par le professionnel.
        N’incluez pas de copie de pièce d’identité dans le texte.
      </p>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="notice">
          Décision enregistrée et historisée.
        </p>
      )}
      <button className="button primary" disabled={pending || state.success}>
        {pending ? "Enregistrement…" : "Enregistrer la décision"}
      </button>
    </form>
  );
}
export function SuspensionForm({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}) {
  const [state, action, pending] = useActionState(setSuspension, {});
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      <input type="hidden" name="userId" value={userId} />
      <input
        type="hidden"
        name="action"
        value={suspended ? "reactivate" : "suspend"}
      />
      <label htmlFor={`reason-${userId}`}>
        Motif de {suspended ? "réactivation" : "suspension"}
      </label>
      <textarea
        id={`reason-${userId}`}
        name="reason"
        minLength={10}
        maxLength={1000}
        rows={2}
        required
      />
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="notice" role="status">
          Statut mis à jour.
        </p>
      )}
      <button className="button secondary" disabled={pending}>
        {pending
          ? "Enregistrement…"
          : suspended
            ? "Réactiver ce compte"
            : "Suspendre ce compte"}
      </button>
    </form>
  );
}
