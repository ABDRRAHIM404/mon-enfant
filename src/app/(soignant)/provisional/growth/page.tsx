import {
  ProvisionalSection,
  type SectionQuery,
} from "@/components/clinician/provisional-section";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SectionQuery>;
}) {
  return <ProvisionalSection section="growth" query={await searchParams} />;
}
