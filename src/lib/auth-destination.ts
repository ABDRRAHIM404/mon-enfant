/** Navigation context only. These choices confer no role or child permission. */
export function authDestination(
  value: unknown,
): "/account" | "/parent" | "/parent/invitation" {
  if (value === "parent") return "/parent";
  if (value === "parent-invitation") return "/parent/invitation";
  return "/account";
}
