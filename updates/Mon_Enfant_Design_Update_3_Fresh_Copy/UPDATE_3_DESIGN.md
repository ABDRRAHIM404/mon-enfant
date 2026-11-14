# Mon Enfant — Update 3: Visual Design System & Screen Flows

**Date:** 14 November 2026  
**Status:** Visual specification and mockups for discussion / agent handoff. **Not a deployed implementation.**  
**Scope:** Public website, parent mobile experience and clinician web/mobile experience, responsive from the same product system.

## 1. What has been selected

- **Brand color scheme:** Warm Cream + Emerald Green + Soft Coral. Coral is an **attention accent (roughly 10%)** for reminders and high-priority non-emergency items, not the default color of every button.
- **Light and dark mode:** Both required across the complete product, with automatic system theme and manual override, persisted for the user.
- **Logo:** Mother embracing child inside a protective heart-like shape, tiny coral heart, rounded `mon enfant` wordmark. One master emblem geometry; change colors for light/dark only. Use the emblem for the app icon, emblem + wordmark for the header. Do **not** repeat big logos as background watermarks or large decorative logos behind content.
- **Style:** Warm and human, but clinically legible; practical navigation and restrained Moroccan character. No decorative background logos. Illustrations may appear as *content illustrations*, not obstructing controls.
- **UX:** Parent-first homepage and primary login. `Espace soignant` must remain discoverable but less prominent. Use **Médecin / Infirmier(ère)** rather than generic `Professionnel` in user-facing access screens.

## 2. Color tokens

These are proposed implementation tokens; **HEX values are design specifications, not an exact color extraction from AI-generated images**.

| Role | Light | Dark | Intended usage |
|---|---|---|---|
| Primary background | `#FAF8F1` | `#071C17` | Main page/app canvas |
| Elevated surface/card | `#FFFFFF` | `#122E26` | Cards, forms |
| Secondary surface | `#F2F4EF` | `#193A30` | Secondary cards, pressed and selected surfaces |
| Primary brand / action | `#087F5B` | `#31BC8C` | Navigation accents, emphasis |
| Primary button fill | `#087F5B` | `#087F5B` | White text on solid primary button |
| Primary text | `#12392F` | `#FAF8F1` | Main typography |
| Secondary text | `#647A71` | `#B2C5BC` | Explanatory copy |
| Borders | `#DEE6DF` | `#315047` | Dividers, inputs |
| Soft coral attention | `#E97872` | `#F38B84` | Small important highlights, reminders |
| Coral highlight surface | `#FCECE9` | `#48302F` | Reminder callout background |

**Accessibility:** Coral on cream alone does **not** provide sufficient contrast for small text. On light theme use a sufficiently dark foreground for coral-surface text; on dark theme use legible light text. Never rely on color alone for verified/unverified or completed/overdue statuses. Reserve red for actual errors/urgent warnings. Validate WCAG contrast and keyboard behavior before development sign-off.

**Approximate composition:** 60% background cream/dark canvas, 30% brand/neutral surfaces/actions, 10% coral attention. This is a guiding visual ratio, not a rigid per-screen quota.

## 3. Navigation & onboarding contract

### Parent journey
1. **Landing** — Primary CTA `Accéder à mon espace parent`, secondary `Créer un compte parent`, discreet `Espace soignant` entry. Do not present a professional-only login page by default.
2. **Parent login** — Parent-specific account language, email/password and reset. Signing up is distinct from proving guardianship.
3. **Parent dashboard** — Only children attached via authenticated, approved invitation/guardianship flow; next appointment, reminders, quick routes to vaccination/growth/documents.
4. **Vaccination detail** — A selected child's administered entries and pending items; show source/review status; no inferred administration or unsupported automated catch-up. Parent can **show a short-lived, purpose-bound QR** to authorize an appropriate verified clinician.

### Clinician journey (doctor AND nurse)
1. Enter via **Espace soignant** from navigation/footer or homepage's discreet link.
2. **Clinician login / signup** — Use `Médecin / Infirmier(ère)`, not generic `Professionnels`. Doctors and nurses have the same functional permissions once appropriately verified.
3. **Unverified clinician workspace** — Access the full clinical workspace, including provisional local child dossiers, consultations, vaccination records and appointments. Display conspicuous `Compte non vérifié`; records created under this status are `Non vérifié`, scoped to their creator and invisible to other clinicians.
4. **Verification submission** is accessible from account/dashboard but **not forced as an onboarding blocker**. It may be completed later.
5. **Verified clinician** — Eligible for authorized existing-child QR import, but never a global search by child ID/name. Access to a particular child still requires the existing scoped authorization workflow.

**Critical security constraint:** Before allowing **real identifiable medical data** to be entered by unverified clinician accounts, a clinician/legal/privacy owner must approve the threat model and data-processing policy. Mark provisional data untrusted, isolate with server-side RLS/authorization, prevent sharing or official export, and preserve audit trails. **Unverified data must not silently become trusted/shared upon account approval.** Promotion/review rules are still undecided.

## 4. Detailed screen index

Each screen has **four separate PNGs** (mobile light, mobile dark, web light, web dark):

| Screen file | Purpose |
|---|---|
| `landing.png` | First encounter; parent-first CTA, discreet clinician access |
| `login.png` | Parent-specific login |
| `parent.png` | Parent overview with linked children, reminders and shortcuts |
| `vaccination.png` | One child's vaccination history and QR sharing action |
| `clinician_login.png` | Distinct clinician login |
| `clinician_register.png` | Clinician signup with deferred verification |
| `clinician.png` | Unverified clinician workspace, provisional records, verification call-to-action |

Paths: `mockups/{mobile|web}/{light|dark}/{screen}.png`.

## 5. Logo export and usage

- `assets/logo-symbol-light.png`: conceptual transparent mother-and-child emblem on light theme.
- `assets/logo-symbol-dark.png`: **derived from the same light emblem geometry** with a different color treatment.
- `assets/brand-light-dark-reference.png`: side-by-side reference to the selected mother-and-child branding, for review.
- Header should show emblem left, `mon enfant` wordmark right, same placement and dimensions in both themes.
- App icon: centered emblem inside a squared, gently rounded solid-color icon canvas; app-icon adaptive masks need separate Android/iOS validation.
- The bundled emblem was extracted from a rendered concept. **It is a raster design reference, not a production SVG/vector master**. Before production, trace one source into genuine paths and export light/dark and adaptive icon sizes from the identical geometry. Do not pretend the PNG is a vector logo.

## 6. Implementation principles

1. Do not rebuild clinical logic or database when implementing visual updates. Preserve existing data models and role/access boundaries.
2. Use design tokens for all themes and shared components; avoid manually duplicating screens for light vs dark.
3. Responsive design must not hide essential actions, especially `Espace soignant` and verification status.
4. Keep workflow actions explicit. `Non vérifié` is a prominent state that does not imply medical approval. Use role and access guards enforced on server, not merely hidden buttons.
5. Parent views should not enable editing clinician-recorded vaccination history; clinician-administered records remain audited clinical entries.
6. Designs show **fictional patients and illustrative, non-prescriptive records only**; do not treat mockup calendar values as clinical source or alter the reviewed PNI schedule based on visuals.
7. The parent platform is a concept screen flow; the progress report still lists parent account/QR and native mobile apps as unfinished phases. Do not claim these screens are already live.
8. Maintain low-data/performance friendliness, keyboard support, touch targets, and reduced motion. Keep illustrations optional for low bandwidth.

## 7. Out of scope / still undecided

- The actual legal and clinical approval for processing identifiable child data in unverified workspaces.
- Whether records created before clinician verification are reviewed/published automatically or individually — **do not auto-publish**.
- Production verification method for medical staff and guardian verification proof.
- Final production vector tracing of the current illustrated logo.
- Child deduplication from **Update 1** (child name, birth date, sex, mother's full name, place of birth) is a separate planned update, not already implemented.

**Agent instruction:** Treat this as **Update 3, design only**. Updates 1 and 2 remain separate requirements. Before coding, review the existing app and implement visual changes screen-by-screen without weakening clinical or privacy controls. Preserve medical functionality and synthetic-only testing until required approvals exist.
