# Development operations

Use synthetic identities/documents only. Heavy builds and browser verification run in GitHub Actions and Vercel, never on the owner's PC by default.

## Reviewer bootstrap

No signup can select an admin role or reviewer privilege. A trusted project operator must provision the initial reviewer after independently establishing the account owner. Use the intended user's **existing Auth UUID**, through a trusted SQL session, in one transaction:

```sql
begin;
-- Replace the placeholder with an operator-verified Auth UUID, never user metadata.
update public.professional_profiles
set role='admin', verification_status='approved', professional_id='ADMIN-<unique-staff-id>'
where user_id='<verified-auth-uuid>';
insert into private.staff_permissions(user_id,can_review_professionals)
values ('<verified-auth-uuid>',true);
commit;
```

Record who performed provisioning in the operator log. Do not grant access just because an email is first to sign up. General admin status alone does not grant document-review or patient-record access. Revoke the explicit permission to stop document review immediately. Never distribute the service key to the web app or browser.

## Verification evidence lifecycle (development policy)

1. Accept fictional PDF/JPEG/PNG evidence only, up to 5 MiB. Storage is private and owner-scoped. Server submission also checks the file signature.
2. Submitted originals cannot be replaced or deleted by the applicant. Failed unsubmitted uploads may be removed by their owner. Reviewers receive a download link valid for 60 seconds; access is audited before signing. Do not paste signed URLs into tickets/logs.
3. Record the decision, source checks, reviewer and reason. Decisions and account status events are append-only. The applicant may resubmit a new request after rejection or a request for more evidence; earlier requests remain.
4. Weekly, the project operator checks for orphan uploads older than 24 hours and fictional evidence more than 30 days past a final decision. Confirm no active review/legal hold, record the request ID and operator in the restricted operations log, then delete the object through the authenticated Storage administration API/dashboard. Preserve decision/request metadata and audit history, not identity-document copies. Verify private download returns missing after deletion.
5. Production retention, legal holds, erasure and official credential-verification sources require explicit qualified review before real documents are accepted. The above 30-day development rule is not a legal determination.

## Incidents and monitoring

Server failures emit only fixed event names, random correlation references, severity and UTC timestamps. Raw provider errors, names, identity files, clinical notes, passwords and request bodies are excluded. Vercel runtime logs are the development monitoring surface. Configure alerting/on-call ownership and test escalation before pilot readiness.

For suspected account compromise: suspend the doctor's account using the audited reviewer workflow, revoke sessions through Supabase Auth, inspect authorized audit/decision records, and record the operator's remediation. Clinical RLS reads current profile state, so suspension is enforced even if a JWT has not refreshed. An issued evidence URL may remain valid for its remaining 60 seconds.

## Live integration checks

After cloud CI passes and the intended migration is applied, an authenticated project operator may run `python3 scripts/verify-live.py` using their existing CLI credentials and ignored `.env.local`. It performs remote Auth/PostgREST/Storage checks using synthetic confirmed accounts without sending mail. A privileged CLI key stays in memory, is never written into the app, and is never printed. The script suspends all fixture accounts, revokes grants and removes fixture documents on completion; immutable audit metadata remains.

`python3 scripts/verify-web.py` checks the deployed HTML forms/session cookies through small HTTPS requests, without launching a browser on this PC. It must target the deployed version at the canonical development origin. It also creates fictional accounts without email and retires them afterward. Configure your normal HTTPS proxy environment if required. Do not run these operator scripts against a production-patient database.

`python3 scripts/verify-recovery.py` verifies hosted one-use recovery tokens and password-reset behavior without sending email. It uses an operator-generated token for a fictional account, validates actual old/new credentials and refresh revocation, and retires the fixture. This does not prove mailbox delivery or waive provider recipient restrictions.

### Registry smoke and access handoff

After the Phase 3 migration and app are deployed, run `python3 /tmp/mon-enfant-remote.py python3 scripts/verify-registry.py` using the existing per-command proxy helper. It submits actual hosted HTML forms and performs small provider HTTPS calls; it does not run a browser, build, install or send mail. The script is fixed to the linked synthetic development project. Operator credentials stay in memory. Accounts are suspended, sessions signed out, pending requests withdrawn and grants/practice memberships revoked afterward; synthetic child identities and immutable audit/history remain.

A clinical identifier is insufficient to authorize access. A current child manager must verify the requester's legitimate basis and explicitly grant any management delegation. The app prevents self-revocation to avoid an accidental managerless handoff; arrange a verified successor first. When no authorized manager is available, use a separately approved clinical/privacy escalation process. No general-admin patient lookup or blanket grant is provided. Actual appointment of operators, institutional verification, retention and escalation policies remain external approval gates.

### Explicit clinical permissions (Phase 4)

Clinical writing is separate from approval and child access. An approved doctor also needs an active capability for the specific entry kind and current membership in the declaring facility. Professional review permissions do not imply clinical-permission management. The operator must explicitly appoint an approved admin by setting `private.staff_permissions.can_manage_clinical_permissions` for that verified account; this private flag is unavailable through client table writes. Retain the real appointment/qualification evidence in the approved operator process. No first-signup/self-appointment path exists. Use fictional qualifications only in the development environment.

An appointed manager uses `/admin/clinical-permissions`, searches the platform professional ID and records the specific activity, checked qualification reference, reason and optional expiry. Enabling requires an explicit verification attestation. Revocation is immediate for existing JWTs; original events remain readable to authorized treating professionals. Every change has immutable history, visible to the subject at `/account/clinical-permissions` and to appointed managers. The manager role grants no patient access.

`write_clinical_entry` appends originals or a reasoned correction/withdrawal against the expected revision. A different authorized capable doctor may amend, preserving original author, every intermediate author, source and timestamp. Duplicate operation IDs return the original result; competing revisions yield one commit and one stale-version error. Never edit the ledger directly to hide mistakes. Hosted operator acceptance is in `scripts/verify-clinical.py`; it uses synthetic accounts only, retires permissions/grants/accounts and preserves the fictional immutable ledger afterward.

Interactive print/JSON exports include all revisions up to 5,000 rows. Over-limit exports fail explicitly instead of silently truncating; arrange a separately approved scoped export for larger records. Growth charts show recorded values from the displayed page only, with exact dates, explicit units and no invented percentile/reference diagnosis. Unknown/estimated-date entries remain in history. Do not treat these broad input bounds as pediatric clinical guidance.

### Development email quota and browser context

The built-in Supabase sender is currently limited to two email messages per project per hour across signup/recovery and sends only to allowed project-team addresses ([official limits](https://supabase.com/docs/guides/auth/rate-limits), [SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp)). Custom SMTP remains required before wider use. Do not repeatedly request recovery while throttled. Request a fresh message once sending is available; open only the latest link in the browser that initiated recovery. If a mail app launches a different browser, privately copy the recovery-button URL directly into the initiating browser before opening it elsewhere. Never request a user’s password or bearer link in chat. Generic invalid/used/expired recovery links return to self-service recovery; missing browser proof has a separate explanation.
