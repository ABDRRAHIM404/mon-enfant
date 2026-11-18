import { AdminShell } from "@/components/verification/admin-nav";
import { DoctorNav } from "@/components/registry/doctor-nav";
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
    <main className="account-page wide">
      <DoctorNav />
      {children}
    </main>
  );
}
