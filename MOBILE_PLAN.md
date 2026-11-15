# Phase 8 — Android/iOS parent client

15 November 2026. M01 in USER_STORIES.md and the complete PROJECT_PLAN.md remain the acceptance scope. The previous turn was progress: real sharing was applied, tested, published and primary main synchronized. This turn starts the native client; it does not close clinical, legal, credential/guardian, hosting, email or remaining Phase 6 gates.

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

## Verified development checkpoint and pending runtime

The native client source now implements the required navigation and existing guarded workflows. Root CI 43670556470 passes 275 cases; mobile 43671670888 passes dependency compatibility, types, nine tests and all three platform JS exports. Android APK and unsigned iOS simulator compilation both pass 43669991631 at source 581133d. These binaries precede the correction selector and initiating-session header fix; updated source e08f345 passes mobile 43674000756 and root 43674020247; its iOS compilation passes while Android and native runtime remain pending in PROGRESS.md.

Applied native read projection 20261115034112 has actual authenticated hosted HTTP acceptance: five views, other-parent denial, provider Casablanca appointment/time parity and genuine Auth logout/old-token/session-row denial. It does not add clinical rights or replace the existing audited read functions. The original twenty-five-rule draft remains unchanged. Four synthetic actors under fixture c3ffab76351e4355 are active only for native runtime verification and require retirement.

Cloud Android/iOS UI automation is implemented, with secrets and raw automation traces confined to temporary private runner paths; only classified proofs and selected synthetic renders can be uploaded after success. Actual runtime, visual review and latest-source native acceptance remain open. No native app distribution or qualified approval is claimed.


Native runtime found a genuine iOS initialization blocker: the unsigned simulator artifact renders the login but cannot initialize secure session storage. Local simulator ad-hoc signing/application entitlement verification is being tested; it needs no distribution certificate. Do not consider the initial simulator ZIP an Auth-accepted client. The latest source adds initialization retry and passes mobile cloud 43675671068. Android emulator readiness fixes and actual synthetic UI/QR checks are still pending. See the exact run IDs, binary/source distinctions and active fixture/retirement obligation in PROGRESS.md.
