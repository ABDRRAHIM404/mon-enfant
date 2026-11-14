import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ParentSettingsForm } from "@/components/parents/request-forms";
import type { ParentSettings } from "@/lib/parents/types";
export const dynamic = "force-dynamic";
export default async function Settings() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("parent_settings");
  if (error) throw new Error("Impossible de charger les préférences.");
  const view = data as {
    settings: ParentSettings;
    history: { id: string; created_at: string }[];
    history_total: number;
  };
  return (
    <main className="account-page">
      <Link href="/parent">← Mon espace parent</Link>
      <section className="panel">
        <h1 id="main-content" tabIndex={-1}>
          Contact et confidentialité
        </h1>
        <ParentSettingsForm settings={view.settings} />
      </section>
      <section className="panel">
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
        <Link href="/account">Consulter mon compte</Link>
      </section>
      <section className="panel">
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
    </main>
  );
}
