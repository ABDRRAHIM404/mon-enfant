import { PatientSection } from "@/components/clinician/patient-section";
import type { SectionQuery } from "@/components/clinician/provisional-section";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SectionQuery>;
}) {
  return <PatientSection section="growth" query={await searchParams} />;
}
