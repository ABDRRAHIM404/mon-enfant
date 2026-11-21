# Vaccination reference baseline

The supplied files in `data-for-supa/` are retained unchanged:

- `MON_ENFANT_PNI_DATA.json`
- `MON_ENFANT_PNI_SCHEDULE.csv`

They transcribe the hospital-provided `PNI cours.pptx`, principally slide 67's 2025 calendar, with the agreed project decisions. This checkout does not contain the source presentation, and source transcription does not constitute clinical approval.

Implementation belongs to **Phase 4**. Phase 1 does not calculate due dates, seed clinical schedule tables, mark missing doses as missed, generate catch-up dates or administer doses.

Carry these requirements into Phase 4 tests: all 25 dose rows; PCV1–PCV4 correction; rotavirus calendar months 2/3/4 versus original weeks; girls-only HPV at 11; first-four-week entries as windows; HB1 automatic scheduling disabled and HBn absent; month-end/leap-year arithmetic; incomplete history distinct from confirmed missed doses. Patient-specific decisions remain clinician-controlled.


## Owner-acknowledged vaccination workflow — 17 November 2026

Mon Enfant automatically calculates routine vaccination dates and windows from the supplied PNI documentation as transcribed into the stored, versioned rules, using the child's recorded birth date and applicable eligibility rules. Doctors and nurses check those calculated dates and the child's vaccination history against their vaccination registers, then confirm or manually adjust patient-specific dates through their authorized workflows. Automatic calculations remain enabled.

Keep these meanings distinct:

| Date description | Meaning |
| --- | --- |
| Automatically calculated date / date calculée automatiquement | A routine date or window produced by Mon Enfant from PNI rules and recorded child information. Calculation alone is not professional verification. |
| Professionally verified date / date vérifiée par un professionnel | A date explicitly checked by a doctor or nurse against their vaccination register and the child's history, with any adjustment recorded through the authorized workflow. Do not infer this verification from a calculation, account approval or catalog approval. |

Catalog/source review status and patient-specific professional verification are separate facts. An approved catalog does not establish that a particular child's date has been checked. Provisional read-only previews remain calculated even while the source version is draft; previews must preserve the actual source/version status and do not approve the catalog, assign a trusted reference or establish administration, dose fulfillment or patient-specific verification. This workflow description does not claim a new verification field or completed professional review.

Preserve all existing safeguards: exact-birth/date-certainty and eligibility checks, source provenance and immutable history, current-session permissions, author-only provisional ownership/quarantine, trusted reference-assignment review requirements, duplicate/history checks and auditable corrections. HB1 and catch-up remain manual; calculations do not create appointments, infer administration/attendance or turn undocumented history into confirmed missed doses. Clinicians retain control of replacement dates.

The owner has explicitly acknowledged this calculate → register check → confirm/adjust workflow. Retain clear calculated/verified distinctions and existing contextual safeguards, but do not repeat the same general warning in subsequent handoffs or discussions, or disable calculations because that acknowledged distinction remains true. Raise it again only when a new risk, changed condition or actual problem is detected, identifying the specific issue. Existing external approval items remain tracked in PLAN_CHECKLIST.md.

## Implemented versioned catalog

The initial 25-row transcription is stored with the exact source-file SHA-256 and full raw JSON. Original dose codes/rows/ages and decision provenance cannot be edited. Admins need a separate catalog-management appointment to clone/edit/retire; an approved clinician needs a current vaccination capability and a catalogue review appointment to approve, including when they created or edited the draft. The reviewer must attest source authentication, full clinical review and the interpretation of first-four-week windows (birth through J+27 inclusive). No genuine source approval has been recorded: the initial version remains draft.

Each draft edit increments its expected revision; stale/concurrent mutations return PT409/HTTP 409. Published rules are immutable, retirement retains review/history, and a clone always starts as a new unapproved draft. Every action records actor/reason/evidence and a complete version snapshot; reads of versions and snapshots are paged explicitly. `/vaccines` serves approved professional readers and explicitly authorized catalog staff; general admins have no catalog or patient bypass.

Cloud tests cover all supplied mappings, immutable source, permission/session boundaries, review attestations and agreed constraints. Hosted run `a54c871625` passed 23 form/API/concurrency checks on QA clones only; four fictional accounts and both QA copies were retired. This is technical acceptance of the catalog workflow, not clinical authentication of the presentation or approval of the transcribed schedule.

The calendar module computes date-only routine reference dates/windows, with calendar-month clamping and leap-year tests. Trusted reference assignment retains its reviewed-version gate; provisional read-only date previews calculate without that catalog-review gate, as recorded in the owner-acknowledged workflow above. It does not generate catch-up or appointments, classify undocumented doses as missed, or replace clinician review. Patient-specific reference assignment, vaccine administration and cross-doctor matching are implemented with scoped capability/session checks, immutable mappings and duplicate review. Exact verified administrations can fulfill a clinician-selected item; uncertain transcriptions remain unmatched. Corrections/withdrawals preserve old mappings and can reopen the item. Hosted run `201cf03544` passed all 31 technical form/API/concurrency/export checks using only QA clones; those copies/accounts were retired. The initial source remains draft and no genuine clinical approval is claimed. Appointment calendars and follow-up projections are now implemented and technically verified. Clinicians select every replacement date manually; a passed appointment and a potentially overdue/unconfirmed reference remain separate states. No catch-up schedule or appointment attendance is inferred from missing documentation or a second-doctor administration.
