import { CalendarPlus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicalWorkspace } from "@/components/clinician/care-workspace";
import {
  ChildPageHeading,
  ChildPanel,
  ChildStatus,
} from "@/components/clinician/patient-profile";
import { RoutineBooking } from "@/components/appointments/routine-booking";
import { LiveRefresh } from "@/components/appointments/live-refresh";
import {
  appointmentTime,
  readableAppointmentDate,
  todayCasablanca,
} from "@/lib/appointments/calendar";
import { readClinicalAttributions } from "@/lib/clinical/read-attribution";
import {
  clinicianName,
  type ClinicalAttributions,
} from "@/lib/clinical/attribution";
import {
  uuidPattern,
  type ChildProfile,
  type Facility,
} from "@/lib/registry/types";
import {
  appointmentStates,
  type AppointmentPage,
  type AppointmentRow,
  type RoutineAppointmentProposals,
} from "@/lib/appointments/types";

export const dynamic = "force-dynamic";
const pageNumber = (s?: string) =>
  Math.min(10000, Math.max(1, Math.floor(Number(s) || 1)));

function AppointmentRows({
  rows,
  names,
  empty,
}: {
  rows: AppointmentRow[];
  names: ClinicalAttributions;
  empty: string;
}) {
  if (!rows.length) return <p className="empty-state">{empty}</p>;
  return (
    <ul className="child-list">
      {rows.map((row) => {
        const tone =
          row.effective_state === "scheduled" ||
          row.effective_state === "completed" ||
          row.effective_state === "dose_documented"
            ? "green"
            : row.effective_state === "missed" ||
                row.effective_state === "reference_review"
              ? "amber"
              : "neutral";
        const root = `/patients/${row.child_id}`;
        return (
          <li className="child-appointment-card" key={row.id}>
            <h3>{row.purpose_label}</h3>
            <ChildStatus tone={tone}>
              {appointmentStates[row.effective_state]}
            </ChildStatus>
            <p>
              <time dateTime={row.starts_at}>
                {appointmentTime(row.starts_at)}
              </time>{" "}
              →{" "}
              <time dateTime={row.ends_at}>{appointmentTime(row.ends_at)}</time>
            </p>
            <p className="fine">
              {clinicianName(names, row.professional_id)} · {row.facility_name}
            </p>
            {(row.dose_codes?.length || row.dose_code) && (
              <p className="fine">
                Doses prévues · {row.dose_codes?.join(", ") || row.dose_code}
                {row.version_label ? ` · ${row.version_label}` : ""}
              </p>
            )}
            {row.recommended_on && (
              <p className="fine">
                Date recommandée par le PNI ·{" "}
                {readableAppointmentDate(row.recommended_on)}
              </p>
            )}
            {row.documentation && (
              <p className="fine">
                Dose documentée le{" "}
                {readableAppointmentDate(row.documentation.occurred_on)} par{" "}
                {clinicianName(names, row.documentation.professional_id)}.{" "}
                <Link
                  className="text-link"
                  href={`${root}/records/${row.documentation.root_id}`}
                >
                  Voir l’administration
                </Link>
              </p>
            )}
            {row.effective_state === "missed" && (
              <p className="fine">
                Le créneau est passé sans disposition enregistrée. Vérifiez le
                dossier avant de le replanifier.
              </p>
            )}
            <Link
              className="child-button button secondary"
              href={`${root}/appointments/${row.id}`}
            >
              {row.is_mine ? "Historique et décisions" : "Voir l’historique"}{" "}
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default async function PatientAppointments({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; proposals?: string; saved?: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { id } = await params;
  const q = await searchParams;
  if (!uuidPattern.test(id)) notFound();
  const page = pageNumber(q.page),
    proposalsPage = pageNumber(q.proposals);
  const [profile, appointments, caps, proposals] = await Promise.all([
    supabase.rpc("get_child_profile", { p_child_id: id }),
    supabase.rpc("patient_appointments", { p_child_id: id, p_page: page }),
    supabase.rpc("my_clinical_capabilities"),
    supabase.rpc("patient_routine_appointment_proposals", {
      p_child_id: id,
      p_page: proposalsPage,
    }),
  ]);
  if (
    [profile, appointments, proposals].some(
      (response) => response.error?.code === "42501",
    ) ||
    (!profile.error && !profile.data)
  )
    notFound();
  if (profile.error || appointments.error || caps.error || proposals.error)
    throw new Error("Impossible de charger les rendez-vous.");
  const child = profile.data as ChildProfile;
  const data = appointments.data as AppointmentPage;
  const routine = proposals.data as RoutineAppointmentProposals;
  const rights = caps.data as string[];
  const canBook = rights.includes("appointment");
  const [names, places] = await Promise.all([
    readClinicalAttributions(
      supabase,
      data.items.flatMap((row) => [
        row.professional_id,
        row.documentation?.professional_id,
      ]),
      { children: [id] },
    ),
    canBook && !routine.preview && routine.items.length
      ? supabase.rpc("my_facilities")
      : { data: [], error: null },
  ]);
  const facilities = (places.data ?? []) as Facility[];
  const generated = data.generated_at
    ? Date.parse(data.generated_at)
    : new Date().getTime();
  const upcoming = data.items
    .filter(
      (row) =>
        row.effective_state === "scheduled" &&
        Date.parse(row.starts_at) >= generated,
    )
    .reverse();
  const history = data.items.filter((row) => !upcoming.includes(row));
  const href = (list: number, pending: number, anchor: string) =>
    `/patients/${id}/appointments?${new URLSearchParams({ page: String(list), proposals: String(pending) })}#${anchor}`;
  return (
    <ClinicalWorkspace
      active="appointments"
      childId={id}
      child={child}
      section="appointments"
    >
      <ChildPageHeading
        title="Rendez-vous"
        description="Créneaux de cet enfant, en heure de Casablanca."
        actions={
          <>
            {canBook ? (
              <Link
                className="button primary child-button child-spotlight"
                href={`/patients/${id}/appointments/new`}
              >
                <CalendarPlus size={18} aria-hidden="true" />
                Planifier un rendez-vous
              </Link>
            ) : (
              <Link
                className="button secondary child-button"
                href="/account/clinical-permissions"
              >
                Mes habilitations
              </Link>
            )}
            <Link
              className="button secondary child-button"
              href="/appointments"
            >
              Mon calendrier
            </Link>
          </>
        }
      />
      {!canBook && (
        <p className="notice">
          Une habilitation est nécessaire pour planifier un rendez-vous.
        </p>
      )}
      {q.saved === "1" && (
        <p className="notice" role="status">
          Rendez-vous confirmé.
        </p>
      )}
      <LiveRefresh />
      <div className="child-grid">
        <ChildPanel
          title={
            routine.preview
              ? "Dates vaccinales indicatives"
              : "Propositions vaccinales"
          }
          id="propositions"
        >
          {!routine.version && (
            <p>Aucune version du PNI disponible pour les propositions.</p>
          )}
          {routine.version && !routine.items.length && (
            <p>Aucune proposition sur cette page.</p>
          )}
          {routine.preview && (
            <p>
              Le PNI est en attente de validation. Ces dates restent
              consultables.
            </p>
          )}
          {routine.items.map((proposal) => (
            <article
              className="child-subcard child-proposal"
              key={proposal.recommended_on}
            >
              <h3>
                <time dateTime={proposal.recommended_on}>
                  {readableAppointmentDate(proposal.recommended_on)}
                </time>
              </h3>
              <ChildStatus tone={routine.preview ? "neutral" : "amber"}>
                {routine.preview ? "Indicative" : "À confirmer"}
              </ChildStatus>
              <p>
                {proposal.doses
                  .map(({ code, label }) =>
                    code === label ? code : `${label} · ${code}`,
                  )
                  .join(", ")}
              </p>
              {!routine.preview &&
              routine.version &&
              canBook &&
              (!proposal.requires_assignment ||
                rights.includes("vaccination")) &&
              facilities.length > 0 ? (
                <RoutineBooking
                  proposal={proposal}
                  version={routine.version}
                  facilities={facilities}
                  operation={randomUUID()}
                  today={todayCasablanca()}
                  returnToChild
                />
              ) : (
                !routine.preview && (
                  <p className="fine">
                    {places.error ? (
                      "Lieux d’exercice indisponibles."
                    ) : !canBook ||
                      (proposal.requires_assignment &&
                        !rights.includes("vaccination")) ? (
                      "Une habilitation supplémentaire est nécessaire pour confirmer."
                    ) : (
                      <>
                        Déclarez un{" "}
                        <Link className="text-link" href="/practices">
                          lieu d’exercice
                        </Link>{" "}
                        pour confirmer.
                      </>
                    )}
                  </p>
                )
              )}
            </article>
          ))}
          {(proposalsPage > 1 || proposalsPage * 3 < routine.total) && (
            <nav
              className="pagination"
              aria-label="Pagination des propositions"
            >
              {proposalsPage > 1 && (
                <Link href={href(page, proposalsPage - 1, "propositions")}>
                  Précédent
                </Link>
              )}
              <span>Page {proposalsPage}</span>
              {proposalsPage * 3 < routine.total && (
                <Link href={href(page, proposalsPage + 1, "propositions")}>
                  Suivant
                </Link>
              )}
            </nav>
          )}
        </ChildPanel>
        <ChildPanel title="Rendez-vous à venir" id="rendez-vous">
          <AppointmentRows
            rows={upcoming}
            names={names}
            empty="Aucun créneau à venir sur cette page."
          />
        </ChildPanel>
      </div>
      <ChildPanel
        title="Historique des rendez-vous"
        className="child-panel-spaced"
      >
        <AppointmentRows
          rows={history}
          names={names}
          empty="Aucun rendez-vous passé ou clos sur cette page."
        />
        {(page > 1 || page * 30 < data.total) && (
          <nav className="pagination" aria-label="Pagination des rendez-vous">
            {page > 1 && (
              <Link href={href(page - 1, proposalsPage, "rendez-vous")}>
                Précédent
              </Link>
            )}
            <span>
              Page {page} · {data.total} rendez-vous
            </span>
            {page * 30 < data.total && (
              <Link href={href(page + 1, proposalsPage, "rendez-vous")}>
                Suivant
              </Link>
            )}
          </nav>
        )}
      </ChildPanel>
    </ClinicalWorkspace>
  );
}
