export type AppointmentDocumentation = {
  entry_id: string;
  root_id: string;
  author_id: string;
  professional_id: string;
  facility_id: string;
  occurred_on: string;
  active_count: number;
};
export type AppointmentState =
  | "scheduled"
  | "missed"
  | "cancelled"
  | "completed"
  | "dose_documented"
  | "reference_review";
export type AppointmentRow = {
  id: string;
  child_id: string;
  responsible_id: string;
  professional_id: string;
  facility_id: string;
  facility_name: string;
  purpose: "consultation" | "vaccination" | "other";
  purpose_label: string;
  vaccine_item_id: string | null;
  revision: number;
  state: string;
  effective_state: AppointmentState;
  starts_at: string;
  ends_at: string;
  starts_on: string;
  reason: string;
  event_recorded_at: string;
  is_mine: boolean;
  documentation: AppointmentDocumentation | null;
  recorded_by_other: boolean;
  was_missed: boolean;
  child_given_name: string | null;
  child_family_name: string | null;
  child_sex?: string;
  recommended_on?: string | null;
  dose_codes?: string[] | null;
  universal_id: string;
  history_status: string;
  dose_code: string | null;
  version_id: string | null;
  version_label: string | null;
};
export type AppointmentEvent = {
  id: string;
  revision: number;
  action: string;
  state: string;
  starts_at: string;
  ends_at: string;
  previous_starts_at: string | null;
  previous_ends_at: string | null;
  professional_id: string;
  reason: string;
  recorded_at: string;
};
export type AppointmentHistory = {
  appointment: AppointmentRow;
  events: AppointmentEvent[];
};
export type AppointmentPage = {
  items: AppointmentRow[];
  total: number;
  page: number;
  generated_at?: string;
  counts: Record<string, number>;
};
export type AppointmentOption = {
  id: string;
  dose_code: string;
  vaccine_code: string;
  version_id: string;
  version_label: string;
  version_status: string;
  active: boolean;
  reference: {
    state: string;
    start_on: string | null;
    end_on: string | null;
    is_window: boolean;
  };
  documentation: AppointmentDocumentation | null;
};
export const appointmentStates: Record<AppointmentState, string> = {
  scheduled: "Planifié",
  missed: "Rendez-vous passé sans disposition — à revoir",
  cancelled: "Annulé",
  completed: "Visite déclarée réalisée",
  dose_documented: "Dose documentée — suivi vaccinal résolu",
  reference_review: "Référence ou éligibilité à réexaminer",
};
export const appointmentBuckets = {
  today: "Aujourd’hui",
  upcoming: "À venir",
  missed: "Rendez-vous passés à revoir",
  missed_vaccinations: "Rendez-vous vaccinaux manqués",
  resolved_by_other: "Dose enregistrée par un autre soignant",
  reference_review: "Références à réexaminer",
  all: "Tous mes rendez-vous",
};
export const vaccineFollowupStates = {
  potentially_overdue_unconfirmed:
    "Référence potentiellement dépassée — administration non confirmée",
  routine_due: "Référence de routine dans les 30 jours",
  routine_future: "Référence de routine future",
  reference_review: "Référence ou données à réexaminer",
  documented: "Administration documentée et rapprochée",
};

export type RoutineAppointmentProposals = {
  version: string | null;
  preview: boolean;
  total: number;
  items: RoutineAppointmentProposal[];
};

export type RoutineAppointmentProposal = {
  child_id: string;
  given_name: string | null;
  family_name: string | null;
  sex: string;
  birth_date: string;
  recommended_on: string;
  doses: { code: string; label: string }[];
  requires_assignment: boolean;
};

export type AppointmentWorkspace = {
  appointments: Pick<AppointmentPage, "items" | "total">;
  proposals: RoutineAppointmentProposals;
  days: { day: string; appointments: number; proposals: number }[];
};
