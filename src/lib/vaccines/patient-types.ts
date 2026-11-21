import type { CatalogRule } from "./types";
export type VaccineItemChange = {
  id: string;
  revision: number;
  state: "active" | "withdrawn";
  actor_id: string;
  professional_id: string;
  facility_id: string;
  reason: string;
  created_at: string;
};
export type VaccineItemExport = {
  id: string;
  child_id: string;
  version_id: string;
  dose_code: string;
  professional_id: string;
  facility_id: string;
  created_at: string;
  version_label: string;
  version_status: "draft" | "approved" | "retired";
  review_verified: boolean;
  rule: CatalogRule;
  changes: VaccineItemChange[];
};
export type PatientVaccineItem = Omit<VaccineItemExport, "rule" | "changes"> &
  CatalogRule & {
    state: "active" | "withdrawn";
    revision: number;
    documented_entries: {
      id: string;
      root_id: string;
      professional_id: string;
      occurred_on: string;
    }[];
  };
export type VaccinationConflict = {
  id: string;
  root_id: string;
  professional_id: string;
  occurred_on: string | null;
  vaccine_label: string;
  dose_label: string;
};
export const vaccinationDetails = [
  { status: "lot_status", field: "lot_number", label: "Numéro du lot" },
  { status: "site_status", field: "site", label: "Site d’administration" },
  {
    status: "provider_status",
    field: "administered_by",
    label: "Professionnel ayant administré le vaccin",
  },
  {
    status: "administration_facility_status",
    field: "administration_facility",
    label: "Lieu réel d’administration",
  },
] as const;

export const vaccinationFields = [
  "vaccine_code",
  "vaccine_label",
  "dose_label",
  "lot_status",
  "lot_number",
  "site_status",
  "site",
  "provider_status",
  "administered_by",
  "administration_facility_status",
  "administration_facility",
  "matching_status",
  "schedule_item_id",
  "duplicate_override_reason",
  "notes",
] as const;
