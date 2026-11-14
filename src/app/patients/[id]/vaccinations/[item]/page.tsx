import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireApprovedDoctor } from "@/lib/auth";
import { DoctorNav } from "@/components/registry/doctor-nav";
import { VaccineItemForm } from "@/components/vaccines/item-form";
import { uuidPattern, type Facility } from "@/lib/registry/types";
import type { VaccineItemChange } from "@/lib/vaccines/patient-types";
export const dynamic = "force-dynamic";
export default async function ItemHistory({
  params,
}: {
  params: Promise<{ id: string; item: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { id, item } = await params;
  if (!uuidPattern.test(id) || !uuidPattern.test(item)) notFound();
  const [history, facilities, capabilities] = await Promise.all([
    supabase.rpc("vaccine_item_history", { p_child_id: id, p_item_id: item }),
    supabase.rpc("my_facilities"),
    supabase.rpc("my_clinical_capabilities"),
  ]);
  if (history.error?.code === "42501") notFound();
  if (history.error || facilities.error || capabilities.error)
    throw new Error(
      "Impossible de charger l’historique complet de la référence.",
    );
  const changes = history.data as VaccineItemChange[],
    latest = changes.at(-1),
    places = facilities.data as Facility[];
  if (!latest) notFound();
  return (
    <main className="account-page wide">
      <DoctorNav />
      <div className="page-heading">
        <h1 id="main-content" tabIndex={-1}>Historique de la référence vaccinale</h1>
        <p className="fine">
          Référence {item}. Les décisions ne modifient aucune administration.
        </p>
      </div>
      <Link className="text-link" href={`/patients/${id}/vaccinations`}>
        Retour aux vaccinations
      </Link>
      {changes.map((change) => (
        <article className="panel" key={change.id}>
          <h2>
            Version {change.revision} —{" "}
            {change.state === "active" ? "Active" : "Retirée"}
          </h2>
          <p>{change.reason}</p>
          <p className="fine">
            {change.professional_id} · lieu {change.facility_id} ·{" "}
            {change.created_at}
          </p>
        </article>
      ))}
      {(capabilities.data as string[]).includes("vaccination") &&
        places.length > 0 && (
          <section className="panel">
            <VaccineItemForm
              childId={id}
              operationId={randomUUID()}
              facilities={places}
              item={{
                id: item,
                revision: latest.revision,
                state: latest.state,
              }}
            />
          </section>
        )}
    </main>
  );
}
