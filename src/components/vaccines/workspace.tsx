import { AdminShell } from "@/components/verification/admin-nav";
import { ClinicalWorkspace } from "@/components/clinician/care-workspace";
export function CatalogWorkspace({
  admin,
  children,
}: {
  admin: boolean;
  children: React.ReactNode;
}) {
  return admin ? (
    <AdminShell active="catalog">{children}</AdminShell>
  ) : (
    <ClinicalWorkspace active="vaccinations">{children}</ClinicalWorkspace>
  );
}
