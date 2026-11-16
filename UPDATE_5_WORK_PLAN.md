# Update 5 — clinician functional redesign and stabilization

Revised owner requirements: updates/MON_ENFANT_UPDATE_5_WEBSITE_STABILIZATION.md. Eight visual references in updates/new-design-update-5 were opened and inspected. They guide hierarchy, warm cream/emerald/coral colors, sidebar, dense cards and child-selection layouts; they do not authorize copied patient data, counts, diagnoses, dose dates, imports or unsupported settings. Retain the existing mother-and-child logo and icon library. Avoid decorative hero assets; existing supplied brand assets suffice.

## Current milestone

Only Espace soignant: verified doctors/nurses and author-only provisional workspaces. Parent implementation/redesign is deferred until clinician acceptance. Parent acceptance remains a future gate before APK work; iPhone stays deferred. Light only, including devices with dark preference. Full Phase 0–8 scope and external/Phase 6 approvals remain open.

1. Inventory each of the eight real destinations, backing RPC/table, permission, existing UI and missing functionality. Preserve current canonical before captures, including trusted HB1 save/reload and history inspection.
2. Build dedicated consultations, patient vaccinations/history, growth, and provisional feature views. Reuse existing writes, revision history, charts, registry, calendars and permission checks. Add a narrowly scoped provisional read projection only where the existing unfiltered booklet cannot correctly paginate a feature.
3. Apply one clinician shell in the exact requested menu order. Connect the existing register, dashboard, calendar and working account. Documents intentionally shows Bientôt disponible; provisional navigation remains explicitly restricted. Keep real exports in their existing authorized locations. Preserve other clinical tools as secondary workflow links.
4. Exercise input → save → independent persistence → reload/new session → correction → denial, including HB1 uncertainty, separate QA-reviewed permitted routine and clinician-chosen manual appointment. No HB automatic schedule/catch-up/source edits.
5. Publish and inspect each page at desktop/tablet/phone sizes, light-only, scoped search, active states and actual actions. Keep local checks bounded/sequential after GitHub quota; use Vercel for full builds. Retire all temporary accounts/secrets/QA versions.
6. Deliver UPDATE_5_PAGE_INVENTORY.md, UPDATE_5_BUG_REPORT.md and UPDATE_5_ACCEPTANCE.md with per-page functional/visual evidence and remaining gates. Synchronize primary main and ask for clinician milestone review only when concrete results are ready.

## Milestones

| Item                                                | State       | Evidence / next action                                                                                                      |
| --------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| Canonical provisional navigation/HB1 baseline       | Recorded    | 43715738089 and before captures; prior page-title fix is insufficient for revised dedicated-page contract                   |
| Trusted HB1 baseline                                | Recorded    | Fixture 5d4ec565b0864dce, actual save/export/reload and same-child inspection; feature history absent from vaccination page |
| Eight-page inventory                                | In progress | UPDATE_5_PAGE_INVENTORY.md                                                                                                  |
| Dedicated available clinician views                 | Implemented, acceptance pending | Build before decorative polish                                                                                              |
| Shared clinician shell and references               | Implemented, acceptance pending     | Preserve parent components                                                                                                  |
| Clinical lifecycle and authorization                | Scoped stories pass     | Actual UI plus database evidence                                                                                            |
| Desktop/tablet/phone visual acceptance              | Scoped captures pass     | Current canonical screenshots, bounded CSS-pixel captures                                                                   |
| Publication, retirement and primary synchronization | Pending     | Active fixture 5d4ec565b0864dce must be retired                                                                             |
| Clinician owner review                              | Pending     | Explicit owner decision                                                                                                     |
| Parent website acceptance / APK resume              | Deferred    | Separate later milestone; no implied approval                                                                               |

Current implementation evidence: canonical 94a0253 desktop 16-destination/two-role walkthrough and four provisional save/reload/independent-readback checks pass. Layout refinements follow the actual screenshot findings. See UPDATE_5_ACCEPTANCE.md; trusted write/correction/routine/appointment and final three-viewport checks remain pending. Applied consultation projection and live denial receipts are recorded in PROGRESS.md. Parent website work stays deferred.


### Verified checkpoint — 16 November

Canonical cbe7281 is READY with 17 tests/types/build. Trusted consultation/growth corrections and appointment lifecycles now pass actual UI/new-session/independent-ledger checks. QA-only reviewed routine and cross-clinician dose/grant revocation also pass with unchanged original source. Tablet 89358 passed all 16 destinations and page-by-page visual inspection; phone managed unit mon-enfant-phone-20261116.service is running. Remaining: phone results, complete action coverage report, fixture/QA retirement, final published evidence/primary synchronization and explicit clinician owner review. Keep all Phase 0–8 external/Phase 6 gates and later parent/APK gates open.

- Phone managed job completed successfully (2.7 minutes, peak 540,258,304 bytes, no memory high/max/OOM events). All 16 page captures inspected; independent private ledger passes three cases/13 quarantined revisions. Final secondary-action mapping/retirement/publication/owner gates remain open.
