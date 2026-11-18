import { DashboardHeading } from "@/components/dashboard/heading";
import { ParentWorkflow } from "@/components/parents/workflow";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { uuidPattern } from "@/lib/registry/types";
import {
  calendarRange,
  todayCasablanca,
  appointmentTime,
  type CalendarView,
} from "@/lib/appointments/calendar";
import {
  appointmentStates,
  type AppointmentRow,
} from "@/lib/appointments/types";
import type { ParentChild } from "@/lib/parents/types";
export const dynamic = "force-dynamic";
type CalendarData = {
  child: ParentChild;
  items: AppointmentRow[];
  days: { day: string; count: number }[];
  total: number;
};
export default async function ParentCalendar({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    date?: string;
    view?: string;
    state?: string;
    page?: string;
  }>;
}) {
  const { supabase } = await requireUser();
  const { id } = await params;
  const q = await searchParams;
  if (!uuidPattern.test(id)) notFound();
  const view: CalendarView = ["day", "week", "month"].includes(q.view ?? "")
    ? (q.view as CalendarView)
    : "month";
  const anchor = q.date ?? todayCasablanca();
  let range;
  try {
    range = calendarRange(anchor, view);
  } catch {
    notFound();
  }
  const state =
      q.state && Object.hasOwn(appointmentStates, q.state) ? q.state : "all",
    page = Number(q.page ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) notFound();
  const { data, error } = await supabase.rpc("parent_appointment_calendar", {
    p_child_id: id,
    p_from: range.from,
    p_to: range.to,
    p_page: page,
    p_state: state,
  });
  if (error?.code === "42501") notFound();
  if (error) throw new Error("Impossible de charger le calendrier.");
  const calendar = data as CalendarData;
  const counts = new Map(calendar.days.map((day) => [day.day, day.count]));
  const href = (date: string, mode: CalendarView = view, n = 1) =>
    `?${new URLSearchParams({ date, view: mode, state, page: String(n) })}`;
  return (
    <ParentWorkflow
      active="appointments"
      childId={id}
      childSection="appointments"
      child={calendar.child}
    >
      <Link href={`/parent/children/${id}`}>← Carnet de mon enfant</Link>
      <DashboardHeading
        title="Rendez-vous de mon enfant"
        description="Les créneaux enregistrés par les professionnels, en heure de Casablanca."
        section="appointments"
      />
      <section className="parent-context-note">
        <p>
          Rendez-vous enregistrés par les professionnels. Horaires de
          Casablanca.
        </p>
      </section>
      <section className="panel">
        <form className="registry-filters">
          <label>
            Date
            <input name="date" type="date" defaultValue={anchor} required />
          </label>
          <label>
            Vue
            <select name="view" defaultValue={view}>
              <option value="day">Jour</option>
              <option value="week">Semaine</option>
              <option value="month">Mois</option>
            </select>
          </label>
          <label>
            État
            <select name="state" defaultValue={state}>
              <option value="all">Tous</option>
              {Object.entries(appointmentStates).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="button primary">Afficher</button>
        </form>
        <nav className="pagination" aria-label="Périodes du calendrier">
          <Link href={href(range.previous)}>Période précédente</Link>
          <span>
            {range.from} au {range.to}
          </span>
          <Link href={href(range.next)}>Période suivante</Link>
        </nav>
        <div
          className={`appointment-calendar ${view}`}
          role="group"
          aria-label="Jours et nombre de rendez-vous"
        >
          {view !== "day" &&
            ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
              <strong key={day}>{day}</strong>
            ))}
          {range.days.map((day) => (
            <Link
              key={day}
              href={href(day, "day")}
              className={
                view === "month" && day.slice(0, 7) !== anchor.slice(0, 7)
                  ? "muted"
                  : ""
              }
            >
              <span>{day.slice(8)}</span>
              <strong>{counts.get(day) ?? 0}</strong>
              <span className="fine">rendez-vous</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Rendez-vous de la période ({calendar.total})</h2>
        <div className="record-list">
          {calendar.items.map((row) => (
            <article key={row.id}>
              <h3>{row.purpose_label}</h3>
              <p>
                {appointmentTime(row.starts_at)} —{" "}
                {appointmentTime(row.ends_at)}
              </p>
              <p>{appointmentStates[row.effective_state]}</p>
              <p>
                {row.facility_name} · Professionnel {row.professional_id}
              </p>
              {row.dose_code && (
                <p>
                  Référence vaccinale : {row.dose_code} · {row.version_label}
                </p>
              )}
              {row.was_missed && (
                <p className="fine">
                  Un rendez-vous manqué antérieur reste conservé dans
                  l’historique.
                </p>
              )}
              {row.recorded_by_other && (
                <p className="fine">
                  La dose associée a été documentée par un autre professionnel
                  autorisé.
                </p>
              )}
            </article>
          ))}
        </div>
        {!calendar.items.length && (
          <p>Aucun rendez-vous pour cette période et ce filtre.</p>
        )}
        <nav className="pagination" aria-label="Pages des rendez-vous">
          {page > 1 && (
            <Link href={href(anchor, view, page - 1)}>Page précédente</Link>
          )}
          {page * 50 < calendar.total && (
            <Link href={href(anchor, view, page + 1)}>Page suivante</Link>
          )}
        </nav>
      </section>
      <p className="notice">
        Un rendez-vous passé ne prouve pas une vaccination manquée. Pour
        confirmer, annuler ou déplacer un rendez-vous, contactez le
        professionnel ; aucune modification de soin n’est effectuée depuis ce
        calendrier.
      </p>
      <Link
        className="button secondary"
        href={`/parent/children/${id}/requests`}
      >
        Contacter le professionnel par une demande
      </Link>
    </ParentWorkflow>
  );
}
