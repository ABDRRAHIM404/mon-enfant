import { requireApprovedDoctor } from "@/lib/auth";
import { BetaGuide } from "@/components/beta-guide";

export const dynamic = "force-dynamic";
export default async function ClinicianGuide() {
  await requireApprovedDoctor();
  return (
    <>
      <BetaGuide audience="clinician" />
    </>
  );
}
