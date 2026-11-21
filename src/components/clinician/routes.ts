export type ClinicianSection =
  | "home"
  | "children"
  | "consultations"
  | "vaccinations"
  | "appointments"
  | "growth"
  | "documents"
  | "account"
  | "sharing"
  | "guide"
  | "tools";

const sectionRoots = {
  dashboard: "home",
  patients: "children",
  consultations: "consultations",
  vaccinations: "vaccinations",
  growth: "growth",
  appointments: "appointments",
  documents: "documents",
  account: "account",
  verification: "account",
  share: "sharing",
  "guide-soignant": "guide",
  guide: "guide",
  children: "children",
  vaccines: "vaccinations",
} as const;

export function clinicianRoute(pathname: string): {
  section: ClinicianSection;
  tool?: string;
} {
  const [, root = "", sub = "", patientTab] = pathname.split("/");
  if (root === "provisional") {
    if (!sub) return { section: "home" };
    return {
      section: sectionRoots[sub as keyof typeof sectionRoots] ?? "children",
    };
  }
  if (root === "patients" && patientTab) {
    const section = (
      {
        records: "consultations",
        vaccinations: "vaccinations",
        appointments: "appointments",
        growth: "growth",
      } as const
    )[patientTab as "records" | "vaccinations" | "appointments" | "growth"];
    if (section) return { section };
  }
  const tool =
    root === "registration-cases" ? "/registration-reviews" : `/${root}`;
  if (root === "vaccines") return { section: "vaccinations", tool };
  if (
    [
      "/access-requests",
      "/follow-up",
      "/practices",
      "/registration-reviews",
      "/parent-requests",
    ].includes(tool)
  )
    return { section: "tools", tool };
  return {
    section: sectionRoots[root as keyof typeof sectionRoots] ?? "children",
  };
}
