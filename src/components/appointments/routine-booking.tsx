"use client";

import { Check, Pencil, X } from "lucide-react";
import { useActionState, useState } from "react";
import { confirmRoutineAppointment } from "@/app/(soignant)/(verified)/appointments/actions";
import type { RoutineAppointmentProposal } from "@/lib/appointments/types";
import type { Facility } from "@/lib/registry/types";

export function RoutineBooking({
  proposal,
  version,
  facilities,
  operation,
  today,
}: {
  proposal: RoutineAppointmentProposal;
  version: string;
  facilities: Facility[];
  operation: string;
  today: string;
}) {
  const [state, action, pending] = useActionState(
    confirmRoutineAppointment,
    {},
  );
  const [mode, setMode] = useState<"confirm" | "modify" | null>(null);
  const [date, setDate] = useState(proposal.recommended_on);
  return (
    <>
      <div className="routine-actions">
        <button
          type="button"
          className="rdv-action rdv-primary"
          aria-expanded={mode === "confirm"}
          onClick={() => {
            setDate(proposal.recommended_on);
            setMode(mode === "confirm" ? null : "confirm");
          }}
          disabled={pending}
        >
          <Check size={18} /> Confirmer
        </button>
        <button
          type="button"
          className="rdv-action rdv-coral"
          aria-expanded={mode === "modify"}
          onClick={() => setMode(mode === "modify" ? null : "modify")}
          disabled={pending}
        >
          <Pencil size={18} /> Modifier
        </button>
      </div>
      <form
        hidden={!mode}
        action={action}
        className="auth-form routine-form"
        onReset={(event) => event.preventDefault()}
      >
        <input type="hidden" name="child" value={proposal.child_id} />
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="operation" value={operation} />
        <input
          type="hidden"
          name="recommended"
          value={proposal.recommended_on}
        />
        {proposal.doses.map(({ code }) => (
          <input type="hidden" name="dose" value={code} key={code} />
        ))}
        <fieldset disabled={pending}>
          <legend>
            {mode === "modify"
              ? "Choisir un autre créneau"
              : "Confirmer le créneau proposé"}
          </legend>
          <label>
            Date du rendez-vous
            <input
              type="date"
              name="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              min={today}
              readOnly={mode === "confirm"}
              required
            />
          </label>
          <div className="routine-times">
            <label>
              Début <input type="time" name="starts" required />
            </label>
            <label>
              Fin <input type="time" name="ends" required />
            </label>
          </div>
          <label>
            Heure locale de Casablanca
            <select name="offset" defaultValue="auto">
              <option value="auto">Détection automatique</option>
              <option value="+01:00">UTC+1 (première occurrence)</option>
              <option value="+00:00">UTC+0 (seconde occurrence)</option>
            </select>
          </label>
          <label>
            Lieu d’exercice
            <select
              name="facility_id"
              required
              defaultValue={facilities.length === 1 ? facilities[0].id : ""}
            >
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
          <label>
            Motif de la décision{" "}
            <textarea
              name="reason"
              rows={2}
              minLength={10}
              maxLength={1000}
              required
            />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="reviewed" required /> J’ai vérifié le
            dossier et les doses prévues.
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="syntheticOnly" required /> Données
            entièrement fictives.
          </label>
        </fieldset>
        {state.error && (
          <p role="alert" className="form-error">
            {state.error}
          </p>
        )}
        <div className="routine-actions">
          <button className="rdv-action rdv-primary" disabled={pending}>
            {pending ? "Confirmation…" : "Confirmer le rendez-vous"}
          </button>
          <button
            className="rdv-action"
            type="button"
            disabled={pending}
            onClick={() => setMode(null)}
          >
            <X size={18} /> Fermer
          </button>
        </div>
      </form>
    </>
  );
}
