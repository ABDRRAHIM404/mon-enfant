import Link from "next/link";
import { ShieldCheck, Clock3 } from "lucide-react";
import { Brand } from "@/components/brand";
import { getProfessional } from "@/lib/auth";
import { canAccessClinicalWorkspace, statusLabels } from "@/lib/authorization";
import { initializeProfile, signOut } from "@/app/auth/actions";
export const dynamic = "force-dynamic";
export default async function Account() {
  const { profile, supabase } = await getProfessional();
  const [reviewPermission, clinicalPermission] =
    profile?.role === "admin" && profile.verification_status === "approved"
      ? await Promise.all([
          supabase.rpc("can_review_professionals"),
          supabase.rpc("can_manage_clinical_permissions"),
        ])
      : [null, null];
  const canReview = reviewPermission?.data === true && !reviewPermission?.error;
  const canManageClinical =
    clinicalPermission?.data === true && !clinicalPermission?.error;
  return (
    <main className="account-page">
      <header>
        <Brand />
        <form action={signOut}>
          <button className="button secondary">Se déconnecter</button>
        </form>
      </header>
      <section className="account-card">
        <span className="round-icon">
          <ShieldCheck />
        </span>
        <span className="eyebrow">MON COMPTE PROFESSIONNEL</span>
        <h1>Votre statut de vérification</h1>
        <p className="muted">
          L’accès à l’espace clinique dépend de la validation de vos
          qualifications et de vos autorisations.
        </p>
        <p className="status">
          <Clock3 size={16} />
          {profile
            ? statusLabels[profile.verification_status]
            : "Activation nécessaire"}
        </p>
        {!profile ? (
          <form action={initializeProfile}>
            <button className="button primary">
              Activer mon espace professionnel
            </button>
          </form>
        ) : canReview ? (
          <Link className="button primary" href="/admin/verifications">
            Ouvrir l’administration
          </Link>
        ) : canManageClinical ? (
          <Link className="button primary" href="/admin/clinical-permissions">
            Gérer les habilitations cliniques
          </Link>
        ) : canAccessClinicalWorkspace(profile) ? (
          <Link className="button primary" href="/dashboard">
            Ouvrir mon espace
          </Link>
        ) : profile.role === "doctor" &&
          profile.verification_status !== "suspended" ? (
          <Link className="button primary" href="/verification">
            {profile.verification_status === "under_review"
              ? "Suivre ma demande"
              : "Soumettre mes justificatifs"}
          </Link>
        ) : (
          <div className="notice">
            Votre compte ne dispose actuellement d’aucun accès clinique.
            Contactez un administrateur habilité pour toute question sur votre
            statut.
          </div>
        )}
        {canReview && canManageClinical && (
          <p>
            <Link className="text-link" href="/admin/clinical-permissions">
              Gérer les habilitations cliniques
            </Link>
          </p>
        )}
        {canAccessClinicalWorkspace(profile) && (
          <p>
            <Link className="text-link" href="/account/clinical-permissions">
              Mes habilitations cliniques
            </Link>
          </p>
        )}
        <p className="fine">
          Environnement de développement · Données et documents fictifs
          uniquement
        </p>
      </section>
    </main>
  );
}
