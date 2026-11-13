# Phase 1 database foundation

Migration: `supabase/migrations/20261113021114_foundation.sql`. Applied to the dedicated development project `zkkasbxvdvecnafgjpxd`; live RLS flags and anonymous denial verified, with no security-advisor issues.

| Table | Purpose | Authenticated API access |
| --- | --- | --- |
| `professional_profiles` | Auth-linked role, verification state, unique professional ID | Own profile read/initialization; explicitly authorized reviewers may read review subjects |
| `facilities` | Care facility identity | Read facilities through own authorized registry |
| `children` | Immutable child UUIDs and minimum demographics | Read explicitly granted children as an approved doctor |
| `access_grants` | Professional-child authorization, expiry and revocation | Read own active grants as an approved doctor |
| `doctor_patient_registry` | Doctor/facility/year/book/local-number associations | Read own rows while child access remains authorized |
| `audit_events` | Actor, entity, operation and timestamp, without clinical payloads | No API grants/policies |

RLS is enabled on every public table, with explicit privileges and indexed access paths. Anonymous clients have no table privileges. An admin role alone confers no clinical access. Only approved doctors with an assigned platform ID and active child grant can read child data. Registry membership cannot grant access. Access grants cannot be created or edited from the current public API.

Profiles expose only the current user's protected state. `INSERT(user_id)` permits initializing an unverified doctor profile. Other columns cannot be supplied, and updates/deletes are not granted. Approval/suspension will be handled by a controlled Phase 2 operation.

The internal audit trigger is `SECURITY DEFINER` only to append an event after permitted profile initialization. It lives in an unexposed private schema, pins its search path and has no executable grant to clients. Audit rows cannot be updated/deleted, including by ordinary privileged table DML. Database owners can alter/drop triggers, so operational tamper resistance and external retention remain readiness work.

Clinical write privileges are deliberately not granted in this foundation. Each later clinical operation needs server validation, a narrowly scoped transactional database operation, actor/facility attribution, correction handling and access tests before being exposed.

## Remaining schema work by phase

- Verification requests, protected evidence metadata and private Storage policies are implemented.
- Controlled reviewer decisions, explicit permissions and professional account suspension/reactivation are implemented. Trusted staff-role provisioning remains an operator-controlled procedure.
- Phase 3: transactional registration, duplicate review and authorized linking, using the existing identity/register/access structure.
- Phase 4: versioned source rules, dose events, consultations, measurements and append-only corrections.
- Phase 5: appointment events, rescheduling audit and validated cross-provider dose reconciliation.

`supabase/seed.sql` contains a synthetic facility. Isolated test fixtures create multiple professionals, children, grants and registers. Real-data migration and production hosting have not been approved.

## Professional verification migration

`20261113030711_professional_verification.sql` adds private `staff_permissions`, public `verification_requests`, append-only `verification_decisions` and `professional_status_events`, and the private `professional-evidence` bucket. RLS is enabled on every public/private table. Direct request/decision/status writes are not granted.

Public invoker RPC wrappers call narrow implementations in the unexposed private schema with empty search paths. Every privileged implementation checks the caller's current database-backed role/permission. Submission locks the applicant, verifies ownership/existence of private evidence, enforces active matricule uniqueness and atomically changes status to under review. Review locks the request/account, prevents self/repeated review, requires reasons and both source checks for approval, and appends the decision/status history. Suspension/reactivation is limited to previously approved doctors. Admin role alone cannot review, grant itself reviewer permission or read children.

Documents are owner-prefixed UUID paths, limited to 5 MiB PDF/JPEG/PNG. There is no client replacement policy, and applicants cannot delete submitted originals. App download routes record access before issuing a 60-second download URL. Authorized direct Storage reads also depend on reviewer RLS and platform access logs; the application does not claim its own audit table captures every possible Storage API read.

Live integration runs verified these policies against hosted PostgREST/Storage/Auth, including suspension with an already issued token. Original migration tests remain migration-specific snapshots; each subsequent phase must verify the full current schema's access boundaries as well as its own new operations.
