import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicianShell } from "@/components/clinician/shell";
import { BetaGuide } from "@/components/beta-guide";

export const dynamic = "force-dynamic";
export default async function ClinicianGuide() {
  const { profile } = await requireApprovedDoctor();
  return (
    <ClinicianShell active="guide" profile={profile}>
      <BetaGuide audience="clinician" />
    </ClinicianShell>
  );
}
