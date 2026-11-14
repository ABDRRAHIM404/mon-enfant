import Link from "next/link";
import { redirect } from "next/navigation";
import { patientName, birthLabel } from "@/lib/registry/types";
import type { ParentWorkspaceData } from "@/lib/parents/types";
import { Brand } from "@/components/brand";
import { ParentProfileForm } from "@/components/parents/profile-form";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
export const dynamic = "force-dynamic";
export default async function ParentWorkspace({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const focus =
    view === "appointments"
      ? "appointments"
      : view === "documents"
        ? "documents"
        : null;
  if (!supabaseConfig()) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user || user.is_anonymous) redirect("/login");
  const { data, error } = await supabase.rpc("parent_workspace");
  if (error?.code === "42501") redirect("/login");
  if (error) throw new Error("Impossible de charger votre espace parent.");
  const workspace = data as ParentWorkspaceData;
  const { profile, children, claims } = workspace;
  return (
    <main className="account-page wide">
      <header className="workspace-nav">
        <Brand />
        <nav aria-label="Navigation parent">
          <Link href="/parent">Espace parent</Link>
          <Link href="/parent/notifications">Notifications</Link>
          <Link href="/parent/requests">Mes demandes</Link>
          <Link href="/parent/settings">Préférences</Link>
          <Link href="/parent/account">Mon compte</Link>
          <form action={signOut}>
            <button className="text-link">Se déconnecter</button>
          </form>
        </nav>
      </header>
      <section className="page-heading">
        <span className="eyebrow">ESPACE PARENT</span>
        <h1 id="main-content" tabIndex={-1}>
          {profile
            ? `Bienvenue, ${profile.display_name}`
            : "Bienvenue dans votre espace parent"}
        </h1>
        <p className="muted">
          Retrouvez le carnet de vos enfants après vérification de votre lien
          avec eux.
        </p>
      </section>
      <section className="panel">
        <h2>
          {focus === "appointments"
            ? "Les rendez-vous de mes enfants"
            : focus === "documents"
              ? "Les documents de mes enfants"
              : "Les carnets de mes enfants"}
        </h2>
        {focus && (
          <p className="muted">
            Choisissez un enfant dont le carnet vous est relié pour consulter{" "}
            {focus === "appointments"
              ? "ses rendez-vous."
              : "son carnet et ses documents."}
          </p>
        )}
        {children.length ? (
          <div className="record-list">
            {children.map((child) => (
              <article key={child.id}>
                <h3>
                  <Link
                    href={`/parent/children/${child.id}${focus === "appointments" ? "/appointments" : focus === "documents" ? "#documents" : ""}`}
                  >
                    {patientName(child)}
                  </Link>
                </h3>
                <p>
                  {birthLabel(child)} · {child.universal_id}
                </p>
                <p className="fine">
                  Accès vérifié jusqu’au{" "}
                  {new Date(child.expires_at).toLocaleDateString("fr-MA", {
                    timeZone: "Africa/Casablanca",
                  })}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p>
            Aucun carnet relié pour le moment. Une demande en attente ne donne
            pas encore accès aux informations de l’enfant.
          </p>
        )}
      </section>
      {claims.length > 0 && (
        <section className="panel">
          <h2>Mes demandes d’accès</h2>
          <div className="record-list">
            {claims.map((claim) => (
              <article key={claim.id}>
                <p>
                  {
                    (
                      {
                        pending: "En attente de vérification",
                        approved: "Demande approuvée",
                        rejected: "Demande refusée",
                        cancelled: "Demande annulée",
                      } as Record<string, string>
                    )[claim.state]
                  }
                </p>
                <p className="fine">
                  Soumise le{" "}
                  {new Date(claim.created_at).toLocaleDateString("fr-MA")} ·
                  Référence {claim.id}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
      <div className="two-columns">
        <section className="panel">
          <h2>Mon profil</h2>
          <ParentProfileForm name={profile?.display_name} />
          <p className="fine">
            Renseigner votre nom n’accorde aucun accès à un dossier médical.
          </p>
        </section>
        <section className="panel">
          <h2>Relier le carnet d’un enfant</h2>
          <p>
            Le professionnel qui suit votre enfant vous remettra une invitation
            personnelle. Votre identité et votre qualité de responsable devront
            être vérifiées avant l’ouverture du carnet.
          </p>
          <Link className="button secondary" href="/parent/invitation">
            Utiliser mon invitation
          </Link>
          <p className="notice">
            Le numéro d’un carnet ou le nom d’un enfant ne suffit pas pour y
            accéder.
          </p>
        </section>
      </div>
      <p className="fine">
        Environnement de développement · Données fictives uniquement
      </p>
    </main>
  );
}
