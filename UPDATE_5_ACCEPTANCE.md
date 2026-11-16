# Update 5 clinician acceptance — owner review pending

Current application source **a9066114730060668d5eddacf0dcea6cb4e92f48**, canonical **https://mon-enfant.vercel.app**, READY **dpl_J2UARxk8CHKVqBVuzsh2HJBUN1oM**. Preview and production logs prove **17 focused tests / four files, explicit TypeScript and production build**. Later evidence-only commits do not change this application source.

This is software acceptance of the named clinician journeys and tested viewports, not owner approval, qualified clinical/source approval or approval to resume APK work. Parent website acceptance is a later separate milestone; iOS remains deferred.

## Eight-page result

| Section | Primary journey | Evidence under docs/stabilization/update5 | Status / limits |
| --- | --- | --- | --- |
| Tableau de bord | Four actual scoped summaries, real latest corrected consultation link, current state/navigation/reload | desktop-804ab4f; tablet-cbe7281; phone-cbe7281; trusted-care-5879b92/trusted-consultation.json | Pass for exercised scope; no fabricated tasks/statistics |
| Enfants | Private creation/search across viewports; existing-child explicit request/approval keeps the same universal ID | responsive-private-ledger.json; routine/independent-ledger.json; three viewport page-2 captures | Pass for exercised scope; duplicate-review behavior remains preserved from accepted Update 1, no automatic merge/promotion |
| Consultations | Trusted and private save/reload, immutable correction, fresh session, other-author/current-grant denial | trusted-care-5879b92; provisional-correction-{after,ledger-after}.json | Pass; original clinical reason and correction audit reason stay separate |
| Vaccinations | Uncertain HB1 ledger, QA independently reviewed eligible reference, manual follow-up, second clinician dose, revoked live-session denial | routine/; clinician-actions-after | Pass software story; original source remains unapproved draft; genuine source/clinical review open |
| Rendez-vous | Manual plan/reschedule/cancel, genuine future-missed denial, past missed/completed, day/week/month, independent consultation unaffected by dose | trusted-care-5879b92/trusted-appointments.json; routine/independent-ledger.json | Pass; four manual appointments/eight retained events; dose documentation does not manufacture attendance |
| Croissance | Saved raw observations and linked correction, width ≥280px and rendered labels ≥10.5 CSS px on selected devices | trusted-care-5879b92; clinician-actions-after | Pass; three below-fold chart captures inspected; no percentile/diagnosis invented |
| Documents | Approved coming-soon state, explicitly disabled private nav, working register link, preserved authorized summary/export and revoked B export 404 | clinician-actions-after; tablet/phone page-7 captures | Pass intentional exception; no fabricated management controls |
| Mon compte soignant | Actual profession/identity/status, capability-history/recovery-entry links, logout/current-session denial | clinician-actions-after; tablet/phone page-8 captures | Pass named actions; recovery test submits no email; professional evidence review remains a real external process |

## Responsive and integrity evidence

- Desktop: 16 two-role menu destinations, visible selector controls, reload and session/other-author denial; later populated clinical/calendar stories supplement the initial screenshots.
- Final tablet: run **89358**, 16 destinations/two roles, zero JS errors/overflow; all 16 initial-viewport captures inspected. Peak **570,859,520 bytes**, memory high/max/OOM 0.
- Final phone: managed **mon-enfant-phone-20261116.service**, 16 destinations/two roles/four real private writes and reloads, actual tap/compact selector, zero JS errors/overflow; all 16 captures inspected. Peak **540,258,304 bytes**, high/max/OOM 0. Two earlier interrupted attempts are retained as incomplete, not passes.
- Final chart/account/export: **mon-enfant-chart-final-20261116.service**, 56.4 seconds, actual canonical a906611, all three chart viewports and account/export/denial assertions pass. Peak **445,251,584 bytes**, high/max/OOM 0; inspected before/after tablet/phone plots.
- Independent responsive private ledger: three synthetic children / 13 unverified immutable revisions, exact raw 12.4 kg/88 cm and clinician-chosen dates, zero trusted children/grants/capabilities for the private nurse. No provisional promotion.
- Independent trusted/routine ledgers: consultation/growth originals and linked corrections retained; original uncertain HB1 untouched, second author attributed, one QA VPO1 reference, four appointments/eight events, current grants enforced. Original 25-rule source hash **cb838450d0f2066fa5d914971f9bd8a7** unchanged. Both applied read migrations remain immutable.
- Light-only behavior ignores saved/system dark preference. No new native binary or hardware acceptance is claimed.

See the [eight-page visual review](docs/design-qa/update5-clinician-review.md), [route/data inventory](UPDATE_5_PAGE_INVENTORY.md), [bug report](UPDATE_5_BUG_REPORT.md) and complete [progress evidence](PROGRESS.md). Captures use fictional patients only. The legacy secondary tools/forms retain their existing navigation; these results do not claim exhaustive coverage of every possible input or physical device.

## Remaining gates

- Fixture/QA retirement: **Pass**, independently verified in `docs/stabilization/update5/fixture-retirement.json`: four banned/suspended actors; zero sessions/active grants/capabilities/staff/practices/pending requests; QA clone retired at revision 3, original draft/rule hash unchanged; eight temporary values and private state/credential files removed. Never prepare run 5d4ec565b0864dce again.
- Application publication and primary synchronization: **Pass at a906611**, clean main equals origin/main after private backup. The final evidence-only release retains this tested application source; its exact HEAD/deployment are verified separately before handoff.
- **Owner review/approval of this concrete clinician milestone remains pending.**
- Parent redesign/acceptance and any APK resume remain later separate gates. Actual invitation/approval/follow-up email delivery, qualified clinical/source, legal/hosting/guardian approvals and remaining Phase 6 operational readiness stay open in the complete Phase 0–8 plan.
