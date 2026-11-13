export const clinicalKinds = [
  "consultation",
  "prescription",
  "risk",
  "growth",
] as const;
export type ClinicalKind = (typeof clinicalKinds)[number];
export const clinicalLabels: Record<ClinicalKind, string> = {
  consultation: "Consultation",
  prescription: "Prescription / traitement",
  risk: "Risque / allergie",
  growth: "Mesures de croissance",
};
export type ClinicalEntry = {
  id: string;
  root_id: string;
  previous_id: string | null;
  revision: number;
  child_id: string;
  kind: ClinicalKind;
  author_id: string;
  professional_id: string;
  facility_id: string;
  facility_name: string;
  occurred_on: string | null;
  occurrence_precision: string;
  source_type: string;
  source_reference: string | null;
  source_verified: boolean;
  payload: Record<string, string | number>;
  entry_state: "active" | "withdrawn";
  amendment_reason: string | null;
  recorded_at: string;
};
export const clinicalFieldLabels: Record<string, string> = {
  reason: "Motif",
  findings: "Observations",
  assessment: "Évaluation",
  plan: "Plan de soins",
  medication: "Médicament / traitement",
  instructions: "Instructions du prescripteur",
  duration: "Durée",
  category: "Catégorie",
  description: "Description",
  severity: "Sévérité déclarée",
  weight_kg: "Poids (kg)",
  height_cm: "Taille (cm)",
  head_cm: "Périmètre crânien (cm)",
};
export const clinicalValueLabels: Record<string, string> = {
  allergy: "Allergie",
  medical: "Médical",
  social: "Social",
  other: "Autre",
  unknown: "Inconnue",
  low: "Faible",
  moderate: "Modérée",
  high: "Élevée",
};
export const sourceLabels: Record<string, string> = {
  observed: "Observé par le professionnel",
  paper_transcription: "Transcription papier",
  reported_history: "Historique rapporté",
};
