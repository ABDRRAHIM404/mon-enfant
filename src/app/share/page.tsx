import { PublicHeader } from "@/components/public-header";
import { ShareEntry } from "@/components/sharing/share-entry";
import { ClinicianShell } from "@/components/clinician/shell";
import {
  canAccessClinicalWorkspace,
  type Professional,
} from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
export const dynamic = "force-dynamic";
export default async function SharePage() {
  let profile: Professional | null = null;
  if (supabaseConfig()) {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (user && !error && !user.is_anonymous) {
      const { data } = await supabase
        .from("professional_profiles")
        .select("user_id,role,verification_status,professional_id")
        .eq("user_id", user.id)
        .maybeSingle();
      profile = data as Professional | null;
    }
  }
  const scanner = (
    <section className="panel">
      <span className="eyebrow">PARTAGE TEMPORAIRE · SOIGNANT VÉRIFIÉ</span>
      <h1 id="main-content" tabIndex={-1}>
        Ouvrir un carnet partagé
      </h1>
      <p>
        Scannez le QR présenté par le parent. Le code est à usage unique et
        expire cinq minutes après sa création.
      </p>
      <p>
        Si le parent vous autorise à documenter la visite, ouvrez le code avec
        votre compte médecin vérifié. Vous pourrez consulter le dossier et
        ajouter des soins selon vos habilitations.
      </p>
      <p>
        Pour une nouvelle fiche parent, le QR préremplit le nom et la date de
        naissance dans le formulaire d’inscription.
      </p>
      <ShareEntry />
    </section>
  );
  if (canAccessClinicalWorkspace(profile))
    return (
      <ClinicianShell profile={profile}>
        <div className="share-entry">{scanner}</div>
      </ClinicianShell>
    );
  return (
    <div className="public-site">
      <PublicHeader />
      <main className="account-page share-entry">{scanner}</main>
    </div>
  );
}
