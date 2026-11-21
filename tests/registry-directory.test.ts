import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Patients from "../src/app/(soignant)/(verified)/patients/page";
import { ChildAvatar } from "../src/components/clinician/child-avatar";
import type { Patient } from "../src/lib/registry/types";

const { guard, rpc } = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireApprovedDoctor: guard }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const girl: Patient = {
  id: "fixture-female",
  universal_id: "universal-identifier",
  given_name: "Zina",
  family_name: "Fictive",
  name_status: "recorded",
  birth_date: "2026-07-22",
  birth_date_precision: "exact",
  sex: "female",
  history_status: "reviewed",
  source_type: "new",
  registers: [
    {
      facility_id: "fixture-facility",
      facility_name: "Centre fictif",
      number: "002",
      year: 2026,
      book: "A",
    },
  ],
};
const boy = {
  ...girl,
  id: "fixture-male",
  given_name: "Amir",
  sex: "male",
  registers: [],
};
const show = async (
  params: Record<string, string | string[] | undefined> = {},
) =>
  renderToStaticMarkup(
    await Patients({ searchParams: Promise.resolve(params) }),
  );

beforeEach(() => {
  vi.resetAllMocks();
  guard.mockResolvedValue({ supabase: { rpc } });
  rpc.mockResolvedValue({
    data: { items: [girl, boy], total: 64 },
    error: null,
  });
});

describe("authorized Enfants directory", () => {
  it("uses the guarded RPC and preserves filters, pagination, and view", async () => {
    const html = await show({
      q: "002",
      history: "reviewed",
      age: "under1",
      page: "2",
      view: "grid",
      sort: "name",
    });
    expect(guard).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledExactlyOnceWith("list_patients", {
      p_query: "002",
      p_history: "reviewed",
      p_age: "under1",
      p_page: 2,
    });
    expect(html).toContain('data-view="grid"');
    expect(html).toContain(
      "q=002&amp;history=reviewed&amp;age=under1&amp;sort=name&amp;view=grid&amp;page=3",
    );
    expect(html.indexOf("Amir Fictive")).toBeLessThan(
      html.indexOf("Zina Fictive"),
    );
  });

  it("renders each authorized child once with the real register and neutral appointment state", async () => {
    const html = await show();
    expect(html.indexOf("Zina Fictive")).toBeLessThan(
      html.indexOf("Amir Fictive"),
    );
    expect(html.match(/Zina Fictive/g)).toHaveLength(1);
    expect(html).toContain('href="/patients/fixture-female"');
    expect(html).toContain('href="/patients/fixture-male"');
    expect(html).toContain("002 · 2026 / A · Centre fictif");
    expect(html).not.toContain(girl.universal_id);
    expect(html).toMatch(/data-tone="neutral"[^>]*>.*?Non planifié/);
  });

  it("validates URL parameters and never queries without a valid clinician", async () => {
    await show({
      q: ["duplicate", "param"],
      history: "invalid",
      age: "future",
      page: "0",
    });
    expect(rpc).toHaveBeenCalledWith("list_patients", {
      p_query: "",
      p_history: "all",
      p_age: "all",
      p_page: 1,
    });
    rpc.mockClear();
    guard.mockRejectedValueOnce(new Error("Guard denied"));
    await expect(show()).rejects.toThrow("Guard denied");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("shared child avatar", () => {
  it.each([
    ["male", "boy"],
    ["female", "girl"],
    ["unknown", "neutral"],
    [undefined, "neutral"],
  ])(
    "uses the recorded sex (%s) to select the %s illustration",
    (sex, expected) => {
      expect(
        renderToStaticMarkup(createElement(ChildAvatar, { sex })),
      ).toContain(`/dashboard-art/registry-avatar-${expected}.webp`);
    },
  );

  it("prioritizes an already authorized photo passed by the caller", () => {
    const html = renderToStaticMarkup(
      createElement(ChildAvatar, {
        sex: "female",
        authorizedPhotoSrc: "/fixture-authorized/photo",
      }),
    );
    expect(html).toContain('src="/fixture-authorized/photo"');
    expect(html).not.toContain("/registry-avatar-girl.webp");
  });
});
