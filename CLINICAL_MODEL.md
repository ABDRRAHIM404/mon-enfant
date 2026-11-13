# Clinical record design — implementation contract for Phases 3–5

This is a software model derived from the agreed requirements, not a medical protocol. The capability/consultation/prescription/risk/growth ledger, amendments, timeline and permitted exports are implemented. The versioned vaccine catalog/editor/review workflow is implemented and verified; child vaccine references/administrations, appointments and parent workflows below remain unfinished. Use fictional data until the clinical/legal/hosting gates are approved.

## Identity and authorization

Keep the immutable child key and permanent universal ID distinct from professional/facility/year/book/local-register numbers. An association in a register is not an authorization grant. Every read/write must check the current account state and an active, non-expired, non-revoked child grant in the database. A child lookup QR identifies a record and confers no permission. Existing-child linking requires a recorded authorization workflow, not a global unrestricted demographic search.

Account approval permits the professional workspace and authorized record reads. It must not silently grant every clinical action. Vaccination and other privileged writes need explicit verified capabilities managed by authorized staff, with an audit trail. Future nurse/support roles receive narrower capabilities.

## Clinical events and corrections

Each consultation, measurement and vaccine event stores the immutable child key, author Auth key, platform professional ID, facility, occurrence date/time, entry date/time, provenance and source-verification state. Transcribed historical entries retain uncertainty and are never presented as contemporaneously observed by the author. Units remain explicit: kilograms and centimetres for the relevant growth measures; charts initially show recorded values, without invented reference percentiles.

Original clinical rows are append-only. A correction is a separate immutable row with target event ID, previous revision/version, replacement fields, reason, actor/facility and timestamp. A read projection follows the latest valid amendment while retaining the original and each intermediate version. Concurrent amendments must check the expected revision in a transaction and reject a stale revision. Withdrawals are audited events, not silent row deletion. Exports show original authorship and corrections with appropriate access checks.

## Versioned vaccine source

Keep the supplied catalog/source files unchanged. A source version stores the original age/unit/slide reference plus the configured age/unit and decision provenance. Publish a version only through an explicitly authorized clinical-review workflow; the initial transcribed data remains a draft until qualified review is recorded. Existing administrations retain their original schedule-version mapping.

The implementation must preserve all 25 supplied rows, disable HB1 automatic scheduling, add no HBn special-case row without clarification, keep birth windows as windows, apply PCV labels, use rotavirus calendar months and retain source weeks, and limit HPV eligibility to girls at 11. Date arithmetic uses date-only civil arithmetic, with month-end/leap-year tests. Never auto-group differing week/month dates or prescribe a catch-up schedule.

## Matching and continuity

A recorded administration and a planned schedule item are different entities. Match only a clinician-validated dose assignment with the intended item/version and sufficient source information. Potential duplicate administrations require an explicit warning and a reasoned, audited override; unique operation IDs make retries safe. Uncertain transcriptions remain unconfirmed, not silently fulfilled.

An authorized second doctor's validated administration updates the shared child record and relevant vaccine follow-up items transactionally. It does not complete an unrelated consultation, cancel independent appointments, or manufacture administration from rescheduling. Notifications contain only the minimum needed for the authorized doctor's worklist.

## Appointments and follow-up

Appointments store child, responsible professional/facility, purpose, schedule-item reference when relevant and timestamps. Separate planned/completed/missed/cancelled/rescheduled events. Passing an appointment time without completion may flag a missed appointment; missing historical vaccine documentation alone must not establish a missed dose.

Rescheduling appends old/new dates, actor, timestamp and reason, retains the original missed event, and leaves the dose pending. The clinician chooses replacement/catch-up dates manually. Read models distinguish documented completion, upcoming routine references, potentially overdue/unconfirmed items and unknown history.

## Parent access (Phase 7)

Guardianship is a separate relationship from professional grants. Store parent identity/verification, scoped child links, consent/authority provenance, access history and revocation. Store only hashes of one-use invitation secrets, expiry and consumption state. Redeeming a QR is insufficient by itself: authenticate the parent and complete a separate, recorded guardianship-verification step before linking the existing child. Parents do not write clinician records or create a duplicate child through claiming an invitation.
