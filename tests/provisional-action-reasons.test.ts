import { beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getProfessional: async () => ({ supabase: { rpc } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("test-redirect");
  },
}));
import { writeProvisional } from "@/app/provisional/actions";
function form(correction = false) {
  const f = new FormData();
  Object.entries({
    childId: randomUUID(),
    operationId: randomUUID(),
    kind: "consultation",
    occurred_on: "2026-11-01",
    occurrence_precision: "exact",
    source_type: "observed",
    reason: "Motif clinique entièrement fictif",
    findings: "Constatations fictives",
  }).forEach(([k, v]) => f.set(k, v));
  if (correction) {
    f.set("rootId", randomUUID());
    f.set("revision", "1");
  }
  return f;
}
beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ error: null });
});
it("new consultation keeps its clinical reason out of the amendment reason", async () => {
  const f = form();
  await expect(writeProvisional({}, f)).rejects.toThrow("test-redirect");
  expect(rpc).toHaveBeenCalledWith(
    "write_provisional_entry",
    expect.objectContaining({
      p_root_id: null,
      p_reason: null,
      p_payload: expect.objectContaining({
        reason: "Motif clinique entièrement fictif",
      }),
    }),
  );
});
it("correction transports distinct clinical and audit reasons", async () => {
  const f = form(true);
  f.set("correction_reason", "Correction fictive motivée séparément");
  await expect(writeProvisional({}, f)).rejects.toThrow("test-redirect");
  expect(rpc).toHaveBeenCalledWith(
    "write_provisional_entry",
    expect.objectContaining({
      p_reason: "Correction fictive motivée séparément",
      p_expected_revision: 1,
      p_payload: expect.objectContaining({
        reason: "Motif clinique entièrement fictif",
      }),
    }),
  );
});
it("rejects the old ambiguous correction form without writing", async () => {
  const f = form(true);
  f.append("reason", "Ancien champ de correction fictif");
  expect(await writeProvisional({}, f)).toHaveProperty("error");
  expect(rpc).not.toHaveBeenCalled();
});
it("rejects short or duplicated amendment reasons without writing", async () => {
  for (const duplicate of [false, true]) {
    const f = form(true);
    f.set(
      "correction_reason",
      duplicate ? "Motif fictif complet et distinct" : "court",
    );
    if (duplicate)
      f.append("correction_reason", "Deuxième motif fictif ambigu");
    expect(await writeProvisional({}, f)).toHaveProperty("error");
  }
  expect(rpc).not.toHaveBeenCalled();
});
