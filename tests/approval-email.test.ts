import { describe, expect, it, vi } from "vitest";
import {
  approvalPayload,
  notificationConfig,
  sendApproval,
  type ApprovalJob,
} from "../src/lib/notifications/protocol";
const job: ApprovalJob = {
  id: "10000000-0000-4000-8000-000000000001",
  lease_id: "10000000-0000-4000-8000-000000000002",
  recipient_email: "owner@example.invalid",
  from_email: "onboarding@resend.dev",
  site_origin: "https://mon-enfant.vercel.app",
  template_version: 1,
};
const env = {
  APP_EMAIL_MODE: "owner-only",
  RESEND_API_KEY: "re-fixture-only",
  APP_EMAIL_WORKER_EMAIL: "worker@example.invalid",
  APP_EMAIL_WORKER_PASSWORD: "fictional-worker-password-long-enough",
  APP_EMAIL_ALLOWED_RECIPIENT: job.recipient_email,
};
const config = notificationConfig(env)!;
describe("minimal approval email and bounded Resend transport", () => {
  it("fails closed on missing credentials, preview, bad origin or unverified broad sender", () => {
    expect(notificationConfig({})).toBeNull();
    expect(notificationConfig({ ...env, VERCEL_ENV: "preview" })).toBeNull();
    expect(
      notificationConfig({
        ...env,
        APP_EMAIL_SITE_ORIGIN: "https://example.invalid/account?token=private",
      }),
    ).toBeNull();
    expect(
      notificationConfig({
        ...env,
        APP_EMAIL_MODE: "verified-domain",
        APP_EMAIL_FROM_EMAIL: "notice@example.invalid",
      }),
    ).toBeNull();
    expect(
      notificationConfig({
        ...env,
        APP_EMAIL_MODE: "verified-domain",
        APP_EMAIL_FROM_EMAIL: "notice@example.invalid",
        APP_EMAIL_DOMAIN_VERIFIED: "true",
      }),
    ).toMatchObject({ allowedRecipient: null });
  });
  it("contains only the fixed decision message and account link", () => {
    const payload = approvalPayload(job);
    expect(Object.keys(payload).sort()).toEqual([
      "from",
      "subject",
      "text",
      "to",
    ]);
    expect(payload.text).toContain("https://mon-enfant.vercel.app/account");
    for (const forbidden of [
      job.id,
      job.lease_id,
      "token=",
      "evidence.pdf",
      "matricule",
      "CH-",
    ])
      expect(payload.text).not.toContain(forbidden);
  });
  it("sends a stable versioned idempotency key across leases without cookies or redirects", async () => {
    const providerId = "20000000-0000-4000-8000-000000000001";
    const calls: RequestInit[] = [];
    const fetcher: typeof fetch = async (url, init) => {
      expect(url).toBe("https://api.resend.com/emails");
      calls.push(init!);
      return Response.json({ id: providerId });
    };
    expect(await sendApproval(job, config, fetcher)).toEqual({
      outcome: "accepted",
      providerId,
    });
    await sendApproval(
      { ...job, lease_id: "30000000-0000-4000-8000-000000000001" },
      config,
      fetcher,
    );
    expect(calls[0].body).toBe(calls[1].body);
    expect(calls[0].headers).toEqual(calls[1].headers);
    expect(calls[0]).toMatchObject({
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
    });
    expect(
      (calls[0].headers as Record<string, string>)["Idempotency-Key"],
    ).toBe(`professional-approval/v1/${job.id}`);
  });
  it("cannot send to an unapproved recipient or malformed header address", async () => {
    const fetcher = vi.fn();
    expect(
      await sendApproval(
        { ...job, recipient_email: "other@example.invalid" },
        config,
        fetcher,
      ),
    ).toEqual({ outcome: "needs_review" });
    expect(
      await sendApproval(
        {
          ...job,
          from_email: "a@example.invalid\r\nBcc:other@example.invalid",
        },
        config,
        fetcher,
      ),
    ).toEqual({ outcome: "needs_review" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    [429, "retry"],
    [503, "retry"],
    [401, "failed"],
    [422, "failed"],
    [409, "needs_review"],
  ] as const)(
    "classifies HTTP %s without provider details",
    async (status, outcome) => {
      const result = await sendApproval(
        job,
        config,
        async () => new Response("private-provider-body", { status }),
      );
      expect(result).toEqual({ outcome });
      expect(JSON.stringify(result)).not.toContain("private-provider-body");
    },
  );
  it("uses safe retry after uncertain transport but does not invent acceptance for malformed success", async () => {
    expect(
      await sendApproval(job, config, async () => {
        throw new Error("private transport details");
      }),
    ).toEqual({ outcome: "retry" });
    for (const body of [
      "bad-json",
      JSON.stringify({ id: "private-invalid-identifier" }),
      "x".repeat(5000),
    ])
      expect(
        await sendApproval(job, config, async () => new Response(body)),
      ).toEqual({ outcome: "needs_review" });
  });
});
