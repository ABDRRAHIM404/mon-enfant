# Update 5 — canonical website stabilization

Requirements: updates/MON_ENFANT_UPDATE_5_WEBSITE_STABILIZATION.md. Website work supersedes APK development; no Android/iOS feature builds. APK work resumes only after the owner's review and approval.

## Execution and evidence

1. Reproduce the current canonical clinician navigation and provisional HB1 save/reload/history experience in cloud desktop and Android browsers. Capture actual screens, click results, JavaScript errors and independent synthetic database readback before changing application code.
2. Explain root causes in UPDATE_5_BUG_REPORT.md; fix only demonstrated navigation/history/status/scheduling defects. Preserve PNI source, HB1 disabled automation, authorization and quarantine.
3. Verify canonical trusted HB1 history and a separate QA-reviewed permitted routine reference, explicit clinician-planned catch-up appointment, reload/persistence/correction and denial. Retire QA versions without changing the original draft.
4. Walk through every visible clinician, parent and admin feature, including actual clinician→parent updates, recipient-bound QR claim/replay/expiry/approval/additional guardian/revocation, unrelated-user denials and current sessions/logout.
5. Publish fixes, verify actual canonical deployment and independent persistence; produce UPDATE_5_ACCEPTANCE.md with Pass / Fail / Blocked for every feature, exact environment/source and screenshot/CI/readback evidence. Record genuinely untested email/external gates as Blocked/open.
6. Synchronize primary main with GitHub and ask the owner to review the concrete report. Keep APK paused until explicit owner approval.

| Milestone                                             | Status  | Evidence                                           |
| ----------------------------------------------------- | ------- | -------------------------------------------------- |
| Current canonical reproduction                        | Pending | New focused cloud capture required                 |
| Navigation root cause / correction                    | Pending | No application fix before reproduction             |
| HB1 historical persistence / honest next-state        | Pending | No automatic HB catch-up                           |
| Independent reviewed routine / manual appointment     | Pending | QA-only source clone, separate reviewer            |
| Clinician / nurse / provisional lifecycle             | Pending | Actual clicks, save, reload, correction and denial |
| Parent complete website journeys                      | Pending | Actual synthetic clinician→parent→clinician flow   |
| Admin review / permissions / source histories         | Pending | Preflight must exclude non-fixture identity data   |
| Global desktop / Android, themes, keyboard / touch    | Pending | New current-run screenshots and interactions       |
| Canonical publication / readback / fixture retirement | Pending | Keep each fixture scoped and recorded              |
| Owner review / permission to resume APK               | Pending | Explicit owner decision required by Update 5       |

Existing accepted Updates 1–4 and prior test runs remain historical evidence, not a substitute for this new canonical functional walkthrough. SMTP general delivery, qualified clinical/source/credential/guardian/privacy/hosting and unfinished Phase 6 approvals remain open. Physical Android test 18fd1a08ce97474b is deferred by the owner and remains separately scoped; do not reuse its invitation/accounts for website tests or repeat its one-shot preparation.
