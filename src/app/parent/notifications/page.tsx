import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { MarkUpdatesRead } from "@/components/parents/notification-form";
import type { ParentUpdates } from "@/lib/parents/types";
import { clinicalLabels, type ClinicalKind } from "@/lib/clinical/types";
export const dynamic = "force-dynamic";
const labels: Record<string, string> = {
  access_approved: "Accès au carnet approuvé",
  care_recorded: "Nouvelle information enregistrée",
  care_corrected: "Information clinique corrigée ou retirée",
  appointment_updated: "Rendez-vous créé ou mis à jour",
  request_answered: "Réponse à votre demande",
  claim_rejected: "Demande d’accès refusée",
  access_revoked: "Un accès au carnet a été retiré",
  access_expired: "Un accès au carnet est arrivé à échéance",
};
export default async function Notifications({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase } = await requireUser();
  const page = Number((await searchParams).page ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) notFound();
  const { data, error } = await supabase.rpc("parent_updates", {
    p_page: page,
  });
  if (error) throw new Error("Impossible de charger les notifications.");
  const view = data as ParentUpdates;
  return (
    <main className="account-page wide">
      <Link href="/parent">← Mon espace parent</Link>
      <section className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          Mes notifications
        </h1>
        <p>
          {view.unread_total} non consultées · {view.total} événements.
        </p>
        <p className="fine">
          Actualités des carnets auxquels vous avez accès et statut de vos
          demandes. Les notifications ne constituent pas des conseils médicaux
          ni un envoi automatique de rappels par e-mail.
        </p>
      </section>
      {view.unread_total > 0 && <MarkUpdatesRead through={view.generated_at} />}
      <div className="record-list">
        {view.items.map((event) => (
          <article className="panel" key={`${event.kind}:${event.id}`}>
            <h2>{labels[event.kind]}</h2>
            {event.unread && <span className="notice">Nouveau</span>}
            <p>
              {new Date(event.occurred_at).toLocaleString("fr-MA", {
                timeZone: "Africa/Casablanca",
              })}
            </p>
            {event.child_id && (
              <p>
                {[event.given_name, event.family_name]
                  .filter(Boolean)
                  .join(" ") || "Identité inconnue"}
              </p>
            )}
            {event.clinical_kind && (
              <p>
                {clinicalLabels[event.clinical_kind as ClinicalKind]}
                {event.revision ? ` · version ${event.revision}` : ""}
              </p>
            )}
            {event.child_id ? (
              <Link
                className="text-link"
                href={
                  event.kind === "request_answered"
                    ? `/parent/children/${event.child_id}/requests`
                    : `/parent/children/${event.child_id}`
                }
              >
                {event.kind === "request_answered"
                  ? "Lire la réponse"
                  : "Ouvrir le carnet"}
              </Link>
            ) : (
              <Link className="text-link" href="/parent">
                Consulter mon espace parent
              </Link>
            )}
          </article>
        ))}
      </div>
      {!view.items.length && <p>Aucune notification pour le moment.</p>}
      <nav className="actions" aria-label="Pages des notifications">
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
    </main>
  );
}
