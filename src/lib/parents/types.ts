import type { ClinicalEntry } from "@/lib/clinical/types";
import type { AppointmentRow } from "@/lib/appointments/types";
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
