import { uuidPattern } from "@/lib/registry/types";

const destinations = {
  consultations: "Consultations",
  vaccinations: "Vaccinations",
  growth: "Croissance",
} as const;

export type ClinicalDestination = keyof typeof destinations;

export function clinicalDestination(
  value: unknown,
): ClinicalDestination | undefined {
  if (typeof value === "string" && Object.hasOwn(destinations, value))
    return value as ClinicalDestination;
}

export function clinicalDestinationLabel(value: ClinicalDestination) {
  return destinations[value];
}

export function clinicalChildHref(
  childId: string,
  destination: ClinicalDestination,
  provisional = false,
) {
  return `/${provisional ? "provisional" : "patients"}/${childId}/${destination}`;
}

export function legacyClinicalHref(
  destination: ClinicalDestination,
  query: Record<string, string | string[] | undefined>,
  provisional = false,
) {
  const { child, page, childPage, q, sort, saved, view } = query;
  if (typeof child === "string" && uuidPattern.test(child)) {
    const followup =
      !provisional && destination === "vaccinations" && view === "follow-up";
    const params = new URLSearchParams();
    if (typeof page === "string" && /^\d{1,5}$/.test(page)) {
      params.set(
        !provisional && destination === "vaccinations" && !followup
          ? "historyPage"
          : "page",
        page,
      );
    }
    if (destination === "consultations" && sort === "oldest")
      params.set("sort", sort);
    if (saved === "1") params.set("saved", "1");
    return `${clinicalChildHref(child, destination, provisional)}${followup ? "/follow-up" : ""}${params.size ? `?${params}` : ""}`;
  }
  const params = new URLSearchParams({ open: destination });
  if (typeof q === "string") params.set("q", q.slice(0, 100));
  if (typeof childPage === "string" && /^\d{1,5}$/.test(childPage))
    params.set(provisional ? "childPage" : "page", childPage);
  return `${provisional ? "/provisional/children" : "/patients"}?${params}`;
}
