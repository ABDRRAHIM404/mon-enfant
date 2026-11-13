# Implementation decisions

## 13 November 2026 — Phase order and stack

Follow `PROJECT_PLAN.md` in order: foundation → professional verification/admin → registry → clinical records/vaccines → appointments/continuity → readiness. Phase 0's clinical and legal approvals remain external prerequisites for a real-data pilot; they are not implied by starting synthetic-data development.

Next.js App Router, React, TypeScript and Tailwind CSS implement the agreed stack. Supabase provides Auth/PostgreSQL; SSR cookies are handled with `@supabase/ssr`. No service-role key is needed by the current web app. The private GitHub repository is `ABDRRAHIM404/mon-enfant`. No paid services or patient-data deployment were created.

French is the provisional interface language. Arabic and final visual identity remain open decisions. The small public/authentication interface is reversible and contains no patient workflows.

## 13 November 2026 — Authorization and identity

Protected server pages validate the user with Supabase `getUser()` and read the current protected profile from the database. User-editable metadata is never used to approve a professional. The route proxy refreshes cookies; it is not the authorization boundary.

A new authenticated user may insert only their own `user_id` into the professional profile table. Role and verification fields use protected defaults. Users cannot update or delete profiles. Approval needs a professional ID. The five agreed verification states are represented.

Each child has an immutable internal UUID and an immutable universal UUID; a final human-readable ID presentation is deferred. Local register uniqueness conservatively includes professional, facility, year, book and local number. Child access is granted explicitly, independently of registry membership. Grant expiry/revocation and suspension take effect through database policy checks. Admin accounts have no clinical read access by default.

## 13 November 2026 — Verification and test scope

PGlite executes migration SQL and authorization tests without requiring a hosted account or Docker. The minimal auth fixtures model JWT subject/anonymous claims only. Supabase's actual auth/session/email/storage and REST behavior still need integration verification against a development stack.

CI runs lint, typecheck, database/unit tests, a production build and desktop/mobile browser checks. Browser checks do not authenticate against a remote project.

## 13 November 2026 — Remote verification preference

The user asked to keep their PC responsive and use GitHub/Vercel for heavy work. Local builds/tests/browser servers have been stopped. Future full verification runs in GitHub Actions, with Vercel available for remote preview builds. Local work is limited to small edits, reads and Git operations. This preference is also recorded in AGENTS.md.
