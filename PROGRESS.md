# Mon Enfant — Implementation progress

Updated: 13 November 2026. Execution follows `PROJECT_PLAN.md` in order. Current milestone: **Phase 4 — Clinical records and vaccine tracking**. Foundation/verification/registry technical workflows are implemented and verified; external readiness gates remain open. Full-scope audit: [PLAN_CHECKLIST.md](PLAN_CHECKLIST.md).

## Phase 0 — Requirements and source validation

The supplied requirements, roadmap and 25-dose source files are the development baseline. Clinical review, original presentation verification, legal/hosting review, exact register conventions and retention decisions are not recorded as approved. Synthetic-data foundation work can proceed; real-data deployment cannot.

## Phase 1 — Implemented in source

- Next.js App Router, TypeScript, Tailwind, pinned dependencies, lint/typecheck/test/build commands.
- Public/auth pages in French, responsive styling, clear unconfigured state.
- Supabase SSR cookie client, session refresh proxy and validated server-side identity checks.
- Sign-up, email-confirmation handler, password sign-in, sign-out and unverified profile initialization.
- Protected professional status page and approved-doctor route guard.
- All five verification states, protected roles and platform professional IDs.
- Initial SQL migration: professionals, facilities, children, scoped registers, explicit access grants and operational audit.
- Explicit table privileges and RLS; no self-approval, no clinical access for unverified/suspended/admin accounts, child access requires an active grant.
- Immutable child IDs, scoped register constraints, append-only audit triggers including grant changes.
- Synthetic fixture data, actual PostgreSQL RLS/privilege tests, desktop/mobile browser checks and GitHub Actions CI.
- Setup, architecture, schema, security and vaccine-source documentation.

## Phase 1 — Still required before exit criteria are met

- Finish the real email-delivery/confirmation walkthrough with an authorized mailbox. Password login, refresh, logout and hosted form sessions are proven by synthetic live tests.
- Hosted Auth, profile initialization through PostgREST, API denial and existing-token suspension now pass live tests. Outbound email delivery remains untested.
- Private evidence storage/submission and admin review are now implemented and tested; the remaining live-email delivery walkthrough and external operations gates stay open.
- Establish staging and privacy-preserving operational error monitoring before external use.

Connected services:
- Private GitHub: https://github.com/ABDRRAHIM404/mon-enfant
- Vercel project: `mon-enfant`, Node.js 24, Git-linked remote builds, deployment protection enabled. Connected app deployment passed: https://mon-enfant.vercel.app .
- Supabase: `mon-enfant` / `zkkasbxvdvecnafgjpxd`, healthy in Paris (`eu-west-3`). The initial migration was applied and the CLI is linked. Public app configuration is installed in Vercel and in ignored `.env.local`; the database password is stored only in the owner-readable local file.
- Auth configuration uses email confirmation, minimum 12-character passwords, the hosted origin and exact callback allowlist. The default confirmation template is retained on the free plan; PKCE callback support was added.

Docker is unavailable locally; no Docker installation or local stack was started. Phase 1 is not marked complete.

## Verification

- `npm run lint`: passed (no warnings after the PostCSS export fix).
- `npm run typecheck`: passed.
- `npm test`: 29 tests passed across authorization and actual PostgreSQL/RLS suites. The first cold run hit a database-startup timeout; the successful rerun used a longer setup timeout and one worker.
- `npm run build`: passed with Next.js 16.4.6.
- GitHub Actions passed lint, TypeScript, 29 unit/database tests, the production build and all 8 desktop/mobile browser checks: https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43348722754 . The first run exposed an ambiguous alert selector, which was fixed before the passing rerun. Local browser checks remain stopped at the user’s request.
- Live Supabase checks: Auth health HTTP 200; anonymous children/profile REST reads HTTP 401 (`42501`); RLS enabled on all six tables; security advisor returned no issues.
- All owned local development/browser processes were stopped. Future heavy checks/builds run remotely; local work stays lightweight.

## Next ordered milestone

Next: Phase 4 draft versioned vaccine catalog, cautious routine-date calculations and vaccine administration/matching. Clinical-record core is applied, deployed and hosted-verified; Phase 3 registry acceptance passed; appointment/clinical dashboard additions depend on Phases 4/5. The complete Phase 0–8 goal is tracked in PLAN_CHECKLIST.md; no full-goal completion is claimed.

## Overnight continuation — professional verification

Implemented, migrated, cloud-verified and deployed from `feature/professional-verification`: private evidence bucket and policies, atomic credential submission, explicit reviewer permission, admin queue/detail, bounded private downloads with access audit, approval/rejection/more-evidence decisions and audited suspension/reactivation. Added file-signature validation, operational logging and reviewer/retention procedures in OPERATIONS.md. Authorization/migration tests, cloud CI and hosted API/form checks pass. External pilot-readiness approvals are not claimed.

### Verification feature evidence

- Feature commit `f6fd6a7` passed cloud lint/typecheck, database/unit tests, build and desktop/mobile anonymous route guards: https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43351090460 . The Vercel preview is ready.
- Migration `20261113030711_professional_verification.sql` applied to the synthetic development database. An initial TCP connection attempt failed before any migration ran; a subsequent CLI push succeeded. Security advisors returned no issues.
- Operator live smoke run `ba41ddc8bb14` passed 37 checks covering actual Auth, profile initialization, private Storage, credential RPCs, reviewer permissions, approval, repeated-decision denial, clinical grants, suspension with an existing JWT, refresh and logout. Four fictional accounts were suspended, grants revoked and evidence removed afterward. No email was sent.
- HTTP-only production session cookies passed cloud CI and were verified on the actual hosted login response. Hosted form smoke tests passed after promotion.

### Deployed verification checkpoint

- Main app now runs feature commit `7dc72da`. Preview cloud CI passed: https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43352996711 . The main-target CI run is https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43353346088 . Vercel deployment `dpl_HYjPnLz8JEMoXPorEEN2xSWaSpxf` is ready.
- Hosted HTML form smoke run `d7fcb2c2df` passed all 15 checks against the deployed Next.js application: login, Secure/HTTP-only cookies, profile activation, private multipart submission, pending/doctor route denial, reviewer detail/download/approval, applicant decision history and logout. This used small HTTPS requests, not a local browser. No outgoing email was sent.
- The first hosted test expected a transient success message; the page had correctly refreshed to pending state, confirmed in the database. The assertion now accepts the submitted/pending view and separately verifies the persisted request. Cleanup also closes abandoned fictional pending requests through the authorized review workflow. All test accounts are suspended, reviewer privileges removed and documents purged; audit metadata is retained.
- CLINICAL_MODEL.md records the correction/provenance/privilege/version/continuity contract for the next phases. Production clinical/legal/hosting, real reviewer appointment and email delivery validation remain unapproved.

### Password recovery checkpoint

- Completed the missing account-recovery flow before registry implementation: forgot-password request, same-origin PKCE callback, one-use recovery-token route, authenticated password reset, matching/length checks, global sign-out and generic non-enumerating request feedback. Redirects use fixed internal destinations and no-referrer/no-store headers.
- Feature `f79e6d4` passed cloud CI: https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43356763543 and main CI: https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43357698215 . Main Vercel deployment `dpl_84Ky2iXWbRqegdgNR2RsaUoEAF6o` is ready.
- `scripts/verify-recovery.py` passed 12 actual hosted/provider checks, including one-use token confirmation, rejection of mismatched fields, old-password invalidation, new-password login, invalidation of earlier refresh sessions and a denied token replay. The fixture account was retired; no email was sent. Actual email delivery remains an external integration check.
- Shared low-resource HTML client is in `scripts/operator_http.py`. Full Phase 0–8 scope and unresolved gates remain in PLAN_CHECKLIST.md. REGISTRY_SPEC.md captures the next coding contract, including explicit authorization, unknown paper demographics, audited clinical reads and current-session checks. It also records the still-unproven largest hosted file upload size for hardening.

### Registry — applied, deployed and verified

- Added the doctor dashboard with actual counts, scoped patient search/filters/pagination, declared practices, new/paper registration with demographic uncertainty and provenance, authorized existing-child linking, access-request approval/withdrawal, child overview and explicit manager delegation/revocation.
- Audited patient/worklist/grant reads replace unaudited direct clinical SELECT. Current Auth session, professional approval, facility membership and child grants are checked at the database boundary. Registration and access decisions are transactional and retry-safe; register number 00125 remains distinct from another doctor’s 78 for the same immutable child.
- Feature commit `2a4aeba` passed cloud lint/typecheck, 71 unit/PostgreSQL tests, production build and 10 desktop/mobile browser checks: https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43361240304 . Main deployment `dpl_4y4U5XNzdGNp9PejrsD1d7R7uz6K` is READY at the canonical origin. Main CI: https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43361525586 .
- Migration `20261113042732_patient_registry.sql` is applied and present in the hosted migration ledger. The CLI’s optional Docker catalog-cache warning did not affect application; no Docker stack was installed or started.
- Updated provider smoke run `ce77c0da86c8` passed 39 checks against the migrated database, including existing-token suspension and global-logout denial. Four fake users were retired and their evidence removed. No mail was sent.
- Security advisor reports one Auth warning for disabled leaked-password screening (documented Pro feature); no additional SQL/RLS/function warnings. No paid plan was provisioned. This remains a readiness item in SECURITY.md.
- Hosted registry run `20fd59e5d7` passed 25 checks: actual practice/registration/paper/request/approval/revocation forms, shared child identity with A’s local 00125/B’s 78, idempotency, non-disclosing unknown-ID receipts, simultaneous approval (one winner), simultaneous duplicate registration (one created/one review warning), revoked-session denial and actual read-audit events. Four fake accounts were retired; grants/practice memberships revoked and pending requests withdrawn.
- Hosted verification regression run `7cade9f890` passed all 15 checks after the session/RLS changes, including private evidence download and actual review/logout forms. Two fake accounts were suspended and documents purged. No mail was sent. Main CI `43361525586` passed.
- Phase 3 technical acceptance is complete. Phase 4 clinical events, explicit write capabilities, draft vaccine versions and reviewed routine reference logic are next. Appointment-driven dashboard/last-next-visit additions remain in Phases 4/5. Full Phases 4–8, actual mail delivery and all external clinical/legal/hosting/identity gates remain outstanding.


### Clinical-record core — applied and cloud-verified

- Implemented separate appointment of clinical-permission managers, per-activity capabilities/expiry with immutable checked-source decisions, own permission history, and current capability/grant/facility/session checks on every clinical write. Identity review/admin approval does not imply these permissions; permission managers have no patient bypass.
- Added consultation, prescription/treatment, risk/allergy and growth entries with explicit units, date certainty and source verification. Each original/correction/withdrawal is append-only with author/platform/facility/entry time and prior revision. Different authorized capable doctors can amend; stale/concurrent revisions cannot overwrite the ledger. Mutations are retry-safe.
- Added paged clinical timeline and full per-entry history, correction/withdrawal forms, raw measurement plots, printable all-revision summary and audited streamed JSON downloads. The interactive export cap is 5,000 revisions and errors explicitly beyond that limit; no silent truncation. Charts show the displayed page's exact-date active measurements, not clinical percentile/reference interpretations.
- Feature `d7ac11b` passed cloud lint/typecheck, 83 unit/PostgreSQL tests, build and 10 desktop/mobile route checks: https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43363737379 . Main CI https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43364000869 passed. Deployment `dpl_93QgVqHUcig3eP1umjKPJePNh9qH` is READY at the canonical origin.
- Migration `20261113045412_clinical_records.sql` is applied; all 15 public tables have RLS. Initial cloud parsing caught a CASE-expression syntax error; it was corrected and verified in a hosted rollback transaction before the passing suite and migration application. Security advisors report only the existing Auth leaked-password warning, with no additional database/RLS/function warnings.
- The first hosted clinical run passed early checks, then timed out at stale revision handling. Cleanup suspended all five fixtures. Investigation identified the documented PostgREST 14.18 infinite retry for manually raised SQLSTATE 40001. Applied follow-up migration `20261113051659_clinical_revision_conflict.sql` now returns PT409/HTTP 409. Fix CI passed: https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43364557132 . Main `44278a3` CI passed: https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43364841583 . Deployment `dpl_9C4wct1WY1LFRcafLY8ACnF4nqi3` is READY.
- Hosted run `d0085640cb` passed all 28 clinical acceptance checks: real capability forms, consultation/retry, second-doctor correction, stale-form reload feedback, exact HTTP 409 conflicts, one-winner concurrent corrections, immutable withdrawal, growth page/charts, prescription/risk entries, complete seven-row print/streamed JSON export, capability revocation and logout denial. Five fictional accounts/permissions/grants were retired; no email or real clinical qualification was claimed. The clinical-record core is technically verified; vaccination/catalog and later phases remain open.
- Vaccine catalog/administration, routine reference calculations, appointments, parent/mobile work and the full external approval/readiness gates remain unfinished. This is a partial Phase 4 milestone, not completion of Phase 4 or the full plan.


### Owner email walkthrough and recovery feedback

- The owner completed real signup/confirmation on the canonical app; hosted Auth independently shows that account email confirmed. No password or email token was requested or stored in project documentation. This closes the actual signup-mail/confirmation check, not the complete recovery walkthrough or production SMTP gate.
- A recovery email arrived but the owner reported an expired link after requesting in Brave, opening in Chrome, then trying Brave. Recovery uses same-browser PKCE and one-use email verification. Further messages did not arrive; the built-in sender is documented as limited to two messages per project per hour, shared across signup/recovery. No extra email requests were made by the agent. A fresh same-browser user walkthrough remains pending.
- Added self-service recovery failure pages distinguishing missing/mismatched browser proof from invalid/used/expired links, private-copy browser instructions, and explicit non-enumerating feedback for provider sending-limit errors. Operational IDs now use portable Web Crypto, avoiding the development instrumentation's Node-only import warning.
- Feature `297e1c6` passed cloud lint/typecheck, 87 unit/database tests, build and 10 desktop/mobile browser checks: https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43390286533 . Deployment `dpl_8XmbXUFStMnqxkeQJJ5DbLmxhnvr` is READY. The mobile check initially matched Next's route announcer as a second alert; the assertion now targets the actual recovery error text.
- Operator recovery-token/browser-proof regression passed all 13 hosted checks without sending email, including password replacement, old-credential rejection, one-use token replay denial and accurate missing-browser-proof feedback. The synthetic fixture was retired; the real user SMTP/recovery quota was unaffected. The owner's actual recovery-email/new-password walkthrough remains pending. Vaccine calendar-kernel work is on `feature/vaccine-catalog`; its first cloud suite passed, but catalog storage/review/editor/administration work remains unfinished.

### Resend integration — connection prerequisites pending

- The owner explicitly requested Resend MCP and SMTP integration, with Supabase retaining Auth/session responsibility. Registered the official hosted MCP server in local Codex configuration; `codex mcp get resend` confirms the enabled HTTP endpoint. OAuth login timed out without a callback, so the server is configured but not authenticated. No local Resend server/dependency stack was installed.
- No Resend integration is connected to the Vercel project and no Resend keys/sending domain are available in the project environment. Asked the owner for the domain/sender and to save a sending key privately in the ignored environment file. Do not use the Vercel hosting subdomain as a sending domain, infer ownership or provision a paid domain/plan.
- Added an operator setup script with an offline plan, verified-domain/tracking/TLS-auth preflight, targeted SMTP/rate-limit PATCH and Auth/session/template readback checks. Credentials are environment-only; no email is sent. Default intended limits are 30 Auth emails/hour and a 60-second recipient cooldown. Existing hosted SMTP remains unchanged until real preflight succeeds. EMAIL_DELIVERY.md records activation/verification steps and the separate unfinished application notification/guardian-invitation work.
- Feature source `4ec9bf0` passed cloud Python safety tests, lint/typecheck, unit/database tests, build and desktop/mobile browser checks: https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43393283322 . Real SMTP/mailbox delivery has not been verified. Full project scope remains active.
- Vaccine catalog branch source `0019f51` passed cloud lint/typecheck, 104 unit/database tests, build and 10 desktop/mobile checks: https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43392385231 . It includes draft catalog storage/source snapshots, independent qualified review, immutable change history, source constraints and permission/session tests. Its migration has not been applied to the hosted project; UI and actual catalog workflow acceptance remain unfinished while the requested mail integration is prioritized.
