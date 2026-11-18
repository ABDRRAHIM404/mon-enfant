import Link from "next/link";
import { requireVaccineCatalog } from "@/lib/auth";
import { CatalogWorkspace } from "@/components/vaccines/workspace";
import { catalogStatus, type CatalogVersion } from "@/lib/vaccines/types";
export const dynamic = "force-dynamic";
export default async function Vaccines({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase, profile } = await requireVaccineCatalog();
  const query = await searchParams;
  const page = Math.min(
    10000,
    Math.max(1, Math.floor(Number(query.page) || 1)),
  );
  const { data, error } = await supabase.rpc("vaccine_catalog", {
    p_page: page,
  });
  if (error) throw new Error("Impossible de charger le catalogue vaccinal.");
  const { versions, total } = data as {
    versions: CatalogVersion[];
    total: number;
  };
  return (
    <CatalogWorkspace admin={profile?.role === "admin"}>
      <div className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          Catalogue vaccinal
        </h1>
        <p className="muted">
          Versions de référence de routine et historique des revues.
        </p>
      </div>
      <section className="panel">
        <p className="notice">
          La transcription initiale reste un brouillon jusqu’à la revue d’un
          clinicien habilité indépendant. Les données manquantes ne prouvent pas
          une dose manquée. Aucun rattrapage automatique ni programmation HB1.
        </p>
        <div className="record-list">
          {versions.map((v) => (
            <article key={v.id}>
              <h2>
                <Link className="text-link" href={`/vaccines/${v.id}`}>
                  {v.label}
                </Link>
              </h2>
              <p>
                {catalogStatus[v.status]} · révision {v.revision}
              </p>
              <p className="fine">
                Créée le {v.created_at}
                {v.reviewed_at ? ` · revue le ${v.reviewed_at}` : ""}
              </p>
            </article>
          ))}
        </div>
        <p className="fine">{total} version(s) · 20 par page</p>
        <nav className="pagination" aria-label="Versions du catalogue">
          {page > 1 ? (
            <Link href={`/vaccines?page=${page - 1}`}>Page précédente</Link>
          ) : (
            <span />
          )}
          {page * 20 < total && page < 10000 && (
            <Link href={`/vaccines?page=${page + 1}`}>Page suivante</Link>
          )}
        </nav>
      </section>
    </CatalogWorkspace>
  );
}
