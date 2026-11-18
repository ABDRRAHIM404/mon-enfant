import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  requireClinicalPermissionManager,
  requireVaccineCatalog,
} from "../src/lib/auth";
import Access from "../src/app/admin/access/page";
import Account from "../src/app/account/page";
import AccountLoading from "../src/app/account/loading";
import CatalogLoading from "../src/app/vaccines/loading";
import VersionLoading from "../src/app/vaccines/[id]/loading";

const mocks = vi.hoisted(() => ({
  role: "admin" as "admin" | "nurse",
  rpc: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({ supabaseConfig: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "test-admin", email: "admin@example.invalid" } },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              user_id: "test-admin",
              role: mocks.role,
              verification_status: "approved",
              professional_id: "TEST-001",
            },
            error: null,
          }),
        }),
      }),
    }),
    rpc: mocks.rpc,
  }),
}));
vi.mock("@/app/auth/actions", () => ({ signOut: async () => ({}) }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Error(`REDIRECT:${path}`);
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = "admin";
  mocks.rpc.mockImplementation(async (name: string) => ({
    data:
      name === "vaccine_catalog_permissions"
        ? { manage: false, review: false }
        : false,
    error: null,
  }));
});

const routes = [
  [
    "permissions",
    requireClinicalPermissionManager,
    "/admin/clinical-permissions",
  ],
  ["catalog", requireVaccineCatalog, "/vaccines"],
] as const;

describe("admin denied-access feedback and shared-route loading", () => {
  it.each(routes)(
    "keeps denied %s access in administration",
    async (section, guard) => {
      await expect(guard()).rejects.toThrow(
        `REDIRECT:/admin/access?section=${section}`,
      );
      expect(mocks.rpc).toHaveBeenCalledOnce();
    },
  );
  it.each(routes)(
    "still allows explicitly authorized %s access",
    async (section, guard) => {
      mocks.rpc.mockResolvedValue({
        data: section === "catalog" ? { manage: true, review: false } : true,
        error: null,
      });
      await expect(guard()).resolves.toHaveProperty("profile.role", "admin");
    },
  );
  it.each(routes)(
    "does not disguise a %s permission lookup failure as denial",
    async (_section, guard) => {
      mocks.rpc.mockResolvedValue({
        data: null,
        error: { code: "NETWORK_ERROR" },
      });
      await expect(guard()).rejects.toThrow("Impossible de vérifier");
    },
  );
  it("does not admit a clinician to clinical permission management", async () => {
    mocks.role = "nurse";
    await expect(requireClinicalPermissionManager()).rejects.toThrow(
      "REDIRECT:/account",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(routes)(
    "explains missing %s access without exposing a management form",
    async (section) => {
      const html = renderToStaticMarkup(
        await Access({ searchParams: Promise.resolve({ section }) }),
      );
      expect(html).toContain("Accès non accordé");
      expect(html).toContain("Console d’administration");
      expect(html).toContain("Voir mes autorisations");
      expect(html).not.toContain("Mon compte soignant");
      expect(html).not.toContain('name="verified"');
      expect(html).not.toContain('name="operationId"');
      expect(mocks.rpc).toHaveBeenCalledOnce();
    },
  );
  it.each(routes)(
    "rechecks %s access so a newly authorized account can proceed",
    async (section, _guard, destination) => {
      mocks.rpc.mockResolvedValue({
        data: section === "catalog" ? { manage: true } : true,
        error: null,
      });
      await expect(
        Access({ searchParams: Promise.resolve({ section }) }),
      ).rejects.toThrow(`REDIRECT:${destination}`);
    },
  );
  it("shows the actual catalogue management permission in admin account settings", async () => {
    const html = renderToStaticMarkup(await Account());
    expect(mocks.rpc).toHaveBeenCalledWith("vaccine_catalog_permissions");
    expect(html).toMatch(
      /Gestion du catalogue vaccinal<\/span><strong>Non accordée/,
    );
  });
  it.each([AccountLoading, CatalogLoading, VersionLoading])(
    "keeps shared-route skeletons free of the wrong role's sidebar",
    (Loading) => {
      const html = renderToStaticMarkup(Loading());
      expect(html).toContain('aria-busy="true"');
      expect(html).not.toContain("Mon compte soignant");
      expect(html).not.toContain('href="/dashboard"');
      expect(html).not.toContain('href="/patients"');
    },
  );
});
