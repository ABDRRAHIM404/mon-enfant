import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChildConsultations from "../src/app/(soignant)/(verified)/patients/[id]/consultations/page";
import type { ClinicalEntry } from "../src/lib/clinical/types";
import type { Patient } from "../src/lib/registry/types";

vi.mock("server-only", () => ({}));
const { guard, rpc } = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireApprovedDoctor: guard }));
vi.mock("@/app/auth/actions", () => ({ signOut: async () => ({}) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const patient: Patient = {
  id: "52ebbe4b-4c52-489d-94e7-341954a63c33",
  universal_id: "fixture",
  given_name: "Lina",
  family_name: "Fictive",
  name_status: "recorded",
  birth_date: "2024-01-10",
  birth_date_precision: "exact",
  sex: "female",
  history_status: "unknown",
  source_type: "new",
  registers: [
    {
      facility_id: "fixture",
      facility_name: "Centre fictif",
      year: 2026,
      book: "A",
      number: "003",
    },
  ],
};
const entry: ClinicalEntry = {
  id: "fixture-entry",
  root_id: "fixture-root",
  previous_id: "fixture-previous",
  child_id: patient.id,
  kind: "consultation",
  author_id: "fixture-author",
  professional_id: "PRO-FICTIF",
  facility_id: "fixture",
  facility_name: "Centre fictif",
  occurred_on: "2026-11-19",
  occurrence_precision: "estimated",
  source_type: "paper_transcription",
  source_reference: "Cahier fictif page 3",
  source_verified: false,
  payload: {
    reason: "Motif fictif",
    findings: "Observations fictives",
    assessment: "Évaluation fictive",
    plan: "Plan fictif",
    notes: "Autre champ fictif",
  },
  entry_state: "active",
  amendment_reason: "Correction fictive",
  revision: 2,
  recorded_at: "2026-11-20T18:10:00Z",
};
const show = async (
  query: { page?: string; sort?: string; entry?: string } = {},
  id = patient.id,
) =>
  renderToStaticMarkup(
    await ChildConsultations({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve(query),
    }),
  );

beforeEach(() => {
  vi.resetAllMocks();
  guard.mockResolvedValue({ supabase: { rpc } });
  rpc.mockImplementation(async (name: string) => ({
    error: null,
    data: (
      {
        clinician_attribution_labels: {
          "PRO-FICTIF": { name: "Nour Exemple", role: "nurse", verified: true },
        },
        my_clinical_capabilities: ["consultation"],
        clinical_timeline: {
          items: [entry, { ...entry, id: "older", occurred_on: "2025-08-14" }],
          total: 43,
        },
      } as Record<string, unknown>
    )[name],
  }));
});

describe("Consultations workspace", () => {
  it("queries the authorized child and renders recorded details, provenance and existing destinations", async () => {
    const html = await show({ page: "1" });
    expect(guard).toHaveBeenCalledOnce();
    expect(rpc).not.toHaveBeenCalledWith("list_patients", expect.anything());
    expect(html).not.toContain("Sélectionner un enfant");
    expect(rpc).toHaveBeenCalledWith("clinical_timeline", {
      p_child_id: patient.id,
      p_kind: "consultation",
      p_page: 1,
    });
    for (const value of [
      "Motif fictif",
      "Observations fictives",
      "Évaluation fictive",
      "Plan fictif",
      "Autre champ fictif",
      "Cahier fictif page 3",
      "Source non confirmée",
      "Nour Exemple",
      "2026-11-20T18:10:00Z",
      "version 2",
      "Correction fictive",
      "2026-11-19",
      "(estimée)",
    ])
      expect(html).toContain(value);
    for (const path of [
      "/records?kind=consultation",
      "/records?kind=prescription",
      "/records?kind=risk",
      "/records/new?kind=consultation",
      "/records/fixture-root",
    ])
      expect(html).toContain(`href="/patients/${patient.id}${path}"`);
    expect(html).toContain(
      'aria-label="Pages de l’historique des consultations"',
    );
  });

  it("supports page-local date sorting with existing backend pagination", async () => {
    const html = await show({ sort: "oldest", page: "2" });
    expect(html.toLowerCase()).toContain('datetime="2025-08-14"');
    expect(html.toLowerCase().indexOf('datetime="2025-08-14"')).toBeLessThan(
      html.toLowerCase().indexOf('datetime="2026-11-19"'),
    );
    expect(html).toContain("sort=oldest");
    expect(rpc).toHaveBeenCalledWith("clinical_timeline", {
      p_child_id: patient.id,
      p_kind: "consultation",
      p_page: 2,
    });
  });

  it("hides creation without clinical capability and retains an empty-state action when permitted", async () => {
    rpc
      .mockResolvedValueOnce({ data: { items: [], total: 0 }, error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    const restricted = await show();
    expect(restricted).toContain(
      "Aucune consultation documentée pour cet enfant.",
    );
    expect(restricted).toContain("Mes habilitations");
    expect(restricted).not.toContain("/records/new");
    expect(await show()).toContain("/records/new?kind=consultation");
  });

  it("rejects an invalid child URL and handles a denied scoped timeline", async () => {
    await expect(show({}, "invalid")).rejects.toThrow("NOT_FOUND");
    expect(rpc).not.toHaveBeenCalled();
    for (const [code, message] of [
      ["42501", "NOT_FOUND"],
      ["08006", "Impossible de charger les consultations"],
    ]) {
      rpc.mockResolvedValueOnce({ data: null, error: { code } });
      await expect(show()).rejects.toThrow(message);
    }
  });
});
