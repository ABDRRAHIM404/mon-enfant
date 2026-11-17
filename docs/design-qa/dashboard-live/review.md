# Live dashboard acceptance — 17 November 2026

Status: **preview acceptance passed** for the dashboard scope below. Production publication and fixture retirement are recorded separately after completion.

Exact application source: a9e483fe412d46c18840f90e6811cf7ec644b541. Preview dpl_2Bpqb6soWCP3BjgJWPAXZQjbwCBd is READY on the correct bounga / mon-enfant project. Earlier preview fe18da5 / dpl_9ysubQduuR3fmx6zGC7G8A3qrxPh established the broad live-flow baseline. Deployment protection stays enabled; exact-preview share links are temporary and will be revoked after testing.

Fresh fixture 77920eaf87e1484c has six marked synthetic actors: doctor, verified nurse, unverified/private nurse, linked parent, empty parent and unrelated approved clinician. It does not reuse retired fixtures. Passwords/tokens remain private to the cloud workspace, are never committed, and no temporary GitHub values or emails are used. Fixture-scoped DB readbacks independently corroborate the UI saves. No account metadata grants production authority; only fixture-specific professional/capability rows were provisioned, and all must be retired.

## Observed flows

- All eight sidebar destinations for four actors at 1440/820/390 CSS pixels: **96 navigation checks pass**, zero browser page errors, no page-wide overflow, light appearance under dark system preference. Raw navigation.json retains its later settings assertion failure; it is not mislabeled as an overall pass. Final preview checks cover the corrected settings and layout.
- Clinician UI child registration, consultation and growth save/reload; append-only consultation correction retains the original. Manual appointment UI creation/rescheduling retains event history. HB1 vaccine history is entered through the actual smart form as unknown-date, unmatched transcription; no automatic schedule item or appointment is manufactured.
- Parent invitation QR decoded from its rendered SVG; invitation claim remains unable to read a child before professional review. After identity/guardianship/export review, linked parent reads persist after refresh.
- Temporary share QR decoded, consented booklet share redeemed by an approved clinician without a child grant; same-session reload allowed. Ordinary clinical API remains denied. One-use replay and another session of the same recipient are denied. Parent UI revocation cuts off the existing recipient's read and reload. See sharing.json (all six checks pass).
- Author-only provisional child/consultation writes persist and remain inaccessible to other clinicians; unverified clinician access to trusted child is denied. See private-care.json. The private child was created in the earlier care run and reloaded in the final private run.
- Independent ledger: one trusted child, six immutable clinical revisions (including correction), two vaccine history entries, two manually chosen appointments/three appointment events, zero assigned schedule items, zero outside-clinician grants, one approved guardian claim/link and one author-only private child/entry. An early UI-runner wait used the wrong post-save URL, producing a second explicitly synthetic consultation save; it is retained rather than deleting audit data.

## Fixed findings

1. Parent first-profile save revalidation closed its disclosure and hid confirmation. Client-owned disclosure state now preserves the user's open/closed choice and success feedback.
2. Native form reset could show an old reminder selection immediately after a successful backend save. Parent settings/profile forms retain entered values through actions.
3. Hover feedback replaced the selected clinician item's emerald background with pale color while leaving white text. Hover feedback now excludes selected links; active contrast is retained.
4. Parent SVG growth label text scaled too small on phone/tablet. Parent plots now use legible responsive labels and one-column charts below 1100px.
5. Vaccine history was excessively tall compared with the reference. Compact native disclosure rows retain dose/date uncertainty and authorship in their summary; full source/revision details remain available on expansion.

## Visual comparison scope

Compared the eight archive parent references with real populated/empty pages, preserving the existing logo, cream background, emerald actions, light surfaces, rounded cards and coral emphasis. The parent overview adds the existing branded family illustration and truthful linked-carnet/unread/next-appointment summaries. Unsupported example percentages, medical assessments, fake patients and growth percentiles are omitted. Parent appointment writes and 30-minute QR access from the mockups are not introduced: established clinician controls and five-minute, purpose-bound sharing take precedence. Documents remains coming soon, with authorized booklet exports separate.

No source-vaccine, RLS, clinical permission, migration or clinical mutation implementation was changed. All 25 initial source rows remain draft revision 1 with an independently compared rule hash. API/browser failures caused by wrong test selectors, direct proxy configuration, or a guessed appointment UTC offset are classified as runner issues; supported Casablanca date resolution and clinical guards were retained.

The headless runner uses the cloud environment's proxy and browser certificate accommodation; this is not a claim of independent TLS certificate auditing. No real patients, mail delivery, native APK/iOS, legal/clinical approval, full security certification or broad accessibility certification is included.


Final a9e483f preview: settings validation/input retention and immediate saved values, first-profile visible success, saved vaccination/growth/appointment refresh, professional-write/admin/unrelated-child denials, four empty states, all eight parent destinations at three widths, readable plot labels (minimum measured >=10.5 CSS px), Escape focus restoration, reduced-motion mode and selected clinician hover contrast **pass**. See final.json and the final-* screenshots. Source suite: 315 tests / 40 files pass; explicit types pass; lint has zero errors and one existing type-only events warning. Vercel production compilation for the exact preview commit passed.
