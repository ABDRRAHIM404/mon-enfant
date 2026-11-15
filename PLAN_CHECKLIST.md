# Full plan execution and completion audit

Current development focus: **full Phase 8 mobile; Updates 1–3 including real temporary sharing and the canonical account switch have software acceptance**, following the verified synthetic Phase 7 web walkthrough. See UPDATE_WORK_PLAN.md. Remaining Phase 6 checks/operations stay open and are deferred until the app is built, except major authentication, access-control, data-integrity and build checks.

See [PROGRESS.md](PROGRESS.md) for verification evidence and remaining approval gates.

This checklist preserves PROJECT_PLAN.md's complete Phase 0–8 scope. It is not a narrower definition of success. A phase can have implemented technical work while external approval gates remain unresolved. Later enhancements explicitly deferred in the baseline remain deferred, including OCR/AI, offline capture, WhatsApp/SMS, HBn/HB1 special-case automation and automatic catch-up.

## Phase 0 — baseline and validation

- [x] Requirements/roadmap and supplied source data retained; confirmed decisions documented.
- [x] Conservative register scope (professional/facility/year/book/local number) documented as provisional.
- [x] Synthetic-data-only implementation boundary recorded.
- [x] Consolidated acceptance stories/screens/role boundaries and clinical edge cases in USER_STORIES.md (requirements contract; execution evidence remains per phase).
- [ ] Original PNI presentation/source authentication and qualified clinical sign-off.
- [ ] Official credential/guardianship verification sources and production retention approved.
- [ ] Qualified Moroccan privacy/hosting review and production authorization.

## Phase 1 — foundation

- [x] Next.js/TypeScript/Tailwind, pinned packages and cloud lint/typecheck/tests/build/browser CI.
- [x] Development Supabase, GitHub and Vercel; preview/staging frontend uses the same synthetic backend, not an approved production-patient environment.
- [x] Initial normalized identity/register/access/audit schema and cleanly applied migrations.
- [x] Protected Auth sessions, server guards, HTTP-only Secure cookies and five verification states.
- [x] Least-privilege RLS, scoped identifiers and no self-approval; live denial/refresh/logout proof.
- [x] Immutable audit infrastructure and explicit clinical-correction design (CLINICAL_MODEL.md); future clinical writes remain unexposed.
- [x] Private evidence bucket, upload restrictions and atomic submission.
- [x] Synthetic fixtures, source control and privacy-preserving operational logging.
- [x] Password recovery implemented; live one-use token, mismatch rejection, password update, old-password denial, refresh revocation and cookie/session cleanup tested without sending email.
- [x] Actual signup email delivery and confirmation walkthrough with the owner’s authorized mailbox; the owner reported success and hosted Auth shows email confirmed. Automated smoke tests send no mail.
- [x] Owner’s real recovery-email reset/new-password sign-in walkthrough succeeded after switching hosted Auth SMTP to Resend; owner confirmed receipt, reset and new-password login.
- [x] Resend local MCP credential helper, successful initialization/catalog check, private sending key, hosted owner-only SMTP activation/readback and actual owner delivery/recovery evidence (EMAIL_DELIVERY.md).
- [ ] Verified sending domain, broader doctor/parent delivery, fresh signup confirmation through Resend and production deliverability/abuse monitoring.
- [ ] Operational monitoring/alert escalation acceptance before an external pilot.

## Phase 2 — professional verification/admin

- [x] Signup/status, matricule/evidence submission, admin queue/detail and decision history.
- [x] Explicit reviewer permission, separate from admin role and clinical access.
- [x] Approval/rejection/more-evidence, duplicate checks, assigned professional ID, audited suspension/reactivation.
- [ ] Resend delivery of transactional doctor-approval notices from committed decisions, with duplicate/retry controls and no clinical/evidence details.
- [x] Private bounded downloads, recorded app download access and immutable decisions/status events.
- [x] Operator bootstrap and development document-retention procedure (OPERATIONS.md).
- [x] Actual hosted forms and private-download/role/history/logout checks; live API and PostgreSQL policy suites.
- [ ] Production identity-verification/retention policy approval and a real designated reviewer/operator.

## Phase 3 — registry

- [x] Doctor registry dashboard/worklists, scoped search/filtering and patient list. Appointment/clinical dashboard and last/next-visit additions remain tracked in Phases 4/5.
- [x] New child registration with permanent identity and scoped local register.
- [x] Manual paper-record entry with source/uncertainty and duplicate review (no automatic merge).
- [x] Existing-child lookup/linking through a recorded authorization workflow.
- [x] Profile overview, appropriate guardian/contact use and access/correction traceability.
- [x] Multi-doctor acceptance: two register numbers, one immutable child; negative access cases.

## Phase 4 — clinical/vaccines

- [x] Consultation/prescription/risk/growth events, explicit clinical privileges, append-only correction chain and provenance; vaccine entries remain below.
- [x] Draft/versioned 25-row catalog with original/configured ages, decisions and source references; deployed and verified with 23 hosted acceptance checks.
- [x] Explicit catalog editor and independently qualified reviewer permissions, draft editing, checked-source approval attestations, retirement and immutable revision snapshots (technical workflow; actual source approval remains open).
- [x] Immutable version/dose mapping for child references and each administration revision; hosted matching/correction/retirement/export evidence in PROGRESS.md.
- [x] Date-only routine calculation kernel with month-end/leap-year tests and HPV/rotavirus/PCV/HB1 constraints; unreviewed/retired/uncertain-birth/unknown-sex gates.
- [x] Authorized child routine-reference views, version/date/sex gates and uncertain paper history without automatic missed/catch-up classification.
- [x] Vaccine recording, audited duplicate override/idempotency, verified exact-item matching, cross-doctor continuity and append-only reference/administration revisions; 31 hosted acceptance checks.
- [x] Consultations/treatments/risks, measurements/raw charts, timeline, revision history and permitted all-revision exports/print summaries, including vaccine mappings and complete intended-reference decisions.
- [ ] All specified calendar/age/version/correction/access tests and qualified clinical review.

## Phase 5 — appointments/continuity

- [x] Day/week/month calendar with complete day counts/paged lists; manual planning/reschedule/cancel/visit dispositions and scoped in-app alerts.
- [x] Separate passed appointments without disposition, potentially overdue/unconfirmed references and unknown history; no missing-record-to-missed-dose inference.
- [x] Clinician manually selects replacement dates; original missed slot, actor, old/new times and reason retained; no dose manufactured.
- [x] Second authorized doctor's validated administration resolves the intended follow-up; corrections/withdrawals reopen it on fresh reads.
- [x] Unrelated consultations remain; child locks, expected revisions, bound operation receipts and derived projections avoid duplicate/stale vaccine reminders.
- [x] Both complete software acceptance scenarios plus negative/security/concurrency cases: 35 hosted checks and 140 cloud unit/database tests; see PROGRESS.md.
- [ ] Qualified manual clinical review of the appointment/missed-follow-up workflows and underlying source before real-data use.

## Phase 6 — doctor/admin readiness

- [x] Exact 4 MiB private evidence upload/download/review on desktop/tablet/phone, client/server oversize and spoof rejection, private access denial and independent database/Storage readback; see PROGRESS.md.

- [x] Core clinical continuity browser story on desktop/tablet/phone: A/125–B/078 identity, capability decisions, consultation/correction, growth, appointment reschedule, private export and revocation/logout; growth hydration regression fixed. See PROGRESS.md.
- [x] Expanded consultation/prescription/risk/growth browser story on desktop/tablet/phone: explicit capability denial, uncertain paper provenance, second-doctor corrections, risk/growth withdrawals, chart/timeline projection and all-revision private export; independent thirty-revision database proof in PROGRESS.md.
- [x] Vaccination/catalog and appointment-continuity browser story on desktop/tablet/phone: QA review/source preservation, HB1 rejection, uncertain transcription, duplicate review, amendments/withdrawal, second-doctor resolution/reopening, preserved unrelated appointments, export and denial; independent database proof in PROGRESS.md.
- [x] Public-page automated accessibility and keyboard baseline on desktop/mobile: fourteen scans, zero violations/incomplete results and native bypass/auth-navigation checks; see PROGRESS.md.
- [x] General workspace automated accessibility and keyboard baseline on desktop/tablet/phone: fifty-four scans, zero violations/incomplete results, named pending login, bypass, practice creation, logout/denial and independent zero-clinical-scope proof; see PROGRESS.md.
- [x] Detailed clinical automatic-violation and targeted keyboard baseline: 114 scans on desktop/tablet/phone, zero violations/page errors, corrected heading hierarchy, bypass and consultation keyboard input, independent thirty-revision persistence proof. Seven incomplete contrast results remain open below.
- [x] Targeted growth SVG/table contrast and keyboard disclosure on desktop/tablet/phone: nine reports/165 text samples, text minimum 5.492:1, history outline 4.956:1 and fully visible keyboard history link; retained axe incomplete results reviewed within this solid-color scope. See PROGRESS.md.
- [x] Vaccine/catalog automatic accessibility and targeted keyboard baseline on desktop/tablet/phone: 141 scans, zero violations/incomplete results/page errors, named-navigation bypass, reasoned duplicate override by keyboard and independent database/source proof. See PROGRESS.md.
- [x] Private-evidence automatic/targeted keyboard baseline: 39 scans, zero automatic violations/page errors, pending locks, exact-limit private upload/review/denials, three queue contrast/Arrow-key reports and independent Storage/database proof. See PROGRESS.md.
- [x] Defined development TTFB/FCP/LCP/CLS targets and first controlled six-view baseline on desktop/tablet/phone: thirty-six complete observations meet all targets; independent ledger proof in PROGRESS.md.
- [x] Repeated controlled performance and authenticated automated target step: 108 observations across six views/two profiles/three devices, three samples per case, all defined targets met; independent persistence and cleanup in PROGRESS.md.
- [ ] Broader keyboard/accessibility and interaction/load performance acceptance.
- [ ] Full keyboard/accessibility/performance acceptance.
- [x] Workspace refresh-cookie regression: actual provider refresh-token rotation, persisted secure cookies, public-health isolation and logout denial for vaccine/appointment/follow-up routes on desktop/tablet/phone; see PROGRESS.md.
- [x] Repeatable read-only hosted schema/ACL/Storage baseline: nineteen checks including column grants/private definers; real PostgreSQL regression tests detect introduced drift. See SECURITY_REVIEW.md.
- [ ] Complete account/session, QR, export, RLS/Storage policy, secret and rate-limit review.
- [ ] Resolve the existing disabled leaked-password-protection advisor before production readiness; Supabase restricts it to Pro-and-above. No paid upgrade is authorized.
- [x] Credential-free development readiness monitor, verified scheduled execution and live healthy/failure/recovery reporting drill; owner reports GitHub notifications arriving. See PROGRESS.md.
- [x] Isolated recovery implementation in cloud: real migrated PostgreSQL model snapshot/restore, full row/ACL hashes, restored-session containment, ledger/denial/immutability/source checks and separate fictional object bytes; see RECOVERY.md.
- [x] Distinct-runner synthetic artifact-transfer/recovery drill: verified private transfer, complete row/ACL integrity, restored-session containment, immutable history and separate object bytes; run 43594753650.
- [ ] Hosted backup/recovery and incident/retention drills; pilot monitoring ownership, response targets and scheduled alert-delivery acceptance.
- [ ] Formal clinical, legal/privacy and regulated hosting approvals before any identifiable-data pilot.

### Deferred Phase 6 closeout

The user explicitly requested that minor checks/hardening wait until the app features are built. The unchecked requirements above remain open. Reuse accepted evidence; do not expand verification into new minor submilestones. Keep major security/data-correctness/build checks with each feature. Required qualified clinical/source, legal/privacy, hosting and operating approvals remain mandatory before a real-data pilot.

## Phase 7 — parent web

Synthetic web technical acceptance is verified: full hosted desktop/tablet/phone flow 43622260572 plus independent database persistence and fixture retirement. This verifies software behavior, not genuine identity/guardianship, clinical/source or privacy approval. Actual invitation/follow-up email delivery remains open and does not hold independent mobile construction.

- [x] Parent profile foundation: own confirmed/current account, independent from professional authority; cloud CI and hosted migration.
- [x] Parent day/week/month calendar and assigned reviewed vaccine-reference views; cross-provider/guardian/revocation/source/retirement and old-token Auth-ban cases, cloud CI and hosted migration.
- [x] Actual invitation QR and separately authorized clinician-identification lookup; independently decoded rendered SVGs, current-authority database cases, build/browser CI and hosted migration.
- [x] In-app parent updates with current guardian scope, private replies, generic access-status receipts and snapshot-based read state; cloud CI and hosted migration.
- [x] Parent correction requests, doctor replies tied to real clinical amendments, private preferences and scoped access history; cloud security/data-integrity/build/browser CI and hosted migration.
- [x] Guardian/booklet technical slice: hashed recipient-bound one-use invitations, independent child-manager approval, scoped multiple-guardian reads/export/revocation; cloud access/integrity/build/browser CI and hosted migration.

- [x] Parent account and recorded guardianship verification.
- [x] One-use hashed expiring invitations and safe claim/linking of an existing child.
- [ ] Resend parent invitation delivery, separately from Auth identity confirmation and recorded guardianship approval.
- [x] Child/health/vaccine/growth/booklet views, appointments, notifications and permitted export.
- [x] Multiple guardians, revocation, correction requests, privacy/access history and look-up QR boundaries.
- [x] Full parent claim and unrelated-scanner rejection acceptance/security checks.

## Phase 8 — mobile

Owner steering (15 November): prioritize the Android APK and website. iPhone/iOS remains deferred, with prior source/compilation/partial runtime evidence retained and unfinished gates open.

- [x] Choose/document and implement the native Android/iOS parent client in source: pinned React Native/Expo, MOBILE_PLAN.md; mobile cloud 43671670888, root/backend 43670556470. Runtime acceptance is separate below.
- [ ] Reuse server authorization, secure sessions, child/booklet/appointments and notification experience.
- [x] First real Android APK and iOS Simulator compilation: cloud 43669991631, source 581133d; no distribution credentials. Later source changes require updated native evidence.
- [ ] Complete latest-source native compilation and feasible Android/iOS runtime verification, inspect actual renders and retire all synthetic fixtures without burdening the owner's PC.
- [ ] Native hardware-camera walkthrough, production vector/adaptive master and owner-approved signing/store distribution arrangements.

The complete goal remains active until the full required scope and its approval gates have authoritative evidence. Implemented milestones do not close the complete goal.

## Requested updates before mobile

- [x] Update 1 source and hosted HTTP checkpoint (CI 43626758194 / native afe0033a1b80454a): registration-bound private duplicate checks, secondary identity fields, controlled review, no disclosure/merge/access, rate/audit, race protection and nonunique SMI; verify cloud/source and hosted HTTP behavior.
- [x] Update 2 (cloud software acceptance 43632064585 / native f660a957f2064606): parent-first entry/routing and separate clinician enrollment without visual redesign; verified doctor/nurse feature parity with meaningful role/audit attribution.
- [x] Update 2 (cloud software acceptance 43632064585 / native f660a957f2064606): actual persistent author-only provisional child/care/vaccination/appointment workflows for unverified clinicians; API/QR/export/existence isolation and immutable revisions.
- [x] Account approval leaves prior provisional records untrusted and unshareable until an explicit later validation/promotion policy is decided; real-data and credential-checking approvals remain open.
- [x] Record combined cloud acceptance and publish/synchronize the primary main checkout (see PROGRESS.md).
- [x] Publish and verify the new canonical Vercel deployment after the owner-requested account/address switch (43635401242 / native e95b68ad4f284f34). Preserve all external approval gates and complete Phase 8 afterward.

## Supplied Update 3 — design and preserved functionality

- [x] Sharing source/backend: full CI 43663059538 (272 cases), immutable migration 20261114234132 with exact-source history; real QR/consent/read-only ticket implemented. Hosted three-device/native/visual software acceptance 43664056898 is complete; canonical release dpl_FYkVBUrNCptht4Qz7xc1pAquTWno / source 9ae8a80 and primary synchronization are verified.
- [x] Implemented protected read/dashboard layouts, actual permission-scoped summaries and unassigned uncertain vaccination history: source CI 43646114379, hosted cloud 43646708223 / post-fix 43647899263, native persistence/permission proof and direct paired review (design-qa.md). Purpose-bound sharing has separate acceptance below.
- [x] Publish protected read/UI checkpoint on canonical Vercel: READY dpl_CR1C1asRvsdoFXTMz3THgtJTjaP2, source 0e0b66d; live health and anonymous parent/provisional/vaccination/export denial pass. Primary main is synchronized.
- [x] Retire both protected verification fixtures: c833b127ec5544c0 and 1e57ebcee3134c5d, four accounts/nine temporary values each, retirement verified.

- [x] Shared/public foundation implemented and visually accepted: full source CI 43642867793, configured sixteen-screen paired capture 43642889015 and direct review in design-qa.md; earlier three-device authenticated run 43639674164 passed both cookie-retention modes. Protected read layouts are accepted below; the functional sharing extension is tracked separately.
- [x] Publish the public foundation on canonical Vercel (READY dpl_3U36g4ViF3NS4mhCtsEF7wuvmJBP, source 6b0e2a9); live health/page markers and anonymous export denial pass. Synchronize clean primary main with origin/main.
- [x] Retire the four synthetic actors and nine temporary values after acceptance; 07e082b6e45f4e2b retirement verified. Layout-only iterations use public configuration without account provisioning.

- [x] Review the supplied mockups/current screens and implement the chosen shared brand, light/dark/system themes, persisted override, responsive public/parent/clinician screens and accessible contrast/keyboard/touch behavior.
- [x] Keep verified Updates 1–2, clinical/vaccine/grant/audit controls, deferred verification and synthetic-only boundaries intact; no fabricated patient/calendar data from mockups.
- [ ] Treat the PNG emblem honestly as a raster reference; production vector master/adaptive icon approval remains open.
- [x] Resolve/implement the specified parent-issued short-lived, purpose-bound clinician QR under an explicit authorization contract; identification alone never grants access. This is a functional extension, not a cosmetic button.
- [x] Verify design changes in cloud and publish/synchronize the complete primary main checkout (sharing: 43663059538 / 43664056898 / native ac450cb72ff44993; READY dpl_FYkVBUrNCptht4Qz7xc1pAquTWno, source 9ae8a80). Full Phase 8 scope remains open above.
