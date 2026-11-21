import { getProfessional } from "@/lib/auth";
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
    <>
      <BetaGuide audience="provisional" />
    </>
  );
}
