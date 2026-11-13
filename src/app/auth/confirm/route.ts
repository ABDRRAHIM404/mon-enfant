import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { authRedirect } from "@/lib/auth-redirect";
export async function GET(request: NextRequest) {
  const token_hash=request.nextUrl.searchParams.get("token_hash");
  const type=request.nextUrl.searchParams.get("type");
  if (supabaseConfig() && token_hash && (type==="signup" || type==="recovery")) {
    const client=await createClient();
    const { error }=await client.auth.verifyOtp({ token_hash,type });
    if (!error) return authRedirect(request.url,type==="recovery" ? "/auth/reset-password" : "/account");
  }
  return authRedirect(request.url,"/login?confirmation=invalid");
}
