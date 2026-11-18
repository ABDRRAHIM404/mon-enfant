# Workspace UI rework — 18 November 2026

The supplied screenshot showed the doctor’s child profile still using the old horizontal navigation and generic account-page layout. Care entry was buried in separate child sections. This change carries the current clinician shell through 22 nested/auxiliary pages, adds six explicit child-bound care actions, keeps the child identity visible before forms, and restores the parent shell/context on orphaned child/account/request/notification/invitation pages. Actual system-admin pages are also included through PR #5.

## Delivered surfaces

| Area | Screens/features |
| --- | --- |
| Doctor child record | Overview, capability-aware consultation/vaccination/appointment/growth/treatment/risk actions, child navigation and identity context. |
| Doctor care | Timeline/filter, five entry types and correction histories; appointment list/new/history; vaccination references/history; growth plots; parent-access management; summary/print. |
| Doctor tools | New/paper registration, existing-child linking/lookup, facilities, access requests, registry reviews/resume, parent requests and own permissions. Existing public share entry retains its public/auth boundary. |
| Parent | Existing eight dashboard sections plus consistent child booklet/vaccine/calendar/privacy/request navigation, visible child context before sharing/correction, global requests, notifications, invitation and account. |
| Admin | Overview, verification queue/status/search, review/evidence presentation, compact professional actions and search/status filters, permission search/editor/history, account and catalogue shell. |
| Loading | Existing route skeletons retained; the common workspace remains recognizable. Parent/clinician/admin links retain pending feedback and reduced-motion behavior. |

Permissions remain server-enforced. Unavailable care actions explain missing capabilities instead of providing an unauthorized write link. Expired clinical permissions now say Expirée even if their enabled flag remains true, matching the server’s exclusive expiry boundary. Vaccination/growth forms and histories keep the corresponding main navigation section selected. No clinical interpretation, vaccine rule, RLS, schema, evidence-access route or write-action behavior was changed.

## Relevant verification

Focused UI/workflow/permission-label checks, lint, explicit types and Vercel preview builds pass. The final owner steering is to select checks relevant to this fix; unrelated database/vaccine/email suites are not rerun for final polish. Earlier broader checks are historical evidence, not an ongoing release requirement.

`brief-pages.json` records only three affected authenticated HTTP renders: child care entry, parent sharing with the correct child context, and admin clinical permissions. All use private/no-store responses. The tested preview is dc0c887 / READY dpl_Hy3sgQUvRgMNjF1zoDjy38X5dM6d. A final three-line navigation-selection polish is covered by lint and the required production compilation.

Fresh owner-approved fixture bccf8eb71bf34bc8 exercised actual API sign-in, separate role boundaries, a new fictional child, five persisted attributed clinical entries, a manual appointment, pending guardian denial, verified guardian access, parent requests/responses and notifications. These are API/persistence checks, not browser clicks. Initial driver mistakes were classified: successful void profile responses, Python timezone data disagreeing with both Node and Postgres, and correction state represented by response rather than a state field. A broader HTTP attempt also selected a registration operation no longer in the resumable queue; that unavailable state is not relabelled as a working pending case. No further broad campaign was run after the owner narrowed verification.

## Computer-use limit

The requested signed-in computer-use review remains blocked. Secure browser sign-in returned declined despite the owner reporting submission, and the owner’s interface did not expose the Desktop viewer. The browser tools offered no viewer-opening operation or working takeover link. New fixture accounts were used through normal authenticated API/HTTP clients; no cookies, tokens or authentication bypass were injected into the shared browser. No authenticated screenshot, mobile/keyboard interaction acceptance or full accessibility audit is claimed for this pass.

## Fixture retirement

The owner explicitly approved creation and cleanup of these three new test accounts. The guardian link was revoked through its authorized parent account, then exact-marked cleanup banned all three, cleared temporary credentials/sessions and revoked their grants, capabilities, facility memberships and staff rights. Independent readback confirms three retired actors and zero remaining authority/session counts (`retirement.json`). Clinical/audit histories remain. Earlier six-account cleanup is separate and still pending its own approval; those accounts were not reused or modified.

Source UI work and scoped checks: passed. Full signed-in computer-use audit: blocked by session/viewer tooling. Canonical publication is tracked in PR #5’s deployment records.
