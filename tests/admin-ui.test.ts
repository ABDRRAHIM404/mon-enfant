import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import Account from "../src/app/account/page";
import Overview from "../src/app/admin/page";
import { AdminLoading } from "../src/components/verification/admin-nav";
import Queue from "../src/app/admin/verifications/page";
import Professionals from "../src/app/admin/professionals/page";
import Permissions from "../src/app/admin/clinical-permissions/page";
import Review from "../src/app/admin/verifications/[id]/page";

const mocks = vi.hoisted(() => ({
  reviewer: vi.fn(),
  manager: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  filters: [] as unknown[][],
  empty: false,
}));
vi.mock("@/lib/auth", () => ({
  getProfessional: async () => ({
    user: { email: "admin-test@example.invalid" },
    profile: { role: "admin", verification_status: "approved" },
    supabase: { rpc: mocks.rpc },
  }),
  requireReviewer: mocks.reviewer,
  requireClinicalPermissionManager: mocks.manager,
}));
vi.mock("@/app/admin/actions", () => ({
  reviewApplication: async () => ({}),
  setSuspension: async () => ({}),
  retryApprovalNotice: async () => ({}),
}));
vi.mock("@/app/auth/actions", () => ({ signOut: async () => ({}) }));
vi.mock("@/app/patients/clinical-actions", () => ({
  changeClinicalPermission: async () => ({}),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));

const id = "11111111-1111-4111-8111-111111111111";
const request = {
  id,
  display_name: "Professionnel entièrement fictif",
  registration_number: "TEST-001",
  facility_name: "Centre de démonstration fictif",
  status: "under_review",
  submitted_at: "2026-11-17T10:00:00Z",
  verification_decisions: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.filters = [];
  mocks.empty = false;
  const supabase = { from: mocks.from, rpc: mocks.rpc };
  mocks.reviewer.mockResolvedValue({ supabase });
  mocks.manager.mockResolvedValue({ supabase });
  mocks.from.mockImplementation((table: string) => {
    let single = false,
      head = false;
    const builder = {
      select: (_columns: string, options?: { head?: boolean }) => {
        head = !!options?.head;
        return builder;
      },
      eq: (...args: unknown[]) => {
        mocks.filters.push(["eq", ...args]);
        return builder;
      },
      in: (...args: unknown[]) => {
        mocks.filters.push(["in", ...args]);
        return builder;
      },
      ilike: (...args: unknown[]) => {
        mocks.filters.push(["ilike", ...args]);
        return builder;
      },
      order: () => builder,
      range: (...args: unknown[]) => {
        mocks.filters.push(["range", ...args]);
        return builder;
      },
      maybeSingle: () => {
        single = true;
        return builder;
      },
      then: (resolve: (value: unknown) => unknown) =>
        resolve({
          error: null,
          count: mocks.empty ? 0 : 1,
          data: head
            ? null
            : mocks.empty
              ? []
              : single
                ? request
                : table === "verification_requests"
                  ? [request]
                  : [
                      {
                        user_id: id,
                        professional_id: "TEST-PRO-001",
                        role: "doctor",
                        verification_status: "approved",
                        created_at: request.submitted_at,
                      },
                    ],
        }),
    };
    return builder;
  });
  mocks.rpc.mockImplementation(async (name: string) => ({
    error: null,
    data: ["list_clinical_permissions", "list_admin_professionals"].includes(
      name,
    )
      ? {
          total: mocks.empty ? 0 : 1,
          items: mocks.empty
            ? []
            : [
                {
                  user_id: id,
                  professional_id: "TEST-PRO-001",
                  email: "nadia@example.invalid",
                  display_name: "Nadia Benali",
                  role: "nurse",
                  verification_status: "approved",
                  capabilities: [
                    {
                      capability: "consultation",
                      enabled: true,
                      expires_at: null,
                    },
                  ],
                },
              ],
        }
      : [],
  }));
});
const queue = (query = {}) => Queue({ searchParams: Promise.resolve(query) });
const professionals = (query = {}) =>
  Professionals({ searchParams: Promise.resolve(query) });
const permissions = () =>
  Permissions({ searchParams: Promise.resolve({ q: "TEST-PRO-001" }) });
const review = () => Review({ params: Promise.resolve({ id }) });
describe("admin presentation preserves review and permission boundaries", () => {
  it("loads real overview totals only after the reviewer guard", async () => {
    const html = renderToStaticMarkup(await Overview());
    expect(mocks.reviewer).toHaveBeenCalledOnce();
    expect(mocks.filters).toContainEqual(["eq", "status", "under_review"]);
    expect(mocks.filters).toContainEqual([
      "eq",
      "status",
      "needs_more_evidence",
    ]);
    expect(html).toContain("Demandes à examiner");
    expect(html).toContain('href="/admin/clinical-permissions"');
    expect((html.match(/<main[ >]/g) ?? []).length).toBe(1);
    expect((html.match(/<h1[ >]/g) ?? []).length).toBe(1);
  });
  it("shows admin identity rather than a clinician activation flow", async () => {
    const html = renderToStaticMarkup(await Account());
    expect(html).toContain("admin-test@example.invalid");
    expect(html).toContain("Administrateur");
    expect(html).toContain("Mes autorisations");
    expect(html).not.toContain("Activer mon espace soignant");
    expect((html.match(/<h1[ >]/g) ?? []).length).toBe(1);
  });
  it("keeps admin navigation and a content target in its loading state", () => {
    const html = renderToStaticMarkup(
      AdminLoading({ active: "requests", variant: "form" }),
    );
    expect(html).toContain('id="main-content"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('href="/admin/professionals"');
    expect(html).not.toContain("TEST-PRO");
  });
  it("shows useful empty states without a misleading editor", async () => {
    mocks.empty = true;
    expect(renderToStaticMarkup(await queue())).toContain(
      "Aucune demande dans cette file",
    );
    const html = renderToStaticMarkup(await permissions());
    expect(html).toContain("Aucun professionnel trouvé");
    expect(html).not.toContain('name="professionalId"');
  });
  it("keeps queue filtering and pagination on the server", async () => {
    const html = renderToStaticMarkup(
      await queue({ status: "rejected", page: "2" }),
    );
    expect(html).toContain(`/admin/verifications/${id}`);
    expect(mocks.reviewer).toHaveBeenCalledOnce();
    expect(mocks.filters).toContainEqual(["eq", "status", "rejected"]);
    expect(mocks.filters).toContainEqual(["range", 30, 59]);
  });
  it("normalizes an unknown queue status instead of changing the read scope", async () => {
    await queue({ status: "invalid", page: "-4" });
    expect(mocks.filters).toContainEqual(["eq", "status", "under_review"]);
    expect(mocks.filters).toContainEqual(["range", 0, 29]);
  });
  it("sends literal search text and status to the guarded directory RPC and retains pagination", async () => {
    const html = renderToStaticMarkup(
      await Professionals({
        searchParams: Promise.resolve({
          q: "TEST_%",
          status: "suspended",
          page: "2",
        }),
      }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("list_admin_professionals", {
      p_query: "TEST_%",
      p_status: "suspended",
      p_page: 2,
    });
    expect(html).toContain("q=TEST_%25");
    expect(html).toContain("status=suspended");
  });
  it("retains reasoned suspension and the clinician-only directory query", async () => {
    const html = renderToStaticMarkup(await professionals());
    expect(mocks.rpc).toHaveBeenCalledWith("list_admin_professionals", {
      p_query: "",
      p_status: "all",
      p_page: 1,
    });
    expect(html).toContain("Nadia Benali");
    expect(html).toContain("nadia@example.invalid");
    expect(html).toContain('name="reason"');
    expect(html).toContain('value="suspend"');
  });
  it("keeps clinical permission management separate from identity review", async () => {
    const html = renderToStaticMarkup(await permissions());
    expect(mocks.manager).toHaveBeenCalledOnce();
    expect(mocks.reviewer).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("list_clinical_permissions", {
      p_query: "TEST-PRO-001",
      p_page: 1,
    });
    expect(html).toContain('name="operationId"');
    expect(html).toContain('name="verified"');
    expect(html).toContain("Nadia Benali");
    expect(html).toContain("nadia@example.invalid");
    expect(html).toContain("E-mail, prénom, nom ou identifiant professionnel");
  });
  it("does not pick a permission target from the final page of ambiguous matches", async () => {
    mocks.rpc.mockResolvedValueOnce({
      error: null,
      data: {
        total: 31,
        items: [
          { user_id: id, professional_id: "TEST-PRO-001", capabilities: [] },
        ],
      },
    });
    const html = renderToStaticMarkup(
      await Permissions({
        searchParams: Promise.resolve({ q: "Nadia", page: "2" }),
      }),
    );
    expect(html).not.toContain('name="professionalId"');
    expect(mocks.rpc).not.toHaveBeenCalledWith(
      "clinical_capability_history",
      expect.anything(),
    );
  });
  it("retains all review checks and the protected evidence endpoint", async () => {
    const html = renderToStaticMarkup(await review());
    expect(html).toContain('name="identityChecked"');
    expect(html).toContain('name="registrationChecked"');
    expect(html).toContain(`/admin/evidence/${id}`);
    expect(html).not.toContain("signedUrl");
  });
  it("does not fetch any admin data when the guard rejects", async () => {
    mocks.reviewer.mockRejectedValueOnce(Error("DENIED"));
    await expect(queue()).rejects.toThrow("DENIED");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("renders the existing components with synthetic data for visual inspection", async () => {
    const root = process.env.ADMIN_UI_CAPTURE_ROOT;
    for (const [name, render] of Object.entries({
      overview: Overview,
      queue,
      professionals,
      permissions,
      review,
    })) {
      const html = renderToStaticMarkup(await render());
      expect(html).toContain('id="main-content"');
      if (root) {
        mkdirSync(root, { recursive: true });
        writeFileSync(
          `${root}/${name}.html`,
          `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Admin — aperçu de composants fictifs</title><link rel="stylesheet" href="style.css"></head><body>${html}</body></html>`,
        );
      }
    }
  });
});
