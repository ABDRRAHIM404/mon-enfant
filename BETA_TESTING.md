# Mon Enfant beta testing

The hosted application is a production-style beta for invited testers. Ask testers to use invented child records, clinical values, credentials, documents and vaccination histories. Keep the existing verification, guardian consent, per-record access and clinical capability checks in place when onboarding testers. Give each tester an individual account through the normal sign-in and verification flow.

## Test journeys

| Role                     | Test journey                                                                                                                                                   | Expected result                                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signed-out visitor       | Open the homepage, role entry links, sign-up and recovery pages.                                                                                               | Correct pages load, with role-specific copy. Protected pages require a session.                                                                                                   |
| Parent                   | Register, confirm email and use an invitation. Open the child’s booklet, vaccination history, growth, appointments and notifications.                          | Only approved linked records appear. The UI distinguishes documented care and vaccine references.                                                                                 |
| Parent                   | Update preferences, request a correction, create a restricted QR share and revoke an unused share.                                                             | Changes survive reload. A revoked token is refused.                                                                                                                               |
| Doctor or nurse          | Verify role, find an authorized or provisional record, and document a fictional consultation, vaccination, growth measurement and appointment where permitted. | Each authorized action persists. Provisional records remain private.                                                                                                              |
| Verified doctor or nurse | Open **Scanner un QR parent**, use the camera, confirm opening, and try the image and paste fallbacks.                                                         | The code is filled without automatic redemption. The authorized view opens once. Expired and revoked codes are refused.                                                           |
| Administrator            | Review fictional verifications, find professional accounts, and test permissions and catalogue tabs with staff roles granted through the normal process.       | Guarded data and actions correspond to staff grants.                                                                                                                              |
| Any role                 | Sign in with the checkbox checked and unchecked. Restart the browser without session restore, using the same profile, and sign out again.                      | The checked case carries a persistent session cookie. The unchecked case uses a session cookie. Sign-out still ends access. The browser decides whether to offer password saving. |

## Bug reports

Use **Guide et aide** in the parent or clinician workspace and select **Signaler un bug par e-mail**. Include the role, page, approximate time, device, browser, exact steps, expected behavior and actual result. Keep medical data, passwords, verification evidence, QR codes and temporary links out of reports.

## Release limits

The beta uses fictional data. Access to real patient data requires the external clinical, regulatory, privacy and operating approvals already tracked in the project plan. Document upload remains unimplemented. The mobile APK is outside this web rollout. An accessible clinical page and a healthy endpoint do not establish successful signed-in journeys, actual email delivery or physical-device camera acceptance. Record those checks when authorized testers complete them.
