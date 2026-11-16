# Update 5 clinician acceptance — in progress

This report is not milestone approval. Parent website acceptance is deferred; APK and iOS work remain paused. Source and live evidence must agree before any page receives final Pass.

## Current checkpoint — 16 November 2026

Canonical application **cbe7281ddc5b3fd1adb269a780906eadeeb5696e**, READY **dpl_3eXteaJvzYqcLbfPEvDQ8tykh45G**. Production logs prove 17 focused tests, explicit TypeScript and build. Earlier checkpoint references below are historical evidence, not the current deployed revision.

| Check | Result | Authoritative evidence / limit |
| --- | --- | --- |
| Trusted consultation and growth save/correction/new session | Pass | `trusted-care-5879b92/{trusted-consultation,trusted-growth,independent-ledger}.json`; original rows and linked corrections retained |
| Manual appointments and three calendar views | Pass | `trusted-care-5879b92/trusted-appointments.json`; four manual appointments now retain eight immutable events in `routine/independent-ledger.json`; future-missed denial is form-scoped |
| QA-only independently reviewed routine and second-clinician dose | Pass | `routine/{routine-reference,routine-continuity,independent-ledger}.json`; original draft/rule hash unchanged; only VPO1 reference, uncertain HB1 separate; no genuine clinical approval claimed |
| Current grant revocation against same live session | Pass | `routine/routine-revocation.json`; recorded authorship retained; independent ledger confirms revoked B grant |
| Private consultation correction/quarantine | Pass | `provisional-correction-{after,ledger-after}.json`; original row unchanged, clinical/amendment reasons distinct |
| Desktop clinician navigation | Pass, scoped | 16 destinations/two roles in `desktop-804ab4f`; later care/calendar captures cover populated workflows; final report does not imply every secondary action passed |
| Populated tablet navigation and layout | Pass, scoped | Run 89358, 16 destinations/two roles, no JS errors/overflow; all 16 page captures inspected in `tablet-cbe7281`; private plot width ≥280px |
| Phone-width navigation/forms/layout | Pass, scoped | Managed unit mon-enfant-phone-20261116.service completed successfully; 16 destinations, four genuine private saves/reloads, no JS errors/overflow; all 16 initial-viewport captures inspected in `phone-cbe7281` |
| Fixture/QA-clone retirement | Pending | 5d4ec565b0864dce remains active; original source must remain unchanged |
| Final inventory, broad action coverage and owner review | Pending | Remaining secondary creation/review/account/export actions must be mapped to evidence or explicitly left open; no blanket eight-page acceptance |

Paths above are under `docs/stabilization/update5`. Responsive private ledger: `responsive-private-ledger.json` independently proves three cases / 13 unverified revisions, exact saved raw measurements and manual dates, zero trusted children/grants/capabilities. Parent redesign/acceptance, actual mail and other external approvals remain open; APK and iOS stay paused.

## Historical evidence

- Current canonical **804ab4f**, READY **dpl_EPz3t6fQa7mhubGw3KVVXK2GSrUd**: desktop run 7734 passed 16 destinations/two roles, private-history reuse after reload, actual selector interaction and visible 46 px inputs, logout/current-session denial and other-author denial; zero JS errors/overflow. All eight verified-page captures inspected; durable 16 captures/proof: [desktop evidence](docs/stabilization/update5/desktop-804ab4f/clinician-pages.json). This is desktop technical acceptance, with trusted clinical and responsive gates still open.
- Actual provisional correction field collision was reproduced without saving; source dc6201c separates clinical/amendment reasons and passes 17 focused cloud tests, explicit types/build in READY preview dpl_GFGHxHmkvahBJG8YX93Ra2se7XVS. Canonical 9f892ef now passes corrected save/reload/new-session and independent immutable-row readback: original unchanged, revision 2 linked, reasons separate, still quarantined. Receipts: `docs/stabilization/update5/provisional-correction-{after,ledger-after}.json`.

- Canonical source `94a0253`, deployment `dpl_EVinRVXVrpe9trJjoJMkhW9J1Qmp`: desktop walkthrough passed 16 destinations across a verified doctor and unverified nurse, four provisional saves/hard reloads, logout, other-author denial, zero JavaScript errors and no horizontal overflow. Resource-capped run 74885 completed in 2.6 minutes. Screenshots retained privately at `/tmp/mon-enfant-clinician-pages-desktop-passed` pending final source captures.
- Independent provisional persistence: `docs/stabilization/update5/clinician-desktop-ledger.json`. No provisional-to-trusted promotion; all four entries remain unverified.
- Applied provisional projection: `docs/stabilization/update5/provisional-section-migration.json`; live role/session denial receipt: `docs/stabilization/update5/provisional-section-http.json`.
- Light-only canonical appearance previously passed desktop and Android-sized Chromium despite saved dark preference and dark OS: `docs/stabilization/update5/light-appearance.json`.
- Feature source `87bb599` passed 13 Vercel tests, explicit TypeScript and production build in `dpl_6pAAgjhbnzQUS5YhyqsQuN9SXoFj`. Its new consultation projection is now applied with matching stored source and auth-only execution, and live HTTPS role/session checks pass; receipts: `docs/stabilization/update5/clinician-overview-{migration,http}.json`. Latest screenshots cannot establish this source's appearance.

- Tablet 9f892ef passed the two-role 16-destination/form/reload/denial technical story but **failed visual review**: selectors squeezed records/raw charts. [Tablet before](docs/stabilization/update5/tablet-before/clinician-pages.json). Layout fix 3aed79c passes 17 tests/types/build in READY preview dpl_G672gY9Df3rN2cDSEtK2YDHF4TKh; final tablet/phone renders remain pending.

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
