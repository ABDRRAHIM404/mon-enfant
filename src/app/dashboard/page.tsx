import Link from "next/link";
import { requireApprovedDoctor } from "@/lib/auth";
import { WorkspaceShell } from "@/components/workspace-shell";
import { AppointmentCard } from "@/components/appointments/card";
import { LiveRefresh } from "@/components/appointments/live-refresh";
import type { AppointmentPage } from "@/lib/appointments/types";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  const { supabase } = await requireApprovedDoctor();
  const [registry, appointments, vaccines] = await Promise.all([
    supabase.rpc("registry_summary"),
    supabase.rpc("appointment_worklist", { p_bucket: "today" }),
    supabase.rpc("vaccine_followup_worklist", {
      p_bucket: "potentially_overdue_unconfirmed",
    }),
  ]);
  if (registry.error || appointments.error || vaccines.error)
    throw new Error("Impossible de charger le tableau de bord autorisé.");
  const counts = registry.data as {
      patients: number;
      uncertain_history: number;
      pending_requests: number;
      facilities: number;
    },
    visits = appointments.data as AppointmentPage,
    refs = vaccines.data as { counts: Record<string, number> };
  const tiles: [number, string, string][] = [
    [counts.patients, "Enfants de mon registre", "/patients"],
    [counts.uncertain_history, "Historiques inconnus ou partiels", "/patients"],
    [counts.pending_requests, "Demandes à examiner", "/access-requests"],
    [counts.facilities, "Lieux d’exercice déclarés", "/practices"],
    [
      visits.counts.today || 0,
      "Rendez-vous aujourd’hui",
      "/follow-up?bucket=today",
    ],
    [
      visits.counts.upcoming || 0,
      "Rendez-vous à venir",
      "/follow-up?bucket=upcoming",
    ],
    [
      visits.counts.missed_vaccinations || 0,
      "Rendez-vous vaccinaux passés à revoir",
      "/follow-up?bucket=missed_vaccinations",
    ],
    [
      visits.counts.resolved_by_other || 0,
      "Suivis résolus par une dose enregistrée ailleurs",
      "/follow-up?bucket=resolved_by_other",
    ],
    [
      refs.counts.potentially_overdue_unconfirmed || 0,
      "Références potentiellement dépassées / non confirmées",
      "/follow-up?mode=vaccines",
    ],
  ];
  return (
    <WorkspaceShell area="clinician">
      <div className="page-heading">
        <span className="eyebrow">ESPACE MÉDECIN / INFIRMIER(ÈRE)</span>
        <h1 id="main-content" tabIndex={-1}>
          Votre registre de soins.
        </h1>
        <p className="muted">
          Vos dossiers autorisés, rendez-vous et suivis actualisés.
        </p>
      </div>
      <LiveRefresh />
      <div className="stat-grid">
        {tiles.map(([count, label, href]) => (
          <Link className="panel stat-card" href={href} key={label}>
            <strong>{count}</strong>
            <span>{label}</span>
          </Link>
        ))}
      </div>
      <p className="notice">
        Une référence non confirmée n’est pas un rendez-vous manqué. Les soins
        enregistrés par un autre soignant autorisé recalculent les suivis
        vaccinaux, sans annuler les consultations indépendantes.
      </p>
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
      <section className="panel">
        <h2>Continuer votre travail</h2>
        <div className="tabs">
          <Link href="/patients/new">Inscrire un enfant</Link>
          <Link href="/patients/new?source=paper">
            Transcrire un dossier papier
          </Link>
          <Link href="/patients/link">Rattacher un dossier existant</Link>
          <Link href="/appointments">Ouvrir le calendrier</Link>
        </div>
        <p className="fine">
          Aucun statut vaccinal manqué n’est déduit d’un historique absent. Les
          références et les dates de remplacement restent soumises à une revue
          clinique.
        </p>
      </section>
    </WorkspaceShell>
  );
}
