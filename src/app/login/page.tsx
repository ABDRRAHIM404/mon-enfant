import { AuthShell } from "@/components/auth-shell";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ confirmation?: string }>;
}) {
  const { confirmation } = await searchParams;
  return (
    <>
      {confirmation === "invalid" && (
        <div className="confirmation-error" role="alert">
          Le lien de confirmation est invalide ou a expiré. Demandez un nouveau
          lien à votre administrateur.
        </div>
      )}
      <AuthShell mode="login" />
    </>
  );
}
