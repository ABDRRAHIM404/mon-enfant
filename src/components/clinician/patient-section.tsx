import { notFound } from "next/navigation";
import { ConsultationsWorkspace } from "./consultations/workspace";
import { GrowthWorkspace } from "./growth/workspace";
import { VaccinationsWorkspace } from "./vaccinations/workspace";
import { readVaccinationOverview } from "./vaccinations/read-overview";
import { requireApprovedDoctor } from "@/lib/auth";
import {
  uuidPattern,
  type Patient,
  type ChildProfile,
  type Facility,
} from "@/lib/registry/types";
import { type ClinicalEntry } from "@/lib/clinical/types";
import type { SectionQuery } from "./provisional-section";
const kinds = {
  consultations: "consultation",
  vaccinations: "vaccination",
  growth: "growth",
} as const;
export async function PatientSection({
  section,
  query,
}: {
  section: keyof typeof kinds;
  query: SectionQuery & { sort?: string; saved?: string };
}) {
  const { supabase, user } = await requireApprovedDoctor();
  const kind = kinds[section],
    q = (query.q || "").slice(0, 100),
    page = Math.min(10000, Math.max(1, Math.floor(Number(query.page) || 1))),
    childPage = Math.min(
      10000,
      Math.max(1, Math.floor(Number(query.childPage) || 1)),
    );
  if (query.child && !uuidPattern.test(query.child)) notFound();
  const [patients, capabilities] = await Promise.all([
    supabase.rpc("list_patients", {
      p_query: q,
      p_history: "all",
      p_age: "all",
      p_page: childPage,
    }),
    supabase.rpc("my_clinical_capabilities"),
  ]);
  if (patients.error || capabilities.error)
    throw new Error("Impossible de charger cette rubrique autorisée.");
  const data = patients.data as { items: Patient[]; total: number };
  let child: Patient | null = query.child
    ? data.items.find((c) => c.id === query.child) || null
    : data.items[0] || null;
  if (query.child && !child) {
    const result = await supabase.rpc("get_child_profile", {
      p_child_id: query.child,
    });
    if (
      result.error?.code === "42501" ||
      (section !== "vaccinations" && !result.data && !result.error)
    )
      notFound();
    if (result.error) throw new Error("Ce dossier est indisponible.");
    child = result.data as ChildProfile;
  }
  const assignedCapabilities = capabilities.data as string[];
  if (section === "vaccinations") {
    return (
      <VaccinationsWorkspace
        child={child}
        matches={data.items}
        q={q}
        childPage={childPage}
        childTotal={data.total}
        page={page}
        overview={
          child ? await readVaccinationOverview(supabase, child, page) : null
        }
        capabilities={assignedCapabilities}
      />
    );
  }

  const allowed = assignedCapabilities.includes(kind);
  const [timeline, places, access] = await Promise.all([
    child
      ? supabase.rpc("clinical_timeline", {
          p_child_id: child.id,
          p_page: page,
          p_kind: kind,
        })
      : null,
    section === "growth" && child && allowed
      ? supabase.rpc("my_facilities")
      : null,
    section === "growth" && child && allowed
      ? supabase.rpc("has_standard_child_access", { p_child_id: child.id })
      : null,
  ]);
  if (timeline?.error?.code === "42501") notFound();
  if (timeline?.error || places?.error || access?.error)
    throw new Error("Impossible de charger l’historique.");
  const history = (timeline?.data ?? { items: [], total: 0 }) as {
    items: ClinicalEntry[];
    total: number;
  };

  if (section === "consultations") {
    return (
      <ConsultationsWorkspace
        query={q}
        child={child}
        childrenPage={childPage}
        childrenTotal={data.total}
        matches={data.items}
        history={history}
        historyPage={page}
        canWrite={allowed}
        sort={query.sort === "oldest" ? "oldest" : "recent"}
      />
    );
  }

  return (
    <GrowthWorkspace
      child={child}
      matches={data.items}
      search={q}
      childPage={childPage}
      childTotal={data.total}
      history={history}
      page={page}
      canWrite={allowed}
      standardAccess={access?.data === true}
      userId={user.id}
      facilities={(places?.data ?? []) as Facility[]}
      saved={query.saved === "1"}
    />
  );
}
