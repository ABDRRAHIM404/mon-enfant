# Phase 1 database foundation

Migration: `supabase/migrations/20261113021114_foundation.sql`. Applied to the dedicated development project `zkkasbxvdvecnafgjpxd`; live RLS flags and anonymous denial verified, with no security-advisor issues.

| Table | Purpose | Authenticated API access |
| --- | --- | --- |
| `professional_profiles` | Auth-linked role, verification state, unique professional ID | Own profile read; own `user_id` insert only |
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

- Remaining Phase 1: verification requests, protected evidence metadata and private Storage policies.
- Phase 2: controlled admin decisions, reviewer permissions and role management.
- Phase 3: transactional registration, duplicate review and authorized linking, using the existing identity/register/access structure.
- Phase 4: versioned source rules, dose events, consultations, measurements and append-only corrections.
- Phase 5: appointment events, rescheduling audit and validated cross-provider dose reconciliation.

`supabase/seed.sql` contains a synthetic facility. Isolated test fixtures create multiple professionals, children, grants and registers. Real-data migration and production hosting have not been approved.
