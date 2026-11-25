"use client";

import { CalendarDays, Save } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { recordClinical } from "@/app/(soignant)/(verified)/patients/clinical-actions";
import {
  frenchAppointmentDate,
  parseAppointmentDate,
} from "@/lib/appointments/calendar";
import type { Facility } from "@/lib/registry/types";

export function MeasurementForm({
  childId,
  operationId,
  facilities,
}: {
  childId: string;
  operationId: string;
  facilities: Facility[];
}) {
  const [state, action, pending] = useActionState(recordClinical, {});
  const [precision, setPrecision] = useState("exact");
  const [source, setSource] = useState("observed");

  return (
    <form
      action={action}
      className="growth-form"
      onReset={(event) => event.preventDefault()}
      onInvalidCapture={(event) => {
        if (event.target instanceof HTMLElement) {
          const disclosure = event.target.closest("details");
          if (disclosure) disclosure.open = true;
        }
      }}
      aria-busy={pending}
    >
      <input type="hidden" name="kind" value="growth" />
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="operationId" value={operationId} />
      <input type="hidden" name="returnTo" value="growth" />
      <fieldset disabled={pending} className="growth-fields">
        <legend className="sr-only">Mesures et provenance</legend>
        <div className="growth-input-grid">
          <MeasurementDateInput disabled={precision === "unknown"} />
          <label>
            Poids (kg)
            <input
              name="weight_kg"
              type="number"
              inputMode="decimal"
              min="0.1"
              max="250"
              step="0.01"
            />
          </label>
          <label>
            Taille (cm)
            <input
              name="height_cm"
              type="number"
              inputMode="decimal"
              min="20"
              max="250"
              step="0.01"
            />
          </label>
          <label>
            Périmètre crânien (cm)
            <input
              name="head_cm"
              type="number"
              inputMode="decimal"
              min="10"
              max="100"
              step="0.01"
            />
          </label>
        </div>
        <p className="growth-hint">Renseignez au moins une mesure.</p>
        {facilities.length === 1 ? (
          <input type="hidden" name="facility_id" value={facilities[0].id} />
        ) : (
          <label>
            Lieu d’exercice
            <select name="facility_id" required defaultValue="">
              <option value="" disabled>
                Choisir un lieu
              </option>
              {facilities.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name} — {place.city}
                </option>
              ))}
            </select>
          </label>
        )}
        <details className="growth-provenance-fields">
          <summary>Certitude et provenance</summary>
          <div className="growth-input-grid">
            <label>
              Certitude de la date
              <select
                name="occurrence_precision"
                value={precision}
                onChange={(event) => {
                  const value = event.target.value;
                  setPrecision(value);
                  if (value !== "exact" && source === "observed") setSource("");
                }}
              >
                <option value="exact">Exacte</option>
                <option value="estimated">Estimée</option>
                <option value="unknown">Inconnue</option>
              </select>
            </label>
            <label>
              Provenance
              <select
                name="source_type"
                value={source}
                required
                onChange={(event) => setSource(event.target.value)}
              >
                <option value="" disabled>
                  Choisir une provenance
                </option>
                <option value="observed" disabled={precision !== "exact"}>
                  Observé par le professionnel
                </option>
                <option value="paper_transcription">
                  Transcription papier
                </option>
                <option value="reported_history">Historique rapporté</option>
              </select>
            </label>
          </div>
          <label>
            Référence et limites de la source
            <textarea
              name="source_reference"
              minLength={3}
              maxLength={1000}
              rows={2}
              required={Boolean(source) && source !== "observed"}
            />
          </label>
          <label className="growth-check">
            <input name="source_verified" type="checkbox" /> J’ai contrôlé cette
            source.
          </label>
        </details>
        <label className="growth-check">
          <input name="syntheticOnly" type="checkbox" required /> Données
          entièrement fictives.
        </label>
      </fieldset>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      <button className="growth-action growth-save" disabled={pending}>
        <Save size={18} aria-hidden="true" />{" "}
        {pending ? "Enregistrement…" : "Enregistrer la mesure"}
      </button>
    </form>
  );
}

function MeasurementDateInput({ disabled }: { disabled: boolean }) {
  const textInput = useRef<HTMLInputElement>(null);
  const datePicker = useRef<HTMLInputElement>(null);
  return (
    <div className="growth-date-input">
      <label>
        Date de mesure
        <input
          ref={textInput}
          name="occurred_on"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
          placeholder="JJ/MM/AAAA"
          title="Format JJ/MM/AAAA"
          required={!disabled}
          disabled={disabled}
          onChange={(event) => {
            const input = event.currentTarget;
            const digits = input.value.replace(/\D/g, "").slice(0, 8);
            input.value = [
              digits.slice(0, 2),
              digits.slice(2, 4),
              digits.slice(4),
            ]
              .filter(Boolean)
              .join("/");
            input.setCustomValidity("");
            if (digits.length === 8) {
              try {
                parseAppointmentDate(input.value);
              } catch {
                input.setCustomValidity(
                  "Indiquez une date valide au format JJ/MM/AAAA.",
                );
              }
            }
          }}
        />
      </label>
      <input
        tabIndex={-1}
        aria-hidden="true"
        ref={datePicker}
        type="date"
        disabled={disabled}
        onChange={(event) => {
          const input = textInput.current;
          if (!input) return;
          input.value = event.target.value
            ? frenchAppointmentDate(event.target.value)
            : "";
          input.setCustomValidity("");
        }}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label="Ouvrir le calendrier"
        onClick={() => {
          const picker = datePicker.current;
          const input = textInput.current;
          if (!picker || !input) return;
          try {
            picker.value = parseAppointmentDate(input.value);
          } catch {
            picker.value = "";
          }
          try {
            picker.showPicker();
          } catch {
            input.focus();
          }
        }}
      >
        <CalendarDays size={17} aria-hidden="true" />
      </button>
    </div>
  );
}
