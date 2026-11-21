import { getProfessional } from "@/lib/auth";
import { ClinicianShell } from "@/components/clinician/shell";

export default async function ProvisionalClinicianLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await getProfessional();
  return (
    <ClinicianShell profile={profile} provisional>
      {children}
    </ClinicianShell>
  );
}
