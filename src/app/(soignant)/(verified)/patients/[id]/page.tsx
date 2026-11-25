import "./overview.css";
import Link from "next/link";
import {
  Activity,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  FileText,
  Info,
  QrCode as QrIcon,
  ShieldCheck,
  Syringe,
  UserRound,
} from "lucide-react";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import {
  ChildCareActions,
  ClinicalWorkspace,
} from "@/components/clinician/care-workspace";
import { ChildStatus } from "@/components/clinician/patient-profile";
import {
  OverviewDetails,
  UniversalIdCopy,
} from "@/components/clinician/child-overview/controls";
import { readChildVaccineFollowup } from "@/components/clinician/child-overview/read-vaccination";
import { clinicianName } from "@/lib/clinical/attribution";
import { readClinicalAttributions } from "@/lib/clinical/read-attribution";
import { QrCode } from "@/components/qr/code";
import { clinicianLookupUrl } from "@/lib/qr/symbol";
import {
  appointmentTime,
  localAppointmentInput,
} from "@/lib/appointments/calendar";
import { bookletDate } from "@/lib/vaccines/booklet";
import { EndAccessForm } from "@/components/registry/forms";
import {
  uuidPattern,
  historyLabels,
  type ChildProfile,
  type AccessGrant,
} from "@/lib/registry/types";

export const dynamic = "force-dynamic";

export default async function PatientProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const [profile, visits, capabilities] = await Promise.all([
    supabase.rpc("get_child_profile", { p_child_id: id }),
    supabase.rpc("patient_visit_overview", { p_child_id: id }),
    supabase.rpc("my_clinical_capabilities"),
  ]);
  if (
    profile.error?.code === "42501" ||
    visits.error?.code === "42501" ||
    (!profile.data && !profile.error)
  )
    notFound();
  if (profile.error || visits.error || capabilities.error)
    throw new Error("Impossible de charger ce dossier.");

  const child = profile.data as ChildProfile;
  const overview = visits.data as {
    last_documented_care: string | null;
    next_own_appointment: { starts_at: string } | null;
  };
  const [vaccination, access] = await Promise.all([
    readChildVaccineFollowup(supabase, child),
    child.can_manage_access
      ? supabase.rpc("child_access_grants", { p_child_id: id })
      : null,
  ]);
  if (access?.error?.code === "42501") notFound();
  if (access?.error)
    throw new Error("Impossible de charger les autorisations.");
  const grants = (access?.data ?? []) as AccessGrant[];
  const names = await readClinicalAttributions(
    supabase,
    [child.created_by_professional_id, ...grants.map((g) => g.platform_id)],
    { children: [id] },
  );
  const now = new Date().getTime();
  const base = `/patients/${id}`;
  const appointment = overview.next_own_appointment?.starts_at;
  const lastCare = overview.last_documented_care;
  const followup = [
    {
      title: "Prochain rendez-vous",
      href: `${base}/appointments`,
      Icon: CalendarDays,
      tone: appointment ? "amber" : "neutral",
      label: appointment ? (
        <time dateTime={appointment} title={appointmentTime(appointment)}>
          {bookletDate(localAppointmentInput(appointment).slice(0, 10))}
        </time>
      ) : (
        "Non planifié"
      ),
    },
    {
      title: "Prochaine vaccination",
      href: `${base}/vaccinations`,
      Icon: Syringe,
      tone: vaccination ? (vaccination.overdue ? "red" : "amber") : "neutral",
      label: vaccination ? (
        <>
          {vaccination.overdue ? "En retard · " : ""}
          <span title={vaccination.stage}>{vaccination.code}</span> ·{" "}
          <time dateTime={vaccination.start}>
            {bookletDate(vaccination.start)}
          </time>
          {vaccination.end && (
            <>
              {" "}
              au{" "}
              <time dateTime={vaccination.end}>
                {bookletDate(vaccination.end)}
              </time>
            </>
          )}
        </>
      ) : (
        "Aucune date confirmée"
      ),
    },
    {
      title: "Dernier soin documenté",
      href: `${base}/records`,
      Icon: Activity,
      tone: lastCare ? "green" : "neutral",
      label: lastCare ? (
        <time dateTime={lastCare}>{bookletDate(lastCare)}</time>
      ) : (
        "Aucun enregistrement"
      ),
    },
  ] as const;

  return (
    <ClinicalWorkspace
      active="children"
      childId={id}
      section="overview"
      child={child}
    >
      <div id="main-content" tabIndex={-1} className="child-overview">
        <h1 className="sr-only">Vue d’ensemble</h1>
        <div className="overview-top">
          <section
            className="overview-card overview-followup"
            aria-labelledby="overview-followup-heading"
          >
            <h2 id="overview-followup-heading">
              <ChartNoAxesCombined size={23} aria-hidden="true" />
              Suivi de l’enfant
            </h2>
            <ul>
              {followup.map(({ title, href, Icon, tone, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    title={
                      href.endsWith("/appointments")
                        ? "Votre prochain rendez-vous confirmé pour ce dossier"
                        : undefined
                    }
                  >
                    <Icon size={20} aria-hidden="true" />
                    <span>{title}</span>
                    <ChildStatus tone={tone}>{label}</ChildStatus>
                    <ChevronRight
                      size={17}
                      aria-hidden="true"
                      className="overview-followup-chevron"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <ChildCareActions
            compact
            childId={id}
            allowed={capabilities.data as string[]}
          />
        </div>
        <div className="overview-grid">
          <OverviewDetails
            title="Identité et provenance"
            icon={<UserRound size={23} aria-hidden="true" />}
          >
            <dl className="overview-facts">
              <div>
                <dt>Identifiant universel</dt>
                <dd>
                  <UniversalIdCopy value={child.universal_id} />
                </dd>
              </div>
              <div>
                <dt>Sexe</dt>
                <dd>
                  {child.sex === "female"
                    ? "Féminin"
                    : child.sex === "male"
                      ? "Masculin"
                      : "Non renseigné"}
                </dd>
              </div>
              <div>
                <dt>Source initiale</dt>
                <dd>
                  {child.source_type === "paper_transcription"
                    ? "Transcription papier"
                    : child.source_type === "new_registration"
                      ? "Nouvelle inscription"
                      : "Source non précisée"}
                </dd>
              </div>
              <div>
                <dt>Historique disponible</dt>
                <dd>
                  {historyLabels[child.history_status] ?? "Non renseigné"}
                </dd>
              </div>
              {child.paper_reference && (
                <div>
                  <dt>Référence papier</dt>
                  <dd>{child.paper_reference}</dd>
                </div>
              )}
              {child.provenance_note && (
                <div>
                  <dt>Provenance et limites</dt>
                  <dd>{child.provenance_note}</dd>
                </div>
              )}
              <div>
                <dt>Professionnel ayant créé le dossier</dt>
                <dd>
                  {clinicianName(names, child.created_by_professional_id)}
                </dd>
              </div>
            </dl>
            <p className="overview-note">
              <Info size={17} aria-hidden="true" />
              Un historique absent ou incertain ne permet pas de conclure sur
              l’état de santé ou la vaccination.
            </p>
          </OverviewDetails>
          <OverviewDetails
            title="Mon registre et contact déclaré"
            icon={<FileText size={23} aria-hidden="true" />}
          >
            {(child.registers.length ? child.registers : [null]).map(
              (r, index) => (
                <dl
                  className="overview-facts"
                  key={
                    r
                      ? `${r.facility_id}-${r.year}-${r.book}-${r.number}`
                      : index
                  }
                >
                  <div>
                    <dt>Référence du registre local</dt>
                    <dd>
                      {r
                        ? `${r.number} · ${r.year} / ${r.book}`
                        : "Non renseigné"}
                    </dd>
                  </div>
                  <div>
                    <dt>Référence SMI locale</dt>
                    <dd>{r?.smi_reference || "Non renseigné"}</dd>
                  </div>
                  <div>
                    <dt>Établissement</dt>
                    <dd>{r?.facility_name || "Non renseigné"}</dd>
                  </div>
                </dl>
              ),
            )}
            <dl className="overview-facts">
              <div>
                <dt>Contact de soins</dt>
                <dd>{child.guardian_name || "Non renseigné"}</dd>
              </div>
              <div>
                <dt>Téléphone</dt>
                <dd>{child.guardian_phone || "Non renseigné"}</dd>
              </div>
            </dl>
            <p className="overview-note">
              <Info size={17} aria-hidden="true" />
              La qualité de responsable et l’accès parent exigent une
              vérification distincte du contact déclaré.
            </p>
          </OverviewDetails>
          <OverviewDetails
            title="QR d’identification professionnelle"
            icon={<QrIcon size={23} aria-hidden="true" />}
          >
            <div className="overview-qr">
              <QrCode
                value={clinicianLookupUrl(
                  process.env.NEXT_PUBLIC_SITE_URL ??
                    "https://mon-enfant.vercel.app",
                  child.universal_id,
                )}
                label="QR d’identification du dossier enfant"
              />
              <p>
                Ce QR contient uniquement l’identifiant du dossier.
                Connectez-vous à votre compte soignant pour le scanner.
                L’ouverture des soins exige une autorisation existante.
              </p>
            </div>
          </OverviewDetails>
          {child.can_manage_access && (
            <OverviewDetails
              title="Autorisations des professionnels"
              icon={<ShieldCheck size={23} aria-hidden="true" />}
            >
              {!grants.length ? (
                <p className="overview-empty">
                  Aucune autorisation enregistrée.
                </p>
              ) : (
                <ul className="overview-grants">
                  {grants.map((grant) => {
                    const expired =
                      !!grant.expires_at && Date.parse(grant.expires_at) <= now;
                    return (
                      <li key={grant.professional_id}>
                        <span className="overview-grant-icon">
                          <UserRound size={21} aria-hidden="true" />
                        </span>
                        <div>
                          <strong>
                            {clinicianName(names, grant.platform_id)}
                            {grant.is_self && " (vous)"}
                          </strong>
                          <p>
                            <ChildStatus
                              tone={
                                grant.revoked_at || expired
                                  ? "neutral"
                                  : "green"
                              }
                            >
                              {grant.revoked_at
                                ? "Révoqué"
                                : expired
                                  ? "Expiré"
                                  : "Actif"}
                            </ChildStatus>
                            <span>
                              {grant.expires_at
                                ? `Échéance : ${appointmentTime(grant.expires_at)}`
                                : "Sans échéance"}{" "}
                              ·{" "}
                              {grant.can_manage_access
                                ? "Gestion des accès"
                                : "Consultation autorisée"}
                            </span>
                          </p>
                          {!grant.is_self && !grant.revoked_at && (
                            <details>
                              <summary>Gérer cet accès</summary>
                              <EndAccessForm
                                childId={id}
                                professionalId={grant.professional_id}
                              />
                            </details>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </OverviewDetails>
          )}
        </div>
      </div>
    </ClinicalWorkspace>
  );
}
