export const SITE = "https://mon-enfant.vercel.app";
export const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function name(child: {
  given_name: string | null;
  family_name: string | null;
}) {
  return (
    [child.given_name, child.family_name].filter(Boolean).join(" ") ||
    "Identité non précisée"
  );
}
export function birth(child: {
  birth_date: string | null;
  birth_date_precision: string;
}) {
  return !child.birth_date
    ? "Date de naissance inconnue"
    : (child.birth_date_precision === "estimated"
        ? "Date estimée : "
        : "Né(e) le ") +
        new Intl.DateTimeFormat("fr-MA", {
          timeZone: "UTC",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(child.birth_date + "T12:00:00Z"));
}
export function instant(value: string) {
  return new Intl.DateTimeFormat("fr-MA", {
    timeZone: "Africa/Casablanca",
    dateStyle: "medium",
    timeStyle: "short",
    timeZoneName: undefined,
  }).format(new Date(value));
}
export function today() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Casablanca",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function civilAdd(day: string, amount: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function invitationToken(value: string) {
  const text = value.trim();
  if (/^[A-Za-z0-9_-]{43}$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (
      url.origin !== SITE ||
      url.pathname !== "/parent/invitation" ||
      url.search
    )
      return null;
    const params = [...new URLSearchParams(url.hash.slice(1))];
    if (params.length !== 1 || params[0][0] !== "invite") return null;
    return /^[A-Za-z0-9_-]{43}$/.test(params[0][1]) ? params[0][1] : null;
  } catch {
    return null;
  }
}
