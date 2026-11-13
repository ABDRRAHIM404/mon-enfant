import type { RoutineAge } from "./calendar";
export type CatalogPermissions = { manage: boolean; review: boolean };
export type CatalogVersion = {
  id: string;
  parent_id: string | null;
  label: string;
  status: "draft" | "approved" | "retired";
  revision: number;
  created_by: string | null;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reference: string | null;
  review_verified: boolean;
};
export type CatalogRule = {
  version_id: string;
  dose_code: string;
  vaccine_code: string;
  source_row: Record<string, unknown>;
  source_age: RoutineAge;
  age: RoutineAge;
  eligibility: "all" | "female";
  automatic_scheduling: boolean;
};
export type CatalogSnapshot = CatalogVersion & {
  source_sha256: string;
  source_document: Record<string, unknown>;
  rules: CatalogRule[];
};
export type CatalogChange = {
  id: string;
  actor_id: string;
  action: "clone" | "edit" | "approve" | "retire";
  revision: number;
  reason: string;
  evidence_reference: string;
  created_at: string;
  snapshot: CatalogSnapshot;
};
export const catalogStatus = {
  draft: "Brouillon — non activé",
  approved: "Approuvée",
  retired: "Retirée",
};
export function ageLabel(age: RoutineAge): string {
  if (age.unit === "first_4_weeks")
    return "Fenêtre des quatre premières semaines";
  return `${age.value} ${{ weeks: "semaines", months: "mois calendaires", years: "ans" }[age.unit]}`;
}
