# Dashboard UI, loading and cache review — 18 November 2026

Current application source: d2ecdd346d971dd9f92b79449a688d9eeeb9d3a3. Preview dpl_9WWNcUHmEcZ7Z9hyRQPsMiARgskQ is READY. PR #4 merged as 168b0f4. Production dpl_4FvjCGbqsqdnePe5pU3wKVAHrqHS is READY on the canonical alias.

## Visual scope

All eight parent and eight clinician mockups were compared side-by-side with actual authorized synthetic records. `comparison/parent-{0..7}.jpg` and `comparison/doctor-{0..7}.jpg` display source/current at equal 800×450 presentation size; current 1440×1000 captures are cropped to the source aspect, so these are directional comparisons, not identical-state pixel scores. Original source images are approximately 1672×941. Full-size selected desktop/390px evidence accompanies the boards. Final runtime checks cover 1440, 820 and 390 CSS px.

Typography and hierarchy: bold shared titles, concise descriptions and existing font; clinician account has one main H1. Spacing/layout: mint illustrated banners, cream canvas, rounded surfaces, four genuine parent summaries, side-by-side child/quick-action panels, full-width child rows, month/list appointment split and expandable vaccine rows. Color: established emerald/coral/cream, light appearance under a dark system preference; source/uncertainty colors remain truthful. Assets: original logo/family image, new warm clinician and folder illustrations with static imports and blur placeholders. Copy: destination names, real counts and permissions remain accurate; Documents clearly says Bientôt disponible.

Intentional differences: no fabricated children/portraits, clinical totals, BMI, percentile or normal-growth assessment. Scoped child selection and full correction/provenance details remain. Illustration subjects and typography are reference-guided rather than pixel-identical. The long home vaccine explanation is available through an expandable disclosure. No unresolved actionable P0/P1/P2 was found in this scoped review; broader certification is not claimed.

## Loading and caching

Every one of 65 page routes has a skeleton boundary. Query/sidebar transitions preserve the shell and show section-specific skeletons after 120ms; covered old content becomes inert until completion. Slow-load, last-selection-wins, restored interaction, reduced-motion and phone overflow checks pass in `loading-cache.json` (five cases, zero browser exceptions).

Public branding/art: 24-hour cache, seven-day stale-while-revalidate; optimized images have a 24-hour minimum TTL and a local public-art allowlist. Static imported images are versioned. Next static/loading segments can be reused for five minutes; dynamic route stale time stays zero. React cache deduplicates repeated identity/professional reads within one render/request. Private pages keep private/no-store and fresh permissions. No service worker, offline medical records or persistent identity/data cache was introduced.

Actual public asset responses show Vercel CDN HIT and the configured TTL. Universal browser disk-cache reuse or zero network is not promised: the managed authenticated browser still observed an image transfer of 2742 bytes. Cache scope and private denial are explicit in `cache-privacy-phone.json`.

## Verification and classified intermediate failures

336 tests / 43 files pass; targeted lint, explicit TypeScript and Vercel preview build pass. Initial four-role navigation produced 96 passing destination checks and zero browser exceptions, then stopped on a test selector matching a hidden SVG title. `navigation-initial.json` preserves that intermediate failure; corrected visible-main matching passes persistence, settings validation, denials and empty states in `navigation-follow-up.json`. Final-source parent/doctor recapture passes all 48 destination/width checks, no overflow, light appearance and zero browser exceptions (`final-visual.json`).

An earlier cache test incorrectly demanded universal browser cache reuse despite CDN HIT and correct headers. The final test asserts the documented cache layer and records the actual transfer instead. A phone skeleton selector was made unique; a capture-only lazy image decode wait was restricted to visible images. These runner issues did not require weakening application checks.

Fresh synthetic run 2a1ea3a1a0284192 verifies actual registration, clinical persistence, QR guardian approval and linked reads. Canonical results pass in `production.json` and `canonical-loading-cache.json`, including immediate existing-session denial after guardian-link revocation. Retirement is blocked pending explicit owner approval: automatic approval review rejected the exact six-account cleanup twice, including after a read-only check confirmed all six marked accounts use unreachable test addresses. No workaround was attempted; private cleanup inputs remain mode600. No real-person data or email was used. No database schema, RLS or vaccine reference was changed.

final result: passed (canonical UI/loading/cache scope); fixture retirement pending explicit owner approval
