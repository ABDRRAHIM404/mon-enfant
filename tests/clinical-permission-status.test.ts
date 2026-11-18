import { describe, it, expect } from "vitest";
import { clinicalPermissionStatus } from "../src/lib/clinical/permission-status";
const now = Date.parse("2026-11-18T15:00:00Z");
describe("effective clinical permission labels", () => {
  it("never labels a disabled permission as granted", () => {
    expect(
      clinicalPermissionStatus({ enabled: false, expires_at: null }, now),
    ).toBe("revoked");
  });
  it("identifies a grant that has expired even while its enabled flag remains true", () => {
    expect(
      clinicalPermissionStatus(
        { enabled: true, expires_at: "2026-11-18T14:59:59Z" },
        now,
      ),
    ).toBe("expired");
  });
  it("matches the server's exclusive expiry boundary", () => {
    expect(
      clinicalPermissionStatus(
        { enabled: true, expires_at: "2026-11-18T15:00:00Z" },
        now,
      ),
    ).toBe("expired");
  });
  it("shows an unexpired or unbounded enabled grant as granted", () => {
    expect(
      clinicalPermissionStatus(
        { enabled: true, expires_at: "2026-11-18T15:00:01Z" },
        now,
      ),
    ).toBe("granted");
    expect(
      clinicalPermissionStatus({ enabled: true, expires_at: null }, now),
    ).toBe("granted");
  });
});
