import { ParentWorkflow } from "@/components/parents/workflow";
import { DashboardHeading } from "@/components/dashboard/heading";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";
export const dynamic = "force-dynamic";
export default async function ParentAccount() {
  const { user } = await requireUser();
  return (
    <ParentWorkflow active="settings">
      <DashboardHeading
        title="Mon compte parent"
        description="Votre connexion, vos préférences et la sécurité de votre compte."
        section="settings"
      />
      <section className="panel parent-account-panel">
        <span className="eyebrow">COMPTE PARENT</span>
        <h2>Informations du compte</h2>
        <p>{user.email}</p>
        <p>
          Votre compte ne donne accès qu’aux carnets partagés après vérification
          de votre qualité de responsable.
        </p>
        <p>
          <Link className="button primary" href="/parent/settings">
            Mes préférences
          </Link>
        </p>
        <p>
          <Link className="button secondary" href="/forgot-password">
            Modifier mon mot de passe
          </Link>
        </p>
        <form action={signOut}>
          <button className="button secondary">Se déconnecter</button>
        </form>
      </section>
    </ParentWorkflow>
  );
}
