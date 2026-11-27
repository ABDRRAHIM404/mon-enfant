# Mon Enfant — Phase 1 performance audit

The [authenticated production baseline](#step-0--authenticated-production-baseline) and refined priorities appear below the original signed-out audit.

**27 November 2026 · Africa/Casablanca**

**Production:** [mon-enfant.vercel.app](https://mon-enfant.vercel.app/) · Vercel deployment `dpl_8BiaGEdHpJv14j6tXZkEgC48N8Wh` · source `6f58072905f3b8730681f1cde19a0c564ab25398`

## Executive findings

- **Enfants is the strongest confirmed backend bottleneck.** The production `list_patients` SQL fingerprint averaged **210 ms over 387 calls**, peaked at **1,597 ms**, and accumulated about **81 seconds of SQL execution**. One server RPC runs a visit-summary calculation for every child returned, even when the caller only needs a child selector.
- **Dossier enfant has an existing persistent layout.** Same-child tab links use Next.js navigation and retain the shared identity by design. The earlier mock-backed checks verified identity DOM persistence on desktop, tablet and mobile. Current source shows substantive differences in what each tab must fetch. The overview and vaccination booklet have the deepest read chains. Current authenticated tab latency, React commit cost and production DOM stability were unmeasured at the initial checkpoint.
- **The app and database are separated by the Atlantic.** The Vercel function region is Virginia (`iad1`) and Supabase is in Paris (`eu-west-3`). Sequential auth, reference and clinical reads can multiply the effect. Their direct round-trip latency, middleware duration and Vercel cold-start contribution remain unmeasured.
- **Public pages transfer substantial assets on a first visit.** On constrained mobile, median cold transfers were about **718 KiB** for home, **334 KiB** for login and **378 KiB** for the public QR page. A separate Lighthouse homepage run measured **2.57 s LCP**. The homepage GIFs and the shared sans font are the largest attributable public asset costs.
- **At the initial checkpoint, the signed-in baseline was outstanding.** Production probes exercised the sign-in guard on every clinician route. This session had no usable authorized synthetic login. Current credential submission, opening a real synthetic chart, clinical tab changes and the verified QR camera workflow could therefore not be measured. The SQL telemetry identifies server work independently of that limitation.

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


## Step 0 — Authenticated production baseline

**27 November 2026 · Africa/Casablanca.** The production alias resolved to Vercel deployment `dpl_257CE2TDj3iamdhJttUvENzXktqs`, Git SHA `0e8c16d36ccd4028ffcd9447c38c2d45ecd8fe90`. That commit adds the initial audit document. The app source is the same as the original audit baseline. The original audit above is retained as a dated signed-out comparison.

An authorized, temporary clinician signed in through the regular clinician form. Scope was one verified synthetic account, two fictional child records created through Inscription rapide, and one fictional practice. Both child identities and clinical writes belonged to that account. No clinical record belonging to another account was opened. The isolated harness used the established cloud Chromium and synthetic fixture workflow. Credential material stayed in a restricted temporary workspace. After testing, the account was signed out and disabled. Independent database readback found zero sessions, child grants, enabled capabilities or active practices. The two fictional children and three synthetic consultations remain in the audit history. The report contains no patient identifiers, credentials, request bodies or session tokens.

Desktop used 1440 × 900, mobile used 390 × 844 at DPR 2, and constrained mobile used the same viewport with 4× CPU slowdown, 150 ms added latency, 1.6 Mbps down and 0.75 Mbps up. Each document route has one browser-cache-disabled observation and the median of two warm observations per profile. This is a browser cache experiment. It does not establish function cold starts. Each tab has one first visit and one revisit per profile in the same session. Login, save and child-switch durations are observed lab samples. The fixture represents a small account with two children. It is useful for causality and regression comparisons and does not represent a large clinician registry.

“Ready” is elapsed time to the target heading or success content using the browser automation wait. This includes detection/polling overhead and should be treated as an upper-bound estimate of actual content visibility, especially for the ~830 ms clusters. TTFB and LCP are document timing metrics. Next.js client transitions have no new document TTFB or LCP. Their foreground request timings are reported separately. Request counts include observed prefetch and cache activity. Bytes count completed wire transfers within the bounded sampling windows and are lower bounds when prefetch or streaming responses are still in flight. A displayed zero KiB can be a rounded sub-KiB observation. Test sizes are too small for field percentiles.
### Document and sign-in/action measurements

Each cell shows **ready / document TTFB / document LCP / requests / observed KiB**. Timings are in milliseconds. A dash indicates no new document metric or no verified sample.

| Flow | Cache | Desktop | Mobile | Constrained mobile |
|---|---|---:|---:|---:|
| Tableau de bord | Uncached | 1332 / 540 / 1420 / 39 / 348 | 1109 / 280 / 1140 / 34 / 380 | 1648 / 270 / 2156 / 31 / 378 |
| Tableau de bord | Warm | 971 / 314 / 980 / 36 / 25 | 1010 / 258 / 984 / 36 / 43 | 1104 / 288 / 1094 / 41 / 43 |
| Enfants | Uncached | 1376 / 290 / 1524 / 41 / 398 | 1257 / 448 / 1344 / 37 / 417 | 1709 / 277 / 2416 / 34 / 303 |
| Enfants | Warm | 1338 / 338 / 1320 / 40 / 43 | 1020 / 248 / 1012 / 29 / 43 | 1184 / 304 / 1136 / 30 / 36 |
| Inscription rapide | Uncached | 953 / 443 / 1028 / 32 / 357 | 769 / 289 / 764 / 29 / 351 | 1647 / 256 / 1636 / 29 / 351 |
| Inscription rapide | Warm | 979 / 378 / 816 / 36 / 26 | 644 / 266 / 638 / 31 / 38 | 775 / 266 / 738 / 34 / 36 |
| Ouvrir le dossier | Uncached | 1806 / 316 / 964 / 47 / 372 | 1750 / 258 / 1724 / 46 / 379 | 1959 / 469 / 1936 / 31 / 372 |
| Ouvrir le dossier | Warm | 2086 / 268 / 742 / 52 / 39 | 1342 / 252 / 1324 / 47 / 49 | 1620 / 250 / 1568 / 52 / 47 |
| Carnet vaccinal | Uncached | 2433 / 306 / 1152 / 48 / 358 | 1651 / 242 / 792 / 48 / 371 | 2140 / 266 / 1700 / 38 / 366 |
| Carnet vaccinal | Warm | 2171 / 308 / 760 / 46 / 36 | 1432 / 272 / 930 / 50 / 59 | 1678 / 264 / 966 / 54 / 53 |
| Rendez-vous global | Uncached | 1278 / 263 / 1332 / 39 / 393 | 1014 / 249 / 980 / 43 / 417 | 1668 / 285 / 1664 / 25 / 332 |
| Rendez-vous global | Warm | 1237 / 356 / 1324 / 38 / 75 | 977 / 277 / 930 / 42 / 91 | 1117 / 300 / 1090 / 44 / 143 |
| Rendez-vous enfant | Uncached | 1243 / 439 / 968 / 37 / 344 | 1192 / 261 / 1192 / 39 / 357 | 1790 / 425 / 1780 / 36 / 355 |
| Rendez-vous enfant | Warm | 1428 / 405 / 814 / 44 / 28 | 1018 / 267 / 988 / 39 / 43 | 1064 / 252 / 1026 / 42 / 37 |
| Connexion, formulaire | Action | 818 / 364 / 754 / 24 / 327 | 762 / 319 / 656 / 24 / 332 | 1476 / 382 / 1336 / 13 / 200 |
| Connexion, envoi → tableau de bord | Action | 2602 / — / — / 28 / 57 | 2734 / — / — / 28 / 101 | 2035 / — / — / 35 / 88 |
| Enfant A → Enfants → enfant B | Action | 2832 / — / — / 20 / 68 | 2905 / — / — / 17 / 61 | 3632 / — / — / 17 / 70 |
| Enregistrer une consultation | Action | 1906 / — / — / 38 / 30 | 2042 / — / — / 18 / 31 | 1929 / — / — / 13 / 20 |
| Recharger le soin enregistré | Action | 1139 / 450 / 828 / 39 / 27 | 932 / 259 / 920 / 38 / 47 | 1039 / 306 / 1024 / 36 / 30 |

### Eight child tabs

Each cell shows **ready ms / RSC headers ms / requests / observed KiB** for one visit. The heading or section-specific content was visible at the end of each measured switch.

| Tab | Desktop first | Desktop return | Mobile first | Mobile return | Constrained first | Constrained return |
|---|---:|---:|---:|---:|---:|---:|
| Vue d’ensemble | 1841 / 468 / 7 / 5 | 1327 / 289 / 2 / <1 | 1829 / 254 / 9 / 4 | 1835 / 238 / 2 / 6 | 1442 / 273 / 9 / 2 | 1454 / 292 / 2 / <1 |
| Consultations | 1187 / 299 / 23 / 14 | 851 / 280 / 3 / 1 | 1347 / 294 / 15 / 14 | 833 / 248 / 2 / 4 | 1517 / 270 / 14 / 19 | 911 / 288 / 2 / <1 |
| Dossier clinique | 1363 / 436 / 11 / 25 | 851 / 275 / 2 / <1 | 1865 / 957 / 4 / 2 | 834 / 263 / 2 / 4 | 1002 / 278 / 4 / 2 | 918 / 325 / 2 / <1 |
| Vaccinations | 2348 / 450 / 13 / 20 | 1886 / 323 / 2 / <1 | 1847 / 274 / 13 / 33 | 1343 / 270 / 2 / 7 | 1985 / 282 / 13 / 14 | 1408 / 285 / 2 / 1 |
| Rendez-vous | 1358 / 418 / 6 / 4 | 837 / 282 / 2 / <1 | 1338 / 262 / 7 / 3 | 852 / 280 / 2 / <1 | 968 / 277 / 7 / 3 | 1018 / 270 / 2 / <1 |
| Croissance | 1331 / 453 / 6 / 11 | 837 / 309 / 2 / 1 | 831 / 241 / 7 / 11 | 856 / 247 / 2 / <1 | 946 / 267 / 7 / 11 | 915 / 264 / 2 / <1 |
| Accès des parents | 1346 / 424 / 3 / 4 | 849 / 268 / 2 / <1 | 831 / 254 / 5 / 5 | 825 / 274 / 2 / <1 | 916 / 245 / 5 / 6 | 962 / 248 / 2 / <1 |
| Résumé et impression | 1346 / 431 / 3 / 1 | 841 / 289 / 2 / <1 | 1344 / 270 / 3 / 1 | 839 / 272 / 2 / <1 | 1402 / 475 / 3 / 1 | 1443 / 252 / 2 / <1 |

### What the browser verified

- **All eight tabs stayed in one workspace.** Across 48 switches, the browser stayed in the same document and retained the child identity, tab bar and shell DOM nodes. Each click issued a foreground RSC request, including all 24 revisits. The first-visit ready estimates ranged from **831 to 2,348 ms**, median **1,347 ms**. Revisits ranged from **825 to 1,886 ms**, median **884 ms**. DOM node retention does not measure React rerender cost. No overlay or inert transition was observed on those 48 tab clicks.
- **The child switch replaced the intended identity.** From A, the clinician returned to Enfants and opened B. The shell and browser document survived, the child identity and tab bar were replaced, and B’s identity was visible. The two foreground RSC requests were serial. The second began **1,335 / 1,311 / 1,905 ms** after the first on desktop/mobile/constrained mobile. End-to-end ready times were **2.83 / 2.91 / 3.63 s**, including automation between clicks. First RSC headers came back in **272 / 264 / 337 ms**, then the selected child request took **266 / 276 / 307 ms** to headers.
- **Clinical writes and refresh worked on all three profiles.** One distinct synthetic consultation per profile reached the saved clinical record and remained visible after a hard refresh. The save POST reached response headers in **1,170 / 830 / 1,090 ms**. The save used a Next server action in the existing document. The following reload was an intentional full document request. The two desktop fixture registrations through Inscription rapide took **2,593 ms** and **2,398 ms** from submit to the new booklet; their POSTs reached headers in **1,776 ms** and **1,279 ms**. No duplicate fixture write was retried after success.
- **Broad overlays occur on selected links.** A desktop Dashboard → Ajouter un enfant click and a Consultations → Nouvelle consultation click each inserted the route overlay and toggled main from interactive to inert and back. Their ready times were **1,382 ms** and **832 ms**. The in-dossier form click retained both identity and navigation in the DOM. The overlay covered/intercepted main content during the transition. This is the UI mechanism behind some perceived full-page loading, alongside ordinary content skeletons.
- **Dashboard refresh reissues the route.** With the signed-in dashboard visible and idle, a foreground dashboard RSC fetch started **60,000 ms** after the first request captured in the refresh observation. It returned headers after **335 ms**, in the same document and without an overlay. The wider observation also included initial and post-response prefetch activity. It would be misleading to assign all 45 observed requests to the interval. From the page source, the refresh re-executes dashboard data loading. An isolated per-refresh Supabase call count was unavailable.
- **Early paint can substantially precede clinical readiness.** For example, the uncached desktop booklet painted its largest observed element at **1,152 ms**, but waited **2,433 ms** for the booklet heading. A page-wide LCP target alone would miss delays after the workspace shell first appears.

### Server request waterfalls and SQL duration

Four separate authenticated HTML GETs used the same synthetic clinician without a browser JavaScript prefetcher. The four request windows were sequential with one-second separation. Supabase gateway records were restricted to that fixture actor and matched by the isolated request times. The observed operation order is shown below. Arrows indicate successive groups in the measured window and concurrent calls are in parentheses. Network/client timings differ from Postgres execution. Upstream service is the provider gateway's reported upstream duration. It can include API, database and connection handling. It is not statement-only duration.

| Requested page | Full HTML elapsed | Observed upstream sequence |
|---|---:|---|
| Enfants | 1,317 ms | Auth user twice → professional profile → `list_patients`. The directory RPC reported **322 ms upstream**, **469 ms gateway origin time**. |
| Dossier overview | 2,084 ms | Auth user twice → profile → (visit overview, capabilities, child identity) → (access grants, catalogue list) → catalogue detail → (clinical timeline, vaccine items, historical reviews) → clinician labels. Two catalogue calls reported **6 / 19 ms upstream** and **274 / 204 ms origin time**. Their gateway event times were 300 ms apart. |
| Vaccination booklet | 2,244 ms | Auth user twice → profile → child identity → (timeline, items, capabilities, catalogue list) → catalogue detail → historical reviews → (another catalogue call, facilities). The three catalogue calls reported **14 / 26 / 7 ms upstream** and **112 / 360 / 109 ms origin time**. Catalogue calls began again about 0.13 s after the first gateway event and about 0.50 s after the second. The fixture had a small ledger and did not exercise extra history pages. |
| Global Rendez-vous | 844 ms | Auth user twice → profile → (facilities, workspace, capabilities). The workspace RPC reported **51 ms upstream**, **154 ms origin time**. |

Each of these four requests showed two fresh Auth user lookups and one professional profile read. This supports separating duplicate identity work on one server request from profile reads that are expected when a new route is requested. The supabase gateway footprint of 35 events was all `IAD`. The median difference between the gateway's origin and upstream durations was **103 ms**, range **93–375 ms**. This measures combined gateway/origin overhead in this sample. It does not isolate Virginia–Paris network RTT, function cold starts or providers' queue times. Routing evidence for all four Vercel responses was `cle1::iad1`, with Supabase PostgreSQL in Paris. The measured serial rounds and this combined overhead are stronger evidence for reducing dependent cross-service reads than an estimate based on geography alone.

Updated production-wide top-level SQL aggregate through this audit session, using the same reset timestamp as the original table. These are query durations across all callers and cannot be attributed to the test clinician's individual requests.

| SQL fingerprint | Calls | Mean execution | Maximum |
|---|---:|---:|---:|
| `list_patients` | 403 | 201.82 ms | 1,597.43 ms |
| `professional_profiles` match | 10,886 | 2.59 ms | 747.40 ms |
| `my_clinical_capabilities` | 2,274 | 6.10 ms | 557.65 ms |
| `get_child_profile` | 1,075 | 6.25 ms | 467.59 ms |
| `vaccine_catalog` | 1,347 | 12.67 ms | 590.95 ms |
| `clinical_timeline` | 463 | 7.07 ms | 223.83 ms |
| `vaccination_booklet_reviews` | 60 | 8.17 ms | 124.36 ms |
| `appointment_workspace` | 54 | 53.24 ms | 210.41 ms |

### European function placement

The project handoff identifies `bounga` as **Hobby**, and a current Vercel eligibility readback reports a plan below Pro/Enterprise for rolling releases. Vercel's function configuration docs allow a single selected region on Hobby. The official list includes **Paris `cdg1`**, the same underlying AWS region (`eu-west-3`) as the Supabase project. One Paris function region is therefore available within the documented Hobby limit. Two simultaneous function regions on the current plan would exceed it. No function region, project setting or billing plan was changed during testing. A controlled same-code Paris comparison remains a future experiment. [Function regions and plan limits](https://vercel.com/docs/functions/configuring-functions/region) · [Vercel region list](https://vercel.com/docs/regions)

### Refined order after the authenticated baseline

| Order | Approved roadmap item | Measured acceptance to carry forward |
|---|---|---|
| 1 | Batch registry SQL and use the lightweight authorized selector. | Compare statement p50/p95, same child and audit results, and end-to-end Enfants and A→B journeys. Include a larger fixture with representative record counts. |
| 2 | Shorten overview and booklet dependency chains and deduplicate catalogue/reference reads within the authorization boundary. | Start with the measured **2.08 s overview / 2.24 s booklet** HTML samples, two overview and three booklet catalogue calls. Compare click-to-content with an in-browser readiness event, and require equivalent review, validity, PNI and clinical outputs. |
| 3 | Benchmark a same-code Paris function placement and investigate repeated verified identity reads. | Hold the synthetic fixture, source and browser conditions constant. Compare gateway overhead, repeated Auth counts, and browser navigation. Preserve session revocation, role checks and RLS. Measure before choosing production placement. |
| 4 | Target repeat tab fetches, route-level auto-refresh and broad overlays. | Keep identity, shell and tab continuity. Reduce unnecessary foreground RSC requests and whole-route polling while keeping clinical freshness. Scope loading feedback to the changing panel or invoking link. Retest the **<300 ms** warm tab goal with in-browser timestamps so automation polling does not dominate. |
| 5 | Reduce initial bytes once slow clinical stages are addressed. | Compare both document LCP and target-section visibility. Review route prefetch budget, GIF/font work and measured JS coverage. |

Remaining measurement limits are per-action SQL traces and direct interregion RTT, Vercel cold-start timings, private field INP and React commit profiles, large registries, longer vaccination histories, and physical Moroccan device/network coverage. The lab baseline covers the requested current flows. It gives concrete browser times, observed upstream call order and separate aggregate SQL timing without enabling new production instrumentation.
