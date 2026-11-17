import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ParentSection } from "../src/components/parents/section";
import type { ParentWorkspaceData } from "../src/lib/parents/types";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireUser: async () => ({ supabase: { rpc } }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/components/sharing/parent-share-panel", () => ({
  ParentSharePanel: () => null,
}));
const child = {
  id: "11111111-1111-4111-8111-111111111111",
  link_id: "link",
  given_name: "Enfant",
  family_name: "Fictif",
  universal_id: "QA",
  name_status: "recorded",
  birth_date: "2025-01-01",
  birth_date_precision: "exact",
  sex: "unknown",
  history_status: "unknown",
  relationship: "parent",
  can_export: false,
  expires_at: "2027-01-01T00:00:00Z",
} satisfies ParentWorkspaceData["children"][number];
const render = async (section: string, query = {}, childrenList = [child]) =>
  renderToStaticMarkup(await ParentSection({ section, query, childrenList }));
beforeEach(() => {
  rpc.mockReset();
});
describe("parent section navigation and scoped reads", () => {
  it("documents is a genuine coming-soon screen with no clinical queries", async () => {
    const html = await render("documents");
    expect(html).toContain("Bientôt disponible");
    expect(html).not.toContain('type="file"');
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each(["vaccinations", "growth", "appointments", "access"])(
    "%s has an authorized empty state",
    async (section) => {
      expect(await render(section, {}, [])).toContain("Aucun enfant relié");
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it("rejects an unrelated child instead of substituting the first linked child", async () => {
    await expect(
      render("growth", { child: "22222222-2222-4222-8222-222222222222" }),
    ).rejects.toThrow("NOT_FOUND");
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each(["0", "-1", "1.5", "NaN", "10001"])(
    "rejects invalid page %s before a read",
    async (page) => {
      await expect(render("vaccinations", { page })).rejects.toThrow(
        "NOT_FOUND",
      );
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it("vaccination pages preserve child and pagination and never invent doses", async () => {
    rpc.mockResolvedValue({ data: { items: [], total: 45 }, error: null });
    const html = await render("vaccinations", { page: "2" });
    expect(rpc).toHaveBeenCalledWith("parent_vaccination_history", {
      p_child_id: child.id,
      p_page: 2,
    });
    expect(rpc).toHaveBeenCalledWith("parent_vaccine_items", {
      p_child_id: child.id,
      p_page: 2,
    });
    expect(html).toContain("Aucune vaccination enregistrée");
    expect(html).toContain(
      `view=vaccinations&amp;child=${child.id}&amp;page=3`,
    );
  });
  it("rechecks backend authorization after selection", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(render("growth")).rejects.toThrow("NOT_FOUND");
  });
  it("surfaces backend failures instead of presenting medical empty states", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "500" } });
    await expect(render("appointments")).rejects.toThrow(
      "Impossible de charger",
    );
  });
  it("growth renders only recorded measures and has no parent clinical write form", async () => {
    rpc.mockResolvedValue({
      data: { growth: [], appointments: [], entries: [] },
      error: null,
    });
    const html = await render("growth");
    expect(html).toContain("Aucune mesure enregistrée");
    expect(html).not.toContain('name="weight');
    expect(rpc).toHaveBeenCalledWith("parent_child_booklet", {
      p_child_id: child.id,
      p_page: 1,
    });
  });
});
