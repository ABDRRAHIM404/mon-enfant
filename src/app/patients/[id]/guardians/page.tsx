import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicalWorkspace } from "@/components/clinician/care-workspace";
import {
  GuardianInviteForm,
  GuardianReviewForm,
  GuardianRevokeForm,
} from "@/components/parents/guardian-forms";
import { uuidPattern } from "@/lib/registry/types";
export const dynamic = "force-dynamic";
type Overview = {
  generated_at: string;
  default_expires_on: string;
  invitations: {
    id: string;
    recipient_email: string;
    expires_at: string;
    revoked_at: string | null;
    consumed_at: string | null;
  }[];
  claims: {
    id: string;
    revision: number;
    state: string;
    display_name: string;
    email: string;
    declared_relationship: string;
  }[];
  links: {
    id: string;
    display_name: string;
    relationship: string;
    expires_at: string;
    revoked_at: string | null;
    can_export: boolean;
  }[];
};
export default async function Guardians({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const { data, error } = await supabase.rpc("doctor_guardian_overview", {
    p_child_id: id,
  });
  if (error?.code === "42501") notFound();
  if (error) throw new Error("Impossible de charger les responsables.");
  const view = data as Overview;
  const expiresOn = view.default_expires_on;
  return (
    <ClinicalWorkspace active="children" childId={id} section="guardians">
      <section className="page-heading">
        <Link href={`/patients/${id}`}>← Dossier enfant</Link>
        <h1 id="main-content" tabIndex={-1}>
          Parents et responsables
        </h1>
        <p>
          Une invitation ne remplace pas la vérification d’identité et
          d’autorité parentale. Les accès au carnet sont distincts des
          autorisations des professionnels.
        </p>
      </section>
      <section className="panel">
        <h2>Inviter un responsable</h2>
        <GuardianInviteForm childId={id} />
      </section>
      <section className="panel">
        <h2>Demandes à vérifier</h2>
        {view.claims.filter((c) => c.state === "pending").length === 0 ? (
          <p>Aucune demande en attente.</p>
        ) : (
          view.claims
            .filter((c) => c.state === "pending")
            .map((c) => (
              <article className="record-list" key={c.id}>
                <h3>{c.display_name}</h3>
                <p>
                  {c.email} · lien déclaré : {c.declared_relationship}
                </p>
                <GuardianReviewForm
                  claimId={c.id}
                  revision={c.revision}
                  childId={id}
                  operationId={randomUUID()}
                  expiresOn={expiresOn}
                />
              </article>
            ))
        )}
      </section>
      <section className="panel">
        <h2>Accès des responsables</h2>
        {view.links.length === 0 ? (
          <p>Aucun responsable lié à ce carnet.</p>
        ) : (
          view.links.map((g) => (
            <article className="record-list" key={g.id}>
              <h3>{g.display_name}</h3>
              <p>
                {g.relationship} · jusqu’au{" "}
                {new Date(g.expires_at).toLocaleDateString("fr-MA", {
                  timeZone: "Africa/Casablanca",
                })}{" "}
                ·{" "}
                {g.revoked_at
                  ? "retiré"
                  : g.can_export
                    ? "consultation et export"
                    : "consultation"}
              </p>
              {!g.revoked_at ? (
                <GuardianRevokeForm id={g.id} childId={id} kind="link" />
              ) : null}
            </article>
          ))
        )}
      </section>
      <section className="panel">
        <h2>Invitations et historique</h2>
        {view.invitations.length === 0 ? (
          <p>Aucune invitation.</p>
        ) : (
          view.invitations.map((i) => (
            <article className="record-list" key={i.id}>
              <h3>{i.recipient_email}</h3>
              <p>
                {i.revoked_at
                  ? "Annulée"
                  : i.consumed_at
                    ? "Utilisée pour une demande"
                    : new Date(i.expires_at).getTime() <=
                        new Date(view.generated_at).getTime()
                      ? "Expirée"
                      : "En attente"}{" "}
                · valable jusqu’au{" "}
                {new Date(i.expires_at).toLocaleString("fr-MA", {
                  timeZone: "Africa/Casablanca",
                })}
              </p>
              {!i.revoked_at && !i.consumed_at ? (
                <GuardianRevokeForm id={i.id} childId={id} kind="invitation" />
              ) : null}
            </article>
          ))
        )}
      </section>
    </ClinicalWorkspace>
  );
}
