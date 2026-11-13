import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import { DoctorNav } from "@/components/registry/doctor-nav";
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
    <main className="account-page wide">
      <DoctorNav />
      <div className="page-heading">
        <h1>Dossier clinique</h1>
        <p className="muted">
          Dernière révision de chaque saisie, avec accès à l’original et aux
          corrections.
        </p>
      </div>
      <div className="tabs">
        <Link href={`/patients/${id}`}>Identité et registre</Link>
        <Link href={`/patients/${id}/appointments`}>Rendez-vous</Link>
        <Link href={`/patients/${id}/vaccinations`}>Vaccinations</Link>
        <Link href={`/patients/${id}/growth`}>Croissance</Link>
        <Link href={`/patients/${id}/summary`}>Résumé / impression</Link>
      </div>
      <section className="panel">
        <h2>Nouvelle saisie</h2>
        {allowed.some((c) => clinicalKinds.includes(c as ClinicalKind)) ? (
          <div className="tabs">
            {clinicalKinds
              .filter((k) => allowed.includes(k))
              .map((k) => (
                <Link key={k} href={`/patients/${id}/records/new?kind=${k}`}>
                  {clinicalLabels[k]}
                </Link>
              ))}
          </div>
        ) : (
          <p className="notice">
            Votre compte permet la consultation du dossier. Une habilitation
            clinique explicite est nécessaire pour chaque type de saisie.
          </p>
        )}
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
    </main>
  );
}
