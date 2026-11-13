import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { appointmentDatabase } from "./helpers/database";
import { dependencyReadiness } from "../src/lib/operations/readiness";

const config = {
  url: "https://synthetic.example.invalid",
  key: "publishable-fixture",
};
const service = { name: "GoTrue", version: "synthetic-version" };

describe("bounded anonymous dependency checks", () => {
  it("checks Auth and a database round trip without caller credentials or session persistence", async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (url, options) => {
      calls.push(String(url));
      expect(options?.headers).toEqual({
        apikey: config.key,
        Accept: "application/json",
      });
      expect(options?.credentials).toBe("omit");
      expect(options?.redirect).toBe("error");
      expect(options?.cache).toBe("no-store");
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      return Response.json(String(url).endsWith("/health") ? service : true);
    };
    expect(await dependencyReadiness(config, fetcher)).toBe(true);
    expect(calls.sort()).toEqual([
      `${config.url}/auth/v1/health`,
      `${config.url}/rest/v1/rpc/operational_readiness`,
    ]);
  });
  it("fails closed without configuration and makes no request", async () => {
    const fetcher = vi.fn();
    expect(await dependencyReadiness(null, fetcher)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    "database-http",
    "auth-http",
    "database-false",
    "auth-shape",
    "invalid-json",
    "transport",
  ])("returns a fixed failure for %s", async (failure) => {
    const fetcher: typeof fetch = async (url) => {
      const auth = String(url).endsWith("/health");
      if (failure === "transport")
        throw new Error("Private provider details must never escape");
      if (
        (failure === "database-http" && !auth) ||
        (failure === "auth-http" && auth)
      )
        return new Response("Private upstream error", { status: 503 });
      if (failure === "invalid-json")
        return new Response("invalid private upstream content");
      if (failure === "auth-shape" && auth)
        return Response.json({ name: "unrelated-service" });
      return Response.json(auth ? service : failure !== "database-false");
    };
    expect(await dependencyReadiness(config, fetcher)).toBe(false);
  });
  it("aborts both outstanding requests within the shared timeout", async () => {
    let aborted = 0;
    const fetcher: typeof fetch = async (_, options) =>
      new Promise<Response>((_, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => {
            aborted++;
            reject(new DOMException("Synthetic timeout", "AbortError"));
          },
          { once: true },
        );
      });
    expect(await dependencyReadiness(config, fetcher, 5)).toBe(false);
    expect(aborted).toBe(2);
  });
});

let db: PGlite;
beforeAll(async () => {
  db = await appointmentDatabase();
  for (const file of [
    "20261113190856_evidence_upload_limit.sql",
    "20261113203528_operational_readiness.sql",
  ]) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  }
});
afterAll(async () => {
  await db?.close();
});

describe("the public beacon grants no clinical access", () => {
  it("allows anonymous constant readiness while denying patient table reads", async () => {
    await db.exec("set role anon");
    try {
      expect(
        (await db.query("select public.operational_readiness() ready")).rows,
      ).toEqual([{ ready: true }]);
      await expect(db.query("select * from public.children")).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
  it("cannot turn an authenticated role without a live authorized session into child access", async () => {
    await db.exec("set role authenticated");
    try {
      expect(
        (await db.query("select public.operational_readiness() ready")).rows,
      ).toEqual([{ ready: true }]);
      await expect(
        db.query(
          "select public.get_child_profile('00000000-0000-0000-0000-000000000000')",
        ),
      ).rejects.toThrow(/access denied/i);
    } finally {
      await db.exec("reset role");
    }
  });
  it("is an argument-free invoker function without PUBLIC execution or table side effects", async () => {
    const result = await db.query(
      "select p.prosecdef,p.provolatile,p.pronargs,exists(select 1 from aclexplode(p.proacl) a where a.grantee=0) public_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='operational_readiness'",
    );
    expect(result.rows).toEqual([
      {
        prosecdef: false,
        provolatile: "s",
        pronargs: 0,
        public_execute: false,
      },
    ]);
    expect(
      (await db.query("select count(*)::integer n from public.children")).rows,
    ).toEqual([{ n: 0 }]);
  });
});
