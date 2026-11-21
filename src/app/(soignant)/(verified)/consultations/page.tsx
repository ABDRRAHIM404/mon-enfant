import { PatientSection } from "@/components/clinician/patient-section";
import type { SectionQuery } from "@/components/clinician/provisional-section";
import "./consultations.css";

export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SectionQuery & { sort?: string }>;
}) {
  return <PatientSection section="consultations" query={await searchParams} />;
}
