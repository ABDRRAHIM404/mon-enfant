import Link from "next/link";
import { ClinicianShell } from "@/components/clinician/shell";
import { canAccessClinicalWorkspace } from "@/lib/authorization";
import { Brand } from "@/components/brand";
import { getProfessional } from "@/lib/auth";
import { requestStatusLabels } from "@/lib/verification/validation";
import { SubmissionForm } from "@/components/verification/submission-form";
export const dynamic = "force-dynamic";
export default async function Verification() {
  const { user, profile, supabase } = await getProfessional();
  const { data: requests, error } = await supabase
    .from("verification_requests")
    .select(
      "id,submitted_at,status,registration_number,verification_decisions(reason,decision,created_at)",
    )
    .eq("professional_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(30);
  if (error) throw new Error("Impossible de charger vos demandes.");
  const canSubmit =
    profile &&
    ["doctor", "nurse"].includes(profile.role) &&
    ["unverified", "rejected"].includes(profile.verification_status);
  const clinician = profile?.role === "doctor" || profile?.role === "nurse";
  const content = (
    <>
      {!clinician && (
        <header>
          <Brand />
          <Link className="button secondary" href="/account">
            Mon compte
          </Link>
        </header>
      )}
      <section className="panel">
        <span className="eyebrow">VÉRIFICATION PROFESSIONNELLE</span>
        <h1 id="main-content" tabIndex={-1}>
          Présentez vos qualifications.
        </h1>
        <p className="muted">
          Votre dossier reste privé. Seuls les administrateurs expressément
          habilités peuvent examiner votre justificatif.
        </p>
        {canSubmit ? (
          <SubmissionForm />
        ) : (
          <div className="notice">
            {!profile
              ? "Activez votre profil depuis Mon compte avant de soumettre votre demande."
              : profile.verification_status === "under_review"
                ? "Votre demande est en cours d’examen. Vos dossiers provisoires restent privés. Les dossiers partagés nécessitent une approbation."
                : "Votre statut actuel ne permet pas une nouvelle soumission."}
          </div>
        )}
      </section>
      <section className="panel">
        <h2>Historique de vos demandes</h2>
        {!requests?.length ? (
          <p className="empty-state">Aucune demande soumise.</p>
        ) : (
          <div className="record-list">
            {requests.map((r) => (
              <article key={r.id}>
                <strong>{requestStatusLabels[r.status]}</strong>
                <p>Matricule : {r.registration_number}</p>
                <p className="fine">
                  {new Date(r.submitted_at).toLocaleString("fr-MA", {
                    timeZone: "Africa/Casablanca",
                  })}
                </p>
                {(Array.isArray(r.verification_decisions)
                  ? r.verification_decisions
                  : r.verification_decisions
                    ? [r.verification_decisions]
                    : []
                ).map(
                  (d: {
                    reason: string;
                    decision: string;
                    created_at: string;
                  }) => (
                    <p className="notice" key={d.created_at}>
                      Motif de décision : {d.reason}
                    </p>
                  ),
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
  return clinician ? (
    <ClinicianShell
      profile={profile}
      provisional={!canAccessClinicalWorkspace(profile)}
    >
      <div className="soignant-account-content">
        <div className="account-page">{content}</div>
      </div>
    </ClinicianShell>
  ) : (
    <main className="account-page">{content}</main>
  );
}
