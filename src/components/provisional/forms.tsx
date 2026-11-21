"use client";
import {
  localAppointmentInput,
  localAppointmentOffset,
} from "@/lib/appointments/calendar";
import { useActionState, useState } from "react";
import { VaccineSelection } from "@/components/vaccines/selection";
import type { VaccineChoice } from "@/lib/vaccines/choices";
import {
  createProvisional,
  writeProvisional,
} from "@/app/(soignant)/provisional/actions";
import {
  provisionalKinds,
  provisionalFields,
  type ProvisionalEntry,
} from "@/lib/provisional";
export function ProvisionalChildForm({ operationId }: { operationId: string }) {
  const [state, action, pending] = useActionState(createProvisional, {});
  return (
    <form
      action={action}
      className="form-grid"
      aria-busy={pending}
      onReset={(event) => event.preventDefault()}
    >
      <input type="hidden" name="operationId" value={operationId} />
      <label>
        Certitude du nom
        <select name="name_status" defaultValue="confirmed">
          <option value="confirmed">Déclaré connu</option>
          <option value="provisional">Provisoire</option>
          <option value="unknown">Inconnu — laisser les noms vides</option>
        </select>
      </label>
      <label>
        Prénom
        <input name="given_name" maxLength={100} />
      </label>
      <label>
        Nom
        <input name="family_name" maxLength={100} />
      </label>
      <label>
        Date de naissance
        <input name="birth_date" type="date" />
      </label>
      <label>
        Certitude de naissance
        <select name="birth_date_precision" defaultValue="exact">
          <option value="exact">Exacte déclarée</option>
          <option value="estimated">Estimée</option>
          <option value="unknown">Inconnue — laisser la date vide</option>
        </select>
      </label>
      <label>
        Sexe
        <select name="sex" defaultValue="unknown">
          <option value="unknown">Inconnu</option>
          <option value="female">Féminin</option>
          <option value="male">Masculin</option>
        </select>
      </label>
      <label>
        Référence locale (facultative, non unique)
        <input name="local_reference" maxLength={100} />
      </label>
      <label>
        Référence de la source (facultative)
        <input name="source_reference" maxLength={500} />
      </label>
      <label className="checkbox">
        <input type="checkbox" name="syntheticOnly" required />
        Données entièrement fictives dans cet environnement.
      </label>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="button primary" disabled={pending}>
        {pending ? "Création…" : "Créer le dossier provisoire"}
      </button>
    </form>
  );
}
export function ProvisionalEntryForm({
  childId,
  operationId,
  entry,
  initialKind,
  vaccineChoices = [],
}: {
  childId: string;
  operationId: string;
  entry?: ProvisionalEntry;
  initialKind?: keyof typeof provisionalKinds;
  vaccineChoices?: VaccineChoice[];
}) {
  const [kind, setKind] = useState(
    entry?.kind ?? initialKind ?? "consultation",
  );
  const [state, action, pending] = useActionState(writeProvisional, {});
  return (
    <form
      action={action}
      className="form-grid"
      aria-busy={pending}
      onReset={(event) => event.preventDefault()}
    >
      <input type="hidden" name="operationId" value={operationId} />
      <input type="hidden" name="childId" value={childId} />
      {entry && (
        <>
          <input type="hidden" name="rootId" value={entry.root_id} />
          <input type="hidden" name="revision" value={entry.revision} />
          <p>
            Correction de la révision {entry.revision}. L’original est conservé.
          </p>
        </>
      )}
      <label>
        Type d’entrée
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          disabled={!!entry}
        >
          {Object.entries(provisionalKinds).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {entry && <input type="hidden" name="kind" value={kind} />}
      <div key={kind} className="form-grid">
        {kind === "vaccination" && (
          <VaccineSelection
            choices={vaccineChoices}
            previous={entry?.payload}
          />
        )}
        {provisionalFields[kind]
          .filter(
            (field) =>
              field.key !== "scheduled_for" &&
              (kind !== "vaccination" ||
                !["vaccine_label", "dose_label"].includes(field.key)),
          )
          .map((field) => (
            <label key={field.key}>
              {field.label}
              {!field.type &&
              [
                "reason",
                "findings",
                "assessment",
                "plan",
                "instructions",
                "description",
                "notes",
              ].includes(field.key) ? (
                <textarea
                  name={field.key}
                  required={field.required}
                  maxLength={2000}
                  rows={3}
                  defaultValue={entry?.payload[field.key] ?? ""}
                />
              ) : (
                <input
                  name={field.key}
                  type={field.type ?? "text"}
                  step={field.type === "number" ? "any" : undefined}
                  required={field.required}
                  maxLength={2000}
                  defaultValue={entry?.payload[field.key] ?? ""}
                />
              )}
            </label>
          ))}
        {kind === "risk" && (
          <>
            <label>
              Catégorie
              <select
                name="category"
                defaultValue={entry?.payload.category ?? "other"}
              >
                {Object.entries({
                  allergy: "Allergie",
                  medical: "Médical",
                  social: "Social",
                  other: "Autre (préciser dans la description)",
                }).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sévérité
              <select
                name="severity"
                defaultValue={entry?.payload.severity ?? "unknown"}
              >
                {Object.entries({
                  unknown: "Inconnue",
                  low: "Faible",
                  moderate: "Modérée",
                  high: "Élevée",
                }).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {kind === "appointment" && (
          <>
            <label>
              Date et heure du rendez-vous (Casablanca)
              <input
                name="scheduled_local"
                type="datetime-local"
                step="60"
                required
                defaultValue={
                  entry?.payload.scheduled_for
                    ? localAppointmentInput(String(entry.payload.scheduled_for))
                    : ""
                }
              />
            </label>
            <label>
              Décalage si l’heure est répétée
              <select
                name="scheduled_offset"
                defaultValue={
                  entry?.payload.scheduled_for
                    ? localAppointmentOffset(
                        String(entry.payload.scheduled_for),
                      )
                    : "auto"
                }
              >
                <option value="auto">Automatique si l’heure est unique</option>
                <option value="+01:00">UTC+1</option>
                <option value="+00:00">UTC+0</option>
              </select>
            </label>
          </>
        )}
        {kind === "appointment" && (
          <label>
            État du rendez-vous
            <select
              name="status"
              defaultValue={entry?.payload.status ?? "planned"}
            >
              <option value="planned">Planifié</option>
              <option value="completed">Réalisé</option>
              <option value="missed">Manqué constaté</option>
              <option value="cancelled">Annulé</option>
              <option value="rescheduled">Reprogrammé</option>
            </select>
          </label>
        )}
      </div>
      <label>
        Date de l’événement
        <input
          type="date"
          name="occurred_on"
          defaultValue={entry?.occurred_on ?? ""}
        />
      </label>
      <label>
        Certitude de la date
        <select
          name="occurrence_precision"
          defaultValue={entry?.occurrence_precision ?? "exact"}
        >
          <option value="exact">Exacte déclarée</option>
          <option value="estimated">Estimée</option>
          <option value="unknown">Inconnue — laisser la date vide</option>
        </select>
      </label>
      <label>
        Origine
        <select
          name="source_type"
          defaultValue={entry?.source_type ?? "observed"}
        >
          <option value="observed">Observation déclarée</option>
          <option value="paper_transcription">Transcription papier</option>
          <option value="reported">Rapporté</option>
        </select>
      </label>
      <label>
        Référence de la source
        <input
          name="source_reference"
          maxLength={1000}
          defaultValue={entry?.source_reference ?? ""}
        />
      </label>
      {entry && (
        <>
          <label>
            Motif de correction
            <input
              name="correction_reason"
              minLength={10}
              maxLength={1000}
              required
            />
          </label>
          <label>
            État de l’entrée
            <select name="entry_state" defaultValue={entry.entry_state}>
              <option value="active">Active</option>
              <option value="withdrawn">Retirée avec historique</option>
            </select>
          </label>
        </>
      )}
      <p className="fine">
        Entrée non vérifiée. Aucun rapprochement automatique avec le calendrier
        officiel, aucun rattrapage ni partage.
      </p>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="button primary" disabled={pending}>
        {pending
          ? "Enregistrement…"
          : entry
            ? "Enregistrer la correction"
            : "Enregistrer l’entrée provisoire"}
      </button>
    </form>
  );
}
