import type { ClinicalEntry } from "../clinical/types";
import type { AppointmentRow } from "../appointments/types";
export type ParentChild = {
  id: string;
  universal_id: string;
  given_name: string | null;
  family_name: string | null;
  name_status: string;
  birth_date: string | null;
  birth_date_precision: string;
  sex: string;
  history_status: string;
};
export type GuardianLink = {
  id: string;
  relationship: string;
  expires_at: string;
  can_export: boolean;
};
export type ParentWorkspaceData = {
  profile: { display_name: string } | null;
  children: (ParentChild & Omit<GuardianLink, "id"> & { link_id: string })[];
  claims: { id: string; state: string; created_at: string }[];
};
export type ParentBooklet = {
  child: ParentChild;
  link: GuardianLink;
  entries: ClinicalEntry[];
  growth: ClinicalEntry[];
  appointments: AppointmentRow[];
  entry_total: number;
  appointment_total: number;
  page: number;
};

export type ParentSettings = {
  contact_phone: string | null;
  email_updates: boolean;
  reminder_days: number;
  updated_at?: string;
};
export type CorrectionRequest = {
  id: string;
  child_id: string;
  guardian_display_name: string;
  category: string;
  entry_id: string | null;
  root_id: string | null;
  entry_revision: number | null;
  message: string;
  created_at: string;
  child_given_name: string | null;
  child_family_name: string | null;
  universal_id: string;
  correction_options: {
    id: string;
    revision: number;
    recorded_at: string;
    entry_state: string;
  }[];
  response: null | {
    id: string;
    outcome: string;
    message: string;
    professional_id: string | null;
    correction_entry_id: string | null;
    created_at: string;
  };
};
export type CorrectionPage = {
  items: CorrectionRequest[];
  total: number;
  page: number;
};
export const correctionCategories: Record<string, string> = {
  clinical: "Information clinique",
  identity: "Identité de l’enfant",
  access: "Accès au carnet",
  other: "Autre question",
};
export const correctionOutcomes: Record<string, string> = {
  answered: "Réponse du professionnel",
  rejected: "Correction refusée avec explication",
  corrected: "Amendement clinique enregistré",
  withdrawn: "Demande retirée par son auteur",
};

export type ParentUpdates = {
  items: {
    id: string;
    kind: string;
    child_id: string | null;
    given_name: string | null;
    family_name: string | null;
    occurred_at: string;
    clinical_kind: string | null;
    revision: number | null;
    unread: boolean;
  }[];
  total: number;
  unread_total: number;
  page: number;
  generated_at: string;
  read_through: string | null;
};
