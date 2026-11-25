# Espace soignant navigation inventory

The following pages inherit the approved `ClinicianShell` from a Next.js route layout. The verified and provisional layouts both use that shell and retain their respective session, role and data boundaries. The persistent layout under `/patients/[id]` supplies the child breadcrumb, identity card and tabs for the entire dossier. Dynamic segments below are route patterns.

| Area | Routes |
| --- | --- |
| Main workspace | `/dashboard`, `/documents`, `/guide-soignant` |
| Compatibility redirects | `/consultations`, `/vaccinations`, `/growth` and their `/provisional` equivalents |
| Registry and registration | `/patients`, `/patients/new` (including paper transcription and parent fiche), `/patients/link`, `/patients/lookup/[universalId]` |
| Child overview and sharing | `/patients/[id]`, `/patients/[id]/edit`, `/patients/[id]/guardians`, `/patients/[id]/summary` |
| Child consultations and clinical records | `/patients/[id]/consultations`, `/patients/[id]/records`, `/patients/[id]/records/new`, `/patients/[id]/records/[root]` |
| Child vaccinations and growth | `/patients/[id]/vaccinations`, `/patients/[id]/vaccinations/follow-up`, `/patients/[id]/vaccinations/[item]`, `/patients/[id]/growth` |
| Appointments | `/appointments`, `/appointments/new`, `/patients/[id]/appointments`, `/patients/[id]/appointments/new`, `/patients/[id]/appointments/[appointment]` |
| Management and follow-up | `/follow-up`, `/access-requests`, `/registration-reviews`, `/registration-cases/[operation]`, `/parent-requests`, `/practices` |
| Professional permissions and redeemed parent share | `/account/clinical-permissions`, `/share/view/[id]` |
| Private provisional workspace | `/provisional`, `/provisional/children`, `/provisional/[id]`, `/provisional/[id]/consultations`, `/provisional/[id]/vaccinations`, `/provisional/[id]/growth`, `/provisional/appointments`, `/provisional/documents`, `/provisional/guide` |

Five shared URLs select the same shell for eligible clinicians and retain their other audience layouts: `/account`, `/verification`, `/vaccines`, `/vaccines/[id]`, and `/share`. The scanner still has a public entry before clinician authentication. The child JSON download at `/patients/[id]/export` is a data endpoint. Its URL and download behavior remain the same.

## Shared components and checks

- `ClinicianShell` supplies the responsive header, branding, desktop sidebar and guarded search destinations. The mobile drawer and account dropdown use the dashboard controls, including the existing sign-out action.
- `clinicianMainNavigation` supplies both the desktop rail and the mobile feature drawer. Every verified child-record route highlights Enfants in the rail. The local tab bar derives its active section from the current child route and reveals it within the horizontal scroll container. Parent access appears for dossier managers.
- Route loading screens render content skeletons inside the inherited shell. Role-shared loading screens remain neutral until the role is available.
- The route inventory covers 47 pages under the verified and provisional clinician layouts. The six old clinical collection URLs resolve to a child route when a child is specified. Otherwise, they open the appropriate directory in selection mode.
