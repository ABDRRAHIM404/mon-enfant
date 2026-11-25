import "./booklet.css";
import { clinicianName } from "@/lib/clinical/attribution";
import { readClinicalAttributions } from "@/lib/clinical/read-attribution";
import Link from "next/link";
import { EntryCard } from "@/components/clinical/entry-card";
import type { ClinicalEntry } from "@/lib/clinical/types";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicalWorkspace } from "@/components/clinician/care-workspace";
import { VaccineItemForm } from "@/components/vaccines/item-form";
import {
  uuidPattern,
  type ChildProfile,
  type Facility,
} from "@/lib/registry/types";
import type { VaccineItemExport } from "@/lib/vaccines/patient-types";
import {
  ageLabel,
  catalogStatus,
  type CatalogVersion,
  type CatalogSnapshot,
} from "@/lib/vaccines/types";
import { todayCasablanca } from "@/lib/appointments/calendar";
import { vaccinationBooklet, type DoseReview } from "@/lib/vaccines/booklet";
import {
  BookletDate,
  VaccinationBooklet,
} from "@/components/clinician/vaccination-booklet/table";
import { readScheduleCatalog } from "@/components/clinician/vaccinations/read-overview";

export const dynamic = "force-dynamic";

type History = { items: ClinicalEntry[]; total: number };
const pageNumber = (value?: string) =>
  Math.min(10000, Math.max(1, Math.floor(Number(value) || 1)));

export default async function Vaccinations({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    version?: string;
    catalogPage?: string;
    historyPage?: string;
    saved?: string;
    registered?: string;
  }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { id } = await params;
  const query = await searchParams;
  if (!uuidPattern.test(id)) notFound();
  const profile = await supabase.rpc("get_child_profile", { p_child_id: id });
  if (profile.error?.code === "42501" || (!profile.error && !profile.data))
    notFound();
  if (profile.error) throw Error("Le dossier de l’enfant est indisponible.");
  const child = profile.data as ChildProfile;
  const catalogPage = pageNumber(query.catalogPage),
    historyPage = pageNumber(query.historyPage);
  async function readHistory(page: number) {
    const result = await supabase.rpc("clinical_timeline", {
      p_child_id: id,
      p_kind: "vaccination",
      p_page: page,
    });
    if (result.error?.code === "42501") notFound();
    if (result.error) throw Error("Impossible de lire l’historique vaccinal.");
    return result.data as History;
  }
  const [first, itemsResult, capabilities, catalogue] = await Promise.all([
    readHistory(1),
    supabase.rpc("vaccine_items_export", { p_child_id: id }),
    supabase.rpc("my_clinical_capabilities"),
    readScheduleCatalog(supabase),
  ]);
  if (itemsResult.error?.code === "42501") notFound();
  if (
    capabilities.error ||
    (itemsResult.error && itemsResult.error.code !== "54000")
  )
    throw Error("Impossible de charger le calendrier vaccinal.");
  const items = (itemsResult.data ?? []) as VaccineItemExport[];
  const rights = capabilities.data as string[];
  const allowed = rights.includes("vaccination");
  const historyPages = Math.max(1, Math.ceil(first.total / 30));
  const visiblePage = Math.min(historyPage, historyPages);
  const more = await Promise.all(
    (historyPages <= 4
      ? Array.from({ length: historyPages - 1 }, (_, i) => i + 2)
      : visiblePage > 1
        ? [visiblePage]
        : []
    ).map(readHistory),
  );
  const history =
    visiblePage === 1 ? first : (more[visiblePage - 2] ?? more[0]);
  const entries = [first, ...more].flatMap((page) => page.items);
  const complete =
    !itemsResult.error &&
    [first, ...more].every((page) => page.total === first.total) &&
    entries.length === first.total &&
    new Set(entries.map((entry) => entry.root_id)).size === first.total;
  const reviewResult = catalogue.approved
    ? await supabase.rpc("vaccination_booklet_reviews", {
        p_child_id: id,
        p_version_id: catalogue.approved.id,
      })
    : { data: [], error: null };
  if (reviewResult.error?.code === "42501") notFound();
  if (reviewResult.error)
    throw Error("Impossible de lire les vérifications du calendrier.");
  const today = todayCasablanca();
  const booklet = vaccinationBooklet(
    child,
    catalogue.approved,
    entries,
    complete,
    items,
    reviewResult.data as DoseReview[],
    today,
  );
  const attributions = await readClinicalAttributions(
    supabase,
    entries.map((entry) => entry.professional_id),
    { children: [id] },
  );
  const [facilities, catalog, detail] = await Promise.all([
    allowed ? supabase.rpc("my_facilities") : { data: [], error: null },
    allowed
      ? supabase.rpc("vaccine_catalog", { p_page: catalogPage })
      : { data: { versions: [], total: 0 }, error: null },
    allowed && query.version && uuidPattern.test(query.version)
      ? supabase.rpc("vaccine_catalog", { p_version_id: query.version })
      : { data: null, error: null },
  ]);
  if (facilities.error || catalog.error || detail.error)
    throw Error("Les options d’attribution sont indisponibles.");
  const places = facilities.data as Facility[];
  const versions = catalog.data as {
    versions: CatalogVersion[];
    total: number;
  };
  const approved = versions.versions.filter(
    (version) => version.status === "approved" && version.review_verified,
  );
  const selected =
    (detail.data as { version: CatalogSnapshot } | null)?.version ?? null;
  const historyHref = (n: number) =>
    `?${new URLSearchParams({ historyPage: String(n), catalogPage: String(catalogPage), ...(query.version ? { version: query.version } : {}) })}#vaccination-history`;
  return (
    <section className="vaccination-booklet">
      <ClinicalWorkspace
        active="children"
        childId={id}
        section="vaccinations"
        child={child}
      >
        {query.registered === "1" && (
          <p className="booklet-save-notice" role="status">
            Dossier créé.{" "}
            <Link className="text-link" href={`/patients/${id}`}>
              Ouvrir la vue d’ensemble
            </Link>{" "}
            pour documenter un soin ou compléter les informations plus tard.
          </p>
        )}
        {query.saved === "1" && (
          <p className="booklet-save-notice" role="status">
            Vaccination enregistrée.
          </p>
        )}
        <VaccinationBooklet
          child={child}
          booklet={booklet}
          names={attributions}
          allowed={allowed}
          complete={complete}
        />
        <details
          className="booklet-panel booklet-secondary"
          id="vaccination-history"
          open={visiblePage > 1 || !booklet.approved}
        >
          <summary>Historique et corrections ({history.total})</summary>
          <p>
            Les transcriptions et corrections conservent leur date, leur source
            et leur niveau de certitude.
          </p>
          <nav aria-label="Actions de l’historique" className="booklet-actions">
            <Link
              className="booklet-button"
              href={`/patients/${id}/records?kind=vaccination`}
            >
              Ouvrir le dossier clinique
            </Link>
            {rights.includes("appointment") && (
              <Link
                className="booklet-button"
                href={`/patients/${id}/appointments/new`}
              >
                Planifier un suivi manuel
              </Link>
            )}
          </nav>
          {!history.items.length && <p>Aucune vaccination enregistrée.</p>}
          {history.items.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              attributions={attributions}
            />
          ))}
          {historyPages > 1 && (
            <nav className="pagination" aria-label="Historique vaccinal">
              {visiblePage > 1 && (
                <Link href={historyHref(visiblePage - 1)}>
                  Historique précédent
                </Link>
              )}
              <span>
                Page {visiblePage} sur {historyPages}
              </span>
              {visiblePage < historyPages && (
                <Link href={historyHref(visiblePage + 1)}>
                  Historique suivant
                </Link>
              )}
            </nav>
          )}
        </details>
        {booklet.unlisted.length > 0 && (
          <details className="booklet-panel booklet-secondary">
            <summary>
              Autres vaccinations documentées ({booklet.unlisted.length})
            </summary>
            <p>
              Saisies conservées qui ne figurent pas dans la grille actuelle du
              PNI.
            </p>
            <ul>
              {booklet.unlisted.map((entry) => (
                <li key={entry.root_id}>
                  <Link href={`/patients/${id}/records/${entry.root_id}`}>
                    {entry.payload.vaccine_label} · {entry.payload.dose_label}
                    {entry.occurred_on && (
                      <>
                        {" "}
                        · <BookletDate date={entry.occurred_on} />
                      </>
                    )}
                  </Link>{" "}
                  · {clinicianName(attributions, entry.professional_id)}
                </li>
              ))}
            </ul>
          </details>
        )}
        {items.length > 0 && (
          <details className="booklet-panel booklet-secondary">
            <summary>
              Références assignées et versions antérieures ({items.length})
            </summary>
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <Link href={`/patients/${id}/vaccinations/${item.id}`}>
                    {item.dose_code} · {item.version_label}
                  </Link>{" "}
                  · {catalogStatus[item.version_status]} ·{" "}
                  {ageLabel(item.rule.age)}
                  {item.changes.at(-1)?.state === "withdrawn" &&
                    " · Référence retirée"}
                </li>
              ))}
            </ul>
          </details>
        )}
        {allowed && (
          <details
            className="booklet-panel booklet-secondary"
            open={!!selected}
          >
            <summary>Assigner une référence approuvée</summary>
            <p>
              Choisissez une version, puis une dose après examen de l’enfant.
              Une référence n’est ni un rendez-vous ni une preuve
              d’administration.
            </p>
            <form method="get" className="auth-form">
              <label>
                Version approuvée
                <select
                  name="version"
                  required
                  defaultValue={query.version || ""}
                >
                  <option value="" disabled>
                    Choisir une version
                  </option>
                  {approved.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button secondary">
                Examiner cette version
              </button>
            </form>
            {!approved.length && (
              <p className="notice">
                Aucune version approuvée sur cette page du catalogue. La source
                initiale reste brouillon jusqu’à sa revue qualifiée. La
                transcription d’une administration sans rapprochement reste
                possible.
              </p>
            )}
            <div className="pagination">
              {catalogPage > 1 && (
                <Link href={`?catalogPage=${catalogPage - 1}`}>
                  Versions précédentes
                </Link>
              )}
              {catalogPage * 20 < versions.total && (
                <Link href={`?catalogPage=${catalogPage + 1}`}>
                  Versions suivantes
                </Link>
              )}
            </div>
            {selected?.status === "approved" &&
              selected.review_verified &&
              places.length > 0 && (
                <VaccineItemForm
                  key={selected.id}
                  childId={id}
                  operationId={randomUUID()}
                  facilities={places}
                  versionId={selected.id}
                  rules={selected.rules}
                />
              )}
            {selected && selected.status !== "approved" && (
              <p>
                Cette version n’est plus activable. Choisissez une version
                approuvée.
              </p>
            )}
            {!places.length && (
              <p>
                Déclarez un{" "}
                <Link className="text-link" href="/practices">
                  lieu d’exercice
                </Link>{" "}
                pour assigner une référence.
              </p>
            )}
          </details>
        )}
      </ClinicalWorkspace>
    </section>
  );
}
