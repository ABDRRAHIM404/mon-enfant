// Portable clinical models/calculations are shared with web; no separate mobile schedule or permissions.
export type {
  ParentChild,
  ParentWorkspaceData,
  ParentUpdates,
  CorrectionPage,
  ParentSettings,
} from "../../../src/lib/parents/types";
export type { ClinicalEntry } from "../../../src/lib/clinical/types";
export {
  clinicalLabels,
  clinicalFieldLabels,
  clinicalValueLabels,
  sourceLabels,
} from "../../../src/lib/clinical/types";
export type { AppointmentRow } from "../../../src/lib/appointments/types";
export { appointmentStates } from "../../../src/lib/appointments/types";
export type { PatientVaccineItem } from "../../../src/lib/vaccines/patient-types";
export { ageLabel, catalogStatus } from "../../../src/lib/vaccines/types";
export { routineReference } from "../../../src/lib/vaccines/calendar";

export { growthPoints } from "../../../src/lib/clinical/growth";

import type { ParentBooklet as WebBooklet } from "../../../src/lib/parents/types";
import type { AppointmentRow as WebAppointment } from "../../../src/lib/appointments/types";
export type NativeClock = {
  server_day: string;
  server_now: string;
  timezone: "Africa/Casablanca";
};
export type NativeAppointment = WebAppointment & {
  starts_display: string;
  ends_display: string;
  starts_offset_seconds: number;
};
export type ParentBooklet = Omit<WebBooklet, "appointments"> &
  NativeClock & { appointments: NativeAppointment[] };

export { civilDay } from "../../../src/lib/vaccines/calendar";
