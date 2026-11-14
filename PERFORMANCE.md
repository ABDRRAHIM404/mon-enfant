# Development performance targets

Phase 6 requires measured performance and defined budgets. These initial targets
apply to each of the six clinical views, both controlled profiles and all three
cloud-browser viewports. They are fixed before accepting the first measurement
run; a miss calls for investigation, not an automatic threshold increase.

| Measurement                 | Development target |
| --------------------------- | ------------------ |
| Document navigation TTFB    | ≤800 ms            |
| First Contentful Paint      | ≤1,800 ms          |
| Largest Contentful Paint    | ≤2,500 ms          |
| Observed session-window CLS | ≤0.1               |

The targets use the published good-experience guidance for
[TTFB](https://web.dev/articles/ttfb), [FCP](https://web.dev/articles/fcp) and
[Core Web Vitals](https://web.dev/articles/vitals). Applying them to each controlled
sample is a development policy. Field Core Web Vitals acceptance requires the
75th percentile, including INP, across representative real sessions. A single
synthetic sample per case cannot establish a percentile or field compliance.

The constrained profile uses 4x CPU slowdown, 150 ms browser request latency,
1.6 Mbps download and 750 kbps upload. Both profiles disable the browser cache
for measured navigation. This is a controlled browser condition, not a claim
that Vercel or the provider cache is cold, or that a physical device was tested.
The measurement window ends after document/font readiness and one second without
an observed LCP/layout/long-task update. Later shifts or interactions remain outside
that observation. Task blocking, load duration and reported transfer/resource
counts are diagnostics; observed blocking is neither Lighthouse TBT nor field INP.

After downloading `synthetic-live-clinical-results` privately, run the lightweight,
credential-free analyzer:

```sh
python3 scripts/analyze-performance.py --input-dir /private/artifact-directory
```

It requires exactly eighteen files, six screens × two profiles × three viewports,
and validates fixed metadata, finite measurements, conditions and full coverage.
The viewport is taken from Playwright's fixed project-name suffix on each output
directory. It reports only allowlisted labels and numeric measurements, never
input paths or unknown payloads. Exit 0 means all observed targets were met;
exit 1 means a target was missed; exit 2 means artifacts were invalid or incomplete.
All reports explicitly retain `performance_acceptance_claimed=false` and
`field_compliance_claimed=false`.

The manual `clinical-performance` workflow runs this comparison after successful
browser measurement and retains `performance-targets.json` with the classified
artifact. A missed target fails that distinct workflow step; invalid or incomplete
measurements also fail. Browser measurement success alone cannot make this gate green.

Repeated representative measurements, response to any misses, interaction/load
coverage and agreed pilot operating targets remain required before broader
performance/readiness acceptance. The independent clinical-ledger readback and
four-account/eight-secret retirement remain mandatory even when measurement fails.
