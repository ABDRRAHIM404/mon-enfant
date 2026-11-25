import "../../../../consultations/consultations.css";
import "../../../../vaccinations/vaccinations.css";
import { RoutineVaccinationFollowup } from "@/components/clinician/vaccinations/workspace";
import { readVaccinationOverview } from "@/components/clinician/vaccinations/read-overview";
import { readAuthorizedChild } from "@/lib/registry/read-child";
import { requireApprovedDoctor } from "@/lib/auth";

export default async function VaccinationFollowup({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [child, { supabase }] = await Promise.all([
    readAuthorizedChild(id),
    requireApprovedDoctor(),
  ]);
  const [overview, capabilities] = await Promise.all([
    readVaccinationOverview(supabase, child),
    supabase.rpc("my_clinical_capabilities"),
  ]);
  if (capabilities.error)
    throw Error("Impossible de charger les habilitations.");
  return (
    <RoutineVaccinationFollowup
      child={child}
      overview={overview}
      canPlan={(capabilities.data as string[]).includes("appointment")}
    />
  );
}
