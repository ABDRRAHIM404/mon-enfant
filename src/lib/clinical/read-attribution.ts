import "server-only";

import type { getProfessional } from "@/lib/auth";
import type { ClinicalAttributions } from "./attribution";

type Client = Awaited<ReturnType<typeof getProfessional>>["supabase"];

export async function readClinicalAttributions(
  supabase: Client,
  keys: (string | null | undefined)[],
  scope: {
    children?: string[];
    share?: string;
    catalog?: string;
    page?: number;
  } = {},
): Promise<ClinicalAttributions> {
  const ids = [...new Set(keys.filter((key): key is string => Boolean(key)))];
  if (!ids.length) return {};
  const children = [...new Set(scope.children ?? [])];
  const labels: ClinicalAttributions = {};
  for (let offset = 0; offset < ids.length; offset += 300) {
    const { data, error } = await supabase.rpc("clinician_attribution_labels", {
      p_keys: ids.slice(offset, offset + 300),
      p_children: children,
      p_share: scope.share ?? null,
      p_catalog: scope.catalog ?? null,
      p_page: scope.page ?? 1,
    });
    if (!error && data) Object.assign(labels, data as ClinicalAttributions);
  }
  return labels;
}
