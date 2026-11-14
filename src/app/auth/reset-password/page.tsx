import { requireUser } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { PasswordResetForm } from "@/components/recovery-form";
export const dynamic="force-dynamic";
export default async function ResetPassword() {
  await requireUser();
  return <main className="account-page"><Brand/><section className="account-card"><span className="eyebrow">SÉCURITÉ DU COMPTE</span><h1 id="main-content" tabIndex={-1}>Choisissez un nouveau mot de passe.</h1><PasswordResetForm/></section></main>;
}
