# Update 3 design comparison

Final result: blocked

Scope: public landing, parent login, clinician login and clinician signup. Protected dashboards, vaccinations and parent sharing QR remain separate open implementation items in UPDATE_3_IMPLEMENTATION.md.

Source visual truth: updates/Mon_Enfant_Design_Update_3_Fresh_Copy/mockups/{web,mobile}/{light,dark}/*.png.
Implementation: GitHub cloud production runtime, source 713f4b3, Actions 43639674164. Private captures: ~/.local/state/mon-enfant/design-qa/43639674164/synthetic-live-evidence-results/live/design-capture-configured--54a69--paired-selected-references-desktop/.

Desktop reference/implementation 1440×900 pixels, CSS viewport 1440×900. Mobile reference/implementation 430×940 pixels, CSS viewport 430×940. Browser captures use CSS scale and comparison context DPR 1; no browser chrome or device frames. Paired images place both originals at identical size with a 40px identifying strip.

## Initial comparison and fixes

- P1: clinician signup omitted the supplied full-name field. Seen directly in design-pair-web-light-clinician_register.png. Added bounded self-declared display name in Supabase Auth metadata; this never verifies identity, enrolls a professional or grants access.
- P2: signup content sat too low, with redundant navigation and explanation, changing card proportions. Same paired evidence. Removed the redundant return link (header still navigates home), centered the aside, restored card padding and consolidated explanations while retaining real email-confirmation/private-record requirements.
- P2: missing persistent mobile parent navigation. Seen directly in design-pair-mobile-light-landing.png. Added real home/children/appointments/documents destinations. The latter two select among the current guardian's authorized children and retain existing RPC authorization and conditional export. Anonymous requests still require login.
- P2: mobile primary actions and illustration caption height drift. Same paired evidence. Reduced action height and caption line-height/size toward the supplied dimensions.

The initial paired full views show readable form labels and headings; no focused raster manipulation was necessary for these issues. Revised screenshots and direct comparison are required before acceptance.

## Required fidelity surfaces

- Typography: supplied rendering uses Arial fallback, matched by existing app. Public heading sizes are 52 desktop / 33 mobile; authentication 37 / 34. Signup heading/aside copy corrected; legitimate Auth confirmation copy differs intentionally.
- Spacing: shared header/grid/card structure and original image crops present. Above-the-fold issues listed above require post-fix evidence.
- Colors: cream/emerald/coral and separate dark surfaces implemented. Muted light text adjusted from supplied #647A71 (4.33 contrast on cream) to #5D7268 (4.85); this is intentional accessibility preservation.
- Assets: original supplied raster emblems and family illustration used directly. Existing Lucide icons replace generic source emojis. Original raster logo is not a production vector master; final vector/adaptive icon work remains open.
- Copy: parent-first routes and clinician distinction preserved. No illustrative vaccine percentages, appointments, people or medical facts copied. Synthetic-only notices remain intentionally.

## Interactions and verification

Source 713f4b3 passed standard CI 43639099407 and combined authenticated/cloud visual run 43639674164: both themes, persistence, public accessibility and mobile menu; configured public captures had no page errors. Both remembered and session-only Secure HTTP-only cookies passed the authenticated story on three viewports. The synthetic nurse's final database state independently read back 21 private revisions, one explicit trusted test child and suspended account; this is readback evidence, not a replacement assertion of unavailable native stdout. Four fixture accounts and nine temporary values from 07e082b6e45f4e2b were retired with verified zero active grants/sessions/capabilities.

## Implementation checklist

- Capture revised public screens using credential-free design-cloud-accept in GitHub Actions; no local browser/build or repeated account provisioning.
- Compare revised paired evidence for each actionable finding and record outcome.
- Publish the verified public checkpoint and synchronize primary main.
- Complete protected screens and actual purpose-bound parent sharing before marking Update 3 complete.
