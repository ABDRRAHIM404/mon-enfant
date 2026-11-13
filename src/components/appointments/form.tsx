"use client";
import { useActionState, useState } from "react";
import { saveAppointment } from "@/app/appointments/actions";
import {
  localAppointmentInput,
  localAppointmentOffset,
} from "@/lib/appointments/calendar";
import type {
  AppointmentRow,
  AppointmentOption,
} from "@/lib/appointments/types";
import type { Facility } from "@/lib/registry/types";
export function AppointmentForm({
  childId,
  operationId,
  facilities = [],
  options = [],
  previous,
  selectedItem = "",
}: {
  childId: string;
  operationId: string;
  facilities?: Facility[];
  options?: AppointmentOption[];
  previous?: AppointmentRow;
  selectedItem?: string;
}) {
  const [state, action, pending] = useActionState(saveAppointment, {}),
    [decision, setDecision] = useState("reschedule"),
    [purpose, setPurpose] = useState(
      selectedItem ? "vaccination" : "consultation",
    );
  function datetime(name: string, label: string, old?: string) {
    return (
      <div>
        <label>
          {label}
          <input
            name={`${name}_local`}
            type="datetime-local"
            step="60"
            required
            defaultValue={old ? localAppointmentInput(old) : ""}
          />
        </label>
        <label>
          Changement d’heure : décalage de {label.toLowerCase()}
          <select
            name={`${name}_offset`}
            defaultValue={old ? localAppointmentOffset(old) : "auto"}
          >
            <option value="auto">Automatique si l’heure est unique</option>
            <option value="+01:00">
              UTC+1 (première occurrence si heure répétée)
            </option>
            <option value="+00:00">
              UTC+0 (seconde occurrence si heure répétée)
            </option>
          </select>
        </label>
      </div>
    );
  }
  return (
    <form
      action={action}
      className="auth-form"
      onReset={(event) => event.preventDefault()}
    >
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="operationId" value={operationId} />
      {previous && (
        <>
          <input type="hidden" name="appointmentId" value={previous.id} />
          <input
            type="hidden"
            name="expected_revision"
            value={previous.revision}
          />
        </>
      )}
      <fieldset disabled={pending}>
        <legend>
          {previous
            ? "Nouvelle décision avec historique"
            : "Nouveau rendez-vous"}
        </legend>
        {previous ? (
          <label>
            Décision
            <select
              name="decision"
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
            >
              <option value="reschedule">
                Choisir manuellement un autre créneau
              </option>
              {["scheduled", "missed"].includes(previous.state) && (
                <option value="cancel">Annuler avec motif</option>
              )}
              {previous.purpose !== "vaccination" &&
                ["scheduled", "missed"].includes(previous.state) && (
                  <option value="complete">
                    Déclarer la visite réalisée (aucun soin créé)
                  </option>
                )}
              {previous.state === "scheduled" && (
                <option value="mark_missed">
                  Consigner le créneau passé sans disposition
                </option>
              )}
            </select>
          </label>
        ) : (
          <>
            <label>
              Objet
              <select
                name="purpose"
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
              >
                <option value="consultation">Consultation</option>
                <option value="vaccination">
                  Suivi vaccinal lié à une référence
                </option>
                <option value="other">Autre suivi</option>
              </select>
            </label>
            <label>
              Libellé bref (sans détail médical)
              <input name="purpose_label" maxLength={120} required />
            </label>
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
            {purpose === "vaccination" && (
              <>
                <label>
                  Référence exacte prévue pour cet enfant
                  <select
                    name="vaccine_item_id"
                    required
                    defaultValue={selectedItem}
                  >
                    <option value="" disabled>
                      Choisir une référence active non documentée
                    </option>
                    {options
                      .filter((item) => item.active && !item.documentation)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.dose_code} · {item.version_label}
                        </option>
                      ))}
                  </select>
                </label>
                <p className="fine">
                  Les références ci-dessous aident votre revue. Choisissez
                  vous-même les dates ; aucun rattrapage n’est prescrit.
                </p>
                {options
                  .filter((item) => item.active && !item.documentation)
                  .map((item) => (
                    <p className="fine" key={item.id}>
                      {item.dose_code} :{" "}
                      {item.reference.start_on
                        ? item.reference.is_window
                          ? `${item.reference.start_on} au ${item.reference.end_on} inclus`
                          : `référence de routine ${item.reference.start_on}`
                        : "date de routine non calculée — version ou données à réexaminer"}
                    </p>
                  ))}
              </>
            )}
          </>
        )}
        {(!previous || decision === "reschedule") && (
          <>
            <p className="notice">
              Heures locales : Africa/Casablanca. Pour une heure répétée,
              précisez UTC+1 ou UTC+0. Les heures inexistantes sont refusées.
            </p>
            {datetime("starts", "Début", previous?.starts_at)}
            {datetime("ends", "Fin", previous?.ends_at)}
          </>
        )}
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
        <label className="checkbox-label">
          <input type="checkbox" name="reviewed" required /> J’ai relu le
          dossier et cette décision. Replanifier ou déclarer une visite ne crée
          aucune administration.
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
      <button className="button primary" disabled={pending}>
        {pending
          ? "Enregistrement…"
          : previous
            ? "Ajouter la décision"
            : "Planifier le rendez-vous"}
      </button>
    </form>
  );
}
