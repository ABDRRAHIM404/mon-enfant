"use client";
import { useState } from "react";
import { VaccineSelection } from "./selection";
import type { VaccineChoice } from "@/lib/vaccines/choices";
import type { ClinicalEntry } from "@/lib/clinical/types";
import {
  vaccinationDetails,
  type VaccineItemExport,
} from "@/lib/vaccines/patient-types";

function AdministrationDetail({
  detail,
  data,
}: {
  detail: (typeof vaccinationDetails)[number];
  data?: ClinicalEntry["payload"];
}) {
  const { status, field, label } = detail;
  const [certainty, setCertainty] = useState(
    String(data?.[status] ?? "unknown"),
  );
  return (
    <div className="form-grid">
      <label>
        {label} : certitude
        <select
          name={status}
          value={certainty}
          onChange={(event) => setCertainty(event.target.value)}
        >
          <option value="unknown">Inconnu — laisser la valeur vide</option>
          <option value="known">Connu — renseigner la valeur</option>
          {status === "lot_status" && (
            <option value="not_applicable">
              Sans objet — laisser la valeur vide
            </option>
          )}
        </select>
      </label>
      <label>
        {label}
        <input
          name={field}
          defaultValue={data?.[field] ?? ""}
          maxLength={200}
          disabled={certainty !== "known"}
        />
      </label>
    </div>
  );
}
export function VaccinationFields({
  previous,
  items,
  choices,
  initialChoice,
}: {
  previous?: ClinicalEntry;
  items: VaccineItemExport[];
  choices: VaccineChoice[];
  initialChoice?: VaccineChoice;
}) {
  const data = previous?.payload;
  const [matching, setMatching] = useState(
    String(data?.matching_status ?? "unmatched"),
  );
  const [itemId, setItemId] = useState(String(data?.schedule_item_id ?? ""));
  const [selected, setSelected] = useState<{
    choice: VaccineChoice | null;
    dose: string;
  } | null>(
    !previous && initialChoice
      ? { choice: initialChoice, dose: initialChoice.dose_code }
      : null,
  );
  const eligibleItems = selected
    ? items.filter(
        (item) =>
          selected.choice &&
          item.version_id === selected.choice.version_id &&
          item.rule.vaccine_code === selected.choice.vaccine_code &&
          item.dose_code === selected.dose,
      )
    : items;
  return (
    <>
      <h2>Administration documentée</h2>
      <VaccineSelection
        choices={choices}
        previous={
          data
            ? {
                ...data,
                catalog_version_id:
                  items.find((item) => item.id === data.schedule_item_id)
                    ?.version_id ?? "",
              }
            : initialChoice
              ? {
                  catalog_version_id: initialChoice.version_id,
                  vaccine_code: initialChoice.vaccine_code,
                  vaccine_label: initialChoice.vaccine_label,
                  dose_label: initialChoice.dose_code,
                }
              : undefined
        }
        onSelectionChange={(choice, dose) => {
          setSelected({ choice, dose });
          setMatching("unmatched");
          setItemId("");
        }}
      />
      {vaccinationDetails.map((detail) => (
        <AdministrationDetail key={detail.status} detail={detail} data={data} />
      ))}
      <p className="fine">
        Le professionnel et le lieu d’administration peuvent différer de
        l’auteur de cette transcription. Laissez les éléments inconnus vides.
      </p>
      <h2>Rapprochement clinique</h2>
      <label>
        Décision de rapprochement
        <select
          name="matching_status"
          value={matching}
          onChange={(event) => {
            setMatching(event.target.value);
            if (event.target.value === "unmatched") setItemId("");
            else if (
              initialChoice &&
              eligibleItems.length === 1 &&
              eligibleItems[0].changes.at(-1)?.state !== "withdrawn"
            )
              setItemId(eligibleItems[0].id);
          }}
        >
          <option value="unmatched">
            Non rapprochée — aucune référence validée
          </option>
          <option value="clinician_validated">
            J’ai validé le rapprochement avec la référence exacte ci-dessous
          </option>
        </select>
      </label>
      <label>
        Référence prévue pour cet enfant
        <select
          name="schedule_item_id"
          value={itemId}
          disabled={matching === "unmatched"}
          onChange={(event) => setItemId(event.target.value)}
        >
          <option value="">Aucune — conserver non rapprochée</option>
          {eligibleItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.dose_code} · {item.rule.vaccine_code} · {item.version_label}{" "}
              ·{" "}
              {item.changes.at(-1)?.state === "withdrawn"
                ? "référence retirée"
                : "référence active"}
            </option>
          ))}
        </select>
      </label>
      <p className="fine">
        Un rapprochement demande une référence active, le même vaccin, une date
        exacte, une source contrôlée et l’éligibilité vérifiée. Une
        transcription incertaine peut être conservée sans rapprochement. Les
        références sont gérées dans l’onglet Vaccinations.
      </p>
      <label>
        Notes
        <textarea
          name="notes"
          maxLength={2000}
          rows={3}
          defaultValue={data?.notes ?? ""}
        />
      </label>
      <label>
        Justification si une administration distincte est maintenue malgré un
        doublon potentiel
        <textarea
          name="duplicate_override_reason"
          minLength={10}
          maxLength={1000}
          rows={3}
          defaultValue=""
        />
      </label>
      <p className="fine">
        Utilisez le contrôle des doublons avant d’enregistrer. Le serveur
        contrôle à nouveau au moment de la saisie et conserve les événements
        concernés et votre motif.
      </p>
    </>
  );
}
