# Acceptance stories — complete planned product

Derived from PROJECT_INFO.md and PROJECT_PLAN.md. These are software acceptance contracts. Clinical, identity/guardianship, legal and regulated-hosting validation remain external approval gates. Stories do not authorize real-data use.

| ID / phase | Story | Required acceptance evidence |
| --- | --- | --- |
| D01 / 1 | As a professional, sign up, confirm my account, sign in/out and recover access. | Current Auth session validated on the server; unverified by default; no editable-metadata authorization; expiry/refresh/logout and email/callback failure paths tested. |
| D02 / 1–2 | Submit my working matricule and identity evidence for review. | Private bounded file, owner/role checks, immutable submitted original, pending state without clinical privileges; duplicate identifier and repeat-submission controls. |
| A01 / 2 | As an explicitly authorized reviewer, examine and decide an application. | Admin role alone is insufficient; private access trace; identity and appropriate registration-source checks for approval; reason/actor/time retained; no self/repeated review. |
| A02 / 2 | Suspend/reactivate an approved doctor's account. | Reasoned immutable history; current-state RLS cuts access despite an old JWT; no shortcut from unverified to approved. |
| D03 / 3 | Maintain my own clinic/year/book register while retaining each child's permanent identity. | Scoped local-number uniqueness; list/search only authorized children; ID remains permanent across providers. |
| D04 / 3 | Manually register a new child or digitize a paper record. | Required known fields validated; unknown/estimated values explicitly represented rather than invented; paper provenance; duplicate warnings with human review and no automatic merge. |
| D05 / 3 | Link an existing child to my own register with authorization. | Lookup identifier alone grants nothing; recorded access approval; authorized A/B test yields one child and separate local numbers; unrelated professional cannot discover/read child demographics. |
| D06 / 4 | Record a consultation, treatment/prescription, risk or growth measure with explicit clinical privileges. | Actor/platform professional/facility/date/source/units retained; role/capability/child authorization; bounds and uncertainty; authorized timeline and raw measurement charts. |
| D07 / 4 | Record a vaccination or manually transcribe one from paper. | Versioned dose assignment, lot/site/provider/source; source verification; duplicate warning and audited override; retry-safe transaction; another authorized professional sees the same event. |
| D08 / 4 | Correct an erroneous record without hiding the original. | Append-only amendment reason/author/date, prior revision retained, expected-version conflict check and authorized audit view. |
| A03 / 4 | Maintain draft and clinically approved schedule versions. | All 25 supplied rows/source ages/decisions preserved; PCV/rotavirus/HPV/birth-window constraints; HB1 disabled; no catch-up or HBn special-case invention. Qualified approval evidence before activation. |
| D09 / 5 | Plan routine or manual follow-up appointments and see daily/weekly/monthly queues. | Routine reference dates only; clinician manually chooses catch-up; completed/missed/cancelled/rescheduled history; no administration manufactured by rescheduling. |
| D10 / 5 | Resolve a vaccine follow-up when another authorized doctor administers its intended dose. | Validated mapping updates the relevant shared item/worklist without stale duplicate reminders or cancelling independent consultation appointments. |
| D11 / 4–6 | Export/print the patient's permitted clinical summary and review my activity. | Server/database access checks, authorship/corrections/source preserved, no unauthorized exports or identifying analytics leakage. |
| A04 / 6 | Monitor operations and investigate necessary events. | Privacy-preserving statistics/logs, least-privilege audit access, alerts/escalation, retention execution and backup/restore evidence; no blanket patient access by admin role. |
| P01 / 7 | As a parent, claim an existing child after verified guardianship. | Authenticated account, hashed one-use expiring invitation, separate guardianship proof/approval, atomic linking rather than duplicate child creation; unrelated scanner denied. |
| P02 / 7 | View my children's permitted booklet, visits, vaccinations, growth and appointments. | Child/guardian-scoped read access, appropriate professional attribution, readable responsive views and permitted export; parents cannot author clinician records. |
| P03 / 7 | Manage additional guardians, requests, contact/privacy settings and access history. | Verified additional links and revocation, correction requests instead of overwrites, traceability and no QR blanket authorization. |
| M01 / 8 | Use the parent experience on Android/iOS with the same secure backend. | Documented mobile approach, secure sessions, child/booklet/appointment/notification experience, cloud compilation and feasible device/runtime evidence. |

## Cross-cutting edge-case suite

- Unverified, rejected, suspended, general admin, permitted reviewer, approved professional and guardian boundaries; no self-granted role/capability.
- Active/expired/revoked child grants; second doctor receives a distinct local number; duplicate names/birth dates/phones never cause an automatic merge.
- Missing names, unknown/estimated dates, incomplete paper history and uncertain provenance remain explicit. An undocumented historical dose is not proof of a missed vaccination.
- Date-only month ends, leap days and timezone changes; first-four-week windows; calendar-month rotavirus versus week-based VPO/Penta; girls-only HPV and unknown sex; HB1 automatic scheduling always off.
- Concurrent writes, repeat network requests, stale corrections, duplicate administrations, conflicting review decisions, expired/reused invitation tokens and simultaneous claims.
- Missed appointment versus unconfirmed/potentially overdue dose; rescheduling retains the old event/reason/actor and leaves vaccination pending; cross-doctor reconciliation preserves unrelated appointments.
- Private evidence cannot be publicly fetched/replaced; bounded signed URLs; exports and logs minimize patient/identity information; backup restore and incident/retention procedures are actually exercised before readiness.

## Explicit scope decisions awaiting qualified/human approval

Official credential and guardianship verification sources; real document retention/holds; clinical source approval and any vaccine exceptions; production hosting/privacy obligations; final brand/languages; native release/distribution arrangements. Fictional-data implementation may progress while these remain open. No code or green test substitutes for these approvals.
