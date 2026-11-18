# Workspace UI handoff

Website: https://mon-enfant.vercel.app

For the doctor: open **Enfants → choose the child → Ajouter au suivi de cet enfant**. Consultation, vaccination, appointment, growth, treatment and risk entry each have a clearly named action. Missing capabilities are explained and link to Mes habilitations. Child forms and histories retain the current sidebar and the child’s identity.

The parent’s child pages, requests, notifications, invitation and account now retain the parent workspace. Sharing and correction pages identify the child before the form. Admin pages use their own sidebar, clearer review queues/cards, search/status filters and permission expiry labels.

Admin access follow-up: clinical-permission and catalogue management require explicit permissions beyond professional review. Denial now stays in the admin workspace with an explanation instead of silently opening account settings. Account settings lists catalogue management alongside the other permissions. Shared account/catalogue skeletons are neutral while identity is loading, avoiding the clinician-sidebar flash. No account permissions are automatically enabled.

Existing clinical/source/access guards remain. Three temporary owner-approved test accounts were used and retired; their clinical/audit history is preserved. The earlier six-account cleanup remains separate. Relevant UI checks and required compilation are used for this fix; unrelated suites are not rerun.

The full signed-in computer-use audit remains blocked by the unavailable shared viewer/authentication handoff. API and HTTP page checks are documented separately: [review](docs/design-qa/workspace-rework/review.md). PR #5 contains the combined implementation and deployment records.
