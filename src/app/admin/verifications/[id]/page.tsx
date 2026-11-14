import Link from "next/link";
import { notFound } from "next/navigation";
import { requireReviewer } from "@/lib/auth";
import { AdminNav } from "@/components/verification/admin-nav";
import {
  ReviewForm,
  ApprovalNoticeRetryForm,
} from "@/components/verification/review-form";
import { requestStatusLabels } from "@/lib/verification/validation";
export const dynamic = "force-dynamic";
export default async function Review({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireReviewer();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: request, error } = await supabase
    .from("verification_requests")
    .select("*,verification_decisions(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Impossible de charger ce dossier.");
  if (!request) notFound();
  const notice =
    request.status === "approved"
      ? await supabase.rpc("approval_notification_status", { p_request_id: id })
      : null;
  const noticeState =
    typeof notice?.data?.state === "string" ? notice.data.state : "unavailable";
  const noticeLabels: Record<string, string> = {
    pending: "En attente",
    sending: "Transmission en cours",
    retry: "Nouvelle tentative prévue",
    accepted: "Transmise au service d’email",
    failed: "Envoi à vérifier",
    needs_review: "Vérification nécessaire",
    cancelled: "Annulée",
    unavailable: "Suivi indisponible",
  };
  return (
    <main className="account-page wide">
      <AdminNav />
      <section className="page-heading">
        <Link className="text-link" href="/admin/verifications">
          ← File de vérification
        </Link>
        <h1 id="main-content" tabIndex={-1}>
          {request.display_name}
        </h1>
        <p className="status">{requestStatusLabels[request.status]}</p>
      </section>
      <div className="two-columns">
        <section className="panel">
          <h2>Justificatifs et identité</h2>
          <dl className="details">
            <dt>Matricule déclaré</dt>
            <dd>{request.registration_number}</dd>
            <dt>Établissement déclaré</dt>
            <dd>{request.facility_name}</dd>
            <dt>Soumis le</dt>
            <dd>
              {new Date(request.submitted_at).toLocaleString("fr-MA", {
                timeZone: "Africa/Casablanca",
              })}
            </dd>
          </dl>
          <a
            className="button secondary"
            href={`/admin/evidence/${request.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Télécharger le justificatif privé
          </a>
          <p className="fine">
            Accès enregistré · Lien temporaire de 60 secondes · Ne partagez pas
            le document.
          </p>
        </section>
        <section className="panel">
          <h2>
            {request.status === "under_review"
              ? "Décision de vérification"
              : "Décision enregistrée"}
          </h2>
          {request.status === "under_review" ? (
            <ReviewForm requestId={id} />
          ) : (
            (Array.isArray(request.verification_decisions)
              ? request.verification_decisions
              : request.verification_decisions
                ? [request.verification_decisions]
                : []
            ).map(
              (d: {
                id: string;
                decision: string;
                reason: string;
                reviewer_id: string;
                created_at: string;
              }) => (
                <article key={d.id} className="record-list">
                  <strong>{requestStatusLabels[d.decision]}</strong>
                  <p>{d.reason}</p>
                  <p className="fine">
                    Auteur : {d.reviewer_id}
                    <br />
                    {new Date(d.created_at).toLocaleString("fr-MA", {
                      timeZone: "Africa/Casablanca",
                    })}
                  </p>
                </article>
              ),
            )
          )}
        </section>
      </div>
      {request.status === "approved" ? (
        <section className="panel">
          <h2>Email d’approbation</h2>
          <p className="status">
            {noticeLabels[noticeState] ?? noticeLabels.unavailable}
          </p>
          <p className="fine">
            La décision est enregistrée. La transmission de l’email est suivie
            séparément ; elle ne confirme pas sa réception.
          </p>
          {["pending", "retry"].includes(noticeState) ? (
            <ApprovalNoticeRetryForm requestId={id} />
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
