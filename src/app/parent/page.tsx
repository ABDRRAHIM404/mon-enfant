import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { ParentProfileForm } from "@/components/parents/profile-form";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
export const dynamic = "force-dynamic";
export default async function ParentWorkspace() {
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
  const profile = data?.profile as { display_name: string } | null;
  return (
    <main className="account-page wide">
      <header className="workspace-nav">
        <Brand />
        <nav aria-label="Navigation parent">
          <Link href="/parent">Espace parent</Link>
          <Link href="/account">Mon compte</Link>
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
