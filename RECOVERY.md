# Development recovery

No provider backups were available in the authenticated inventory on 14 November 2026. Hosted recovery, durable backup ownership, retention, RPO and RTO remain
unverified. Healthy monitoring, exports and migration files do not prove recovery.

Supabase's [backup guidance](https://supabase.com/docs/guides/platform/backups)
recommends off-site logical exports for the free tier. Database backups include
Storage metadata, not the object bytes. A production strategy must therefore
cover the database, Auth configuration/session handling, Storage bytes and bucket
policy, secrets, deployment configuration and approved retention/holds separately.
No paid upgrade, provider restore or destructive hosted operation is authorized
by this document.

## Isolated cloud recovery mechanics

The manually dispatched `Synthetic recovery mechanics` GitHub workflow uses two
fresh runners without operator credentials, provider access or hosted changes.
Only the existing pinned PGlite dependency and Node 24 are used. Do not run it on
the owner's PC. Its script refuses execution outside GitHub Actions.

The backup runner applies the same application migrations to the existing minimal
Supabase test contract. It creates entirely fictional accounts, a child/register,
an original/corrected uncertain paper consultation and a rescheduled appointment
through the real application RPCs. The original vaccine version remains draft.
It stores one synthetic evidence object's metadata in the database and retains
its bytes in a separate file. No real Auth credentials, document or patient data
are accessed.

It writes a versioned manifest, database archive and separate fictional PDF to a
private GitHub artifact retained for one day. The manifest records the source
commit, SHA-256/length for each archive component, per-table row hashes and the
security baseline. The artifact is a disposable drill transfer, not the durable
backup strategy or an independent cryptographic signature. Repository/provider
access remains part of its trust boundary.

The second runner downloads the bundle and:

1. Requires the expected version, fictional/PGlite marker and exact source commit.
2. Verifies component hashes/lengths and proves that corrupted database bytes and
   a missing separate object fail verification.
3. Restores into a new database, compares every public/private table's complete
   row hash and the schema/ACL/Storage configuration baseline.
4. Invalidates all restored modeled Auth sessions before allowing clinical access,
   proves the old session fails, then models a fresh trusted fixture sign-in.
5. Reads both attributed clinical revisions with their unknown-date/unconfirmed
   provenance intact; denies unrelated/admin export and anonymous table reads.
6. Proves clinical/appointment history remains append-only, all expected audit,
   appointment and vaccine draft/source data remains, and separate object bytes
   recover with the expected hash and metadata pointer.

Only a fixed-label/numeric proof is retained for three days. A missing proof or
any failed step prevents acceptance. The bundle contains fictional fixture IDs
and content; it is not uploaded as a public artifact or committed to Git.

The [PGlite archive API](https://pglite.dev/docs/api#dumpdatadir) is designed only
for reimport into PGlite and may not be compatible with other Postgres versions.
This drill is explicitly **not a hosted Supabase backup image**. Its modeled
Auth/session and Storage contract cannot prove GoTrue, signed links, real Storage
API recovery or production topology. Measured runner restore duration is a lab
observation, not an approved RTO. Hosted backup/restore, object recovery and
incident/retention acceptance stay open in PLAN_CHECKLIST.md.

## Hosted recovery requirements still to prove

- Choose an approved durable encrypted backup location and trusted operators;
  confirm what the free development environment can export and restore.
- Capture database roles/schema/data and separately recoverable Storage bytes,
  plus protected configuration/secrets using environment variables and an approved
  rotation process. Keep identifiable data out of development/cloud drill fixtures.
- Restore into an isolated eligible environment; validate immutable attribution,
  source rules, permissions, audit continuity, private object download and hashes.
- Invalidate restored sessions and review post-backup revocations/permission
  changes before allowing access; do not resurrect compromised access blindly.
- Verify real Auth sign-in/session/recovery and current-session denial, actual
  private Storage behavior, deployment health and monitoring after recovery.
- Agree and demonstrate loss/recovery targets, incident escalation and retention/
  legal holds with the responsible owner and qualified reviewers before a pilot.
