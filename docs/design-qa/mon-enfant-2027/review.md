# Mon Enfant 2027 design and verification

## Baseline

The public homepage and sign-in were captured on the canonical site before editing. The homepage had a clear parent entry and authentic founder story, but its hero depicted a family instead of showing the product. It had no preview of how a child’s appointments, documented care and growth would be shown together. The sign-in screen offered audience-specific entry points. Opening a protected page in the available browser reached sign-in.

The workspace source showed four family-wide counters before the parent’s child profiles, recent consultations before the clinician’s schedule, and a separate grid of admin tiles repeating the sidebar. All three desktop rails stayed full-width. The clinician patient table relied on horizontal scrolling at small widths. The shared workspaces already supported current-page announcements, pending feedback, explicit permissions and guarded writes. The new design builds on those behaviors.

The [source inventory](routes.md) lists the existing pages, guards or delegated components, and loading boundaries. Protected views are included in the source review. The before screenshots cover anonymous browser access.

## Design

- The public homepage uses self-hosted Instrument Serif, a two-column editorial hero, a fictional HTML booklet preview, a three-step walkthrough, separate audience benefits, and an explanation of QR sharing. The Belfaa founders’ photo, approved biographies and WhatsApp and email contacts carry forward. The footer links to the confidentiality explanation and contact. No approved standalone legal policy was available in the project.
- The parent workspace starts with the selected child’s active recent entries from the existing guardian-gated booklet projection. The next family appointment names the relevant child and links to that child’s calendar. An invalid or revoked selection is rejected. The eight existing sections, notification and invitation flows, corrections, exports and temporary sharing remain linked. Empty states guide families to an invitation or explain the lack of documented entries.
- The clinical workspace puts the scheduled worklist first. Clinical references requiring review have their own link and explanation. The new rail collapses on desktop and preserves toolbar and mobile destinations. The register becomes a labeled set of patient cards on phones. The existing consultation, vaccine, follow-up, appointment, growth and account paths retain their action and provenance labels. Documents shows availability and directs the user back to their registry.
- The operations console uses a compact verification queue and a separate configuration list. Review decisions and evidence use their existing server checks, along with guarded professional search, permissions and catalogue management. The shared account and catalogue skeletons remain neutral when the current workspace has yet to be resolved.
- Ocean Ink, Jade, Seafoam, Apricot, Porcelain and White are defined together. White on Jade measures 4.91:1, strong Jade on Porcelain 6.36:1, strong Jade on Seafoam 5.17:1, Ocean Ink on Seafoam 11.05:1, Ocean Ink on Apricot 7.84:1 and muted text on Porcelain 5.58:1. These are token-level checks. Clinical status still includes text and context.
- The Charles UX Animation guidance informs 160ms feedback and 200ms visual disclosure, with immediate focus, route changes and clinical data. Native menus retain their keyboard behavior. The public preview entrance shifts four pixels and disappears with reduced motion. Skeletons remain static, and pending route messages keep their request-driven timing. No animation dependency was added.

## Research

- Linear’s published redesign describes improvements to information hierarchy, contrast and navigation. Mon Enfant uses this principle in its compact rails and worklists. [Linear redesign](https://linear.app/now/how-we-redesigned-the-linear-ui)
- Attio’s views keep the list, filters and record context together. Mon Enfant applies this to the patient registry and administrative worklists. [Attio views](https://attio.com/help/reference/managing-your-data/views)
- Stripe Elements demonstrates reusable controls and consistent validation. Mon Enfant keeps the existing validation paths and uses common form and control styles. [Stripe Elements](https://docs.stripe.com/payments/elements)
- Vercel’s Geist practices informed shared tokens and typographic hierarchy. [Geist](https://vercel.com/geist/introduction)
- The NHS design system and WCAG informed labels, keyboard visibility, table alternatives and mobile target sizing. [NHS components](https://service-manual.nhs.uk/design-system/components) · [WCAG target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- Charles UX Animation was read at revision `52329dcf95b6e8b2c228da199bac58b254348048`, including timing, disclosures, pending feedback and reduced-motion guidance. [Skill and supporting instructions](https://github.com/LemonFace0309/charles-skills/tree/52329dcf95b6e8b2c228da199bac58b254348048/skills/drops/charles-ux-animation)

## Scope of verification

The visual pass does not alter database migrations, vaccine reference rows, protected server actions or access grants. The parent landing page adds a call to an existing authorized read after it validates the child selection. No new hosted test accounts or real records were used. Android APK development remains paused. Authenticated browser and persistence results are reported only where a corresponding check was run.

- Targeted component and navigation coverage passed 70 tests across seven files. Thirteen database-backed checks for parent views, clinician overview and appointment calendars also passed. The new child-selection tests verify per-child query scope, family appointment attribution, unrelated IDs and mid-request revocation. Test files were isolated to keep their Auth module mocks independent.
- Changed-file ESLint and Next.js route type generation with TypeScript passed. Vercel built preview `dpl_FvXNGKXoYGW66qEZE322NDScz2dT` from `8ec19d165a8e79eadcad5ed000f9a83a7cb82635`. The connected Vercel check confirmed the homepage and API health, and the parent route reached sign-in anonymously.
- Chromium checked the rendered preview homepage at 1440, 820, 390 and 320 CSS pixels. It verified horizontal fit, the two sign-in links, the authentic photo, mobile section navigation and reduced motion. Synthetic server-rendered parent, nurse registry and admin samples were checked at 1440, 820 and 390 pixels for layout, mobile menu disclosure, the collapsed rail CSS and the mobile register. These samples do not constitute signed-in browser acceptance.
- GitHub Actions did not start the check job because of account billing. The disconnected archive Vercel integration separately reported a failure while the correct Mon Enfant project reported a successful preview. No settings or spending limits changed. [CI record](https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/44429067582) · [Correct-project Vercel preview](https://vercel.com/bounga/mon-enfant/FvXNGKXoYGW66qEZE322NDScz2dT)

## Visual homepage and clinician workspace follow-up

The homepage now opens with editorial family and clinic images, followed by vaccination and growth photography and an illustrated appointment calendar. The parent booklet and clinician worklist have equal space with clearly labeled example data and existing sign-in routes. The generated images depict illustrative scenes. The original founders’ photo remains in the founders section.

The signed-in clinical home now starts with the Casablanca work date and a group of four icon-led shortcuts for consultation, vaccination, growth and appointment work. Each shortcut is shown only for the existing clinical capability and leads to the existing authorized workflow. The daily worklist retains its appointment details and refresh control. The existing doctor and nurse authorization logic serves both roles.

## Software-first homepage

The hero now shows fictional interface previews of the parent booklet and clinician agenda. The feature section uses software views of the vaccine record, growth and appointment calendar. The copy identifies Mon Enfant as tracking software and assigns the provision of care to the family’s own health professionals. The opt-in GIF uses these fictional product views.
