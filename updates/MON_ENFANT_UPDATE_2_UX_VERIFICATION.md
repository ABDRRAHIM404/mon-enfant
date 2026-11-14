# Mon Enfant — Update 2: Onboarding UX and clinician verification workflow

**Status:** Agreed product requirements; visual design not yet decided.
**Scope:** Parent/clinician entry points, terminology, and account/record verification behavior.
**Separate from:** Update 1 (child duplicate detection).

## 1. Parent-first website onboarding

- Make **parents** the primary audience of the public website, including the most prominent sign-in / registration action.
- Provide a **separate onboarding flow** for parents and for clinicians so that parents are never taken through a clinician verification workflow.
- Keep the clinician sign-in option **less prominent but discoverable**, such as in navigation and the footer; do not hide it so thoroughly that clinicians cannot find it.
- Replace generic **“Professionnels”** in clinician-facing entry points with **“Médecins et infirmier(e)s”** or the concise label **“Espace soignant”**.
- After login, send each user to the relevant area rather than mixing parent features and professional verification on the same page.
- Preserve the parent-to-child linking requirement: an existing child record is linked via a secure invitation/QR flow with appropriate guardian authorization, not through an unrestricted child search.

## 2. Doctors and nurses

- Doctors **and** nurses are eligible clinician users.
- Once verified, both roles have the **same application features and permissions** under this product decision.
- Retain meaningful identity, role, and audit information, including who recorded each medical action, even when the functional permissions are the same.

## 3. Unverified clinician experience — full functionality, provisional data

**Important correction to the earlier demo-only proposal:** An unverified clinician must be able to use the application and create records, not merely explore fictional demonstration data.

- After signup, doctors/nurses can enter their clinician workspace immediately.
- Show their account status clearly as **“Non vérifié”** and offer a path to submit verification evidence later.
- Let them use the same core application workflows as a verified clinician: create new child records, enter vaccination history, record vaccinations, and schedule or change appointments.
- Records entered while the clinician is unverified must be explicitly labeled **“Non vérifié” / provisional**, separate from the clinician's own verification status.
- **No other verified or unverified clinician may see or import these provisional records** while the originating clinician is unverified. Enforce isolation at the database/API authorization layer, not only by hiding UI elements.
- An unverified clinician **cannot access or import existing children registered elsewhere**, including through parent QR sharing. No global lookup by child ID, name or other identifiers.
- Prevent provisional entries from appearing as verified medical facts, official records, or trusted cross-clinician history.
- Keep author identity, timestamps, original values and revisions in an audit trail.

## 4. Verified clinician experience

- After administrator approval, the account shows **“Vérifié”**.
- A verified doctor/nurse may work with children they create and children explicitly shared with them via the authorized parent/QR workflow.
- Verification is **not** permission to browse all children's records; preserve scoped patient access and no global child search.
- Cross-clinician vaccination history applies only to records that are both permitted to be shared and appropriately validated.

## 5. Important unresolved decisions — do not guess in implementation

1. **Existing provisional records after clinician verification:** Should they become shareable automatically, or require individual or batch validation first? **Not yet decided.** Until resolved, do **not** automatically promote them to trusted/shareable records merely because the clinician account becomes verified.
2. **Real children's data in unverified accounts:** This feature raises significant privacy, consent, false-medical-record and impersonation risks. Define a lawful, secure production policy before allowing identifiable real patient data; technical implementation alone is not production authorization.
3. **Parent registration availability:** Parent-side account/claiming flows are scheduled for the parent phase; the website can be designed parent-first without falsely presenting unfinished parent functionality as live.
4. **Practical professional credential checking:** Administrator approval exists technically; the real-world verification method is deferred.

## 6. Acceptance criteria for the coding agent

- [ ] Homepage and login offer a clearly primary parent entry and a discoverable secondary **Espace soignant** entry.
- [ ] Parent accounts never land in clinician-only verification screens.
- [ ] Clinician screens call users **médecins et infirmier(e)s**, not only doctors or generic professionals.
- [ ] Doctor and nurse accounts receive the same permitted clinical feature set once verified.
- [ ] An unverified clinician enters a usable workspace with a prominent **Non vérifié** status.
- [ ] Unverified clinicians can create **provisional, isolated** new-child, vaccine and appointment records in the intended permitted environment.
- [ ] A second clinician cannot retrieve, infer, or modify another unverified clinician's provisional records through UI, APIs, QR, exports, or direct database access.
- [ ] Unverified clinicians cannot access pre-existing children through QR or alternative lookup.
- [ ] Account approval does not automatically validate or publish earlier provisional records pending explicit policy decisions.
- [ ] Preserve record provenance and immutable audit of relevant changes.
- [ ] Existing verified users' authorized workflows remain functional.

## 7. Explicitly outside Update 2

- **Visual appearance** (colors, typography, layouts, illustrations, navigation styling): **still to be discussed and chosen together**. Do not treat the UX requirements as approval for a visual redesign.
- **Child duplicate detection** (child name, birth date, sex, mother's full name, birthplace): already recorded separately as **Update 1**, not yet handed to the coding agent.
- No deployment or changes to the current codebase are authorized by this requirements note alone.
