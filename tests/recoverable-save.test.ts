import { describe, expect, it, vi } from "vitest";
import { recoverableSave } from "../src/lib/recoverable-save";

describe("parent save transport failures", () => {
  it("keeps server success and validation responses intact", async () => {
    const data = new FormData();
    data.set("displayName", "  Responsable fictif  ");
    const action = vi
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ error: "Invalid input" });
    const save = recoverableSave(action);
    expect(await save({}, data)).toEqual({ success: true });
    expect(await save({}, data)).toEqual({ error: "Invalid input" });
    expect(data.get("displayName")).toBe("  Responsable fictif  ");
  });

  it.each([
    new TypeError("Failed to fetch"),
    new Error("Server response unavailable"),
  ])(
    "does not replay an unconfirmed save or retain stale success",
    async (error) => {
      const action = vi.fn().mockRejectedValue(error);
      const data = new FormData();
      data.set("reminderDays", "7");
      const result = await recoverableSave(action)({ success: true }, data);
      expect(action).toHaveBeenCalledTimes(1);
      expect(result.success).toBeUndefined();
      expect(result.error).toContain("n’a pas pu être confirmé");
      expect(result.error).not.toContain(error.message);
      expect(data.get("reminderDays")).toBe("7");
    },
  );

  it.each([
    "NEXT_REDIRECT;replace;/login;307;",
    "NEXT_HTTP_ERROR_FALLBACK;403",
  ])(
    "preserves framework access and session navigation: %s",
    async (digest) => {
      const error = Object.assign(new Error("Framework navigation"), {
        digest,
      });
      const action = vi.fn().mockRejectedValue(error);
      await expect(recoverableSave(action)({}, new FormData())).rejects.toBe(
        error,
      );
      expect(action).toHaveBeenCalledTimes(1);
    },
  );
});
