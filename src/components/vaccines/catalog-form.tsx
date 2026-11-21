"use client";
import { useActionState } from "react";
import { changeCatalog } from "@/app/vaccines/actions";
import type { CatalogRule } from "@/lib/vaccines/types";
export function CatalogForm({
  versionId,
  revision,
  operationId,
  mode,
  rule,
}: {
  versionId: string;
  revision: number;
  operationId: string;
  mode: "clone" | "edit" | "approve" | "retire";
  rule?: CatalogRule;
}) {
  const [state, action, pending] = useActionState(changeCatalog, {});
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="revision" value={revision} />
      <input type="hidden" name="operationId" value={operationId} />
      <input type="hidden" name="action" value={mode} />
      <fieldset disabled={pending}>
        {mode === "clone" && (
          <label>
            Nom du nouveau brouillon
            <input name="label" minLength={3} maxLength={120} required />
          </label>
        )}
        {mode === "edit" && rule && (
          <>
            <input type="hidden" name="dose_code" value={rule.dose_code} />
            <label>
              Unité de l’âge configuré
              <select name="unit" defaultValue={rule.age.unit}>
                {rule.age.unit === "birth_24_hours" && (
                  <option value="birth_24_hours">
                    Dans les 24 heures suivant la naissance
                  </option>
                )}
                <option value="first_4_weeks">
                  Fenêtre des quatre premières semaines
                </option>
                <option value="weeks">Semaines</option>
                <option value="months">Mois calendaires</option>
                <option value="years">Années</option>
              </select>
            </label>
            <label>
              Nombre (laisser vide pour une fenêtre de naissance)
              <input
                name="age_value"
                type="number"
                min={1}
                max={1040}
                step={1}
                defaultValue={rule.age.value ?? ""}
              />
            </label>
            <label>
              Éligibilité
              <select name="eligibility" defaultValue={rule.eligibility}>
                <option value="all">Tous les enfants</option>
                <option value="female">Filles uniquement</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                name="automatic_scheduling"
                type="checkbox"
                defaultChecked={rule.automatic_scheduling}
              />
              Autoriser le calcul d’une référence de routine après approbation
              (jamais de rattrapage).
            </label>
          </>
        )}
        {mode === "approve" && (
          <>
            <p className="notice">
              La revue porte sur toutes les doses et toutes les décisions. La
              publication autorise uniquement les références de routine, sans
              prescrire de rendez-vous ni de rattrapage.
            </p>
            <label className="checkbox-label">
              <input type="checkbox" name="source_authenticated" required />
              J’ai authentifié la présentation et la transcription d’origine.
            </label>
            <label className="checkbox-label">
              <input type="checkbox" name="clinical_reviewed" required />
              J’ai effectué la revue clinique complète, notamment HBn et le
              recours conditionnel à HB1, PCV1–4, rotavirus en mois calendaires
              et HPV à 11 ans pour les filles.
            </label>
            <label className="checkbox-label">
              <input type="checkbox" name="birth_window_reviewed" required />
              J’ai validé l’interprétation de la fenêtre : naissance incluse
              jusqu’à J+27 inclus, sans date de rendez-vous imposée.
            </label>
          </>
        )}
        <label>
          Référence de la source contrôlée
          <textarea
            name="evidence_reference"
            minLength={10}
            maxLength={1000}
            required
            rows={2}
          />
        </label>
        <label>
          Motif conservé dans l’historique
          <textarea
            name="reason"
            minLength={10}
            maxLength={1000}
            required
            rows={2}
          />
        </label>
      </fieldset>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      <button className="button primary" disabled={pending}>
        {pending
          ? "Enregistrement…"
          : {
              clone: "Créer le brouillon",
              edit: "Enregistrer la règle",
              approve: "Approuver cette version",
              retire: "Retirer cette version",
            }[mode]}
      </button>
    </form>
  );
}
