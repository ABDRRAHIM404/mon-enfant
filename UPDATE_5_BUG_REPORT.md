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
