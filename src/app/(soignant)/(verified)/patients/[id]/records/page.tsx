import { ChevronDown, ClipboardList } from "lucide-react";
import {
  ChildPageHeading,
  ChildPanel,
  ChildStatus,
} from "@/components/clinician/patient-profile";
import { bookletDate } from "@/lib/vaccines/booklet";
import { readClinicalAttributions } from "@/lib/clinical/read-attribution";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import { ChildCareActions } from "@/components/clinician/care-workspace";
import { EntryCard } from "@/components/clinical/entry-card";
import {
  clinicalKinds,
  clinicalLabels,
  clinicalValueLabels,
  type ClinicalEntry,
  type ClinicalKind,
} from "@/lib/clinical/types";
import { uuidPattern } from "@/lib/registry/types";
export const dynamic = "force-dynamic";
export default async function Records({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string; page?: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const filters = await searchParams;
  const kind = clinicalKinds.includes(filters.kind as ClinicalKind)
    ? filters.kind!
    : "all";
  const page = Math.min(
    10000,
    Math.max(1, Math.floor(Number(filters.page) || 1)),
  );
  const [timeline, capabilities] = await Promise.all([
    supabase.rpc("clinical_timeline", {
      p_child_id: id,
      p_page: page,
      p_kind: kind,
    }),
    supabase.rpc("my_clinical_capabilities"),
  ]);
  if (timeline.error?.code === "42501") notFound();
  if (timeline.error || capabilities.error)
    throw new Error("Impossible de charger le dossier clinique.");
  const result = timeline.data as { items: ClinicalEntry[]; total: number };
  const allowed = capabilities.data as string[];
  function pageHref(n: number) {
    return `/patients/${id}/records?${new URLSearchParams({ kind, page: String(n) })}`;
  }
  const attributions = await readClinicalAttributions(
    supabase,
    result.items.map((entry) => entry.professional_id),
    { children: [id] },
  );
  return (
    <>
      <ChildPageHeading
        title="Dossier clinique"
        description="Consultez les soins et ouvrez leur historique de corrections."
      />
      <details className="child-panel child-expander no-print">
        <summary>
          <ClipboardList size={18} aria-hidden="true" /> Ajouter un soin{" "}
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div className="child-expander-body">
          <ChildCareActions childId={id} allowed={allowed} />
        </div>
      </details>
      <ChildPanel title="Historique des soins">
        <form
          className="child-record-filter"
          action={`/patients/${id}/records`}
        >
          <label>
            Type
            <select name="kind" defaultValue={kind}>
              <option value="all">Tous les soins</option>
              {clinicalKinds.map((k) => (
                <option key={k} value={k}>
                  {clinicalLabels[k]}
                </option>
              ))}
            </select>
          </label>
          <button className="button secondary">Filtrer</button>
        </form>
        <p className="fine">
          {result.total} saisie(s) · page {page} · 30 par page
        </p>
      </ChildPanel>
      {result.items.length ? (
        <div className="child-record-list">
          {result.items.map((entry) => (
            <details className="child-panel child-expander" key={entry.id}>
              <summary>
                <ClipboardList size={17} aria-hidden="true" />
                <span className="child-record-heading">
                  <strong>{clinicalLabels[entry.kind]}</strong>
                  <small>
                    {entry.occurred_on
                      ? bookletDate(entry.occurred_on)
                      : "Date inconnue"}
                    {entry.occurrence_precision === "estimated" && " · Estimée"}{" "}
                    · Révision {entry.revision}
                  </small>
                </span>
                {entry.entry_state === "withdrawn" ? (
                  <ChildStatus>Retirée</ChildStatus>
                ) : (
                  entry.kind === "risk" && (
                    <ChildStatus
                      tone={
                        entry.payload.severity === "high"
                          ? "red"
                          : entry.payload.severity === "moderate"
                            ? "amber"
                            : "neutral"
                      }
                    >
                      {clinicalValueLabels[String(entry.payload.category)] ??
                        "Risque documenté"}
                    </ChildStatus>
                  )
                )}
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <div className="child-expander-body">
                <EntryCard entry={entry} attributions={attributions} />
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="empty-state">
          Aucun soin documenté dans cette vue. Un historique absent reste
          inconnu.
        </p>
      )}
      <nav className="pagination" aria-label="Pagination clinique">
        {page > 1 ? (
          <Link className="text-link" href={pageHref(page - 1)}>
            Page précédente
          </Link>
        ) : (
          <span />
        )}
        {page * 30 < result.total && page < 10000 && (
          <Link className="text-link" href={pageHref(page + 1)}>
            Page suivante
          </Link>
        )}
      </nav>
    </>
  );
}
