import Link from "next/link";
import { QrCode } from "@/components/qr/code";
import { clinicianLookupUrl } from "@/lib/qr/symbol";
import { appointmentTime } from "@/lib/appointments/calendar";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import { DoctorNav } from "@/components/registry/doctor-nav";
import { EndAccessForm } from "@/components/registry/forms";
import {
  uuidPattern,
  historyLabels,
  patientName,
  birthLabel,
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
  const [{ data, error }, visits] = await Promise.all([
    supabase.rpc("get_child_profile", { p_child_id: id }),
    supabase.rpc("patient_visit_overview", { p_child_id: id }),
  ]);
  if (
    error?.code === "42501" ||
    visits.error?.code === "42501" ||
    (!data && !error)
  )
    notFound();
  if (error || visits.error)
    throw new Error("Impossible de charger ce dossier.");
  const child = data as ChildProfile;
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
  return (
    <main className="account-page wide">
      <DoctorNav />
      <div className="page-heading">
        <span className="eyebrow">DOSSIER ENFANT</span>
        <h1 id="main-content" tabIndex={-1}>
          {patientName(child)}
        </h1>
        <p className="muted">
          {child.name_status === "provisional" ? "Identité provisoire · " : ""}
          {birthLabel(child)}
        </p>
      </div>
      <div className="tabs">
        <Link href={`/patients/${id}/records`}>Dossier clinique</Link>
        <Link href={`/patients/${id}/appointments`}>Rendez-vous</Link>
        <Link href={`/patients/${id}/vaccinations`}>Vaccinations</Link>
        <Link href={`/patients/${id}/growth`}>Croissance</Link>
        {child.can_manage_access && (
          <Link href={`/patients/${id}/guardians`}>Accès des parents</Link>
        )}
        <Link href={`/patients/${id}/summary`}>Résumé et impression</Link>
      </div>
      <section className="panel">
        <h2>Continuité des soins</h2>
        <p>
          Dernier soin documenté :{" "}
          {overview.last_documented_care || "non documenté"}.
        </p>
        <p>
          Mon prochain rendez-vous :{" "}
          {overview.next_own_appointment
            ? appointmentTime(overview.next_own_appointment.starts_at)
            : "non planifié"}
          .
        </p>
      </section>
      <div className="two-columns">
        <section className="panel">
          <h2>Identité et provenance</h2>
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
              {child.source_type === "paper_transcription"
                ? "Transcription papier"
                : "Nouvelle inscription"}
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
            <dd>{child.created_by_professional_id}</dd>
          </dl>
          <p className="notice">
            Consultez le dossier clinique pour les soins enregistrés et leur
            provenance. Un historique absent ne signifie pas une vaccination
            manquée ou un état de santé normal.
          </p>
        </section>
        <section className="panel">
          <h2>Mon registre et contact déclaré</h2>
          {child.registers.map((r, i) => (
            <p key={i}>
              <strong>{r.number}</strong> · {r.year} / {r.book} ·{" "}
              {r.facility_name}
            </p>
          ))}
          <dl className="details">
            <dt>Contact de soins</dt>
            <dd>{child.guardian_name || "Non renseigné"}</dd>
            <dt>Téléphone</dt>
            <dd>{child.guardian_phone || "Non renseigné"}</dd>
          </dl>
          <p className="fine">
            Le contact déclaré ne prouve pas une tutelle et ne dispose pas d’un
            accès parent.
          </p>
        </section>
      </div>
      <section className="panel">
        <h2>QR d’identification pour un professionnel</h2>
        <p>
          Connectez-vous à votre compte professionnel avant de scanner. Ce QR
          contient uniquement un identifiant de dossier ; il ne remplace aucune
          autorisation et ne contient aucun soin.
        </p>
        <QrCode
          value={clinicianLookupUrl(
            process.env.NEXT_PUBLIC_SITE_URL ?? "https://mon-enfant.vercel.app",
            child.universal_id,
          )}
          label="Identification du dossier — accès professionnel vérifié à l’ouverture"
        />
      </section>
      {child.can_manage_access && (
        <section className="panel">
          <h2>Autorisations du dossier</h2>
          <p className="fine">
            Vous gérez les accès de cet enfant. Une délégation doit correspondre
            à une autorisation vérifiée.
          </p>
          <div className="record-list">
            {grants.map((g) => (
              <article key={g.professional_id}>
                <strong>
                  {g.platform_id}
                  {g.is_self ? " (vous)" : ""}
                </strong>
                <p>
                  {g.revoked_at
                    ? "Accès révoqué"
                    : g.expires_at
                      ? `Échéance : ${g.expires_at}`
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
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
