export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

// The application uses server actions only; browser JavaScript never needs the session token.
export function sessionCookieOptions(mode = process.env.NODE_ENV) {
  return { httpOnly: true, secure: mode === "production", sameSite: "lax" as const, path: "/" };
}
