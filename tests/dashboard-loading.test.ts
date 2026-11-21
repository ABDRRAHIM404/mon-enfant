import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DashboardLoading,
  DashboardSkeleton,
} from "../src/components/dashboard/skeleton";
import config from "../next.config";

describe("dashboard loading and public cache boundaries", () => {
  it.each([
    "overview",
    "list",
    "form",
    "clinical",
    "calendar",
    "documents",
  ] as const)(
    "%s skeleton announces work without fictional records or controls",
    (variant) => {
      const html = renderToStaticMarkup(DashboardSkeleton({ variant }));
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-hidden="true"');
      expect(html).not.toContain("<input");
      expect(html).not.toContain("<button");
    },
  );
  it("keeps loading navigation usable without rendering identity data", () => {
    const html = renderToStaticMarkup(DashboardLoading({ area: "parent" }));
    expect(html).toContain('id="main-content"');
    expect(html).toContain("/parent?view=growth");
    expect(html).not.toContain("@");
    expect(html).not.toContain("aria-disabled");
  });
  it("every page has a skeleton route boundary", () => {
    function visit(dir: string) {
      for (const item of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, item.name);
        if (item.isDirectory()) visit(path);
        else if (item.name === "page.tsx")
          expect(readFileSync(join(dir, "loading.tsx"), "utf8")).toMatch(
            dir.includes("(soignant)")
              ? /DashboardSkeleton/
              : /DashboardLoading|AdminLoading/,
          );
      }
    }
    visit("src/app");
  });
  it("caches only named public assets and static/loading segments", async () => {
    const headers = await config.headers!();
    const publicRules = headers.filter((rule) =>
      rule.headers.some(
        (header) =>
          header.key === "Cache-Control" && header.value.startsWith("public"),
      ),
    );
    expect(publicRules.map((rule) => rule.source)).toEqual([
      "/brand/:path*",
      "/dashboard-art/:path*",
      "/fonts/:path*",
    ]);
    expect(config.experimental?.staleTimes?.dynamic).toBe(0);
    expect(config.experimental?.staleTimes?.static).toBe(300);
    const proxy = readFileSync("src/proxy.ts", "utf8");
    expect(proxy).toContain('"private, no-store"');
    const auth = readFileSync("src/lib/auth.ts", "utf8");
    expect(auth).not.toContain("unstable_cache");
    expect(auth).not.toContain("use cache");
  });
});
