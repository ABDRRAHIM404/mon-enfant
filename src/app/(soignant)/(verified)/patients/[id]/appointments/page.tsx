import { readClinicalAttributions } from "@/lib/clinical/read-attribution";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicalWorkspace } from "@/components/clinician/care-workspace";
import { AppointmentCard } from "@/components/appointments/card";
import { LiveRefresh } from "@/components/appointments/live-refresh";
import {
  uuidPattern,
  patientName,
  type ChildProfile,
} from "@/lib/registry/types";
import type { AppointmentPage } from "@/lib/appointments/types";
export const dynamic = "force-dynamic";
export default async function PatientAppointments({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { id } = await params,
    q = await searchParams;
  if (!uuidPattern.test(id)) notFound();
  const page = Math.min(10000, Math.max(1, Math.floor(Number(q.page) || 1)));
  const [profile, appointments, caps] = await Promise.all([
    supabase.rpc("get_child_profile", { p_child_id: id }),
    supabase.rpc("patient_appointments", { p_child_id: id, p_page: page }),
    supabase.rpc("my_clinical_capabilities"),
  ]);
  if (profile.error?.code === "42501" || appointments.error?.code === "42501")
    notFound();
  if (profile.error || appointments.error || caps.error)
    throw new Error("Impossible de charger les rendez-vous.");
  const data = appointments.data as AppointmentPage;
  const attributions = await readClinicalAttributions(
    supabase,
    data.items.flatMap((row) => [
      row.professional_id,
      row.documentation?.professional_id,
    ]),
    { children: [id] },
  );
  return (
    <ClinicalWorkspace
      active="appointments"
      childId={id}
      section="appointments"
    >
      <div className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          Rendez-vous — {patientName(profile.data as ChildProfile)}
        </h1>
        <p className="muted">
          Les rendez-vous des professionnels autorisés restent attribués à leur
          responsable.
        </p>
      </div>
      <div className="care-page-actions">
        {(caps.data as string[]).includes("appointment") ? (
          <Link
            className="button primary"
            href={`/patients/${id}/appointments/new`}
          >
            Planifier un rendez-vous
          </Link>
        ) : (
          <p className="notice">
            Une habilitation de gestion des rendez-vous est nécessaire pour en
            planifier.{" "}
            <Link className="text-link" href="/account/clinical-permissions">
              Mes habilitations
            </Link>
          </p>
        )}
        <Link className="button secondary" href="/appointments">
          Mon calendrier
        </Link>
      </div>
      <LiveRefresh />
      <h2>Rendez-vous conservés</h2>
      {data.items.map((appointment) => (
        <AppointmentCard
          key={appointment.id}
          appointment={appointment}
          attributions={attributions}
        />
      ))}
      {!data.items.length && (
        <p className="empty-state">
          Aucun rendez-vous documenté. Cela ne détermine aucun statut vaccinal.
        </p>
      )}
      <nav className="pagination" aria-label="Rendez-vous de l’enfant">
        {page > 1 && <Link href={`?page=${page - 1}`}>Précédent</Link>}
        <span>
          Page {page} · {data.total} rendez-vous
        </span>
        {page * 30 < data.total && (
          <Link href={`?page=${page + 1}`}>Suivant</Link>
        )}
      </nav>
    </ClinicalWorkspace>
  );
}
