import Link from "next/link";
import { UsersRound, Stethoscope, Syringe, CalendarDays } from "lucide-react";
import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicianShell, ClinicianHeading } from "@/components/clinician/shell";
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
  const tiles: [number, string, string][] = [
    [counts.patients, "Enfants de mon registre", "/patients"],
    [recent.total, "Consultations documentées", "/consultations"],
    [
      refs.counts.potentially_overdue_unconfirmed || 0,
      "Références vaccinales à revoir",
      "/follow-up?mode=vaccines",
    ],
    [
      visits.counts.today || 0,
      "Rendez-vous aujourd’hui",
      "/follow-up?bucket=today",
    ],
  ];
  return (
    <ClinicianShell active="home" profile={profile}>
      <ClinicianHeading
        title="Tableau de bord"
        description="Vos dossiers autorisés, rendez-vous et suivis au même endroit."
      />
      <div className="soignant-heading-actions">
        <Link className="button primary" href="/patients/new">
          Ajouter un enfant
        </Link>
        {allowed.includes("consultation") && (
          <Link className="button secondary" href="/consultations">
            Nouvelle consultation
          </Link>
        )}
        {allowed.includes("vaccination") && (
          <Link className="button secondary" href="/vaccinations">
            Enregistrer une vaccination
          </Link>
        )}
        {allowed.includes("appointment") && (
          <Link className="button secondary" href="/appointments/new">
            Planifier un rendez-vous
          </Link>
        )}
      </div>
      <LiveRefresh />
      <div className="soignant-stats">
        {tiles.map(([count, label, href], index) => {
          const Icon = [UsersRound, Stethoscope, Syringe, CalendarDays][index];
          return (
            <Link className="panel stat-card" href={href} key={label}>
              <Icon size={28} aria-hidden="true" />
              <div>
                <strong>{count}</strong>
                <span>{label}</span>
              </div>
            </Link>
          );
        })}
      </div>
      <details className="dashboard-explanation">
        <summary>Comprendre les suivis vaccinaux</summary>
        <p>
          Une référence non confirmée n’est pas un rendez-vous manqué. Les soins
          enregistrés par un autre soignant autorisé recalculent les suivis
          vaccinaux, sans annuler les consultations indépendantes.
        </p>
      </details>
      <div className="soignant-daily-grid">
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
        <section className="panel">
          <h2>Aujourd’hui ({visits.total})</h2>
          {visits.items.length ? (
            visits.items.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))
          ) : (
            <p>Aucun rendez-vous en attente aujourd’hui.</p>
          )}
          <Link className="text-link" href="/follow-up?bucket=today">
            Toute la file du jour (30 rendez-vous par page)
          </Link>
        </section>
      </div>
      <section className="panel">
        <h2>Continuer votre travail</h2>
        <p className="fine">
          {counts.pending_requests} demande(s) à examiner ·{" "}
          {counts.uncertain_history} historique(s) inconnu(s) ou partiel(s) ·{" "}
          {counts.facilities} lieu(x) d’exercice déclaré(s).
        </p>
        <div className="tabs">
          <Link href="/patients/new">Ajouter un enfant</Link>
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
          <Link href="/share">Lire un partage parent</Link>
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
