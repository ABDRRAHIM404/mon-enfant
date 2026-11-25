import { clinicianName } from "@/lib/clinical/attribution";
import { readClinicalAttributions } from "@/lib/clinical/read-attribution";
import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireApprovedDoctor } from "@/lib/auth";
import { AppointmentCard } from "@/components/appointments/card";
import { AppointmentForm } from "@/components/appointments/form";
import {
  appointmentTime,
  readableAppointmentDate,
} from "@/lib/appointments/calendar";
import type { AppointmentHistory } from "@/lib/appointments/types";
import { uuidPattern } from "@/lib/registry/types";
export const dynamic = "force-dynamic";
const actions: Record<string, string> = {
  created: "Planification",
  rescheduled: "Replanification manuelle",
  missed: "Créneau passé sans disposition",
  cancelled: "Annulation",
  completed: "Visite déclarée réalisée",
};
export default async function History({
  params,
}: {
  params: Promise<{ id: string; appointment: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { id, appointment } = await params;
  if (!uuidPattern.test(id) || !uuidPattern.test(appointment)) notFound();
  const [history, caps] = await Promise.all([
    supabase.rpc("appointment_history", {
      p_child_id: id,
      p_appointment_id: appointment,
    }),
    supabase.rpc("my_clinical_capabilities"),
  ]);
  if (history.error?.code === "42501") notFound();
  if (history.error || caps.error)
    throw new Error(
      "Impossible de charger l’historique complet du rendez-vous.",
    );
  const data = history.data as AppointmentHistory;
  const attributions = await readClinicalAttributions(
    supabase,
    [
      data.appointment.professional_id,
      data.appointment.documentation?.professional_id,
      ...data.events.map((event) => event.professional_id),
    ],
    { children: [id] },
  );
  return (
    <>
      <div className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          Historique du rendez-vous
        </h1>
        <p className="muted">
          Chaque décision conserve son auteur, son motif et l’ancien créneau.
        </p>
      </div>
      <Link className="text-link" href={`/patients/${id}/appointments`}>
        Rendez-vous de l’enfant
      </Link>
      <h2>Rendez-vous actuel</h2>
      <AppointmentCard
        appointment={data.appointment}
        link={false}
        attributions={attributions}
      />
      {data.appointment.recommended_on && (
        <div className="notice">
          <p>
            Date recommandée par le PNI :{" "}
            <time dateTime={data.appointment.recommended_on}>
              {readableAppointmentDate(data.appointment.recommended_on)}
            </time>
          </p>
          <p>Doses prévues : {data.appointment.dose_codes?.join(", ")}</p>
        </div>
      )}
      {data.events.map((event) => (
        <article className="panel" key={event.id}>
          <h2>
            Révision {event.revision} — {actions[event.action] || event.action}
          </h2>
          {event.previous_starts_at && (
            <p>
              Ancien créneau : {appointmentTime(event.previous_starts_at)} →{" "}
              {appointmentTime(event.previous_ends_at!)}
            </p>
          )}
          <p>
            Créneau : {appointmentTime(event.starts_at)} →{" "}
            {appointmentTime(event.ends_at)}
          </p>
          <p>{event.reason}</p>
          <p className="fine">
            {clinicianName(attributions, event.professional_id)} · décision
            enregistrée le {event.recorded_at}
          </p>
        </article>
      ))}
      <section className="panel">
        {data.appointment.is_mine &&
        (caps.data as string[]).includes("appointment") ? (
          <AppointmentForm
            childId={id}
            operationId={randomUUID()}
            previous={data.appointment}
          />
        ) : (
          <p className="notice">
            Seul le soignant responsable, avec une habilitation active, peut
            modifier ce rendez-vous. Un autre soignant autorisé peut documenter
            les soins dans le dossier clinique.
          </p>
        )}
      </section>
    </>
  );
}
