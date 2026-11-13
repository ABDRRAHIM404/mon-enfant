export type CallbackFailurePath =
  | "/login?confirmation=invalid"
  | "/forgot-password?recovery=invalid"
  | "/forgot-password?recovery=browser";
export function callbackFailurePath(
  recovery: boolean,
  code?: string,
): CallbackFailurePath {
  if (!recovery) return "/login?confirmation=invalid";
  return code === "pkce_code_verifier_not_found" || code === "bad_code_verifier"
    ? "/forgot-password?recovery=browser"
    : "/forgot-password?recovery=invalid";
}
