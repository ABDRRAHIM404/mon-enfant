# Phase 8 — Android/iOS parent client

Owner now requests light appearance only. The native source removes theme choices and ignores former appearance preferences; apply this in the next authorized Android build. No updated APK/native runtime acceptance is claimed.

15 November 2026. Current owner priority: Update 5 canonical website stabilization. Pause APK feature development until the owner reviews the website acceptance report and explicitly approves resuming it; iPhone/iOS stays deferred. See UPDATE_5_WORK_PLAN.md. Previous Android development checkpoint follows. M01 in USER_STORIES.md and the complete PROJECT_PLAN.md remain the acceptance scope. The previous turn was progress: real sharing was applied, tested, published and primary main synchronized. This turn starts the native client; it does not close clinical, legal, credential/guardian, hosting, email or remaining Phase 6 gates.

Use React Native 0.88 / Expo SDK 58 and Expo Router, with an independent pinned package/lockfile under mobile/. This is native UI on the same Supabase project, not a webview. The first cloud dependency bootstrap 43665401106 passed; a follow-up adds the same Lucide icon family as web. No local installation, Metro server, emulator, native build or browser is permitted on the owner's PC.

## Required behavior

- Native password sign-in, genuine remembered/session-only modes, encrypted remembered Auth values with small-value limits, logout and recovery/error states. Supabase remains responsible for Auth, refresh and current sessions. Existing working web signup/email-confirmation/recovery flows open in the system browser; native does not introduce a competing PKCE/email callback configuration.
- Parent-first native home, actual linked children, booklet/current clinical entries with uncertainty/source/authorship/amendments, raw growth plots, vaccine history and the existing reviewed routine reference calculator, Casablanca appointments and current in-app updates/read receipts.
- Existing-child invitation paste/camera QR and recorded guardianship review; no duplicate child creation or immediate access based on an invitation. Native privacy/access history, revocation and correction requests preserve existing server guards. Native parent sharing uses the accepted short-lived one-use read-only contract, without permanent clinical grants or writes. Explicit authorized exports use the OS share sheet, with no app-created clinical cache file.
- System/light/dark native theme follows the selected Update 3 tokens and unchanged supplied raster emblems/family art. Standard icon library, scalable text, touch controls and real unknown/empty/loading/error states; no fabricated clinical percentages/counts/appointments.
- Only Auth session/verifier values go into SecureStore, using serialized atomic small chunks; session-only Auth is memory only. Theme/installation marker are nonclinical preferences. The installation marker prevents restoring iOS keychain Auth after reinstall. Clinical records, QR/invitation secrets and child identifiers stay in active view memory, never AsyncStorage or files. Background privacy curtain, foreground revalidation, scoped request generations and current backend guards prevent stale/cross-account display.

## Evidence still required

- Complete source build/type/major backend regression checks and native storage/input/domain tests.
- Expo dependency compatibility and Android/iOS native bundles; an exported JS bundle alone is not an APK, Xcode build, device/runtime proof or App Store release.
- Cloud Android compilation and synthetic runtime journey as feasible, including real UI sign-in, linked child/booklet/appointments/updates, QR, native storage/logout/current-JWT/revocation boundaries and fixture retirement. iOS cloud compilation/runtime where available; record exact feasibility and leave unproven native behavior open.
- Inspect actual native renders against the selected design system, publish only verified scope and synchronize primary main. App signing/store distribution, actual hardware-camera walkthrough, production vector/adaptive master and all real-data approvals remain explicit external gates.

## Primary implementation references

[Expo SDK 58](https://expo.dev/changelog/sdk-58), [Expo Router](https://docs.expo.dev/router/installation/), [SecureStore limits and persistence](https://docs.expo.dev/versions/latest/sdk/securestore/), [Supabase native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native). SDK 58 needs supported Node 22.13+/24.3+/26; cloud uses Node 24. Pinned Supabase JS 2.119.0 keeps the existing backend contract. No CLI v3 upgrade, new backend, EAS account, paid dependency, push service or identifiable data is introduced.

## Accepted Android development checkpoint

Android source 9d808ec passes mobile checks 43694866651 (dependency compatibility, TypeScript, nine tests and Android export). Exact native compilation 43694870085 produces arm64-v8a/x86_64 APK SHA-256 `535e3328b8276190bc4af6fcc03815121d431645b8f13ede3b161920510c2a77`. Full Android API 34 native runtime 43696384719 passes all twelve recorded checks, including actual password login, memory-only/remembered process restart, guarded booklet/growth/vaccinations, decoded one-use scoped clinician QR, native revocation denying the existing recipient session, appointments, in-app updates and logout surviving restart. The blank logout fallback is corrected with the SDK 58 protected stack's explicit login destination; encrypted storage and server guards remain intact.

Actual native login/home/booklet renders were inspected; labels, bordered controls, long synthetic names and navigation remain readable. The doctor's browser child form is separately fixed and accepted on desktop/Android Chrome in both themes (43695413773), with full 275-case regression 43695416835 and canonical publication recorded in PROGRESS.md.

Applied immutable native read projection 20261115034112 retains authenticated hosted HTTP acceptance: five views, other-parent denial, canonical Casablanca appointment/time parity and genuine Auth logout/old-token/session-row denial. It adds no clinical rights. Independent synthetic readback confirms one child, three clinical revisions, no active shares and no recipient grants/capabilities; original twenty-five-rule version remains draft revision one. Fixture retirement and exact binary publication are recorded in docs/mobile/android-acceptance.json and PROGRESS.md.

Private APK publication runs entirely in GitHub and requires matching successful build/runtime hashes, unchanged mobile/shared source and verified fixture retirement. Publication 43697474627 passed and the [private preview APK](https://github.com/ABDRRAHIM404/mon-enfant/releases/tag/android-v0.1.0-preview.1) is available with a matching GitHub asset SHA-256. See ANDROID_APK.md. This is development preview acceptance with synthetic data, not store distribution or real-patient authorization.

## Deferred iPhone and external gates

The owner explicitly deferred iPhone work. Corrected dual-architecture simulator packaging 43690462621 and partial runtime 43690833947 remain evidence only; full iOS runtime and distribution remain open. Do not dispatch iOS jobs or bypass Keychain/SecureStore. Prior initialization/signing findings remain in PROGRESS.md.

Physical Android camera/device acceptance, final brand/icon master, owner-approved production signing/store distribution, wider application email delivery and qualified clinical/source/credential/guardian/privacy/hosting/operations approvals remain open. Retain unfinished Phase 6 work and the complete Phase 0–8 scope.

The owner confirms that the physical Android camera recognized the format-only test QR and reached the request step; denial for that nonexistent invitation is expected. The owner deferred the genuine recipient-bound phone walkthrough. Fixture 18fd1a08ce97474b is retired, all four actors banned and private handoff files removed; never reuse that QR or those accounts. Prepare a fresh, separately scoped handoff only after website acceptance and owner approval to resume APK work. Full physical linking/booklet/logout acceptance remains open. See latest PROGRESS.md.
