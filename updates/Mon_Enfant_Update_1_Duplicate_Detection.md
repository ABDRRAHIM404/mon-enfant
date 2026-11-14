# Mon Enfant — Next Update

**Feature:** Child registration duplicate detection  
**Status:** Planned for the next development update (not yet implemented)

## Goal
Reduce accidental creation of duplicate child medical records when different doctors register the same child, **without** allowing global patient searches or exposing existing records.

## Registration and duplicate-check flow

1. When registering a new child, the doctor enters:
   - Child's full name
   - Exact date of birth
   - Sex
2. Before creating the record, the system privately checks whether an existing child might match these details.
3. If there is a possible match, show only this generic warning:
   > A child with similar details may already be registered. Please provide additional information to verify the match.
4. Ask the doctor to enter:
   - **Mother's full name**
   - **Place of birth** (e.g., maternity facility or hospital)
5. Compare those details privately to assess whether this is likely the same child.
6. If the record appears to exist, **do not reveal the existing child's profile or allow access**. Ask the parent to present the secure QR code so the doctor can receive authorized access to the existing record.
7. If the match is uncertain, refer the case to a controlled review process instead of automatically merging or disclosing records. If no match is found, allow normal child registration, subject to ordinary data validation.

## Required security and data rules

- **No global child search** by name, ID, date of birth, SMI, or any other field.
- Duplicate checks happen only within a legitimate new-child registration workflow and **do not grant record access**.
- Do not display existing patient details, the name of another doctor, or medical history in any duplicate warning.
- Rate-limit attempts and log duplicate-check activity to reduce enumeration or guessing.
- Never automatically merge records solely because the fields match: names and birth details are **not guaranteed unique**.
- Continue generating a permanent **internal unique child ID** for each genuinely new record.
- SMI can be kept as a local/reference field, **not a unique identifier** (confirmed by the nurse).
- **Parents' CIN numbers are not required** for this duplicate-check feature.
- The parent's secure, scoped QR-sharing workflow is still required before a different doctor can access an existing child's record.
- Store and process personal/health information according to applicable privacy and security requirements.

## Developer acceptance checks

- Two doctors entering likely matching initial details trigger the additional two-field check, not a record disclosure.
- Entering matching mother's name and place of birth does **not** open an existing child record.
- A doctor cannot use any standalone search screen or API to query unrelated children.
- A legitimate new child can still be registered when the check does not identify an existing record.
- Similar-but-not-identical cases and uncertain matches do not trigger automatic record merges.
- Access to an existing record occurs only through the authorized parent QR-sharing flow.

## Scope note
This is a **next update**, not a claim that the feature is already built. This matching method reduces duplicate risk but cannot establish identity with certainty; review matching rules and edge cases before production use.
