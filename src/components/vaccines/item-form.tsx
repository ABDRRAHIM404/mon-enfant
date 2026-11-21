"use client";
import { useActionState } from "react";
import { changePatientVaccineItem } from "@/app/(soignant)/(verified)/patients/vaccine-actions";
import type { Facility } from "@/lib/registry/types";
import type { CatalogRule } from "@/lib/vaccines/types";
import { ageLabel } from "@/lib/vaccines/types";
export function VaccineItemForm({
  childId,
  operationId,
  facilities,
  versionId,
  rules = [],
  item,
}: {
  childId: string;
  operationId: string;
  facilities: Facility[];
  versionId?: string;
  rules?: CatalogRule[];
  item?: { id: string; revision: number; state: "active" | "withdrawn" };
}) {
  const [state, action, pending] = useActionState(changePatientVaccineItem, {});
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="operationId" value={operationId} />
      {item ? (
        <>
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="expected_revision" value={item.revision} />
          <input
            type="hidden"
            name="state"
            value={item.state === "active" ? "withdrawn" : "active"}
          />
        </>
      ) : (
        <input type="hidden" name="version_id" value={versionId} />
      )}
      <fieldset disabled={pending}>
        <legend>
          {item
            ? item.state === "active"
              ? "Retirer cette référence"
              : "Réactiver cette référence"
            : "Assigner une référence de routine"}
        </legend>
        {!item && (
          <label>
            Dose
            <select name="dose_code" required defaultValue="">
              <option value="" disabled>
                Choisir une dose après examen clinique
              </option>
              {rules
                .filter((r) => r.automatic_scheduling && r.dose_code !== "HB1")
                .map((r) => (
                  <option key={r.dose_code} value={r.dose_code}>
                    {r.dose_code} · {r.vaccine_code} · {ageLabel(r.age)}
                    {r.eligibility === "female" ? " · filles uniquement" : ""}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label>
          Votre lieu d’exercice
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
          Motif de la décision
          <textarea
            name="reason"
            minLength={10}
            maxLength={1000}
            required
            rows={3}
          />
        </label>
        {item?.state !== "active" && (
          <label className="checkbox-label">
            <input type="checkbox" name="eligibility_checked" required /> J’ai
            examiné l’éligibilité, l’historique et la pertinence de cette
            référence pour cet enfant. Cette décision ne documente aucune
            administration.
          </label>
        )}
        <label className="checkbox-label">
          <input type="checkbox" name="syntheticOnly" required /> Données
          entièrement fictives.
        </label>
      </fieldset>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="button primary" disabled={pending}>
        {pending
          ? "Enregistrement…"
          : item
            ? item.state === "active"
              ? "Retirer avec historique"
              : "Réactiver avec historique"
            : "Assigner la référence"}
      </button>
    </form>
  );
}
