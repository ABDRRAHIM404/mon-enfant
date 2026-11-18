# Admin UI — 18 November 2026

Owner request: inspect and improve the admin area. The existing parent/clinician dashboards establish the visual target: cream background, emerald navigation, mint section headers, readable white cards and clear mobile navigation.

## Implemented

- Shared admin shell with a persistent desktop sidebar, active destinations, mobile menu, account link and sign-out.
- `/admin` is now a genuine overview with authorized current counts for pending reviews, requested complements and professional accounts, plus links to existing tools. Counts use the same protected tables and reviewer guard as the existing queues.
- Verification queue has a distinct section header, status filters, result metadata, explicit empty state and readable action buttons. On narrow screens, each table row becomes a labelled card.
- Professional cards show identity/role/status first. Account UUIDs and reasoned suspension/reactivation forms are expandable rather than repeated in the initial view.
- Verification detail separates identity/evidence and decision form, with a return link and status. Private evidence endpoint, checks, reasons, attribution and decision history remain intact.
- Permission management uses French labels, clear search and empty states, separated editor/history and existing qualification controls. Expiry dates remain explicitly UTC.
- Admin catalogue and account screens use the same shell; clinician catalogue framing is retained. Admin account no longer uses clinician activation copy.
- Five admin route loading boundaries preserve the admin navigation and use shaped skeletons. Sidebar and status-filter navigation use the existing delayed loading feedback, inert covered content and reduced-motion rules.

## Verification

Source-rendered component tests use fictional in-memory responses only. They verify queue filtering/pagination, guard-before-read, separate clinical permission management, evidence routing, approval checks, suspension reason fields, real overview query scope, loading semantics, empty editor absence and the admin account branch. No hosted admin account, capability or test data was created. No Auth, RLS, schema, clinical/vaccine source, server action or evidence route behavior was changed.

The final full suite passes 347 tests / 44 files; the targeted UI/loading suite passes 20 cases. Explicit TypeScript and targeted lint pass. Vercel preview dpl_EXsfH1nAMYLNaZFDcCx7fRt16DYA is READY for exact application source 926f045ae4e27c8324599231c685f7fd6c6204af.

## Live inspection limits

1. Canonical `/admin`: blocked by the ordinary sign-in screen in the shared browser. This verifies the anonymous sign-in barrier, not the authenticated admin flow.
2. Source components: rendered with explicitly synthetic responses for structural verification; these are not live admin screenshots or backend acceptance.
3. Authenticated visual/interaction review: pending an existing admin session. The secure browser-auth request returned `declined`; authentication stopped and no further sign-in or takeover was requested. No full UI audit, responsive screenshot acceptance or accessibility certification is claimed. The browser also denied a local-file preview under its URL policy; no alternate surface or URL was used to work around that denial.

The earlier six-account dashboard test fixture remains pending explicit owner-approved cleanup; this UI task does not reuse it or attempt its blocked cleanup.

Current result: source checks pass; authenticated visual review pending sign-in.
