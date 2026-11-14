import "server-only";
const events = [
  "verification_upload_failed",
  "verification_submission_failed",
  "verification_review_failed",
  "account_status_failed",
  "server_request_failed",
  "password_reset_failed",
  "password_recovery_failed",
  "registry_action_failed",
  "clinical_write_failed",
  "clinical_permission_failed",
  "clinical_export_failed",
  "auth_callback_failed",
  "auth_email_rate_limited",
  "vaccine_catalog_failed",
  "patient_vaccine_item_failed",
  "appointment_action_failed",
  "operational_readiness_failed",
  "notification_dispatch_failed",
  "parent_action_failed",
] as const;
export function reportOperationalEvent(event: (typeof events)[number]): string {
  const reference = crypto.randomUUID();
  // No user IDs, document names, request bodies, raw provider messages or clinical details.
  console.error(
    JSON.stringify({
      event,
      reference,
      severity: "error",
      at: new Date().toISOString(),
    }),
  );
  return reference;
}
