// Presentation only. Effective authority is always checked again by the server.
export function clinicalPermissionStatus(
  permission: { enabled: boolean; expires_at: string | null },
  now = Date.now(),
) {
  if (!permission.enabled) return "revoked";
  if (permission.expires_at && Date.parse(permission.expires_at) <= now)
    return "expired";
  return "granted";
}
export const clinicalPermissionStatusLabels = {
  revoked: "Révoquée",
  expired: "Expirée",
  granted: "Accordée",
} as const;
