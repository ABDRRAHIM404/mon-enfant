"use client";
import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordRecovery, changePassword } from "@/app/auth/actions";
export function RecoveryForm({ configured }: { configured:boolean }) {
  const [state,action,pending]=useActionState(requestPasswordRecovery,{});
  return <form action={action} className="auth-form"><label htmlFor="email">Adresse e-mail de votre compte</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={!configured}/>{state.error && <p className="form-error" role="alert">{state.error}</p>}{state.message && <p className="notice" role="status">{state.message}</p>}<button className="button primary" disabled={!configured || pending || !!state.message}>{pending ? "Demande en cours…" : "Demander un lien de récupération"}</button></form>;
}
export function PasswordResetForm() {
  const [state,action,pending]=useActionState(changePassword,{});
  if (state.passwordChanged) return <div className="notice" role="status">Votre mot de passe a été modifié. La déconnexion automatique n’a pas abouti. <Link href="/account" className="text-link">Revenez à votre compte pour vous déconnecter.</Link></div>;
  return <form action={action} className="auth-form"><label htmlFor="password">Nouveau mot de passe</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required/><label htmlFor="confirmation">Confirmer le nouveau mot de passe</label><input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required/>{state.error && <p className="form-error" role="alert">{state.error}</p>}<button className="button primary" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer le nouveau mot de passe"}</button><p className="fine">8 à 128 caractères. Une fois le mot de passe modifié, vous devrez vous reconnecter.</p></form>;
}
