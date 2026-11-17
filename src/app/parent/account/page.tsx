import { WorkspaceShell } from "@/components/workspace-shell";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";
export const dynamic = "force-dynamic";
export default async function ParentAccount() {
  const { user } = await requireUser();
  return (
    <WorkspaceShell area="parent" active="settings">
      <section className="account-card">
        <span className="eyebrow">COMPTE PARENT</span>
        <h1 id="main-content" tabIndex={-1}>
          Mon compte
        </h1>
        <p>{user.email}</p>
        <p>
          Votre compte ne donne accès qu’aux carnets partagés après vérification
          de votre qualité de responsable.
        </p>
        <p>
          <Link href="/parent/settings">Mes préférences</Link>
        </p>
        <p>
          <Link href="/forgot-password">Modifier mon mot de passe</Link>
        </p>
        <form action={signOut}>
          <button className="button secondary">Se déconnecter</button>
        </form>
      </section>
    </WorkspaceShell>
  );
}
