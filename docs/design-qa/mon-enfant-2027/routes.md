# Page inventory

66 Next.js page entry points were inventoried from source. Route families share the corresponding workspace styles. Each row lists direct guards, query calls or presentation delegates found at the entry point. Additional checks are implemented in the linked workflow components and server actions. Browser evidence is documented in the [design review](review.md).

## Public and account entry

| Page                            | Source entry points                                                                                             | Loading boundary |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------- |
| `/account/clinical-permissions` | `clinical_capability_history`, `my_clinical_capabilities`, `requireApprovedDoctor`                              | Own              |
| `/account`                      | `can_manage_clinical_permissions`, `can_review_professionals`, `getProfessional`, `vaccine_catalog_permissions` | Own              |
| `/auth/reset-password`          | `requireUser`                                                                                                   | Own              |
| `/forgot-password`              | Local content or shared form                                                                                    | Own              |
| `/login`                        | Local content or shared form                                                                                    | Own              |
| `/`                             | `PublicHeader`                                                                                                  | Own              |
| `/signup`                       | Local content or shared form                                                                                    | Own              |
| `/verification`                 | `getProfessional`                                                                                               | Own              |

## Parent

| Page                                 | Source entry points                                                                          | Loading boundary |
| ------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------- |
| `/parent/account`                    | `requireUser`                                                                                | Own              |
| `/parent/children/[id]/appointments` | `parent_appointment_calendar`, `requireUser`                                                 | Own              |
| `/parent/children/[id]`              | `parent_child_booklet`, `requireUser`                                                        | Own              |
| `/parent/children/[id]/privacy`      | `list_clinician_shares`, `parent_access_history`, `parent_workspace`, `requireUser`          | Own              |
| `/parent/children/[id]/requests`     | `parent_corrections`, `parent_workspace`, `requireUser`                                      | Own              |
| `/parent/children/[id]/vaccinations` | `list_clinician_shares`, `parent_vaccination_history`, `parent_vaccine_items`, `requireUser` | Own              |
| `/parent/invitation`                 | `ParentWorkflow`                                                                             | Own              |
| `/parent/notifications`              | `parent_updates`, `requireUser`                                                              | Own              |
| `/parent`                            | `parent_child_booklet`, `parent_home_summary`, `requireUser`                                 | Own              |
| `/parent/requests`                   | `parent_corrections`, `requireUser`                                                          | Own              |
| `/parent/settings`                   | `parent_settings`, `parent_workspace`, `requireUser`                                         | Own              |

## Clinical

| Page                                        | Source entry points                                                                                                                                            | Loading boundary |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `/access-requests`                          | `my_access_requests`, `pending_access_requests`, `requireApprovedDoctor`                                                                                       | Own              |
| `/appointments/new`                         | `list_patients`, `my_clinical_capabilities`, `requireApprovedDoctor`                                                                                           | Own              |
| `/appointments`                             | `appointment_calendar`, `my_clinical_capabilities`, `requireApprovedDoctor`                                                                                    | Own              |
| `/consultations`                            | `PatientSection`                                                                                                                                               | Own              |
| `/dashboard`                                | `appointment_worklist`, `clinician_recent_consultations`, `my_clinical_capabilities`, `registry_summary`, `requireApprovedDoctor`, `vaccine_followup_worklist` | Own              |
| `/documents`                                | `ClinicianDocuments`                                                                                                                                           | Own              |
| `/follow-up`                                | `requireApprovedDoctor`                                                                                                                                        | Own              |
| `/growth`                                   | `PatientSection`                                                                                                                                               | Own              |
| `/parent-requests`                          | `doctor_parent_corrections`, `requireApprovedDoctor`                                                                                                           | Own              |
| `/patients/[id]/appointments/[appointment]` | `appointment_history`, `my_clinical_capabilities`, `requireApprovedDoctor`                                                                                     | Own              |
| `/patients/[id]/appointments/new`           | `appointment_item_options`, `get_child_profile`, `my_clinical_capabilities`, `my_facilities`, `requireApprovedDoctor`                                          | Own              |
| `/patients/[id]/appointments`               | `get_child_profile`, `my_clinical_capabilities`, `patient_appointments`, `requireApprovedDoctor`                                                               | Own              |
| `/patients/[id]/growth`                     | `clinical_timeline`, `my_clinical_capabilities`, `requireApprovedDoctor`                                                                                       | Own              |
| `/patients/[id]/guardians`                  | `doctor_guardian_overview`, `requireApprovedDoctor`                                                                                                            | Own              |
| `/patients/[id]`                            | `child_access_grants`, `get_child_profile`, `my_clinical_capabilities`, `patient_visit_overview`, `requireApprovedDoctor`                                      | Own              |
| `/patients/[id]/records/[root]`             | `clinical_entry_history`, `my_clinical_capabilities`, `my_facilities`, `requireApprovedDoctor`, `vaccine_form_choices`, `vaccine_items_export`                 | Own              |
| `/patients/[id]/records/new`                | `get_child_profile`, `my_clinical_capabilities`, `my_facilities`, `requireApprovedDoctor`, `vaccine_form_choices`, `vaccine_items_export`                      | Own              |
| `/patients/[id]/records`                    | `clinical_timeline`, `my_clinical_capabilities`, `requireApprovedDoctor`                                                                                       | Own              |
| `/patients/[id]/summary`                    | `appointments_export`, `clinical_export`, `get_child_profile`, `requireApprovedDoctor`, `vaccine_items_export`                                                 | Own              |
| `/patients/[id]/vaccinations/[item]`        | `my_clinical_capabilities`, `my_facilities`, `requireApprovedDoctor`, `vaccine_item_history`                                                                   | Own              |
| `/patients/[id]/vaccinations`               | `clinical_timeline`, `get_child_profile`, `my_clinical_capabilities`, `my_facilities`, `patient_vaccine_items`, `requireApprovedDoctor`, `vaccine_catalog`     | Own              |
| `/patients/link`                            | `my_facilities`, `requireApprovedDoctor`                                                                                                                       | Own              |
| `/patients/lookup/[universalId]`            | `lookup_authorized_child`, `requireApprovedDoctor`                                                                                                             | Own              |
| `/patients/new`                             | `my_facilities`, `requireApprovedDoctor`                                                                                                                       | Own              |
| `/patients`                                 | `list_patients`, `requireApprovedDoctor`                                                                                                                       | Own              |
| `/practices`                                | `my_facilities`, `requireApprovedDoctor`                                                                                                                       | Own              |
| `/registration-cases/[operation]`           | `my_registration_cases`, `requireApprovedDoctor`                                                                                                               | Own              |
| `/registration-reviews`                     | `my_registration_cases`, `registration_review_queue`, `requireApprovedDoctor`                                                                                  | Own              |
| `/share`                                    | `PublicHeader`                                                                                                                                                 | Own              |
| `/share/view/[id]`                          | `read_clinician_share`, `requireApprovedDoctor`                                                                                                                | Own              |
| `/vaccinations`                             | `PatientSection`                                                                                                                                               | Own              |
| `/vaccines/[id]`                            | `requireVaccineCatalog`, `vaccine_catalog`                                                                                                                     | Own              |
| `/vaccines`                                 | `requireVaccineCatalog`, `vaccine_catalog`                                                                                                                     | Own              |

## Provisional

| Page                         | Source entry points                                              | Loading boundary |
| ---------------------------- | ---------------------------------------------------------------- | ---------------- |
| `/provisional/[id]`          | `getProfessional`, `provisional_booklet`, `vaccine_form_choices` | Own              |
| `/provisional/appointments`  | `ProvisionalSection`                                             | Own              |
| `/provisional/children`      | `ProvisionalSection`                                             | Own              |
| `/provisional/consultations` | `ProvisionalSection`                                             | Own              |
| `/provisional/documents`     | `ClinicianDocuments`                                             | Own              |
| `/provisional/growth`        | `ProvisionalSection`                                             | Own              |
| `/provisional`               | `getProfessional`, `provisional_workspace`                       | Own              |
| `/provisional/vaccinations`  | `ProvisionalSection`                                             | Own              |

## Operations

| Page                          | Source entry points                                                                            | Loading boundary |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | ---------------- |
| `/admin/access`               | `getProfessional`                                                                              | Own              |
| `/admin/clinical-permissions` | `clinical_capability_history`, `list_clinical_permissions`, `requireClinicalPermissionManager` | Own              |
| `/admin`                      | `requireReviewer`                                                                              | Own              |
| `/admin/professionals`        | `list_admin_professionals`, `requireReviewer`                                                  | Own              |
| `/admin/verifications/[id]`   | `approval_notification_status`, `requireReviewer`                                              | Own              |
| `/admin/verifications`        | `requireReviewer`                                                                              | Own              |
