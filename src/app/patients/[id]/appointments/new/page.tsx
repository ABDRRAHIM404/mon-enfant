import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireApprovedDoctor } from "@/lib/auth";
import { DoctorNav } from "@/components/registry/doctor-nav";
import { AppointmentForm } from "@/components/appointments/form";
import {
  uuidPattern,
  patientName,
  type ChildProfile,
  type Facility,
} from "@/lib/registry/types";
import type { AppointmentOption } from "@/lib/appointments/types";
export const dynamic = "force-dynamic";
export default async function NewAppointment({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ item?: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { id } = await params,
    q = await searchParams;
  if (!uuidPattern.test(id)) notFound();
  const [profile, places, capabilities, options] = await Promise.all([
    supabase.rpc("get_child_profile", { p_child_id: id }),
    supabase.rpc("my_facilities"),
    supabase.rpc("my_clinical_capabilities"),
    supabase.rpc("appointment_item_options", { p_child_id: id }),
  ]);
  if (profile.error?.code === "42501" || options.error?.code === "42501")
    notFound();
  if (
    profile.error ||
    places.error ||
    capabilities.error ||
    (options.error && options.error.code !== "54000")
  )
    throw new Error("Impossible de préparer le rendez-vous.");
  const facilities = places.data as Facility[],
    allowed = (capabilities.data as string[]).includes("appointment");
  return (
    <main className="account-page wide">
      <DoctorNav />
      <div className="page-heading">
        <h1 id="main-content" tabIndex={-1}>Planifier — {patientName(profile.data as ChildProfile)}</h1>
        <p className="muted">
          Choisissez le créneau après examen du dossier. Aucun rattrapage n’est
          calculé.
        </p>
      </div>
      <Link className="text-link" href={`/patients/${id}/appointments`}>
        Retour aux rendez-vous
      </Link>
      <section className="panel">
        {!allowed ? (
          <p className="notice">
            Une habilitation explicite à la gestion des rendez-vous est
            nécessaire.
          </p>
        ) : options.error?.code === "54000" ? (
          <p className="notice">
            La limite interactive de références est dépassée. Utilisez une
            procédure autorisée avec un périmètre convenu ; aucune liste
            partielle n’a été préparée.
          </p>
        ) : !facilities.length ? (
          <p>
            Déclarez un{" "}
            <Link className="text-link" href="/practices">
              lieu d’exercice
            </Link>{" "}
            avant de planifier.
          </p>
        ) : (
          <AppointmentForm
            childId={id}
            operationId={randomUUID()}
            facilities={facilities}
            options={options.data as AppointmentOption[]}
            selectedItem={q.item && uuidPattern.test(q.item) ? q.item : ""}
          />
        )}
      </section>
    </main>
  );
}
