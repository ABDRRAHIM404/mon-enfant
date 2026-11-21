import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requireVaccineCatalog } from "@/lib/auth";
import { uuidPattern } from "@/lib/registry/types";
import {
  catalogStatus,
  type CatalogSnapshot,
  type CatalogChange,
} from "@/lib/vaccines/types";
import { CatalogWorkspace } from "@/components/vaccines/workspace";
import { CatalogRules } from "@/components/vaccines/rules";
import { CatalogForm } from "@/components/vaccines/catalog-form";
export const dynamic = "force-dynamic";
export default async function VaccineVersion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dose?: string; page?: string }>;
}) {
  const { supabase, profile, permissions } = await requireVaccineCatalog();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!uuidPattern.test(id)) notFound();
  const page = Math.min(
    10000,
    Math.max(1, Math.floor(Number(query.page) || 1)),
  );
  const { data, error } = await supabase.rpc("vaccine_catalog", {
    p_version_id: id,
    p_page: page,
  });
  if (error?.code === "22023") notFound();
  if (error) throw new Error("Impossible de charger cette version.");
  const {
    version: v,
    history,
    history_total,
  } = data as {
    version: CatalogSnapshot;
    history: CatalogChange[];
    history_total: number;
  };
  const selected = v.rules.find((r) => r.dose_code === query.dose);
  const formProps = { versionId: id, revision: v.revision };
  return (
    <CatalogWorkspace profile={profile}>
      <div className="page-heading">
        <Link href="/vaccines" className="text-link">
          Toutes les versions
        </Link>
        <h1 id="main-content" tabIndex={-1}>
          {v.label}
        </h1>
        <p>
          {catalogStatus[v.status]} · révision {v.revision}
        </p>
      </div>
      <section className="panel">
        <h2>Provenance et limites</h2>
        <p>
          {v.rules.length} règles du calendrier PNI 2025. La présentation
          originale doit être authentifiée lors de la revue. Les fenêtres des
          quatre premières semaines couvrent la naissance jusqu’à J+27 inclus ;
          leur interprétation nécessite une validation clinique.
        </p>
        <p>
          {v.rules.some((rule) => rule.dose_code === "HBn")
            ? "HBn est une dose de naissance distincte. HB1 avec le BCG reste une option manuelle si le registre confirme l’omission de HBn."
            : "Dans cette version, HB1 reste une référence manuelle et la dose de naissance HBn n’est pas représentée séparément."}
        </p>
        {v.reviewed_by && (
          <p>
            Revue : {v.reviewed_by} · {v.reviewed_at} · source contrôlée :{" "}
            {v.review_reference}
          </p>
        )}
        <p className="fine source-json">
          Empreinte SHA-256 : {v.source_sha256}
        </p>
        <details>
          <summary>Document source conservé et décisions</summary>
          <pre className="source-json">
            {JSON.stringify(v.source_document, null, 2)}
          </pre>
        </details>
      </section>
      <section className="panel">
        <h2>Règles de cette version</h2>
        <CatalogRules
          rules={v.rules}
          editVersion={
            permissions.manage && v.status === "draft" ? id : undefined
          }
        />
      </section>
      {selected && permissions.manage && v.status === "draft" && (
        <section className="panel">
          <h2>Modifier {selected.dose_code}</h2>
          <p>
            L’âge et la ligne d’origine restent conservés. Toute modification du
            brouillon exige un motif et une référence.
          </p>
          <CatalogForm
            key={`${id}-${v.revision}-${selected.dose_code}`}
            {...formProps}
            operationId={randomUUID()}
            mode="edit"
            rule={selected}
          />
        </section>
      )}
      {permissions.manage && (
        <section className="panel">
          <h2>Nouvelle version à partir de celle-ci</h2>
          <p>
            La copie devient un nouveau brouillon, même si la version d’origine
            était approuvée ou retirée.
          </p>
          <CatalogForm {...formProps} operationId={randomUUID()} mode="clone" />
        </section>
      )}
      {permissions.review && v.status === "draft" && (
        <section className="panel">
          <h2>Revue clinique</h2>
          <p>
            Les attestations, la référence et le compte qui approuve cette
            version sont conservés dans l’historique.
          </p>
          <CatalogForm
            {...formProps}
            operationId={randomUUID()}
            mode="approve"
          />
        </section>
      )}
      {permissions.manage && v.status !== "retired" && (
        <section className="panel">
          <h2>Retirer la version</h2>
          <p>
            Le retrait empêche de nouveaux calculs de routine. Les règles,
            revues et anciennes associations restent dans l’historique.
          </p>
          <CatalogForm
            {...formProps}
            operationId={randomUUID()}
            mode="retire"
          />
        </section>
      )}
      <section className="panel">
        <h2>Historique des décisions</h2>
        {history_total === 0 ? (
          <p>Aucune décision : transcription initiale non approuvée.</p>
        ) : (
          <div className="record-list">
            {history.map((h) => (
              <article key={h.id}>
                <h3>
                  {
                    {
                      clone: "Brouillon créé",
                      edit: "Règle modifiée",
                      approve: "Version approuvée",
                      retire: "Version retirée",
                    }[h.action]
                  }{" "}
                  · révision {h.revision}
                </h3>
                <p>{h.reason}</p>
                <p>Source contrôlée : {h.evidence_reference}</p>
                <p className="fine">
                  Acteur {h.actor_id} · {h.created_at}
                </p>
                <details>
                  <summary>Règles conservées à cette révision</summary>
                  <CatalogRules rules={h.snapshot.rules} />
                </details>
              </article>
            ))}
          </div>
        )}
        <p className="fine">{history_total} décision(s) · 20 par page</p>
        <nav className="pagination" aria-label="Historique du catalogue">
          {page > 1 ? (
            <Link href={`/vaccines/${id}?page=${page - 1}`}>
              Page précédente
            </Link>
          ) : (
            <span />
          )}
          {page * 20 < history_total && page < 10000 && (
            <Link href={`/vaccines/${id}?page=${page + 1}`}>Page suivante</Link>
          )}
        </nav>
      </section>
    </CatalogWorkspace>
  );
}
