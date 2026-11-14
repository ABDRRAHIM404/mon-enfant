import { authDestination } from "@/lib/auth-destination";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { callbackFailurePath } from "@/lib/auth-callback";
import { reportOperationalEvent } from "@/lib/operational-events";
import { authRedirect } from "@/lib/auth-redirect";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const recovery =
    request.nextUrl.searchParams.get("next") === "reset-password";
  if (supabaseConfig() && code) {
    const client = await createClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return authRedirect(
        request.url,
        recovery
          ? "/auth/reset-password"
          : authDestination(request.nextUrl.searchParams.get("next")),
      );
    reportOperationalEvent("auth_callback_failed");
    return authRedirect(request.url, callbackFailurePath(recovery, error.code));
  }
  return authRedirect(request.url, callbackFailurePath(recovery));
}
