import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicalWorkspace } from "@/components/clinician/care-workspace";
import { RegistrationForm } from "@/components/registry/forms";
import { notFound } from "next/navigation";
import {
  uuidPattern,
  type Facility,
  type ParentChildIntake,
} from "@/lib/registry/types";
export const dynamic = "force-dynamic";
export default async function NewPatient({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; draft?: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { source, draft } = await searchParams;
  const paper = source === "paper";
  if (draft && !uuidPattern.test(draft)) notFound();
  const [facilitiesResult, draftResult] = await Promise.all([
    supabase.rpc("my_facilities"),
    draft
      ? supabase.rpc("get_parent_child_intake", { p_draft_id: draft })
      : null,
  ]);
  const { data, error } = facilitiesResult;
  if (error) throw new Error("Impossible de charger les lieux d’exercice.");
  if (draftResult?.error?.code === "42501") notFound();
  if (draftResult?.error)
    throw new Error("Impossible de charger la fiche du parent.");
  const intake = draftResult?.data as ParentChildIntake | null | undefined;
  if (draft && !intake)
    return (
      <ClinicalWorkspace active="children">
        <section className="panel">
          <h1 id="main-content">Fiche parent indisponible</h1>
          <p>
            Demandez au parent d’afficher un nouveau QR pour reprendre la
            saisie.
          </p>
          <Link className="button primary" href="/share">
            Ouvrir le scanner
          </Link>
        </section>
      </ClinicalWorkspace>
    );
  const facilities = data as Facility[];
  const draftQuery = draft ? `draft=${encodeURIComponent(draft)}` : "";
  return (
    <ClinicalWorkspace active="children">
      <div className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          {draft
            ? "Compléter la fiche du parent"
            : paper
              ? "Transcrire un dossier papier"
              : "Inscrire un enfant"}
        </h1>
        <p className="muted">
          Conservez les inconnues et les limites de la source. Aucun
          rapprochement automatique des dossiers.
        </p>
        {draft && (
          <p className="notice">
            Vérifiez les informations indiquées par le parent et complétez
            l’inscription. Vous pourrez ensuite vérifier sa demande d’accès au
            carnet.
          </p>
        )}
      </div>
      <div className="tabs">
        <Link
          href={draftQuery ? `/patients/new?${draftQuery}` : "/patients/new"}
          aria-current={!paper ? "page" : undefined}
        >
          Nouvelle inscription
        </Link>
        <Link
          href={`/patients/new?source=paper${draftQuery ? `&${draftQuery}` : ""}`}
          aria-current={paper ? "page" : undefined}
        >
          Dossier papier
        </Link>
      </div>
      <section className="panel">
        {facilities.length ? (
          <RegistrationForm
            key={`${paper ? "paper" : "new"}:${draft ?? ""}`}
            operationId={draft ?? randomUUID()}
            facilities={facilities}
            paper={paper}
            intake={intake ?? undefined}
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
