# Mon Enfant — Development Plan

**Status:** Implementation in progress — foundation/verification/registry workflows verified; Phase 5 appointment/continuity technical acceptance complete, Phase 7 synthetic parent web technical walkthrough verified, Updates 1–2 canonically verified; Update 3 public/protected read UI published; purpose-bound parent sharing remains before Phase 8 mobile; actual application mail and remaining Phase 6/external readiness stay open; see [PROGRESS.md](PROGRESS.md) and [PLAN_CHECKLIST.md](PLAN_CHECKLIST.md)
**Working name:** Mon Enfant (temporary)
**Primary objective:** Launch a secure, responsive doctor/admin web application, then introduce the parent experience.
**Last updated:** 14 November 2026

> A synthetic-data development deployment is available. No real clinical data is connected. Development and verification must use fictional/synthetic patient information until the external approval gates are met. Timelines are deliberately not promised.

## Execution priority — 14 November 2026

Updates 1–2 have canonical technical acceptance: private duplicate handling, parent-first onboarding, verified doctor/nurse parity under explicit permissions and isolated provisional workflows. Implement the newly supplied Update 3 visual design and its separately tracked purpose-bound parent sharing extension before mobile. See UPDATE_WORK_PLAN.md and UPDATE_3_IMPLEMENTATION.md. Automatic provisional promotion remains forbidden.

The user prioritized completing the remaining application features, including parent web and mobile, before minor hardening and repeated checks. Continue the original full scope below; keep the major authentication, access-control, data-integrity and build checks with feature work. Carry unfinished Phase 6 hardening/operations and external approvals forward as explicit open items. This changes development priority, not completion criteria or permission to use identifiable patients.

## 1. Build principles

- **Doctor workflows first**: useful even before parents join.
- **Admin oversight from V1**: no unverified clinician accesses another author’s or trusted patient records. Requested Update 2 permits a separate author-only provisional ledger for unverified doctors/nurses; approval never promotes earlier provisional records.
- **Single child identity**: one permanent universal ID across doctors.
- **One medical history**: shared clinical record under authorization; doctor-specific patient registers remain separate.
- **Traceability**: each clinical entry and correction linked to professional ID, timestamp and origin.
- **Clinical safety**: vaccine calculations use approved, versioned schedule rules and need clinician review.
- **Security before real data**: never shortcut authentication, permissions, auditing, privacy or legal review.
- **No paid dependency without approval**: use appropriate free development tools and test data first.
- **Responsive web now, native apps later**; offline support deferred.

## 2. Scope by release

| Stage | Deliverable | Required functionality |
|---|---|---|
| 0 — Discovery & validation | Reviewed requirements and real vaccine source dataset | Confirm workflow assumptions and critical safety/legal constraints |
| 1 — Foundation | Next.js project + Supabase schema + authorization | Accounts, database relationships, role model, audit infrastructure |
| 2 — Admin & professional onboarding | Usable admin dashboard | Professional applications, document review, approve/reject/suspend |
| 3 — Doctor patient registry | Usable doctor dashboard | Register new/import old children, search, doctor-specific register linkage |
| 4 — Medical records & vaccinations | Clinical record workflow | Visits, measurements, vaccine entries, author attribution, schedule rules |
| 5 — Appointments & cross-doctor tracking | Doctor V1 MVP | Due dates, follow-ups, missed alerts, vaccination recorded at another provider |
| 6 — Hardening & pilot readiness | Tested doctor/admin web app | Access control tests, backups, audit review, performance, legal/security gating |
| 7 — Parent portal | Parent web experience | Guardian verification, linking existing child, health view, notifications |
| 8 — Mobile app | Android/iOS app | Parent-focused mobile interface on the same backend |
| Later enhancements | Deferred items | Offline sync, paper scanning/AI extraction, SMS/WhatsApp and integrations |

## 3. Phase 0 — Requirements and source validation

**Tasks**
1. Translate product decisions into user stories, screens, roles and clinical edge cases.
2. Use the hospital-provided `PNI cours.pptx` (2025 schedule on slide 67) and the extracted `MON_ENFANT_PNI_DATA.json` / `MON_ENFANT_PNI_SCHEDULE.csv`; retain original source ages, corrections and decision provenance.
3. Confirm routine schedule calculations and unresolved edge cases with a qualified clinician. VPO0 wording and PCV labels have been resolved; rotavirus uses calendar months; HPV is girls-only. Hepatitis B special-case logic is deferred. **Catch-up is not automated in V1.**
4. Document paper register number format (per doctor, facility, calendar year and book).
5. Define minimum clinical data fields and how unknown/imported values are flagged.
6. Outline guardian verification, cross-provider access authorization, document retention and admin verification.
7. Review Moroccan health-data/privacy obligations and possible restrictions on overseas hosting before planning identifiable-data deployment.
8. Confirm no actual patient data will be used in early development.

**Exit criteria:** An approved requirements baseline and clinically reviewed vaccine data specification; unresolved legal/security questions clearly documented.

## 4. Phase 1 — Technical foundation

**Tasks**
- Initialize Next.js with TypeScript, Tailwind CSS, linting, type checking and testing framework.
- Set up development and staging configuration with synthetic data only.
- Design normalized PostgreSQL tables and migrations.
- Build Supabase Auth sign-in and safe session handling.
- Implement `unverified`, `under_review`, `approved`, `rejected`, `suspended` states.
- Model least-privilege roles and permissions; apply Row Level Security to all exposed tables.
- Design immutable audit events and correction records; apply server-side checks for all clinical writes.
- Implement indexes/constraints for universal child ID and scoped paper register IDs.
- Create secure private storage bucket and verification-submission workflow.
- Set up source control, CI checks, structured error logging without patient data and seeded sample records.

**Exit criteria:** Test users can authenticate, approved role restrictions are enforced, the schema migrates cleanly, and all unauthorized access tests fail as intended.

## 5. Phase 2 — Admin dashboard and doctor verification

**Screens**
- Doctor sign-up/status page.
- Matricule and identity evidence submission page.
- Admin review queue and application detail.
- Approval/rejection with reason and history.
- Account and role management.

**Tasks**
- Limit evidence access to approved verification administrators.
- Record submission metadata and review decisions in audit log.
- Add duplicate professional-account checks and suspension controls.
- Avoid granting clinician privileges while review is pending.
- Keep supporting ID documents out of public links and logs; establish retention procedures.

**Exit criteria:** Only approved and suitably authorized professionals can open protected clinical workflows; review and account changes are auditable.

## 6. Phase 3 — Doctor dashboard and patient registry

**Screens**
- Doctor home: patients, today, upcoming, overdue, recent updates.
- Patient list: filters, search, local register number and last/next visit.
- New child registration form.
- Existing-paper-record manual entry form.
- Existing-child matching/linking workflow.
- Child profile overview.

**Tasks**
- Generate permanent universal child ID on record creation.
- Add doctor-register relationship without changing universal child ID.
- Search by proper authorization, not global unrestricted patient lookup.
- Add safe duplicate detection and manual review, without blind merging.
- Track provenance of manually transcribed historical records.
- Link guardian contact information only to workflows that legitimately require it.

**Exit criteria:** Doctor A can register a child; Doctor B can link the existing child to a different register number through an authorized workflow; both point to one child record.

## 7. Phase 4 — Clinical records and vaccine tracking

**Screens**
- Child overview and medical timeline.
- Vaccination history and `Record vaccine` form.
- Consultation entry and history.
- Growth measurements and chart.
- Audit/correction history.
- Admin vaccine catalog and schedule version editor.

**Tasks**
- Import the 2025 PNI vaccine catalog and dose entries, keeping original source age alongside the configured scheduling age.
- Apply confirmed corrections: PCV1–PCV4 labels; rotavirus 2/3/4 calendar months; HPV at 11 years for girls; VPO0 timing wording accepted as compatible.
- Leave hepatitis B birth-dose exception automation disabled pending a later database update. **The separate HBn birth-dose row is not yet in the 25-dose dataset; HB1 is conditional reference-only and must not auto-schedule.**
- Define routine schedule versions and dose rules with clinician review; **do not implement automatic catch-up schedules**.
- Store administered doses linked to child, professional, facility, timestamp, batch/lot where applicable, and evidence/source.
- Store consultation notes and growth values with units and validation.
- Prevent unauthorized alteration; use corrections/amendments preserving the original.
- Implement cautious dose-matching and warnings for potential duplicates, incomplete history and special-case schedules.
- Show which professional entered each record and the date/time.

**Exit criteria:** Vaccine and medical records have complete provenance; history remains accessible across approved clinicians, and original entries cannot be silently overwritten.

## 8. Phase 5 — Appointments, reminders and cross-doctor update logic

**Screens**
- Doctor calendar (day/week/month).
- Follow-up worklist: due soon, today, missed and overdue, including a dedicated **Missed Vaccinations** view with an easy `Reschedule` action.
- Appointment creation/reschedule form.
- Child's appointment timeline and vaccine schedule status.

**Tasks**
- Allow manual appointments and doctor alerts inside the web app.
- Suggest **routine** next vaccine due dates using reviewed, versioned rules; do not generate a catch-up schedule for a missed dose.
- Flag missed vaccination appointments and potentially overdue/unconfirmed doses as **different states**. Missing historical documentation alone must not trigger a confirmed-missed classification; let the doctor review and select a replacement date according to vaccine-specific procedures.
- Preserve the original missed event and record the acting doctor ID, old/new dates, reason and change timestamp. Rescheduling does not mark a dose completed.
- Recompute dose status when another doctor records a dose.
- Notify or flag Doctor A's follow-up queue when Doctor B administers a qualifying vaccine, subject to authorized access.
- Prevent stale warnings; distinguish vaccine overdue from appointment missed.
- Keep independent consultation appointments unless explicitly rescheduled/cancelled.
- Add retry-safe server operations and duplicate event protection.

**Acceptance scenario**
1. Doctor A registers child CH-00001245 with local number 125.
2. Doctor A has a scheduled vaccination follow-up.
3. Authorized Doctor B links CH-00001245 to local number 78 and records a relevant dose.
4. Dose is attributed to Doctor B's professional ID and facility.
5. Doctor A's authorized dashboard reflects the newly completed dose.
6. The vaccine overdue alert is recalculated appropriately, with no duplicate dose reminder.
7. Unrelated medical appointments are not automatically erased.

**Additional acceptance scenario — missed vaccination:** A scheduled vaccination appointment passes without recorded administration. The doctor opens the Missed Vaccinations queue, checks the child's record, manually chooses a new appointment date, and saves it. The original missed appointment remains in history with doctor ID and date-change audit; the vaccine stays pending until administered. An undocumented historical dose is shown as unconfirmed/unknown rather than automatically declared missed. No automatic catch-up date is prescribed.

**Exit criteria:** Both cross-doctor and missed-vaccination scenarios, plus negative/security cases, pass automated tests and manual clinical review.

## 9. Phase 6 — Doctor/admin V1 readiness

**Quality and security checks**
- Automated tests for access boundaries (approved vs unverified vs suspended, doctor vs admin).
- Multi-doctor ID and duplicate-patient cases.
- Routine vaccine age calculations (including rotavirus calendar months), HPV eligibility, corrected PCV labels, missed appointment vs overdue/unconfirmed dose vs unknown history, manual doctor rescheduling, and different-doctor dose logic.
- Test month-end/leap-year date arithmetic and the possible date mismatch between rotavirus (calendar months) and VPO/Penta (weeks); do not auto-group visits until reviewed.
- Verify no hepatitis B special-case auto-scheduling and no automatic catch-up prescription in V1.
- Permission tests around QR lookup and future guardian invites.
- Audit consistency, corrections and unauthorized edit attempts.
- Accessibility, keyboard, phone/tablet responsive layouts, form validation and useful error messages.
- Security review: secret handling, storage permissions, database RLS, server authorization, rate limiting and session policies.
- Backup/recovery drill, monitoring, incident response and data retention.
- Formal privacy/clinical/hosting review before using identifiable patients.

**Exit criteria:** Doctor/admin feature acceptance tests pass; required clinical and legal reviewers approve any proposed real-data pilot. Without this sign-off, remain on synthetic data.

## 10. Phase 7 — Parent web app and onboarding QR

**Implementation order**
1. Parent account and guardian verification workflow.
2. Doctor-created, one-use, short-lived invitation token/QR (not a clinical-data QR).
3. Parent scans, signs in/up, completes guardianship verification and links existing child ID.
4. Child dashboard and accessible read-only record views.
5. Vaccinations, upcoming dates, appointment calendar and in-app notifications.
6. Guardian access management, correction requests and authorized exports.
7. Separate identification QR for clinician lookup, with explicit access checks.

**Exit criteria:** A parent can claim an already-created child record without making a duplicate; an unrelated QR scanner cannot access it.

## 11. Phase 8 — Mobile app

- Choose mobile approach at implementation time (React Native + Expo proposed).
- Reuse the server-side permission model and existing backend.
- Prioritize parent navigation, notifications and child booklet experience.
- Support Android/iOS as feasible without weakening patient-data controls.

## 12. Later enhancements (explicitly deferred)

- Offline clinical entry, conflict resolution and safe synchronization.
- Photos/scans of existing paper booklets.
- AI-assisted extraction with human verification and provenance.
- SMS and WhatsApp reminders (opt-in, templates and cost/consent review).
- Integrations with public health systems, pharmacies, labs or external scheduling.
- Expanded reports and optional non-diagnostic child health education tools.
- Hepatitis B birth-dose exception database rules, after later doctor clarification.
- Optional vaccine-specific automated catch-up recommendations **only if** clinically validated in a future phase; V1 remains manual.

## 13. Suggested initial information architecture

### Doctor navigation
`Dashboard` · `Patients` · `Vaccinations` · `Appointments` · `Follow-ups` · `Reports` · `Profile`

Patient profile tabs: `Overview` · `Vaccinations` · `Consultations` · `Growth` · `Appointments` · `History`.

### Admin navigation
`Overview` · `Verification Queue` · `Professionals` · `Vaccination Rules` · `Audit & Security` · `Settings`.

### Parent navigation (later)
`Home` · `My Children` · `Vaccines` · `Appointments` · `Booklet` · `Account`.

## 14. Provisional visual design plan

The design is **not yet approved** and should remain easy to revise without changing business logic.

- Professional, minimal healthcare aesthetic with high readability.
- Desktop-first information density for clinicians, but fully responsive to mobile/tablet.
- Parent screens later: friendlier tone, simple hierarchy and clear next-action cards.
- Shared tokens for spacing, color, typography, radii, focus styles and status labels.
- Proposed restrained teal/blue palette with neutrals and accessible status colors (not final).
- Every important state (overdue, incomplete, verified, synced) displayed with text/icon, not color alone.
- Design components: table, search, patient card, date/calendar, patient timeline, form, verification status, record-author badge, audit view, confirmation dialogs.

## 15. Testing checklist by feature

| Feature | Critical tests |
|---|---|
| Doctor verification | Unverified denied; approval audited; ID evidence private |
| Universal child ID | Unique and permanent across doctors |
| Register numbers | Scoped uniqueness, correct doctor/facility association |
| Duplicate detection | No automatic wrong merges |
| Clinical records | Every entry records professional author and timestamp |
| Corrections | Original record retained and traceable |
| Vaccine tracking | Recompute when a dose is given by a different doctor |
| Appointments | Missed appointment != missed vaccine |
| Admin | No unrestricted patient-record access by default |
| Parent QR | Expiring token; identity/guardianship verification required |
| Authorization | Direct API and database access cannot bypass permissions |

## 16. Working documents and development workflow

Recommended repository files:
- `README.md` — setup, purpose and local development.
- `PROJECT_INFO.md` — requirements and confirmed decisions (companion file).
- `PROJECT_PLAN.md` — this plan.
- `PROGRESS.md` — completed items, blockers and next milestone.
- `DECISIONS.md` — architecture and scope decisions with dates.
- `DATABASE.md` — relational schema and RLS model.
- `VACCINE_DATA.md` — source attribution, schedule versions and clinical review.
- `SECURITY.md` — threat model, access rules and incident/backup approach.

Workflow: implement one milestone at a time → run lint/type checks/tests → review security and UI → document changes → commit. Never deploy real patient records for convenience.

## 17. First implementation backlog

1. Create repository and initialize Next.js/TypeScript/Tailwind.
2. Create Supabase development project and environment configuration.
3. Design `children`, `professionals`, `doctor_patient_registry` and `audit_events` relational schema.
4. Define permissions and test Row Level Security boundaries.
5. Build authentication + unverified doctor state.
6. Build professional credential submission + admin review.
7. Build patient registration and patient list.
8. Build existing paper-record manual transcription.
9. Add clinically reviewed vaccine catalog and dose entry.
10. Implement appointments and cross-doctor follow-up status recalculation.

## 18. Remaining decisions to resolve during build

These are not blockers for the present plan:
- Final brand/logo, fonts, colors and design details.
- Exact format of universal child ID shown to users.
- Whether a paper register number is scoped by doctor, clinic, year and/or book.
- Production-hosting country/provider and regulated health-data compliance.
- Official professional verification sources and document retention process.
- Clinical sign-off for routine scheduling; Hepatitis B HBn/HB1 special-case data remains deferred, and catch-up stays manual.
- Whether to group rotavirus calendar-month doses with week-based VPO/Penta appointments.
- Guardian verification method and initial language priority.
- Suitable paid production infrastructure when actual data volume/legal needs require it.

**Primary V1 success definition:** A verified doctor can register or find a child, maintain that doctor's local register number, record accountable vaccine/clinical entries, schedule follow-ups, and receive accurate updated vaccine status when another authorized doctor vaccinates the same child; administrators can securely verify clinicians and maintain approved schedule rules.
