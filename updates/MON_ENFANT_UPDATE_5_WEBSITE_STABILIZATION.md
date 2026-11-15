# Mon Enfant — Update 5: Website Stabilization & Complete Functional Verification

**Date:** 15 November 2026  
**Priority:** Critical — before continuing Android APK work  
**Status:** Requested requirements; **not yet implemented or verified**

## Objective

**Pause further APK feature development.** Investigate and fix the actual, deployed **Mon Enfant website** across the doctor/nurse and parent experiences. A passing build, page load, or automated test alone is not evidence of a functional user journey. Resume APK work only after the website's core end-to-end journeys pass and the owner has reviewed the results.

## Issues reported by the owner — reproduce first

### 1. Doctor/nurse dashboard navigation is unresponsive

**Observed:** Clicking items in the clinician dashboard navigation/sidebar does not appear to change the page or selected feature.

**Required:**
- Reproduce the issue on the **current canonical Vercel deployment** using an authorized **fictional test account** in each relevant clinician state (verified and provisional), where feasible.
- Audit every visible sidebar, header, tab, menu, card and action link: verify the intended destination or view actually opens and loads the correct authorized content.
- Check client-side hydration/JavaScript errors, link routing, event handlers, loading/error/empty states, overlays and mobile navigation; establish the root cause before fixing.
- A disabled feature must be clearly labeled as unavailable **and not presented as a functional clickable control**.
- Confirm navigation works with mouse, touch and keyboard, on desktop and mobile, in light and dark modes.

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

### 3. Parent website has not yet been manually accepted

Conduct full parent-side checks on the **website** (not just the Android client):
- Parent-first landing/navigation, registration, email confirmation, sign-in, password recovery and logout.
- Parent dashboard, child profiles, vaccinations, growth, consultations, documents, reminders, calendar and accessible exports where permitted.
- Parent invitation and authorized guardianship flow, expiring one-use QR, scanner/claim, approval, multiple guardians and revocation.
- Verify updates made by an authorized clinician appear correctly to the appropriate parent; deny unrelated accounts.
- Check error, empty, loading and expired/revoked-invitation states. Any external email-delivery dependency that cannot yet be tested must remain explicitly **open**, not falsely marked completed.

## Scope: whole website, not only these reported bugs

Walk through **every visible feature** in the clinician, parent and administrative website, including:

- **Clinician:** account/status, professional evidence, provisional isolation, dashboard worklists, new child, duplicate checks, authorized QR/share, patient list and details, historical vaccination entry and reviewed vaccine selection/dose dependency, consultations, prescriptions, allergies/risks, measurements/growth, calendars, manual rescheduling, documents/exports, correction and audit history.
- **Parent:** onboarding and link/approval, read-only health history where applicable, vaccination calendar, appointments and notifications, correction requests, QR sharing/access controls, profile/preferences, permitted exports.
- **Admin:** professional verification submission/review decisions, permissions, source catalog review, account management, relevant histories and denials.
- **Global UI:** navigation, forms (including searchable choices, “Autre” fields and date pickers), submit/retry behavior, helpful validation/errors, French wording, light/dark/system theme, mobile layout and contrast/keyboard access.

Use the actual deployed website **and** validate the database state. Do not mistake a rendered form or a successful HTTP status for confirmed persistence and correct post-save display.

## Required acceptance method

For **each** important action, test:

**Open → enter realistic fictional data → submit → verify server/database persistence → reload → verify correct display → correct/edit if applicable → verify authorization/denials.**

Cover desktop and Android-sized browsers, both themes, verified and unverified clinician states, a parent, an authorized second clinician, and unrelated-user negative cases. Include QR expiration/replay, cross-doctor visibility, provisional-record isolation and session/logout behavior. Test actual clicks/taps and user-facing results, not just APIs or static screenshots. Preserve synthetic test-fixture cleanup and audit traces.

## Explicit guardrails

- **Synthetic data only** until clinical, identity/guardianship, privacy/hosting and operational authorizations are completed.
- **No global child search** permitting another clinician to discover/access records by name or ID. Use only approved registration/duplicate-warning and parent-authorized QR paths.
- **Unverified clinician records remain provisional and isolated**, even after later account approval until a separately approved validation/promotion policy exists.
- Keep approved Updates 1–4, current PNI constraints, immutable clinical history, RLS, capability grants and audit behavior intact.
- Never auto-prescribe catch-up, auto-merge children, expose hidden clinical records or bypass authorization to “fix” the UI.
- Avoid new unrelated features or redesigns during this stabilization phase.
- Do not mark external approvals, SMTP delivery, native camera testing or production readiness as complete without evidence.

## Deliverables to the owner

1. **Bug report:** exact reproduction, root cause, pages and affected roles for the sidebar issue and HB1 follow-up issue.
2. **Fixes:** source changes, migrations only when essential, and a concise list of what was corrected.
3. **Functional acceptance report:** a checklist of visible website features with **Pass / Fail / Blocked**, real browser walkthrough evidence, deployment/commit and tests run. Record unresolved blockers honestly.
4. **Evidence of data lifecycle:** saved vaccination and related routine/appointment result after hard reload, with a documented reason when no automated next dose is allowed.
5. **Parent website acceptance:** genuine synthetic parent-to-clinician-to-parent and QR workflows, including negative-access tests.
6. **Updated project plan/progress:** website stabilization before resuming Android; explicitly list outstanding Phase 6 and external approval gates.

## Exit criteria / when APK development may resume

- All core clinician dashboard links and actions work on the canonical website.
- Vaccination/history data saves, reloads, and appears in the right place; the application correctly distinguishes routine suggestions from doctor-managed HB catch-up.
- Parent website core workflows operate end-to-end and permission boundaries are tested.
- Critical and high-severity website issues are closed; remaining lower-priority issues are documented and accepted by the owner.
- CI, authenticated browser tests and live deployed-site readback agree; the **owner approves** moving back to APK work.

**This document is a work request, not evidence that the issues have been fixed.**
