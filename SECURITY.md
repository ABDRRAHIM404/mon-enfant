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

Phase 3 strengthens the API contract: patient and registry reads are audited RPCs, with direct table SELECT revoked. Current Auth session IDs are checked for clinical actions and existing verification/reviewer/storage boundaries. A JWT subject alone cannot retain these privileges after its Auth session is removed. Child managers explicitly review access requests, attest to the legitimate basis and optionally delegate management; request receipts do not reveal child existence/details before approval. Session, professional, grant and membership state are rechecked server-side. Operation receipts, row/advisory locks and unique register constraints defend retries/concurrent approvals. These controls do not establish legal guardianship or approved clinical privileges for future vaccine writes.

Current hosted security-advisor check after the registry migration reports `auth_leaked_password_protection`: leaked-password screening is disabled. Supabase documents this as a Pro-or-above feature ([password security](https://supabase.com/docs/guides/auth/password-security)). No paid upgrade was provisioned. The configured minimum password length remains 12; the warning stays open for pilot-readiness review. This check returned no additional database/RLS/function security warnings.

Clinical capabilities, access and entry-kind authorization are checked independently for each write and amendment. Permission managers have a private appointment flag separate from professional reviewers and no child access by virtue of that flag. Clinical originals/corrections/withdrawals and permission decisions are immutable, and operational logs contain no clinical payload. Print/JSON summaries check current doctor/session/child access, append export audit, preserve all included revisions and fail explicitly above the documented 5,000-row interactive limit. JSON downloads stream with private/no-store/no-referrer headers; streaming avoids the unstreamed 4.5 MB response cap documented in [Vercel Function limits](https://vercel.com/docs/functions/limitations). This does not resolve the separate outstanding largest-file evidence-upload boundary.

Stale clinical revisions use `PT409` (HTTP 409), not manually raised `40001`. The hosted PostgREST 14.18 runtime retries serialization failures; using them for deterministic business conflicts can cause an infinite request retry loop. See [Supabase troubleshooting](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b). The first live run caught this gap beyond the passing embedded-Postgres suite; the follow-up migration and exact-status hosted checks address it.
