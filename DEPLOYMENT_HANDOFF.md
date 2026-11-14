# Requested Vercel account/address switch

The owner explicitly requested that the current account use a replacement URL and the second existing account reuse **mon-enfant.vercel.app**. Preserve the GitHub repository and existing Supabase project/Auth/sessions. No database migration between accounts or paid dependency is required by this handoff.

- Repository: ABDRRAHIM404/mon-enfant, production branch main. Primary checkout stays on main and must match origin/main after each checkpoint.
- Original team: abdrrahim404s-projects / team_NFI0UsR5L6FboyFfNSZtAakb.
- Original project ID: prj_uU0l5f6VWNrywgz68FH3nYCbJ927. Renamed to mon-enfant-archive-abdrrahim404 at the owner's request.
- Replacement URL: https://mon-enfant-archive-abdrrahim404.vercel.app — domain verified, actual login page HTTP 200. Existing app remains source b64eb12 until a new deployment is allowed.
- Original canonical domain mon-enfant.vercel.app is still attached. Existing connected MCP tools support adding domains but expose no domain-removal operation. The old account's Settings → Domains removal step is still required when the destination is ready; it has not been silently claimed complete.
- Destination: owner says the second account exists and can access GitHub. A fresh Vercel MCP OAuth login succeeded, but the running tool session still listed only the original team. Restart/recheck the connection and obtain the actual destination team ID before any destination write. Never guess the team/account or create a project in the old scope by accident.
- Import the existing private repository into the destination account, using Next.js / Node.js 24. Configure the same public Supabase URL and publishable key from the existing ignored local environment through secure environment-variable tooling; set NEXT_PUBLIC_SITE_URL to https://mon-enfant.vercel.app. Never print keys or upload the whole operator environment. Privileged Supabase/operator keys remain on the PC. SMTP remains configured in the same Supabase Auth project; no duplicate email/database project is needed.
- Application approval delivery/parent invitation emails remain unconfigured and unverified as before. Do not silently enable a notification worker or introduce a sender domain/paid service.
- Confirm a READY destination deployment with the intended source before releasing/reassigning the canonical address. Reusing the same canonical URL preserves the existing Auth redirect configuration; any temporary destination URL needs deliberate redirect/origin configuration before confirmation/recovery tests. Preserve Supabase as the authentication/session authority.
- Verify canonical domain ownership/mapping, app source, public entry, authentication and critical access boundaries after the switch. The update UI acceptance already passed in GitHub's production runtime against the live backend, not on the old canonical Vercel deployment. Keep that distinction in reports.

Both update requirement scopes have synthetic software acceptance. Every real credential/guardian/clinical/source/privacy/hosting approval and Phase 8 mobile remains open. See PROGRESS.md and PLAN_CHECKLIST.md.
