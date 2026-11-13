# Vaccination reference baseline

The supplied files in `data-for-supa/` are retained unchanged:

- `MON_ENFANT_PNI_DATA.json`
- `MON_ENFANT_PNI_SCHEDULE.csv`

They transcribe the hospital-provided `PNI cours.pptx`, principally slide 67's 2025 calendar, with the agreed project decisions. This checkout does not contain the source presentation, and source transcription does not constitute clinical approval.

Implementation belongs to **Phase 4**. Phase 1 does not calculate due dates, seed clinical schedule tables, mark missing doses as missed, generate catch-up dates or administer doses.

Carry these requirements into Phase 4 tests: all 25 dose rows; PCV1–PCV4 correction; rotavirus calendar months 2/3/4 versus original weeks; girls-only HPV at 11; first-four-week entries as windows; HB1 automatic scheduling disabled and HBn absent; month-end/leap-year arithmetic; incomplete history distinct from confirmed missed doses. Patient-specific decisions remain clinician-controlled.


## Implemented versioned catalog

The initial 25-row transcription is stored with the exact source-file SHA-256 and full raw JSON. Original dose codes/rows/ages and decision provenance cannot be edited. Admins need a separate catalog-management appointment to clone/edit/retire; an independent approved doctor also needs a current vaccination capability and a separate review appointment to approve. The reviewer must attest source authentication, full clinical review and the interpretation of first-four-week windows (birth through J+27 inclusive). No genuine source approval has been recorded: the initial version remains draft.

Each draft edit increments its expected revision; stale/concurrent mutations return PT409/HTTP 409. Published rules are immutable, retirement retains review/history, and a clone always starts as a new unapproved draft. Every action records actor/reason/evidence and a complete version snapshot; reads of versions and snapshots are paged explicitly. `/vaccines` serves approved professional readers and explicitly authorized catalog staff; general admins have no catalog or patient bypass.

Cloud tests cover all supplied mappings, immutable source, permission/session boundaries, review attestations and agreed constraints. Hosted run `a54c871625` passed 23 form/API/concurrency checks on QA clones only; four fictional accounts and both QA copies were retired. This is technical acceptance of the catalog workflow, not clinical authentication of the presentation or approval of the transcribed schedule.

The calendar module computes gated date-only routine reference dates/windows, with calendar-month clamping and leap-year tests. It does not generate catch-up or appointments, classify undocumented doses as missed, or replace clinician review. Patient-specific reference assignment, vaccine administration and cross-doctor matching are implemented with scoped capability/session checks, immutable mappings and duplicate review. Exact verified administrations can fulfill a clinician-selected item; uncertain transcriptions remain unmatched. Corrections/withdrawals preserve old mappings and can reopen the item. Hosted run `201cf03544` passed all 31 technical form/API/concurrency/export checks using only QA clones; those copies/accounts were retired. The initial source remains draft and no genuine clinical approval is claimed. Appointment calendars and follow-up projections are now implemented and technically verified. Clinicians select every replacement date manually; a passed appointment and a potentially overdue/unconfirmed reference remain separate states. No catch-up schedule or appointment attendance is inferred from missing documentation or a second-doctor administration.
