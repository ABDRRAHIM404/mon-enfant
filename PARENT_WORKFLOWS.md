# Parent account, requests and privacy

This is the synthetic-data application contract. Qualified guardianship, clinical and privacy approvals remain separate external gates.

## Existing-child access

A parent account label has no clinical authority. A child manager creates a recipient-bound 24-hour invitation, stored only as a SHA-256 hash. The personal URL places the secret in its fragment. The browser retains it per tab while the user signs in and removes the fragment from the displayed URL. Claiming requires the current confirmed recipient account and creates only a pending receipt. A distinct approved doctor with current child-management authority records identity and guardianship checks, source/reference, reason, bounded expiry and separate export permission before a link is created. Multiple verified guardians are independent; withdrawing or revoking one link leaves the other links and the clinical record intact.

Parents can read their linked child's attributed care/vaccinations, raw growth measurements and shared appointment states. They cannot use professional writes. Export requires its explicit guardian-link flag and includes retained clinical revisions and vaccine/appointment history. No automatic catch-up or schedule approval is introduced. Invitation QR and a separate protected clinician-identification QR are now implemented in source. Invitation email and the full hosted scanner/claim acceptance remain outstanding.

## Requests instead of overwrites

From a care entry, a parent can request a verification/correction tied to that immutable entry and revision. General requests concern identity, access or another question. Only a guardian with a current verified child link can submit/read their own request or withdraw an unanswered one. A second guardian cannot see another parent's messages merely because they share access to the child.

A doctor currently managing the child's access sees a scoped queue and may answer, refuse with an explanation, or reference an already-recorded clinical amendment. Marking a request corrected requires a newer revision of the same child/root, recorded after the request by the responder, plus the responder's current matching clinical capability. The doctor must use the normal clinical amendment workflow first. Requests and final responses are append-only; the unique response and PT409 business conflict prevent competing closures. Submissions/replies use retained operation UUIDs for safe retries. Limits are ten pending requests per child/guardian and twenty submissions per guardian in 24 hours.

This queue is asynchronous, without a promised response time or emergency service. No request submission sends an email in the current implementation.

## Contact and delivery preferences

The account may save an optional private phone number, follow-up email consent (initially false) and a preferred reminder lead time of 1, 3 or 7 days. Each saved setting has an immutable private history. Settings do not change Auth identity, guardianship, professional approval, treatment or other guardians' preferences. Saved consent does not mean delivery is enabled: email follow-up/reminder delivery still requires the separate Resend worker/domain integration. No SMS capability is implied.

## Access history

An active guardian can page through known consultation/export/request activities since the beginning of their current verified link. The projection identifies their own activity and professional platform IDs where appropriate, while other guardians remain anonymous. It returns metadata, never tokens, email addresses, other guardians' names or clinical payloads. History reads are themselves audited. Once the link expires or is revoked, the child history/requests are no longer accessible through that parent link. This consultation log is separate from immutable clinical authorship/revisions and from any formal data-subject request process still requiring an approved policy.

All tables remain private with RLS and no client table grants. Public RPCs use caller sessions and explicit database authorization. No general-admin, registry-only or editable-metadata bypass is added.

## QR and in-app updates

QR symbols are encoded inside the application using pinned node-qrcode; no external QR service receives invitation secrets or identifiers. The invitation symbol preserves its personal URL fragment, expiry and recipient/independent-review rules. The identification symbol contains only the canonical protected clinician-lookup URL and universal ID. An approved doctor's current grant is checked before the internal child key is returned. Unknown/unavailable/unauthorized identifiers share a generic request view without demographics; scanning never creates a grant or a duplicate child. Clinicians sign in before scanning.

The in-app feed derives new clinical revisions, appointment events, own request replies and access decisions from existing immutable records. Active child links are rechecked on every feed read. Revoked/expired links remove all child-specific activity, leaving only generic own-access status. Another guardian's private request replies are not shared. A per-account cursor marks updates through the displayed database snapshot read; it cannot move backward or into the future, so subsequently arriving updates remain unread. No additional clinical payload is copied into a notification table and no email/push/SMS is enabled by this feed.

Encoder reference: [node-qrcode documentation](https://github.com/soldair/node-qrcode). Independent decoder checks use jsQR against rasterized actual SVG output in cloud tests. These tests do not replace the required hosted scanner/guardian acceptance.

## Parent calendar and vaccine references

Each linked child's read-only calendar supports day/week/month, Casablanca dates/times, state filtering and pagination. It includes the appointments of all authorized care providers for that child and uses the established shared effective-state projection, including documented doses at another provider and preserved missed dispositions. Parents cannot schedule, reschedule or document treatment from this view.

The separate vaccine-reference page shows clinician-assigned item/version/source ages, current item decisions, attributed matched administrations and routine dates through the existing reviewed calculation engine. Withdrawn references produce no new date; retired/unreviewed versions, uncertain birth data or eligibility block date calculation. HB1 remains disabled, original weeks/months and birth windows remain visible, no catch-up is generated, and undocumented administrations remain unconfirmed. The original 25-row source stays revision-1 draft until qualified review.

Current-session checks also consult Auth bans directly, so an old professional JWT cannot retain RPC access merely because its session row is still present. This does not broaden parent or general-admin clinical privileges.
