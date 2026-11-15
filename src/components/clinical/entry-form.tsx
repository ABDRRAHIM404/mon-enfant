"use client";
import type { VaccineChoice } from "@/lib/vaccines/choices";
import Link from "next/link";
import { VaccinationFields } from "@/components/vaccines/vaccination-fields";
import type { VaccineItemExport } from "@/lib/vaccines/patient-types";
import { useActionState } from "react";
import { recordClinical } from "@/app/patients/clinical-actions";
import type { ClinicalEntry, ClinicalKind } from "@/lib/clinical/types";
import type { Facility } from "@/lib/registry/types";
export function ClinicalForm({
  childId,
  operationId,
  kind,
  facilities,
  previous,
  vaccineItems = [],
  vaccineChoices = [],
}: {
  childId: string;
  operationId: string;
  kind: ClinicalKind;
  facilities: Facility[];
  previous?: ClinicalEntry;
  vaccineItems?: VaccineItemExport[];
  vaccineChoices?: VaccineChoice[];
}) {
  const [state, action, pending] = useActionState(recordClinical, {});
  const data = previous?.payload;
  function input(
    name: string,
    label: string,
    maxLength: number,
    required = false,
  ) {
    return (
      <label key={name}>
        {label}
        <textarea
          name={name}
          defaultValue={data?.[name] ?? ""}
          required={required}
          maxLength={maxLength}
          rows={name === "findings" ? 5 : 3}
        />
      </label>
    );
  }
  return (
    <form
      action={action}
      className="auth-form"
      // React resets uncontrolled fields after an action returns. Keep the entered
      // evidence available for duplicate review and validation retries.
      onReset={
        kind === "vaccination" ? (event) => event.preventDefault() : undefined
      }
    >
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="operationId" value={operationId} />
      <input type="hidden" name="kind" value={kind} />
      {previous && (
        <>
          <input type="hidden" name="rootId" value={previous.root_id} />
          <input
            type="hidden"
            name="expected_revision"
            value={previous.revision}
          />
        </>
      )}
      <fieldset disabled={pending}>
        <legend className="sr-only">
          {previous ? "Nouvelle révision" : "Nouvelle saisie clinique"}
        </legend>
        <label>
          Lieu de saisie / d’exercice
          <select
            name="facility_id"
            defaultValue={previous?.facility_id ?? ""}
            required
          >
            <option value="" disabled>
              Choisir votre lieu déclaré
            </option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} — {f.city}
              </option>
            ))}
          </select>
        </label>
        <label>
          Certitude de la date de soin
          <select
            name="occurrence_precision"
            defaultValue={previous?.occurrence_precision ?? "exact"}
          >
            <option value="exact">Exacte</option>
            <option value="estimated">Estimée</option>
            <option value="unknown">Inconnue — laisser la date vide</option>
          </select>
        </label>
        <label>
          Date du soin / de la mesure
          <input
            name="occurred_on"
            type="date"
            defaultValue={previous?.occurred_on ?? ""}
          />
        </label>
        <label>
          Provenance
          <select
            name="source_type"
            defaultValue={previous?.source_type ?? "observed"}
          >
            <option value="observed">Observé par le professionnel</option>
            <option value="paper_transcription">Transcription papier</option>
            <option value="reported_history">Historique rapporté</option>
          </select>
        </label>
        <label>
          Référence et limites de la source (obligatoire si non observé)
          <textarea
            name="source_reference"
            maxLength={1000}
            rows={2}
            defaultValue={previous?.source_reference ?? ""}
          />
        </label>
        <label className="checkbox-label">
          <input
            name="source_verified"
            type="checkbox"
            defaultChecked={previous?.source_verified ?? false}
          />{" "}
          J’ai contrôlé cette source. Une information rapportée reste attribuée
          à sa provenance.
        </label>
        {kind === "vaccination" && (
          <VaccinationFields
            previous={previous}
            items={vaccineItems}
            choices={vaccineChoices}
          />
        )}
        {kind === "consultation" && [
          input("reason", "Motif de consultation", 1000, true),
          input("findings", "Observations", 8000),
          input("assessment", "Évaluation", 4000),
          input("plan", "Plan de soins", 4000),
        ]}
        {kind === "prescription" && (
          <>
            {input(
              "medication",
              "Médicament / traitement saisi par le prescripteur",
              200,
              true,
            )}
            {input(
              "instructions",
              "Instructions / posologie décidées par le prescripteur",
              2000,
              true,
            )}
            {input("duration", "Durée", 200)}
            <p className="fine">
              Le service ne calcule ni ne recommande une posologie.
            </p>
          </>
        )}
        {kind === "risk" && (
          <>
            <label>
              Catégorie
              <select
                name="category"
                defaultValue={data?.category ?? "medical"}
              >
                <option value="allergy">Allergie</option>
                <option value="medical">Médical</option>
                <option value="social">Social</option>
                <option value="other">Autre</option>
              </select>
            </label>
            {input("description", "Description", 2000, true)}
            <label>
              Sévérité déclarée
              <select
                name="severity"
                defaultValue={data?.severity ?? "unknown"}
              >
                <option value="unknown">Inconnue</option>
                <option value="low">Faible</option>
                <option value="moderate">Modérée</option>
                <option value="high">Élevée</option>
              </select>
            </label>
          </>
        )}
        {kind === "growth" && (
          <>
            {[
              ["weight_kg", "Poids (kg)", 0.1, 250],
              ["height_cm", "Taille (cm)", 20, 250],
              ["head_cm", "Périmètre crânien (cm)", 10, 100],
            ].map(([key, label, min, max]) => (
              <label key={String(key)}>
                {label}
                <input
                  name={String(key)}
                  type="number"
                  step="0.01"
                  min={Number(min)}
                  max={Number(max)}
                  defaultValue={data?.[String(key)] ?? ""}
                />
              </label>
            ))}
            <p className="fine">
              Renseignez au moins une mesure. Les bornes sont des limites de
              saisie, sans interprétation clinique ni percentile.
            </p>
          </>
        )}
        {previous && (
          <>
            <label>
              État de la nouvelle révision
              <select name="entry_state" defaultValue={previous.entry_state}>
                <option value="active">Active</option>
                <option value="withdrawn">
                  Retirée pour erreur (original conservé)
                </option>
              </select>
            </label>
            <label>
              Motif obligatoire de correction / retrait
              <textarea
                name="amendment_reason"
                minLength={10}
                maxLength={1000}
                required
                rows={3}
              />
            </label>
            <p className="fine">
              {kind === "vaccination" &&
                "Pour un retrait, les dernières données cliniques et leur provenance sont conservées automatiquement ; seuls le motif et l’auteur du retrait sont ajoutés. "}
              La version {previous.revision} reste dans l’historique. Une
              correction concurrente impose de recharger le dossier.
            </p>
          </>
        )}
        <label className="checkbox-label">
          <input name="syntheticOnly" type="checkbox" required /> Saisie
          entièrement fictive dans cet environnement de test.
        </label>
      </fieldset>
      {kind === "vaccination" && (
        <button
          className="button secondary"
          name="intent"
          value="check_duplicates"
          disabled={pending}
        >
          Contrôler les doublons possibles
        </button>
      )}
      {state.checked && !state.conflicts?.length && (
        <p role="status">
          Aucun doublon potentiel trouvé avec ces champs. Ce contrôle ne prouve
          pas la validité clinique d’une dose.
        </p>
      )}
      {!!state.conflicts?.length && (
        <section className="notice" aria-label="Doublons possibles">
          <h3>Événements à relire</h3>
          <ul>
            {state.conflicts.map((conflict) => (
              <li key={conflict.id}>
                <Link
                  className="text-link"
                  href={`/patients/${childId}/records/${conflict.root_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {conflict.vaccine_label} ·{" "}
                  {conflict.dose_label || "Dose inconnue"} ·{" "}
                  {conflict.occurred_on || "Date inconnue"} ·{" "}
                  {conflict.professional_id}
                </Link>
                <span className="fine"> — révision {conflict.id}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="button primary" disabled={pending}>
        {pending
          ? "Enregistrement…"
          : previous
            ? "Ajouter la révision"
            : "Enregistrer le soin"}
      </button>
    </form>
  );
}
