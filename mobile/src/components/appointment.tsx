import { Card, Copy, Title } from "./ui";
import { appointmentStates, type AppointmentRow } from "../lib/domain";
import { instant } from "../lib/format";
export function Appointment({ item }: { item: AppointmentRow }) {
  return (
    <Card>
      <Title small>{item.purpose_label}</Title>
      <Copy>
        {instant(item.starts_at)} · {appointmentStates[item.effective_state]}
      </Copy>
      <Copy muted>
        {item.facility_name} · {item.professional_id}
      </Copy>
      {item.effective_state === "dose_documented" && (
        <Copy>
          Une administration documentée est enregistrée. Le rendez-vous reste
          distinct du soin.
        </Copy>
      )}
      {item.effective_state === "missed" && (
        <Copy>
          Un rendez-vous passé ne prouve pas une dose vaccinale manquée.
        </Copy>
      )}
    </Card>
  );
}
