export function accountDisplayName(value: unknown): string | null {
  if (typeof value !== "string" || /[\p{Cc}\p{Cf}]/u.test(value)) return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 3 && name.length <= 150 ? name : null;
}

export function registeredAccountName(
  metadata: Record<string, unknown> | undefined,
) {
  if (!metadata) return null;
  const first = metadata.first_name ?? metadata.given_name;
  const last = metadata.last_name ?? metadata.family_name;
  const parts = [first, last].filter(
    (part): part is string => typeof part === "string",
  );
  return (
    [metadata.display_name, parts.join(" "), metadata.full_name, metadata.name]
      .map(accountDisplayName)
      .find(Boolean) ?? null
  );
}
