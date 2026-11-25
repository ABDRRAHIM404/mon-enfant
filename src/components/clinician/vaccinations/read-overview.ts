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

// The clinician workspace is currently a fictional-data beta.
const betaDraftId = "0c504568-7c67-49bb-b43b-c8382439a850";

export async function readScheduleCatalog(supabase: Client) {
  let betaDraftVisible = false;

  async function readVersion(id: string) {
    const detail = await supabase.rpc("vaccine_catalog", { p_version_id: id });
    if (detail.error)
      throw new Error("Impossible de lire la version vaccinale.");
    return (detail.data as { version: CatalogSnapshot }).version;
  }

  for (let page = 1; page <= maxCatalogPages; page++) {
    const result = await supabase.rpc("vaccine_catalog", { p_page: page });
    if (result.error)
      throw new Error("Impossible de lire le catalogue vaccinal.");
    const data = result.data as { versions: CatalogVersion[]; total: number };
    const latest = data.versions.find(
      (version) => version.status === "approved" && version.review_verified,
    );
    if (latest)
      return {
        approved: await readVersion(latest.id),
        betaDraft: null,
        complete: true,
      };

    betaDraftVisible ||= data.versions.some(
      (version) => version.id === betaDraftId && version.status === "draft",
    );
    if (page * 20 >= data.total) {
      const version = betaDraftVisible ? await readVersion(betaDraftId) : null;
      return version?.status === "approved" && version.review_verified
        ? { approved: version, betaDraft: null, complete: true }
        : { approved: null, betaDraft: version, complete: true };
    }
  }
  return { approved: null, betaDraft: null, complete: false };
}

export async function readVaccinationOverview(
  supabase: Client,
  child: Patient,
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
  const [history, catalog] = await Promise.all([
    historyPage(1),
    readScheduleCatalog(supabase),
  ]);
  const pages = Math.ceil(history.total / historyPageSize);
  let completeHistory = null;
  if (pages <= maxHistoryPages) {
    const records = await Promise.all(
      Array.from({ length: pages }, (_, i) =>
        i === 0 ? history : historyPage(i + 1),
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
    projection: vaccinationProjection(
      child,
      catalog.approved,
      completeHistory,
      todayCasablanca(),
      catalog.betaDraft,
    ),
    historyComplete: completeHistory !== null,
    catalogSearchComplete: catalog.complete,
  };
}
