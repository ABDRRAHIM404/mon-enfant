"use client";
import { useActionState, type ReactNode } from "react";
import {
  registryAction,
  reviewRegistration,
  resumeRegistration,
} from "@/app/patients/actions";
import type { Facility, ParentChildIntake } from "@/lib/registry/types";
function ActionForm({
  kind,
  operationId,
  children,
  label,
}: {
  kind: string;
  operationId?: string;
  children: ReactNode;
  label: string;
}) {
  const [state, action, pending] = useActionState(registryAction, {});
  return (
    <form
      action={action}
      className="auth-form"
      onReset={
        kind === "register" ? (event) => event.preventDefault() : undefined
      }
      aria-busy={pending}
    >
      <input type="hidden" name="kind" value={kind} />
      {operationId && (
        <input type="hidden" name="operationId" value={operationId} />
      )}
      <fieldset disabled={pending || state.success}>
        {children}
        {kind === "register" && (
          <details open={state.duplicate || undefined}>
            <summary>
              Informations de naissance pour le contrôle de doublons
            </summary>
            <label>
              Nom complet de la mère
              <input
                name="mother_name"
                maxLength={200}
                minLength={2}
                autoComplete="off"
              />
            </label>
            <label>
              Lieu de naissance (maternité ou hôpital)
              <input
                name="birthplace"
                maxLength={200}
                minLength={2}
                autoComplete="off"
              />
            </label>
            <p className="fine">
              Facultatif sans alerte. Si une correspondance est possible,
              fournissez ces deux informations pour l’examiner, ou demandez une
              revue si elles ne sont pas disponibles. Aucun numéro de CIN des
              parents n’est demandé.
            </p>
          </details>
        )}
      </fieldset>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      {state.duplicate && (
        <div className="notice stacked-notice">
          <p role="alert">
            A child with similar details may already be registered. Please
            provide additional information to verify the match.
          </p>
          {state.registrationState === "need_qr" && (
            <p>
              Demandez au parent de présenter le QR sécurisé de son carnet pour
              suivre le parcours d’accès autorisé. Ce contrôle n’ouvre aucun
              dossier et ne donne aucune permission.
            </p>
          )}
          {state.registrationState === "needs_review" && (
            <p>
              Une revue contrôlée est nécessaire. Aucun dossier existant n’est
              affiché et aucun rapprochement automatique n’a été fait. Un
              gestionnaire déjà autorisé doit examiner la situation.
            </p>
          )}
        </div>
      )}
      {state.success && (
        <p role="status" className="notice">
          Opération enregistrée.
        </p>
      )}
      <button className="button primary" disabled={pending || state.success}>
        {pending
          ? "Enregistrement…"
          : state.duplicate
            ? "Compléter et relancer le contrôle"
            : label}
      </button>
      {state.duplicate && (
        <button
          className="button secondary"
          name="requestReview"
          value="on"
          disabled={pending}
        >
          Demander une revue contrôlée
        </button>
      )}
    </form>
  );
}
function Field({
  name,
  label,
  type = "text",
  maxLength = 100,
  required = false,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  maxLength?: number;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        maxLength={maxLength}
        required={required}
        defaultValue={defaultValue}
      />
    </label>
  );
}
function RegisterFields({ facilities }: { facilities: Facility[] }) {
  return (
    <>
      <label>
        Lieu d’exercice
        <select name="facility_id" required defaultValue="">
          <option value="" disabled>
            Choisir un lieu déclaré
          </option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} — {f.city}
            </option>
          ))}
        </select>
      </label>
      <label>
        Année du registre
        <input
          name="register_year"
          type="number"
          min={1900}
          max={2200}
          defaultValue={new Date().getFullYear()}
          required
        />
      </label>
      <Field name="register_book" label="Livre / série du registre" required />
      <Field
        name="local_number"
        label="Numéro local (zéros conservés)"
        required
      />
    </>
  );
}
export function FacilityForm({ operationId }: { operationId: string }) {
  return (
    <ActionForm
      kind="facility"
      operationId={operationId}
      label="Déclarer ce lieu"
    >
      <Field
        name="name"
        label="Nom du lieu d’exercice"
        maxLength={200}
        required
      />
      <Field name="city" label="Ville" />
      <p className="fine">
        Cette déclaration est rattachée à votre compte. Elle ne constitue pas
        une vérification de l’établissement.
      </p>
    </ActionForm>
  );
}
export function RegistrationForm({
  operationId,
  facilities,
  paper,
  intake,
}: {
  operationId: string;
  facilities: Facility[];
  paper: boolean;
  intake?: ParentChildIntake;
}) {
  return (
    <ActionForm
      kind="register"
      operationId={operationId}
      label="Créer le dossier et le numéro local"
    >
      {intake && <input type="hidden" name="parentDraft" value="on" />}
      <input
        type="hidden"
        name="source_type"
        value={paper ? "paper_transcription" : "new_registration"}
      />
      <RegisterFields facilities={facilities} />
      <Field
        name="smi_reference"
        label="Référence SMI locale (facultative, non unique)"
      />
      <label>
        Certitude de l’identité
        <select
          name="name_status"
          defaultValue={paper && !intake ? "unknown" : "confirmed"}
        >
          <option value="confirmed">Noms confirmés</option>
          <option value="provisional">Noms provisoires</option>
          <option value="unknown">
            Noms inconnus — laisser les deux champs vides
          </option>
        </select>
      </label>
      <Field
        name="given_name"
        label="Prénom (si connu)"
        defaultValue={intake?.given_name}
        required={!!intake}
      />
      <Field
        name="family_name"
        label="Nom (si connu)"
        defaultValue={intake?.family_name}
        required={!!intake}
      />
      <label>
        Certitude de la naissance
        <select
          name="birth_date_precision"
          defaultValue={paper && !intake ? "unknown" : "exact"}
        >
          <option value="exact">Date exacte</option>
          <option value="estimated">Date estimée</option>
          <option value="unknown">Date inconnue — laisser le champ vide</option>
        </select>
      </label>
      <Field
        name="birth_date"
        label="Date de naissance (si connue)"
        type="date"
        defaultValue={intake?.birth_date}
        required={!!intake}
      />
      <label>
        Sexe
        <select name="sex" defaultValue="unknown">
          <option value="unknown">Inconnu</option>
          <option value="female">Féminin</option>
          <option value="male">Masculin</option>
        </select>
      </label>
      <label>
        État de l’historique disponible
        <select name="history_status" defaultValue="unknown">
          <option value="unknown">Inconnu</option>
          <option value="partial">Partiel</option>
          <option value="reviewed">Déclaré revu par le professionnel</option>
        </select>
      </label>
      <p className="fine">
        Un historique revu ne signifie pas que les vaccinations ou soins sont
        complets.
      </p>
      {paper && (
        <Field
          name="paper_reference"
          label="Référence du document / registre papier"
          maxLength={200}
          required
        />
      )}
      <label>
        Provenance et limites connues
        <textarea name="provenance_note" rows={3} maxLength={2000} />
      </label>
      <Field
        name="guardian_name"
        label="Contact de soins déclaré (facultatif)"
        maxLength={150}
      />
      <Field
        name="guardian_phone"
        label="Téléphone de contact (facultatif)"
        type="tel"
        maxLength={25}
      />
      <p className="fine">
        Ces coordonnées ne vérifient pas la tutelle et n’ouvrent aucun accès
        parent.
      </p>
      <label>
        Motif de création d’un dossier distinct en cas d’homonymie
        <textarea
          name="duplicate_override_reason"
          maxLength={1000}
          minLength={10}
          rows={2}
        />
      </label>
      <label className="checkbox-label">
        <input name="syntheticOnly" type="checkbox" required /> Données
        entièrement fictives pour cet environnement de test.
      </label>
      {intake && (
        <label className="checkbox-label">
          <input name="draftIdentityChecked" type="checkbox" required />
          J’ai vérifié l’identité et la date de naissance de cet enfant.
        </label>
      )}
    </ActionForm>
  );
}
export function LinkForm({
  operationId,
  facilities,
  request,
  initialUniversalId,
}: {
  operationId: string;
  facilities: Facility[];
  request: boolean;
  initialUniversalId?: string;
}) {
  return (
    <ActionForm
      kind={request ? "request" : "link"}
      operationId={operationId}
      label={request ? "Envoyer la demande d’accès" : "Ajouter à mon registre"}
    >
      <Field
        name="universal_id"
        label="Identifiant universel de l’enfant"
        maxLength={36}
        required
        defaultValue={initialUniversalId}
      />
      <RegisterFields facilities={facilities} />
      {request && (
        <label>
          Motif de soins et base de l’autorisation
          <textarea
            name="reason"
            minLength={10}
            maxLength={1000}
            required
            rows={3}
          />
        </label>
      )}
      <p className="fine">
        L’identifiant seul ne donne aucun accès.{" "}
        {request
          ? "La demande reste sans données de l’enfant jusqu’à la décision d’un gestionnaire autorisé."
          : "Ce parcours nécessite un accès déjà accordé."}
      </p>
    </ActionForm>
  );
}
export function DecisionForm({ requestId }: { requestId: string }) {
  return (
    <ActionForm kind="decide" label="Enregistrer la décision">
      <input type="hidden" name="requestId" value={requestId} />
      <label>
        Décision
        <select name="decision" defaultValue="" required>
          <option value="" disabled>
            Choisir
          </option>
          <option value="approve">Approuver</option>
          <option value="reject">Refuser</option>
        </select>
      </label>
      <label className="checkbox-label">
        <input type="checkbox" name="authorizationChecked" /> J’ai vérifié la
        base légitime de l’accès demandé (obligatoire pour approuver).
      </label>
      <label className="checkbox-label">
        <input type="checkbox" name="delegate" /> Déléguer aussi la gestion des
        accès de cet enfant.
      </label>
      <label>
        Motif conservé et visible par le demandeur
        <textarea
          name="reason"
          minLength={10}
          maxLength={1000}
          required
          rows={3}
        />
      </label>
    </ActionForm>
  );
}
export function EndAccessForm({
  requestId,
  childId,
  professionalId,
}: {
  requestId?: string;
  childId?: string;
  professionalId?: string;
}) {
  return (
    <ActionForm
      kind={requestId ? "withdraw" : "revoke"}
      label={requestId ? "Retirer cette demande" : "Révoquer cet accès"}
    >
      {requestId ? (
        <input type="hidden" name="requestId" value={requestId} />
      ) : (
        <>
          <input type="hidden" name="childId" value={childId} />
          <input type="hidden" name="professionalId" value={professionalId} />
        </>
      )}
      <label>
        Motif historisé
        <textarea
          name="reason"
          minLength={10}
          maxLength={1000}
          required
          rows={2}
        />
      </label>
    </ActionForm>
  );
}

export function RegistrationReviewForm({
  actorId,
  operationId,
  revision,
}: {
  actorId: string;
  operationId: string;
  revision: number;
}) {
  const [state, action, pending] = useActionState(reviewRegistration, {});
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      <input type="hidden" name="actorId" value={actorId} />
      <input type="hidden" name="operationId" value={operationId} />
      <input type="hidden" name="revision" value={revision} />
      <label>
        Conclusion de la revue
        <select name="decision" defaultValue="unresolved">
          <option value="unresolved">
            Situation non résolue — maintenir la revue
          </option>
          <option value="existing_qr">
            Utiliser le parcours parent / QR autorisé
          </option>
          <option value="distinct">
            Identités distinctes vérifiées — autoriser une nouvelle inscription
          </option>
        </select>
      </label>
      <label className="checkbox-label">
        <input type="checkbox" name="identityChecked" required /> J’ai vérifié
        l’identité et la base légitime de cette conclusion dans les dossiers que
        je suis autorisé à gérer.
      </label>
      <label>
        Référence de la vérification
        <textarea
          name="authorityReference"
          minLength={10}
          maxLength={1000}
          required
        />
      </label>
      <label>
        Motif conservé
        <textarea name="reason" minLength={10} maxLength={1000} required />
      </label>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      {state.success && <p role="status">Revue enregistrée.</p>}
      <button className="button primary" disabled={pending || state.success}>
        {pending ? "Enregistrement…" : "Enregistrer la revue"}
      </button>
    </form>
  );
}

export function ResumeRegistrationForm({
  operationId,
  mother,
  birthplace,
  locked,
}: {
  operationId: string;
  mother: string | null;
  birthplace: string | null;
  locked: boolean;
}) {
  const [state, action, pending] = useActionState(resumeRegistration, {});
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      <input type="hidden" name="operationId" value={operationId} />
      <label>
        Nom complet de la mère
        <input
          name="mother_name"
          defaultValue={mother ?? ""}
          readOnly={locked}
          minLength={2}
          maxLength={200}
        />
      </label>
      <label>
        Lieu de naissance
        <input
          name="birthplace"
          defaultValue={birthplace ?? ""}
          readOnly={locked}
          minLength={2}
          maxLength={200}
        />
      </label>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state.duplicate && (
        <p role="alert" className="notice">
          A child with similar details may already be registered. Please provide
          additional information to verify the match.
        </p>
      )}
      <p className="fine">
        Aucun résultat ne donne accès à un dossier existant. Si la situation
        reste incertaine, le gestionnaire autorisé doit examiner la demande. Un
        changement d’identité ou de contexte nécessite une nouvelle inscription.
      </p>
      <button className="button primary" disabled={pending}>
        {pending ? "Contrôle…" : "Vérifier et terminer l’inscription"}
      </button>
      <button
        className="button secondary"
        name="requestReview"
        value="on"
        disabled={pending}
      >
        Demander une revue contrôlée
      </button>
    </form>
  );
}
