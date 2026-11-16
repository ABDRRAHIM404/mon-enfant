# Update 5 clinician review — 16 November 2026

Software evidence for the clinician milestone. Owner approval is still pending. Parent redesign/acceptance, native APK publication and iOS remain deferred. All pictured clinical records are fictional.

## Before → after and functional evidence

| Page | Before → current implementation | Actual exercised behavior and evidence |
| --- | --- | --- |
| Tableau de bord | Reused private dashboard / crowded summaries → four summaries, real recent consultations, scoped quick actions | Two-role navigation/reload, real recent corrected consultation; `trusted-care-5879b92/trusted-consultation.json`, desktop/tablet/phone page 1 |
| Enfants | Private feature reused landing cards → dedicated searchable private register; existing authorized register retained | Three private child creations across viewports, explicit existing-child request/approval with same universal ID; source/grant denial and independent `responsive-private-ledger.json`, `routine/independent-ledger.json`; page 2 |
| Consultations | No global care page → child picker, saved consultation timeline and permitted form/history | Actual trusted save/correction/fresh session, immutable previous row; private correction reason separation and independent readback; page 3 |
| Vaccinations | Menu led to catalog / saved history below reference controls → dedicated recorded history first, sources and separate reviewed references | Uncertain HB1 remains saved with no automatic schedule; independently reviewed QA VPO1 reference, second clinician’s observed dose, same live-session grant revocation, original source hash unchanged; `routine/`; page 4 |
| Rendez-vous | Existing calendar disconnected from private care → real day/week/month calendar and private follow-up view | Manual plan/reschedule/cancel, genuine future-missed denial, past missed/completed, original events preserved; linked dose resolves follow-up without claiming attendance, independent visit unchanged; `trusted-care-5879b92/trusted-appointments.json`, `routine/`; page 5 |
| Croissance | No global page / squeezed tablet chart column → child picker, saved measurements/history and responsive raw charts | Trusted/private save, immutable correction and fresh session; actual 89.5 cm/12.7 kg vs retained original; plots ≥280px on selected devices; `clinician-actions/` below-fold chart captures; page 6. Axis-label fix passes canonical recheck in clinician-actions-after |
| Documents | No dedicated management page → approved “Bientôt disponible” screen | No fake upload/download controls; private nav explicitly disabled, real register link works; existing authorized summary/export contains six clinical revisions, one reference and four appointments; revoked B receives 404; `clinician-actions/`; page 7 |
| Mon compte soignant | Existing working account → shared shell with actual identity/profession/status | Verified vs unverified shown truthfully; capability-history and recovery-entry links work, logout/current-session guard works; no email sent by acceptance; `clinician-actions/`; page 8 |

Evidence paths above are under [stabilization/update5](../stabilization/update5). The same numbered captures (1–8) appear for A (verified doctor) and OUTSIDE (unverified nurse) in [tablet](../stabilization/update5/tablet-cbe7281/clinician-pages.json) and [phone](../stabilization/update5/phone-cbe7281/clinician-pages.json). Desktop navigation captures are in [desktop-804ab4f](../stabilization/update5/desktop-804ab4f/clinician-pages.json); later populated care captures supplement that earlier source.

## Visual comparison and practical limits

All eight supplied images in `updates/new-design-update-5` guide hierarchy, sidebar order, cream surfaces, emerald active states/actions and sparing coral information/status accents. Selected mother-and-child logo retained. Mockup patients, counts, appointment times and diagnostic growth assessments were never imported as data. Main clinical tasks take precedence over decorative hero art. No component library migration.

All 32 current tablet/phone initial-viewport captures were inspected individually. Actual below-fold trusted raw plots were also inspected at desktop/tablet/phone widths. The tablet selector now stacks above the care column; phone cards wrap and menus operate by touch. Table contents may scroll within their own container; the tested pages have no horizontal page overflow. Dark device and old saved preferences remain light.

These checks prove the named journeys and chosen viewports, not every possible state or physical-device behavior. Legacy secondary tools/forms keep their existing navigation; the eight primary clinician pages share the new shell. The original source still requires qualified clinical review; a QA-approved clone is never genuine PNI approval. Email delivery, legal/hosting/guardian approvals and remaining Phase 6 operational gates remain open in the full project plan.

## Final gates

- **Pass:** canonical a906611 / READY dpl_J2UARxk8CHKVqBVuzsh2HJBUN1oM; 17 cloud tests/types/build and actual three-viewport effective label size ≥10.5 CSS px. See clinician-actions-after.
- **Pass:** fixture 5d4ec565b0864dce RETIRED, four banned/suspended actors, no sessions/active grants/capabilities/staff/practices/pending requests; eight temporary values and private credential/state files removed. QA clone retired revision 3; original draft revision 1 and 25-rule hash unchanged. See fixture-retirement.json.
- **Pass:** application publication/clean primary synchronization verified at a906611; evidence-only handoff preserves this source. **Pending:** explicit clinician owner review. Parent acceptance is a later separate requirement before any APK resume.
