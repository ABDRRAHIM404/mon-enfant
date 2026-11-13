# Mon Enfant — Implementation progress

Updated: 13 November 2026. Execution follows `PROJECT_PLAN.md` in order. Current milestone: **Phase 1 — Technical foundation (in progress)**.

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

- Complete the real email-confirmation/session lifecycle smoke test against the connected development project.
- Verify real Auth email/sign-in/refresh/logout, profile initialization through PostgREST, live API denial and suspension behavior. Isolated PostgreSQL tests do not prove the hosted integration.
- Create private verification-evidence storage and the minimal submission workflow required by Phase 1, before any documents are accepted. Admin review screens remain Phase 2.
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

Finish Phase 1 storage/submission and integration verification, then Phase 2: credential/evidence submission, restricted admin review queue, audited approve/reject/suspend operations. Phase 3 patient-registry screens and Phase 4 vaccination logic have not been implemented.

## Overnight continuation — professional verification

Implemented on `feature/professional-verification` (not yet verified/applied): private evidence bucket and policies, atomic credential submission, explicit reviewer permission, admin queue/detail, bounded private downloads with access audit, approval/rejection/more-evidence decisions and audited suspension/reactivation. Added file-signature validation, operational logging and reviewer/retention procedures in OPERATIONS.md. Authorization/migration tests and cloud CI are the next verification gate. Phase 1/2 completion is not yet claimed.
