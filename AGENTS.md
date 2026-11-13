# Mon Enfant working instructions

- Follow PROJECT_PLAN.md in phase order and update PROGRESS.md with evidence. Current phase: technical foundation.
- The user's PC has limited resources and becomes unresponsive under builds/browser tests. Keep local work to editing, small reads and Git operations. Run dependency installation, full tests, production builds and browser checks in GitHub Actions or Vercel. Do not start a local dev server or heavy checks unless the user explicitly requests it.
- Use synthetic data only. Do not provision paid dependencies or use identifiable patient records.
- Never grant clinical access based on user-editable metadata, registry membership alone, or an admin role alone.
- Keep vaccine source data unchanged. Vaccination implementation belongs to Phase 4; no automatic catch-up logic or HB1 scheduling.
