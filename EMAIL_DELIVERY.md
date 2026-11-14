# Mon Enfant email delivery

Supabase remains the authentication/session authority. Signup confirmation and password recovery continue through its existing Auth APIs and callback routes. Resend now delivers owner-only development mail through SMTP. Registering its MCP connection alone does not prove SMTP or mailbox delivery; the actual evidence is recorded below.

## Current connection and activation

The official hosted MCP endpoint `https://mcp.resend.com/mcp` is registered in the owner's local Codex configuration. The owner saved a sending-only key in the ignored private environment file; the credential helper supplies it without storing it in Codex's config. A named-client MCP initialization and `tools/list` succeeded with 139 tool definitions. No business/email tool was called during that check; tool inventory does not grant domain/account management permissions. The separate hosted plugin was reported connected by the owner but its native tools are not exposed to this running chat. No local Resend server/dependency stack was installed.

Hosted Supabase Auth now uses `smtp.resend.com:465`, username `resend`, the shared `onboarding@resend.dev` test sender, a 30-email/project/hour limit and a 60-second recipient cooldown. Targeted readback verified confirmation requirements, Auth/session settings and existing templates preserved. This remains owner-only testing: no domain is owned/verified, so delivery to other doctors or parents is not enabled.

The `scripts/resend-mcp-headers.py` helper supports the independent local HTTP MCP connection using the same sending key. It reads only `RESEND_API_KEY` from the process environment or an explicitly selected owner-private dotenv file, without executing shell expressions or loading other variables. Its stdout contains the Authorization header and must be consumed only by Codex's `http_headers_helper` mechanism or captured privately for validation; never print its output in tool logs. The Codex configuration stores only the helper command/path, never the key. Sending-only credentials do not authorize domain/account management tools. Local MCP configuration does not grant a hosted chat access to the separately connected plugin.

## Own-inbox testing before buying a domain

Resend's shared `onboarding@resend.dev` sender can send testing mail only to the email address associated with the Resend account. This is sufficient for an owner-only delivery check; it does not enable delivery to arbitrary doctors or parents. See [Resend's testing restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

The setup script has two additional modes that never read or change Supabase settings:

- `--check-owner-test` verifies TLS SMTP authentication using only `RESEND_API_KEY`, without sending mail.
- `--send-owner-test` sends one fixed plain-text, non-clinical message to `RESEND_TEST_RECIPIENT` using the shared test sender. It also requires `RESEND_SMOKE_OPERATION_ID`, a UUID retained for retry. The SMTP idempotency header and Message-ID remain stable for that operation. Never automatically retry an uncertain outcome with a new ID; inspect Resend first. Provider idempotency retention is finite, so this is not an unlimited-time deduplication guarantee.

Keep the recipient, operation UUID and sending key in ignored environment configuration. No address, key, message content or raw SMTP/provider failure is printed. SMTP acceptance still needs a separate mailbox receipt confirmation; it does not prove inbox delivery, Auth recovery or general sender-domain readiness. These direct SMTP smoke modes do not switch the canonical app's global Auth sender.

After the owner test succeeds, `--check-owner-auth` and `--apply-owner-auth` support explicit owner-only Auth testing on the synthetic-data deployment. They force `onboarding@resend.dev` as sender and require `RESEND_TEST_RECIPIENT`, the sending key and the operator Management API credential; no domain-management key or domain ID is needed. Apply changes only the same SMTP/rate fields as verified-domain setup and checks Auth/session/template preservation. All setup commands send no mail themselves. Actual signup/recovery requests still go through Supabase, and Resend will refuse other recipients until a sender domain is verified. Do not describe this mode as general doctor/parent delivery or production email readiness.

For delivery beyond the owner-only test inbox, the sender must use a domain the owner controls, with Resend's required DNS records verified. The application's `mon-enfant.vercel.app` hosting address is not an owned sending domain. Disable click/open tracking on the sending domain so Auth links are not rewritten and email opens are not tracked. Retain existing Auth confirmation/recovery templates and allowed callback URLs during the SMTP switch.

Use separate credentials: a domain-restricted sending key as `RESEND_API_KEY`, and an operator-only full-access `RESEND_ADMIN_API_KEY` for reading domain verification/tracking settings. Keep both in a secret manager or ignored mode-600 `.env.local`. Neither belongs in client variables, Git, chat, command arguments, logs or test fixtures. `SUPABASE_ACCESS_TOKEN` is an operator Management API token, not an app service-role key. The setup script reads credentials from its environment and does not load or print files containing them.

For a verified domain, `scripts/configure-resend.py` supports:

- `--plan`: offline list of required environment names and intended settings.
- `--check`: verifies the exact sending domain, tracking disabled, TLS SMTP authentication and the current hosted Auth mail configuration; no changes or email sent.
- `--apply`: the same preflight, followed by a targeted Management API PATCH of SMTP and email limits only, with readback. Session settings, email-confirmation requirement, existing callback URLs and confirmation/recovery templates are checked for preservation. No email is sent.

SMTP uses `smtp.resend.com`, implicit TLS port 465, username `resend`, and the sending API key as password. Defaults are 30 Auth emails/project/hour and a 60-second same-recipient cooldown. Provider daily/monthly/rate quotas still apply; custom SMTP removes the built-in two-per-hour constraint, not all limits. Broader pilot use needs a quota/abuse review. The script refuses activation if a Send Email hook overrides SMTP or if the canonical Auth origin/confirmation setting differs from the expected configuration.

The SMTP environment reference and rates in `supabase/config.toml` now match the hosted owner-only settings. Avoid a broad config push to change SMTP; use a targeted mail update so unrelated Auth configuration is preserved.

## Delivery evidence and remaining checks

- GitHub SMTP authentication preflight passed: https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43433356100 . The local proxy returned HTTP 502 for the SMTP tunnel, so the actual SMTP check ran in the cloud.
- One fixed, idempotency-keyed owner test was accepted by Resend SMTP and received in the owner's inbox: https://github.com/ABDRRAHIM404/mon-enfant/actions/runs/43433668990 . Dedicated temporary GitHub test secrets were removed after both runs completed.
- After the hosted SMTP switch, the owner requested a fresh recovery email through the canonical app and reported that delivery, password reset and sign-in with the new password all worked. No password or token link was shared with the agent.
- Fresh signup confirmation using the Resend sender, broader-recipient delivery, verified-domain tracking settings, bounce/complaint handling and the application-notification workflows remain unverified/incomplete. The existing real signup confirmation evidence predates the sender switch.


After activation, use an owner-controlled mailbox and a single fresh link per test. Record provider acceptance and mailbox delivery separately. Do not put addresses, passwords, token URLs or mail contents in project logs. Confirm signup, recovery/new-password sign-in and invalid/reused link behavior on the canonical app. Request recovery in the browser that will open the link; PKCE browser proof and one-use tokens still apply with Resend. Check provider logs without printing message content, then review bounce/complaint handling and quota consumption.

## Application notifications and parent invitations

Doctor approval notices are application events, not Auth account confirmation. They must be queued from the committed verification decision, sent only to the verified account address, contain no evidence documents/clinical details, and use the decision ID for duplicate prevention. Email failure must not roll back or repeat the approval decision. The application-notification queue, dedicated worker, reviewer status/retry UI and bounded Resend transport are now implemented in source and under cloud verification; see APPLICATION_EMAIL.md. Hosted migration, server-secret provisioning and actual application delivery acceptance remain pending.

Parent invitations are part of Phase 7 and are not implemented yet. A delivered Supabase Auth invite establishes an account, not guardianship or child access. Do not treat SMTP setup or `inviteUserByEmail` as completion of that feature. The parent workflow must first create a one-use hashed expiring invitation, authorize the inviting clinician's child access, authenticate the recipient, separately record guardianship verification and atomically link the existing child. Notification must not include patient data or grant access through email alone. Preserve this scope in PLAN_CHECKLIST.md.

## References

- [Official Resend MCP server](https://resend.com/docs/mcp-server)
- [Resend SMTP for Supabase](https://resend.com/docs/send-with-supabase-smtp)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Targeted Auth configuration API](https://supabase.com/docs/reference/api/v1-update-auth-service-config)


The connected native Resend tools became available during the application-notification work. A read-only domain inventory returned no domains; this confirms that the verified-domain/broader-recipient gate is still open. No extra account or domain was provisioned.
