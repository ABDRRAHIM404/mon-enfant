# Mon Enfant · Unslop review

Applies [Unslop by Damir Sokolovsky](https://github.com/heydamir/unslop), CC BY 4.0. Project-local skill source: `.agents/skills/unslop`; pinned upstream commit `620163eedb3529d9cd23a3994ed8d287d06f760d`. Attribution and font license: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Rollback baseline: `e49ec3669f7963de1d01ff24b0b40cb7cdd02002` on GitHub main, READY canonical deployment `dpl_CQDC1SvqVqhMkGZgpuSzTmgQg5e2`. This redesign does not change schema or clinical data, so reverting its application merge restores the preceding design. The owner explicitly authorized proceeding through the design passes and publication, and permitted logo changes where useful.

## Evidence and audit

Baseline inspection: actual canonical public home and sign-in screens in the shared browser, the owner's clinician-child screenshots, and the current parent/clinician/admin component and stylesheet sources. No signed-in private browser session is available. Source/component inspection is not claimed as authenticated visual acceptance.

Distributed craft problems justify all nine passes while retaining the existing brand:

- Home: heavy headings, uppercase tracked eyebrow, repeated rounded feature cards and excess framing around the family illustration.
- Sign-in: an oversized decorative icon, heavy headings, green-tinted panel and inconsistent control spacing.
- All workspaces: repeated mint illustrated headers compete with actual content and reduce useful space.
- Clinician sidebar: 52px rows with 8px gaps make ordinary navigation scroll unnecessarily; tools compound this when expanded.
- Parent/clinician/admin summaries: decorative icons and multiple unrelated category tints compete with counts.
- Admin and child workflows: inconsistent padding, tiny labels, several radii and heavy heading weights across nested pages.
- Loading: tall illustrated-header placeholder, unnecessary breathing loop and older sidebar proportions.
- Logo: the family emblem belongs to the product; the tiny uppercase tagline loses legibility at small sizes.

## Direction

Product: a child-health record shared through authorized family and care-team workflows.

Character: reassuring, precise, human.

World: a health booklet on a clinic desk.

Moments: the existing family illustration on public pages, and real authorized care history/growth information inside the app.

Signature: a small booklet-tab edge on the current page/child context, used sparingly.

## Passes applied

1. **Spacing:** shared margins, padding and gaps follow a 4px rhythm; optical 1–2px nudges and data/plot geometry are preserved. Navigation uses compact 36px desktop rows and 44px mobile/touch destinations. Page padding is 24–32px; controls/cards share padding.
2. **Color:** low-saturation neutral surfaces, three text roles, one existing emerald accent. Accent text is darkened for contrast on raised surfaces; the primary action retains its readable green fill. Warning/error/source-state semantics stay explicit. Shadows are small neutral shadows.
3. **Icons:** existing Lucide set at 18px/1.5 stroke, with consistent boxes and gaps. Stat-card filler icons are hidden; useful action/navigation symbols remain. QR and growth SVGs are not affected by the Lucide rule.
4. **Copy:** sentence-case context labels, a specific child-health headline, a context title instead of a greeting, short feature captions and an honest Documents-coming-soon label. Clinical provenance, uncertainty, consent, access and decision text remain intact.
5. **Type:** self-hosted Instrument Sans, normal tracking for small text, 400/500 weights with 600 for emphasis, tabular figures and readable metadata. Brand emblem retained; wordmark/tagline typography refined.
6. **Layout:** 256px sidebars, compact app headers, fluid content, simpler dashboard headings, more room for real records and clear child context. Public hero remains an asymmetric family composition with two actions. Existing destinations, feature order and flows remain.
7. **Details:** 8px controls, 12px cards and 16px panels; quieter badges; aligned tables, recognizable row hover/focus, consistent field density and visible keyboard focus. All care capabilities still control the actual write links.
8. **Visuals:** reuse the genuine product-family artwork as the public visual; remove repeated app heading art. Existing actual clinical plots and records carry the content. No generated image, paid service, new claims, fake patient data or story video.
9. **Motion:** remove skeleton breathing; retain only real pending/save feedback and short named-property transitions with one easing curve. Reduced-motion and print behavior retained.

## Verification and limits

- Relevant admin presentation, child workflow and loading checks pass: 34 cases across three files; targeted lint passes.
- The updated public-font cache rule is checked separately; private medical pages remain fresh/private/no-store.
- Stylesheets parse successfully; accent/body/metadata contrast checked. Public asset font filename includes its content hash.
- Required Vercel compilation, preview visual round and canonical deployment receipts are recorded on the redesign PR.
- Render review is limited to three rounds: baseline, preview/corrections, final. No broad database/vaccine/email suite, new hosted actor, role change or retired-fixture reuse.
- Full signed-in parent/clinician/admin visual and interaction acceptance remains pending a usable authenticated browser session; no new login handoff is requested for this styling task.
