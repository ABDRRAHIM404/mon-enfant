# Development security boundaries

This is a Phase 1 development foundation. Use fictional data only. A dedicated synthetic-data Supabase project and Vercel development deployment are connected; this does not imply a real patient pilot or legal certification.

## Implemented

- Cookie-based Supabase SSR sessions, refreshed by the route proxy; production cookies are Secure, HTTP-only and SameSite=Lax.
- Server-side validated identity (`getUser`) on protected pages and actions.
- Database-backed professional approval; no authorization from user-editable metadata.
- Fail-closed protected routes when Supabase is absent; no demo privilege bypass.
- Explicit table grants and RLS; no anonymous table access or self-approval.
- Child-specific authorization with expiry/revocation, separated from registry membership.
- Immediate database-backed suspension checks; admins have no blanket child access.
- Immutable child identities, scoped register uniqueness, append-only operational audit events.
- No clinical data in audit payloads, no application request-body logging, no secrets in client code.
- Auth failures use bounded user-facing messages; no raw provider errors are rendered.
- Next.js server actions provide same-origin mutation handling. Confirmation redirects have fixed internal destinations.

## Required before phase completion / later rollout

- Finish actual sign-up, confirmation, login, refresh, logout and role-change integration checks. The hosted Auth health and anonymous REST denial checks already pass.
- Private evidence storage/submission and controlled review are implemented and live-tested. Development retention procedures exist in OPERATIONS.md; production retention and reviewer identity/source approval remain explicit external decisions.
- Configure production Auth rate limits, bot controls and MFA/session policies after selecting hosting and the deployment threat model.
- Expand transactional audit/corrections alongside clinical writes; restrict privileged service keys and operator access.
- Verify future storage policies and full authenticated live RLS boundaries. The initial hosted security advisor returned no issues; rerun it after schema changes.
- Agree on identity evidence verification sources, retention, session revocation, recovery and incident response.
- Complete backups/recovery drills and security/accessibility review in Phase 6.
- Obtain qualified Moroccan privacy/health-data advice and clinical/hosting sign-off before storing identifiable data, per the project baseline.

Report discovered vulnerabilities privately to the repository owner. An operational disclosure address and escalation rota will be defined before external testing.

Verification evidence includes 37 hosted API checks and 15 actual hosted HTML form checks using only synthetic accounts without outbound mail. Test identities are suspended and reviewer permissions removed at cleanup. Default email delivery and formal external review are not proven by those tests.

Password recovery now has 12 live hosted/provider checks, including token replay denial and invalidation of previous refresh credentials. Do not infer immediate revocation of every already-issued access JWT from refresh-token logout alone. The next clinical access layer must validate current Auth session identity and include explicit stale-session tests; this is recorded in REGISTRY_SPEC.md. Largest-file acceptance also still needs a hosted boundary test rather than relying only on bucket limits.
