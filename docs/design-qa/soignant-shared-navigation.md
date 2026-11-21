# Espace soignant navigation inventory

The following pages inherit the approved `ClinicianShell` from a Next.js route layout. The verified and provisional layouts both use that shell and retain their respective session, role and data boundaries. Child breadcrumbs and tabs remain local to the child workflow. Dynamic segments below are route patterns.

| Area | Routes |
| --- | --- |
| Dashboard and main clinical views | `/dashboard`, `/consultations`, `/vaccinations`, `/growth`, `/documents`, `/guide-soignant` |
| Registry and registration | `/patients`, `/patients/new` (including paper transcription and parent fiche), `/patients/link`, `/patients/lookup/[universalId]` |
| Child overview and sharing | `/patients/[id]`, `/patients/[id]/guardians`, `/patients/[id]/summary` |
| Child clinical records | `/patients/[id]/records`, `/patients/[id]/records/new`, `/patients/[id]/records/[root]` |
| Child vaccinations and growth | `/patients/[id]/vaccinations`, `/patients/[id]/vaccinations/[item]`, `/patients/[id]/growth` |
| Appointments | `/appointments`, `/appointments/new`, `/patients/[id]/appointments`, `/patients/[id]/appointments/new`, `/patients/[id]/appointments/[appointment]` |
| Management and follow-up | `/follow-up`, `/access-requests`, `/registration-reviews`, `/registration-cases/[operation]`, `/parent-requests`, `/practices` |
| Professional permissions and redeemed parent share | `/account/clinical-permissions`, `/share/view/[id]` |
| Private provisional workspace | `/provisional`, `/provisional/children`, `/provisional/[id]`, `/provisional/consultations`, `/provisional/vaccinations`, `/provisional/growth`, `/provisional/appointments`, `/provisional/documents`, `/provisional/guide` |

Five shared URLs select the same shell for eligible clinicians and retain their other audience layouts: `/account`, `/verification`, `/vaccines`, `/vaccines/[id]`, and `/share`. The scanner still has a public entry before clinician authentication. The child JSON download at `/patients/[id]/export` is a data endpoint. Its URL and download behavior remain the same.

## Shared components and checks

- `ClinicianShell` supplies the responsive header, branding, desktop sidebar and guarded search destinations. The mobile drawer and account dropdown use the dashboard controls, including the existing sign-out action.
- `ClinicianNavigationState` and `ClinicianNavLink` derive active sections from each URL. Record screens supply their clinical kind so vaccination and growth records highlight the right section even under the generic records URL.
- Route loading screens render content skeletons inside the inherited shell. Role-shared loading screens remain neutral until the role is available.
- Ninety-five focused tests passed with isolated test files. Chromium exercised the shell at 1366 px and 390 px for all 46 route patterns plus two record-kind variants using fictional fixtures. The existing wider loading-suite failure for the missing parent add-child loading file remains outside this change.
