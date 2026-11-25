import { notFound, redirect } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import { legacyClinicalHref } from "@/components/clinician/clinical-destinations";
import { uuidPattern } from "@/lib/registry/types";

export default async function LegacyClinicalRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireApprovedDoctor();
  const query = await searchParams;
  if (
    query.child &&
    (typeof query.child !== "string" || !uuidPattern.test(query.child))
  )
    notFound();
  redirect(legacyClinicalHref("vaccinations", query));
}
