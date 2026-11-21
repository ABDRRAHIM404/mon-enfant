import { PatientSection } from "@/components/clinician/patient-section";
import type { SectionQuery } from "@/components/clinician/provisional-section";
import "../consultations/consultations.css";
import "./vaccinations.css";

export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SectionQuery>;
}) {
  return <PatientSection section="vaccinations" query={await searchParams} />;
}
