import { clinicianName } from "@/lib/clinical/attribution";
import { readClinicalAttributions } from "@/lib/clinical/read-attribution";
import Link from "next/link";
import { AppointmentCard } from "@/components/appointments/card";
import { appointmentTime } from "@/lib/appointments/calendar";
import type {
  AppointmentRow,
  AppointmentEvent,
} from "@/lib/appointments/types";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicalWorkspace } from "@/components/clinician/care-workspace";
import { EntryCard } from "@/components/clinical/entry-card";
import { PrintButton } from "@/components/clinical/print-button";
import type { VaccineItemExport } from "@/lib/vaccines/patient-types";
import type { ClinicalEntry } from "@/lib/clinical/types";
import {
  uuidPattern,
  patientName,
  birthLabel,
  type ChildProfile,
} from "@/lib/registry/types";
export const dynamic = "force-dynamic";
export default async function Summary({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const [profile, ledger, vaccines, appointments] = await Promise.all([
    supabase.rpc("get_child_profile", { p_child_id: id }),
    supabase.rpc("clinical_export", { p_child_id: id }),
    supabase.rpc("vaccine_items_export", { p_child_id: id }),
    supabase.rpc("appointments_export", { p_child_id: id }),
  ]);
  if (
    profile.error?.code === "42501" ||
    ledger.error?.code === "42501" ||
    vaccines.error?.code === "42501" ||
    appointments.error?.code === "42501"
  )
    notFound();
  if (
    ledger.error?.code === "54000" ||
    vaccines.error?.code === "54000" ||
    appointments.error?.code === "54000"
  )
    return (
      <ClinicalWorkspace active="children" childId={id} section="summary" print>
        <section className="panel">
          <h1 id="main-content" tabIndex={-1}>
            Résumé volumineux
          </h1>
          <p>
            La limite interactive de 5 000 révisions est dépassée. Utilisez une
            procédure d’export autorisée avec un périmètre convenu. Aucun résumé
            partiel n’a été généré.
          </p>
        </section>
      </ClinicalWorkspace>
    );
  if (profile.error || ledger.error || vaccines.error || appointments.error)
    throw new Error("Impossible de générer le résumé.");
  const child = profile.data as ChildProfile,
    entries = ledger.data as ClinicalEntry[];
  const vaccineItems = vaccines.data as VaccineItemExport[];
  const appointmentRows = appointments.data as (AppointmentRow & {
    events: AppointmentEvent[];
  })[];
  const attributions = await readClinicalAttributions(
    supabase,
    [
      ...entries.map((entry) => entry.professional_id),
      ...vaccineItems.flatMap((item) =>
        item.changes.map((change) => change.professional_id),
      ),
      ...appointmentRows.flatMap((row) => [
        row.professional_id,
        row.documentation?.professional_id,
        ...row.events.map((event) => event.professional_id),
      ]),
    ],
    { children: [id] },
  );
  return (
    <ClinicalWorkspace active="children" childId={id} section="summary" print>
      <div className="page-heading">
        <span className="eyebrow">RÉSUMÉ CLINIQUE — DONNÉES FICTIVES</span>
        <h1 id="main-content" tabIndex={-1}>
          {patientName(child)}
        </h1>
        <p>
          {birthLabel(child)} · {child.universal_id}
        </p>
        <p className="fine">
          Généré le {new Date().toISOString()} · contient l’original et toutes
          les corrections des soins enregistrés, y compris les retraits. Les
          administrations vaccinales, leurs rapprochements et les décisions sur
          les références sont inclus.
        </p>
      </div>
      <div className="tabs no-print">
        <PrintButton />
        <a href={`/patients/${id}/export`} download>
          Télécharger le relevé JSON
        </a>
        <Link href={`/patients/${id}/records`}>Retour au dossier</Link>
      </div>
      <p className="notice">
        Une absence de saisie ne prouve pas l’absence de soin. Vérifiez la
        provenance, la date et la dernière révision de chaque événement. Les
        valeurs de croissance n’ont pas d’interprétation automatique.
      </p>
      <section className="panel">
        <h2>Références vaccinales et toutes leurs décisions</h2>
        {(vaccines.data as VaccineItemExport[]).map((item) => (
          <article key={item.id}>
            <h3>
              {item.dose_code} · {item.version_label}
            </h3>
            <p className="fine">
              Référence {item.id} · version {item.version_id}
            </p>
            <ul>
              {item.changes.map((change) => (
                <li key={change.id}>
                  Révision {change.revision} ·{" "}
                  {change.state === "active" ? "Active" : "Retirée"} ·{" "}
                  {change.reason} ·{" "}
                  {clinicianName(attributions, change.professional_id)} · lieu{" "}
                  {change.facility_id} · {change.created_at}
                </li>
              ))}
            </ul>
          </article>
        ))}
        {!(vaccines.data as VaccineItemExport[]).length && (
          <p>Aucune référence assignée.</p>
        )}
      </section>
      <section className="panel">
        <h2>Rendez-vous et toutes leurs décisions</h2>
        {(
          appointments.data as (AppointmentRow & {
            events: AppointmentEvent[];
          })[]
        ).map((appointment) => (
          <article key={appointment.id}>
            <AppointmentCard
              appointment={appointment}
              link={false}
              attributions={attributions}
            />
            <ul>
              {appointment.events.map((event) => (
                <li key={event.id}>
                  Révision {event.revision} · {event.action} ·{" "}
                  {appointmentTime(event.starts_at)} →{" "}
                  {appointmentTime(event.ends_at)}
                  {event.previous_starts_at
                    ? ` · ancien début ${appointmentTime(event.previous_starts_at)}`
                    : ""}{" "}
                  · {event.reason} ·{" "}
                  {clinicianName(attributions, event.professional_id)} ·{" "}
                  {event.recorded_at}
                </li>
              ))}
            </ul>
          </article>
        ))}
        {!(appointments.data as unknown[]).length && (
          <p>Aucun rendez-vous documenté.</p>
        )}
      </section>
      {entries.length ? (
        entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            link={false}
            attributions={attributions}
          />
        ))
      ) : (
        <p className="empty-state">Aucun soin documenté dans ce module.</p>
      )}
    </ClinicalWorkspace>
  );
}
