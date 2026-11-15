# MON ENFANT — UPDATE 4
## Smart form inputs, vaccine/dose selection, and dropdown UI

**Status:** Planned update — requirements only. Do not change implementation until instructed.

### Problem observed
On the provisional child-record page (`/provisional/[id]`), under **Ajouter une entrée → Vaccination / historique**, both **Vaccin** and **Dose déclarée** are plain text inputs. Staff have to type information that should usually be selected, which slows data entry and encourages spelling mistakes, inconsistent dose labels, and ambiguous records. Choice menus elsewhere also need better styling.

### 1. Vaccine selection
- Replace the free-text **Vaccin** field with a **searchable, keyboard-accessible select/combobox** populated from the current approved/available vaccine catalog (respect the record's catalog version and permissions where applicable).
- Display the readable French vaccine name and a meaningful short code; search by either. Do not pretend a vaccine is approved if it is not.
- Include **Autre (préciser)** as the last choice. Selecting it reveals a required text input, **Nom du vaccin**, to record a vaccine absent from the catalog.
- Preserve the exact entered name and its provenance as an **unmapped/unverified vaccine entry**. Do not automatically map it to an official schedule, calculate doses or next dates from it, or assert that it was administered under an approved PNI rule. Allow later authorized catalog review/mapping without discarding the original entry.

### 2. Context-dependent dose selection
- Replace **Dose déclarée** with a selectable list **specific to the chosen vaccine**, using dose identifiers from the appropriate versioned catalog when available (e.g., dose 1, dose 2, booster only if that vaccine has one).
- Display human-friendly names plus catalog dose codes when useful, and prevent choosing a dose belonging to another vaccine.
- If **Autre** is selected as the vaccine, or an appropriate dose is unavailable, offer **Autre (préciser)** for the dose too, revealing a required text field.
- Changing the selected vaccine must clear/revalidate an incompatible dose selection; never silently retain the prior dose.
- Historical/paper-record capture must allow a **dose unknown/not specified** option where clinically appropriate, preserving uncertainty rather than inventing the dose.
- Preserve the approved catalog rules, versioning, audit trail, duplicate-record safeguards, and clinician review gates. Do not infer vaccine administration from a field selection alone.

### 3. Improve all forms across the website
- Audit **every data-entry flow** (child registration, medical history, consultations, vaccinations, growth, appointments, clinical entries, professional registration, etc.). Where a field has a manageable set of valid choices, use the appropriate **select, searchable combobox, segmented control, radio group, autocomplete, date picker, or yes/no toggle** instead of forcing unnecessary typing.
- Use **dependent selections** where relevant (e.g., vaccine → valid dose). Keep genuine narrative/clinical descriptions as text areas; do not force fixed choices when free text is needed.
- Offer **Autre (préciser)** for fields where legitimate uncatalogued values can occur, without bypassing validation or approved clinical rules.
- Reuse shared, accessible form components, consistent spacing, labels, help text, required/optional markers, inline errors, keyboard navigation and mobile touch targets.
- Pre-populate only safe, known defaults; never invent or auto-submit clinical facts.

### 4. Fix the choice/dropdown CSS and UX
- Style all closed and expanded dropdowns/comboboxes consistently with the **Mon Enfant Update 3** design system in **light and dark modes**: warm cream, emerald green, soft coral only for meaningful emphasis.
- Design option rows, selected and hovered/focused states, search input, checkmark, icons, empty results, loading state, and validation error state. Maintain readable text and sufficient contrast.
- Ensure menus stay inside the viewport, appear above surrounding cards (correct stacking context/z-index), don't get clipped by `overflow: hidden`, and work with touch screens, small displays, keyboard, and screen readers.
- Avoid browser-default-looking controls where inconsistent with the design, but preserve native accessibility and expected keyboard behavior. Use established accessible components where possible; no unnecessary dependencies.

### 5. Specific acceptance checks
1. Choose **Vaccination / historique** → select a vaccine from the searchable catalog list → available **dose choices update** appropriately.
2. Switch vaccines → invalid prior dose clears; selecting a valid dose persists correctly.
3. Select **Autre (préciser)** → manually enter an uncatalogued vaccine and (if necessary) a manual dose; preserve as unverified/unmapped historical information without automatic scheduling.
4. Enter a historical dose as **unknown** where permitted → it stays explicitly uncertain.
5. Empty, invalid, and required inputs show clear, accessible validation; no accidental or duplicate record writes.
6. On desktop and mobile, all menus are correctly aligned, scrollable, not clipped, accessible by keyboard/screen reader, and styled correctly in **light and dark mode**.
7. Regression-test role permissions, provisional-record isolation, versioned catalog logic, vaccination history, clinician validation, and audit logs.

### Scope boundaries
- This update improves **data-entry UX and presentation**, not the clinical vaccination protocol.
- Do **not** introduce automatic catch-up prescriptions or resolve previously deferred clinical rules on your own.
- Preserve existing functions, patient authorization boundaries, and recorded source data.
