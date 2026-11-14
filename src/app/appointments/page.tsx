import Link from "next/link";
import { requireApprovedDoctor } from "@/lib/auth";
import { DoctorNav } from "@/components/registry/doctor-nav";
import { AppointmentCard } from "@/components/appointments/card";
import { LiveRefresh } from "@/components/appointments/live-refresh";
import {
  calendarRange,
  todayCasablanca,
  type CalendarView,
} from "@/lib/appointments/calendar";
import {
  appointmentStates,
  type AppointmentPage,
} from "@/lib/appointments/types";
export const dynamic = "force-dynamic";
export default async function Calendar({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    view?: string;
    state?: string;
    page?: string;
  }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const q = await searchParams;
  const view: CalendarView = ["day", "week", "month"].includes(q.view ?? "")
    ? (q.view as CalendarView)
    : "week";
  let anchor = q.date || todayCasablanca(),
    range;
  try {
    range = calendarRange(anchor, view);
  } catch {
    anchor = todayCasablanca();
    range = calendarRange(anchor, view);
  }
  const state =
      q.state && Object.hasOwn(appointmentStates, q.state) ? q.state : "all",
    page = Math.min(10000, Math.max(1, Math.floor(Number(q.page) || 1)));
  const response = await supabase.rpc("appointment_calendar", {
    p_from: range.from,
    p_to: range.to,
    p_page: page,
    p_state: state,
  });
  if (response.error) throw new Error("Impossible de charger le calendrier.");
  const data = response.data as AppointmentPage & {
      days: { day: string; count: number }[];
    },
    counts = new Map(data.days.map((day) => [day.day, day.count]));
  const href = (date: string, mode: CalendarView = view, n = 1) =>
    `/appointments?${new URLSearchParams({ date, view: mode, state, page: String(n) })}`;
  return (
    <main className="account-page wide">
      <DoctorNav />
      <div className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          Mes rendez-vous
        </h1>
        <p className="muted">
          Heures locales Africa/Casablanca. Vue limitée aux dossiers encore
          autorisés.
        </p>
      </div>
      <div className="tabs">
        <Link href="/follow-up">Suivis et alertes</Link>
        <Link href="/patients">Choisir un enfant pour planifier</Link>
      </div>
      <LiveRefresh />
      <section className="panel">
        <form className="registry-filters" action="/appointments">
          <label>
            Date
            <input type="date" name="date" required defaultValue={anchor} />
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
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="button primary">Afficher</button>
        </form>
        <nav className="pagination" aria-label="Période du calendrier">
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
                day.slice(0, 7) !== anchor.slice(0, 7) && view === "month"
                  ? "muted"
                  : ""
              }
            >
              <span>{day.slice(8)}</span>
              <small>{counts.get(day) || 0} RDV</small>
              <span className="sr-only"> — {day}</span>
            </Link>
          ))}
        </div>
        <p className="fine">
          {data.total} rendez-vous dans cette période et ce filtre. Les nombres
          du calendrier couvrent toute la période ; la liste est paginée par 50.
        </p>
      </section>
      <h2>Rendez-vous de la période</h2>
      {data.items.map((appointment) => (
        <AppointmentCard key={appointment.id} appointment={appointment} />
      ))}
      {!data.items.length && (
        <p className="empty-state">
          Aucun rendez-vous pour cette période et ce filtre.
        </p>
      )}
      <nav className="pagination" aria-label="Rendez-vous de la période">
        {page > 1 && (
          <Link href={href(anchor, view, page - 1)}>Liste précédente</Link>
        )}
        <span>Page {page}</span>
        {page * 50 < data.total && (
          <Link href={href(anchor, view, page + 1)}>Liste suivante</Link>
        )}
      </nav>
    </main>
  );
}
