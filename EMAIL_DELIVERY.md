# Mon Enfant email delivery

Supabase remains the authentication/session authority. Signup confirmation and password recovery continue through its existing Auth APIs and callback routes. Resend is the proposed delivery provider; registering its MCP connection alone does not configure SMTP or prove email delivery.

## Current connection and activation

The official hosted MCP endpoint `https://mcp.resend.com/mcp` is registered in the owner's local Codex configuration. It needs OAuth authorization and a tool-connection refresh before its account tools can be used. No local Resend server/dependency install is needed. No Resend API key or verified sending domain was available when this work began. The existing hosted SMTP settings have therefore not been changed.

The sender must use a domain the owner controls, with Resend's required DNS records verified. The application's `mon-enfant.vercel.app` hosting address is not an owned sending domain. Disable click/open tracking on the sending domain so Auth links are not rewritten and email opens are not tracked. Retain existing Auth confirmation/recovery templates and allowed callback URLs during the SMTP switch.

Use separate credentials: a domain-restricted sending key as `RESEND_API_KEY`, and an operator-only full-access `RESEND_ADMIN_API_KEY` for reading domain verification/tracking settings. Keep both in a secret manager or ignored mode-600 `.env.local`. Neither belongs in client variables, Git, chat, command arguments, logs or test fixtures. `SUPABASE_ACCESS_TOKEN` is an operator Management API token, not an app service-role key. The setup script reads credentials from its environment and does not load or print files containing them.

`scripts/configure-resend.py` supports:

- `--plan`: offline list of required environment names and intended settings.
- `--check`: verifies the exact sending domain, tracking disabled, TLS SMTP authentication and the current hosted Auth mail configuration; no changes or email sent.
- `--apply`: the same preflight, followed by a targeted Management API PATCH of SMTP and email limits only, with readback. Session settings, email-confirmation requirement, existing callback URLs and confirmation/recovery templates are checked for preservation. No email is sent.

SMTP uses `smtp.resend.com`, implicit TLS port 465, username `resend`, and the sending API key as password. Defaults are 30 Auth emails/project/hour and a 60-second same-recipient cooldown. Provider daily/monthly/rate quotas still apply; custom SMTP removes the built-in two-per-hour constraint, not all limits. Broader pilot use needs a quota/abuse review. The script refuses activation if a Send Email hook overrides SMTP or if the canonical Auth origin/confirmation setting differs from the expected configuration.

After a successful hosted apply, synchronize the SMTP environment references and rates in `supabase/config.toml` before any later `supabase config push`; the current file still records the existing built-in sender configuration. Avoid a broad config push to perform this targeted mail change.

## Required delivery evidence

After activation, use an owner-controlled mailbox and a single fresh link per test. Record provider acceptance and mailbox delivery separately. Do not put addresses, passwords, token URLs or mail contents in project logs. Confirm signup, recovery/new-password sign-in and invalid/reused link behavior on the canonical app. Request recovery in the browser that will open the link; PKCE browser proof and one-use tokens still apply with Resend. Check provider logs without printing message content, then review bounce/complaint handling and quota consumption.

## Application notifications and parent invitations

Doctor approval notices are application events, not Auth account confirmation. They must be queued from the committed verification decision, sent only to the verified account address, contain no evidence documents/clinical details, and use the decision ID for duplicate prevention. Email failure must not roll back or repeat the approval decision. This application-notification path is not implemented yet.

Parent invitations are part of Phase 7 and are not implemented yet. A delivered Supabase Auth invite establishes an account, not guardianship or child access. Do not treat SMTP setup or `inviteUserByEmail` as completion of that feature. The parent workflow must first create a one-use hashed expiring invitation, authorize the inviting clinician's child access, authenticate the recipient, separately record guardianship verification and atomically link the existing child. Notification must not include patient data or grant access through email alone. Preserve this scope in PLAN_CHECKLIST.md.

## References

- [Official Resend MCP server](https://resend.com/docs/mcp-server)
- [Resend SMTP for Supabase](https://resend.com/docs/send-with-supabase-smtp)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Targeted Auth configuration API](https://supabase.com/docs/reference/api/v1-update-auth-service-config)
