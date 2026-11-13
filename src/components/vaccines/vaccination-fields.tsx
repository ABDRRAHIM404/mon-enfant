import type { ClinicalEntry } from "@/lib/clinical/types";
import type { VaccineItemExport } from "@/lib/vaccines/patient-types";
export function VaccinationFields({
  previous,
  items,
}: {
  previous?: ClinicalEntry;
  items: VaccineItemExport[];
}) {
  const data = previous?.payload;
  function text(
    name: string,
    label: string,
    required = false,
    maxLength = 200,
  ) {
    return (
      <label>
        {label}
        <input
          name={name}
          defaultValue={data?.[name] ?? ""}
          maxLength={maxLength}
          required={required}
        />
      </label>
    );
  }
  function known(status: string, value: string, label: string, lot = false) {
    return (
      <div className="form-grid">
        <label>
          {label} : certitude
          <select name={status} defaultValue={data?.[status] ?? "unknown"}>
            <option value="unknown">Inconnu — laisser la valeur vide</option>
            <option value="known">Connu — renseigner la valeur</option>
            {lot && (
              <option value="not_applicable">
                Sans objet — laisser la valeur vide
              </option>
            )}
          </select>
        </label>
        {text(value, label)}
      </div>
    );
  }
  return (
    <>
      <h2>Administration documentée</h2>
      {text(
        "vaccine_code",
        "Code vaccin (ex. VPO, Penta, PCV, Rota)",
        true,
        32,
      )}
      {text("vaccine_label", "Nom du vaccin tel que documenté", true)}
      {text("dose_label", "Dose déclarée dans la source (si connue)")}
      {known("lot_status", "lot_number", "Numéro du lot", true)}
      {known("site_status", "site", "Site d’administration")}
      {known(
        "provider_status",
        "administered_by",
        "Professionnel ayant administré le vaccin",
      )}
      {known(
        "administration_facility_status",
        "administration_facility",
        "Lieu réel d’administration",
      )}
      <p className="fine">
        Le professionnel et le lieu d’administration peuvent différer de
        l’auteur de cette transcription. Laissez les éléments inconnus vides.
      </p>
      <h2>Rapprochement clinique</h2>
      <label>
        Décision de rapprochement
        <select
          name="matching_status"
          defaultValue={data?.matching_status ?? "unmatched"}
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
          defaultValue={data?.schedule_item_id ?? ""}
        >
          <option value="">Aucune — conserver non rapprochée</option>
          {items.map((item) => (
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
