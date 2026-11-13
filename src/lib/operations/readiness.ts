type Configuration = { url: string; key: string } | null;
export const READINESS_TIMEOUT_MS = 3000;

// This request never forwards a caller's cookies, JWT, body or query parameters.
// The publishable key is sufficient; no service/operator key belongs here.
export async function dependencyReadiness(
  config: Configuration,
  fetcher: typeof fetch = fetch,
  timeoutMs = READINESS_TIMEOUT_MS,
): Promise<boolean> {
  if (!config) return false;
  const signal = AbortSignal.timeout(timeoutMs);
  const options: RequestInit = {
    headers: { apikey: config.key, Accept: "application/json" },
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    signal,
  };
  try {
    const [database, auth] = await Promise.all([
      fetcher(`${config.url}/rest/v1/rpc/operational_readiness`, options),
      fetcher(`${config.url}/auth/v1/health`, options),
    ]);
    if (!database.ok || !auth.ok) return false;
    const [ready, service] = await Promise.all([database.json(), auth.json()]);
    return (
      ready === true &&
      service?.name === "GoTrue" &&
      typeof service.version === "string"
    );
  } catch {
    // Provider errors can contain URLs/headers. Expose only a fixed result.
    return false;
  }
}
