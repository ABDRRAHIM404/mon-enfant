# Vaccination reference baseline

The supplied files in `data-for-supa/` are retained unchanged:

- `MON_ENFANT_PNI_DATA.json`
- `MON_ENFANT_PNI_SCHEDULE.csv`

They transcribe the hospital-provided `PNI cours.pptx`, principally slide 67's 2025 calendar, with the agreed project decisions. This checkout does not contain the source presentation, and source transcription does not constitute clinical approval.

Implementation belongs to **Phase 4**. Phase 1 does not calculate due dates, seed clinical schedule tables, mark missing doses as missed, generate catch-up dates or administer doses.

Carry these requirements into Phase 4 tests: all 25 dose rows; PCV1–PCV4 correction; rotavirus calendar months 2/3/4 versus original weeks; girls-only HPV at 11; first-four-week entries as windows; HB1 automatic scheduling disabled and HBn absent; month-end/leap-year arithmetic; incomplete history distinct from confirmed missed doses. Patient-specific decisions remain clinician-controlled.
