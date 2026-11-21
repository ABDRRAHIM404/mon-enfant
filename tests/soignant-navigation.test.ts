import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clinicianRoute } from "../src/components/clinician/routes";

const routes = {
  "/dashboard": "home",
  "/patients": "children",
  "/patients/new": "children",
  "/patients/link": "children",
  "/patients/lookup/[universalId]": "children",
  "/patients/[id]": "children",
  "/patients/[id]/guardians": "children",
  "/patients/[id]/summary": "children",
  "/patients/[id]/records": "consultations",
  "/patients/[id]/records/new": "consultations",
  "/patients/[id]/records/[root]": "consultations",
  "/patients/[id]/vaccinations": "vaccinations",
  "/patients/[id]/vaccinations/[item]": "vaccinations",
  "/patients/[id]/growth": "growth",
  "/patients/[id]/appointments": "appointments",
  "/patients/[id]/appointments/new": "appointments",
  "/patients/[id]/appointments/[appointment]": "appointments",
  "/consultations": "consultations",
  "/vaccinations": "vaccinations",
  "/growth": "growth",
  "/appointments": "appointments",
  "/appointments/new": "appointments",
  "/documents": "documents",
  "/guide-soignant": "guide",
  "/follow-up": "tools",
  "/practices": "tools",
  "/access-requests": "tools",
  "/registration-reviews": "tools",
  "/registration-cases/[operation]": "tools",
  "/parent-requests": "tools",
  "/account/clinical-permissions": "account",
  "/share/view/[id]": "sharing",
  "/provisional": "home",
  "/provisional/children": "children",
  "/provisional/[id]": "children",
  "/provisional/consultations": "consultations",
  "/provisional/vaccinations": "vaccinations",
  "/provisional/growth": "growth",
  "/provisional/appointments": "appointments",
  "/provisional/documents": "documents",
  "/provisional/guide": "guide",
} as const;

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory()
      ? pages(path)
      : entry.name === "page.tsx"
        ? [path]
        : [];
  });
}

describe("shared clinician route coverage", () => {
  it("keeps each discovered route in an inherited layout with content-only loading", () => {
    const files = pages("src/app/(soignant)");
    const paths = files.map((file) =>
      file
        .replace(/^src\/app\/\(soignant\)(\/\(verified\))?/, "")
        .replace(/\/page\.tsx$/, ""),
    );
    expect(paths.sort()).toEqual(Object.keys(routes).sort());
    for (const file of files) {
      expect(readFileSync(file, "utf8")).not.toMatch(
        /<(?:ClinicianShell|WorkspaceShell)\b/,
      );
      expect(
        readFileSync(file.replace("page.tsx", "loading.tsx"), "utf8"),
      ).toContain("DashboardSkeleton");
    }
  });

  it.each(Object.entries(routes))(
    "selects %s on direct navigation",
    (path, active) => {
      expect(
        clinicianRoute(
          path.replace(/\[\w+\]/g, "41ebbe4b-4c52-489d-94e7-341954a63c33"),
        ).section,
      ).toBe(active);
    },
  );

  it.each([
    ["/account", "account"],
    ["/verification", "account"],
    ["/vaccines", "vaccinations"],
    ["/vaccines/id", "vaccinations"],
    ["/share", "sharing"],
  ] as const)("selects the clinician section for %s", (path, active) => {
    expect(clinicianRoute(path).section).toBe(active);
  });

  it("opens the matching management tool for a detail URL", () => {
    expect(clinicianRoute("/registration-cases/operation")).toEqual({
      section: "tools",
      tool: "/registration-reviews",
    });
  });
});
