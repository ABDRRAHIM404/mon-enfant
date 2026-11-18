import { randomUUID } from "node:crypto";
import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicalWorkspace } from "@/components/clinician/care-workspace";
import { FacilityForm } from "@/components/registry/forms";
import type { Facility } from "@/lib/registry/types";
export const dynamic = "force-dynamic";
export default async function Practices() {
  const { supabase } = await requireApprovedDoctor();
  const { data, error } = await supabase.rpc("my_facilities");
  if (error) throw new Error("Impossible de charger les lieux d’exercice.");
  const facilities = data as Facility[];
  return (
    <ClinicalWorkspace active="tools" tool="practices">
      <div className="page-heading">
        <span className="eyebrow">MON ORGANISATION</span>
        <h1 id="main-content" tabIndex={-1}>
          Lieux d’exercice
        </h1>
        <p className="muted">
          Chaque numéro local appartient à votre registre, à un lieu, à une
          année et à un livre.
        </p>
      </div>
      <div className="two-columns">
        <section className="panel">
          <h2>Mes lieux déclarés</h2>
          {facilities.length ? (
            <ul className="record-list">
              {facilities.map((f) => (
                <li key={f.id}>
                  <strong>{f.name}</strong>
                  <p>{f.city || "Ville non renseignée"}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">
              Déclarez votre premier lieu avant d’inscrire un enfant.
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Déclarer un lieu</h2>
          <FacilityForm operationId={randomUUID()} />
        </section>
      </div>
    </ClinicalWorkspace>
  );
}
