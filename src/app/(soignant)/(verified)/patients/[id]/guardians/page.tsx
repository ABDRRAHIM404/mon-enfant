import { ChevronDown } from "lucide-react";
import {
  ChildPageHeading,
  ChildPanel,
  ChildStatus,
} from "@/components/clinician/patient-profile";
import { ConfirmChildAction } from "@/components/clinician/confirm-child-action";
import { appointmentTime } from "@/lib/appointments/calendar";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
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
  const now = Date.parse(view.generated_at);
  const pending = view.claims.filter((claim) => claim.state === "pending");
  const reviewed = view.claims.filter((claim) => claim.state !== "pending");
  const relationship: Record<string, string> = {
    mother: "Mère",
    father: "Père",
    legal_guardian: "Représentant légal",
    other: "Autre responsable",
  };
  return (
    <>
      <ChildPageHeading
        title="Accès des parents"
        description="Vérifiez les demandes et gérez les droits des responsables."
      />
      <p className="notice">
        Vérifiez l’identité et l’autorité parentale avant d’accorder le carnet.
        Un contact déclaré, un numéro de téléphone ou une invitation ne suffit
        pas.
      </p>
      <div className="child-grid child-guardian-grid">
        <ChildPanel title="Accès des responsables">
          {view.links.length ? (
            <ul className="child-list">
              {view.links.map((g) => {
                const active = !g.revoked_at && Date.parse(g.expires_at) > now;
                return (
                  <li key={g.id}>
                    <h3>{g.display_name}</h3>
                    <ChildStatus tone={active ? "green" : "neutral"}>
                      {g.revoked_at
                        ? "Révoqué"
                        : active
                          ? "Autorisé"
                          : "Expiré"}
                    </ChildStatus>
                    <p>
                      {relationship[g.relationship] ?? g.relationship} ·
                      Échéance {appointmentTime(g.expires_at)}
                    </p>
                    {active && (
                      <p>
                        {g.can_export
                          ? "Consultation et téléchargement du carnet"
                          : "Consultation du carnet"}
                      </p>
                    )}
                    {!g.revoked_at && (
                      <details className="child-expander">
                        <summary>
                          Retirer l’accès{" "}
                          <ChevronDown size={17} aria-hidden="true" />
                        </summary>
                        <div className="child-expander-body">
                          <ConfirmChildAction
                            title="Retirer l’accès au carnet ?"
                            description="Le responsable perdra l’accès à ce carnet. Le motif restera dans l’historique."
                            confirmLabel="Confirmer le retrait"
                          >
                            <GuardianRevokeForm
                              id={g.id}
                              childId={id}
                              kind="link"
                            />
                          </ConfirmChildAction>
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty-state">Aucun responsable lié à ce carnet.</p>
          )}
        </ChildPanel>
        <ChildPanel title="Inviter un responsable">
          <GuardianInviteForm childId={id} />
        </ChildPanel>
      </div>
      <ChildPanel
        title={`Demandes à vérifier (${pending.length})`}
        className="child-panel-spaced"
      >
        {pending.length ? (
          <div className="child-record-list">
            {pending.map((c) => (
              <details className="child-subcard child-expander" key={c.id}>
                <summary>
                  <strong>{c.display_name}</strong>
                  <ChildStatus tone="amber">En attente</ChildStatus>
                  <ChevronDown size={17} aria-hidden="true" />
                </summary>
                <div className="child-expander-body">
                  <p>
                    {c.email} · Lien déclaré :{" "}
                    {relationship[c.declared_relationship] ??
                      c.declared_relationship}
                  </p>
                  <ConfirmChildAction
                    title="Enregistrer la décision ?"
                    description="La décision et son motif seront conservés. Une approbation accorde les droits sélectionnés pour ce carnet."
                    confirmLabel="Confirmer la décision"
                  >
                    <GuardianReviewForm
                      claimId={c.id}
                      revision={c.revision}
                      childId={id}
                      operationId={randomUUID()}
                      expiresOn={view.default_expires_on}
                    />
                  </ConfirmChildAction>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="empty-state">Aucune demande en attente.</p>
        )}
      </ChildPanel>
      <ChildPanel title="Invitations et historique">
        {view.invitations.length ? (
          <ul className="child-list">
            {view.invitations.map((i) => {
              const active =
                !i.revoked_at &&
                !i.consumed_at &&
                Date.parse(i.expires_at) > now;
              return (
                <li key={i.id}>
                  <h3>{i.recipient_email}</h3>
                  <ChildStatus tone={active ? "amber" : "neutral"}>
                    {i.revoked_at
                      ? "Annulée"
                      : i.consumed_at
                        ? "Utilisée pour une demande"
                        : active
                          ? "En attente"
                          : "Expirée"}
                  </ChildStatus>
                  <p>Échéance {appointmentTime(i.expires_at)}</p>
                  {!i.revoked_at && !i.consumed_at && (
                    <details className="child-expander">
                      <summary>
                        Annuler l’invitation{" "}
                        <ChevronDown size={17} aria-hidden="true" />
                      </summary>
                      <div className="child-expander-body">
                        <ConfirmChildAction
                          title="Annuler cette invitation ?"
                          description="Le lien personnel ne pourra plus servir à déposer une demande."
                          confirmLabel="Confirmer l’annulation"
                        >
                          <GuardianRevokeForm
                            id={i.id}
                            childId={id}
                            kind="invitation"
                          />
                        </ConfirmChildAction>
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-state">Aucune invitation.</p>
        )}
        {reviewed.length > 0 && (
          <details className="child-subcard child-expander child-panel-spaced">
            <summary>
              Demandes traitées ({reviewed.length}){" "}
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <div className="child-expander-body">
              <ul className="child-list">
                {reviewed.map((claim) => (
                  <li key={claim.id}>
                    <strong>{claim.display_name}</strong>{" "}
                    <ChildStatus
                      tone={claim.state === "approved" ? "green" : "neutral"}
                    >
                      {claim.state === "approved"
                        ? "Approuvée"
                        : claim.state === "rejected"
                          ? "Refusée"
                          : "Annulée"}
                    </ChildStatus>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}
      </ChildPanel>
    </>
  );
}
