# Transactional approval email

Supabase remains the authority for authentication, email confirmation, recovery
and sessions. Resend SMTP continues to deliver Auth mail. Application approval
notices use Resend's transactional API and a separate durable queue.

## Decision and delivery contract

The verification decision's existing approval transaction inserts a single private
outbox record keyed by its immutable decision ID. Rejections do not queue an
approval notice. Queue creation commits or rolls back with the decision. Network
mail delivery happens afterward; a provider failure never repeats or rolls back
approval. No historical decisions are backfilled automatically.

The Next.js `after` callback attempts delivery after an approved review response.
A separate manual/scheduled GitHub workflow retries committed jobs every six hours
when the `APP_EMAIL_DISPATCH_ENABLED` repository variable is explicitly enabled.
The scheduler sends only its scoped endpoint secret; it receives classified counts,
not account addresses, documents or patient records. The original readiness monitor
remains credential-free and separate.

Each claim rechecks a dedicated operator-managed mail-worker flag and current Auth
session, plus recipient account confirmation, ban and professional approval state.
Neither administrator status nor reviewer/doctor approval grants sender authority.
The worker needs no professional profile, clinical capability, child grant, service
role key or operator Management API key. Its application credentials stay server-only.
Its short-lived Auth session is signed out after each batch.

Claims take row leases with `SKIP LOCKED`, up to three notices per batch and ten
attempts globally per hour. Recipients, sender and application origin freeze on
first claim. Later retries render the immutable version-1 plain-text message and
use `professional-approval/v1/<decision-id>` as the Resend idempotency key. A stale
lease acknowledgement raises PT409. No manually raised 40001/40P01 is used.

Resend retains idempotency keys for 24 hours. Automatic attempts stop after five
claims or twenty hours from the first attempt; unresolved outcomes then require
review. This is bounded duplicate protection, not an exactly-once guarantee across
arbitrarily old retries or backup restoration. Provider acceptance is recorded
separately from mailbox delivery. Transient transport/429/5xx errors retry with
backoff; permanent errors and conflicting/ambiguous responses require review.
Raw provider errors, email addresses and response bodies never enter application
logs. Delivery events are append-only and contain only job/attempt/status metadata.

The notice includes only the approval event and a fixed account link, with a
reminder that record/clinical permissions remain separate. It includes no name,
matricule, evidence document, clinical content, account token or patient identifier.
Suspension, ban or a changed recipient address cancels an unsent obsolete notice.
An already transmitted notice cannot be recalled; its historical wording links to
the current account status instead of promising continuing clinical access.

## Configuration

The default is disabled. Preview deployments do not dispatch. Existing approvals
continue to save when mail configuration or delivery is unavailable.

| Server environment variable                           | Purpose                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `APP_EMAIL_MODE`                                      | `disabled`, `owner-only`, or explicitly approved `verified-domain`                      |
| `RESEND_API_KEY`                                      | Existing sending key, never a public variable                                           |
| `APP_EMAIL_WORKER_EMAIL`, `APP_EMAIL_WORKER_PASSWORD` | Dedicated Auth sender identity; password ≥24 characters                                 |
| `APP_EMAIL_CRON_SECRET`                               | Random ≥32-character endpoint secret; only this scoped key is shared with the scheduler |
| `APP_EMAIL_ALLOWED_RECIPIENT`                         | The single permitted development recipient in owner-only mode                           |
| `APP_EMAIL_SITE_ORIGIN`                               | Fixed canonical HTTPS origin, defaulting to the deployed application                    |
| `APP_EMAIL_FROM_EMAIL`                                | Verified sender address for verified-domain mode                                        |
| `APP_EMAIL_DOMAIN_VERIFIED`                           | Explicit provider-verification prerequisite for broader delivery                        |

Owner-only mode always uses `onboarding@resend.dev`. No verified domains were
present in the connected Resend account when this implementation started. Broader
doctor/parent delivery remains unavailable until an owned domain is verified.
Provider test recipients may be used only for a labeled synthetic integration
check; simulated delivery is not a real mailbox receipt claim.

The reviewer page shows pending/retry/accepted/review-needed status without exposing
the address. “Transmise au service d’email” means API acceptance, not delivery. Its
retry action uses the same queued decision, frozen payload, lease and horizon;
it does not reapprove the account or reset duplicate protection.

Before enabling the schedule, verify anonymous endpoint denial, dedicated-worker
authorization/clinical denial, committed queue behavior, provider acceptance and
an unchanged idempotency result on retry. Retire synthetic review actors and
confirm that the worker has no clinical/profile/grant privileges. Store actual
keys/passwords in ignored private environment files and production secrets only.
Do not deploy operator or service-role credentials.

## Recovery and remaining delivery gates

Disable application mail and its schedule before restoring a backup. Restoring an
old pending outbox can resurrect work sent after that backup; compare provider
history and post-backup revocations before re-enabling delivery. Invalidate restored
worker sessions and rotate credentials as required by the incident procedure.
A twenty-hour in-database retry horizon cannot detect every post-snapshot send.

Verified-domain setup, actual broader-recipient delivery, bounce/complaint handling,
approved mailbox/session policies and operating targets remain explicit gates.
Parent invitations remain Phase 7; email delivery never establishes guardianship.

References: [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys),
[transactional API](https://resend.com/docs/api-reference/emails/send-email),
[safe provider test addresses](https://resend.com/docs/dashboard/emails/send-test-emails),
[Next.js after](https://nextjs.org/docs/app/api-reference/functions/after).
