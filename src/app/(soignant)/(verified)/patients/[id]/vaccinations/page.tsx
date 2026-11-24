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
  patientName,
  type ChildProfile,
  type Facility,
} from "@/lib/registry/types";
import type { PatientVaccineItem } from "@/lib/vaccines/patient-types";
import {
  ageLabel,
  catalogStatus,
  type CatalogVersion,
  type CatalogSnapshot,
} from "@/lib/vaccines/types";
import { routineReference } from "@/lib/vaccines/calendar";
export const dynamic = "force-dynamic";
function referenceLabel(item: PatientVaccineItem, child: ChildProfile) {
  const reference = routineReference(
    {
      doseCode: item.dose_code,
      vaccineCode: item.vaccine_code,
      age: item.age,
      eligibility: item.eligibility,
      automaticScheduling: item.automatic_scheduling,
    },
    {
      birthDate: child.birth_date,
      birthPrecision: child.birth_date_precision as
        "exact" | "estimated" | "unknown",
      sex: child.sex as "female" | "male" | "unknown",
    },
    { status: item.version_status, reviewVerified: item.review_verified },
  );
  if (reference.startOn)
    return reference.isWindow
      ? `Fenêtre de routine : ${reference.startOn} au ${reference.endOn} inclus`
      : `Référence de routine : ${reference.startOn}`;
  return (
    (
      {
        birth_date_uncertain:
          "Date de naissance incertaine : date non calculée",
        eligibility_unknown: "Éligibilité inconnue : date non calculée",
        ineligible: "Éligibilité non établie : réexamen nécessaire",
        unreviewed_version:
          "Version retirée ou non approuvée : nouvelle date non calculée",
        disabled_reference_only: "Calcul désactivé",
      } as Record<string, string>
    )[reference.state] || "Date non calculée"
  );
}
export default async function Vaccinations({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string;
    version?: string;
    catalogPage?: string;
    historyPage?: string;
  }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { id } = await params;
  const query = await searchParams;
  if (!uuidPattern.test(id)) notFound();
  const page = Math.min(10000, Math.max(1, Number(query.page) || 1)),
    catalogPage = Math.min(10000, Math.max(1, Number(query.catalogPage) || 1));
  const historyPage = Math.min(
    10000,
    Math.max(1, Math.floor(Number(query.historyPage) || 1)),
  );
  const [profile, result, facilities, capabilities, catalog, timeline] =
    await Promise.all([
      supabase.rpc("get_child_profile", { p_child_id: id }),
      supabase.rpc("patient_vaccine_items", { p_child_id: id, p_page: page }),
      supabase.rpc("my_facilities"),
      supabase.rpc("my_clinical_capabilities"),
      supabase.rpc("vaccine_catalog", { p_page: catalogPage }),
      supabase.rpc("clinical_timeline", {
        p_child_id: id,
        p_kind: "vaccination",
        p_page: historyPage,
      }),
    ]);
  if (
    profile.error?.code === "42501" ||
    result.error?.code === "42501" ||
    timeline.error?.code === "42501"
  )
    notFound();
  if (
    profile.error ||
    result.error ||
    facilities.error ||
    capabilities.error ||
    catalog.error ||
    timeline.error
  )
    throw new Error("Impossible de charger les références vaccinales.");
  const child = profile.data as ChildProfile,
    data = result.data as { items: PatientVaccineItem[]; total: number },
    places = facilities.data as Facility[],
    allowed = (capabilities.data as string[]).includes("vaccination");
  const versions = catalog.data as {
    versions: CatalogVersion[];
    total: number;
  };
  let selected: CatalogSnapshot | null = null;
  if (query.version && uuidPattern.test(query.version)) {
    const detail = await supabase.rpc("vaccine_catalog", {
      p_version_id: query.version,
    });
    if (detail.error)
      throw new Error("Impossible de charger la version choisie.");
    selected = (detail.data as { version: CatalogSnapshot }).version;
  }
  const history = timeline.data as { items: ClinicalEntry[]; total: number };
  const historyHref = (n: number) =>
    `?${new URLSearchParams({ historyPage: String(n), page: String(page), catalogPage: String(catalogPage), ...(query.version ? { version: query.version } : {}) })}#vaccination-history`;
  const approved = versions.versions.filter(
    (v) => v.status === "approved" && v.review_verified,
  );
  const attributions = await readClinicalAttributions(
    supabase,
    [
      ...history.items.map((entry) => entry.professional_id),
      ...data.items.flatMap((item) =>
        item.documented_entries.map((entry) => entry.professional_id),
      ),
    ],
    { children: [id] },
  );
  return (
    <ClinicalWorkspace
      active="vaccinations"
      childId={id}
      section="vaccinations"
      child={child}
    >
      <div className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          Vaccinations — {patientName(child)}
        </h1>
        <p className="muted">
          Références prévues et administrations documentées conservent leur
          propre historique.
        </p>
      </div>
      <div className="care-page-actions">
        {allowed ? (
          <Link
            className="button primary"
            href={`/patients/${id}/records/new?kind=vaccination`}
          >
            Enregistrer une vaccination
          </Link>
        ) : (
          <p className="notice">
            Une habilitation de vaccination est nécessaire pour enregistrer une
            administration.{" "}
            <Link className="text-link" href="/account/clinical-permissions">
              Mes habilitations
            </Link>
          </p>
        )}
        <Link
          className="button secondary"
          href={`/patients/${id}/records?kind=vaccination`}
        >
          Historique et corrections
        </Link>
      </div>
      <p className="notice">
        Une référence sans administration rapprochée reste non confirmée. Elle
        ne prouve pas une dose manquée. Les dates affichées sont des références
        de routine ; toute décision de rattrapage reste manuelle.
      </p>
      <section className="panel" id="vaccination-history">
        <h2>Historique des vaccinations enregistrées ({history.total})</h2>
        <p>
          Une transcription conserve sa date, sa source et son niveau de
          certitude. Elle ne crée ni référence de routine ni rendez-vous.
        </p>
        <p className="soignant-attention">
          Une HB1 déclarée ne masque pas les autres références de routine. Pour
          une HB1 non administrée, incertaine ou un rattrapage, le professionnel
          examine l’historique et décide du suivi manuellement.
        </p>
        {(capabilities.data as string[]).includes("appointment") && (
          <Link
            className="button secondary"
            href={`/patients/${id}/appointments/new`}
          >
            Planifier un suivi manuel
          </Link>
        )}
        {!history.items.length && (
          <p>
            Aucune vaccination enregistrée sur cette page. Une absence de
            documentation ne prouve pas une dose manquée.
          </p>
        )}
        {history.items.map((entry) => (
          <EntryCard key={entry.id} entry={entry} attributions={attributions} />
        ))}
        <nav className="pagination" aria-label="Historique vaccinal">
          {historyPage > 1 && (
            <Link href={historyHref(historyPage - 1)}>
              Historique précédent
            </Link>
          )}
          <span>Page {historyPage} · 30 saisies par page</span>
          {historyPage * 30 < history.total && (
            <Link href={historyHref(historyPage + 1)}>Historique suivant</Link>
          )}
        </nav>
      </section>
      <section className="panel">
        <h2>Références de cet enfant ({data.total})</h2>
        {!data.items.length && (
          <p>
            Aucune référence assignée. Les vaccinations transcrites sans
            rapprochement restent visibles dans le dossier clinique.
          </p>
        )}
        {data.items.map((item) => (
          <article className="panel" key={item.id}>
            <h3>
              {item.dose_code} · {item.vaccine_code}
            </h3>
            <p>
              {item.state === "withdrawn"
                ? "Référence retirée"
                : item.documented_entries.length
                  ? "Administration documentée et rapprochée"
                  : "Administration non confirmée"}
            </p>
            <p>{referenceLabel(item, child)}</p>
            <p className="fine">
              {item.version_label} · {catalogStatus[item.version_status]} · âge
              configuré : {ageLabel(item.age)} · source :{" "}
              {ageLabel(item.source_age)}
            </p>
            {item.documented_entries.map((entry) => (
              <p key={entry.id}>
                <Link
                  className="text-link"
                  href={`/patients/${id}/records/${entry.root_id}`}
                >
                  {entry.occurred_on} ·{" "}
                  {clinicianName(attributions, entry.professional_id)} — voir la
                  saisie
                </Link>
              </p>
            ))}
            <Link
              className="text-link"
              href={`/patients/${id}/vaccinations/${item.id}`}
            >
              Décisions et historique de la référence
            </Link>
          </article>
        ))}
        <div className="pagination">
          {page > 1 && <Link href={`?page=${page - 1}`}>Précédent</Link>}
          <span>
            Page {page} · {data.total} références
          </span>
          {page * 20 < data.total && (
            <Link href={`?page=${page + 1}`}>Suivant</Link>
          )}
        </div>
      </section>
      {allowed && (
        <section className="panel">
          <h2>Assigner une référence approuvée</h2>
          <p>
            Choisissez une version, puis une dose après examen de l’enfant. Une
            référence n’est ni un rendez-vous ni une preuve d’administration.
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
            <button className="button secondary">Examiner cette version</button>
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
        </section>
      )}
    </ClinicalWorkspace>
  );
}
