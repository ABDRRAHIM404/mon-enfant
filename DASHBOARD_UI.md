# Dashboard UI and loading update

Implemented for the owner’s 18 November request: both eight-section dashboards now use illustrated mint headings, stronger typography, rounded cards and clearer spacing. Parent overview has four actual summaries, child rows and a quick-action guide. Clinician appointment calendar defaults to a month/list split, and vaccination history expands for full source/revision detail. Documents has its own coming-soon illustration.

65 page routes have layout-shaped skeletons; sidebar/query loading preserves the shell, covers stale controls, respects reduced motion and releases correctly after cancellation. Images use static imports with blur placeholders.

Public art/branding and static loading boundaries can be reused. Duplicate identity reads are deduplicated within the server request. Dynamic/private responses and permissions stay fresh; this does not promise zero network or offline records.

Verification: 336 tests, types/lint, READY Vercel preview, 96 role/navigation checks plus successful persistence/denial follow-up, 48 final responsive visual checks and five slow-loading/caching/privacy checks. Full evidence and limitations: [review](docs/design-qa/dashboard-ui/review.md).

Canonical deployment and test-account retirement: see the latest PROGRESS.md checkpoint and DASHBOARD_HANDOFF.md.
