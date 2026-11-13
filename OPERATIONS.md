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
