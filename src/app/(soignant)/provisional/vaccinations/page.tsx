import { notFound, redirect } from "next/navigation";
import { getProfessional } from "@/lib/auth";
import { legacyClinicalHref } from "@/components/clinician/clinical-destinations";
import { uuidPattern } from "@/lib/registry/types";

export default async function LegacyClinicalRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await getProfessional();
  if (!profile) redirect("/account");
  const query = await searchParams;
  if (
    query.child &&
    (typeof query.child !== "string" || !uuidPattern.test(query.child))
  )
    notFound();
  redirect(legacyClinicalHref("vaccinations", query, true));
}
