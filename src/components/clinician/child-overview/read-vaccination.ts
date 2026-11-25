import "server-only";

import { notFound } from "next/navigation";
import type { requireApprovedDoctor } from "@/lib/auth";
import type { Patient } from "@/lib/registry/types";
import type { ClinicalEntry } from "@/lib/clinical/types";
import { todayCasablanca } from "@/lib/appointments/calendar";
import { vaccinationBooklet, type DoseReview } from "@/lib/vaccines/booklet";
import type { VaccineItemExport } from "@/lib/vaccines/patient-types";
import { readScheduleCatalog } from "../vaccinations/read-overview";

type Client = Awaited<ReturnType<typeof requireApprovedDoctor>>["supabase"];

export async function readChildVaccineFollowup(
  supabase: Client,
  child: Patient,
) {
  async function history(page: number) {
    const result = await supabase.rpc("clinical_timeline", {
      p_child_id: child.id,
      p_kind: "vaccination",
      p_page: page,
    });
    if (result.error?.code === "42501") notFound();
    return result.error
      ? null
      : (result.data as { items: ClinicalEntry[]; total: number });
  }
  const catalog = await readScheduleCatalog(supabase).catch(() => null);
  if (!catalog?.approved) return null;
  const [first, items, reviews] = await Promise.all([
    history(1),
    supabase.rpc("vaccine_items_export", { p_child_id: child.id }),
    supabase.rpc("vaccination_booklet_reviews", {
      p_child_id: child.id,
      p_version_id: catalog.approved.id,
    }),
  ]);
  if ([items.error?.code, reviews.error?.code].includes("42501")) notFound();
  if (!first || first.total > 120 || items.error || reviews.error) return null;
  const pages = Math.ceil(first.total / 30);
  const remaining = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
      history(index + 2),
    ),
  );
  if (remaining.some((page) => page?.total !== first.total)) return null;
  const entries = [first, ...remaining].flatMap((page) => page!.items);
  if (
    entries.length !== first.total ||
    new Set(entries.map(({ root_id }) => root_id)).size !== first.total
  )
    return null;
  const booklet = vaccinationBooklet(
    child,
    catalog.approved,
    entries,
    true,
    items.data as VaccineItemExport[],
    reviews.data as DoseReview[],
    todayCasablanca(),
  );
  const overdue = booklet.rows
    .filter((row) => row.status === "overdue")
    .sort((a, b) => (a.ref.endOn ?? "").localeCompare(b.ref.endOn ?? ""))[0];
  const next = overdue ?? booklet.upcoming[0];
  if (!next?.ref.startOn) return null;
  return {
    code: next.rule.dose_code,
    stage: next.stage.label,
    start: next.ref.startOn,
    end: next.ref.isWindow ? next.ref.endOn : null,
    overdue: next.status === "overdue",
  };
}
