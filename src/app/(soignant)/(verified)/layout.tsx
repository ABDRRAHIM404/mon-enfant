import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicianShell } from "@/components/clinician/shell";

export default async function VerifiedClinicianLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireApprovedDoctor();
  return <ClinicianShell profile={profile}>{children}</ClinicianShell>;
}
