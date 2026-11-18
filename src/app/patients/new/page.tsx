import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicalWorkspace } from "@/components/clinician/care-workspace";
import { RegistrationForm } from "@/components/registry/forms";
import type { Facility } from "@/lib/registry/types";
export const dynamic = "force-dynamic";
export default async function NewPatient({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { source } = await searchParams;
  const paper = source === "paper";
  const { data, error } = await supabase.rpc("my_facilities");
  if (error) throw new Error("Impossible de charger les lieux d’exercice.");
  const facilities = data as Facility[];
  return (
    <ClinicalWorkspace active="children">
      <div className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          {paper ? "Transcrire un dossier papier" : "Inscrire un enfant"}
        </h1>
        <p className="muted">
          Conservez les inconnues et les limites de la source. Aucun
          rapprochement automatique des dossiers.
        </p>
      </div>
      <div className="tabs">
        <Link href="/patients/new" aria-current={!paper ? "page" : undefined}>
          Nouvelle inscription
        </Link>
        <Link
          href="/patients/new?source=paper"
          aria-current={paper ? "page" : undefined}
        >
          Dossier papier
        </Link>
      </div>
      <section className="panel">
        {facilities.length ? (
          <RegistrationForm
            key={paper ? "paper" : "new"}
            operationId={randomUUID()}
            facilities={facilities}
            paper={paper}
          />
        ) : (
          <p>
            Déclarez d’abord un{" "}
            <Link className="text-link" href="/practices">
              lieu d’exercice
            </Link>
            .
          </p>
        )}
      </section>
    </ClinicalWorkspace>
  );
}
