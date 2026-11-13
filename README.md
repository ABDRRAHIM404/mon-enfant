# Mon Enfant

Digital Moroccan child health booklet. The implementation follows [PROJECT_PLAN.md](PROJECT_PLAN.md) in phase order. Work is currently in **Phase 1 — Technical foundation**. Doctor verification/review, patient registration and clinical functions belong to subsequent phases.

## Run locally

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

Email confirmation is enabled in `supabase/config.toml`. In Auth settings, set the site URL to `http://localhost:3000` (or `http://127.0.0.1:3000`) and use this confirmation template:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Confirmer mon adresse</a>
```

For local development, retrieve confirmation mail in the local mail inbox reported by `supabase status`. Hosted development projects also need a confirmed sender/email setup and the same template. Configure password length to at least 12 characters. Sign up, confirm email, sign in, and initialize the unverified profile in `/account`. Approval is **not** available to users; the review workflow is Phase 2. Only a trusted database operator can provision test approval until that workflow exists.

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
