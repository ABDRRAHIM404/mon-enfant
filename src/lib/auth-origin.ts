export function authOrigin(requestOrigin: string | null, siteUrl: string, deploymentHosts: (string | undefined)[] = [], development = false): string {
  const site = new URL(siteUrl).origin;
  const allowed = new Set([site]);
  for (const host of deploymentHosts) if (host && /^[a-z0-9.-]+$/i.test(host)) allowed.add(`https://${host}`);
  if (development) { allowed.add("http://localhost:3000"); allowed.add("http://127.0.0.1:3000"); }
  if (!requestOrigin) return site;
  const parsed = new URL(requestOrigin);
  if (requestOrigin !== parsed.origin || !allowed.has(parsed.origin)) throw new Error("Unrecognized application origin");
  return parsed.origin;
}
