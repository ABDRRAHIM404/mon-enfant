import type { VaccineItemExport } from "./patient-types";
export type VaccineChoice = {
  version_id: string;
  version_label: string;
  status: "draft" | "approved" | "retired";
  vaccine_code: string;
  vaccine_label: string;
  dose_code: string;
};
export const vaccineKey = (c: VaccineChoice) =>
  `${c.version_id}:${c.vaccine_code}`;
export function vaccineOptions(choices: VaccineChoice[]) {
  return Array.from(
    new Map(
      choices.map((c) => [
        vaccineKey(c),
        {
          value: vaccineKey(c),
          label: `${c.vaccine_label} · ${c.vaccine_code}`,
          detail: `${c.version_label} — ${c.status === "approved" ? "catalogue approuvé" : c.status === "retired" ? "version retirée — historique" : "brouillon non validé"}`,
        },
      ]),
    ).values(),
  );
}
export function readVaccineSelection(form: FormData, choices: VaccineChoice[]) {
  const value = (key: string) => String(form.get(key) ?? "");
  const selected = value("vaccine_choice"),
    dose = value("dose_choice");
  const row = choices.find((c) => vaccineKey(c) === selected);
  if (!row && selected !== "other")
    throw new Error("Choisissez un vaccin dans la liste ou Autre (préciser).");
  const vaccineLabel = row?.vaccine_label ?? value("vaccine_label");
  const doseLabel =
    dose === "unknown"
      ? "Dose inconnue / non précisée"
      : dose === "other"
        ? value("dose_label")
        : choices.find(
            (c) => vaccineKey(c) === selected && c.dose_code === dose,
          )?.dose_code;
  if (
    !vaccineLabel.trim() ||
    vaccineLabel.length > 200 ||
    !doseLabel?.trim() ||
    doseLabel.length > 100
  )
    throw new Error(
      "Précisez le nom du vaccin et la dose, ou choisissez Dose inconnue.",
    );
  return {
    vaccine_label: vaccineLabel,
    vaccine_code: row?.vaccine_code ?? (value("vaccine_code") || "OTHER"),
    dose_label: doseLabel,
    ...(row
      ? {
          catalog_version_id: row.version_id,
          catalog_status: row.status,
          ...(dose !== "unknown" && dose !== "other"
            ? { dose_code: dose }
            : {}),
        }
      : {}),
  };
}

// A child's retained, reviewed version remains usable for historical entry even
// after retirement. This is vocabulary, never a new active schedule assignment.
export function choicesWithRecordVersions(
  choices: VaccineChoice[],
  items: VaccineItemExport[],
): VaccineChoice[] {
  return Array.from(
    new Map(
      [
        ...choices,
        ...items
          .filter((item) => item.review_verified)
          .map((item) => ({
            version_id: item.version_id,
            version_label: item.version_label,
            status: item.version_status,
            vaccine_code: item.rule.vaccine_code,
            vaccine_label:
              choices.find(
                (choice) => choice.vaccine_code === item.rule.vaccine_code,
              )?.vaccine_label ?? item.rule.vaccine_code,
            dose_code: item.dose_code,
          })),
      ].map((choice) => [`${vaccineKey(choice)}:${choice.dose_code}`, choice]),
    ).values(),
  );
}

export function doseChoiceLabel(code: string) {
  const number = code.match(/(\d+)$/)?.[1];
  return number ? `Dose ${number} · ${code}` : `Dose du catalogue · ${code}`;
}
