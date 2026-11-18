import {
  choicesWithRecordVersions,
  type VaccineChoice,
} from "@/lib/vaccines/choices";
import Link from "next/link";
import type { VaccineItemExport } from "@/lib/vaccines/patient-types";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicalWorkspace } from "@/components/clinician/care-workspace";
import { ClinicalForm } from "@/components/clinical/entry-form";
import {
  clinicalKinds,
  clinicalLabels,
  type ClinicalKind,
} from "@/lib/clinical/types";
import { uuidPattern, type Facility } from "@/lib/registry/types";
export const dynamic = "force-dynamic";
export default async function NewEntry({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { id } = await params;
  const query = await searchParams;
  if (
    !uuidPattern.test(id) ||
    !clinicalKinds.includes(query.kind as ClinicalKind)
  )
    notFound();
  const kind = query.kind as ClinicalKind;
  const [child, facilities, capabilities] = await Promise.all([
    supabase.rpc("get_child_profile", { p_child_id: id }),
    supabase.rpc("my_facilities"),
    supabase.rpc("my_clinical_capabilities"),
  ]);
  if (child.error?.code === "42501") notFound();
  if (child.error || facilities.error || capabilities.error)
    throw new Error("Impossible de préparer la saisie clinique.");
  const allowed = (capabilities.data as string[]).includes(kind);
  const places = facilities.data as Facility[];
  const vaccineItems =
    kind === "vaccination"
      ? await supabase.rpc("vaccine_items_export", { p_child_id: id })
      : { data: [], error: null };
  if (vaccineItems.error)
    throw new Error(
      "Impossible de charger toutes les références vaccinales. La limite interactive peut être dépassée.",
    );
  const vocabulary =
    kind === "vaccination"
      ? await supabase.rpc("vaccine_form_choices")
      : { data: [], error: null };
  if (vocabulary.error) throw new Error("Choix vaccinaux indisponibles.");
  return (
    <ClinicalWorkspace active="consultations" childId={id} section="records">
      <div className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          {kind === "vaccination"
            ? "Enregistrer une vaccination"
            : kind === "growth"
              ? "Ajouter une mesure de croissance"
              : kind === "consultation"
                ? "Ajouter une consultation"
                : kind === "prescription"
                  ? "Ajouter un traitement"
                  : "Documenter un risque ou une allergie"}
        </h1>
        <p className="muted">
          L’auteur, le lieu, la provenance et les dates seront conservés. Aucune
          écriture ne remplace silencieusement un soin.
        </p>
      </div>
      <Link className="text-link" href={`/patients/${id}/records`}>
        Retour au dossier clinique
      </Link>
      <section className="panel">
        {!allowed ? (
          <p className="notice">
            L’habilitation {clinicalLabels[kind].toLowerCase()} n’est pas active
            pour votre compte.
          </p>
        ) : places.length ? (
          <ClinicalForm
            childId={id}
            operationId={randomUUID()}
            kind={kind}
            facilities={places}
            vaccineItems={vaccineItems.data as VaccineItemExport[]}
            vaccineChoices={choicesWithRecordVersions(
              vocabulary.data as VaccineChoice[],
              vaccineItems.data as VaccineItemExport[],
            )}
          />
        ) : (
          <p>
            Déclarez un{" "}
            <Link className="text-link" href="/practices">
              lieu d’exercice
            </Link>{" "}
            avant de saisir un soin.
          </p>
        )}
      </section>
    </ClinicalWorkspace>
  );
}
