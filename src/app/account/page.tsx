import {
  AdminShell,
  AdminHeading,
  AdminStatus,
} from "@/components/verification/admin-nav";
import Link from "next/link";
import { DashboardHeading } from "@/components/dashboard/heading";
import { ClinicianShell } from "@/components/clinician/shell";
import { ShieldCheck, Clock3 } from "lucide-react";
import { Brand } from "@/components/brand";
import { getProfessional } from "@/lib/auth";
import { canAccessClinicalWorkspace, statusLabels } from "@/lib/authorization";
import { initializeProfile, signOut } from "@/app/auth/actions";
export const dynamic = "force-dynamic";
export default async function Account() {
  const { user, profile, supabase } = await getProfessional();
  const [reviewPermission, clinicalPermission, catalogPermission] =
    profile?.role === "admin" && profile.verification_status === "approved"
      ? await Promise.all([
          supabase.rpc("can_review_professionals"),
          supabase.rpc("can_manage_clinical_permissions"),
          supabase.rpc("vaccine_catalog_permissions"),
        ])
      : [null, null, null];
  const canReview = reviewPermission?.data === true && !reviewPermission?.error;
  const canManageClinical =
    clinicalPermission?.data === true && !clinicalPermission?.error;
  const canManageCatalog =
    catalogPermission?.data?.manage === true && !catalogPermission?.error;
  if (profile?.role === "admin") {
    return (
      <AdminShell active="account">
        <AdminHeading
          section="account"
          title="Mon compte"
          description="Votre identité de connexion, votre sécurité et vos autorisations d’administration."
        />
        <div className="admin-account-grid">
          <section className="panel">
            <h2>Informations du compte</h2>
            <dl className="details">
              <dt>Adresse e-mail</dt>
              <dd>{user.email || "Non disponible"}</dd>
              <dt>Rôle</dt>
              <dd>Administrateur</dd>
              <dt>Statut</dt>
              <dd>
                <AdminStatus value={profile.verification_status}>
                  {statusLabels[profile.verification_status]}
                </AdminStatus>
              </dd>
            </dl>
          </section>
          <section className="panel">
            <h2>Sécurité</h2>
            <p className="muted">
              Gérez votre mot de passe depuis le parcours sécurisé de
              récupération.
            </p>
            <Link
              className="button secondary"
              href="/forgot-password?audience=clinician"
            >
              Changer mon mot de passe
            </Link>
          </section>
          <section className="panel">
            <h2>Mes autorisations</h2>
            <div className="admin-capability">
              <span>Revue des professionnels</span>
              <strong>{canReview ? "Autorisée" : "Non accordée"}</strong>
            </div>
            <div className="admin-capability">
              <span>Gestion des habilitations</span>
              <strong>
                {canManageClinical ? "Autorisée" : "Non accordée"}
              </strong>
            </div>
            <div className="admin-capability">
              <span>Gestion du catalogue vaccinal</span>
              <strong>{canManageCatalog ? "Autorisée" : "Non accordée"}</strong>
            </div>
            <p className="fine">
              Les permissions de chaque rubrique sont vérifiées à son ouverture.
              Le rôle administrateur ne donne pas accès aux carnets des enfants.
            </p>
          </section>
        </div>
      </AdminShell>
    );
  }
  const AccountTitle =
    profile && ["doctor", "nurse"].includes(profile.role) ? "h2" : "h1";
  const content = (
    <section className="account-page">
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
        <span className="eyebrow">
          Espace soignant · Médecins et infirmier(e)s
        </span>
        <AccountTitle
          id={
            profile && ["doctor", "nurse"].includes(profile.role)
              ? undefined
              : "main-content"
          }
          tabIndex={-1}
        >
          Votre statut de vérification
        </AccountTitle>
        <p className="muted">
          L’accès à l’espace clinique dépend de la validation de vos
          qualifications et de vos autorisations.
        </p>
        {profile && ["doctor", "nurse"].includes(profile.role) && (
          <section className="panel">
            <h2>Mon profil soignant</h2>
            <dl className="details">
              <div>
                <dt>Adresse e-mail du compte</dt>
                <dd>{user.email || "Non disponible"}</dd>
              </div>
              <div>
                <dt>Métier déclaré</dt>
                <dd>{profile.role === "nurse" ? "Infirmier(e)" : "Médecin"}</dd>
              </div>
              <div>
                <dt>Identifiant professionnel de la plateforme</dt>
                <dd>{profile.professional_id || "Non attribué"}</dd>
              </div>
            </dl>
            <p>
              La vérification professionnelle et les habilitations cliniques
              sont examinées séparément.
            </p>
            <Link
              className="text-link"
              href="/forgot-password?audience=clinician"
            >
              Changer ou récupérer mon mot de passe
            </Link>
          </section>
        )}
        <p className="status">
          <Clock3 size={16} />
          {profile
            ? statusLabels[profile.verification_status]
            : "Activation nécessaire"}
        </p>
        {!profile ? (
          <form action={initializeProfile}>
            <label htmlFor="role">Votre métier</label>
            <select id="role" name="role" required>
              <option value="doctor">Médecin</option>
              <option value="nurse">Infirmier(e)</option>
            </select>
            <button className="button primary">
              Activer mon espace soignant
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
        ) : ["doctor", "nurse"].includes(profile.role) &&
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
        {profile &&
          ["doctor", "nurse"].includes(profile.role) &&
          ["unverified", "under_review", "approved"].includes(
            profile.verification_status,
          ) && (
            <p>
              <Link className="button secondary" href="/provisional">
                Ouvrir mes dossiers provisoires
              </Link>
            </p>
          )}
        <p className="fine">
          Bêta de test · Données et documents fictifs uniquement
        </p>
      </section>
    </section>
  );
  if (profile && ["doctor", "nurse"].includes(profile.role)) {
    return (
      <ClinicianShell
        active="account"
        provisional={!canAccessClinicalWorkspace(profile)}
        profile={profile}
      >
        <DashboardHeading
          title="Mon compte soignant"
          description="Votre profil, votre sécurité et vos autorisations."
          section="settings"
          clinician
        />
        <div className="soignant-account-content">{content}</div>
      </ClinicianShell>
    );
  }
  return <main>{content}</main>;
}
