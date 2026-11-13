export function emailSendingLimited(
  error: { status?: number; code?: string } | null,
): boolean {
  return (
    !!error &&
    (error.status === 429 ||
      error.code === "over_email_send_rate_limit" ||
      error.code === "over_request_rate_limit")
  );
}
export const emailLimitMessage =
  "Le service d’envoi a atteint une limite temporaire. Réessayez plus tard ; un nouvel e-mail n’a pas pu être envoyé. Le service de test peut limiter l’ensemble des confirmations et récupérations à deux e-mails par heure.";
