# Page-by-page workspace rework

Owner priority: doctor clinical entry discovery and old child page, plus full admin and parent UI/UX. Use actual computer interactions when signed in; source tests are separate evidence. Android/iOS stay paused.

## Current findings

- Supplied screenshot is the doctor child profile, not the restricted system-admin console. It still renders DoctorNav and a generic account-page layout.
- Consultation/vaccination/growth creation is under Dossier clinique → Nouvelle saisie; appointment creation is under the child appointment page. Child overview lacks clear care-entry actions.
- 22 clinician auxiliary/nested pages still import the legacy DoctorNav. Parent requests, notifications and invitation screens still leave the shared workspace shell. Other parent child pages have inconsistent heading/navigation layouts.
- Admin implementation remains in draft PR #5 (347 tests, READY exact-source preview), pending authenticated visual review.

## Work inventory

- [x] Source: doctor child overview: consistent shell, context/navigation and explicit capability-aware consultation/vaccination/appointment/growth actions.
- [x] Source: doctor records/filter/new/history, vaccination references/item/history, appointment list/new/history, growth charts, guardian access, summary/export.
- [x] Source: doctor registration/paper transcription/link/lookup, facilities, access requests, registry reviews, parent requests and own permissions.
- [ ] Parent overview, children, vaccinations, growth, appointments, documents, sharing and settings.
- [x] Source: parent child booklet/calendar/vaccines/privacy/correction requests, global requests, notifications, invitation and account.
- [x] Source: system admin overview, queue/status filters, evidence/review, professional cards/actions, clinical permissions/search/history, catalogue and account.
- [ ] Loading, empty, denial/error, busy/save and mobile keyboard/menu behavior for each applicable flow.
- [ ] Source checks, responsive computer-use verification, release and precise handoff.

## Authentication

A secure browser-auth request returned declined although the owner reports submitting credentials. Fresh visible state remains clinician login with no account error. The owner approved direct shared-browser sign-in. Await that handoff; do not retry credentials through model-visible tools or reuse retired/pending-cleanup fixtures. Inspect forms/navigation without adding clinical records to real children.

## Current verification checkpoint

Source-only checkbox completion above is not a claim of authenticated computer-use acceptance. 22 legacy clinician screens now use the current shell. Six capability-aware child-care actions are explicit on the child overview; child identity stays visible before entry forms. Parent child pages retain context/navigation, and orphaned requests/notifications/invitation/account pages use the parent shell. Admin directory and queue now have searches with retained filters/pagination.

347 baseline + 12 new workflow cases passed in the 359-test full run; the added admin wildcard/filter case then passed in the 48-case focused run. Types/lint pass. The final full regression and exact Vercel preview follow. Fresh fixture bccf8eb71bf34bc8 has three owner-approved synthetic actors, a new fictional child and five attributed clinical entries. The initial API driver mishandled an empty successful profile response; readback confirmed it before resuming. The appointment driver's Python zoneinfo disagreed with both Node and Postgres; this is a test-driver issue and application time handling remains unchanged.
