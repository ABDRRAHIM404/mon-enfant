import Link from "next/link";
import {
  ChildPageHeading,
  ChildPanel,
  ChildStatus,
} from "@/components/clinician/patient-profile";
import { bookletDate } from "@/lib/vaccines/booklet";
import { clinicianName } from "@/lib/clinical/attribution";
import { readClinicalAttributions } from "@/lib/clinical/read-attribution";
import { QrCode } from "@/components/qr/code";
import { clinicianLookupUrl } from "@/lib/qr/symbol";
import { appointmentTime } from "@/lib/appointments/calendar";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import {
  ChildCareActions,
  ClinicalWorkspace,
} from "@/components/clinician/care-workspace";
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
  const [{ data, error }, visits, capabilities] = await Promise.all([
    supabase.rpc("get_child_profile", { p_child_id: id }),
    supabase.rpc("patient_visit_overview", { p_child_id: id }),
    supabase.rpc("my_clinical_capabilities"),
  ]);
  if (
    error?.code === "42501" ||
    visits.error?.code === "42501" ||
    (!data && !error)
  )
    notFound();
  if (error || visits.error || capabilities.error)
    throw new Error("Impossible de charger ce dossier.");
  const child = data as ChildProfile;
  const now = new Date().getTime();
  const overview = visits.data as {
    last_documented_care: string | null;
    next_own_appointment: { starts_at: string } | null;
  };
  let grants: AccessGrant[] = [];
  if (child.can_manage_access) {
    const result = await supabase.rpc("child_access_grants", {
      p_child_id: id,
    });
    if (result.error)
      throw new Error("Impossible de charger les autorisations.");
    grants = result.data as AccessGrant[];
  }
  const attributions = await readClinicalAttributions(
    supabase,
    [
      child.created_by_professional_id,
      ...grants.map((grant) => grant.platform_id),
    ],
    { children: [id] },
  );
  return (
    <ClinicalWorkspace
      active="children"
      childId={id}
      section="overview"
      child={child}
    >
      <ChildPageHeading
        title="Vue d’ensemble"
        description="Suivi, identité et accès au dossier de l’enfant."
      />
      <div className="child-grid">
        <ChildPanel title="Dernier soin documenté">
          <p>
            {overview.last_documented_care ? (
              <time dateTime={overview.last_documented_care}>
                {bookletDate(overview.last_documented_care)}
              </time>
            ) : (
              "Non documenté"
            )}
          </p>
          <Link className="text-link" href={`/patients/${id}/records`}>
            Ouvrir le dossier clinique
          </Link>
        </ChildPanel>
        <ChildPanel title="Mon prochain rendez-vous">
          <p>
            {overview.next_own_appointment
              ? appointmentTime(overview.next_own_appointment.starts_at)
              : "Non planifié"}
          </p>
          <Link className="text-link" href={`/patients/${id}/appointments`}>
            Voir les rendez-vous
          </Link>
        </ChildPanel>
      </div>
      <ChildCareActions childId={id} allowed={capabilities.data as string[]} />
      <div className="child-grid">
        <ChildPanel title="Identité et provenance">
          <dl className="details">
            <dt>Identifiant universel</dt>
            <dd>{child.universal_id}</dd>
            <dt>Sexe</dt>
            <dd>
              {
                (
                  {
                    female: "Féminin",
                    male: "Masculin",
                    unknown: "Inconnu",
                  } as Record<string, string>
                )[child.sex]
              }
            </dd>
            <dt>Historique disponible</dt>
            <dd>{historyLabels[child.history_status]}</dd>
            <dt>Source initiale</dt>
            <dd>
              {(
                {
                  paper_transcription: "Transcription papier",
                  new_registration: "Nouvelle inscription",
                } as Record<string, string>
              )[child.source_type] ?? "Source non précisée"}
            </dd>
            {child.paper_reference && (
              <>
                <dt>Référence papier</dt>
                <dd>{child.paper_reference}</dd>
              </>
            )}
            {child.provenance_note && (
              <>
                <dt>Provenance et limites</dt>
                <dd>{child.provenance_note}</dd>
              </>
            )}
            <dt>Professionnel ayant créé le dossier</dt>
            <dd>
              {clinicianName(attributions, child.created_by_professional_id)}
            </dd>
          </dl>
          <p className="notice">
            Consultez le dossier clinique pour les soins enregistrés et leur
            provenance. Un historique absent ne signifie pas une vaccination
            manquée ou un état de santé normal.
          </p>
        </ChildPanel>
        <ChildPanel title="Mon registre et contact déclaré">
          {child.registers.map((r, i) => (
            <p key={i}>
              <strong>{r.number}</strong> · {r.year} / {r.book} ·{" "}
              {r.facility_name}
              {r.smi_reference && (
                <span> · Référence SMI locale : {r.smi_reference}</span>
              )}
            </p>
          ))}
          <dl className="details">
            <dt>Contact de soins</dt>
            <dd>{child.guardian_name || "Non renseigné"}</dd>
            <dt>Téléphone</dt>
            <dd>{child.guardian_phone || "Non renseigné"}</dd>
          </dl>
          <p className="fine">
            La qualité de responsable et l’accès parent exigent une vérification
            distincte du contact déclaré.
          </p>
        </ChildPanel>
      </div>
      <ChildPanel
        title="QR d’identification professionnelle"
        className="child-panel-spaced"
      >
        <div className="child-identity-qr">
          <p>
            Connectez-vous à votre compte professionnel avant de scanner. Ce QR
            contient uniquement un identifiant de dossier ; il ne remplace
            aucune autorisation et ne contient aucun soin.
          </p>
          <QrCode
            value={clinicianLookupUrl(
              process.env.NEXT_PUBLIC_SITE_URL ??
                "https://mon-enfant.vercel.app",
              child.universal_id,
            )}
            label="Identification du dossier — accès professionnel vérifié à l’ouverture"
          />
        </div>
      </ChildPanel>
      {child.can_manage_access && (
        <ChildPanel title="Autorisations des professionnels">
          <p className="fine">
            Vous gérez les accès de cet enfant. Une délégation doit correspondre
            à une autorisation vérifiée.
          </p>
          <ul className="child-list">
            {grants.map((g) => (
              <li key={g.professional_id}>
                <strong>
                  {clinicianName(attributions, g.platform_id)}
                  {g.is_self ? " (vous)" : ""}
                </strong>
                <p>
                  <ChildStatus
                    tone={
                      !g.revoked_at &&
                      (!g.expires_at || Date.parse(g.expires_at) > now)
                        ? "green"
                        : "neutral"
                    }
                  >
                    {g.revoked_at
                      ? "Révoqué"
                      : g.expires_at && Date.parse(g.expires_at) <= now
                        ? "Expiré"
                        : "Actif"}
                  </ChildStatus>
                </p>
                <p>
                  {g.revoked_at
                    ? "Accès révoqué"
                    : g.expires_at
                      ? `Échéance : ${appointmentTime(g.expires_at)}`
                      : "Sans échéance"}{" "}
                  ·{" "}
                  {g.can_manage_access
                    ? "Gestion des accès"
                    : "Consultation autorisée"}
                </p>
                {!g.is_self && !g.revoked_at && (
                  <EndAccessForm
                    childId={id}
                    professionalId={g.professional_id}
                  />
                )}
              </li>
            ))}
          </ul>
        </ChildPanel>
      )}
    </ClinicalWorkspace>
  );
}
