import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig, sessionCookieOptions } from "./config";
import {
  authCookieLifetime,
  rememberedPreference,
  sessionPreferenceCookie,
} from "./cookie-lifetime";
export async function createClient(remembered?: boolean) {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase is not configured");
  const store = await cookies();
  const retention =
    remembered ??
    rememberedPreference(store.get(sessionPreferenceCookie)?.value);
  return createServerClient(config.url, config.key, {
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(
              name,
              value,
              authCookieLifetime(name, options, retention),
            ),
          );
        } catch {
          /* Server Components cannot set cookies. The proxy refreshes them. */
        }
      },
    },
  });
}
