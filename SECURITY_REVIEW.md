# Phase 6 development security review

This review concerns the synthetic development environment. It is not approval
for identifiable clinical data or a substitute for the behavioral access tests.
The complete review remains open in PLAN_CHECKLIST.md.

## Repeatable schema, privilege and Storage configuration checks

The operator command uses the existing linked CLI login over HTTPS, never a
service key in the application or GitHub:

```sh
python3 /tmp/mon-enfant-remote.py python3 scripts/audit-security.py
```

It is fixed to the synthetic project `zkkasbxvdvecnafgjpxd` and executes the
read-only [catalog query](supabase/checks/security-baseline.sql). It reads system
catalogs and the evidence bucket configuration, with no patient rows, identities,
sessions, documents or clinical/audit payloads. The report contains only fixed
check names, counts and booleans. Unexpected provider output is withheld. Exit 0
means this configuration baseline was met, 1 means drift needs review, and 2
means the review could not be verified. No permissions are repaired automatically.

The baseline checks:

- All 24 expected public tables have RLS; neither client role bypasses RLS.
- Anonymous roles have no public table **or column** privileges.
- Clinical tables have no direct authenticated reads; their reads use the audited
  RPC boundary. Four self-service verification/profile tables retain their scoped
  SELECT policies, which this metadata check does not attempt to prove correct.
- Authenticated roles have no clinical/table write grants. The intentional
  profile `user_id` INSERT column grant is present, while privileged profile
  INSERT columns and other column write grants are absent.
- Private tables have no client table or column privileges; anonymous access to
  the private schema and client CREATE on either application schema are absent.
- The sole anonymously executable public routine is the argument-free, stable,
  invoker readiness beacon. PUBLIC-role default execution is absent from both
  application schemas. Definers in both schemas explicitly configure search_path.
- No public views exist. A new view requires explicit review rather than silently
  assuming invoker security. New tables also require baseline review.
- Storage objects have RLS, and the single evidence bucket is private with an exact
  4,194,304-byte limit and PDF/JPEG/PNG allowlist.

Search-path presence is a configuration check, not a proof of function-body safety.
RLS enabled flags and privilege metadata do not prove row predicates, RPC current
session/capability checks, Storage object paths or policy behavior. Existing
hosted/browser denial scenarios remain necessary and are recorded in PROGRESS.md.
Cloud PostgreSQL tests of this exact query introduce column-only grants, disabled
RLS, a default-public definer and a public bucket inside rolled-back transactions
to prove that the review detects those specific regressions. They do not change
the hosted database.

## Remaining review and operational gates

Current-session removal, capability/grant revocation, unrelated/admin export
denial, recovery replay, refresh-cookie rotation, exact-size evidence and storage
denials have targeted hosted evidence in PROGRESS.md. They do not close all of:

- Auth/session and recovery policy review, production MFA/bot controls and rate limits.
- Future invitation and clinical-lookup QR token boundaries (Phase 7).
- Complete export, RLS/RPC/Storage policy review and secret/history/deployment review.
- Backup/restore, compromise containment and evidence-retention drills.
- Agreed monitoring ownership, response/recovery targets and escalation acceptance.
- Qualified clinical/source, credential-verification, privacy/legal and hosting approvals.

Auth SMTP's owner-only Resend development configuration is not broad notification
readiness. A verified sending domain and application notification/invitation
delivery remain open. Clinical and vaccine source data are unchanged by this review.

References: [PostgreSQL privilege inquiry functions](https://www.postgresql.org/docs/17/functions-info.html),
[function catalog](https://www.postgresql.org/docs/17/catalog-pg-proc.html),
[Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).
