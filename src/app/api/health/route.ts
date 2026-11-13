import { dependencyReadiness } from "@/lib/operations/readiness";
import { supabaseConfig } from "@/lib/supabase/config";
import { reportOperationalEvent } from "@/lib/operational-events";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET() {
  const ready = await dependencyReadiness(supabaseConfig());
  if (!ready) reportOperationalEvent("operational_readiness_failed");
  return Response.json(
    { status: ready ? "ok" : "unavailable" },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
