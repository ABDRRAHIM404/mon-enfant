import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase/config";
import { reportOperationalEvent } from "@/lib/operational-events";
import { notificationConfig, sendApproval, type ApprovalJob } from "./protocol";

export async function dispatchApprovalNotifications(
  options: { requestId?: string; limit?: number } = {},
) {
  const stats = {
    status: "disabled",
    claimed: 0,
    accepted: 0,
    retry: 0,
    failed: 0,
    needs_review: 0,
    unacknowledged: 0,
  };
  const config = notificationConfig(process.env),
    backend = supabaseConfig();
  if (!config || !backend) return stats;
  try {
    const supabase = createClient(backend.url, backend.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (url, init) =>
          fetch(url, { ...init, signal: AbortSignal.timeout(10000) }),
      },
    });
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: config.workerEmail,
      password: config.workerPassword,
    });
    if (loginError)
      throw new Error("Notification worker authentication failed.");
    try {
      const { data, error } = await supabase.rpc(
        "claim_approval_notifications",
        {
          p_from_email: config.fromEmail,
          p_site_origin: config.siteOrigin,
          p_limit: options.limit ?? 3,
          p_request_id: options.requestId ?? null,
          p_allowed_recipient: config.allowedRecipient,
        },
      );
      if (error || !Array.isArray(data))
        throw new Error("Notification claim failed.");
      stats.status = "completed";
      stats.claimed = data.length;
      for (const raw of data) {
        const job = raw as ApprovalJob;
        const result = await sendApproval(job, config);
        const { error: finishError } = await supabase.rpc(
          "finish_approval_notification",
          {
            p_id: job.id,
            p_lease_id: job.lease_id,
            p_result: result.outcome,
            p_provider_message_id: result.providerId ?? null,
          },
        );
        if (finishError) {
          stats.unacknowledged++;
          reportOperationalEvent("notification_dispatch_failed");
        } else stats[result.outcome]++;
        if (data.length > 1)
          await new Promise((resolve) => setTimeout(resolve, 550));
      }
    } finally {
      // This worker never writes browser cookies; retire its short-lived session.
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error)
        throw new Error("Notification worker session retirement failed.");
    }
  } catch {
    stats.status = "unavailable";
    reportOperationalEvent("notification_dispatch_failed");
  }
  return stats;
}
