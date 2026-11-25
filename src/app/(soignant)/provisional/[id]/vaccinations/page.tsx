import {
  ProvisionalSection,
  type SectionQuery,
} from "@/components/clinician/provisional-section";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SectionQuery>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return (
    <ProvisionalSection section="vaccinations" childId={id} query={query} />
  );
}
