import Link from "next/link";
import { ShieldCheck, Clock3 } from "lucide-react";
import { Brand } from "@/components/brand";
import { getProfessional } from "@/lib/auth";
import { canAccessClinicalWorkspace, statusLabels } from "@/lib/authorization";
import { initializeProfile, signOut } from "@/app/auth/actions";
export const dynamic = "force-dynamic";
export default async function Account() {
  const { profile } = await getProfessional();
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
        ) : canAccessClinicalWorkspace(profile) ? (
          <Link className="button primary" href="/dashboard">
            Ouvrir mon espace
          </Link>
        ) : (
          <div className="notice">
            La soumission des justificatifs et la revue administrative seront
            disponibles lors de la prochaine étape. Votre compte ne donne
            actuellement aucun accès aux dossiers patients.
          </div>
        )}
        <p className="fine">Développement · Phase 1 du projet</p>
      </section>
    </main>
  );
}
