import { notFound } from "next/navigation";
import { todayCasablanca } from "@/lib/appointments/calendar";
import type { requireApprovedDoctor } from "@/lib/auth";
import type { Patient } from "@/lib/registry/types";
import type { CatalogSnapshot, CatalogVersion } from "@/lib/vaccines/types";
import { vaccinationProjection, type VaccinationOverview } from "./projection";

type Client = Awaited<ReturnType<typeof requireApprovedDoctor>>["supabase"];
const historyPageSize = 30;
const maxHistoryPages = 4;
const maxCatalogPages = 4;

async function approvedCatalog(supabase: Client) {
  for (let page = 1; page <= maxCatalogPages; page++) {
    const result = await supabase.rpc("vaccine_catalog", { p_page: page });
    if (result.error)
      throw new Error("Impossible de lire le catalogue vaccinal.");
    const data = result.data as { versions: CatalogVersion[]; total: number };
    const latest = data.versions.find(
      (version) => version.status === "approved" && version.review_verified,
    );
    if (latest) {
      const detail = await supabase.rpc("vaccine_catalog", {
        p_version_id: latest.id,
      });
      if (detail.error)
        throw new Error("Impossible de lire la version vaccinale.");
      return {
        catalog: (detail.data as { version: CatalogSnapshot }).version,
        complete: true,
      };
    }
    if (page * 20 >= data.total) return { catalog: null, complete: true };
  }
  return { catalog: null, complete: false };
}

export async function readVaccinationOverview(
  supabase: Client,
  child: Patient,
  page: number,
): Promise<VaccinationOverview> {
  async function historyPage(n: number) {
    const result = await supabase.rpc("clinical_timeline", {
      p_child_id: child.id,
      p_kind: "vaccination",
      p_page: n,
    });
    if (result.error?.code === "42501") notFound();
    if (result.error)
      throw new Error("Impossible de lire l’historique vaccinal.");
    return result.data as VaccinationOverview["history"];
  }
  const [history, references, catalog] = await Promise.all([
    historyPage(page),
    supabase.rpc("patient_vaccine_items", { p_child_id: child.id, p_page: 1 }),
    approvedCatalog(supabase),
  ]);
  if (references.error?.code === "42501") notFound();
  if (references.error)
    throw new Error("Impossible de lire les références de cet enfant.");

  const pages = Math.ceil(history.total / historyPageSize);
  let completeHistory = null;
  if (pages <= maxHistoryPages) {
    const records = await Promise.all(
      Array.from({ length: pages }, (_, i) =>
        i + 1 === page ? history : historyPage(i + 1),
      ),
    );
    const entries = records.flatMap((record) => record.items);
    if (
      records.every((record) => record.total === history.total) &&
      new Set(entries.map((entry) => entry.root_id)).size === history.total
    ) {
      completeHistory = entries;
    }
  }

  return {
    history,
    references: references.data as VaccinationOverview["references"],
    projection: vaccinationProjection(
      child,
      catalog.catalog,
      completeHistory,
      todayCasablanca(),
    ),
    historyComplete: completeHistory !== null,
    catalogSearchComplete: catalog.complete,
  };
}
