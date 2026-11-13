"use client";
import { useActionState } from "react";
import { changeClinicalPermission } from "@/app/patients/clinical-actions";
export function PermissionForm({
  professionalId,
  operationId,
}: {
  professionalId: string;
  operationId: string;
}) {
  const [state, action, pending] = useActionState(changeClinicalPermission, {});
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="professionalId" value={professionalId} />
      <input type="hidden" name="operationId" value={operationId} />
      <fieldset disabled={pending || state.success}>
        <label>
          Habilitation
          <select name="capability" defaultValue="consultation">
            <option value="consultation">Consultation</option>
            <option value="prescription">Prescription / traitement</option>
            <option value="risk">Risque / allergie</option>
            <option value="growth">Mesures de croissance</option>
            <option value="vaccination">Vaccination</option>
            <option value="appointment">Gestion des rendez-vous</option>
          </select>
        </label>
        <label>
          Décision
          <select name="decision" defaultValue="" required>
            <option value="" disabled>
              Choisir
            </option>
            <option value="enable">Accorder</option>
            <option value="disable">Révoquer</option>
          </select>
        </label>
        <label>
          Dernier jour de validité, fin de journée UTC (facultatif)
          <input name="expires_at" type="date" />
        </label>
        <label>
          Référence de la source de qualification contrôlée
          <textarea
            name="evidence_reference"
            minLength={10}
            maxLength={1000}
            required
            rows={2}
          />
        </label>
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
        <label className="checkbox-label">
          <input name="verified" type="checkbox" /> Qualification et
          autorisation d’exercice de cette activité contrôlées (obligatoire pour
          accorder).
        </label>
      </fieldset>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="notice">
          Habilitation historisée.
        </p>
      )}
      <button className="button primary" disabled={pending || state.success}>
        {pending ? "Enregistrement…" : "Enregistrer l’habilitation"}
      </button>
    </form>
  );
}
