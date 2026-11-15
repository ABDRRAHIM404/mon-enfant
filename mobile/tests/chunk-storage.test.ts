import { describe, it, expect } from "vitest";
import {
  createChunkStorage,
  type SecureValues,
} from "../src/auth/chunk-storage";
function fixture() {
  const values = new Map<string, string>();
  let failAt = "";
  const native: SecureValues = {
    getItem: async (k) => values.get(k) ?? null,
    setItem: async (k, v) => {
      if (k === failAt) throw new Error("Simulated interrupted native write");
      if (new TextEncoder().encode(v).length > 2048)
        throw new Error("Platform small-value limit");
      values.set(k, v);
    },
    removeItem: async (k) => {
      values.delete(k);
    },
  };
  return {
    values,
    native,
    fail: (key: string) => {
      failAt = key;
    },
  };
}
describe("encrypted native session storage adapter", () => {
  it("round trips large Unicode sessions without exceeding native small-value limits", async () => {
    const f = fixture(),
      s = createChunkStorage(f.native),
      value = JSON.stringify({
        access_token: "a".repeat(5400),
        name: "🌻éطفل".repeat(350),
      });
    await s.setItem("session", value);
    expect(await s.getItem("session")).toBe(value);
    await s.removeItem("session");
    expect(f.values.size).toBe(0);
  });
  it("preserves the last complete session across an interrupted write and recovers on retry", async () => {
    const f = fixture(),
      s = createChunkStorage(f.native);
    await s.setItem("session", "old".repeat(400));
    f.fail("session.a.2");
    await expect(s.setItem("session", "new".repeat(400))).rejects.toThrow();
    expect(await s.getItem("session")).toBe("old".repeat(400));
    f.fail("");
    await s.setItem("session", "next".repeat(400));
    expect(await s.getItem("session")).toBe("next".repeat(400));
    await s.removeItem("session");
    expect(f.values.size).toBe(0);
  });
  it("serializes competing refresh/logout writes and never resurrects a removed session", async () => {
    const f = fixture(),
      s = createChunkStorage(f.native);
    await Promise.all([
      s.setItem("session", "first".repeat(400)),
      s.setItem("session", "second".repeat(400)),
      s.removeItem("session"),
    ]);
    expect(await s.getItem("session")).toBeNull();
    expect(f.values.size).toBe(0);
  });
  it("forgets corrupt or incomplete sessions instead of returning a partial bearer", async () => {
    const f = fixture(),
      s = createChunkStorage(f.native);
    await s.setItem("session", "token".repeat(400));
    const index = JSON.parse(f.values.get("session.index")!);
    f.values.delete(`session.${index.active}.1`);
    expect(await s.getItem("session")).toBeNull();
    expect(f.values.size).toBe(0);
    f.values.set("session.index", '{"v":1,"active":"a","a":999999,"b":0}');
    f.values.set("session.a.3", "encrypted orphan");
    expect(await s.getItem("session")).toBeNull();
    expect(f.values.size).toBe(0);
  });
  it("bounds remembered sessions without extending the initial deadline on refresh", async () => {
    const f = fixture();
    let now = 1000;
    const s = createChunkStorage(f.native, () => now);
    await s.setItem("session", "original");
    now += 29 * 86400000;
    await s.setItem("session", "refreshed");
    now += 2 * 86400000;
    expect(await s.getItem("session")).toBeNull();
    expect(f.values.size).toBe(0);
  });
  it("rejects unbounded values and unsafe native keys before storing anything", async () => {
    const f = fixture(),
      s = createChunkStorage(f.native);
    await expect(
      s.setItem("session", "x".repeat(128 * 300 + 1)),
    ).rejects.toThrow();
    expect(() => s.getItem("../session")).toThrow();
    expect(f.values.size).toBe(0);
  });
});
