import Link from "next/link";
import { ParentProfileForm } from "@/components/parents/profile-form";
import { WorkspaceShell } from "@/components/workspace-shell";
import { requireUser } from "@/lib/auth";
import { ParentSettingsForm } from "@/components/parents/request-forms";
import type { ParentSettings } from "@/lib/parents/types";
export const dynamic = "force-dynamic";
export default async function Settings() {
  const { supabase, user } = await requireUser();
  const [preferences, workspace] = await Promise.all([
    supabase.rpc("parent_settings"),
    supabase.rpc("parent_workspace"),
  ]);
  const { data, error } = preferences;
  if (error || workspace.error)
    throw new Error("Impossible de charger les préférences.");
  const view = data as {
    settings: ParentSettings;
    history: { id: string; created_at: string }[];
    history_total: number;
  };
  return (
    <WorkspaceShell area="parent" active="settings">
      <Link href="/parent">← Mon espace parent</Link>
      <section className="workspace-heading">
        <span className="eyebrow">ESPACE PARENT</span>
        <h1 id="main-content" tabIndex={-1}>
          Paramètres
        </h1>
        <p className="muted">
          Gérez votre compte, vos contacts et vos préférences.
        </p>
      </section>
      <div className="workspace-overview-grid">
        <section className="workspace-surface">
          <h2>Informations du compte</h2>
          <p>{user.email}</p>
          <ParentProfileForm name={workspace.data?.profile?.display_name} />
          <p className="fine">
            Votre nom n’accorde aucun accès au carnet d’un enfant.
          </p>
        </section>
        <section className="workspace-surface">
          <h2>Sécurité</h2>
          <p>
            Vos accès aux carnets restent vérifiés séparément de votre compte.
          </p>
          <p>
            <Link className="button secondary" href="/forgot-password">
              Modifier mon mot de passe
            </Link>
          </p>
          <Link href="/parent/account">Consulter mon compte</Link>
        </section>
      </div>
      <section className="workspace-surface workspace-secondary">
        <h2>Contact et notifications</h2>
        <ParentSettingsForm settings={view.settings} />
      </section>
      <section className="workspace-surface workspace-secondary">
        <h2>Mes préférences et mon compte</h2>
        <p>
          Le contact reste privé à votre compte. Votre adresse de connexion est
          gérée dans le compte Auth ; le téléphone de contact ne prouve pas
          votre identité ou votre qualité de responsable.
        </p>
        <p>
          Vous pouvez retirer votre accès depuis chaque carnet. Pour consulter
          les accès à un enfant, ouvrez « Confidentialité et accès » depuis son
          carnet.
        </p>
        <Link href="/parent/account">Consulter mon compte</Link>
      </section>
      <section className="workspace-surface workspace-secondary">
        <h2>Historique des préférences</h2>
        <p className="fine">
          {view.history_total} enregistrements · les 50 plus récents sont
          affichés.
        </p>
        {view.history.length ? (
          <ul>
            {view.history.map((event) => (
              <li key={event.id}>
                Préférences enregistrées le{" "}
                {new Date(event.created_at).toLocaleString("fr-MA")}
              </li>
            ))}
          </ul>
        ) : (
          <p>Aucune préférence modifiée.</p>
        )}
      </section>
    </WorkspaceShell>
  );
}
