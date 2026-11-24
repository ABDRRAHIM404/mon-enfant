import {
  AdminShell,
  AdminHeading,
  AdminStatus,
} from "@/components/verification/admin-nav";
import Link from "next/link";
import { ClinicianAccountWorkspace } from "@/components/clinician/account/workspace";
import { registeredAccountName } from "@/lib/clinical/account-display-name";
import { readClinicalAttributions } from "@/lib/clinical/read-attribution";
import "./clinician-account.css";
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
  if (profile?.role === "doctor" || profile?.role === "nurse") {
    const verified = canAccessClinicalWorkspace(profile);
    const [names, capabilityResult] = await Promise.all([
      readClinicalAttributions(supabase, [user.id]),
      verified ? supabase.rpc("my_clinical_capabilities") : null,
    ]);
    const name =
      registeredAccountName(user.user_metadata) ?? names[user.id]?.name ?? null;
    const capabilities =
      capabilityResult &&
      !capabilityResult.error &&
      Array.isArray(capabilityResult.data)
        ? (capabilityResult.data as string[])
        : null;
    return (
      <ClinicianShell provisional={!verified} profile={profile}>
        <ClinicianAccountWorkspace
          profile={profile}
          name={name}
          email={user.email ?? null}
          capabilities={capabilities}
        />
      </ClinicianShell>
    );
  }

  return (
    <main>
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
          <h1 id="main-content" tabIndex={-1}>
            Votre statut de vérification
          </h1>
          <p className="muted">
            L’accès à l’espace clinique dépend de la validation de vos
            qualifications et de vos autorisations.
          </p>
          <p className="status">
            <Clock3 size={16} /> Activation nécessaire
          </p>
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
          <p className="fine">
            Bêta de test · Données et documents fictifs uniquement
          </p>
        </section>
      </section>
    </main>
  );
}
