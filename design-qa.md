# Croissance design comparison · 23 November 2026

Final result: passed for the redesigned Croissance content.

Compared the supplied desktop and phone references with Chromium captures at 1440, 820, 390, and 320 CSS pixels using fictional records. The page shows the desktop selector beside the child, form and chart, with a compact selector and stacked cards on mobile. The existing clinician navigation appears around both layouts. The first capture showed plot overflow, an English date placeholder, and excessive padding on phone history rows. Scoped CSS fixed the chart sizing and table density, and the measurement input now displays JJ/MM/AAAA. The final browser run checked plot bounds and horizontal overflow on all four widths.

The isolated browser workflow exercised the existing PostgreSQL rules through the clinical action, including empty/single/multiple points, save and reload, all three measurement types, child selection, unknown-date provenance, denied child access, and correction with its original revision preserved. The source references contain example measurements. Browser checks used distinct fictional values and no hosted records.

---

# Update 3 design comparison

Final result: passed

Current accepted scope: implemented parent overview, provisional clinician dashboard, selected-child vaccination read/history layout, public/Auth screens and shared themes. This is a partial Update 3 UI checkpoint. The actual purpose-bound sharing QR/control remains unimplemented and explicitly excluded from this acceptance; the full Update 3 requirement stays open in PLAN_CHECKLIST.md and PARENT_SHARING_CONTRACT.md. The existing access-management link does not substitute for that feature.

Source visual truth: updates/Mon_Enfant_Design_Update_3_Fresh_Copy/mockups/{web,mobile}/{light,dark}/*.png.
Implementation: GitHub cloud production runtime, final public source 48ba0de, Actions 43642889015. Final private captures: ~/.local/state/mon-enfant/design-qa/43642889015/synthetic-live-evidence-results/live/design-capture-configured--54a69--paired-selected-references-desktop/. Earlier iterations remain privately retained under run IDs 43639674164 / 43642141713. Classified proof: docs/design-qa/update3-public-proof.json.

Desktop reference/implementation 1440×900 pixels, CSS viewport 1440×900. Mobile reference/implementation 430×940 pixels, CSS viewport 430×940. Browser captures use CSS scale and comparison context DPR 1; no browser chrome or device frames. Paired images place both originals at identical size with a 40px identifying strip.

## Initial comparison and fixes

- P1: clinician signup omitted the supplied full-name field. Seen directly in design-pair-web-light-clinician_register.png. Added bounded self-declared display name in Supabase Auth metadata; this never verifies identity, enrolls a professional or grants access.
- P2: signup content sat too low, with redundant navigation and explanation, changing card proportions. Same paired evidence. Removed the redundant return link (header still navigates home), centered the aside, restored card padding and consolidated explanations while retaining real email-confirmation/private-record requirements.
- P2: missing persistent mobile parent navigation. Seen directly in design-pair-mobile-light-landing.png. Added real home/children/appointments/documents destinations. The latter two select among the current guardian's authorized children and retain existing RPC authorization and conditional export. Anonymous requests still require login.
- P2: mobile primary actions and illustration caption height drift. Same paired evidence. Reduced action height and caption line-height/size toward the supplied dimensions.

The initial paired full views show readable form labels and headings; no focused raster manipulation was necessary for these issues. Revised screenshots and direct comparison are required before acceptance. Initial isolated capture run 43641622914 built successfully but did not start the test TLS runtime (ERR_CONNECTION_REFUSED); fixed the shared cloud-runtime mode predicate in 6b4e0fe and dispatched revised capture run 43641895469. Run 43641895469 then reached the runtime but the TLS script still restricted the old mode. Extended its explicit cloud-only allowlist in 5a608c3; non-GitHub execution remains denied. These harness failures are not design evidence. Revised configured capture run 43642141713 passed and paired images were opened. Missing name/mobile navigation issues were resolved. A second P2 finding remained: inherited input margins/line heights and duplicate parent-role navigation made authentication cards too tall. Scoped public input height to 50px, normalized label/heading/copy rhythm, removed redundant clinician footer on parent pages, and restored left-aligned aside text. Clinical form sizing is untouched. Second post-fix capture 43642889015 passed and was directly compared in paired images: web light clinician signup, web dark parent/clinician login, mobile light landing/login, mobile dark clinician signup and web light landing. Field rhythm/heading alignment now follows the source, the name field and persistent mobile destinations are present, and the actionable public P1/P2 findings are resolved. Remaining height comes from explicit utility links, 44px accessible touch targets and the mandatory synthetic-environment notice; these are intentional product constraints.

## Required fidelity surfaces

- Typography: supplied rendering uses Arial fallback, matched by existing app. Public heading sizes are 52 desktop / 33 mobile; authentication 37 / 34. Signup heading/aside copy corrected; legitimate Auth confirmation copy differs intentionally.
- Spacing: shared header/grid/card structure and original image crops present. Post-fix paired evidence resolves the material form/navigation drift. Small remaining action/caption offsets are P3; the additional theme control, utility links and synthetic notice are intentional.
- Colors: cream/emerald/coral and separate dark surfaces implemented. Muted light text adjusted from supplied #647A71 (4.33 contrast on cream) to #5D7268 (4.85); this is intentional accessibility preservation.
- Assets: original supplied raster emblems and family illustration used directly. Existing Lucide icons replace generic source emojis. Original raster logo is not a production vector master; final vector/adaptive icon work remains open.
- Copy: parent-first routes and clinician distinction preserved. No illustrative vaccine percentages, appointments, people or medical facts copied. Synthetic-only notices remain intentionally.

## Interactions and verification

Source 0286f7d passed all build/data checks and 28 browser tests in 43641612275; the two legacy focus selectors referenced the removed return link and were updated in 1b814ab to actual header/form links, both themes. Replacement standard CI 43642377490 passed all build/data checks and all 30 standard browser cases; final density source 48ba0de also passed the complete suite in 43642867793. Final configured capture 43642889015 reports sixteen screens, sixteen paired comparisons and zero page errors. Source 713f4b3 passed standard CI 43639099407 and combined authenticated/cloud visual run 43639674164: both themes, persistence, public accessibility and mobile menu; configured public captures had no page errors. Both remembered and session-only Secure HTTP-only cookies passed the authenticated story on three viewports. The synthetic nurse's final database state independently read back 21 private revisions, one explicit trusted test child and suspended account; this is readback evidence, not a replacement assertion of unavailable native stdout. Four fixture accounts and nine temporary values from 07e082b6e45f4e2b were retired with verified zero active grants/sessions/capabilities.

## Implementation checklist

- Completed revised public captures using credential-free design-cloud-accept in GitHub Actions; no local browser/build or repeated account provisioning.
- Completed direct paired review and retained every iteration. No actionable public P0/P1/P2 differences remain.
- Published the verified public checkpoint on canonical Vercel (READY dpl_3U36g4ViF3NS4mhCtsEF7wuvmJBP, main source 6b0e2a9); primary main synchronized. Live health/new public markers and anonymous export denial pass.
- Complete protected screens and actual purpose-bound parent sharing before marking Update 3 complete.


## Follow-up polish and limits

P3: minute icon/letter-weight/action offsets, final vector/adaptive icon master and tighter decorative crop alignment may be refined later. The supplied family illustration is byte-identical in public/brand/family.png and the original reference asset; real branding was not recreated with CSS/SVG. Empty login fields intentionally show the real password-length guidance instead of the mock's decorative masked placeholder. The app retains real email-confirmation copy, larger touch targets, additional utility navigation and a development/synthetic-data notice.

The visual harness measures page errors, overflow and successful image decoding; it does not claim a comprehensive console/network diagnostic capture. Further minor diagnostics are deferred under the owner's build-first priority. Existing major Auth/data/integrity and accessibility checks passed. This result applies only to the four public routes and shared theme foundation; it does not accept protected dashboard/vaccination layouts, a new sharing authorization flow or Phase 8.


## Protected iteration — current blocker

Source truth: mockups/web/light/{parent,clinician,vaccination}.png and their mobile/dark counterparts. Opened and inspected the three desktop light targets before implementation. The new shell follows the 76px header, 235px sidebar, 34px/42px content padding, rounded real-data cards, coral attention and emerald actions. Original example counts, people and 73% vaccination coverage are not implementation data. Rendered paired evidence was captured against hosted Supabase in cloud 43646708223, then after the one grid correction in 43647899263. Source CI 43646114379 passed all 242 cases/build/standard browsers. Each authenticated cloud story passed on desktop/tablet/phone with zero page errors; 12 protected pairs cover both themes and target web/mobile viewports. Native c833b127ec5544c0 proves persisted data, immutable revisions/conflicts, role/capability isolation and source preservation; all test accounts/temporary values from both runs are retired.


Protected first paired review: cloud run 43646708223 captured twelve protected pairs at identical 1440×900 / 430×940 CSS sizes, both themes, with actual synthetic records. Opened web light parent/clinician/vaccination and mobile dark parent pairs. The major desktop regions, shared typography/palette/real emblem and standard icons match the selected system. Long synthetic identifiers, actual counts (not the mock examples), explicit uncertainty/no coverage percentage, real private status and the still-open sharing feature are intentional state/product differences. P2: mobile parent overview incorrectly stacked its next-appointment/reminder cards instead of the source's two columns, materially changing above-fold density. Restore the mobile two-column overview and capture the changed view before accepting the protected scope. All smaller spacing/icon variations remain P3; do not create a polish campaign.


## Protected post-fix result and fidelity surfaces

Final protected capture path: ~/.local/state/mon-enfant/design-qa/43647899263/synthetic-live-evidence-results/live/updates-requested-duplicat-9335e-preserve-private-boundaries-{desktop,mobile}/design-protected-pair-*.png. Source and actual frames are 1440×900 desktop / 430×940 mobile CSS pixels; screenshots use CSS scale and each comparison context DPR 1. The identifying strip adds 40px outside the compared frames. No device frame/browser chrome is included.

Opened the post-fix mobile light/dark parent pairs and web dark clinician pair directly. The P2 mobile overview issue is resolved: next appointment/notifications use the source's two columns. The earlier pairs also directly cover web light parent/clinician/vaccination, web dark parent and mobile light clinician/vaccination. Whole-frame text and controls are readable in the paired originals; separate focused raster editing/crops were not needed. Real synthetic long names and exact birth dates differ from the mock's short names/ages; rows and headings wrap rather than truncating medical identity. Private dossier counts differ across viewport test stages, and observed counts are never replaced by mock examples. These content/state differences prevent a pixel-identical comparison and are intentional, not a claim of identical above-fold density.

- Typography: same Arial fallback as the reference renderer; 42px/34px primary headings, 27px/23px section headings, bold 18px record titles. Smaller captions and extra privacy precision are accepted P3/functional differences.
- Spacing/layout: 76px header, 235px desktop sidebar, 34px/42px content padding, rounded white/dark cards, mobile two-column records/statistics/overview and responsive vaccine columns. Extra privacy/source explanations, real long identifiers and 44px touch controls intentionally extend content. No horizontal overflow or page errors in the capture assertions.
- Colors/tokens: shared cream/emerald/coral and dark tokens retain public acceptance and its AA muted-text correction. Attention denotes private/unverified information or genuine unread activity, not invented overdue vaccines.
- Assets: the supplied unchanged mother-child emblems remain real PNG images. Standard library icons replace source emoji; no replacement logo/div/SVG art or invented patient photography. Final vector/adaptive-icon approval remains open.
- Copy/content: actual guardian children, appointments, notifications, current author-only revisions and uncertain/unassigned vaccination history are shown. No 73% coverage, example administrations, fake next dose or inferred healthy/missed status. Explicit private/quarantine and source-review facts remain visible.

Read-layout scope passes with no remaining actionable visual P0/P1/P2 issue in the implemented controls. The functional sharing action itself is still a required next build item, not accepted by this result. Keep P3 icon/spacing/caption refinements and broader diagnostics deferred under the owner's build-first priority.


Protected checkpoint is canonically published in READY Vercel dpl_CR1C1asRvsdoFXTMz3THgtJTjaP2, main source 0e0b66d. Live health and anonymous parent/provisional/vaccination/export denial pass. Authenticated browser/paired evidence uses the hosted-Supabase GitHub production runtime noted above; no additional canonical authenticated campaign is claimed. Primary main is synchronized; full Update 3 sharing, Phase 8 and external approvals remain open.


## Functional sharing extension — 15 November 2026

Cloud 43664056898 passed the genuine QR/image scan, fragment-only entry, other-tab login, read-only scopes, concurrent claim and revocation stories on desktop/tablet/mobile with zero overflow/page errors. Captures are privately retained at ~/.local/state/mon-enfant/design-qa/43664056898/synthetic-live-evidence-results/live/sharing-parent-purpose-bou-e728e-urrent-claim-and-revocation-{desktop,tablet,mobile}/sharing-*.png. Desktop is 1440×900 CSS pixels; mobile 430×940 with its device DPR. Full-page captures include fixed navigation and, on the retired parent page, a retained keyboard-focus skip link. They are evidence of the actual functional state, not another identical-state pixel comparison. No active bearer QR/link is saved; the rendered QR is decoded in memory during the actual journey.

Directly inspected desktop/mobile retired parent consent/scope/status controls, desktop vaccination reader and mobile booklet reader. The established brand/layout and selected source acceptance above are retained. The new read-only view has no matching supplied screen, so its purpose/countdown/consent/uncertainty/authorship and existing clinical cards are intentional functional additions. Real long synthetic IDs wrap, missing measurements and draft references remain explicit, and no percentage or clinical fact is invented. No new actionable P0/P1/P2 sharing layout finding; smaller presentation refinements and hardware-camera walkthroughs remain deferred. This does not claim a new 16-screen/theme paired campaign. All three synthetic browser proofs and independent native API proof passed and all fixtures were retired; see docs/design-qa/update3-sharing-proof.json. Canonical release verification follows in PROGRESS.md.


## 17 November — parent dashboard integration

Current result: **blocked** for full acceptance. See [the scoped review](docs/design-qa/parent-integration/review.md) and [integration report](DASHBOARD_INTEGRATION.md). Prior accepted evidence above is preserved. Eighteen static empty-state layout checks pass; populated/live/hydrated verification is pending.


## 17 November — live dashboard follow-up

final result: passed (scoped dashboard review)

Correct-project preview a9e483f is READY and live checks now pass. See [live acceptance and final captures](docs/design-qa/dashboard-live/review.md). The earlier blocked/static-only checkpoint remains historical. Full external clinical/privacy approval and broad accessibility certification are separate. Production publication and synthetic fixture retirement are recorded in PROGRESS.md.

## 18 November — final dashboard interaction review

This is the current closeout review; earlier sections describe historical iterations.

**Source and implementation evidence.** Source truth is the eight parent images from the clean upload (`updates/new-design-update-5/parent` in the retained source archive) and the eight clinician images under `updates/new-design-update-5`. Full-view combined inputs are `docs/design-qa/dashboard-closeout/compare-parent-{0..7}.jpg`, `compare-clinician-{0..7}.jpg` and `current-compare-{0..7}.jpg`. Both sides were opened together for review. Current captures `current-parent-{0..7}.png` use the preview at 1672×941 CSS pixels, deviceScaleFactor 1. Parent sources are 1671/1672×941 image pixels; a 1px width normalization was used for the two 1671px sources. Combined boards display both sides at 50% scale; original captures retain readable detail. Previous populated captures are 1440px CSS width and normalized for directional comparison, not precise pixel measurements. Clinician captures are retained accepted evidence, not newly authenticated clinician sessions.

**State.** Fresh browser captures show one actual unlinked synthetic parent and its own profile/preferences. The source's illustrative linked patients, dates and assessments are not the same data state. Populated visual evidence remains in dashboard-live and stabilization/update5. Documents is intentionally unavailable. No fake coverage, normal-growth assessment, public search, appointment write authority or 30-minute share was added to reproduce illustrative content.

**Findings and comparison history.**

- [P1, fixed] Interrupted parent profile/settings saves lost input through the application error boundary. Before: `before-form-interactions.json`, `before-settings-interrupted.png`. Fix: recoverable action responses keep the form mounted, show an unconfirmed-save message and do not replay writes. After: `settings-interrupted.png`, `form-interactions.json`; seven actual authenticated scenarios pass, including a committed HTTP 200 response dropped at Chromium's response stage and persisted-state reload. Server validation and Next session/access navigation remain distinct.
- [P1, fixed] Child section links had overlapping whole-card pseudo-elements; pointer centers for Vaccinations, Croissance and Rendez-vous selected Partage & accès. Before: `before-child-targets.json`, readable populated `compare-parent-1.jpg` and `child-links-before-crop.png`. Fix: scoped relative link targets above the card overlay, pseudo-element disabled, flex spacing and 44px minimum height. After: `child-actions-{1440,820,390}.png`, `child-links-after-crop.png` and center/edge hit results in `navigation-motion.json`. These are actual SSR-component/deployed-CSS fixture checks, not a second claim of backend guardianship acceptance.
- No further actionable interaction P0/P1/P2 was found in this closeout. The source remains visual guidance, not an exact replica acceptance: artwork, child-card arrangements, header density and existing account flows differ. Those differences are recorded rather than hidden behind an image-match score.

**Required fidelity surfaces.**

- Typography: existing site font, fallback and semantic heading hierarchy retained; actual names wrap. Native labels/error text stay readable in full-size captures. Navigation focus has no delayed transition. Mockup typography is reference guidance; an exact font match is not claimed.
- Spacing/layout: shared cream canvas, sidebar, rounded white surfaces, section hierarchy and responsive shell retained. Fixed child-link spacing and overlap; 1440/820/390px hit targets have no horizontal overflow. The child fixture isolates card content; it is not a same-state full-page screenshot of the source's two illustrative children.
- Color/tokens: existing cream/emerald/coral system, original logo and light-only behavior preserved, including dark system preference. Selected navigation contrast from the earlier dashboard fixes is retained. No clinical color assessment is invented.
- Assets: actual existing logo and branded family raster retained at natural proportions. Standard Lucide interface icons remain. Decorative illustrations and fabricated patient portraits in the mockups are not reproduced; this limits literal image fidelity. No replacement brand mark, CSS illustration or fake patient photograph was generated.
- Copy/content: all eight destination names and available actions match their roles; no-child and coming-soon states are explicit. Real authorized information, source/uncertainty labels, separate guardian approval and current five-minute purpose-bound sharing take priority over example copy. Notification preferences continue to disclose that application follow-up email is unavailable.

**Focused evidence.** Full-size `settings-interrupted.png` verifies retained value, uncertainty copy and enabled retry control; `child-actions-390.png` verifies wrapping and separated targets. Raw full-size screenshots supplement the normalized boards where small labels cannot be judged. Content regions are compared separately from browser/device chrome. Previous compact vaccine history/hover/chart-label fixes remain documented in dashboard-live/review.md.

**Interaction verification.** `navigation-motion.json` covers delayed progress (opacity 0 before 300ms, 1 after), last-navigation-wins under an interrupted older request, instant keyboard focus, reduced-motion animation suppression, touch menu Escape/focus return and close-on-navigation, phone overflow and separate child targets. `form-interactions.json` covers pending/busy/disabled/no-optimistic-success, invalid data, interrupted request, HTTP 503, lost successful response, value retention and persisted reload. Both reports have zero unexpected browser exceptions. Expected injected transport failures are classified test stimuli. Prior role/clinical/QR acceptance remains separate and is not repeated as fresh evidence.

**Implementation checklist.** Both reproduced defects fixed; 27 targeted tests, targeted lint, explicit types and exact-preview Vercel production build pass. Canonical publication and fixture retirement are recorded in the latest PROGRESS.md and closeout reports. No further artwork redesign, application-mail implementation or native work is included.

**Follow-up polish and limits.** Literal decorative-artwork/font/card-layout parity with the mockups is not claimed. Broader accessibility certification and external clinical/privacy/operations approvals remain outside this scoped review. This passing result covers the functional dashboard integration and documented reference-guided visual scope, not a pixel-identical clone.

Canonical closeout: application 6b6f215 / deployment dpl_2MWuubdsABzcoDTAxi4pgjdR35cG is READY and the canonical alias is verified. `canonical-form-interactions.json` and `canonical-navigation-motion.json` pass; the latter checks reduced motion during the actual pending spinner and Tab traversal through the sidebar. The synthetic account is retired, login denial passes and preview access is revoked. Final owner-facing results: [DASHBOARD_HANDOFF.md](DASHBOARD_HANDOFF.md).

final result: passed

## 18 November — dashboard visual/loading/cache redesign

Latest scoped review: [dashboard-ui/review.md](docs/design-qa/dashboard-ui/review.md). Both source/current boards were opened; mint banners/art, parent metrics/rows, compact vaccine history and month/list calendar are implemented. All 65 page routes and query navigation have useful skeletons. 336 tests, 48 final-source visual checks and five live loading/cache/privacy cases pass. Public/static cache only; private records retain current access checks. Production and fixture retirement are recorded after publication.

final result: passed (preview scope)

Canonical UI/loading/cache publication: PR #4 / 168b0f4, READY dpl_4FvjCGbqsqdnePe5pU3wKVAHrqHS. Production reports pass, including access revocation with an existing session. Test fixture retirement remains pending explicit owner approval after automatic review rejection; it is not falsely marked complete.

final result: passed (scoped canonical UI/loading/cache); cleanup pending owner approval
