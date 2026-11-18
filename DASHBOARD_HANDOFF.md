# Dashboard handoff — 18 November 2026

Website: https://mon-enfant.vercel.app

Latest owner-requested visual update: [DASHBOARD_UI.md](DASHBOARD_UI.md). Both dashboards now have illustrated mint headings, stronger cards/spacing, actual parent summaries and child rows, compact clinician vaccine history and month/list appointments. Skeletons cover all 65 page routes and sidebar query transitions. Public/static assets can be reused while private data and permissions remain fresh. This supersedes the earlier decorative-artwork limitation below for the new illustrations; no pixel-identical clone or universal zero-network caching is claimed.

Original request: both eight-section dashboards, working authorized backend features, responsive layout, subtle Charles UX interactions, functional verification and documented handoff. Android/APK and iOS remain paused.

## Parent pages

| Page | Delivered behavior |
| --- | --- |
| Tableau de bord | Actual linked-child, unread-update and next-appointment summaries; original branding; no-child state and secure invitation entry. |
| Mes enfants | Verified linked children and separate child-specific vaccination, growth, appointment and sharing links; independent touch targets. |
| Vaccinations | Authorized recorded doses and routine references, compact expandable history, provenance/uncertainty and calculated-versus-verified distinction. |
| Croissance | Actual active measurements and raw charts with readable responsive labels; no invented percentile or diagnosis. |
| Rendez-vous | Recorded appointments and states, professional/facility context and existing calendar. Existing clinician write permissions preserved. |
| Documents | Bientôt disponible; authorized booklet exports remain separate. No document-management implementation. |
| Partage & accès | Existing purpose-bound one-use QR, consent, recipient/session restrictions, access history and immediate revocation. |
| Paramètres | Real profile, private contact/consent/reminder preferences and history, account/security links, retained input and honest feedback when a save response fails. |

## Doctor and nurse pages

| Page | Delivered behavior |
| --- | --- |
| Tableau de bord | Existing authorized summaries, actual recorded activity and entry points. |
| Enfants | Scoped registry/search, registration and existing-child linking. No unrestricted medical-record search. |
| Consultations | Authorized child selection, real consultation entries, persistence and append-only correction history. |
| Vaccinations | Existing source-aware histories, reviewed references and manual HB1/missed-dose/catch-up controls. |
| Rendez-vous | Manual appointment planning, rescheduling and recorded event history through existing capabilities. |
| Croissance | Actual attributed measurements and charts, existing write/correction guards. |
| Documents | Coming soon for verified and provisional users; no new document access. |
| Mon compte soignant | Existing professional verification, capability and account controls. Self-declaration does not grant trusted care. |

Provisional doctor/nurse workspaces remain author-only and separate from trusted records. Admin verification/operations remain protected and separate from patient access.

## Issues fixed

- Parent menu queries now display their own sections; account/calendar/privacy/booklet pages retain the parent shell.
- First profile save no longer hides its confirmation; saved settings retain the entered selection.
- Selected clinician navigation keeps readable hover contrast; parent chart labels remain readable on narrow screens.
- Vaccine history is compact without removing attribution, uncertainty or revision details.
- Interrupted profile/settings responses keep typed values and show that the result is unconfirmed. No automatic retry or optimistic success is used.
- Child-section links no longer share a full-card overlay that redirected multiple targets to sharing; separated 44px targets work at desktop/tablet/phone widths.

## Verification

- Original milestone: 315 tests / 40 files, explicit types, lint and production build; 96 actual role/navigation checks at 1440/820/390px; live save/reload/amendments, parent claim/review, QR/session/replay/revocation and negative access checks, with independent fixture-scoped database proof.
- Final follow-up: 27 focused tests / three files, targeted lint, explicit `next typegen && tsc --noEmit` and Vercel production build. Seven actual authenticated form scenarios and eight navigation/motion/component scenarios pass with zero unexpected browser exceptions.
- A committed-save response is deliberately lost in Chromium: one POST, retained input, no success claim or automatic resend, persisted preference visible after reload. HTTP 503, invalid input and a request interrupted before dispatch are checked separately.
- Delayed navigation has no spinner flash before 300ms, keeps accessible feedback afterward, respects reduced motion and keyboard focus, dismisses the phone menu correctly and retains the latest navigation when an older request resumes.
- Child pointer hit tests use the actual SSR component with a fictional authorized-list prop and deployed CSS; this is explicitly separate from the original live linking/access acceptance.

Evidence: [original live review](docs/design-qa/dashboard-live/review.md), [final visual review](design-qa.md), [closeout reports and captures](docs/design-qa/dashboard-closeout), [progress/publication record](PROGRESS.md).

## Visual and scope limits

The dashboards follow the existing cream/emerald/coral, light-only brand and the reference page structure. They are not pixel-identical clones: decorative illustrations, some card arrangements, account screens and data-driven summaries differ. Comparisons include all eight parent and all eight clinician references and classify different data states. Mockup names, coverage percentages, clinical assessments, appointment permissions, languages and 30-minute QR access were not fabricated or enabled.

Signup/confirmation/sign-in now work according to the owner's Gmail walkthrough; the first message arrived in spam. Application approval, invitation and follow-up email delivery remains a separate task. This dashboard acceptance does not claim broad deliverability, full accessibility certification, or external clinical/privacy/operations approval.

## Source and deployment

Original dashboard PR: https://github.com/ABDRRAHIM404/mon-enfant/pull/1 — application 277e618.

Eight-character password PR: https://github.com/ABDRRAHIM404/mon-enfant/pull/2 — application e27a31b.

Final closeout PR: https://github.com/ABDRRAHIM404/mon-enfant/pull/3 — merged application **6b6f2151c413e0cbf8f82d989ea6dbe94e2a4f67**. Its application/configuration code is identical to accepted preview cd2bca7. Production **dpl_2MWuubdsABzcoDTAxi4pgjdR35cG** is READY and the canonical alias is verified. All seven form and eight navigation/motion/component cases pass on the canonical site, including active pending-state reduced motion and sequential keyboard navigation. The single closeout fixture is retired: account banned, password cleared, zero sessions/active guardian links/professional authority, login denial verified and preview share revoked. Original fixtures remain retired. No clinical/audit history was deleted.

The cloud checkout is synchronized with GitHub main. The separate historical PC checkout is not mounted in this environment; synchronization there is not claimed. GitHub Actions' account billing block is separate from the completed Vercel build and browser verification; no paid limit was increased.

## Latest visual/loading/cache publication

PR #4 / 168b0f4 is live in READY production dpl_4FvjCGbqsqdnePe5pU3wKVAHrqHS. 336 tests, responsive acceptance and canonical loading/cache/access-revocation checks pass; [evidence](docs/design-qa/dashboard-ui/review.md). The remaining task is retirement of six synthetic test accounts: automatic approval review requires the owner's explicit approval. Their guardian link is already revoked; no real account or medical/audit record is in the cleanup scope.
