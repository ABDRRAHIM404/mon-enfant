import Image from "next/image";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  PlusCircle,
  Stethoscope,
  Syringe,
} from "lucide-react";
import { requireApprovedDoctor } from "@/lib/auth";
import { ChildAvatar } from "@/components/clinician/child-avatar";
import { RegistryFilterSelect } from "@/components/clinician/registry-filter-select";
import { CalendarDisclosure } from "@/components/appointments/calendar-disclosure";
import { LiveRefresh } from "@/components/appointments/live-refresh";
import { RoutineBooking } from "@/components/appointments/routine-booking";
import {
  calendarRange,
  todayCasablanca,
  appointmentZone,
  type CalendarView,
} from "@/lib/appointments/calendar";
import {
  appointmentStates,
  type AppointmentPage,
  type AppointmentState,
  type RoutineAppointmentProposals,
} from "@/lib/appointments/types";
import type { Facility } from "@/lib/registry/types";
import "../consultations/consultations.css";
import "@/components/clinician/registry-filter-select.css";
import "./appointments.css";

export const dynamic = "force-dynamic";

const views = [
  { value: "day", label: "Jour" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
];
const states = [
  { value: "all", label: "Tous" },
  ...Object.entries(appointmentStates).map(([value, label]) => ({
    value,
    label,
  })),
];
const status: Record<AppointmentState, { label: string; tone: string }> = {
  scheduled: { label: "Confirmé", tone: "green" },
  completed: { label: "Réalisé", tone: "green" },
  dose_documented: { label: "Vaccination documentée", tone: "green" },
  missed: { label: "Passé · à revoir", tone: "amber" },
  reference_review: { label: "Référence à revoir", tone: "amber" },
  cancelled: { label: "Annulé", tone: "neutral" },
};
const fullDate = new Intl.DateTimeFormat("fr-MA", {
  dateStyle: "long",
  timeZone: "UTC",
});
const monthDate = new Intl.DateTimeFormat("fr-MA", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const localTime = new Intl.DateTimeFormat("fr-MA", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: appointmentZone,
});
const displayDate = (value: string) =>
  fullDate.format(new Date(`${value}T12:00:00Z`));
const proposalsPageSize = 3;
const paginationNumber = (value?: string) =>
  Math.min(10000, Math.max(1, Math.floor(Number(value) || 1)));

export default async function Calendar({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    view?: string;
    state?: string;
    page?: string;
    proposals?: string;
    saved?: string;
  }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const q = await searchParams;
  const today = todayCasablanca();
  const view = (
    views.some(({ value }) => value === q.view) ? q.view : "month"
  ) as CalendarView;
  let anchor = q.date || today;
  let range;
  try {
    range = calendarRange(anchor, view);
  } catch {
    anchor = today;
    range = calendarRange(anchor, view);
  }
  const state =
    q.state && Object.hasOwn(appointmentStates, q.state) ? q.state : "all";
  const page = paginationNumber(q.page);
  const proposalsPage = paginationNumber(q.proposals);
  const [response, capabilities, proposals, places] = await Promise.all([
    supabase.rpc("appointment_calendar", {
      p_from: range.from,
      p_to: range.to,
      p_page: page,
      p_state: state,
    }),
    supabase.rpc("my_clinical_capabilities"),
    supabase.rpc("routine_appointment_proposals", { p_page: proposalsPage }),
    supabase.rpc("my_facilities"),
  ]);
  if (response.error || capabilities.error)
    throw new Error("Impossible de charger le calendrier.");
  const data = response.data as AppointmentPage & {
    days: { day: string; count: number }[];
  };
  const counts = new Map(data.days.map((day) => [day.day, day.count]));
  const rights = capabilities.data as string[];
  const facilities = (places.data ?? []) as Facility[];
  const routine = proposals.data as RoutineAppointmentProposals | null;
  const href = (
    date = anchor,
    mode: CalendarView = view,
    list = 1,
    pending = proposalsPage,
  ) =>
    `/appointments?${new URLSearchParams({ date, view: mode, state, page: String(list), proposals: String(pending) })}`;
  const periodLabel =
    view === "month"
      ? monthDate.format(new Date(`${anchor}T12:00:00Z`))
      : view === "day"
        ? displayDate(anchor)
        : `${displayDate(range.from)} – ${displayDate(range.to)}`;

  return (
    <div className="consultations-workspace rdv-workspace">
      <header className="rdv-hero">
        <div className="consultation-heading rdv-heading">
          <div className="consultation-heading-copy">
            <span>Espace soignant</span>
            <h1 id="main-content" tabIndex={-1}>
              Rendez-vous
            </h1>
            <p>
              Planifiez et retrouvez vos rendez-vous, en heure de Casablanca.
            </p>
          </div>
          <Image
            src="/dashboard-art/appointments-hero.webp"
            alt=""
            width={1050}
            height={396}
            preload
          />
        </div>
        <div className="rdv-hero-actions">
          <Link className="rdv-action" href="/follow-up">
            <Bell size={20} /> Suivis et alertes
          </Link>
          {rights.includes("appointment") && (
            <Link className="rdv-action rdv-primary" href="/appointments/new">
              <PlusCircle size={20} /> Nouveau rendez-vous
            </Link>
          )}
        </div>
      </header>
      {q.saved === "1" && (
        <p className="rdv-success" role="status">
          Rendez-vous vaccinal confirmé.
        </p>
      )}
      <div className="rdv-grid">
        <section
          className="rdv-proposals"
          aria-label="Propositions de rendez-vous vaccinaux"
        >
          {(proposals.error || !routine?.items.length) && (
            <div className="rdv-panel rdv-empty">
              <h2>
                <Syringe size={21} /> Rendez-vous vaccinaux
              </h2>
              <p>
                {proposals.error
                  ? "Les propositions sont momentanément indisponibles."
                  : routine?.version
                    ? "Aucune date de routine à proposer pour vos dossiers autorisés."
                    : "Aucune version du calendrier PNI n’est disponible."}
              </p>
            </div>
          )}
          {routine?.items.map((proposal) => {
            const canBook =
              !routine.preview &&
              routine.version &&
              rights.includes("appointment") &&
              (!proposal.requires_assignment ||
                rights.includes("vaccination")) &&
              facilities.length > 0;
            return (
              <article
                className="routine-proposal"
                key={`${proposal.child_id}-${proposal.recommended_on}`}
              >
                <div className="routine-heading">
                  <h2>
                    <span className="rdv-icon">
                      <Syringe size={23} />
                    </span>{" "}
                    {routine.preview
                      ? "Date vaccinale indicative"
                      : "Rendez-vous vaccinal (automatique)"}
                  </h2>
                  <span className="rdv-status rdv-status--amber">
                    <Clock size={15} />{" "}
                    {routine.preview
                      ? "Aperçu du PNI"
                      : "En attente de confirmation"}
                  </span>
                </div>
                <div className="routine-layout">
                  <div className="rdv-child">
                    <ChildAvatar sex={proposal.sex} />
                    <div>
                      <strong>
                        {[proposal.given_name, proposal.family_name]
                          .filter(Boolean)
                          .join(" ") || "Identité inconnue"}
                      </strong>
                      <small>Né(e) le {displayDate(proposal.birth_date)}</small>
                    </div>
                  </div>
                  <div className="routine-date">
                    <strong>
                      <CalendarDays size={19} />{" "}
                      {displayDate(proposal.recommended_on)}
                    </strong>
                    <ul aria-label="Doses prévues (PNI)">
                      {proposal.doses.map((dose) => (
                        <li key={dose.code}>
                          {dose.label === dose.code
                            ? dose.code
                            : `${dose.label} · ${dose.code}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {canBook && routine.version && (
                    <RoutineBooking
                      proposal={proposal}
                      version={routine.version}
                      facilities={facilities}
                      operation={randomUUID()}
                      today={today}
                    />
                  )}
                </div>
                {!canBook && (
                  <p className="routine-note">
                    {routine.preview ? (
                      "Calendrier bêta en attente de validation. Date consultable uniquement."
                    ) : places.error ? (
                      "Impossible de charger les lieux d’exercice."
                    ) : !rights.includes("appointment") ||
                      (proposal.requires_assignment &&
                        !rights.includes("vaccination")) ? (
                      "Une habilitation supplémentaire est nécessaire pour confirmer."
                    ) : (
                      <>
                        Déclarez un{" "}
                        <Link href="/practices">lieu d’exercice</Link> pour
                        confirmer.
                      </>
                    )}
                  </p>
                )}
              </article>
            );
          })}
          {routine && routine.total > proposalsPageSize && (
            <nav
              className="pagination"
              aria-label="Propositions de rendez-vous"
            >
              {proposalsPage > 1 && (
                <Link href={href(anchor, view, page, proposalsPage - 1)}>
                  Propositions précédentes
                </Link>
              )}
              <span>Page {proposalsPage}</span>
              {proposalsPage * proposalsPageSize < routine.total && (
                <Link href={href(anchor, view, page, proposalsPage + 1)}>
                  Propositions suivantes
                </Link>
              )}
            </nav>
          )}
        </section>
        <section
          className="rdv-panel rdv-filters"
          aria-labelledby="rdv-filter-title"
        >
          <h2 id="rdv-filter-title">
            <Filter size={21} /> Filtres
          </h2>
          <form
            action="/appointments"
            className="rdv-filter-form"
            key={`${anchor}-${view}-${state}`}
          >
            <label>
              Date{" "}
              <input type="date" name="date" required defaultValue={anchor} />
            </label>
            <RegistryFilterSelect
              name="view"
              label="Vue"
              defaultValue={view}
              options={views}
            />
            <RegistryFilterSelect
              name="state"
              label="État"
              defaultValue={state}
              options={states}
            />
            <button className="rdv-action rdv-primary">
              <Filter size={17} /> Afficher
            </button>
          </form>
          <CalendarDisclosure>
            <nav className="rdv-period" aria-label="Période du calendrier">
              <Link href={href(range.previous)} aria-label="Période précédente">
                <ChevronLeft size={19} />
              </Link>
              <strong>{periodLabel}</strong>
              <Link href={href(range.next)} aria-label="Période suivante">
                <ChevronRight size={19} />
              </Link>
            </nav>
            <div
              className={`rdv-days rdv-days--${view}`}
              role="group"
              aria-label="Jours et rendez-vous"
            >
              {view !== "day" &&
                ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
                  <strong key={day}>{day}</strong>
                ))}
              {range.days.map((day) => {
                const count = counts.get(day) ?? 0;
                return (
                  <Link
                    key={day}
                    href={href(day, "day")}
                    aria-current={day === anchor ? "date" : undefined}
                    aria-label={`${displayDate(day)}${day === today ? ", aujourd’hui" : ""}, ${count} rendez-vous`}
                    data-today={day === today}
                    data-outside={
                      view === "month" && day.slice(0, 7) !== anchor.slice(0, 7)
                    }
                  >
                    <span>{Number(day.slice(8))}</span>
                    {count > 0 && <small>{count}</small>}
                  </Link>
                );
              })}
            </div>
          </CalendarDisclosure>
        </section>
        <section
          className="rdv-panel rdv-list"
          aria-labelledby="rdv-list-title"
        >
          <h2 id="rdv-list-title">
            <CalendarDays size={23} /> Rendez-vous de la période
          </h2>
          {data.items.length ? (
            <ul>
              {data.items.map((appointment) => {
                const state = status[appointment.effective_state];
                const Icon =
                  appointment.purpose === "vaccination"
                    ? Syringe
                    : appointment.purpose === "consultation"
                      ? Stethoscope
                      : CalendarDays;
                return (
                  <li key={appointment.id}>
                    <Link
                      className="rdv-row"
                      href={`/patients/${appointment.child_id}/appointments/${appointment.id}`}
                    >
                      <div className="rdv-row-child">
                        <ChildAvatar sex={appointment.child_sex} size={38} />
                        <div>
                          <strong>
                            <Icon size={16} /> {appointment.purpose_label}
                          </strong>
                          <small>
                            {[
                              appointment.child_given_name,
                              appointment.child_family_name,
                            ]
                              .filter(Boolean)
                              .join(" ") || "Identité inconnue"}
                          </small>
                        </div>
                      </div>
                      <span className="rdv-row-date">
                        <CalendarDays size={17} />{" "}
                        {displayDate(appointment.starts_on)}
                      </span>
                      <span className="rdv-row-time">
                        <Clock size={16} />{" "}
                        {localTime.format(new Date(appointment.starts_at))}
                      </span>
                      <span className={`rdv-status rdv-status--${state.tone}`}>
                        {appointment.effective_state === "scheduled" &&
                        !appointment.recommended_on
                          ? "Planifié"
                          : state.label}
                      </span>
                      <ChevronRight className="rdv-row-chevron" size={18} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rdv-empty">
              Aucun rendez-vous pour cette période et ce filtre.
            </p>
          )}
          {(page > 1 || page * 50 < data.total) && (
            <nav className="pagination" aria-label="Rendez-vous de la période">
              {page > 1 && (
                <Link href={href(anchor, view, page - 1)}>
                  Liste précédente
                </Link>
              )}
              <span>Page {page}</span>
              {page * 50 < data.total && (
                <Link href={href(anchor, view, page + 1)}>Liste suivante</Link>
              )}
            </nav>
          )}
          <LiveRefresh />
        </section>
      </div>
    </div>
  );
}
