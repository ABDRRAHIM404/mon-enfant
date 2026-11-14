"use client";
import { useActionState } from "react";
import {
  requestParentCorrection,
  respondParentCorrection,
  saveParentSettings,
} from "@/app/parent/actions";
import type { ParentSettings, CorrectionRequest } from "@/lib/parents/types";
import { correctionCategories } from "@/lib/parents/types";
export function ParentSettingsForm({ settings }: { settings: ParentSettings }) {
  const [state, action, pending] = useActionState(saveParentSettings, {});
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      <label>
        Téléphone de contact (facultatif)
        <input
          type="tel"
          name="contactPhone"
          maxLength={32}
          defaultValue={settings.contact_phone ?? ""}
          autoComplete="tel"
        />
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          name="emailUpdates"
          defaultChecked={settings.email_updates}
        />{" "}
        Je souhaite recevoir des messages de suivi par e-mail, lorsque ce
        service sera disponible.
      </label>
      <label>
        Préférence de rappel avant un rendez-vous
        <select name="reminderDays" defaultValue={settings.reminder_days}>
          <option value={1}>1 jour</option>
          <option value={3}>3 jours</option>
          <option value={7}>7 jours</option>
        </select>
      </label>
      <p className="fine">
        Ces préférences sont enregistrées. Les envois de suivi et rappels par
        e-mail ne sont pas encore activés. Le téléphone n’est pas un service de
        SMS.
      </p>
      <p className="fine">
        Les messages de connexion, de confirmation et de récupération du compte
        restent gérés par Supabase Auth. Vos préférences n’accordent aucun accès
        au carnet et ne modifient aucun soin.
      </p>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="notice">
          Préférences enregistrées.
        </p>
      )}
      <button className="button primary" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer mes préférences"}
      </button>
    </form>
  );
}
export function CorrectionRequestForm({
  childId,
  operationId,
  entryId,
}: {
  childId: string;
  operationId: string;
  entryId?: string;
}) {
  const [state, action, pending] = useActionState(requestParentCorrection, {});
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      <input type="hidden" name="operationId" value={operationId} />
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="entryId" value={entryId ?? ""} />
      {entryId ? (
        <>
          <input type="hidden" name="category" value="clinical" />
          <p className="fine">
            Cette demande concerne l’entrée {entryId}. La version d’origine
            restera conservée.
          </p>
        </>
      ) : (
        <label>
          Objet de la demande
          <select name="category" defaultValue="identity">
            {Object.entries(correctionCategories)
              .filter(([key]) => key !== "clinical")
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </label>
      )}
      <label>
        Votre question ou correction demandée
        <textarea name="message" minLength={20} maxLength={2000} required />
      </label>
      <p className="fine">
        Décrivez le point à vérifier sans joindre de pièce d’identité. Une
        demande ne modifie pas le dossier. Pour un soin précis, utilisez son
        lien « Demander une correction » dans le carnet.
      </p>
      <p className="notice">
        Ce formulaire n’est pas un service d’urgence. Pour une question médicale
        urgente, contactez directement un service de soins approprié.
      </p>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="notice">
          Demande enregistrée. Elle sera visible au professionnel autorisé.
        </p>
      )}
      <button className="button primary" disabled={pending || state.success}>
        {pending ? "Enregistrement…" : "Envoyer ma demande"}
      </button>
    </form>
  );
}
export function CorrectionResponseForm({
  requestId,
  childId,
  operationId,
  parent = false,
  corrections = [],
}: {
  requestId: string;
  childId: string;
  operationId: string;
  parent?: boolean;
  corrections?: CorrectionRequest["correction_options"];
}) {
  const [state, action, pending] = useActionState(respondParentCorrection, {});
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      <input type="hidden" name="operationId" value={operationId} />
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="childId" value={childId} />
      {parent ? (
        <input type="hidden" name="outcome" value="withdrawn" />
      ) : (
        <label>
          Traitement de la demande
          <select name="outcome" defaultValue="answered">
            <option value="answered">
              Répondre sans modification clinique
            </option>
            <option value="rejected">
              Refuser la correction avec explication
            </option>
            <option value="corrected">
              Référencer un amendement clinique déjà enregistré
            </option>
          </select>
        </label>
      )}
      {!parent && (
        <>
          <label>
            Amendement déjà enregistré (si corrigée)
            <select name="correctionEntryId" defaultValue="">
              <option value="">Aucun amendement sélectionné</option>
              {corrections.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  Version {entry.revision} ·{" "}
                  {new Date(entry.recorded_at).toLocaleString("fr-MA")} ·{" "}
                  {entry.entry_state === "withdrawn"
                    ? "entrée retirée"
                    : "entrée corrigée"}
                </option>
              ))}
            </select>
          </label>
          <p className="fine">
            Enregistrez d’abord l’amendement dans le dossier clinique avec vos
            habilitations habituelles. Référencez ensuite sa nouvelle révision.
            Cette réponse ne crée ni ne modifie un soin.
          </p>
        </>
      )}
      <label>
        {parent ? "Motif du retrait" : "Réponse au responsable"}
        <textarea name="message" minLength={10} maxLength={2000} required />
      </label>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="notice">
          {parent ? "Demande retirée." : "Réponse enregistrée."}
        </p>
      )}
      <button className="button secondary" disabled={pending || state.success}>
        {pending
          ? "Enregistrement…"
          : parent
            ? "Retirer cette demande"
            : "Enregistrer la réponse"}
      </button>
    </form>
  );
}
