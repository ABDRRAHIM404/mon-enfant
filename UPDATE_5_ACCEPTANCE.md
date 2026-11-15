# Update 5 clinician acceptance — in progress

This report is not milestone approval. Parent website acceptance is deferred; APK and iOS work remain paused. Source and live evidence must agree before any page receives final Pass.

## Current evidence

- Canonical source `94a0253`, deployment `dpl_EVinRVXVrpe9trJjoJMkhW9J1Qmp`: desktop walkthrough passed 16 destinations across a verified doctor and unverified nurse, four provisional saves/hard reloads, logout, other-author denial, zero JavaScript errors and no horizontal overflow. Resource-capped run 74885 completed in 2.6 minutes. Screenshots retained privately at `/tmp/mon-enfant-clinician-pages-desktop-passed` pending final source captures.
- Independent provisional persistence: `docs/stabilization/update5/clinician-desktop-ledger.json`. No provisional-to-trusted promotion; all four entries remain unverified.
- Applied provisional projection: `docs/stabilization/update5/provisional-section-migration.json`; live role/session denial receipt: `docs/stabilization/update5/provisional-section-http.json`.
- Light-only canonical appearance previously passed desktop and Android-sized Chromium despite saved dark preference and dark OS: `docs/stabilization/update5/light-appearance.json`.
- Feature source `87bb599` passed 13 Vercel tests, explicit TypeScript and production build in `dpl_6pAAgjhbnzQUS5YhyqsQuN9SXoFj`. Its new consultation projection is now applied with matching stored source and auth-only execution, and live HTTPS role/session checks pass; receipts: `docs/stabilization/update5/clinician-overview-{migration,http}.json`. Latest screenshots cannot establish this source's appearance.

## Page matrix

| Section | Before → implemented direction | Real data / interactions | Acceptance still required |
| --- | --- | --- | --- |
| Tableau de bord | Dense nine summaries → four summaries and real recent documentation | Current registry/grant summaries, appointments, vaccine review, proposed scoped consultation read; gated quick actions | Cloud/new read acceptance; actual recent consultation and corrected/withdrawn history; final three viewports |
| Enfants | Existing trusted register / reused private home → dedicated private register | Authorized search, pagination, creation/profile and duplicate-review workflows | Full trusted creation/review lifecycle and responsive acceptance |
| Consultations | Missing global page → child selection and actual history | Clinical timeline, permitted form/revisions; private owner-only equivalent | Trusted save/correct/new-session readback; denied roles and final captures |
| Vaccinations | Catalog destination / history below controls → dedicated care history first | Saved ledger/provenance, reviewed references, permitted write/manual planner; HB1 uncertainty explained | Trusted HB1/reviewed QA routine/manual appointment lifecycle and final captures |
| Rendez-vous | Existing calendar / private child chooser → connected calendar and private appointment list | Recorded day/week/month, scheduling/dispositions, private saved follow-up | Trusted plan/reschedule/cancel/disposition persistence and final captures |
| Croissance | No global page → selected-child measurements and raw charts | Saved observations only, permission-gated entry/correction; no inferred diagnosis | Trusted measure/correction lifecycle and final captures |
| Documents | Missing page → deliberate coming-soon | No fabricated uploads/downloads; provisional menu explicitly disabled; existing exports retained elsewhere | Final captures and permitted export regression |
| Mon compte soignant | Existing account → shared shell and clear actual status | Read-only identity, verification/evidence, permissions, recovery/session/logout | Full permitted action/denial walkthrough and final captures |

All rows remain **Pending** overall. An individual narrow check above is not a final page Pass. No external clinical, legal, guardian, hosting or email approval is inferred.

## Remaining exit gates

1. Finish and publish the clinician refinements, preserving current-session, role/capability and explicit-grant boundaries.
2. Exercise each real task, validation, failure, immutable correction/history and hard-reload/new-session persistence; independently read the hosted ledger.
3. Capture and review desktop/tablet/phone against all eight supplied references. Record remaining bugs and severity honestly.
4. Retire active fixture `5d4ec565b0864dce`, temporary secrets and any QA-only reviewed clones. Never repeat preparation.
5. Synchronize the primary main checkout with published GitHub main and verify exact HEAD equality.
6. Obtain owner review/approval of this concrete clinician milestone. Parent acceptance is a later gate before APK work may resume.
