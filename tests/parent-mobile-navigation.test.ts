import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ParentMobileNav } from "../src/components/parent-mobile-nav";
const route = vi.hoisted(() => ({ path: "/", query: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.path,
  useSearchParams: () => new URLSearchParams(route.query),
}));
describe("parent mobile navigation context", () => {
  it("does not advertise private parent destinations on public or clinician/admin routes", () => {
    for (const path of [
      "/",
      "/login",
      "/signup",
      "/parent-requests",
      "/admin",
    ]) {
      route.path = path;
      expect(renderToStaticMarkup(ParentMobileNav())).toBe("");
    }
  });
  it("retains parent home and child navigation with the current destination selected", () => {
    route.path = "/parent/children/example-child";
    route.query = "";
    const html = renderToStaticMarkup(ParentMobileNav());
    expect(html).toContain('aria-label="Accès rapides parent"');
    expect(html).toContain('href="/parent"');
    const current = html.match(/<a[^>]*aria-current="page"[^>]*>/g) ?? [];
    expect(current[0]).toContain('href="/parent?view=children"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
  it("selects the appointments view from its query parameter", () => {
    route.path = "/parent";
    route.query = "view=appointments";
    const html = renderToStaticMarkup(ParentMobileNav());
    const current = html.match(/<a[^>]*aria-current="page"[^>]*>/g) ?? [];
    expect(current[0]).toContain('href="/parent?view=appointments"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
});
