# Dashboard integration — 17 November 2026

## Final closeout — 18 November 2026

The original dashboard scope is implemented. The original live persistence, role/session/QR and responsive acceptance remains in `docs/design-qa/dashboard-live`; the narrowly scoped follow-up is in `docs/design-qa/dashboard-closeout`.

- Fixed parent profile/settings input loss when a server-action response is interrupted. The form remains mounted, clears stale success, shows that the save could not be confirmed and does not automatically replay a mutation. Framework access/session redirects remain intact.
- Fixed overlapping links in Mes enfants: the full-card overlay previously routed the first three child-section targets to Partage & accès. Each link now has its own separated, minimum 44px target and correct pointer hit area.
- Preview application **cd2bca774b005bada9559d5364557c8def115dd5**, deployment **dpl_5f9diBZtf7xxZZzuKxzqFXsjdYAi**, is READY. Seven actual authenticated form scenarios and eight navigation/motion/component scenarios pass, with zero unexpected browser exceptions. The response-loss check lets the server commit, drops the response in Chromium, verifies no automatic resend and reloads the committed preference.
- 27 focused tests across three files pass; explicit `next typegen && tsc --noEmit` passes; targeted lint passes; the exact preview's Vercel production build passes. Earlier 315-test/full dashboard acceptance is retained as earlier evidence, not relabeled as a fresh full-suite run.
- Visual comparison includes all eight parent and all eight clinician references, previous populated browser captures, fresh 1672×941 parent captures and focused child-link states. Source designs contain illustrative data and controls outside existing authority. These are reference-guided dashboards, not a pixel-identical reproduction: decorative artwork, card arrangements, account controls and data-dependent summaries have documented differences. See the current section of `design-qa.md`.
- Fresh fixture **92c6f2f0db84362d** has one synthetic parent account only: no professional role, child link or clinical permission, no clinical writes and no email. Child-card pointer checks use the actual server-rendered component with a fictional list prop and deployed CSS, clearly distinguished from backend linking acceptance. Retirement and canonical publication are recorded at the end of PROGRESS.md when complete.

The historical blocked/pending checkpoints below are retained for provenance. Their network/interruption gap is closed by this follow-up. Documents stays coming soon; app notification emails and native APK/iOS are outside this closeout.

Status: **implemented, live-verified and deployed** as application 277e618; canonical deployment dpl_GYQEGw2vQgKBAC7wLoEvSSG4oCNu READY. Fresh synthetic fixture retired; see PROGRESS.md. Current request supersedes the historical parent-web pause. Android/APK and iOS remain paused.

## Phase A — source audit

Baseline: GitHub main `04deed35d4695d24719e72ff7c6525c6962d4acc`. The uploaded archive's application source matches this baseline. Archive-only parent references were reviewed from `updates/new-design-update-5/parent/` (all eight mockups); they are visual guidance, not patient data or authority to add permissions.

Stack: Next.js 16 / React 19 server-rendered routes, TypeScript, Tailwind/CSS, Supabase SSR Auth, guarded Postgres RPCs, PGlite/Vitest and Playwright. Reviewed AGENTS.md, current progress/plan, clinician page inventory, clinical/security/parent-sharing contracts, source date calculations and parent workflows. Admin remains a separate guarded verification/operations area, not a patient-access shortcut.

The eight clinician destinations already exist in the accepted Update 5 shell. Trusted care uses current account/session, explicit child grants and clinical capabilities; unverified clinicians use a separate author-only provisional ledger. Parent home uses `parent_home_summary`; child reads use verified guardian links. Mutations remain in existing server actions and append-only RPC ledgers.

Confirmed parent navigation bug: `?view=...` originally changed the chooser heading and child link suffix; it did not render the corresponding section. Growth and Documents were anchors into the general booklet; document management had no coming-soon destination. Settings, account, calendar, privacy and booklet pages left the parent shell. Mobile account/settings pages were incorrectly marked as children.

## Changes by page

| Page | Result in this branch |
| --- | --- |
| Clinician dashboard / children / consultations / vaccinations / appointments / growth / account | Retain existing routes, forms, capabilities and clinical logic. Shared menu receives subtle interaction feedback and Escape-to-close. |
| Clinician Documents | All roles can open the existing coming-soon page, including provisional users. The page preserves provisional restrictions; no document management is enabled. |
| Parent dashboard | Home overview retained; section query now dispatches to real section content. Documents quick link truthfully says coming soon. |
| Mes enfants | Verified linked children, birth labels, booklet/section links and secure invitation entry. No unrestricted child search. |
| Vaccinations | Guarded paged history and assigned routine references, existing source/date-calculation component, authorship/status/revision, explicit unknown history and manual HB1/catch-up distinction. Links to existing detailed history/share page. |
| Croissance | Last 60 actual active measures from the guarded booklet RPC, existing raw plots and attributed entry cards. No invented percentiles, BMI classification or parent write controls. |
| Rendez-vous | Actual paged appointment records, state/facility/professional and missed/cross-provider context. Existing day/week/month calendar remains reachable. Parents contact the clinician for changes, preserving existing permissions. |
| Documents | Dedicated Bientôt disponible surface; no upload controls or management backend claimed. Existing authorized booklet exports remain available. |
| Partage & accès | Existing purpose-bound issue/revoke/share component, verified link expiry, access-history and self-access management links. No new grant or export permission. |
| Paramètres | Shared shell, real account email/profile edit, existing private contact/consent/reminder settings and preference history, password recovery and account links. No fake notification delivery or language setting. |
| Child booklet / calendar / privacy / account | Shared parent shell retained across deeper journeys. Existing clinical content, export permission, correction requests and revocation remain intact; print rules hide workspace chrome. |

Selection uses only the current parent's authorized child list; an explicit unavailable child never falls back to another child. Child RPCs independently recheck authorization at read time. Empty data and RPC errors have separate states. Invalid page values fail before a clinical read. Loading/not-found pages are provided. No schema, policies, migrations, source vaccine data, permission logic or clinical server actions changed.

## Verification

- 300 existing tests across 39 files passed before adding the new UI regression file (real local PostgreSQL/PGlite guards, data lifecycles and clinical rules).
- 15 new rendered-component tests passed: all four clinical/access empty states, coming-soon state, unrelated-child rejection, invalid pagination, scoped vaccination reads and preserved paging URLs, backend denial/error distinction and read-only growth controls.
- Additional focused clinician regression: 35 tests / six files passed.
- Type checks and production build passed; lint has zero errors and one existing warning in `src/lib/operational-events.ts` (type-only use of `events`).
- 18 static SSR layout checks: six parent sections at 1440, 820 and 390 CSS pixels; no horizontal page overflow; native mobile details menu opens. Screenshots and `layout.json` are in `docs/design-qa/parent-integration/`. These use empty authorized fixture lists, real components and compiled production CSS, with auth/Link/share dependencies mocked. They do **not** prove hydration, actual authenticated navigation, saves or hosted persistence.
- Subsequent full-suite and final build results are recorded in PROGRESS.md.

## Charles UX Animation

Read the requested upstream [SKILL.md](https://github.com/LemonFace0309/charles-skills/blob/main/skills/charles-ux-animation/SKILL.md) before application. Existing CSS is the motion system; no runtime dependency was added. After source functional tests/types/build passed, added named 120ms feedback and easing tokens, 300ms pending-indicator delay, pointer-only feedback, instant keyboard focus, reduced-motion overrides and Escape-to-close/restore-focus. No initial page entrances, speculative medical saves, optimistic clinical writes or new animation framework. Browser interruption/hydration/network-throttling checks remain pending.

## Remaining acceptance and deployment limits

- Connected Supabase projects did not include configured project `zkkasbxvdvecnafgjpxd`; owner is connecting it. No unrelated project was queried or modified. Hosted persistence, real role/session denials, parent linking and QR redemption/revocation must be verified with a fresh authorized synthetic fixture. Never reuse retired fixtures documented in AGENTS.md.
- Static visual checks cover empty sections only. Populated screens, settings forms, actual charts, animations and all live sidebar/secondary journeys still require browser acceptance. Mockup illustrations and unsupported example clinical assessments, percentages, statistics, patient names and permissions are not asserted as implemented. Full visual fidelity is not accepted.
- No production deployment, DB migration or production merge is claimed. Publish this as a review branch until live evidence is obtained. No clinical/operational/legal approval is inferred.
- The owner's historical primary checkout path is outside this cloud workspace and cannot be synchronized here. GitHub branch/main state is reported separately.

## Published review checkpoint

Application commit: `ae9525dbcca5009f6f6389edff29ac6cdda092cf`; draft PR https://github.com/ABDRRAHIM404/mon-enfant/pull/1. Final full suite: **315 tests / 40 files passed**. Final explicit types, lint and production build pass after the settings/motion changes. GitHub Actions run `44145729489` is blocked before job startup by account payments/spending-limit restrictions. Vercel's Git check points to a team-access invitation and has not produced a verified deployment. No spending limits or team membership were changed. Production remains unchanged by this task.


## Live follow-up

The previous access blockers are historical. Correct-project previews now build successfully; final source a9e483f passes the live acceptance in [the scoped report](docs/design-qa/dashboard-live/review.md). All source/permission/clinical safeguards are retained. Final production status and fixture retirement are recorded in PROGRESS.md.


## Final result

PR #1 is merged; [the canonical website](https://mon-enfant.vercel.app) is deployed and verified. All 315 tests pass. Live sidebar/responsive, clinical save/refresh/amendment, parent linking, QR/session/revocation and private/role-denial checks pass within the documented scope. Six temporary accounts are retired with zero active sessions/links/grants/capabilities/practices/shares; private credential files removed. See [production and retirement evidence](docs/design-qa/dashboard-live/retirement.json). Historical access blockers above are retained as checkpoints, not current status.
