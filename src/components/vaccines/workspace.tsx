import { AdminShell } from "@/components/verification/admin-nav";
import { ClinicalWorkspace } from "@/components/clinician/care-workspace";
import { ClinicianShell } from "@/components/clinician/shell";
import type { Professional } from "@/lib/authorization";
export function CatalogWorkspace({
  profile,
  children,
}: {
  profile: Professional | null;
  children: React.ReactNode;
}) {
  return profile?.role === "admin" ? (
    <AdminShell active="catalog">{children}</AdminShell>
  ) : (
    <ClinicianShell profile={profile}>
      <ClinicalWorkspace>{children}</ClinicalWorkspace>
    </ClinicianShell>
  );
}
