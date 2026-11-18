import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ClinicalWorkspace,
  ChildCareActions,
  PatientNavigation,
} from "../src/components/clinician/care-workspace";
import { ParentWorkflow } from "../src/components/parents/workflow";
import type { ChildProfile } from "../src/lib/registry/types";
const { rpc, guard } = vi.hoisted(() => ({ rpc: vi.fn(), guard: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireApprovedDoctor: guard }));
vi.mock("@/components/clinician/shell", () => ({
  ClinicianShell: ({ children }: { children: React.ReactNode }) =>
    createElement("main", null, children),
}));
vi.mock("@/app/auth/actions", () => ({ signOut: async () => ({}) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));
const child: ChildProfile = {
  id: "22222222-2222-4222-8222-222222222222",
  universal_id: "33333333-3333-4333-8333-333333333333",
  given_name: "Enfant",
  family_name: "Fictif",
  name_status: "recorded",
  birth_date: "2025-01-01",
  birth_date_precision: "exact",
  sex: "unknown",
  history_status: "unknown",
  source_type: "new",
  registers: [],
  can_manage_access: false,
  created_by_professional_id: "TEST-PRO",
  paper_reference: null,
  provenance_note: null,
  guardian_name: null,
  guardian_phone: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  guard.mockResolvedValue({ supabase: { rpc } });
  rpc.mockResolvedValue({ data: child, error: null });
});
const actions = [
  ["consultation", "/records/new?kind=consultation"],
  ["vaccination", "/records/new?kind=vaccination"],
  ["appointment", "/appointments/new"],
  ["growth", "/records/new?kind=growth"],
  ["prescription", "/records/new?kind=prescription"],
  ["risk", "/records/new?kind=risk"],
];
describe("child workflows and visible capability boundaries", () => {
  it.each(actions)(
    "offers the %s form only with that explicit capability",
    (kind, path) => {
      const html = renderToStaticMarkup(
        ChildCareActions({ childId: child.id, allowed: [kind] }),
      );
      expect(html).toContain(`href="/patients/${child.id}${path}"`);
      for (const [other, suffix] of actions)
        if (other !== kind)
          expect(html).not.toContain(`href="/patients/${child.id}${suffix}"`);
      expect(html).toContain('href="/account/clinical-permissions"');
    },
  );
  it("explains unavailable entry actions without advertising an unauthorized write link", () => {
    const html = renderToStaticMarkup(
      ChildCareActions({ childId: child.id, allowed: [] }),
    );
    expect(html).toContain("Habilitation non active");
    expect(html).not.toContain(`/patients/${child.id}/records/new`);
    expect(html).not.toContain(`/patients/${child.id}/appointments/new`);
  });
  it("keeps every child section in the same child scope and hides access management when unavailable", () => {
    const html = renderToStaticMarkup(
      PatientNavigation({ childId: child.id, active: "growth" }),
    );
    expect(html).toContain(`/patients/${child.id}/vaccinations`);
    expect(html).toContain(`/patients/${child.id}/appointments`);
    expect(html).not.toContain("/guardians");
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect(
      renderToStaticMarkup(
        PatientNavigation({
          childId: child.id,
          active: "guardians",
          canManageAccess: true,
        }),
      ),
    ).toContain(`/patients/${child.id}/guardians`);
  });
  it("shows the authorized child's identity before the entry form", async () => {
    const html = renderToStaticMarkup(
      await ClinicalWorkspace({
        childId: child.id,
        section: "records",
        children: createElement("h1", null, "Ajouter une consultation"),
      }),
    );
    expect(guard).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("get_child_profile", {
      p_child_id: child.id,
    });
    expect(html.indexOf("Enfant Fictif")).toBeLessThan(
      html.indexOf("Ajouter une consultation"),
    );
  });
  it("does not re-read a child that the guarded page has already loaded", async () => {
    renderToStaticMarkup(
      await ClinicalWorkspace({
        childId: child.id,
        child,
        children: "Contenu",
      }),
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not render a child context after current-session access denial", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(
      ClinicalWorkspace({ childId: child.id, children: "Contenu" }),
    ).rejects.toThrow("NOT_FOUND");
  });
  it("keeps parent requests, notifications and invitation reachable inside the same workspace", () => {
    const html = renderToStaticMarkup(
      ParentWorkflow({
        active: "requests",
        childId: child.id,
        childSection: "requests",
        children: createElement("h1", null, "Demandes et réponses"),
      }),
    );
    expect(html).toContain('href="/parent/notifications"');
    expect(html).toContain('href="/parent/requests"');
    expect(html).toContain('href="/parent/invitation"');
    expect(html).toContain(`/parent/children/${child.id}/privacy`);
    expect((html.match(/<main[ >]/g) ?? []).length).toBe(1);
    expect(html).not.toContain(`/patients/${child.id}/records/new`);
  });
});
