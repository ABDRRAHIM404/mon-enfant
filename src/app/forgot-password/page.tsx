import Link from "next/link";
import { Brand } from "@/components/brand";
import { RecoveryForm } from "@/components/recovery-form";
import { supabaseConfig } from "@/lib/supabase/config";
export default function ForgotPassword() {
  const configured=!!supabaseConfig();
  return <main className="account-page"><Brand/><section className="account-card"><span className="eyebrow">ACCÈS À MON COMPTE</span><h1>Mot de passe oublié ?</h1><p className="muted">Demandez un lien de récupération et ouvrez-le dans ce même navigateur.</p>{!configured && <div className="notice">La récupération sera disponible après configuration du service de connexion.</div>}<RecoveryForm configured={configured}/><p className="auth-switch"><Link href="/login">Retour à la connexion</Link></p></section></main>;
}
