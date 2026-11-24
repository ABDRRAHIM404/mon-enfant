export type ClinicalAttributions = Record<
  string,
  {
    name: string;
    role: "doctor" | "nurse";
    verified: boolean;
  }
>;

export function clinicianName(
  labels: ClinicalAttributions,
  key: string | null | undefined,
) {
  const label = key && Object.hasOwn(labels, key) ? labels[key] : null;
  return label
    ? `${label.name} — ${label.role === "nurse" ? "Infirmier(e)" : "Médecin"}`
    : "Nom du professionnel indisponible";
}
