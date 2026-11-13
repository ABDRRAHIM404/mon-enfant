export const clinicalKinds = [
  "consultation",
  "prescription",
  "risk",
  "growth",
  "vaccination",
] as const;
export type ClinicalKind = (typeof clinicalKinds)[number];
export const clinicalLabels: Record<ClinicalKind, string> = {
  consultation: "Consultation",
  prescription: "Prescription / traitement",
  risk: "Risque / allergie",
  growth: "Mesures de croissance",
  vaccination: "Vaccination",
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
  vaccine_mapping?: {
    item_id: string;
    version_id: string;
    version_label: string;
    dose_code: string;
    source_age: unknown;
    configured_age: unknown;
  } | null;
  duplicate_review?: { conflicting_entry_ids: string[]; reason: string } | null;
};
export const clinicalFieldLabels: Record<string, string> = {
  vaccine_code: "Code vaccin",
  vaccine_label: "Vaccin",
  dose_label: "Dose déclarée",
  lot_status: "Lot : certitude",
  lot_number: "Numéro du lot",
  site_status: "Site : certitude",
  site: "Site d’administration",
  provider_status: "Professionnel administrateur : certitude",
  administered_by: "Professionnel ayant administré",
  administration_facility_status: "Lieu d’administration : certitude",
  administration_facility: "Lieu d’administration",
  matching_status: "Rapprochement avec une référence",
  schedule_item_id: "Identifiant de la référence",
  duplicate_override_reason: "Motif de maintien malgré le doublon potentiel",
  notes: "Notes",
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
  known: "Connu",
  not_applicable: "Sans objet",
  unmatched: "Non rapprochée — ne valide aucune référence",
  clinician_validated: "Rapprochement validé par le clinicien",
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
