import { AuthShell } from "@/components/auth-shell";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ confirmation?: string; password?: string }>;
}) {
  const { confirmation, password } = await searchParams;
  return (
    <>
      {confirmation === "invalid" && (
        <div className="confirmation-error" role="alert">
          Le lien de confirmation est invalide ou a expiré. Demandez un nouveau
          lien à votre administrateur.
        </div>
      )}
      {password === "updated" && <div className="notice" role="status">Votre mot de passe a été modifié. Connectez-vous avec le nouveau mot de passe.</div>}
      <AuthShell mode="login" />
    </>
  );
}
