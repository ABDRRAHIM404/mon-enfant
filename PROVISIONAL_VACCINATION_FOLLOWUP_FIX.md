# Provisional vaccination follow-up correction — 17 November 2026

Owner request: normal HB1 history must not hide routine next-vaccination information in an unapproved account. Missing/uncertain HB1 and catch-up remain manual.

- Replace the unconditional message with a dedicated routine-calendar section and saved future follow-ups.
- Read only the current author's private child under a live clinician session; no trusted records, clinical capabilities, sharing or promotion.
- Preserve the supplied source and all applied migrations. A new read-only migration adds no clinical writes.
- Original draft may expose dose labels/ages with explicit unapproved status. Personalized routine dates require an approved/reviewed version, exact birth date and correct eligibility. Account approval is not required for this read-only view.
- Existing calendar arithmetic stays unchanged: no HB1/catch-up date generation, appointments remain clinician-chosen, unknown history never becomes a missed dose, declared provisional doses never become validated fulfillment.
- Read latest active declarations/appointments before bounding the payload; future rescheduled visits remain visible, cancelled/completed/withdrawn visits do not.
- Verify author/other-author/session/admin denials, reviewed-versus-draft source selection, normal/missing/uncertain HB1, persistence/reload and desktop/phone renders. Retire the fresh fixture. Keep genuine clinical/source/Phase 6 gates open.

Status: source implemented; cloud/schema/runtime acceptance pending. See PROGRESS.md.
