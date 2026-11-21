import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Folder,
  LayoutGrid,
  Link2,
  Layers,
  MapPin,
  MessageSquare,
  Plus,
  QrCode,
  Stethoscope,
  Syringe,
  UsersRound,
  ChartNoAxesCombined,
} from "lucide-react";
import { requireApprovedDoctor } from "@/lib/auth";
import { NavigationFeedback } from "@/components/workspace-navigation";
import { LiveRefresh } from "@/components/appointments/live-refresh";
import { appointmentTime, todayCasablanca } from "@/lib/appointments/calendar";
import {
  appointmentStates,
  type AppointmentPage,
  type AppointmentState,
} from "@/lib/appointments/types";
import { patientName } from "@/lib/registry/types";

export const dynamic = "force-dynamic";

const shortcuts = [
  {
    label: "Consultation",
    detail: "Ouvrir un dossier patient",
    href: "/consultations",
    kind: "consultation",
    Icon: Stethoscope,
  },
  {
    label: "Vaccination",
    detail: "Enregistrer une dose",
    href: "/vaccinations",
    kind: "vaccination",
    Icon: Syringe,
  },
  {
    label: "Croissance",
    detail: "Suivre les mesures",
    href: "/growth",
    kind: "growth",
    Icon: ChartNoAxesCombined,
  },
  {
    label: "Rendez-vous",
    detail: "Planifier un suivi",
    href: "/appointments/new",
    kind: "appointment",
    Icon: CalendarDays,
  },
];
const toolGroups = [
  {
    label: "Dossiers et accès",
    Icon: Folder,
    links: [
      {
        label: "Transcrire un dossier papier",
        href: "/patients/new?source=paper",
        Icon: FileText,
      },
      {
        label: "Rattacher un dossier existant",
        href: "/patients/link",
        Icon: Link2,
      },
      { label: "Demandes d’accès", href: "/access-requests", Icon: UsersRound },
      { label: "Mes dossiers provisoires", href: "/provisional", Icon: Layers },
    ],
  },
  {
    label: "Suivi et références",
    Icon: CalendarDays,
    links: [
      {
        label: "Ouvrir le calendrier",
        href: "/appointments",
        Icon: CalendarDays,
      },
      {
        label: "Référentiel vaccinal et versions",
        href: "/vaccines",
        Icon: BookOpen,
      },
    ],
  },
  {
    label: "Administration",
    Icon: ClipboardCheck,
    links: [
      {
        label: "Revues d’inscription",
        href: "/registration-reviews",
        Icon: ClipboardCheck,
      },
      {
        label: "Demandes des parents",
        href: "/parent-requests",
        Icon: MessageSquare,
      },
      { label: "Lieux d’exercice", href: "/practices", Icon: MapPin },
    ],
  },
];
const appointmentTone: Record<AppointmentState, string> = {
  scheduled: "neutral",
  missed: "review",
  cancelled: "neutral",
  completed: "success",
  dose_documented: "success",
  reference_review: "review",
};
const appointmentLabel: Record<AppointmentState, string> = {
  scheduled: "Planifié",
  missed: "Créneau passé · à revoir",
  cancelled: "Annulé",
  completed: "Visite réalisée",
  dose_documented: "Dose documentée",
  reference_review: "Référence à revoir",
};
const timeZone = "Africa/Casablanca";

export default async function Dashboard() {
  const { supabase } = await requireApprovedDoctor();
  const now = new Date();
  const today = todayCasablanca(now);
  const [registry, appointments, vaccines, consultations, capabilities] =
    await Promise.all([
      supabase.rpc("registry_summary"),
      supabase.rpc("appointment_calendar", { p_from: today, p_to: today }),
      supabase.rpc("vaccine_followup_worklist", {
        p_bucket: "potentially_overdue_unconfirmed",
      }),
      supabase.rpc("clinician_recent_consultations"),
      supabase.rpc("my_clinical_capabilities"),
    ]);
  if (
    registry.error ||
    appointments.error ||
    vaccines.error ||
    consultations.error ||
    capabilities.error
  )
    throw new Error("Impossible de charger le tableau de bord autorisé.");
  const counts = registry.data as { patients: number };
  const visits = appointments.data as AppointmentPage;
  const refs = vaccines.data as { counts: Record<string, number> };
  const recent = consultations.data as {
    total: number;
    items: {
      id: string;
      root_id: string;
      child_id: string;
      given_name: string | null;
      family_name: string | null;
      recorded_at: string;
      source_verified: boolean;
      reason: string;
      revision: number;
    }[];
  };
  const allowed = capabilities.data as string[];
  const actions = shortcuts.filter(({ kind }) => allowed.includes(kind));
  const summaries = [
    {
      count: counts.patients,
      label: "Enfants de mon registre",
      href: "/patients",
      Icon: UsersRound,
      review: false,
    },
    {
      count: recent.total,
      label: "Consultations documentées",
      href: "/consultations",
      Icon: Stethoscope,
      review: false,
    },
    {
      count: refs.counts.potentially_overdue_unconfirmed ?? 0,
      label: "Références vaccinales à revoir",
      href: "/follow-up?mode=vaccines",
      Icon: AlertTriangle,
      review: true,
    },
  ];
  const date = new Intl.DateTimeFormat("fr-MA", {
    dateStyle: "full",
    timeZone,
  });
  const recordedDate = new Intl.DateTimeFormat("fr-MA", {
    dateStyle: "medium",
    timeZone,
  });
  const clock = new Intl.DateTimeFormat("fr-MA", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  });
  const number = new Intl.NumberFormat("fr-MA");

  return (
    <>
      <section className="care-day" aria-labelledby="main-content">
        <div className="care-day-title">
          <p className="care-day-date">
            <CalendarDays size={18} aria-hidden="true" />{" "}
            <time dateTime={today}>{date.format(now)}</time>
          </p>
          <h1 id="main-content" tabIndex={-1}>
            Ma journée de soins
          </h1>
          <p>Votre espace de travail, organisé autour de vos patients.</p>
        </div>
        <div className="care-day-actions">
          <Link className="care-action" href="/patients/new">
            <Plus aria-hidden="true" />
            Ajouter un enfant
            <NavigationFeedback />
          </Link>
          <Link className="care-action care-action--coral" href="/share">
            <QrCode aria-hidden="true" />
            Scanner un QR partagé
            <NavigationFeedback />
          </Link>
        </div>
      </section>
      <section aria-labelledby="clinical-start-heading">
        <div className="care-start-heading">
          <h2 id="clinical-start-heading">Démarrer un soin</h2>
          <Link href="/account/clinical-permissions">
            Mes habilitations <ArrowRight size={18} aria-hidden="true" />
            <NavigationFeedback />
          </Link>
        </div>
        {actions.length ? (
          <ul className="care-shortcuts" role="list">
            {actions.map(({ label, detail, href, Icon }) => (
              <li key={href}>
                <Link className="care-card" href={href}>
                  <span className="care-icon">
                    <Icon size={24} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{label}</strong>
                    <small>{detail}</small>
                  </span>
                  <ArrowRight
                    className="care-shortcut-arrow"
                    size={17}
                    aria-hidden="true"
                  />
                  <NavigationFeedback />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">
            La saisie des soins dépend de vos habilitations cliniques.
          </p>
        )}
      </section>
      <nav className="care-metrics" aria-label="Dossiers et suivis">
        {summaries.map(({ count, label, href, Icon, review }) => (
          <Link
            className="care-card"
            href={href}
            key={href}
            data-review={review && count > 0 ? "" : undefined}
          >
            <span className="care-icon">
              <Icon size={24} aria-hidden="true" />
            </span>
            <span>
              <strong>{number.format(count)}</strong>
              <small>{label}</small>
            </span>
            <NavigationFeedback />
          </Link>
        ))}
      </nav>
      <div className="care-day-lists">
        <section
          className="care-panel"
          aria-labelledby="care-appointments-heading"
        >
          <header>
            <CalendarDays size={23} aria-hidden="true" />
            <h2 id="care-appointments-heading">Rendez-vous du jour</h2>
            <span className="care-count">{number.format(visits.total)}</span>
          </header>
          <LiveRefresh />
          {visits.items.length ? (
            <ul
              className="care-rows"
              role="list"
              key={visits.items
                .slice(0, 4)
                .map(
                  ({ id, starts_at, effective_state }) =>
                    `${id}:${starts_at}:${effective_state}`,
                )
                .join("|")}
            >
              {visits.items.slice(0, 4).map((appointment) => {
                const { effective_state: state } = appointment;
                const name = [
                  appointment.child_given_name,
                  appointment.child_family_name,
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <li key={appointment.id}>
                    <Link
                      href={`/patients/${appointment.child_id}/appointments/${appointment.id}`}
                    >
                      <time
                        className="care-time"
                        dateTime={appointment.starts_at}
                        title={appointmentTime(appointment.starts_at)}
                      >
                        {clock.format(new Date(appointment.starts_at))}
                      </time>
                      <span className="care-avatar">
                        <UsersRound size={17} aria-hidden="true" />
                      </span>
                      <span className="care-row-text">
                        <strong>{name || "Identité non renseignée"}</strong>
                        <small>{appointment.purpose_label}</small>
                      </span>
                      <span
                        className="care-status"
                        data-tone={appointmentTone[state]}
                        title={appointmentStates[state]}
                      >
                        {appointmentLabel[state]}
                      </span>
                      <NavigationFeedback />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="care-empty">
              <span className="care-icon">
                <CalendarDays size={31} aria-hidden="true" />
              </span>
              <div>
                <strong>Aucun rendez-vous aujourd’hui</strong>
                <p>Les rendez-vous planifiés apparaîtront ici.</p>
              </div>
            </div>
          )}
          <footer>
            <Link
              className="care-action care-action--coral"
              href={
                !visits.total && allowed.includes("appointment")
                  ? "/appointments/new"
                  : `/appointments?view=day&date=${today}`
              }
            >
              <CalendarDays aria-hidden="true" />
              {!visits.total && allowed.includes("appointment")
                ? "Planifier un rendez-vous"
                : "Consulter le calendrier"}
              <ArrowRight aria-hidden="true" />
              <NavigationFeedback />
            </Link>
          </footer>
        </section>
        <section
          className="care-panel"
          aria-labelledby="care-consultations-heading"
        >
          <header>
            <FileText size={23} aria-hidden="true" />
            <h2 id="care-consultations-heading">Consultations récentes</h2>
          </header>
          {recent.items.length ? (
            <ul
              className="care-rows care-rows--consultations"
              role="list"
              key={recent.items
                .slice(0, 4)
                .map(({ id }) => id)
                .join("|")}
            >
              {recent.items.slice(0, 4).map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={`/patients/${entry.child_id}/records/${entry.root_id}`}
                  >
                    <span className="care-avatar">
                      <Stethoscope size={17} aria-hidden="true" />
                    </span>
                    <span className="care-row-text">
                      <strong>{patientName(entry)}</strong>
                      <small>
                        {recordedDate.format(new Date(entry.recorded_at))} ·{" "}
                        {entry.reason}
                      </small>
                    </span>
                    <span
                      className="care-status"
                      data-tone={entry.source_verified ? "success" : "review"}
                    >
                      {entry.source_verified
                        ? "Source vérifiée"
                        : "Source non confirmée"}
                    </span>
                    <NavigationFeedback />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="care-empty">
              <span className="care-icon">
                <FileText size={31} aria-hidden="true" />
              </span>
              <div>
                <strong>Aucune consultation documentée</strong>
                <p>
                  Les dernières saisies des dossiers autorisés apparaîtront ici.
                </p>
              </div>
            </div>
          )}
          <footer>
            <Link
              className="care-action care-action--coral"
              href="/consultations"
            >
              <FileText aria-hidden="true" />
              Voir l’historique
              <ArrowRight aria-hidden="true" />
              <NavigationFeedback />
            </Link>
          </footer>
        </section>
      </div>
      <details className="care-tools">
        <summary>
          <LayoutGrid size={22} aria-hidden="true" />
          <h2>Autres outils de gestion</h2>
          <ChevronDown size={20} aria-hidden="true" />
        </summary>
        <div className="care-tool-groups">
          {toolGroups.map(({ label, Icon, links }) => (
            <section key={label}>
              <h3>
                <Icon size={21} aria-hidden="true" />
                {label}
              </h3>
              <ul role="list">
                {links.map(({ label: item, href, Icon: ItemIcon }) => (
                  <li key={href}>
                    <Link className="care-card" href={href}>
                      <ItemIcon size={20} aria-hidden="true" />
                      {item}
                      <NavigationFeedback />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </details>
      <details className="dashboard-explanation care-explanation">
        <summary>Comprendre les suivis vaccinaux</summary>
        <p>
          Une référence non confirmée n’est pas un rendez-vous manqué. Les soins
          enregistrés par un autre soignant autorisé recalculent les suivis
          vaccinaux, sans annuler les consultations indépendantes.
        </p>
      </details>
    </>
  );
}
