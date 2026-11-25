import "../../../consultations/consultations.css";
import { notFound } from "next/navigation";
import { ConsultationsWorkspace } from "@/components/clinician/consultations/workspace";
import { requireApprovedDoctor } from "@/lib/auth";
import { readClinicalAttributions } from "@/lib/clinical/read-attribution";
import type { ClinicalEntry } from "@/lib/clinical/types";
import { uuidPattern } from "@/lib/registry/types";

export default async function ChildConsultations({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; sort?: string; entry?: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!uuidPattern.test(id)) notFound();
  const page = Math.min(
    10000,
    Math.max(1, Math.floor(Number(query.page) || 1)),
  );
  const [history, capabilities] = await Promise.all([
    supabase.rpc("clinical_timeline", {
      p_child_id: id,
      p_kind: "consultation",
      p_page: page,
    }),
    supabase.rpc("my_clinical_capabilities"),
  ]);
  if (history.error?.code === "42501") notFound();
  if (history.error || capabilities.error)
    throw Error("Impossible de charger les consultations.");
  const data = history.data as { items: ClinicalEntry[]; total: number };
  const names = await readClinicalAttributions(
    supabase,
    data.items.map((entry) => entry.professional_id),
    { children: [id] },
  );

  return (
    <ConsultationsWorkspace
      childId={id}
      history={data}
      historyPage={page}
      selectedRoot={query.entry}
      canWrite={(capabilities.data as string[]).includes("consultation")}
      sort={query.sort === "oldest" ? "oldest" : "recent"}
      attributions={names}
    />
  );
}
