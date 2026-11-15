# Mon Enfant Parent — Android development APK

The Android app uses the same Supabase accounts, sessions and recorded guardian permissions as [the website](https://mon-enfant.vercel.app). It is a native React Native/Expo client. The website remains the clinician/admin interface.

## Current status

The exact arm64-v8a/x86_64 APK from build 43694870085 passed full native Android runtime 43696384719: real sign-in, memory-only and encrypted remembered sessions across process restart, linked booklet/growth/vaccinations, scoped QR redemption/revocation, appointments, in-app updates and logout surviving restart. The four synthetic accounts and nine temporary encrypted values are retired. Exact source, hash and classified acceptance are recorded in docs/mobile/android-acceptance.json. The [private Android preview release](https://github.com/ABDRRAHIM404/mon-enfant/releases/tag/android-v0.1.0-preview.1) is published; download `mon-enfant-parent-0.1.0-preview.1.apk` from its Assets section (about 72 MB). Sign in to GitHub with repository access.

The owner explicitly deferred iPhone work. Preserve its implementation and evidence, but do not run iOS builds/tests until the owner resumes it.

## Install and sign in

1. Download the `.apk` attached to the [private GitHub Android preview release](https://github.com/ABDRRAHIM404/mon-enfant/releases/tag/android-v0.1.0-preview.1). Builds and publication run in GitHub; no local dependency installation or compilation is needed.
2. Open the APK on an Android phone and allow installation from that browser/file manager if Android requests it. The launcher name is **Mon Enfant — développement**.
3. Sign in with the same Mon Enfant account as the website. Signup, confirmation and password recovery open the website in the system browser.
4. Activate your own parent display profile if requested. A profile alone does not grant access to a child: the existing-child invitation and separate recorded guardian approval are still required.

Leaving **Rester connecté** unchecked keeps the app's session in memory only. Checking it stores Auth values in the phone's encrypted storage with the documented retention bound. Clinical records and invitation/share secrets are not saved as an offline cache.

## Included parent workflows

Linked children and booklet/history, growth measurements without diagnostic percentiles, vaccination history and version-gated routine references, server-formatted Casablanca appointments, in-app updates/read state, invitation QR/paste, correction requests, privacy/access history, revocation, explicit export and short-lived scoped clinician sharing. The app does not grant clinical write rights or promote provisional records.

This is a development preview with synthetic-data acceptance and development signing. Physical-device camera acceptance, final brand/icon master, store signing/distribution, wider application email delivery and qualified clinical/privacy/hosting approvals remain open. iPhone distribution is deferred. No store release or identifiable-patient pilot is implied.
