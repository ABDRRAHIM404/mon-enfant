# Update 3 design comparison

Final result: passed

Scope: public landing, parent login, clinician login and clinician signup. Protected dashboards, vaccinations and parent sharing QR remain separate open implementation items in UPDATE_3_IMPLEMENTATION.md.

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
