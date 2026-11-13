import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { authRedirect } from "@/lib/auth-redirect";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (supabaseConfig() && code) {
    const client = await createClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return authRedirect(request.url,request.nextUrl.searchParams.get("next")==="reset-password" ? "/auth/reset-password" : "/account");
  }
  return authRedirect(request.url,"/login?confirmation=invalid");
}
