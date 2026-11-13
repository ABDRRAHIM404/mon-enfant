import Link from "next/link";
import { appointmentTime } from "@/lib/appointments/calendar";
import {
  appointmentStates,
  type AppointmentRow,
} from "@/lib/appointments/types";
export function AppointmentCard({
  appointment,
  link = true,
}: {
  appointment: AppointmentRow;
  link?: boolean;
}) {
  const a = appointment;
  return (
    <article className="panel">
      <h3>{a.purpose_label}</h3>
      <p>
        {[a.child_given_name, a.child_family_name].filter(Boolean).join(" ") ||
          "Identité inconnue"}{" "}
        · {appointmentStates[a.effective_state]}
      </p>
      <p>
        {appointmentTime(a.starts_at)} → {appointmentTime(a.ends_at)}
      </p>
      <p className="fine">
        Responsable : {a.professional_id} · {a.facility_name}
        {a.dose_code ? ` · ${a.dose_code} · ${a.version_label}` : ""}
      </p>
      {a.effective_state === "dose_documented" && a.documentation && (
        <div className="notice">
          <p>
            Dose enregistrée par {a.documentation.professional_id} le{" "}
            {a.documentation.occurred_on}. La présence au rendez-vous initial
            n’est pas établie par ce rapprochement.
          </p>
          <Link
            className="text-link"
            href={`/patients/${a.child_id}/records/${a.documentation.root_id}`}
          >
            Voir l’administration et ses révisions
          </Link>
        </div>
      )}
      {a.effective_state === "missed" && (
        <p className="fine">
          Le créneau est passé sans disposition enregistrée. Cela ne confirme
          pas une dose manquée ; vérifiez les preuves avant de choisir une
          nouvelle date.
        </p>
      )}
      {link && (
        <Link
          className="text-link"
          href={`/patients/${a.child_id}/appointments/${a.id}`}
        >
          {a.is_mine
            ? "Historique et décision / replanifier"
            : "Voir l’historique"}
        </Link>
      )}
    </article>
  );
}
