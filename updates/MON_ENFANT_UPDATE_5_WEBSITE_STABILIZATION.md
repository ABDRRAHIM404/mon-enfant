# Mon Enfant — Update 5: Soignant Functional Redesign & Website Stabilization

**Date:** 15 November 2026  
**Priority:** Critical — before continuing Android APK work  
**Status:** Revised after owner’s mobile website review; **not yet fixed or re-verified**

## Objective

**Pause further APK feature development.** Investigate and fix the actual, deployed **Mon Enfant doctor/nurse website first**. The parent website remains a later stabilization stage; do not redesign or modify it in this milestone. A passing build, page load, or automated test alone is not evidence of a functional user journey. Resume APK work only after the website's core end-to-end journeys pass and the owner has reviewed the results.

## Issues reported by the owner — reproduce first

### 1. CRITICAL: navigation labels exist, but destination pages are missing or not rendered

**Owner’s updated finding:** On the deployed website, most dashboard navigation items show only the menu / current dashboard rather than an actual feature page. The **Settings / account area is the only section the owner reports as working**. Treat the other sections as **missing, incomplete, or inaccessible UI until independently verified**, not just a minor click-handler bug. The user also reported concern about the parent dashboard, but **this implementation milestone is clinician-only**; parent work stays pending. The backend **might** already contain working logic, but this is unconfirmed: do not conclude that an API or database feature is functional without testing it from the visible website.

**Actual menus shown in the owner’s screenshots (do not invent other sections as substitutes):**

| Doctor / Nurse — Menu soignant | Parent — Menu parent |
| --- | --- |
| Tableau de bord | Tableau de bord |
| Enfants | Mes enfants |
| Consultations | Vaccinations |
| Vaccinations | Croissance |
| Rendez-vous | Rendez-vous |
| Croissance | Documents |
| Documents — shown as unavailable in provisional workspace | Partage & accès |
| Mon compte soignant | Paramètres |

Mobile bottom navigation currently shows clinician **Tableau de bord / Enfants / Rendez-vous** and parent **Accueil / Enfants / Rendez-vous / Documents**. The clinician navigation must lead to meaningful, correct authorized content; parent navigation is documented here for future work but is out of scope now. The clinician screenshot is at `/provisional` and the parent screenshot at `/parent`; test verified-clinician routes separately rather than assuming the provisional path is identical.

**Primary instruction:** **BUILD AND CONNECT THE ACTUAL PAGES/VIEWS FOR EVERY MENU ITEM THAT IS SUPPOSED TO BE AVAILABLE.** A sidebar with clickable names, reused landing/dashboard content, empty placeholders, or scroll-to-anchor behavior is not implementation of a section.


**Required:**
- Reproduce the issue on the **current canonical Vercel deployment** using an authorized **fictional test account** in each relevant clinician state (verified and provisional), where feasible.
- Audit every visible sidebar, header, tab, menu, card and action link. For each menu item, confirm a **real page/view exists**, renders its dedicated UI, shows the appropriate scoped records (or a truthful empty state), and provides its feature-specific actions.
- **Map each visible menu label → actual route/component → backend API/RPC → database table and permissions.** Identify missing UI pages versus broken routing versus missing backend functions. Reuse existing APIs and clinical logic if correct; do not rebuild working backend unnecessarily.
- If a section exists only as APIs or tests, **build the real frontend screen** and wire read/write actions to those APIs, with loading, error, empty and denied states.
- Do not remove or hide required menu items merely to make the audit pass. For deliberately unavailable features (e.g. provisional Documents), retain an explicit understandable disabled state; verify verified users see the allowed implementation.
- Check client-side hydration/JavaScript errors, link routing, event handlers, loading/error/empty states, overlays and mobile navigation; establish the root cause before fixing.
- A disabled feature must be clearly labeled as unavailable **and not presented as a functional clickable control**.
- Confirm navigation works with mouse, touch and keyboard, on desktop and mobile, in **light mode only** (the owner removed dark mode).

### 2. Saved HB1/history entry is not reflected where expected

**Observed:** Owner registered a child's HB1 entry, saved it, then could not find the child's next-vaccination information.

**Investigate the entire flow:**
1. Enter an HB1/history vaccination on a **synthetic** child, using the current form and its vaccine/dose selectors.
2. Check the save response and server-side persistence; reload or sign out/in and confirm the entry is still visible in the child's vaccination **history** with the intended source, date and status.
3. Inspect the child's routine-reference/next-vaccination area and dashboard. Identify whether the issue is a broken link, failed save, catalog/version state, permission gate, missing scheduled reference, provisional/uncertain data treatment, or display/filtering defect.
4. Test a **separate, clinically permitted, reviewed routine vaccination** whose next-reference behavior is defined, so routine scheduling functionality is independently demonstrated.
5. **Do not infer or auto-generate a hepatitis B catch-up date.** Existing rules deliberately defer HBn/HB1 special-case automation, and a doctor manually decides catch-up. Clearly show the HB1 history entry even when no automatic next-dose suggestion is eligible; explain the status instead of displaying a blank/ambiguous screen.
6. Verify a manual catch-up appointment can be created and later retrieved without marking a vaccine administered or rewriting its history.
7. Distinguish dose **recorded**, dose **eligible for automatic routine scheduling**, appointment **planned**, appointment **missed**, and **unknown/uncertain** history. Do not label an unknown dose as missed.

**Do not change PNI vaccine data, conditional HB1 rules, clinical validation or permissions merely to make the screen show a next appointment.** If no next dose can legitimately be computed, the correct UX is a visible, honest explanation plus clinician-controlled scheduling.

### 3. Deferred — Parent website has not yet been manually accepted

**Do not perform parent website redesign or implementation as part of this clinician-only milestone.** After owner approval of the clinician website, conduct full parent-side checks on the **website** (not just the Android client):
- Parent-first landing/navigation, registration, email confirmation, sign-in, password recovery and logout.
- Parent dashboard, child profiles, vaccinations, growth, consultations, documents, reminders, calendar and accessible exports where permitted.
- Parent invitation and authorized guardianship flow, expiring one-use QR, scanner/claim, approval, multiple guardians and revocation.
- Verify updates made by an authorized clinician appear correctly to the appropriate parent; deny unrelated accounts.
- Check error, empty, loading and expired/revoked-invitation states. Any external email-delivery dependency that cannot yet be tested must remain explicitly **open**, not falsely marked completed.

## No false completion: a screen must be more than a menu entry

For every clinician and parent section above, the agent must provide a **page inventory** with:

- Route/path, visible page title and actual section-specific UI.
- Data source and permissions (where the data comes from, who may see it).
- Feature-specific interactions: actions, validation, save and refresh behavior.
- Screenshots from the **deployed website** on desktop and phone (not AI mockups or static placeholder HTML).
- Status: **implemented and passed / UI missing / broken / intentionally restricted / blocked**, with a short explanation.

Prioritize **building missing pages and making them work** over redesigning dashboards, adding decorative components or rerunning generic build tests. Settings working alone is **not** sufficient. Do not mark this request complete until every available section has been exercised in the browser.

## Scope: whole website, not only these reported bugs

Walk through **every visible feature** in the clinician, parent and administrative website, including:

- **Clinician:** account/status, professional evidence, provisional isolation, dashboard worklists, new child, duplicate checks, authorized QR/share, patient list and details, historical vaccination entry and reviewed vaccine selection/dose dependency, consultations, prescriptions, allergies/risks, measurements/growth, calendars, manual rescheduling, documents/exports, correction and audit history.
- **Parent:** onboarding and link/approval, read-only health history where applicable, vaccination calendar, appointments and notifications, correction requests, QR sharing/access controls, profile/preferences, permitted exports.
- **Admin:** professional verification submission/review decisions, permissions, source catalog review, account management, relevant histories and denials.
- **Global UI:** navigation, forms (including searchable choices, “Autre” fields and date pickers), submit/retry behavior, helpful validation/errors, French wording, **light mode only**, using Warm Cream `#FAF8F1`, Emerald Green `#087F5B`, and visibly applied Soft Coral `#E97872`, mobile layout and contrast/keyboard access.

Use the actual deployed website **and** validate the database state. Do not mistake a rendered form or a successful HTTP status for confirmed persistence and correct post-save display.

## Required acceptance method

For **each** important action, test:

**Open → enter realistic fictional data → submit → verify server/database persistence → reload → verify correct display → correct/edit if applicable → verify authorization/denials.**

Cover desktop and Android-sized browsers in light mode, verified and unverified clinician states, a parent, an authorized second clinician, and unrelated-user negative cases. Include QR expiration/replay, cross-doctor visibility, provisional-record isolation and session/logout behavior. Test actual clicks/taps and user-facing results, not just APIs or static screenshots. Preserve synthetic test-fixture cleanup and audit traces.

## Explicit guardrails

- **Synthetic data only** until clinical, identity/guardianship, privacy/hosting and operational authorizations are completed.
- **No global child search** permitting another clinician to discover/access records by name or ID. Use only approved registration/duplicate-warning and parent-authorized QR paths.
- **Unverified clinician records remain provisional and isolated**, even after later account approval until a separately approved validation/promotion policy exists.
- Keep approved Updates 1–4, current PNI constraints, immutable clinical history, RLS, capability grants and audit behavior intact.
- Never auto-prescribe catch-up, auto-merge children, expose hidden clinical records or bypass authorization to “fix” the UI.
- Implement only the attached clinician dashboard redesign and functionality; avoid unrelated features or parent redesigns.
- Do not mark external approvals, SMTP delivery, native camera testing or production readiness as complete without evidence.

## Deliverables to the owner

1. **Missing-page inventory and bug report:** exact screenshot-backed reproduction, route/component/API mappings, root causes and affected roles for each menu section and the HB1 follow-up issue.
2. **Completed functional page implementations:** build missing clinician views, connect to existing authorized backend wherever possible, fix routes, and document source changes (migrations only when essential).
3. **Functional acceptance report:** a checklist of visible website features with **Pass / Fail / Blocked**, real browser walkthrough evidence, deployment/commit and tests run. Record unresolved blockers honestly.
4. **Evidence of data lifecycle:** saved vaccination and related routine/appointment result after hard reload, with a documented reason when no automated next dose is allowed.
5. **Parent website:** explicitly document as not yet accepted and deferred to a later, separate milestone; do not falsely mark it complete.
6. **Updated project plan/progress:** website stabilization before resuming Android; explicitly list outstanding Phase 6 and external approval gates.

## Exit criteria / when APK development may resume

- Every available **clinician** menu item opens a real dedicated functional screen, not the same dashboard or an unimplemented placeholder. Correct empty/blocked states are acceptable only when truthful and justified.
- Vaccination/history data saves, reloads, and appears in the right place; the application correctly distinguishes routine suggestions from doctor-managed HB catch-up.
- Parent website verification remains an explicit **future gate** before resuming APK work; it is not part of this clinician-only implementation.
- Critical and high-severity website issues are closed; remaining lower-priority issues are documented and accepted by the owner.
- CI, authenticated browser tests and live deployed-site readback agree; the **owner approves the clinician milestone**. APK remains paused until a later parent website acceptance milestone also passes.

**This document is a work request, not evidence that the issues have been fixed.**


---

## Doctor/Nurse Dashboard Design & Implementation Contract

**Status:** Implementation request for the coding agent — **doctor/nurse (Espace soignant) ONLY**.
**Priority:** This is part of Update 5 website stabilization. Do **not** resume Android APK work or redesign the parent dashboard yet.
**Scope:** Responsive website, desktop-first, with tablet/phone adaptation. Light theme ONLY.

## 1. Goal
Implement the approved *visual direction* from the eight separately generated doctor/nurse website mockups. The current site shows navigation items but several corresponding feature pages are absent or do not visibly work; **build/connect the actual pages**, not just a prettier navigation menu. Use existing database schema, APIs, services, and permissions whenever possible; inspect what exists before implementing or changing anything.

The eight attached reference images illustrate **layout and interaction hierarchy**, not accurate clinical data, production text, or a request to create capabilities that do not exist. Do not copy fabricated patient details, statistics, appointments, doses, schedules, percentages, medical interpretations, or permissions from images.

## 2. Mandatory brand and design system
- **Light mode only**. No dark-mode switch or dark-theme screens.
- **Warm Cream `#FAF8F1`**: primary page background (approximately 60%).
- **Emerald Green `#087F5B`**: primary actions, navigation and interactive states (approximately 30%).
- **Soft Coral `#E97872`**: clearly visible but sparing attention accent (approximately 10%); important reminders, status highlights and selected illustrations. Do not make coral the default for every button or use it as the sole indication of urgency.
- Dark readable text, white or cream card surfaces, subtle borders, sufficient contrast and accessible focus states. Red is reserved for errors/actual high-priority clinical warnings, not all routine reminders.
- Retain the selected **Mon Enfant** mother-and-child logo; do not replace it with a generated alternative or decorate the page with repeated background logos.
- Consistent spacing, radii, shadows, typography, icons and layout. Avoid excessive hero illustrations and empty space; healthcare tasks must remain central.
- Use established design-system guidance (including Astryx **as optional inspiration for patterns and accessibility**) only if appropriate. **Do not install or migrate to a component library without first checking Next.js/React/Tailwind compatibility and showing concrete benefits.** Prioritize fixing the functional pages.

## 3. Shared soignant website shell
All eight pages must share one responsive navigation layout:
- Sidebar in this exact order: **Tableau de bord, Enfants, Consultations, Vaccinations, Rendez-vous, Croissance, Documents, Mon compte soignant**.
- Clear active section; every available item opens its corresponding working page/section and remains selected after reload.
- Header: compact Mon Enfant branding, appropriately **scoped** search (never allow patient lookup by name/ID across ungranted records), alerts if implemented, and account/status controls.
- Desktop: fixed or collapsible sidebar + wide main content; tablet: more compact sidebar/cards; phone: accessible collapsible navigation or existing bottom-nav pattern, stacked cards, no sideways page overflow.
- Empty/loading/error/no-permission/provisional states must be intentional, understandable and safe; no mock statistics passed off as live data.
- Only show actions actually authorized for the signed-in clinician.

## 4. Eight pages to implement (one distinct page per navigation item)

### 1 — Tableau de bord (`01_Tableau_de_bord.png`)
- Fast daily overview: **children in my authorized register**, today’s appointments, recent consultations and vaccinations requiring review.
- Keep at-a-glance summary cards, short actionable lists, and quick actions: add child, start consultation, register vaccination, plan appointment.
- Every card and quick action leads to its real destination and uses real authorization-scoped data.

### 2 — Enfants (`02_Enfants.png`)
- Clean searchable/paginated child register, with useful filters (e.g. age range and follow-up status, where backed by data).
- Show essential columns only: child identity/local register ID, age, authorized guardian/contact where permitted, last visit and next appointment if recorded.
- **Ajouter un enfant** links to the existing creation workflow. Row click opens that child's profile. No unauthorized global lookup or information leakage.
- Preserve duplicate-review handling from Update 1; never auto-merge.

### 3 — Consultations (`03_Consultations.png`)
- Consultation history and recent entries for authorized children, simple filtering, and an obvious **Nouvelle consultation** action.
- Child and entry navigation leads to the existing clinical form/history and correction workflow; save → persistence → reload must work.
- Do not invent appointment status or clinical assessments based on missing notes.

### 4 — Vaccinations (`04_Vaccinations.png`)
- Choose an authorized child, view **actual recorded vaccine history**, source/provenance and any clinically reviewed, eligible routine references.
- Surface **Enregistrer une vaccination** and the searchable vaccine/dependent-dose choices built in Update 4, including **Autre (préciser)** for unknown historical labels.
- Distinguish administered, pending review, possible follow-up and unknown history. **Do not invent future doses or dates for HB1, catch-up, uncertain history, or unapproved schedules.** Clinician handles manual catch-up and adjustments.
- Investigate previously reported HB1 save/next-vaccination visibility issue as part of this Update 5 (check saved event, source status, schedule eligibility, routing and user feedback).

### 5 — Rendez-vous (`05_Rendez_vous.png`)
- Real day/week/month scheduling view or manageable calendar/list with **Nouveau rendez-vous**, reschedule, cancel and visit disposition controls as authorized.
- Show recorded times/statuses; never manufacture a missed vaccine from a missing vaccination record. Preserve original schedule and reason on clinician rescheduling.
- Every event opens its real details; persistence and refresh are mandatory.

### 6 — Croissance (`06_Croissance.png`)
- Select an authorized child; show measured height/weight/history and raw growth charts **only from saved observations**.
- Offer permitted **Nouvelle mesure** and correction/history workflow.
- **Do not present automatically inferred “croissance normale,” percentile ranks, or diagnostic assessments unless clinically approved standards and computations are actually implemented.** The illustration is not clinical evidence.

### 7 — Documents (`07_Documents.png`)
- Show a deliberate and elegant **“Bientôt disponible”** screen for clinician document management.
- No nonfunctional upload/download controls, no fake document lists. Preserve any existing permitted export/print functionality in its current working location.
- Make the actual scope/status of provisional accounts clear.

### 8 — Mon compte soignant (`08_Mon_compte_soignant.png`)
- Preserve the **working existing account/settings** behavior, with consistent redesign: profile, account status/verification, notifications or preferences only where implemented, password/session/security entry points.
- Show “Non vérifié” vs “Vérifié” clearly. **Do not give unverified clinicians visibility into other clinicians’ or real shared child records**; their provisional entries remain isolated until separately reviewed under the existing policy.
- Never imply professional verification is already complete if it is not.

## 5. Security / role contracts: do not regress
- Doctor and nurse have the agreed feature parity; permissions remain enforced by the backend, not only hidden UI elements.
- A clinician can work with patients only within their current explicit authorization grants. A patient **cannot** be discovered through unrestricted name/ID searches.
- Unverified clinician workspace has usable **isolated provisional records** marked non-verified; another verified clinician cannot view them by default.
- Parent sharing/QR still requires its purpose-bound authorization workflow; no QR or child ID alone grants general access.
- All clinical writes retain attribution, source information, revision history, audit, and permissions; do not loosen existing Supabase RLS or backend checks to make pages look functional.
- Use **fictional data only** for development and screenshots; do not include real children's health information in evidence.

## 6. UI/UX quality gates
1. For each page, verify the navigation item loads the correct URL/visible page, active state, permissions, error and empty states.
2. Exercise the real primary task: input → validate → submit → database check → reload → same correct result (and correction flow where relevant).
3. Test clinician **verified and unverified** paths; denied/non-owner clinical reads must stay denied.
4. Review screenshots **page-by-page** on desktop, tablet and phone; verify visual design against reference and 60/30/10 colors (coral must actually be visible), no overflow, readable controls, keyboard/touch usability and accessibility.
5. Do not call a feature “done” because a screen renders or CI is green. Publish to the canonical website, manually inspect deployed pages and record evidence.
6. Provide a concise before/after table for all 8 sections: route, real backing data, primary interactions, tests passed, known gaps, and screenshots.

## 7. Explicit scope / sequence
**Work only on Espace soignant for now.** Do not redesign **Espace parent**, restart Android APK work, begin iOS, replace the backend, add speculative clinical automation, or implement unrelated features.

First fix/connect the missing clinician pages and their actions; then implement the shared visual system and verify the deployed result. This same Update 5 requires clinician end-to-end testing; parent website verification follows as a separate milestone after clinician acceptance.

## Reference images
The attached ZIP contains **8 separate desktop mockups**, numbered in the exact sidebar order. They are conceptual UI references, not screenshots from the live app and not clinical specifications.


## Non-negotiable functional acceptance matrix

For each of the eight clinician pages, demonstrate: real navigation and selected state; authorized backend read; correct empty/error/loading/provisional UI; every visible actionable control works; writes survive hard reload and new session; user-visible success/failure messages; negative access checks; desktop and phone-width responsive checks; deployed URL, evidence and outstanding bugs. Use real existing Supabase RPC/API/permissions—not hardcoded mockup content. For Documents, the approved “Bientôt disponible” state is the intentional exception; do not fabricate working document management. Do not mark the milestone completed if a page only looks attractive.
