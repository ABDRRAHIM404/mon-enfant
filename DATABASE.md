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

## Patient registry (Phase 3)

Migration `20261113042732_patient_registry.sql` adds declared professional/facility membership, demographic certainty and paper provenance, request/decision history, explicit access-management delegation, immutable revocation reasons and private idempotency receipts. Permanent child IDs and scoped raw local numbers are retained.

Patient reads use audited `list_patients` and `get_child_profile` RPCs. Direct authenticated SELECT on children, registers, grants and facilities is revoked. Worklist and grant-detail reads also append access metadata. Clinical access checks both current professional/grant state and the JWT session ID against `auth.sessions`; missing, expired, mismatched or removed sessions fail closed. The same session requirement protects existing verification/reviewer/evidence boundaries.

`register_child` atomically creates identity, creator-management grant and register entry. `request_child_access` returns a receipt without child demographics or internal child ID before approval, even for an unknown universal ID. `decide_child_access` requires a current manager and an explicit authorization attestation, rechecks the requester and facility membership, and atomically grants access and creates the requested register association. Managers can delegate explicitly and revoke another professional with an immutable reason; admins have no patient bypass. Advisory/row locks and uniqueness constraints protect concurrent decisions and register numbering. Mutation operation UUIDs bind actor, operation and exact payload; retries return the original result and changed payloads are rejected.

Older migration tests remain historical snapshots. `tests/registry.test.ts` applies all current migrations with actual session fixtures. `scripts/verify-registry.py` exercises hosted forms and real provider authorization/concurrent decisions with synthetic accounts only. Applied/deployed status and evidence belong in PROGRESS.md.

## Clinical ledger and capability layer (Phase 4)

Migration `20261113045412_clinical_records.sql` adds private clinical-permission-management delegation, `professional_capabilities`, immutable `capability_changes` and immutable `clinical_entries`. All exposed tables have RLS and no direct API table privileges. Checked private implementations expose narrow invoker RPC wrappers. Approval alone cannot write a clinical entry, and capability management alone cannot read a child.

Clinical originals and amendments retain child/root/previous IDs, revision, entry state, author Auth ID and platform-ID snapshot, facility, occurred-on date/certainty, source/reference/verification, payload and entry timestamp. Payloads are whitelisted and bounded by kind (consultation, prescription, risk, growth); source and unknown dates remain explicit. Amendment checks require current grant/capability/facility membership, a reason and the latest expected revision. The shared child lock coordinates writes with access revocation; root locks and unique revision/previous-ID constraints reject stale concurrent amendments. Original rows cannot be updated/deleted. Idempotency receipts bind full input to actor/operation.

Audited reads expose latest-revision timeline pages, complete event amendment history and permitted all-revision exports. Capability changes are separately attributed and retry-safe. The migration reserves the vaccination capability but does not yet implement vaccine entries/catalog/routine schedule logic. Full current-schema tests are in `tests/clinical.test.ts`; deployed/applied status and live evidence are recorded in PROGRESS.md.

Follow-up migration `20261113051659_clinical_revision_conflict.sql` uses PT409 for stale expected revisions. Explicitly raising 40001 is unsuitable for a deterministic business conflict on the actual PostgREST 14.18 provider because it retries that transaction indefinitely. Current full-schema tests apply both migrations, and hosted acceptance asserts exact HTTP 409 and the actual stale-form feedback.
