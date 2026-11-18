import type { ParentWorkspaceData } from "@/lib/parents/types";
import { DashboardHeading } from "@/components/dashboard/heading";
import { ParentWorkflow } from "@/components/parents/workflow";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ParentSharePanel } from "@/components/sharing/parent-share-panel";
import type { ShareList } from "@/lib/sharing/types";
import { requireUser } from "@/lib/auth";
import { uuidPattern } from "@/lib/registry/types";
export const dynamic = "force-dynamic";
type History = {
  items: {
    id: string;
    occurred_at: string;
    entity_type: string;
    action: string;
    actor_type: string;
    professional_id: string | null;
  }[];
  total: number;
  page: number;
  since: string;
};
const activity: Record<string, string> = {
  guardian_share_issued: "Création d’un partage temporaire",
  guardian_share_redeemed: "Ouverture d’un partage par un soignant",
  guardian_share_read: "Lecture temporaire autorisée",
  guardian_share_revoked: "Révocation d’un partage temporaire",
  guardian_calendar_read: "Consultation du calendrier parent",
  guardian_vaccine_references_read:
    "Consultation des références vaccinales parent",
  child_lookup_read: "Recherche par identifiant autorisée",
  guardian_notifications_read: "Consultation des notifications",
  child_profile_read: "Consultation de l’identité",
  clinical_timeline_read: "Consultation du dossier clinique",
  clinical_history_read: "Consultation des révisions cliniques",
  clinical_export: "Export clinique",
  vaccine_items_read: "Consultation des références vaccinales",
  vaccine_item_history_read: "Historique des références vaccinales",
  vaccine_items_export: "Export des références vaccinales",
  vaccination_duplicate_check: "Vérification d’un doublon vaccinal",
  patient_appointments_read: "Consultation des rendez-vous",
  appointment_history_read: "Historique d’un rendez-vous",
  appointments_export: "Export des rendez-vous",
  appointment_calendar_read: "Consultation du calendrier",
  appointment_worklist_read: "Consultation des suivis",
  vaccine_followup_read: "Consultation du suivi vaccinal",
  patient_visit_overview_read: "Consultation de la continuité des soins",
  appointment_item_options_read: "Consultation des références pour rendez-vous",
  guardian_booklet_read: "Consultation du carnet parent",
  guardian_booklet_export: "Téléchargement du carnet parent",
  guardian_child_list_read: "Consultation de la liste des carnets",
  guardian_management_read: "Gestion des responsables",
  parent_correction_requested: "Demande de vérification créée",
  parent_correction_responded: "Traitement d’une demande",
  parent_requests_read: "Consultation des demandes",
  doctor_parent_requests_read: "Consultation professionnelle des demandes",
  guardian_access_history_read: "Consultation de l’historique des accès",
};
export default async function Privacy({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase } = await requireUser();
  const { id } = await params;
  const page = Number((await searchParams).page ?? 1);
  if (
    !uuidPattern.test(id) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 10000
  )
    notFound();
  const { data, error } = await supabase.rpc("parent_access_history", {
    p_child_id: id,
    p_page: page,
  });
  if (error?.code === "42501") notFound();
  if (error) throw new Error("Impossible de charger l’historique des accès.");
  const view = data as History;
  const shares = await supabase.rpc("list_clinician_shares", {
    p_child_id: id,
  });
  if (shares.error) notFound();
  const workspace = await supabase.rpc("parent_workspace");
  if (workspace.error)
    throw Error("Impossible de confirmer le carnet de votre enfant.");
  const child = (workspace.data as ParentWorkspaceData).children.find(
    (child) => child.id === id,
  );
  if (!child) notFound();
  return (
    <ParentWorkflow
      active="access"
      childId={id}
      childSection="privacy"
      child={child}
    >
      <Link href={`/parent/children/${id}`}>← Carnet de mon enfant</Link>
      <DashboardHeading
        title="Partage et accès"
        description="Gardez le contrôle des partages et retrouvez l’activité de consultation du carnet."
        section="access"
      />
      <section className="parent-context-note">
        <p>
          Activité de consultation et demandes enregistrées depuis le début de
          votre accès actuel : {new Date(view.since).toLocaleString("fr-MA")}.
        </p>
        <p className="fine">
          Les coordonnées et l’identité des autres responsables ne sont pas
          affichées. Cet historique de consultation ne remplace pas l’historique
          clinique conservé avec chaque soin.
        </p>
      </section>
      <section className="panel">
        <h2>Historique des accès</h2>
        <p className="fine">{view.total} événements · 50 par page.</p>
        <div className="record-list">
          {view.items.map((event) => (
            <article key={event.id}>
              <h3>{activity[event.entity_type] ?? "Consultation du carnet"}</h3>
              <p>
                {new Date(event.occurred_at).toLocaleString("fr-MA", {
                  timeZone: "Africa/Casablanca",
                })}{" "}
                ·{" "}
                {event.actor_type === "self"
                  ? "Vous"
                  : event.actor_type === "professional"
                    ? `Professionnel ${event.professional_id ?? "autorisé"}`
                    : "Autre responsable autorisé"}
              </p>
            </article>
          ))}
        </div>
        {!view.items.length && <p>Aucun événement affiché.</p>}
      </section>
      <nav className="actions" aria-label="Pages de l’historique">
        {page > 1 && (
          <Link className="button secondary" href={`?page=${page - 1}`}>
            Page précédente
          </Link>
        )}
        {page * 50 < view.total && (
          <Link className="button secondary" href={`?page=${page + 1}`}>
            Page suivante
          </Link>
        )}
      </nav>
      <ParentSharePanel childId={id} list={shares.data as ShareList} />
      <p>
        Pour signaler une activité qui vous surprend,{" "}
        <Link href={`/parent/children/${id}/requests`}>
          contactez le professionnel par une demande
        </Link>
        . Vous pouvez retirer votre accès depuis le carnet.
      </p>
    </ParentWorkflow>
  );
}
