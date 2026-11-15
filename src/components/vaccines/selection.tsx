"use client";
import { useState } from "react";
import { SearchSelect } from "@/components/forms/search-select";
import {
  vaccineKey,
  doseChoiceLabel,
  vaccineOptions,
  type VaccineChoice,
} from "@/lib/vaccines/choices";
export function VaccineSelection({
  choices,
  previous,
  onSelectionChange,
}: {
  choices: VaccineChoice[];
  previous?: Record<string, string | number>;
  onSelectionChange?: (choice: VaccineChoice | null, dose: string) => void;
}) {
  // Preserve previously documented wording, even when it differs from today's vocabulary.
  const old = choices.find(
    (c) =>
      !!previous?.catalog_version_id &&
      c.vaccine_label === previous?.vaccine_label &&
      (!previous?.vaccine_code || c.vaccine_code === previous.vaccine_code) &&
      (!previous?.catalog_version_id ||
        c.version_id === previous.catalog_version_id),
  );
  const [vaccine, setVaccine] = useState(
    old ? vaccineKey(old) : previous?.vaccine_label ? "other" : "",
  );
  const [dose, setDose] = useState(
    old &&
      choices.some(
        (c) =>
          vaccineKey(c) === vaccineKey(old) &&
          c.dose_code === previous?.dose_label,
      )
      ? String(previous?.dose_label)
      : previous?.dose_label === "Dose inconnue / non précisée"
        ? "unknown"
        : previous?.dose_label
          ? "other"
          : previous
            ? "unknown"
            : "",
  );
  const current = choices.find((c) => vaccineKey(c) === vaccine);
  return (
    <>
      <SearchSelect
        name="vaccine_choice"
        label="Vaccin"
        required
        value={vaccine}
        options={[
          ...vaccineOptions(choices),
          { value: "other", label: "Autre (préciser)" },
        ]}
        help={
          choices.length
            ? "Rechercher par nom français ou code. Le statut et la version du catalogue restent indiqués."
            : "Aucun catalogue disponible. Utilisez Autre pour conserver la source sans rapprochement."
        }
        onChange={(value) => {
          setVaccine(value);
          setDose("");
          onSelectionChange?.(
            choices.find((c) => vaccineKey(c) === value) ?? null,
            "",
          );
        }}
      />
      {vaccine === "other" && (
        <label>
          Nom du vaccin (obligatoire)
          <input
            name="vaccine_label"
            required
            maxLength={200}
            defaultValue={String(previous?.vaccine_label ?? "")}
          />
        </label>
      )}
      {vaccine === "other" && previous?.vaccine_code && (
        <input
          type="hidden"
          name="vaccine_code"
          value={String(previous.vaccine_code)}
        />
      )}
      <SearchSelect
        name="dose_choice"
        label="Dose déclarée"
        required
        value={dose}
        options={[
          ...(current
            ? choices
                .filter((c) => vaccineKey(c) === vaccine)
                .map((c) => ({
                  value: c.dose_code,
                  label: doseChoiceLabel(c.dose_code),
                  detail: "Identifiant de dose du catalogue sélectionné",
                }))
            : []),
          { value: "unknown", label: "Dose inconnue / non précisée" },
          { value: "other", label: "Autre (préciser)" },
        ]}
        onChange={(value) => {
          setDose(value);
          onSelectionChange?.(current ?? null, value);
        }}
        help="Un choix ne confirme ni l’administration ni une règle clinique. Toute dose non documentée reste inconnue."
      />
      {dose === "other" && (
        <label>
          Dose à préciser (obligatoire)
          <input
            name="dose_label"
            maxLength={100}
            required
            defaultValue={String(previous?.dose_label ?? "")}
          />
        </label>
      )}
      {current && (
        <p className="fine">
          {current.version_label} ·{" "}
          {current.status === "approved"
            ? "Catalogue approuvé ; cette saisie nécessite toujours ses contrôles propres."
            : "Référence non active / non validée pour la planification."}
        </p>
      )}
    </>
  );
}
