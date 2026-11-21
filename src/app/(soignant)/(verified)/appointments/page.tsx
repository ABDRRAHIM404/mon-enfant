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
import { FrenchDateInput } from "@/components/appointments/french-date-input";
import { LiveRefresh } from "@/components/appointments/live-refresh";
import { RoutineBooking } from "@/components/appointments/routine-booking";
import {
  appointmentWorkspaceRange,
  parseAppointmentDate,
  readableAppointmentDate as displayDate,
  todayCasablanca,
  appointmentZone,
  type CalendarView,
} from "@/lib/appointments/calendar";
import {
  appointmentStates,
  type AppointmentWorkspace,
  type AppointmentState,
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
  { value: "pending", label: "À confirmer" },
  { value: "indicative", label: "Dates indicatives" },
  { value: "confirmed", label: "Confirmés" },
  ...Object.entries(appointmentStates).map(([value, label]) => ({
    value,
    label: value === "scheduled" ? "Planifiés et confirmés" : label,
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
  let anchor = today;
  let dates = appointmentWorkspaceRange(today, view);
  let invalidDate = false;
  if (typeof q.date === "string" && q.date) {
    try {
      const selected = parseAppointmentDate(q.date);
      dates = appointmentWorkspaceRange(selected, view);
      anchor = selected;
    } catch {
      invalidDate = true;
    }
  }
  const { month, calendar, period } = dates;
  const state = states.find(({ value }) => value === q.state)?.value ?? "all";
  const page = paginationNumber(q.page);
  const proposalsPage = paginationNumber(q.proposals);
  const [response, capabilities, places] = await Promise.all([
    supabase.rpc("appointment_workspace", {
      p_from: period.from,
      p_to: period.to,
      p_month: month,
      p_page: page,
      p_proposal_page: proposalsPage,
      p_state: state,
    }),
    supabase.rpc("my_clinical_capabilities"),
    supabase.rpc("my_facilities"),
  ]);
  if (response.error || capabilities.error)
    throw new Error("Impossible de charger le calendrier.");
  const {
    appointments: data,
    proposals: routine,
    days,
  } = response.data as AppointmentWorkspace;
  const counts = new Map(days.map((day) => [day.day, day]));
  const rights = capabilities.data as string[];
  const facilities = (places.data ?? []) as Facility[];
  const showProposals = ["all", "pending", "indicative"].includes(state);
  const monthLabel = monthDate.format(new Date(`${month}T12:00:00Z`));
  const href = (
    date = anchor,
    mode: CalendarView = view,
    list = 1,
    pending = 1,
  ) =>
    `/appointments?${new URLSearchParams({ date, view: mode, state, page: String(list), proposals: String(pending) })}`;
  const periodLabel =
    view === "month"
      ? monthLabel
      : view === "day"
        ? displayDate(anchor)
        : `${displayDate(period.from)} – ${displayDate(period.to)}`;

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
      {invalidDate && (
        <p className="form-error" role="alert">
          Indiquez une date valide au format JJ/MM/AAAA. Le calendrier affiche
          aujourd’hui.
        </p>
      )}
      <a className="rdv-action rdv-results-link" href="#rdv-period-results">
        Voir les rendez-vous de la période
      </a>
      <div className="rdv-grid" data-show-proposals={showProposals}>
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
              Date <FrenchDateInput date={anchor} />
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
          <div className="rdv-calendar-content">
            <nav className="rdv-period" aria-label="Période du calendrier">
              <Link
                href={href(calendar.previous)}
                scroll={false}
                aria-label="Mois précédent"
              >
                <ChevronLeft size={19} />
              </Link>
              <strong>{monthLabel}</strong>
              <Link
                href={href(calendar.next)}
                scroll={false}
                aria-label="Mois suivant"
              >
                <ChevronRight size={19} />
              </Link>
            </nav>
            <div
              className="rdv-days"
              key={month}
              role="group"
              aria-label={`Calendrier de ${monthLabel}`}
            >
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
                <strong key={day}>{day}</strong>
              ))}
              {calendar.days.map((day) => {
                const outside = day.slice(0, 7) !== month.slice(0, 7);
                const { appointments = 0, proposals = 0 } =
                  counts.get(day) ?? {};
                if (outside)
                  return (
                    <span
                      className="rdv-outside-day"
                      key={day}
                      aria-hidden="true"
                    >
                      {Number(day.slice(8))}
                    </span>
                  );
                return (
                  <Link
                    key={day}
                    href={href(day, "day")}
                    scroll={false}
                    aria-current={day === anchor ? "date" : undefined}
                    aria-label={`${displayDate(day)}${day === today ? ", aujourd’hui" : ""}, ${appointments} rendez-vous, ${proposals} ${routine.preview ? (proposals === 1 ? "date indicative" : "dates indicatives") : proposals === 1 ? "proposition" : "propositions"}`}
                    data-today={day === today}
                  >
                    <span>{Number(day.slice(8))}</span>
                    {(appointments > 0 || proposals > 0) && (
                      <span className="rdv-day-badges" aria-hidden="true">
                        {appointments > 0 && <small>{appointments}</small>}
                        {proposals > 0 && (
                          <small className="rdv-day-proposals">
                            {proposals}
                          </small>
                        )}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            <p className="rdv-calendar-legend">
              <span>Rendez-vous</span>
              {showProposals && (
                <span>
                  {routine.preview ? "Dates indicatives" : "Propositions"}
                </span>
              )}
            </p>
          </div>
        </section>

        <section
          className="rdv-proposals"
          hidden={!showProposals}
          aria-label="Propositions de rendez-vous vaccinaux"
        >
          {showProposals && (
            <header className="rdv-proposals-header">
              <h2>
                <Syringe size={18} />{" "}
                {routine.preview
                  ? "Dates vaccinales indicatives"
                  : "Propositions vaccinales"}
              </h2>
              {routine.preview && (
                <p>
                  Le PNI est en attente de validation. Les dates sont
                  consultables uniquement.
                </p>
              )}
              {!routine.items.length && (
                <p>
                  {routine.version
                    ? "Aucun résultat pour cette période et ce filtre."
                    : "Aucune version du calendrier PNI n’est disponible."}
                </p>
              )}
            </header>
          )}
          {routine.items.map((proposal) => {
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
                <div className="routine-layout">
                  <div className="rdv-child">
                    <ChildAvatar sex={proposal.sex} size={36} />
                    <div>
                      <strong>
                        {[proposal.given_name, proposal.family_name]
                          .filter(Boolean)
                          .join(" ") || "Identité inconnue"}
                      </strong>
                      <span
                        className={`rdv-status rdv-status--${routine.preview ? "neutral" : "amber"}`}
                      >
                        {routine.preview ? "Indicative" : "À confirmer"}
                      </span>
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
                {!canBook && !routine.preview && (
                  <p className="routine-note">
                    {places.error ? (
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
          {(proposalsPage > 1 || routine.total > proposalsPageSize) &&
            showProposals && (
              <nav
                className="rdv-pagination"
                aria-label="Propositions de rendez-vous"
              >
                {proposalsPage > 1 && (
                  <Link
                    className="rdv-action"
                    scroll={false}
                    href={href(anchor, view, page, proposalsPage - 1)}
                  >
                    Propositions précédentes
                  </Link>
                )}
                <span>Page {proposalsPage}</span>
                {proposalsPage * proposalsPageSize < routine.total && (
                  <Link
                    className="rdv-action"
                    scroll={false}
                    href={href(anchor, view, page, proposalsPage + 1)}
                  >
                    Propositions suivantes
                  </Link>
                )}
              </nav>
            )}
        </section>
        <section
          id="rdv-period-results"
          className="rdv-panel rdv-list"
          aria-labelledby="rdv-list-title"
        >
          <h2 id="rdv-list-title">
            <CalendarDays size={23} /> Rendez-vous de la période
          </h2>
          <p className="rdv-period-label">{periodLabel}</p>
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
            <nav
              className="rdv-pagination"
              aria-label="Rendez-vous de la période"
            >
              {page > 1 && (
                <Link
                  className="rdv-action"
                  scroll={false}
                  href={href(anchor, view, page - 1, proposalsPage)}
                >
                  Liste précédente
                </Link>
              )}
              <span>Page {page}</span>
              {page * 50 < data.total && (
                <Link
                  className="rdv-action"
                  scroll={false}
                  href={href(anchor, view, page + 1, proposalsPage)}
                >
                  Liste suivante
                </Link>
              )}
            </nav>
          )}
          <LiveRefresh />
        </section>
      </div>
    </div>
  );
}
