import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import {
  ChildCareActions,
  ClinicalWorkspace,
} from "@/components/clinician/care-workspace";
import { EntryCard } from "@/components/clinical/entry-card";
import {
  clinicalKinds,
  clinicalLabels,
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
  return (
    <ClinicalWorkspace active="consultations" childId={id} section="records">
      <div className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          Dossier clinique
        </h1>
        <p className="muted">
          Dernière révision de chaque saisie, avec accès à l’original et aux
          corrections.
        </p>
      </div>
      <ChildCareActions childId={id} allowed={allowed} />
      <section className="panel">
        <h2>Rechercher dans les soins</h2>
        <form className="registry-filters" action={`/patients/${id}/records`}>
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
      </section>
      {result.items.length ? (
        result.items.map((entry) => <EntryCard key={entry.id} entry={entry} />)
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
    </ClinicalWorkspace>
  );
}
