export type Facility = { id: string; name: string; city: string };
export type Register = {
  facility_id: string;
  facility_name: string;
  year: number;
  book: string;
  number: string;
  smi_reference?: string | null;
};
export type Patient = {
  id: string;
  universal_id: string;
  given_name: string | null;
  family_name: string | null;
  name_status: string;
  birth_date: string | null;
  birth_date_precision: string;
  sex: string;
  history_status: string;
  source_type: string;
  last_documented_care?: string | null;
  next_own_appointment?: { starts_at: string } | null;
  registers: Register[];
};
export type ChildProfile = Patient & {
  can_manage_access: boolean;
  created_by_professional_id: string;
  paper_reference: string | null;
  provenance_note: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
};
export type AccessRequest = {
  id: string;
  requested_universal_id: string;
  status: string;
  reason: string;
  decision_reason: string | null;
  number: string;
  book: string;
  year: number;
  child_id: string | null;
};
export type PendingRequest = {
  id: string;
  child_id: string;
  universal_id: string;
  child_name: string;
  requester_professional_id: string;
  facility_name: string;
  reason: string;
  number: string;
  book: string;
  year: number;
};
export type AccessGrant = {
  professional_id: string;
  platform_id: string;
  can_manage_access: boolean;
  revoked_at: string | null;
  expires_at: string | null;
  is_self: boolean;
};
export const historyLabels: Record<string, string> = {
  unknown: "Historique inconnu",
  partial: "Historique partiel",
  reviewed: "Historique déclaré revu",
};
export function patientName(
  patient: Pick<Patient, "given_name" | "family_name">,
) {
  return (
    [patient.given_name, patient.family_name].filter(Boolean).join(" ") ||
    "Identité inconnue"
  );
}
export function birthLabel(
  patient: Pick<Patient, "birth_date" | "birth_date_precision">,
) {
  return patient.birth_date
    ? `${patient.birth_date}${patient.birth_date_precision === "estimated" ? " (estimée)" : ""}`
    : "Date inconnue";
}
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type ParentChildIntake = {
  given_name: string;
  family_name: string;
  birth_date: string;
};
