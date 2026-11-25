import { readAuthorizedChild } from "@/lib/registry/read-child";
import { ageAtVaccination } from "@/components/clinician/vaccinations/projection";
import { readClinicalAttributions } from "@/lib/clinical/read-attribution";
import {
  choicesWithRecordVersions,
  type VaccineChoice,
} from "@/lib/vaccines/choices";
import Link from "next/link";
import type { VaccineItemExport } from "@/lib/vaccines/patient-types";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import { EntryCard } from "@/components/clinical/entry-card";
import { ClinicalForm } from "@/components/clinical/entry-form";
import type { ClinicalEntry } from "@/lib/clinical/types";
import { uuidPattern, type Facility } from "@/lib/registry/types";
export const dynamic = "force-dynamic";
export default async function ClinicalHistory({
  params,
}: {
  params: Promise<{ id: string; root: string }>;
}) {
  const { supabase, user } = await requireApprovedDoctor();
  const { id, root } = await params;
  if (!uuidPattern.test(id) || !uuidPattern.test(root)) notFound();
  const [history, facilities, capabilities, standardAccess] = await Promise.all(
    [
      supabase.rpc("clinical_entry_history", {
        p_child_id: id,
        p_root_id: root,
      }),
      supabase.rpc("my_facilities"),
      supabase.rpc("my_clinical_capabilities"),
      supabase.rpc("has_standard_child_access", { p_child_id: id }),
    ],
  );
  if (history.error?.code === "42501") notFound();
  if (
    history.error ||
    facilities.error ||
    capabilities.error ||
    standardAccess.error
  )
    throw new Error("Impossible de charger l’historique clinique.");
  const entries = history.data as ClinicalEntry[];
  if (!entries.length) notFound();
  const latest = entries[entries.length - 1];
  const vaccinationChild =
    latest.kind === "vaccination" ? await readAuthorizedChild(id) : null;
  const canCorrect =
    standardAccess.data === true || latest.author_id === user.id;
  const allowed = (capabilities.data as string[]).includes(latest.kind);
  const places = facilities.data as Facility[];
  const vaccineItems =
    latest.kind === "vaccination"
      ? await supabase.rpc("vaccine_items_export", { p_child_id: id })
      : { data: [], error: null };
  if (vaccineItems.error)
    throw new Error(
      "Impossible de charger toutes les références vaccinales. La limite interactive peut être dépassée.",
    );
  const vocabulary =
    latest.kind === "vaccination"
      ? await supabase.rpc("vaccine_form_choices")
      : { data: [], error: null };
  if (vocabulary.error) throw new Error("Choix vaccinaux indisponibles.");
  const attributions = await readClinicalAttributions(
    supabase,
    entries.map((entry) => entry.professional_id),
    { children: [id] },
  );
  return (
    <>
      <div className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          Historique de la saisie
        </h1>
        <p className="muted">
          L’original et chaque correction restent attribués à leur auteur.
          Dernière version : {latest.revision}.
        </p>
      </div>
      <Link className="text-link" href={`/patients/${id}/records`}>
        Retour au dossier clinique
      </Link>
      <h2>Versions conservées</h2>
      {entries.map((entry) => {
        const age = vaccinationChild
          ? ageAtVaccination(vaccinationChild, entry)
          : null;
        return (
          <EntryCard
            key={entry.id}
            entry={entry}
            link={false}
            attributions={attributions}
            administrationAgeDays={age ?? undefined}
          />
        );
      })}
      <section
        className="panel"
        id={latest.kind === "growth" ? "growth-correction" : undefined}
      >
        <h2>Corriger / retirer la dernière version</h2>
        {canCorrect && allowed && places.length ? (
          <ClinicalForm
            childId={id}
            operationId={randomUUID()}
            kind={latest.kind}
            facilities={places}
            vaccineItems={vaccineItems.data as VaccineItemExport[]}
            vaccineChoices={choicesWithRecordVersions(
              vocabulary.data as VaccineChoice[],
              vaccineItems.data as VaccineItemExport[],
            )}
            previous={latest}
          />
        ) : (
          <p className="notice">
            {canCorrect
              ? "Une habilitation active pour ce type de soin et un lieu d’exercice déclaré sont nécessaires pour ajouter une révision."
              : "Avec le QR de visite, vous pouvez ajouter des soins et corriger vos propres saisies."}
          </p>
        )}
      </section>
    </>
  );
}
