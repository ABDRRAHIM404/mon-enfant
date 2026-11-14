# Full plan execution and completion audit

Current implementation phase: **Phase 6 — Doctor/admin hardening and pilot readiness**.

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
- [x] Credential-free development readiness monitor, verified scheduled execution and live healthy/failure/recovery reporting drill; owner reports GitHub notifications arriving. See PROGRESS.md.
- [ ] Backup/recovery and incident/retention drills; pilot monitoring ownership, response targets and scheduled alert-delivery acceptance.
- [ ] Formal clinical, legal/privacy and regulated hosting approvals before any identifiable-data pilot.

## Phase 7 — parent web

- [ ] Parent account and recorded guardianship verification.
- [ ] One-use hashed expiring invitations and safe claim/linking of an existing child.
- [ ] Resend parent invitation delivery, separately from Auth identity confirmation and recorded guardianship approval.
- [ ] Child/health/vaccine/growth/booklet views, appointments, notifications and permitted export.
- [ ] Multiple guardians, revocation, correction requests, privacy/access history and look-up QR boundaries.
- [ ] Full parent claim and unrelated-scanner rejection acceptance/security checks.

## Phase 8 — mobile

- [ ] Choose/document mobile approach and implement Android/iOS parent-focused client.
- [ ] Reuse server authorization, secure sessions, child/booklet/appointments and notification experience.
- [ ] Cloud compilation/tests and feasible Android/iOS runtime verification without burdening the owner's PC.

The complete goal remains active until the full required scope and its approval gates have authoritative evidence. Implemented milestones do not close the complete goal.
