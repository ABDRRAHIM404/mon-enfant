> Update 1 supersedes the previous authorized-only duplicate warning: a rate-limited, registration-bound private check may return a generic possible-match warning for trusted records, never a global search result or an access grant. Update 2 will add isolated author-only provisional records, excluded from cross-clinician probes and sharing. No automatic promotion on account approval. See `UPDATE_WORK_PLAN.md` and the original supplied requirements in `updates/`.

# Phase 3 implementation contract

This is the implemented registry contract. It implements the registry scope in PROJECT_PLAN.md; it does not close the clinical/legal/hosting gates or add a catch-up protocol. See USER_STORIES.md D03–D05 and CLINICAL_MODEL.md.

## Data and unknowns

- Add professional/facility membership. Approved doctors can maintain a declared practice/register scope; unverified/suspended/admin accounts cannot create trusted clinical registry records. Update 2 permits unverified doctors/nurses to create isolated records in the separate private provisional ledger, without trusted grants or sharing. Record the declaring professional and timestamp. Facility declaration is not proof of institutional licensure.
- Retain both immutable child keys. Extend demographics to represent unknown/provisional names and exact/estimated/unknown birth dates. Never manufacture a date/name for an old paper record. Unknown/estimated birth date must prevent unqualified automatic vaccine date classification later. Sex can remain unknown.
- New-child and paper-transcription forms share the registry transaction but retain source type, paper reference, history completeness and verification/provenance. Minimum fields and conditional validation must match the selected certainty/source.
- Optional declared guardian/contact details are care contact information, not a verified legal guardianship link. Do not merge children or grant parent access based on matching names, dates or phones.

## Secure read and session boundary

- Introduce an indexed current-doctor/active-grant helper; all privileged clinical operations must check the caller and current account/grant state themselves, even inside SECURITY DEFINER implementations.
- For clinical access, validate the authenticated JWT's session ID against the caller's current Auth session as well as role/grant checks. Query the actual `auth.sessions` schema before implementing. This addresses logout/session-revocation behavior rather than assuming every issued JWT is immediately invalidated. Add full-schema tests for missing, revoked, expired and mismatched sessions. Strengthen existing evidence/reviewer boundaries consistently where needed.
- Prefer audited RPC reads for child demographics/clinical records and remove direct table-read paths that would bypass the app's patient access-history audit. Keep RLS enabled as defense in depth. This intentionally strengthens the Phase 1 direct-select API contract; update live tests to exercise the authorized RPC and deny direct clinical table reads.
- Read/audit events contain actor/entity/time/purpose, not patient notes or identity-file content. Do not give general admins access to child records or clinical access logs. Provider/operator database access remains separately controlled/audited infrastructure, not silently represented as an app-user read.

## Registration and duplicate review

- One transaction validates approved doctor/facility membership, bounded demographics/contact/provenance, scoped local-number uniqueness and idempotency, then creates the child, the authorized creator grant and the doctor's registry association.
- Duplicate warnings are based on data the caller is authorized to access; never expose a global patient name/DOB/phone search. Show candidates for human review. Explicitly reasoned creation of a separate child is allowed when a superficial match is not the same child. No automatic merge.
- Preserve raw register numbering (including meaningful leading zeros); scope it by professional, facility, year and book as already modeled.

## Existing-child authorization/linking

- A universal ID or lookup QR identifies a record but grants no clinical permission.
- An approved doctor who already has an active grant may add the child to their own valid register scope without recreating it.
- Otherwise, record an access/link request containing the requested universal ID, requester's register scope and a care/authorization reason. Before approval, return only the caller's supplied identifier and a generic request receipt/status, without child demographics or an existence-leaking internal child reference.
- A currently authorized child access manager reviews the request, verifies the legitimate authorization basis, and explicitly approves/rejects. The requester cannot self-approve. Recheck both professionals and the requester's facility membership at decision time.
- Approval atomically grants the appropriate access and creates the requested registry association, preserving the original child ID and other doctors' register numbers. Local-number conflicts or concurrent decisions must roll back the whole operation. Access management/delegation is explicit, not implied by merely reading a child.
- Support pending request withdrawal/resubmission and history. An absent/unavailable authorized manager requires a trusted manual clinical-access/privacy process; do not introduce an admin blanket-access bypass.

## Screens and acceptance

Doctor dashboard, actual derived registry counts, scoped search/filter/pagination, new/paper registration, access-request worklist, existing-child linking and child overview. Do not put invented appointment/vaccine data into the dashboard before Phases 4/5 are built. Display missing clinical history as unknown, not healthy/completed/missed.

Test the complete A/B scenario: A registers child/local 125; authorized B links it/local 78; both see the same immutable child while unrelated professionals and general admins see no patient details. Test stale/revoked/expired grants and sessions, unverified/suspended users, unknown demographics, paper provenance, duplicate review/override, operation retries, scoped-number conflicts and concurrent/repeated access decisions. Existing migration-specific tests are snapshots; add a suite exercising the fully migrated current schema, not only old migration snapshots.

## Outstanding hardening inputs to preserve

- Actual owner signup confirmation is verified, and Resend owner-only delivery/recovery/new-password sign-in succeeded. A verified sending domain, broader delivery and application notifications remain open (EMAIL_DELIVERY.md).
- The former 5 MiB evidence contract failed at Vercel's inbound transport boundary (HTTP 413). Migration `20261113190856` aligns the private bucket and client/server validation at exactly 4 MiB (4,194,304 bytes); the Server Action limit reserves multipart overhead below the platform cap. Cloud browser run `43484297896` passed exact-limit upload/download integrity, oversize/spoof rejection, private access and recorded review decisions on desktop/tablet/phone; independent database readback confirmed all three 4 MiB objects. Broader readiness remains open.
- Formal clinical/source, legal/hosting, real reviewer/guardian verification, production retention and native/device gates remain open. These do not authorize identifiable-data use while the synthetic implementation progresses.
