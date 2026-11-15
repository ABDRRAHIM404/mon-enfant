# Mon Enfant Parent — Android development APK

The Android app uses the same Supabase accounts, sessions and recorded guardian permissions as [the website](https://mon-enfant.vercel.app). It is a native React Native/Expo client. The website remains the clinician/admin interface.

## Current status

The APK compiles for arm64-v8a and x86_64. Cloud native tests have exercised sign-in, memory-only sessions, encrypted remembered sessions, linked children, booklet, raw growth charts and vaccination history. Complete QR/redemption/revocation, appointment/notification/logout acceptance and publication are still in progress. See PROGRESS.md for exact evidence; this document does not declare the APK ready before those checks pass.

The owner explicitly deferred iPhone work. Preserve its implementation and evidence, but do not run iOS builds/tests until the owner resumes it.

## Install and sign in after publication

1. Download the `.apk` attached to the private GitHub Android preview release linked here after acceptance. Builds and publication run in GitHub; no local dependency installation or compilation is needed.
2. Open the APK on an Android phone and allow installation from that browser/file manager if Android requests it. The launcher name is **Mon Enfant — développement**.
3. Sign in with the same Mon Enfant account as the website. Signup, confirmation and password recovery open the website in the system browser.
4. Activate your own parent display profile if requested. A profile alone does not grant access to a child: the existing-child invitation and separate recorded guardian approval are still required.

Leaving **Rester connecté** unchecked keeps the app's session in memory only. Checking it stores Auth values in the phone's encrypted storage with the documented retention bound. Clinical records and invitation/share secrets are not saved as an offline cache.

## Included parent workflows

Linked children and booklet/history, growth measurements without diagnostic percentiles, vaccination history and version-gated routine references, server-formatted Casablanca appointments, in-app updates/read state, invitation QR/paste, correction requests, privacy/access history, revocation, explicit export and short-lived scoped clinician sharing. The app does not grant clinical write rights or promote provisional records.

This is a development preview with synthetic-data acceptance and development signing. Physical-device camera acceptance, final brand/icon master, store signing/distribution, wider application email delivery and qualified clinical/privacy/hosting approvals remain open. iPhone distribution is deferred. No store release or identifiable-patient pilot is implied.
