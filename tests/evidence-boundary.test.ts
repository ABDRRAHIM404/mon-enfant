import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import nextConfig from "../next.config";
import {
  MAX_EVIDENCE_BYTES,
  validateEvidenceSize,
} from "../src/lib/verification/validation";
import { appointmentDatabase } from "./helpers/database";
let db: PGlite;
beforeAll(async () => {
  db = await appointmentDatabase();
  await db.exec(
    readFileSync(
      "supabase/migrations/20261113190856_evidence_upload_limit.sql",
      "utf8",
    ),
  );
});
afterAll(async () => {
  await db?.close();
});
describe("the published private-evidence upload boundary", () => {
  it("accepts the exact 4 MiB limit and rejects one extra byte or invalid sizes", () => {
    expect(MAX_EVIDENCE_BYTES).toBe(4194304);
    expect(validateEvidenceSize(4194304)).toBeNull();
    for (const size of [0, -1, 4194305, NaN, Infinity, 1.5])
      expect(validateEvidenceSize(size)).toMatch(/4 Mio/);
  });
  it("leaves multipart room while keeping the complete action below the platform request cap", () => {
    const limit = Number(nextConfig.experimental?.serverActions?.bodySizeLimit);
    expect(limit).toBeGreaterThan(MAX_EVIDENCE_BYTES + 20 * 1024);
    expect(limit).toBeLessThan(4_500_000);
  });
  it("aligns current bucket acceptance without widening privacy or MIME restrictions", async () => {
    const result = await db.query(
      "select public,file_size_limit,allowed_mime_types from storage.buckets where id='professional-evidence'",
    );
    expect(result.rows).toEqual([
      {
        public: false,
        file_size_limit: 4194304,
        allowed_mime_types: ["application/pdf", "image/jpeg", "image/png"],
      },
    ]);
    await expect(
      db.exec(
        "set role authenticated;update storage.buckets set public=true where id='professional-evidence'",
      ),
    ).rejects.toThrow(/permission denied/);
    await db.exec("reset role");
  });
});
