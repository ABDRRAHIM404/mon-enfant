# Update 5 — current canonical reproduction and root causes

Baseline: https://mon-enfant.vercel.app, READY dpl_87RKWAU1p3WFTJM2Dhcsd18byieY, main e550071. Current-run proof: cloud 43715738089, driver 5481b23, docs/stabilization/update5/canonical-reproduction.json. All accounts/children are fictional. No owner's actual record was inspected.

## 1. Clinician navigation

The completed reproduction recorded 48 desktop and 24 Android navigation actions across verified-doctor/provisional-nurse states and light/dark themes. All reached the requested path/query; zero JavaScript errors were observed. This does **not** reproduce a general broken-router or hydration failure.

The provisional feature destination does retain the same primary “Bonjour, soignant” heading, verification panel, metrics and child cards. Only the selected sidebar state and a short chooser instruction change. The child card still says “Dossier privé”, even when selecting a particular feature. That weak feedback explains the reported impression of unresponsive navigation; it is a presentation/discoverability defect, not evidence that permissions should be relaxed. Screenshot 02 shows the completed Vaccinations destination with the unchanged dashboard heading. On Android the full sidebar disappears and the four bottom shortcuts omit vaccinations, growth and consultations (04). Logout remains available through the visible account link; the first harness incorrectly expected the desktop logout button on mobile.

Source correction in progress: explicit per-feature titles/child actions, navigation pending feedback, a complete accessible mobile disclosure menu, and nonclickable provisional Documents with an honest unavailable label. Original route/session guards remain unchanged. Post-fix canonical acceptance is still pending.

## 2. HB1 history and next vaccination

In both desktop and Android, a provisional nurse selected HB/HB1 from the current draft vocabulary, saved an uncertain paper-history entry, reloaded and found HB1 still present. Independent hosted readback proves the historical revisions remain unverified and no trusted child/routine item is manufactured. This is not evidence of a failed save.

The current page resets to the consultation input and places the actual saved history below that large empty form. The history uses raw keys such as `dose_label`/`catalog_status`. It gives no HB1-specific explanation or obvious manual follow-up path (03). The initial source remains an unreviewed draft; provisional history cannot populate an approved routine calendar, and HB1 automatic scheduling remains intentionally disabled. The correct correction is to show saved history prominently and explain those boundaries, never to invent a next-dose date.

Source correction in progress: history before the new-entry form, readable field labels, explicit unverified/next-reference distinction and HB1 manual-follow-up explanation/links. Original text, provenance, immutable revisions and quarantine are preserved. Trusted-clinician HB1, a separate QA-reviewed routine reference and actual manual appointment lifecycle remain to be exercised before their acceptance.

## Numbered captured steps

1. Verified dashboard — functional route navigation observed; broader data lifecycle pending. [Capture](docs/stabilization/update5/before/01-verified-dashboard.png).
2. Provisional vaccination destination — routing passes; feature identity/feedback fails usability. [Capture](docs/stabilization/update5/before/02-provisional-vaccination.png).
3. HB1 after save/hard reload — persistence passes; history prominence/French labels/next-state explanation fail usability. [Capture](docs/stabilization/update5/before/03-HB1-history-below-form.png).
4. Android provisional dashboard — visible shortcuts work; full feature discoverability is insufficient. [Capture](docs/stabilization/update5/before/04-mobile-limited-navigation.png).

Screenshots support these scoped findings, not full accessibility or production readiness. Mouse, touch, keyboard, destination state and independent data readback supplement them. Parent/admin/all-feature acceptance and external email delivery remain open in UPDATE_5_WORK_PLAN.md.

## Revised clinician design inspection

The canonical 94a0253 desktop capture showed seven summary cards in one row and another two below; this pushed the daily tasks down and made the dashboard harder to scan than the supplied tableau reference. Selected-child feature search occupied a separate full-width panel, while reference controls preceded the saved vaccine ledger. The next feature revision reduces dashboard summaries to four, adds a real grant-scoped recent-consultation list, places saved vaccination history first, and folds child search into a desktop selector/compact phone disclosure. Source and cloud checks establish implementation only; final visual acceptance remains pending.

The new recent-consultation read passed three focused cloud security tests plus live anonymous/verified/admin/unverified/signed-out HTTP checks. It excludes private provisional records and reflects latest immutable corrections under current explicit grants. The remaining trusted clinical lifecycle and three-viewport review are still open in UPDATE_5_ACCEPTANCE.md.

The first actual refined vaccination capture at canonical 417fcea exposed an unstyled child-selector search input (border invisible under the reset). This was introduced by the new picker, not an authentication or saved-data failure. Source now adds explicit border, background, touch size and focus styling plus browser computed-style/size assertions. Deployment and rendered confirmation remain pending; do not mark the visual defect closed from source alone.

## Provisional correction reason collision — reproduced, fix pending deployment

Actual canonical form inspection (804ab4f, run 78044) confirms both clinical consultation reason and correction reason were submitted under `reason`. FormData therefore selected the clinical reason for amendment metadata. The diagnostic did not save anything. New source separates `correction_reason`, rejects absent/ambiguous amendment inputs before writing, and keeps new-entry amendment metadata null. Four transport/integrity tests pass; actual saved correction and independent immutable-row readback remain pending. Original rows are never rewritten.

The selector styling issue is closed at canonical 804ab4f: desktop browser assertions and inspected vaccination capture confirm a visible border, 46 px input and focus rules; responsive acceptance remains open. Durable desktop captures and proof: docs/stabilization/update5/desktop-804ab4f.

Correction reason collision is **closed technically at canonical 9f892ef**: actual correction survives reload and a fresh session; independent SQL proves separate clinical/amendment values and unchanged original row hash, with both revisions still quarantined. Receipts: docs/stabilization/update5/provisional-correction-{after,ledger-after}.json.

Tablet navigation/persistence passes, but screenshot review found an important presentation defect: fixed sidebar + child selector leave too little width for records and raw growth plots. This remains **open visually**. Source stacks the selector/care column at tablet widths and lets graph cards wrap by available width, using the existing compact child chooser. Before proof: docs/stabilization/update5/tablet-before. Final tablet/phone renders are required before closure.

## Authorized calendar primary action contrast

A fully habilitated clinician's actual calendar capture revealed “Nouveau rendez-vous” rendered white on the white tab surface. The link/action existed; the shared tab background overrode its primary background. Source now restores clinician-only primary-tab background/hover/white-text contrast. Before: docs/stabilization/update5/trusted-care-5879b92/calendar-button-before.png. Rendered closure is pending. Appointment reschedule/cancel/past-visit actions saved successfully; a failed global-alert assertion matched the framework route announcer, so no application form-reset bug or patch is claimed.


## Current rendered closures — 16 November

- **Calendar action contrast: closed technically**, canonical cbe7281. Actual focused runtime 28203 and `trusted-care-5879b92/trusted-appointments.json` prove green background/white foreground and working day/week/month controls. No speculative form-reset patch was made.
- **Tablet squeezed care/charts: closed at the tested 768px tablet viewport**, canonical cbe7281. Run 89358 passed all 16 verified/private destinations; actual page-by-page capture review shows the compact chooser above a wide care column and a readable private growth plot. See `tablet-cbe7281`. The separately tested phone-width run also passes (phone-cbe7281); this is not a universal viewport claim.
- **Remaining acceptance gaps, not invented application defects:** full secondary-action evidence mapping, QA fixture/clone retirement, final publication/synchronization and explicit clinician owner review. External/source/mail gates remain open.


## Growth axis label scale — rendered finding, fix pending

Actual below-fold chart captures in clinician-actions confirm that the 520-unit SVG scales 11-unit axis/date labels down to roughly 6–7 CSS pixels on the phone. Data and chart width are correct, but those labels are too small. Scoped clinician-only tablet/phone CSS increases SVG text size; the browser now checks effective screen font size, not merely SVG width. Existing before captures are retained. Deployment/rendered recheck remains required; parent/shared-view chart appearance is unchanged.


Growth label defect is **closed at the tested canonical viewports**: a906611 / READY dpl_J2UARxk8CHKVqBVuzsh2HJBUN1oM passes actual rendered axis/date label size ≥10.5 CSS px, chart width ≥280px, summary/export and revoked-export denial. Inspected enlarged tablet/phone captures against retained before images in clinician-actions and clinician-actions-after. Source/data/calculations and parent appearance are unchanged. No known critical/high clinician defect remains from the reported navigation/HB1/layout issues; owner approved the clinician milestone on 16 November 2026, and this does not imply exhaustive every-input/native acceptance.
