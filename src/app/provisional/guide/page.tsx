import { getProfessional } from "@/lib/auth";
import { ClinicianShell } from "@/components/clinician/shell";
import { BetaGuide } from "@/components/beta-guide";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function ProvisionalGuide() {
  const { profile } = await getProfessional();
  if (
    !profile ||
    !["doctor", "nurse"].includes(profile.role) ||
    profile.verification_status === "suspended"
  )
    redirect("/account");
  return (
    <ClinicianShell active="guide" provisional profile={profile}>
      <BetaGuide audience="provisional" />
    </ClinicianShell>
  );
}
