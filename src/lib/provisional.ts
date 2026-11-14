export type ProvisionalChild = {
  id: string;
  owner_id: string;
  identity: Record<string, string>;
  author_role: "doctor" | "nurse";
  account_status: string;
  validation_state: "unverified";
  created_at: string;
};
export type ProvisionalEntry = {
  id: string;
  root_id: string;
  revision: number;
  previous_id: string | null;
  child_id: string;
  kind: string;
  occurred_on: string | null;
  occurrence_precision: string;
  source_type: string;
  source_reference: string | null;
  payload: Record<string, string | number>;
  entry_state: string;
  reason: string | null;
  owner_id: string;
  author_role: string;
  account_status: string;
  validation_state: "unverified";
  recorded_at: string;
};
export const provisionalKinds = {
  consultation: "Consultation",
  prescription: "Prescription / traitement",
  risk: "Risque / allergie",
  growth: "Croissance",
  vaccination: "Vaccination / historique",
  appointment: "Rendez-vous",
} as const;
export const provisionalFields: Record<
  string,
  { key: string; label: string; required?: boolean; type?: string }[]
> = {
  consultation: [
    { key: "reason", label: "Motif", required: true },
    { key: "findings", label: "Constatations" },
    { key: "assessment", label: "Évaluation" },
    { key: "plan", label: "Plan" },
  ],
  prescription: [
    { key: "medication", label: "Traitement", required: true },
    { key: "instructions", label: "Instructions", required: true },
    { key: "duration", label: "Durée" },
  ],
  risk: [{ key: "description", label: "Description", required: true }],
  growth: [
    { key: "weight_kg", label: "Poids (kg)", type: "number" },
    { key: "height_cm", label: "Taille (cm)", type: "number" },
    { key: "head_cm", label: "Périmètre crânien (cm)", type: "number" },
  ],
  vaccination: [
    { key: "vaccine_label", label: "Vaccin", required: true },
    { key: "dose_label", label: "Dose déclarée", required: true },
    { key: "lot_number", label: "Lot (si connu)" },
    { key: "site", label: "Site (si connu)" },
    { key: "administered_by", label: "Soignant ayant administré (si connu)" },
    {
      key: "administration_facility",
      label: "Lieu d’administration (si connu)",
    },
    { key: "notes", label: "Notes" },
  ],
  appointment: [
    { key: "purpose", label: "Objet", required: true },
    {
      key: "scheduled_for",
      label: "Date et heure avec décalage UTC (ex. 2026-12-01T09:00+01:00)",
      required: true,
    },
    { key: "notes", label: "Notes" },
  ],
};
