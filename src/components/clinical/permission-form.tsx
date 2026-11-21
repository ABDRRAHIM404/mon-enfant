"use client";
import { useActionState, useState } from "react";
import { changeClinicalPermission } from "@/app/(soignant)/(verified)/patients/clinical-actions";
import {
  clinicalCapabilities,
  clinicalCapabilityLabels,
  type ClinicalCapability,
} from "@/lib/clinical/types";
export function PermissionForm({
  professionalId,
  operationId,
}: {
  professionalId: string;
  operationId: string;
}) {
  const [state, action, pending] = useActionState(changeClinicalPermission, {});
  const [decision, setDecision] = useState("enable");
  const [selected, setSelected] = useState<ClinicalCapability[]>([]);
  const [revocation, setRevocation] = useState("");
  const [expiry, setExpiry] = useState("");
  const [evidence, setEvidence] = useState("");
  const [reason, setReason] = useState("");
  const [verified, setVerified] = useState(false);
  const granting = decision === "enable";
  const allSelected = selected.length === clinicalCapabilities.length;
  const disabled = pending || state.success;
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="professionalId" value={professionalId} />
      <input type="hidden" name="operationId" value={operationId} />
      <fieldset disabled={disabled}>
        <label>
          Décision
          <select
            name="decision"
            value={decision}
            onChange={(event) => setDecision(event.target.value)}
          >
            <option value="enable">Accorder</option>
            <option value="disable">Révoquer</option>
          </select>
        </label>
        {granting ? (
          <fieldset className="admin-capability-picker">
            <legend>Habilitations à accorder</legend>
            <label className="checkbox-label admin-capability-all">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(input) => {
                  if (input)
                    input.indeterminate = selected.length > 0 && !allSelected;
                }}
                onChange={(event) => {
                  setVerified(false);
                  setSelected(
                    event.target.checked ? [...clinicalCapabilities] : [],
                  );
                }}
              />
              Tout sélectionner
            </label>
            <div className="admin-capability-options">
              {clinicalCapabilities.map((capability) => (
                <label key={capability} className="checkbox-label">
                  <input
                    type="checkbox"
                    name="capability"
                    value={capability}
                    checked={selected.includes(capability)}
                    onChange={(event) => {
                      setVerified(false);
                      const checked = event.target.checked;
                      setSelected((current) =>
                        checked
                          ? [...current, capability]
                          : current.filter((value) => value !== capability),
                      );
                    }}
                  />
                  {clinicalCapabilityLabels[capability]}
                </label>
              ))}
            </div>
            <p className="fine">
              L’échéance saisie remplace l’échéance actuelle de chaque
              habilitation cochée. Sans date, elles seront accordées sans
              échéance.
            </p>
          </fieldset>
        ) : (
          <label>
            Habilitation à révoquer
            <select
              name="capability"
              value={revocation}
              onChange={(event) => setRevocation(event.target.value)}
              required
            >
              <option value="" disabled>
                Choisir
              </option>
              {clinicalCapabilities.map((capability) => (
                <option key={capability} value={capability}>
                  {clinicalCapabilityLabels[capability]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Dernier jour de validité, fin de journée UTC (facultatif)
          <input
            name="expires_at"
            type="date"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
          />
        </label>
        <label>
          Référence de la source de qualification contrôlée
          <textarea
            name="evidence_reference"
            minLength={10}
            maxLength={1000}
            required
            rows={2}
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
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
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {granting && (
          <label className="checkbox-label">
            <input
              name="verified"
              type="checkbox"
              required
              checked={verified}
              onChange={(event) => setVerified(event.target.checked)}
            />
            J’ai contrôlé la qualification et l’autorisation d’exercice pour
            toutes les activités cochées.
          </label>
        )}
      </fieldset>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="notice">
          Décision enregistrée dans l’historique.
        </p>
      )}
      <button
        className="button primary"
        disabled={disabled || (granting ? !selected.length : !revocation)}
      >
        {pending ? "Enregistrement…" : "Enregistrer la décision"}
      </button>
    </form>
  );
}
