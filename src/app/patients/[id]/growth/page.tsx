import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import { DoctorNav } from "@/components/registry/doctor-nav";
import { GrowthChart } from "@/components/clinical/growth-chart";
import type { ClinicalEntry } from "@/lib/clinical/types";
import { uuidPattern } from "@/lib/registry/types";
export const dynamic = "force-dynamic";
export default async function Growth({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const query = await searchParams;
  const page = Math.min(
    10000,
    Math.max(1, Math.floor(Number(query.page) || 1)),
  );
  const { data, error } = await supabase.rpc("clinical_timeline", {
    p_child_id: id,
    p_kind: "growth",
    p_page: page,
  });
  if (error?.code === "42501") notFound();
  if (error) throw new Error("Impossible de charger les mesures.");
  const result = data as { items: ClinicalEntry[]; total: number };
  return (
    <main className="account-page wide">
      <DoctorNav />
      <div className="page-heading">
        <h1>Croissance</h1>
        <p className="muted">
          Mesures actives datées de cette page (30 saisies au maximum). Les
          corrections remplacent la projection sans effacer l’original.
        </p>
      </div>
      <div className="tabs">
        <Link href={`/patients/${id}/records`}>Dossier clinique</Link>
        <Link href={`/patients/${id}/records/new?kind=growth`}>
          Nouvelle mesure
        </Link>
      </div>
      <GrowthChart
        entries={result.items}
        field="weight_kg"
        label="Poids"
        unit="kg"
      />
      <GrowthChart
        entries={result.items}
        field="height_cm"
        label="Taille"
        unit="cm"
      />
      <GrowthChart
        entries={result.items}
        field="head_cm"
        label="Périmètre crânien"
        unit="cm"
      />
      <section className="panel">
        <h2>Valeurs et provenance</h2>
        <p className="fine">
          {result.total} saisie(s) de mesure · page {page}
        </p>
        {result.items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Poids (kg)</th>
                  <th>Taille (cm)</th>
                  <th>PC (cm)</th>
                  <th>Source / état</th>
                  <th>Historique</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.occurred_on || "Inconnue"}
                      {e.occurrence_precision === "estimated"
                        ? " (estimée)"
                        : ""}
                    </td>
                    <td>{e.payload.weight_kg ?? "—"}</td>
                    <td>{e.payload.height_cm ?? "—"}</td>
                    <td>{e.payload.head_cm ?? "—"}</td>
                    <td>
                      {e.entry_state === "withdrawn"
                        ? "Retirée"
                        : e.source_verified
                          ? "Source contrôlée"
                          : "Source non confirmée"}
                    </td>
                    <td>
                      <Link
                        className="text-link"
                        href={`/patients/${id}/records/${e.root_id}`}
                      >
                        Version {e.revision}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">Aucune mesure documentée.</p>
        )}
        <nav className="pagination" aria-label="Pagination des mesures">
          {page > 1 ? (
            <Link href={`/patients/${id}/growth?page=${page - 1}`}>
              Page précédente
            </Link>
          ) : (
            <span />
          )}
          {page * 30 < result.total && page < 10000 && (
            <Link href={`/patients/${id}/growth?page=${page + 1}`}>
              Page suivante
            </Link>
          )}
        </nav>
      </section>
    </main>
  );
}
