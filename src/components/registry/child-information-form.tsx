"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateChildInformation } from "@/app/(soignant)/(verified)/patients/actions";
import { FrenchDateInput } from "@/components/appointments/french-date-input";
import { RegistryFilterSelect } from "@/components/clinician/registry-filter-select";
import type { ChildProfile, Facility, Register } from "@/lib/registry/types";

export function ChildInformationForm({
  child,
  register,
  facilities,
  operationId,
  today,
}: {
  child: ChildProfile;
  register?: Register;
  facilities: Facility[];
  operationId: string;
  today: string;
}) {
  const [state, action, pending] = useActionState(updateChildInformation, {});
  return (
    <form
      action={action}
      className="auth-form registration-form"
      aria-busy={pending}
      onReset={(event) => event.preventDefault()}
    >
      <input type="hidden" name="childId" value={child.id} />
      <input type="hidden" name="operationId" value={operationId} />
      <input type="hidden" name="revision" value={child.profile_revision} />
      <input type="hidden" name="registerId" value={register?.id ?? ""} />
      <fieldset disabled={pending}>
        <fieldset className="registration-group">
          <legend>Identité de l’enfant</legend>
          <div className="registration-fields">
            <label>
              Prénom
              <input
                name="given_name"
                defaultValue={child.given_name ?? ""}
                maxLength={100}
              />
            </label>
            <label>
              Nom
              <input
                name="family_name"
                defaultValue={child.family_name ?? ""}
                maxLength={100}
              />
            </label>
            <FrenchDateInput
              name="birth_date"
              label="Date de naissance"
              date={child.birth_date ?? undefined}
              min="1900-01-01"
              max={today}
              required={false}
            />
            <RegistryFilterSelect
              name="birth_date_precision"
              label="Certitude de la naissance"
              defaultValue={child.birth_date_precision}
              options={[
                { value: "exact", label: "Date exacte" },
                { value: "estimated", label: "Date estimée" },
                { value: "unknown", label: "Date inconnue" },
              ]}
            />
            <RegistryFilterSelect
              name="sex"
              label="Sexe"
              defaultValue={child.sex}
              options={[
                { value: "male", label: "Garçon" },
                { value: "female", label: "Fille" },
                { value: "unknown", label: "Inconnu" },
              ]}
            />
            <RegistryFilterSelect
              name="name_status"
              label="Certitude de l’identité"
              defaultValue={child.name_status}
              options={[
                { value: "confirmed", label: "Noms confirmés" },
                { value: "provisional", label: "Noms provisoires" },
                { value: "unknown", label: "Noms inconnus" },
              ]}
            />
          </div>
        </fieldset>
        <fieldset className="registration-group">
          <legend>Registre et lieu d’exercice</legend>
          <p className="fine">
            Pour attribuer une référence locale, renseignez les quatre champs du
            registre ensemble.
          </p>
          <div className="registration-fields">
            <RegistryFilterSelect
              name="facility_id"
              label="Lieu d’exercice"
              defaultValue={register?.facility_id ?? ""}
              options={[
                { value: "", label: "Choisir un lieu d’exercice" },
                ...facilities.map(({ id, name, city }) => ({
                  value: id,
                  label: city ? `${name} — ${city}` : name,
                })),
                ...(register &&
                !facilities.some(
                  (facility) => facility.id === register.facility_id,
                )
                  ? [
                      {
                        value: register.facility_id,
                        label: register.facility_name,
                      },
                    ]
                  : []),
              ]}
            />
            <label>
              Année du registre
              <input
                name="register_year"
                type="number"
                min={1900}
                max={2200}
                defaultValue={register?.year}
              />
            </label>
            <label>
              Livre / série du registre
              <input
                name="register_book"
                maxLength={100}
                defaultValue={register?.book}
              />
            </label>
            <label>
              Numéro local
              <input
                name="local_number"
                maxLength={100}
                defaultValue={register?.number}
              />
            </label>
            <label>
              Référence SMI locale (facultative)
              <input
                name="smi_reference"
                maxLength={100}
                defaultValue={register?.smi_reference ?? ""}
              />
            </label>
          </div>
        </fieldset>
        <fieldset className="registration-group">
          <legend>Historique et provenance</legend>
          <RegistryFilterSelect
            name="history_status"
            label="État de l’historique disponible"
            defaultValue={child.history_status}
            options={[
              { value: "unknown", label: "Inconnu" },
              { value: "partial", label: "Partiel" },
              { value: "reviewed", label: "Déclaré revu par le professionnel" },
            ]}
          />
          {child.source_type === "paper_transcription" && (
            <label>
              Référence du document papier
              <input
                name="paper_reference"
                required
                maxLength={200}
                defaultValue={child.paper_reference ?? ""}
              />
            </label>
          )}
          <label>
            Provenance et limites connues
            <textarea
              name="provenance_note"
              rows={2}
              maxLength={2000}
              defaultValue={child.provenance_note ?? ""}
            />
          </label>
        </fieldset>
        <fieldset className="registration-group">
          <legend>Contact déclaré</legend>
          <div className="registration-fields">
            <label>
              Contact de soins (facultatif)
              <input
                name="guardian_name"
                maxLength={150}
                defaultValue={child.guardian_name ?? ""}
              />
            </label>
            <label>
              Téléphone (facultatif)
              <input
                name="guardian_phone"
                type="tel"
                maxLength={25}
                defaultValue={child.guardian_phone ?? ""}
              />
            </label>
          </div>
          <p className="fine">
            Ces coordonnées ne donnent aucun accès au carnet.
          </p>
        </fieldset>
      </fieldset>
      {state.error && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      <button className="button primary" disabled={pending}>
        <Save size={18} aria-hidden="true" />{" "}
        {pending ? "Enregistrement…" : "Enregistrer les modifications"}
      </button>
    </form>
  );
}
