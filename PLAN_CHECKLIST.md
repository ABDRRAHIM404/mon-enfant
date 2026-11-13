# Full plan execution and completion audit

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
- [ ] Complete the owner’s real recovery-email reset/new-password sign-in walkthrough. The first message arrived, but the link was opened across Brave/Chrome; a fresh same-browser retry is pending the built-in sender quota.
- [ ] Resend MCP account authorization, verified sending domain, secret-backed hosted SMTP activation/rate limits and fresh signup/recovery delivery evidence (EMAIL_DELIVERY.md).
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
- [ ] Draft/versioned 25-row catalog with original/configured ages, decisions and source references.
- [ ] Clinically authorized schedule management and immutable version mapping.
- [ ] Correct routine date/window arithmetic; HPV/rotavirus/PCV/HB1 constraints and unknown-history handling.
- [ ] Vaccine recording, duplicate/override/idempotency controls and cautious item matching.
- [x] Consultations/treatments/risks, measurements/raw charts, timeline, revision history and permitted all-revision exports/print summaries; future vaccine inclusion remains tracked below.
- [ ] All specified calendar/age/version/correction/access tests and qualified clinical review.

## Phase 5 — appointments/continuity

- [ ] Day/week/month calendar; manual create/reschedule/cancel and doctor alerts.
- [ ] Separate missed appointments, unconfirmed/potentially overdue doses and unknown history.
- [ ] Manual catch-up appointment selection with original missed-event history retained.
- [ ] Second authorized doctor's administration reconciles the intended item and worklist.
- [ ] Unrelated appointments remain; transactions/idempotency avoid duplicate/stale reminders.
- [ ] Both complete acceptance scenarios plus negative/security/concurrency cases.

## Phase 6 — doctor/admin readiness

- [ ] Full story-level browser/API/database verification, mobile/tablet/keyboard/accessibility/performance.
- [ ] Account/session, QR, export, RLS/Storage, secret and rate-limit review.
- [ ] Backup/recovery drill, monitoring, incident response and retention execution evidence.
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
