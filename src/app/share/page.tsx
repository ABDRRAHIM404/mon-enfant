import { ShieldCheck } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { ShareEntry } from "@/components/sharing/share-entry";
import { ClinicianShell } from "@/components/clinician/shell";
import {
  canAccessClinicalWorkspace,
  type Professional,
} from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import "./share.css";
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
  const verified = canAccessClinicalWorkspace(profile);
  const scanner = (
    <div className="qr-reader" data-verified={verified}>
      <header className="qr-reader-heading">
        {verified && <p>Espace soignant</p>}
        <h1 id="main-content" tabIndex={-1}>
          Scanner un QR partagé
        </h1>
        <p>Ouvrir un carnet partagé par un parent</p>
      </header>
      {verified && (
        <div className="qr-reader-verified">
          <ShieldCheck size={26} aria-hidden="true" />
          <div>
            <strong>Soignant vérifié</strong>
            <p>Partage sécurisé, selon vos habilitations.</p>
          </div>
        </div>
      )}
      <ShareEntry verified={verified} />
    </div>
  );
  if (verified)
    return <ClinicianShell profile={profile}>{scanner}</ClinicianShell>;
  return (
    <div className="public-site">
      <PublicHeader />
      <main className="account-page qr-reader-public">{scanner}</main>
    </div>
  );
}
