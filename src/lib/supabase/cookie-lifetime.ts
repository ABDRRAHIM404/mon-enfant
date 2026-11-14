export const sessionPreferenceCookie = "mon-enfant-session-preference";
export const rememberedSeconds = 30 * 24 * 60 * 60;
export function rememberedPreference(value?: string): boolean | undefined {
  return value === "persistent"
    ? true
    : value === "session"
      ? false
      : undefined;
}
/** Change browser retention only, never Auth/session validity or permissions.
 * Leave PKCE verifiers and deletion cookies intact, including chunk cleanup.
 */
export function authCookieLifetime<
  T extends { maxAge?: number; expires?: Date },
>(name: string, options: T, remembered: boolean | undefined): T {
  if (
    !/^sb-.+-auth-token(?:\.\d+)?$/.test(name) ||
    remembered === undefined ||
    options.maxAge === 0 ||
    (options.expires && options.expires.getTime() <= Date.now())
  )
    return options;
  const result = { ...options };
  if (remembered) {
    result.maxAge = Math.min(
      options.maxAge ?? rememberedSeconds,
      rememberedSeconds,
    );
    delete result.expires;
  } else {
    delete result.maxAge;
    delete result.expires;
  }
  return result;
}
