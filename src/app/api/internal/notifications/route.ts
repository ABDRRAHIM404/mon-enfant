import { createHash, timingSafeEqual } from "node:crypto";
import { dispatchApprovalNotifications } from "@/lib/notifications/dispatch";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export async function POST(request: Request) {
  const key = process.env.APP_EMAIL_CRON_SECRET ?? "";
  const supplied = createHash("sha256")
    .update(request.headers.get("authorization") ?? "")
    .digest();
  const expected = createHash("sha256").update(`Bearer ${key}`).digest();
  if (key.length < 32 || !timingSafeEqual(supplied, expected))
    return Response.json({ status: "denied" }, { status: 401, headers });
  const result = await dispatchApprovalNotifications();
  const ok =
    result.status === "completed" &&
    result.failed === 0 &&
    result.needs_review === 0 &&
    result.unacknowledged === 0;
  return Response.json(result, { status: ok ? 200 : 503, headers });
}
