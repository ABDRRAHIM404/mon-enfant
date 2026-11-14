import { NextResponse } from "next/server";
export function authRedirect(
  requestUrl: string,
  path:
    | "/account"
    | "/parent"
    | "/parent/invitation"
    | "/auth/reset-password"
    | "/login?confirmation=invalid"
    | "/forgot-password?recovery=invalid"
    | "/forgot-password?recovery=browser",
) {
  const response = NextResponse.redirect(new URL(path, requestUrl));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
