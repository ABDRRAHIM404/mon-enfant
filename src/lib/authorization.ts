export const verificationStates = [
  "unverified",
  "under_review",
  "approved",
  "rejected",
  "suspended",
] as const;
export type VerificationState = (typeof verificationStates)[number];
export type Professional = {
  user_id: string;
  role: "doctor" | "nurse" | "admin";
  verification_status: VerificationState;
  professional_id: string | null;
};
export function canAccessClinicalWorkspace(
  profile: Professional | null,
): boolean {
  return (
    (profile?.role === "doctor" || profile?.role === "nurse") &&
    profile.verification_status === "approved" &&
    profile.professional_id !== null
  );
}
export const statusLabels: Record<VerificationState, string> = {
  unverified: "Non vérifié",
  under_review: "En cours de vérification",
  approved: "Vérifié",
  rejected: "Demande rejetée",
  suspended: "Compte suspendu",
};
