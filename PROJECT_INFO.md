# Mon Enfant — Project Information

**Status:** Planning / requirements baseline  
**Working name:** Mon Enfant (temporary; final brand not selected)  
**Concept:** Digital Moroccan *Carnet de Santé de l'Enfant*  
**Primary launch:** Responsive web application  
**Future:** Dedicated Android/iOS application  
**Last updated:** 12 November 2026

> This document records agreed requirements and clearly labels proposals or deferred features. It is not a medical protocol, legal compliance certification, or authorization to store real patients' information.

## 1. Purpose

Replace fragmented paper-based child health tracking with a continuous, secure digital health booklet that supports healthcare professionals and later parents. A child's health record remains associated with the child across different doctors and health centers, while clinicians retain their own register numbering and follow-up lists.

### Problems to solve
- Doctors currently maintain separate paper registers and must manually check follow-up dates.
- Vaccination history can become fragmented when a child changes doctors.
- A child vaccinated by another clinician may be wrongly classified as overdue by the previous clinician.
- Parents may lose, forget, or struggle to share paper booklets.
- Clinics need searchable histories, upcoming appointments, and accountable entry authorship.

### Intended outcomes
- One permanent universal child identifier, independent of any clinician.
- Track dose administration, next due vaccinations and appointments, and missed follow-ups.
- Allow a new doctor to see authorized history, record a dose, and update follow-up status for other authorized caregivers.
- Show *who* entered or corrected each clinical record, with date/time and facility context.
- Allow a parent to link to an existing child profile instead of creating a duplicate.

## 2. Confirmed product priorities

1. **Doctor-facing functionality first**, supported by an **admin dashboard in version 1**.
2. **Parent experience second**, using the same records and backend.
3. **Responsive web app first**, dedicated mobile app later.
4. Doctors can **manually register new children** and **manually transcribe existing paper-register/booklet information** in version 1.
5. Scanning paper booklets and AI extraction are **deferred**.
6. Internet access is **required initially**; offline data capture/synchronization is **deferred**.
7. Initial appointment functionality: manual scheduling, suggested upcoming vaccine due dates, upcoming/completed/missed statuses, and doctor follow-up reminders.
8. Parent SMS/WhatsApp reminders are **deferred**.
9. The hospital-used **PNI cours.pptx** is the project's vaccination reference; its 2025 calendar is on slide 67. The extracted `MON_ENFANT_PNI_DATA.json` and `MON_ENFANT_PNI_SCHEDULE.csv` record the schedule, source ages and agreed implementation decisions. Patient-specific calculations and exceptions require clinician oversight.
10. **Supabase** selected for database/authentication/storage; **Next.js + TypeScript + Tailwind CSS** selected for the responsive frontend and server-side application/backend.
11. Design is **provisional** and can be adjusted later.

## 3. Roles and access

### Doctor / qualified healthcare professional (first version)
- Sign up as **unverified**.
- Submit professional working matricule/registration identifier and identity document for staff review.
- After administrator approval, receive a unique platform professional ID and assigned privileges.
- Maintain a personal/practice patient registry and follow-up list.
- Access child records only where professionally authorized; record consultations and permitted vaccinations and measurements.
- Review vaccination history and follow-ups across providers when access is authorized.
- View record authorship and permissible audit history.

> In real deployments, distinguish doctors, nurses, and other healthcare professionals by verified credentials and permitted actions. A doctor account must not automatically imply every clinical privilege.

### Admin (first version)
- Review, approve, reject, or request more evidence for verification applications.
- Manage verified professional accounts, roles and account status.
- Configure and version vaccination types, dose rules, schedules, and effective dates with clinical approval.
- Monitor operational health, security events, and privacy-preserving statistics.
- Review necessary audit events without blanket access to full patient records.
- Manage system settings and controlled invitations as permitted.

### Parent / guardian (second version)
- Register or sign in; link existing children with verified guardianship.
- View their children's health booklets, vaccinations, growth, appointments and follow-up reminders.
- See care events and the responsible professional where appropriate.
- Manage authorized guardians and contact details, with correction/request workflows.
- View/export permitted records and access history, subject to policy.

### Later roles
- Verified nurses and authorized clinical support staff, with narrower permissions.
- Practice/health-center administrators, if operationally needed.

## 4. Unique identifiers and cross-doctor continuity

**Two different identifiers must coexist.**

1. **Universal Child ID:** Permanent, platform-generated and unique system-wide. Never changes when a child switches providers.
2. **Doctor's Register Number:** Existing number in that doctor's paper register, stored *together with that doctor/practice's identifier*. It is not globally unique.

Example (fictional):

| Field | Example |
|---|---|
| Universal child ID | CH-00001245 |
| Doctor A | DOC-001 |
| Doctor A register number | 125 |
| Doctor B | DOC-002 |
| Doctor B register number | 78 |

Both doctors can refer to the same child, with separate registry associations. Preserve an internal immutable database key even if a human-readable child ID format changes. Search and duplicate-detection require careful matching and human review; **do not automatically merge children based only on name, birth date, or phone number**.

### Cross-doctor vaccination workflow
1. Doctor A records an upcoming vaccination/follow-up for a child.
2. Child receives the relevant vaccine from Doctor B.
3. Doctor B records the administered dose against the permanent child record, with dose details, clinician ID, timestamp and facility.
4. Authorized Doctor A sees the updated vaccination history; the dose's completion status is recalculated.
5. Duplicate vaccine reminders and false vaccine-overdue alerts are suppressed **after validating that the recorded dose fulfills the intended schedule item**.
6. Non-vaccination appointments are **not silently cancelled**; they remain separately managed or flagged for staff review.

The system must protect against duplicate doses, transcription uncertainty, incorrect dose assignment, and simultaneous updates.

## 5. Doctor web app — functional requirements

### A. Doctor account and verification
- Register, log in, recover account and manage profile.
- View verification status: unverified, under review, approved, rejected/suspended.
- Securely submit matricule and identity evidence.
- Access professional functions only after verification and permission checks.

### B. Patient registry
- Register newborns/new patients with demographics and birth information.
- Manually digitize paper records and prior vaccine doses; mark imported information with provenance and verification status.
- Search by universal ID, clinician-specific register number, and approved demographics.
- Add existing child to doctor's own registry without creating a new child record.
- View last visit, next appointment, upcoming vaccination, and overdue flags.
- Patient list filters (age, dates, status, follow-up needs).

### C. Child medical profile
- Patient overview, guardians/contact data where justified, health risks/allergies, clinical summary.
- Vaccination history: vaccine, dose, date/time, batch/lot when available, site, provider, facility and source.
- Consultations, diagnoses, treatment plans and prescriptions within authorized roles.
- Growth data: weight, length/height, head circumference and measurement history.
- View chronological health timeline and attached permitted clinical records.
- Every creation/correction shows professional ID, author, facility and timestamp; corrections preserve original entries.

### D. Vaccination schedule and tracking
- Admin-managed, clinically approved Moroccan vaccination schedule and vaccine catalog.
- Suggest routine next due dates from the documented 2025 PNI schedule and recorded history, with the approved age-unit interpretation. **Do not automatically calculate catch-up dates or unresolved hepatitis B special cases.**
- Show recorded, upcoming, due and potentially overdue items with clear uncertainty where history is incomplete. **Do not classify a child as having missed a vaccine solely because an old dose is undocumented.**
- Record administrations; prohibit unsafe silent duplication and keep clinical override with reason/audit trail when needed.
- Recalculate when another authorized doctor records the dose.
- **The application suggests routine dates; the doctor chooses any catch-up appointment manually.** Missed vaccinations are automatically flagged, but never treated as administered merely because an appointment was rescheduled.

#### Confirmed PNI data decisions (12 November 2026)
- **VPO0:** 'at birth' and 'during the first four weeks' are treated as compatible wording for this project; preserve both source references.
- **Pneumococcal:** Slide 89 repeats `VPC2` in error. Use **PCV1 at 10 weeks, PCV2 at 18 weeks, PCV3 at 6 months, PCV4 at 12 months** from slide 67.
- **Rotavirus:** For scheduling, use **2, 3 and 4 calendar months**; retain the chart's original **8, 12 and 16 weeks** as source ages for traceability. Other vaccines at 8/12/16 weeks may land on different dates; do not assume same-day appointment grouping without clinician review.
- **HPV:** Age **11 years**, **girls only**.
- **Hepatitis B:** The birth-dose **HBn is not yet a separate row in the 25-dose dataset**. Keep the source conditional HB1 reference, but disable HB1 auto-scheduling and defer HBn/HB1 special-case database logic until later clarification.
- **Missed vaccinations:** Automatically flag missed appointments and potentially overdue doses **separately**; missing documentation alone is not proof a vaccine was missed. The doctor reviews the history and manually reschedules based on vaccine-specific procedures. Record old/new appointment date, doctor ID, timestamp and reason, and preserve the missed-event history. Do not generate an automatic catch-up plan.
- **Cross-doctor updates:** A dose administered by another authorized doctor updates the shared vaccination record and relevant reminders without cancelling unrelated appointments.

### E. Appointments and follow-ups
- Schedule, reschedule and cancel appointments; select reason and clinician/facility.
- Daily/weekly/monthly calendar and patient follow-up queue.
- View upcoming, completed, missed and overdue appointments.
- Reminders **inside the doctor app** in the first release.
- Preserve distinct statuses for a missed appointment versus a completed vaccination elsewhere.
- Track follow-up assignment changes and appointment history.

### F. Reports and operations
- Counts of registered children, due follow-ups, overdue vaccine items and appointments.
- Patient-specific record export and printable clinical summaries if access rules permit.
- Aggregate reports without unnecessary identifying information.
- Doctor's activity history and traceable corrections.

## 6. Admin web app — functional requirements (version 1)
- Review professional verification applications and supporting documents.
- Validate submitted professional identity against appropriate official sources/workflows; do not assume that a matricule alone proves current licensure.
- Approve/reject, suspend/reactivate accounts with audit trail and reason.
- Manage role permissions, vaccination catalog and versioned schedule rules.
- Review system events, abnormal access patterns and aggregate counts.
- Configure institution settings, communication templates and security controls.
- Separate identity-document review privileges from general content administration.

## 7. Parent experience (phase 2)

1. **Child profiles:** See children, birth details, permanent ID and an access-controlled health card.
2. **Vaccinations:** Historical doses, due dates, missed items, clinically validated schedule and reminders.
3. **Medical history:** Read authorized consultations, medications, allergies, reports and relevant treatment plans.
4. **Growth:** Charts, measurements and milestones where available.
5. **Appointments:** View upcoming visits and approved scheduling options.
6. **Digital booklet:** Child timeline, download/print permissions, future saved/offline copy.
7. **Health guidance:** Reviewed age-related health information, future optional non-diagnostic assistant.
8. **Account/privacy:** Multiple children, multiple verified guardians, languages, permissions, consent and access history.

**Languages proposed:** French and Arabic at initial design; Moroccan Darija may be added, with final launch-language decision still open.

## 8. QR codes: two separate flows

### QR A — Child lookup (doctor workflow)
- Identifies or locates the child record for a logged-in, authorized clinician.
- Must **not** include sensitive patient details or act as blanket authorization.
- Identity lookup and access approval are separate checks.

### QR B — Parent invitation (future parent onboarding)
- A doctor creates an existing child's record, then generates a **one-time, short-lived invitation** for a guardian.
- The parent scans via app/web and signs up or signs in.
- The system verifies guardianship through an appropriate second step before granting access.
- Existing record is linked, not recreated. Support separate invitations for additional guardians.
- Track invitation state, expiry and replacement/revocation; never encode medical history or raw personal identifiers in QR content.

## 9. Proposed technical architecture

| Layer | Selection | Notes |
|---|---|---|
| Responsive frontend | Next.js, React, TypeScript | Doctor and admin dashboards first |
| UI styling | Tailwind CSS | Shared reusable design components |
| Application/backend | Next.js server-side handlers and server functions | Centralize checks, clinical business rules and privileged operations |
| Relational database | Supabase PostgreSQL | Foreign keys, transactions and row-level security |
| Identity and authentication | Supabase Auth | Verified clinician state kept in protected authorization data |
| File storage | Supabase Storage | Private verification evidence, restricted review |
| Deployment | Suitable Next.js host, to be selected for real deployment | Development deployment may use free tiers with fictional data |
| Future mobile | React Native + Expo (proposed) | Uses the same secure backend |

### Core data entities (conceptual)
- `users` / `professional_profiles` / `verification_requests` / `facilities`
- `children` (internal key, permanent universal ID)
- `doctor_patient_registry` (doctor/facility, child, local register number)
- `guardians`, `child_guardians`, `guardian_invitations`
- `vaccines`, `schedule_versions`, `schedule_dose_rules`, `administered_doses`
- `consultations`, `conditions`, `prescriptions`, `growth_measurements`, `clinical_documents`
- `appointments`, `follow_up_tasks`, `notifications`
- `access_grants`, `audit_events`, `record_corrections`

Design key uniqueness and relationships explicitly. A local paper-register number may only be unique *within a particular register scope*, not even necessarily globally unique for one doctor across years or sites.

## 10. Safety, privacy and reliability

- Handle **children's sensitive medical data** with strong access restrictions, including verification, least privilege, staff-appropriate access, and audit trails.
- Adopt server-side authorization and database Row Level Security; never treat a visible QR or a logged-in session as sufficient permission.
- Encrypt data in transit and at rest; secure private document storage; minimize stored identity-document copies and establish retention/deletion policies.
- Keep original clinical entries and corrections traceable, including actor, timestamp, reason and source.
- Minimize patient data in logs, notifications, exports and analytics.
- Plan backups, tested recovery, session controls, incident response and monitoring before real-world rollout.
- Review Moroccan Law 09-08, CNDP requirements, health-data handling and cross-border hosting restrictions with qualified local advisers *before using identifiable patient data*.
- Supabase free-tier suitability for production medical data is **not assumed**. Build and test using synthetic data until security and legal validation are complete.
- Treat supplied vaccination data as **source material pending clinical validation**, not an automatically authoritative protocol.

## 11. Provisional design direction (not finalized)

**Principles:** credible healthcare appearance; fast, legible workflows; low-friction data entry; responsive layouts; accessible contrast, keyboard navigation and clear status indicators.

**Doctor UI:** information-dense but calm dashboard; searchable patient list; today's appointments; vaccine-due queue; patient profile with tabs for overview, vaccines, consultations, growth, appointments and audit history; prominent `Add visit` / `Record vaccine` actions. Explicit saved/unsaved/error feedback.

**Admin UI:** role-based dashboard, verification review queue, document review with access safeguards, approval history, vaccine schedule/version management and audit reports.

**Parent UI (later):** warmer, simpler visual language; child cards, next appointment/vaccination, timeline, notifications and invitation/linking flow.

**Visual proposal:** clean light surfaces, restrained teal/blue healthcare accents, measured warning/status colors and readable type; all colors, logo, typography and brand identity can be changed. Never rely on color alone to convey clinical status.

## 12. Deferred functionality / not in initial release
- Parent-facing portal and parent QR invitation redemption until phase 2 (doctor-side invitation mechanism can be prepared earlier).
- Native mobile apps.
- Offline local-first data capture and syncing.
- Photo/scan upload of paper booklet and AI OCR/extraction.
- SMS/WhatsApp parent reminders (provider integrations and consent later).
- General-purpose AI medical advice or automated diagnosis.
- Deep integration with government health systems, labs, pharmacies or insurance until separately approved.

## 13. Open inputs (not blockers to planning)
- Hepatitis B birth-dose **HBn is not represented as a separate row** in the 25-dose CSV/JSON schedule; conditional HB1 auto-scheduling is disabled. Add both birth-dose recording and the conditional logic later. Catch-up is **doctor-directed/manual** in V1; vaccine-specific automation would require separately validated clinical rules.
- Confirm whether rotavirus calendar-month appointments and VPO/Penta week-based appointments should be grouped into the same clinic visit; the source and configured ages can differ by days.
- Review the extracted 2025 PNI reference against implementation tests before using real patient data.
- Exact register-book numbering conventions: clinic scope, year and uniqueness.
- Verification operations and official sources acceptable for professional credentials.
- Medical/legal review of permissions, guardianship verification, hosting location and record retention.
- Production hosting choice and costs; no paid service authorized.
- Launch languages, final branding and detailed visual design.

## 14. Decision log

| Decision | Status |
|---|---|
| Working title: Mon Enfant | Temporary |
| Doctor-first, parent-second | Confirmed |
| Web-first, native app later | Confirmed |
| Admin dashboard in V1 | Confirmed |
| Manual child registration and existing-data entry | Confirmed |
| Permanent universal child ID | Confirmed |
| Doctor/register-scoped local child ID | Confirmed |
| Cross-doctor vaccination status synchronization | Confirmed |
| Immutable clinician attribution/audit history | Confirmed |
| Doctor verification via matricule and ID review | Confirmed |
| Doctor follow-ups and vaccine date recommendations | Confirmed |
| Doctor reminders V1, SMS/WhatsApp later | Confirmed |
| Offline later | Confirmed |
| Paper scans/AI extraction later | Confirmed |
| Supabase + Next.js + TypeScript + Tailwind | Confirmed |
| VPO0 birth/first-four-weeks wording | Resolved as compatible |
| Pneumococcal VPC2 duplicate label | Corrected to PCV1–PCV4 |
| Rotavirus appointment ages | 2, 3, 4 calendar months |
| HPV at 11 years | Girls only |
| Missed vaccine workflow | Auto-flag; doctor manually reschedules; audit retained |
| Hepatitis B special-case rules and HBn birth-dose row | Deferred; HB1 auto-scheduling disabled |
| Visual identity | Provisional |
