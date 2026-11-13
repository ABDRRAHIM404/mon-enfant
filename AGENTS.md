# Mon Enfant working instructions

- Follow PROJECT_PLAN.md in phase order and update PROGRESS.md with evidence. Current phase: clinical records/vaccine tracking (Phase 4). Foundation, verification and patient registry are implemented; read PROGRESS.md and PLAN_CHECKLIST.md for evidence and remaining gates.
- The user's PC has limited resources and becomes unresponsive under builds/browser tests. Keep local work to editing, small reads and Git operations. Run dependency installation, full tests, production builds and browser checks in GitHub Actions or Vercel. Do not start a local dev server or heavy checks unless the user explicitly requests it.
- Use synthetic data only. Do not provision paid dependencies or use identifiable patient records.
- Never grant clinical access based on user-editable metadata, registry membership alone, or an admin role alone.
- Keep vaccine source data unchanged. Implement vaccination as reviewed, versioned routine references in Phase 4; no automatic catch-up logic or HB1 scheduling.

- Before changing registry code, read REGISTRY_SPEC.md for the authorization, provenance, audit and current-session contract. Keep the full Phase 0–8 scope in PLAN_CHECKLIST.md; external approval gates are not silently waived.

- Before implementing clinical records, read CLINICAL_MODEL.md, USER_STORIES.md and VACCINE_DATA.md. Account approval does not imply clinical write capabilities. Preserve source data and keep imported schedule versions draft until qualified review.
