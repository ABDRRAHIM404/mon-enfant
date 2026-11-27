# Mon Enfant — Phase 1 performance audit

**27 November 2026 · Africa/Casablanca**

**Production:** [mon-enfant.vercel.app](https://mon-enfant.vercel.app/) · Vercel deployment `dpl_8BiaGEdHpJv14j6tXZkEgC48N8Wh` · source `6f58072905f3b8730681f1cde19a0c564ab25398`

## Executive findings

- **Enfants is the strongest confirmed backend bottleneck.** The production `list_patients` SQL fingerprint averaged **210 ms over 387 calls**, peaked at **1,597 ms**, and accumulated about **81 seconds of SQL execution**. One server RPC runs a visit-summary calculation for every child returned, even when the caller only needs a child selector.
- **Dossier enfant has an existing persistent layout.** Same-child tab links use Next.js navigation and retain the shared identity by design. The earlier mock-backed checks verified identity DOM persistence on desktop, tablet and mobile. Current source shows substantive differences in what each tab must fetch. The overview and vaccination booklet have the deepest read chains. Current authenticated tab latency, React commit cost and production DOM stability remain unmeasured.
- **The app and database are separated by the Atlantic.** The Vercel function region is Virginia (`iad1`) and Supabase is in Paris (`eu-west-3`). Sequential auth, reference and clinical reads can multiply the effect. Their direct round-trip latency, middleware duration and Vercel cold-start contribution remain unmeasured.
- **Public pages transfer substantial assets on a first visit.** On constrained mobile, median cold transfers were about **718 KiB** for home, **334 KiB** for login and **378 KiB** for the public QR page. A separate Lighthouse homepage run measured **2.57 s LCP**. The homepage GIFs and the shared sans font are the largest attributable public asset costs.
- **The signed-in baseline is the outstanding measurement.** Production probes exercised the sign-in guard on every clinician route. This session had no usable authorized synthetic login. Current credential submission, opening a real synthetic chart, clinical tab changes and the verified QR camera workflow could therefore not be measured. The SQL telemetry identifies server work independently of that limitation.

## Measurement method

- Chromium on a cloud runner against the production alias, with three fresh browser contexts per profile and route. Each cold visit was paired with a second document navigation using the same context and browser cache. This yields 54 successful page loads. Warm here means browser resources can be reused. It does not mean a function instance was warm or a Next.js client tab was prefetched.
- Profiles were desktop 1440 × 900, mobile 390 × 844 at DPR 2, and the same mobile profile at 4× CPU slowdown with 150 ms added latency, 1.6 Mb/s downstream and 0.75 Mb/s upstream. This is a cloud lab simulation, with no in-country device or field percentile inferred. The browser runner used a certificate exception after a runner trust error. Direct curl probes used ordinary TLS verification.
- Public TTFB is browser navigation response start. FCP, LCP and CLS come from browser performance entries in a short observation window after load. JS is encoded JS response body size including cache-reused resources. Transfer includes the HTML document and observed resources with cache reuse accounted for. Counts include cache hits. Blocking is the sum of long-task time above 50 ms in that observation window. KiB values are rounded.
- Four independent curl probes per path measure signed-out document TTFB. All protected probes reached the server login redirect marker. They used a fixed dummy UUID for child paths. The HTTP 200 status is the streamed redirect response. It does not establish access to a chart.
- Production SQL values come from read-only `pg_stat_statements` with top-level statements tracked since 12 November 2026 23:22:39 UTC. These measurements span several deployments and reflect Postgres execution, apart from HTTP, transport, RSC rendering and browser work. Each fingerprint can include multiple routes. The maximum is an observed maximum. Percentiles, query plans for authenticated claims and per-policy timings were unavailable.
- Source references below are relative to this repository. “Page calls” count page-specific PostgREST/RPC calls on the source path. They exclude the shared auth/profile gates and child layout read unless called out. Conditional calls and parallel stages vary with filters, permissions and record size.

## Production browser baseline

Medians for three runs per row. All timing columns are in milliseconds.

| Page | Profile | Browser cache | TTFB | FCP | LCP | CLS | JS KiB | Requests | Transfer KiB | Blocking |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Accueil | Desktop | Cold | 131 | 368 | 596 | .001 | 154 | 26 | 774 | 6 |
| Accueil | Desktop | Warm | 74 | 140 | 140 | 0 | 154 | 27 | 23 | 0 |
| Accueil | Mobile | Cold | 153 | 380 | 668 | 0 | 154 | 25 | 711 | 0 |
| Accueil | Mobile | Warm | 87 | 140 | 140 | 0 | 154 | 26 | 23 | 0 |
| Accueil | Constrained mobile | Cold | 155 | 1,076 | 1,472 | 0 | 154 | 26 | 718 | 143 |
| Accueil | Constrained mobile | Warm | 75 | 292 | 636 | 0 | 154 | 25 | 29 | 13 |
| Connexion | Desktop | Cold | 189 | 444 | 444 | 0 | 160 | 23 | 331 | 0 |
| Connexion | Desktop | Warm | 162 | 224 | 224 | 0 | 160 | 24 | 22 | 0 |
| Connexion | Mobile | Cold | 178 | 432 | 432 | 0 | 160 | 22 | 334 | 0 |
| Connexion | Mobile | Warm | 168 | 200 | 200 | 0 | 160 | 23 | 21 | 0 |
| Connexion | Constrained mobile | Cold | 171 | 1,144 | 1,144 | .001 | 160 | 22 | 334 | 145 |
| Connexion | Constrained mobile | Warm | 138 | 292 | 312 | 0 | 160 | 23 | 21 | 0 |
| QR partagé, guest | Desktop | Cold | 320 | 640 | 780 | .004 | 169 | 26 | 370 | 0 |
| QR partagé, guest | Desktop | Warm | 154 | 224 | 224 | 0 | 169 | 25 | 23 | 0 |
| QR partagé, guest | Mobile | Cold | 182 | 432 | 708 | 0 | 169 | 24 | 371 | 0 |
| QR partagé, guest | Mobile | Warm | 136 | 200 | 200 | 0 | 169 | 25 | 20 | 0 |
| QR partagé, guest | Constrained mobile | Cold | 193 | 1,200 | 1,572 | 0 | 169 | 25 | 378 | 173 |
| QR partagé, guest | Constrained mobile | Warm | 140 | 272 | 592 | 0 | 169 | 24 | 27 | 0 |

The constrained cold LCP ranges were **1,408–1,476 ms** on home, **1,096–1,164 ms** on login and **1,564–1,584 ms** on the public QR page. Independent Lighthouse 13.1 mobile simulation for home produced a **97** performance score, FCP of **1.2 s**, LCP of **2.57 s**, TBT of **70 ms** and CLS displayed as **0**. That run uses Lighthouse simulated throttling and a different model from the Chromium lab rows. It flagged **28 KiB** of potentially unused initial JavaScript and **1.0 s** of main-thread work. The tested interaction was password visibility. All six toggles per profile worked. Captured Event Timing maxima were **16 ms desktop, 16 ms mobile and 32 ms constrained**, with some non-constrained samples below the 16 ms observer threshold. This is a sample for one control. Site INP remains unavailable.

### Protected routes and server read map

For each route below, the curl median and range are in milliseconds. Signed-in TTFB, FCP, LCP, CLS, INP, transfer, browser requests, bundle size, and cold/warm elapsed navigation are **unmeasured on every row**. Source-based RPC counts do not fill those fields. In this section, child routes are relative to `/patients/[id]` and page source is under `src/app/(soignant)/(verified)/` unless an exception is noted.

| Flow | Path | Signed-out TTFB median [range] | Source read stages for the signed-in page |
|---|---|---:|---|
| Tableau de bord | `/dashboard` | 267 [238–507] | Five parallel RPCs. Includes registry summary, today’s calendar, follow-up worklist, recent consultations and capabilities. |
| Enfants | `/patients` | 318 [229–377] | One list RPC with per-child summaries inside SQL. Includes authorized child selector mode. |
| Inscription rapide | `/patients/new` | 272 [208–353] | Quick initial form skips facilities. Alternate paths add a facilities or intake read. Submission can prepare then register sequentially and redirect to Vaccinations. |
| Vue d’ensemble | opens `/patients/[id]` | 344 [244–491] | Shared child read plus visit overview and capabilities. Vaccine schedule discovery precedes three clinical reads. More timeline pages, access grants and attribution are conditional. |
| Consultations | `/consultations` | 247 [165–396] | Timeline and capabilities in parallel, then clinician attribution if required. |
| Dossier clinique | `/records` | 190 [177–276] | Timeline and capabilities in parallel, then record author labels when needed. |
| Vaccinations | `/vaccinations` | 245 [164–525] | Timeline, vaccine export, capabilities and schedule discovery in parallel. Additional history, reviews, name resolution and assignment options can add later stages. |
| Rendez-vous enfant | `/appointments` | 210 [197–299] | Three primary reads in parallel and a second wave for labels/places when required. |
| Croissance | `/growth` | 276 [216–308] | First measures page, capabilities and access in parallel. An extra requested page, correction/form lookups or attribution may add calls. |
| Accès des parents | `/guardians` | 186 [183–385] | One guardian overview RPC after shared access. |
| Résumé et impression | `/summary` | 189 [150–287] | Four parallel RPCs, one repeats the shared child profile on direct entry. Includes three exports, then name resolution as needed. |
| Rendez-vous global | `/appointments` at site root | 157 [153–220] | Three parallel RPCs. `appointment_workspace` computes list, calendar indicators and eligible proposals in SQL. |
| Mon compte soignant | `/account` | 282 [255–328] | Shared identity. Admin permission checks or clinician presentation/capability calls depend on role. See `src/app/account/page.tsx:19,97`. |
| Legacy Consultations | `/consultations` at site root | 183 [166–299] | Compatibility redirect after authorization. |
| Legacy Vaccinations | `/vaccinations` at site root | 158 [153–361] | Compatibility redirect after authorization. |
| Legacy Croissance | `/growth` at site root | 184 [159–214] | Compatibility redirect after authorization. |

The guest QR camera was not opened, and no token, login credential or medical record was submitted. No current authenticated synthetic session was available. Older fixtures are retired. An [earlier authenticated performance run](https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43579313347) against `e901fd8` logged 108 measurements across six then-current views. It reported maxima of 156.8 ms TTFB, 1,580 ms LCP, 0 CLS, 2,178.3 ms load, 182,652 bytes and 38 requests. That version, harness and route set predate the current workspace. See `PERFORMANCE.md` and `PROGRESS.md` for the harness and earlier results.

## Production database and infrastructure baseline

| SQL fingerprint | Calls | Mean ms | Maximum ms |
|---|---:|---:|---:|
| `list_patients` | 387 | 210.02 | 1,597.43 |
| `appointment_workspace` | 50 | 57.10 | 210.41 |
| `vaccine_followup_worklist` | 685 | 30.20 | 582.98 |
| `patient_routine_appointment_proposals` | 8 | 30.14 | 78.61 |
| `appointment_calendar` | 208 | 24.99 | 196.65 |
| `register_child` | 105 | 24.90 | 130.41 |
| `clinician_recent_consultations` | 288 | 22.64 | 475.90 |
| `patient_appointments` | 23 | 17.13 | 83.94 |
| `patient_visit_overview` | 268 | 15.45 | 277.19 |
| `clinician_attribution_labels` | 68 | 14.51 | 114.81 |
| `vaccine_catalog` | 1,215 | 13.75 | 590.95 |
| `registry_summary` | 685 | 11.94 | 690.02 |
| `prepare_child_registration` | 76 | 11.72 | 67.03 |
| `appointments_export` | 111 | 9.75 | 61.22 |
| `clinical_timeline` | 449 | 7.23 | 223.83 |
| `get_child_profile` | 1,070 | 6.26 | 467.59 |
| `my_clinical_capabilities` | 2,266 | 6.11 | 557.65 |
| `vaccination_booklet_reviews` | 46 | 5.70 | 12.14 |
| `doctor_guardian_overview` | 54 | 5.63 | 43.28 |
| `vaccine_items_export` | 424 | 5.27 | 182.98 |
| `has_standard_child_access` | 14 | 4.38 | 18.74 |
| `clinical_export` | 118 | 4.31 | 22.28 |
| `child_access_grants` | 221 | 3.35 | 26.27 |
| Statements matching `professional_profiles` | 10,408 | 2.35 | 747.40 |
| `my_facilities` | 1,931 | 1.99 | 213.55 |

Catalogue and profile-table rows aggregate multiple fingerprints and use a call-weighted mean. The profile-table aggregate is broader than login. These durations cannot be summed to estimate browser navigation time because calls can overlap and the route mix varies. DB plans need production-like cardinality and equivalent RLS claims. Available indexes cover child-scoped clinical chronology and revision uniqueness, access-grant lookup in both directions, logged-in sessions, active clinician shares, registry ownership and child keys, appointment child/owner keys and vaccine version/dose lookup. Existing normalized name indexes support equality patterns. The directory’s concatenated substring predicate has a different shape. The production data set was small at roughly 100 children, 160 registry rows, 430 clinical entries and 84 appointments. Disk reads were negligible for the strongest offender. This evidence prioritizes execution shape before speculative indexes or database sizing.

Vercel metadata shows `iad1` and production private-response headers showed `cle1::iad1`. Supabase project metadata shows `eu-west-3`. Home was generally an edge cache hit. Login, QR and protected guard documents were private/no-store. Four probes of `/api/health`, which calls dependency readiness, produced **500–2,340 ms** end-to-end TTFB, median **614 ms**. This route is a composite check, so the variation cannot be attributed to a cold start, middleware or a particular database call. Vercel metrics requests returned HTTP 400 and trace lookup returned 404 through the available integration. Supabase edge diagnostics lacked a usable correlated trace. Function durations, cold-start rate, GoTrue timings, direct region RTT, RLS cost and connection pool queue time remain unknown.

## Findings and recommended changes

Expected improvements below are hypotheses, measurable deltas in work, or proposed acceptance targets. They are not measured savings.

### F1 · High — Directory SQL repeats visit work for every returned child

- **Affected paths and components:** Enfants, dashboard child selection via Enfants, global appointment child search. `src/app/(soignant)/(verified)/patients/page.tsx:183`, `appointments/new/page.tsx:18` under the same route group, `supabase/migrations/20261125190338_quick_child_registration.sql:116`, and `supabase/migrations/20261113154648_appointments_continuity.sql:280–300`.
- **Root cause and evidence:** The base query scopes and checks rows for count and page, then the wrapper calls `patient_visit_overview` for each returned child. That includes appointment/latest-entry work and per-child read auditing. The server sends one RPC and Postgres executes the repeated work internally. The workload averaged **210 ms**, standard deviation **138 ms**, about **4,012 shared-buffer hits/call**, and essentially no physical reads. The security-definer directory function explicitly evaluates child access and standard access predicates. Those checks cover session, grant and share scope. See `supabase/migrations/20261119152628_parent_care_visit_qr.sql:12–53`. This repeated access computation and the substring predicate are separate candidates for timing with equivalent clinician claims. Neither has an isolated duration yet.
- **Recommendation and expected gain:** For selector mode, return only authorized display fields and skip visit computations. For the directory, scope the child set once, batch visit metadata for the page, preserve sorting and audit semantics, and compare authenticated query plans. This removes up to **30 individual summary executions per page** from the current query shape. Use a **50% reduction in p50 SQL time** on matched list/search fixtures as an initial target. Check specialized search indexing only after representative plans identify a scan problem.
- **Difficulty/risk:** Medium–high. Verify pagination totals, substring and register searching, age/history filters, authorized sharing, expired access, audit coverage and consistent latest-care/appointment summaries.

### F2 · High — Overview and booklet carry multiple dependent PNI and ledger read stages

- **Affected paths and components:** Opening a child, Vaccinations, and quick registration’s destination. `src/app/(soignant)/(verified)/patients/[id]/page.tsx:56–84`, `vaccinations/page.tsx:48–135` under that child folder, `src/components/clinician/child-overview/read-vaccination.ts:19–56`, `src/components/clinician/vaccinations/read-overview.ts:16–51`, and `src/lib/vaccines/booklet.ts:115–246`.
- **Root cause and evidence:** Schedule discovery can page through up to four catalogue lists before fetching version detail. The booklet may fetch page one again for assignment and read version detail again when the selected reference is the same version. Overview awaits discovery before reading timeline, exports and reviews, then may fetch up to three more history pages and build a full booklet to get summary values. Booklet assembly repeatedly traverses entries, items and reviews for schedule rules. Booklet page awaits additional entries, review evidence, attribution and assignment options, including data for a collapsed form. Live catalogue SQL averaged **13.75 ms** across **1,215 calls**. The sequential network impact and TypeScript compute fraction remain unmeasured.
- **Recommendation and expected gain:** Dedupe catalogue requests within a render, fetch schedule metadata by authorized version in one step where practical, defer collapsed assign options and stream tab-specific detail below the stable header. Profile booklet CPU before replacing lookup loops with indexed maps. Use a narrow overview projection proved equivalent to current statuses. Expect **one fewer catalogue RPC** when page-one discovery and assignment both request it, potentially a second deduplication for matching version detail, and fewer sequential stages when form options are deferred. If independently measured interregion overhead is Δ, removing three serial hops saves roughly 3Δ before execution changes.
- **Difficulty/risk:** Medium–high. Prove equivalence for historical verification, incomplete exports, date certainty, corrections, catch-up flags, draft versus approved references and effective/withdrawn versions. Preserve all booklet columns and clinical/appointment synchronization.

### F3 · High — Cross-region server reads and repeated identity work amplify serial paths

- **Affected paths and components:** Private clinician pages, login submission, QR and protected entry. `src/proxy.ts:9–38`, `src/lib/auth.ts:9–33`, `src/app/auth/actions.ts:41–83`, `src/app/share/page.tsx:14–29`, and `next.config.ts:48–54`.
- **Root cause and evidence:** Proxy awaits Supabase `getUser` for matched requests before returning a private response. Server routes also validate identity and often read professional profile. React's `cache` deduplicates server render reads but has no shared context with the proxy. Clinician sign-in has a conditional authenticated user/profile lookup after the password call. The anonymous checks establish origin placement and privacy headers. They do not prove that every anonymous `getUser` sends a network request. Production Vercel/Supabase are in different regions and provider timings were unavailable.
- **Recommendation and expected gain:** Capture request-scoped auth/DB/render timing and redirect counts first, then run a like-for-like European function placement experiment if available in the current plan. Examine whether one redundant verified-identity call can be removed while retaining live session, revocation, cookie refresh, verified role and RLS checks. A successfully eliminated serial call saves its full observed duration. Region savings scale with the number of serial outbound calls. Set the target from a same-session A/B experiment.
- **Difficulty/risk:** Medium–high. Verify Moroccan client latency, provider availability and cold starts, protected refresh, logout, role changes and revocations. Preserve the private cache headers and server-authoritative identity.

### F4 · Medium — Follow-up work can rerun after a whole-route refresh

- **Affected paths and components:** Dashboard, Suivis, both Rendez-vous pages. `src/components/appointments/live-refresh.tsx:5–35`, `dashboard/page.tsx:142,308`, `follow-up/page.tsx:86`, `appointments/page.tsx:112,526`, `patients/[id]/appointments/page.tsx:132,221` under the verified route group. SQL: `supabase/migrations/20261121183740_routine_appointment_proposals.sql`, `20261121190310_appointment_workspace_filters.sql:2–89`, and `20261124195146_patient_routine_appointment_proposals.sql`.
- **Root cause and evidence:** A visible/online 60-second interval and return-to-tab trigger can call `router.refresh()` once the freshness interval passes. It skips active input fields and does not run as a synchronous initial-load step. A refresh can re-execute the route read tree. Global appointment proposals traverse authorized candidates in SQL and are needed for calendar counts, eligibility and filtering. Global workspace averages **57.10 ms**, follow-up worklist **30.20 ms**, child proposal calls **30.14 ms**. Dashboard’s five reads already run in parallel.
- **Recommendation and expected gain:** Keep date/eligibility/merge logic in shared backend functions. Compare a targeted refresh of the volatile panels against whole-route refresh. Limit equivalent in-flight requests and refresh after relevant writes, while validating the staleness bound. Each avoided dashboard full refresh saves up to its **five page RPCs** before any scoped replacement read. Fewer repeated RSC payloads and audit reads are expected. No evidence indicates duplicate appointment writes from the read refresh alone.
- **Difficulty/risk:** Medium. Preserve clinical changes from another authorized user, approved PNI rules, Casablanca date boundaries, pending/confirmed status, duplicate prevention and cross-view reconciliation.

### F5 · Medium — Native GET transitions and broad loading feedback can interrupt the workspace

- **Affected paths and components:** Child tabs, record subnavigation, global search and clinical filter/form entries. `src/app/(soignant)/(verified)/patients/[id]/layout.tsx:4–17`, `src/components/clinician/patient-profile-tabs.tsx:65–119`, `src/components/workspace-navigation.tsx:7–90`, `src/components/clinician/shell.tsx:158–182`, `src/components/clinician/child-picker.tsx:31,78`, and the verified `patients/[id]/vaccinations/page.tsx:269`.
- **Root cause and evidence:** The nested Next.js layout is keyed by child ID and `readAuthorizedChild` is request-memoized. The tab bar uses soft links, keeps scroll and opts into inline progress. Its client component tracks the pathname and reinstalls a resize observer on active-tab changes to keep the selected item visible. The overhead of that work has not been profiled. Earlier synthetic/mock-backed checks retained the identity DOM across eight tabs at widths 1710, 850 and 390. Native GET forms create document navigation where they submit directly. Outside inline-only links, a navigation overlay can appear after **120 ms** and mark the entire main area inert during a pending navigation. That includes nested workspace content, though header/sidebar are outside it. The verified workspace and provisional subtree together contain 47 route skeleton files named `loading.tsx` under `(soignant)`. Their existence does not imply a layout remount. Dynamic page stale time is zero, so revisiting a tab can still request a fresh RSC payload.
- **Recommendation and expected gain:** Keep the child layout and enforce section-scoped pending feedback for in-dossier workflows. Prefer URL-preserving soft GET transitions with a native fallback, and trace permission-safe prefetch on high-intent actions. Prefetch lightweight route shells first and measure waste before opting into protected content fetching. Aim for **zero unnecessary document reloads**, stable identity, and **under 300 ms** for warm, eligible tab switches where achievable. Full server data reads remain necessary where authorization or clinical freshness demands them.
- **Difficulty/risk:** Medium. Watch back/forward history, Enter submission, focus, form state and scroll position, reduced motion and expired authorization. React rerender or hydration hotspots in the signed-in shell are still hypotheses. Use the Profiler in a production-like synthetic build before changing component memoization.

### F6 · Medium — Some pages reuse authorization but overfetch page-specific data

- **Affected paths and components:** Résumé et impression, Croissance, child forms and registration. `src/lib/registry/read-child.ts:7–18`, verified `patients/[id]/summary/page.tsx:36–48`, `patients/[id]/growth/page.tsx:38–74`, `patients/[id]/records/new/page.tsx:40–63`, `src/components/clinician/growth/measurement-chart.tsx`, verified `patients/new/page.tsx:24–34` and `patients/actions.ts:83,125,198–218`.
- **Root cause and evidence:** The print route reads `get_child_profile` directly while its parent layout uses the memoized read. This can issue two profile RPCs on direct entry. Print gathers three exports before showing content. The raw measurement client receives clinical entries where the chart needs dates, certainty and three numeric measurements. Quick registration may perform sequential prepare and register on submit and then enter the deep vaccination route. Production means were **6.26 ms** for a profile read, **11.72 ms** preparation and **24.90 ms** registration. The browser transfer attributable to private props was not measured.
- **Recommendation and expected gain:** Reuse the same authorized child reader wherever the data contract matches. Shape chart props to actual needs and consider an on-demand complete printable result with a stable initial section. Preserve the existing quick form and first measure write phases separately from the destination load. Expect **one fewer profile RPC** for each render that currently repeats it, fewer serialized chart fields, and a shorter first-visible path for print or registration if the traced export or landing stages dominate.
- **Difficulty/risk:** Medium. Preserve audit events and record visibility, output completeness and attribution, measurement precision and raw chart behavior, duplicate registration and existing redirect semantics.

### F7 · Medium — Public animations and fonts dominate avoidable cold transfer

- **Affected paths and components:** Home and global type, with relevance to login, QR and clinician shells. `src/app/page.tsx:155–204,280`, `src/components/home-feature-animation.tsx`, `src/app/site-design.css:2–8`, `src/app/homepage.css:1–7`, `src/components/brand.tsx`, and `src/components/clinician/child-avatar.tsx`.
- **Root cause and evidence:** A homepage desktop waterfall fetched agenda, vaccine, growth and vaccine-entry looping GIFs totaling **409 KiB encoded**, and the Instrument Sans TTF was **112 KiB encoded / 190 KiB decoded** on all public pages. The homepage Instrument Serif TTF was **37 KiB encoded**. Both use `font-display: swap`. The homepage animation sources are 640 × 384. The raw logo is larger than its displayed header dimensions, and Next serves appropriately smaller variants. Lazy asset hints still permit several near-viewport clips to load during a cold visit. Next image optimization served the emblem at roughly **7 KiB** in Lighthouse. Child avatar URLs are reused local WebPs and should be measured on signed-in routes. The approximately 1 MiB documents illustration and 0.9 MiB welcome PNG exist in source inventory but were absent from the tested public waterfalls. Their size alone establishes no live route impact.
- **Recommendation and expected gain:** Measure equivalent looping motion encodes, load each clip near its actual viewport with an appropriately sized still poster, and convert fonts to WOFF2 with French glyph, weight and layout checks. As a candidate budget, **defer or remove at least 200 KiB** from cold home transfer while preserving both personas and looping motion. Measure LCP independently because the hero heading can paint before the GIFs complete.
- **Difficulty/risk:** Low–medium. Preserve accessibility and reduced motion, visual clarity, font coverage and metrics, responsive hero placement, and avoid screenshot/typography regressions.

### F8 · Medium — Shared browser code has a measurable size floor, with private attribution still missing

- **Affected paths and components:** Public pages and potentially authenticated route shells. `package.json`, `src/app/layout.tsx`, `src/components/workspace-navigation.tsx`, `src/components/sharing/share-entry.tsx`, `src/components/sharing/scan-input.tsx:76`, and `src/components/clinician/growth/measurement-chart.tsx`.
- **Root cause and evidence:** Baseline public JS is **154–169 KiB encoded**. Two hashed chunks common to the three routes account for roughly **118 KiB encoded** and **390 KiB decoded** together. Lighthouse flagged **28 KiB** of potentially unused initial home JS. The waterfall identifies chunk transfer, with module-by-module attribution unavailable from the deployed artifacts inspected. The root server layout also imports workspace styles globally and mounts the client `ParentMobileNav` inside Suspense even on unrelated paths. Its cost is unisolated. Lighthouse records about 20 KiB encoded for a common stylesheet observed on the public routes. Runtime dependencies are Next/React, Supabase, Lucide and QR utilities. There is no dedicated chart or animation package. Growth charts already use local rendering, and QR decoding already imports dynamically. No duplicate runtime module was confirmed. Current clinical bundles and React hydration time were not measured.
- **Recommendation and expected gain:** Generate build-matched module statistics and coverage before splitting code. Inspect which shell controls and initial interactive work actually ship. Consider scoping parent-only client navigation and workspace styles to their respective route layouts if the build report shows a measurable shared cost. Defer seldom-used heavy branches where measured. Use the **28 KiB** Lighthouse finding as a candidate budget for home pending source-level validation. Set private budgets after measuring initial JS, RSC transfer and tab increments separately.
- **Difficulty/risk:** Medium. Ensure early controls remain interactive, QR camera loading is reliable, no extra latency at use time outweighs cold savings, and hydration stays consistent.

### F9 · Medium — Mutation invalidation and reference caching need narrower boundaries

- **Affected paths and components:** Clinical saves/corrections, vaccination reviews, appointment edits, registration and catalogue updates. `src/app/(soignant)/(verified)/patients/clinical-actions.ts:229–244`, `patients/actions.ts:198–217,423–425`, `appointments/actions.ts:121,201` under the same group, `patients/[id]/vaccinations/review-actions.ts:94`, `next.config.ts:18–54`, and `src/proxy.ts:37`.
- **Root cause and evidence:** Writes invalidate multiple related surfaces, sometimes the child layout. Some dependencies are intentional, including dashboard counts, overview and downstream appointments. Current code gives immutable static assets long-lived caching, stores protected responses as private/no-store in transport, and uses request-scoped deduplication for identity and child access. Some catalogue metadata is requested repeatedly and can be isolated from clinical evidence. The exact post-write invalidation fan-out in the client router was not captured.
- **Recommendation and expected gain:** Trace which surfaces actually change per write before narrowing invalidation. Start with request-scoped reference deduplication. Consider shared server caching only for truly public, version-pinned, immutable approved PNI rules, after the existing eligibility gate and with current approval/effective-version resolution and invalidation accounted for. Drafts, capabilities, child data, clinician tokens, QR material and cross-user medical projections stay outside shared caching. Avoid persistent browser storage of private records. Expected improvement is fewer redundant reloads immediately after mutation and fewer catalogue reads, measured separately from F2 to avoid counting savings twice.
- **Difficulty/risk:** Medium–high. Cover correction propagation, scope/permission changes, catalogue approval and withdrawal, cross-session recency and appointment synchronization.

## Prioritized plan for approval

| Order | Work | What would verify the improvement |
|---|---|---|
| 0 | Establish a signed-in baseline with an authorized synthetic fixture and current production build. Capture full-document versus client nav, server timing spans, RSC transfers and per-route JS. Use React Profiler on an equivalent synthetic profiling build. | Record cold and warm samples for every priority flow across desktop, mobile and constrained mobile. Include eight tabs, A→B child changes, deep links, back/forward, refresh, initial sign-in, QR camera initiation and post-write refresh. Measure first paint, tab click→visible content, long interactions and all query stages. |
| 1 | Batch directory SQL and use a lightweight authorized selector (F1). | Compare matched directory/filter query distributions and per-row work. Verify exact visibility, audit and metadata behavior. |
| 2 | Shorten critical child read chains and dedupe authorized/reference data (F2, F6). | Measure child open, booklet and registration end-to-end. Confirm fewer serial stages, preserved clinical outputs and identical access checks. |
| 3 | Measure region/auth contribution and compare existing-plan region placement (F3). | Compare route distributions from equivalent browsers and function instances, account for warm/cold, verify cookie and access behavior. No paid plan assumption. |
| 4 | Improve targeted refresh, feedback and invalidation (F4, F5, F9). | Verify child identity stays mounted, unnecessary document reloads disappear and warm clinical tabs reach **<300 ms where feasible**. Check upstream traffic and stale-data regressions. |
| 5 | Reduce public asset and initial JS bytes and set per-route budgets (F7, F8). | Repeat the same lab profiles, compare LCP and transfer, verify all controls, animations and camera behavior. |

Use **LCP ≤2.5 s, INP ≤200 ms and CLS ≤0.1** as field p75 objectives when adequate representative traffic is available. Keep lab and field results distinct. For authenticated testing, compare identical seeded data, permissions, and access changes across candidate builds. Avoid logging identifiers or medical data. Require direct access and expired/revoked session checks before shipping anything that changes routing, authorization, or caching.

The deliverable is this audit. Production application code, clinical logic, data, schema, infrastructure configuration and subscriptions received no changes.
