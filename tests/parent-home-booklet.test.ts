import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ParentWorkspace from "../src/app/parent/page";
import type { ParentWorkspaceData } from "../src/lib/parents/types";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({ supabase: { rpc } }),
}));
vi.mock("@/app/auth/actions", () => ({ signOut: async () => {} }));
vi.mock("@/app/parent/actions", () => ({
  saveParentProfile: async () => {},
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  usePathname: () => "/parent",
}));

const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const firstChild = {
  id: firstId,
  link_id: "first-link",
  given_name: "Premier",
  family_name: "Fictif",
  universal_id: "QA-1",
  name_status: "known",
  birth_date: "2024-01-01",
  birth_date_precision: "exact",
  sex: "unknown",
  history_status: "unknown",
  relationship: "parent",
  can_export: false,
  expires_at: "2027-01-01T00:00:00Z",
} satisfies ParentWorkspaceData["children"][number];
const secondChild = {
  ...firstChild,
  id: secondId,
  given_name: "Second",
  link_id: "second-link",
};

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValueOnce({
    data: {
      profile: { display_name: "Parent de test" },
      children: [firstChild, secondChild],
      claims: [],
      next_appointment: {
        child_id: firstId,
        purpose_label: "Suivi de test",
        starts_at: "2026-12-05T08:30:00Z",
      },
      unread_total: 0,
    },
    error: null,
  });
});

describe("parent home booklet selection", () => {
  it("only reads the selected child's history and names the child attending the next family appointment", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        entries: [{ id: "qa-entry", kind: "growth", occurred_on: null }],
      },
      error: null,
    });
    const html = renderToStaticMarkup(
      await ParentWorkspace({
        searchParams: Promise.resolve({ child: secondId }),
      }),
    );
    expect(rpc.mock.calls).toEqual([
      ["parent_home_summary"],
      ["parent_child_booklet", { p_child_id: secondId, p_page: 1 }],
    ]);
    expect(html).toContain('id="selected-child-heading">Second Fictif');
    expect(html).toContain(`/parent/children/${secondId}`);
    expect(html).toContain("Mesures de croissance");
    expect(html).toContain("Date inconnue");
    expect(html).toContain("Prochain rendez-vous de la famille");
    expect(html).toContain("Premier Fictif · ");
    expect(html).toContain(`/parent/children/${firstId}/appointments`);
  });

  it("never opens the first linked child as a fallback for an unrelated selection", async () => {
    await expect(
      ParentWorkspace({
        searchParams: Promise.resolve({ child: "unrelated" }),
      }),
    ).rejects.toThrow("NOT_FOUND");
    expect(rpc.mock.calls).toEqual([["parent_home_summary"]]);
  });

  it("checks authorization again when opening the selected child's history", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    await expect(
      ParentWorkspace({ searchParams: Promise.resolve({ child: secondId }) }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
