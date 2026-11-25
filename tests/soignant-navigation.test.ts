import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clinicianMainNavigation } from "../src/components/clinician/main-navigation";
import { legacyClinicalHref } from "../src/components/clinician/clinical-destinations";
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
  "/patients/[id]/edit": "children",
  "/patients/[id]/consultations": "children",
  "/patients/[id]/vaccinations/follow-up": "children",
  "/provisional/[id]/consultations": "children",
  "/provisional/[id]/vaccinations": "children",
  "/provisional/[id]/growth": "children",
  "/patients/[id]/records": "children",
  "/patients/[id]/records/new": "children",
  "/patients/[id]/records/[root]": "children",
  "/patients/[id]/vaccinations": "children",
  "/patients/[id]/vaccinations/[item]": "children",
  "/patients/[id]/growth": "children",
  "/patients/[id]/appointments": "children",
  "/patients/[id]/appointments/new": "children",
  "/patients/[id]/appointments/[appointment]": "children",
  "/consultations": "children",
  "/vaccinations": "children",
  "/growth": "children",
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
  "/provisional/consultations": "children",
  "/provisional/vaccinations": "children",
  "/provisional/growth": "children",
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
    ["/vaccines", "tools"],
    ["/vaccines/id", "tools"],
    ["/share", "sharing"],
  ] as const)("selects the clinician section for %s", (path, active) => {
    expect(clinicianRoute(path).section).toBe(active);
  });

  it("shares the exact verified rail and drawer entries and preserves provisional isolation", () => {
    expect(clinicianMainNavigation(false).map(({ href }) => href)).toEqual([
      "/dashboard",
      "/patients",
      "/appointments",
      "/documents",
      "/share",
      "/guide-soignant",
      "/account",
    ]);
    expect(clinicianMainNavigation(true).map(({ href }) => href)).toEqual([
      "/provisional",
      "/provisional/children",
      "/provisional/appointments",
      "/provisional/documents",
      "/provisional/guide",
      "/account",
    ]);
  });

  it("carries safe legacy entry URLs to the same child or the correct selector", () => {
    const id = "41ebbe4b-4c52-489d-94e7-341954a63c33";
    expect(
      legacyClinicalHref("consultations", {
        child: id,
        sort: "oldest",
        page: "2",
      }),
    ).toBe(`/patients/${id}/consultations?page=2&sort=oldest`);
    expect(legacyClinicalHref("vaccinations", { child: id, page: "3" })).toBe(
      `/patients/${id}/vaccinations?historyPage=3`,
    );
    expect(
      legacyClinicalHref("growth", {
        child: "https://example.invalid",
        q: "A B",
      }),
    ).toBe("/patients?open=growth&q=A+B");
    expect(legacyClinicalHref("vaccinations", { child: id }, true)).toBe(
      `/provisional/${id}/vaccinations`,
    );
  });

  it("opens the matching management tool for a detail URL", () => {
    expect(clinicianRoute("/registration-cases/operation")).toEqual({
      section: "tools",
      tool: "/registration-reviews",
    });
  });
});
