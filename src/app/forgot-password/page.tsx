import Link from "next/link";
import { Brand } from "@/components/brand";
import { RecoveryForm } from "@/components/recovery-form";
import { supabaseConfig } from "@/lib/supabase/config";
export default async function ForgotPassword({
  searchParams,
}: {
  searchParams: Promise<{ recovery?: string }>;
}) {
  const { recovery } = await searchParams;
  const configured = !!supabaseConfig();
  return (
    <main className="account-page">
      <Brand />
      <section className="account-card">
        <span className="eyebrow">ACCÈS À MON COMPTE</span>
        <h1 id="main-content" tabIndex={-1}>Mot de passe oublié ?</h1>
        <p className="muted">
          Demandez un lien de récupération et ouvrez-le dans ce même navigateur.
        </p>
        {!configured && (
          <div className="notice">
            La récupération sera disponible après configuration du service de
            connexion.
          </div>
        )}
        {recovery === "browser" && (
          <p role="alert" className="form-error">
            Ce navigateur ne peut pas confirmer la demande. Demandez un nouveau
            lien ci-dessous, puis ouvrez uniquement le plus récent dans le
            navigateur utilisé ici.
          </p>
        )}
        {recovery === "invalid" && (
          <p role="alert" className="form-error">
            Ce lien de récupération est invalide, déjà utilisé ou expiré.
            Demandez un nouveau lien ci-dessous. Si le lien a d’abord été ouvert
            dans un autre navigateur, utilisez un nouveau lien, pas l’ancien.
          </p>
        )}
        <p className="fine">
          Si votre messagerie ouvre un autre navigateur, copiez le lien du
          bouton de récupération et collez-le directement dans la barre
          d’adresse de ce navigateur avant de l’ouvrir ailleurs. Ne partagez
          jamais ce lien.
        </p>
        <RecoveryForm configured={configured} />
        <p className="auth-switch">
          <Link href="/login">Retour à la connexion</Link>
        </p>
      </section>
    </main>
  );
}
