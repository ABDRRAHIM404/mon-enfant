import Link from "next/link";
import {
  UsersRound,
  Stethoscope,
  Syringe,
  CalendarDays,
  ArrowUpRight,
  ChartNoAxesCombined,
  ClipboardPlus,
  FolderPlus,
  QrCode,
} from "lucide-react";
import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicianShell } from "@/components/clinician/shell";
import { AppointmentCard } from "@/components/appointments/card";
import { LiveRefresh } from "@/components/appointments/live-refresh";
import type { AppointmentPage } from "@/lib/appointments/types";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  const { profile, supabase } = await requireApprovedDoctor();
  const [registry, appointments, vaccines, consultations, capabilities] =
    await Promise.all([
      supabase.rpc("registry_summary"),
      supabase.rpc("appointment_worklist", { p_bucket: "today" }),
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
  const counts = registry.data as {
      patients: number;
      uncertain_history: number;
      pending_requests: number;
      facilities: number;
    },
    visits = appointments.data as AppointmentPage,
    refs = vaccines.data as { counts: Record<string, number> };
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
  const summaries = [
    {
      count: counts.patients,
      label: "Enfants de mon registre",
      href: "/patients",
      Icon: UsersRound,
    },
    {
      count: recent.total,
      label: "Consultations documentées",
      href: "/consultations",
      Icon: Stethoscope,
    },
    {
      count: refs.counts.potentially_overdue_unconfirmed ?? 0,
      label: "Références vaccinales à revoir",
      href: "/follow-up?mode=vaccines",
      Icon: Syringe,
    },
  ];
  const shortcuts = [
    {
      label: "Consultation",
      detail: "Ouvrir le dossier de l’enfant",
      href: "/consultations",
      kind: "consultation",
      Icon: ClipboardPlus,
    },
    {
      label: "Vaccination",
      detail: "Documenter une dose",
      href: "/vaccinations",
      kind: "vaccination",
      Icon: Syringe,
    },
    {
      label: "Croissance",
      detail: "Ajouter une mesure",
      href: "/growth",
      kind: "growth",
      Icon: ChartNoAxesCombined,
    },
    {
      label: "Rendez-vous",
      detail: "Planifier un créneau",
      href: "/appointments/new",
      kind: "appointment",
      Icon: CalendarDays,
    },
  ].filter(({ kind }) => allowed.includes(kind));
  const workDate = new Intl.DateTimeFormat("fr-MA", {
    dateStyle: "full",
    timeZone: "Africa/Casablanca",
  }).format(new Date());
  return (
    <ClinicianShell active="home" profile={profile}>
      <div className="clinical-day-banner">
        <div>
          <p>{workDate}</p>
          <h1 id="main-content" tabIndex={-1}>
            Ma journée de soins
          </h1>
        </div>
        <div className="actions">
          <Link className="button secondary" href="/patients/new">
            <FolderPlus aria-hidden="true" /> Ajouter un enfant
          </Link>
          <Link className="button secondary" href="/share">
            <QrCode aria-hidden="true" /> Scanner un QR partagé
          </Link>
        </div>
      </div>
      <section
        className="clinical-start"
        aria-labelledby="clinical-start-heading"
      >
        <div className="clinical-start-heading">
          <h2 id="clinical-start-heading">Démarrer un soin</h2>
          <Link className="text-link" href="/account/clinical-permissions">
            Mes habilitations
          </Link>
        </div>
        {shortcuts.length ? (
          <ul className="clinical-shortcuts" role="list">
            {shortcuts.map(({ label, detail, href, Icon }) => (
              <li key={href}>
                <Link href={href}>
                  <span className="clinical-shortcut-icon">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{label}</strong>
                    <small>{detail}</small>
                  </span>
                  <ArrowUpRight size={16} aria-hidden="true" />
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
      <nav
        className="clinical-overview-summary"
        aria-label="Dossiers et suivis"
      >
        {summaries.map(({ count, label, href, Icon }) => (
          <Link href={href} key={href}>
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
            <strong>{count}</strong>
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        ))}
      </nav>
      <div className="soignant-daily-grid clinical-priority-grid">
        <section className="panel">
          <div className="clinical-section-header">
            <CalendarDays size={20} aria-hidden="true" />
            <h2>Rendez-vous du jour</h2>
            <span className="workspace-chip">{visits.total}</span>
          </div>
          <LiveRefresh />
          {visits.items.length ? (
            visits.items.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))
          ) : (
            <p className="empty-state">
              Aucun rendez-vous en attente aujourd’hui.
            </p>
          )}
          <Link className="text-link" href="/follow-up?bucket=today">
            Ouvrir la file du jour
          </Link>
        </section>
        <section className="panel">
          <h2>Dernières consultations documentées</h2>
          <p className="fine">
            Ordre d’enregistrement dans vos dossiers actuellement autorisés.
          </p>
          <div className="soignant-recent-list">
            {recent.items.map((entry) => (
              <article key={entry.id}>
                <div>
                  <h3>
                    <Link
                      href={`/patients/${entry.child_id}/records/${entry.root_id}`}
                    >
                      {[entry.given_name, entry.family_name]
                        .filter(Boolean)
                        .join(" ") || "Identité non renseignée"}
                    </Link>
                  </h3>
                  <p>{entry.reason}</p>
                  <small>
                    Enregistrée le{" "}
                    {new Intl.DateTimeFormat("fr-MA", {
                      dateStyle: "medium",
                      timeZone: "Africa/Casablanca",
                    }).format(new Date(entry.recorded_at))}{" "}
                    · Révision {entry.revision}
                  </small>
                </div>
                <span className="workspace-chip">
                  {entry.source_verified
                    ? "Source vérifiée"
                    : "Source non confirmée"}
                </span>
              </article>
            ))}
          </div>
          {!recent.items.length && (
            <p className="empty-state">
              Aucune consultation documentée dans vos dossiers autorisés.
            </p>
          )}
          <Link className="text-link" href="/consultations">
            Consulter les historiques
          </Link>
        </section>
      </div>
      <details className="dashboard-explanation">
        <summary>Comprendre les suivis vaccinaux</summary>
        <p>
          Une référence non confirmée n’est pas un rendez-vous manqué. Les soins
          enregistrés par un autre soignant autorisé recalculent les suivis
          vaccinaux, sans annuler les consultations indépendantes.
        </p>
      </details>
      <section className="panel">
        <h2>Continuer votre travail</h2>
        <p className="fine">
          {counts.pending_requests} demande(s) à examiner ·{" "}
          {counts.uncertain_history} historique(s) inconnu(s) ou partiel(s) ·{" "}
          {counts.facilities} lieu(x) d’exercice déclaré(s).
        </p>
        <div className="tabs">
          <Link href="/patients/new?source=paper">
            Transcrire un dossier papier
          </Link>
          <Link href="/patients/link">Rattacher un dossier existant</Link>
          <Link href="/appointments">Ouvrir le calendrier</Link>
          <Link href="/vaccines">Référentiel vaccinal et versions</Link>
          <Link href="/access-requests">Demandes d’accès</Link>
          <Link href="/registration-reviews">Revues d’inscription</Link>
          <Link href="/parent-requests">Demandes des parents</Link>
          <Link href="/practices">Lieux d’exercice</Link>
          <Link href="/provisional">Mes dossiers provisoires</Link>
        </div>
        <p className="fine">
          Aucun statut vaccinal manqué n’est déduit d’un historique absent. Les
          références et les dates de remplacement restent soumises à une revue
          clinique.
        </p>
      </section>
    </ClinicianShell>
  );
}
