export type NotificationConfig = {
  apiKey: string;
  workerEmail: string;
  workerPassword: string;
  fromEmail: string;
  siteOrigin: string;
  allowedRecipient: string | null;
};
export type ApprovalJob = {
  id: string;
  lease_id: string;
  recipient_email: string;
  from_email: string;
  site_origin: string;
  template_version: number;
};
export type SendResult = {
  outcome: "accepted" | "retry" | "failed" | "needs_review";
  providerId?: string;
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const email =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i;
function origin(value: string) {
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== value ||
    parsed.username ||
    parsed.password
  )
    throw new Error("A fixed HTTPS application origin is required.");
  return value;
}
export function notificationConfig(
  env: Record<string, string | undefined>,
): NotificationConfig | null {
  if (
    env.VERCEL_ENV === "preview" ||
    !["owner-only", "verified-domain"].includes(env.APP_EMAIL_MODE ?? "")
  )
    return null;
  const apiKey = env.RESEND_API_KEY ?? "",
    workerEmail = env.APP_EMAIL_WORKER_EMAIL ?? "",
    workerPassword = env.APP_EMAIL_WORKER_PASSWORD ?? "";
  if (!apiKey || !email.test(workerEmail) || workerPassword.length < 24)
    return null;
  const ownerOnly = env.APP_EMAIL_MODE === "owner-only";
  const allowedRecipient = ownerOnly
    ? (env.APP_EMAIL_ALLOWED_RECIPIENT ?? "")
    : null;
  const fromEmail = ownerOnly
    ? "onboarding@resend.dev"
    : (env.APP_EMAIL_FROM_EMAIL ?? "");
  if (
    !email.test(fromEmail) ||
    (ownerOnly && (!allowedRecipient || !email.test(allowedRecipient))) ||
    (!ownerOnly &&
      (env.APP_EMAIL_DOMAIN_VERIFIED !== "true" ||
        fromEmail.toLowerCase().endsWith("@resend.dev")))
  )
    return null;
  try {
    return {
      apiKey,
      workerEmail,
      workerPassword,
      fromEmail,
      allowedRecipient,
      siteOrigin: origin(
        env.APP_EMAIL_SITE_ORIGIN ?? "https://mon-enfant.vercel.app",
      ),
    };
  } catch {
    return null;
  }
}

// Keep version 1 immutable: the payload must stay identical on provider retries.
export function approvalPayload(job: ApprovalJob) {
  if (
    !uuid.test(job.id) ||
    !uuid.test(job.lease_id) ||
    job.template_version !== 1 ||
    !email.test(job.recipient_email) ||
    !email.test(job.from_email)
  )
    throw new Error("Invalid approval notice.");
  const site = origin(job.site_origin);
  return {
    from: `Mon Enfant <${job.from_email}>`,
    to: [job.recipient_email],
    subject: "Mon Enfant — approbation de votre inscription professionnelle",
    text: `Votre demande d’inscription professionnelle sur Mon Enfant a été approuvée.\n\nConnectez-vous à votre compte pour consulter votre statut actuel :\n${site}/account\n\nL’accès aux dossiers et aux actes reste soumis à vos autorisations.\n\nCet email ne contient aucun justificatif ni dossier médical.`,
  };
}

export async function sendApproval(
  job: ApprovalJob,
  config: NotificationConfig,
  fetcher: typeof fetch = fetch,
): Promise<SendResult> {
  if (
    typeof job?.recipient_email !== "string" ||
    (config.allowedRecipient &&
      job.recipient_email.toLowerCase() !==
        config.allowedRecipient.toLowerCase())
  )
    return { outcome: "needs_review" };
  let payload;
  try {
    payload = approvalPayload(job);
  } catch {
    return { outcome: "needs_review" };
  }
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      credentials: "omit",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `professional-approval/v1/${job.id}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return {
        outcome:
          response.status === 429 || response.status >= 500
            ? "retry"
            : response.status === 409
              ? "needs_review"
              : "failed",
      };
    }
    const reader = response.body?.getReader();
    if (!reader) return { outcome: "needs_review" };
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 4096) {
        await reader.cancel();
        return { outcome: "needs_review" };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let result;
    try {
      result = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return { outcome: "needs_review" };
    }
    return typeof result?.id === "string" && uuid.test(result.id)
      ? { outcome: "accepted", providerId: result.id }
      : { outcome: "needs_review" };
  } catch {
    return { outcome: "retry" };
  }
}
