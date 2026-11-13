# Mon Enfant

Digital Moroccan child health booklet. The implementation follows [PROJECT_PLAN.md](PROJECT_PLAN.md) in phase order. Foundation, professional verification/review, patient registry and the Phase 4 clinical-record core are implemented. **Phase 4 vaccine catalog/tracking** and the appointment/parent/mobile phases remain outstanding. See [PLAN_CHECKLIST.md](PLAN_CHECKLIST.md) for the complete scope and unresolved external gates.

## Development services

- App: https://mon-enfant.vercel.app (Vercel protection is enabled).
- Private source and CI: https://github.com/ABDRRAHIM404/mon-enfant
- Supabase development: https://supabase.com/dashboard/project/zkkasbxvdvecnafgjpxd (Paris / `eu-west-3`).

Five migrations are applied and all 15 public tables have RLS. Patient reads use audited RPCs and require a current Auth session plus an approved doctor and active child grant. The latest security advisor reports disabled leaked-password screening (a paid-plan feature); no additional SQL/RLS/function warnings. See SECURITY.md. App credentials are configured on Vercel. Use fictional data only. The owner prefers remote verification to keep their PC responsive.

## Run locally (only when requested)

Requires Node.js 24 and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Without Supabase configuration, the public pages work and sign-in explicitly remains unavailable. Protected pages redirect to sign-in. There is no demo login, bypass or browser-stored patient data.

### Connect a synthetic-data Supabase environment

Use a dedicated development project or a local Supabase stack. This checkout does not create or connect a hosted project automatically.

For the local stack, install Docker and the Supabase CLI, then:

```sh
supabase start
supabase migration up --local
```

Check commands with `supabase <command> --help` for your installed version. Copy the local API URL and publishable key from the CLI output to `.env.local`, then restart Next.js. Never put a secret/service-role key in a `NEXT_PUBLIC_*` variable.

Email confirmation is enabled in `supabase/config.toml`. The connected development project's site URL is `https://mon-enfant.vercel.app`; localhost callback URLs are also allowed. For a separate local stack, set `auth.site_url` to your local origin and set `NEXT_PUBLIC_SITE_URL` in `.env.local` to the same origin.

The default Supabase confirmation email uses the PKCE flow. Sign-up sets `emailRedirectTo` to `/auth/callback`; the callback exchanges the code for a session using the signup browser's verifier cookie. Complete confirmation in the same browser that signed up. Exact trusted deployment origins are retained for preview confirmations. Cross-device onboarding needs a later supported token-hash/email-template flow. Free-tier default-email-provider projects cannot customize templates, so no paid SMTP dependency was added.

For local Supabase, retrieve mail in the inbox reported by `supabase status`. The remote default email provider has account/recipient restrictions; configure an appropriate sender before a wider pilot. Passwords require at least 12 characters. Sign up, confirm email, sign in, and activate the unverified professional profile in `/account`. Applicants cannot approve themselves. The private review workflow at `/admin/verifications` requires both an approved admin account and an explicit reviewer permission. See [OPERATIONS.md](OPERATIONS.md) for initial reviewer bootstrap and fictional-document retention. Reviewer privileges never grant blanket child-record access.

Do not use identifiable patient data. See [SECURITY.md](SECURITY.md).

## Checks

Run heavy checks in GitHub Actions by default; the owner’s PC has limited resources. The commands below are available for CI or an explicitly requested local run.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit and database tests use an isolated PGlite PostgreSQL instance with a minimal Supabase auth schema. They execute the actual migration and enforce real role grants and RLS. They do not replace Supabase Auth, Storage or live PostgREST integration tests. Browser tests run with Supabase unset to verify the explicit setup state and protected-route redirects at desktop and phone sizes.

CI runs these checks on push and pull request. Versions are pinned and `package-lock.json` is tracked.

## Project records

- [PROJECT_INFO.md](PROJECT_INFO.md): agreed requirements and source decisions.
- [PROJECT_PLAN.md](PROJECT_PLAN.md): ordered roadmap; original baseline retained.
- [PROGRESS.md](PROGRESS.md): implementation status and next steps.
- [DECISIONS.md](DECISIONS.md): implementation decisions.
- [DATABASE.md](DATABASE.md): schema, grants and authorization model.
- [VACCINE_DATA.md](VACCINE_DATA.md): supplied reference data and deferred clinical logic.
- [SECURITY.md](SECURITY.md): current boundaries and rollout requirements.

Operator-only live smoke tests are documented in OPERATIONS.md. They exercise hosted Auth/Storage/RPC and actual Next.js HTML forms without running a local browser or sending email. No test admin keys are installed in the web application. Clinical event/correction design is in CLINICAL_MODEL.md.

Password recovery is available from the sign-in page. Recovery links must be opened in the same browser for the default PKCE flow. Successful reset requires a new sign-in. Operator-only recovery-token checks are in `scripts/verify-recovery.py`; they generate test tokens without delivering email.

Clinical records require a separate capability for consultations, prescriptions, risks or growth measurements, plus current child/facility authorization. Originals, corrections and withdrawals remain in the ledger with all authors, sources and dates. Authorized users can inspect history, view raw growth measurements, print a summary or download an audited JSON ledger. The vaccine catalog/administration module remains the next Phase 4 milestone.
