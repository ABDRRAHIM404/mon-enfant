import "../../../growth/growth.css";
import { randomUUID } from "node:crypto";
import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import {
  ChildPageHeading,
  ChildPanel,
} from "@/components/clinician/patient-profile";
import { MeasurementChart } from "@/components/clinician/growth/measurement-chart";
import { MeasurementForm } from "@/components/clinician/growth/measurement-form";
import { readAuthorizedChild } from "@/lib/registry/read-child";
import { MeasurementRows } from "@/components/clinician/growth/workspace";
import { readClinicalAttributions } from "@/lib/clinical/read-attribution";
import { growthPoints } from "@/lib/clinical/growth";
import type { ClinicalEntry } from "@/lib/clinical/types";
import { uuidPattern, type Facility } from "@/lib/registry/types";
import { bookletDate } from "@/lib/vaccines/booklet";

export const dynamic = "force-dynamic";
type History = { items: ClinicalEntry[]; total: number };
const metrics = [
  { field: "weight_kg", label: "Poids", unit: "kg" },
  { field: "height_cm", label: "Taille", unit: "cm" },
  { field: "head_cm", label: "Périmètre crânien", unit: "cm" },
];

export default async function Growth({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; measure?: string; saved?: string }>;
}) {
  const { supabase, user } = await requireApprovedDoctor();
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const query = await searchParams;
  const page = Math.min(
    10000,
    Math.max(1, Math.floor(Number(query.page) || 1)),
  );
  const history = (page: number) =>
    supabase.rpc("clinical_timeline", {
      p_child_id: id,
      p_kind: "growth",
      p_page: page,
    });
  const [first, current, child, capabilities, standard, places] =
    await Promise.all([
      history(1),
      page > 1 ? history(page) : null,
      readAuthorizedChild(id),
      supabase.rpc("my_clinical_capabilities"),
      supabase.rpc("has_standard_child_access", { p_child_id: id }),
      query.measure === "1" ? supabase.rpc("my_facilities") : null,
    ]);
  if (
    [first, current, standard].some((result) => result?.error?.code === "42501")
  )
    notFound();
  if (
    first.error ||
    current?.error ||
    capabilities.error ||
    standard.error ||
    places?.error
  )
    throw Error("Impossible de charger les mesures.");
  const recent = first.data as History;
  const result = current ? (current.data as History) : recent;
  const allowed = (capabilities.data as string[]).includes("growth");
  const facilities = (places?.data ?? []) as Facility[];
  const names = await readClinicalAttributions(
    supabase,
    result.items.map((entry) => entry.professional_id),
    { children: [id] },
  );
  return (
    <div className="growth-workspace child-growth-workspace">
      <ChildPageHeading
        title="Croissance"
        description="Mesures enregistrées et évolution brute."
        actions={
          allowed ? (
            <Link
              className="button primary child-button child-spotlight"
              href="?measure=1#ajouter-mesure"
            >
              <Plus size={18} aria-hidden="true" />
              Ajouter une mesure
            </Link>
          ) : (
            <Link
              className="button secondary child-button"
              href="/account/clinical-permissions"
            >
              Mes habilitations
            </Link>
          )
        }
      />
      {query.saved === "1" && (
        <p className="growth-success" role="status">
          Mesure enregistrée.
        </p>
      )}
      {query.measure === "1" && allowed && (
        <ChildPanel
          title="Ajouter une mesure"
          id="ajouter-mesure"
          className="growth-entry"
        >
          {facilities.length ? (
            <>
              <MeasurementForm
                key={id}
                childId={id}
                facilities={facilities}
                operationId={randomUUID()}
              />
              <Link
                className="text-link"
                href={`/patients/${id}/records/new?kind=growth`}
              >
                Formulaire complet
              </Link>
            </>
          ) : (
            <p>
              Déclarez un{" "}
              <Link className="text-link" href="/practices">
                lieu d’exercice
              </Link>{" "}
              pour enregistrer une mesure.
            </p>
          )}
        </ChildPanel>
      )}
      <div className="child-growth-grid">
        <ChildPanel title="Dernières mesures" className="child-growth-latest">
          <dl className="child-growth-vitals">
            {metrics.map(({ field, label, unit }) => {
              const point = growthPoints([...recent.items].reverse(), field).at(
                -1,
              );
              return (
                <div key={field}>
                  <dt>{label}</dt>
                  <dd>
                    <strong>
                      {point
                        ? `${point.value.toLocaleString("fr-MA")} ${unit}`
                        : "—"}
                    </strong>
                    <span>
                      {point
                        ? bookletDate(point.date)
                        : "Aucune valeur récente datée"}
                    </span>
                    {point && !point.confirmed && (
                      <small>Source non confirmée</small>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </ChildPanel>
        <ChildPanel
          title="Historique des mesures"
          id="history"
          className="child-growth-history"
        >
          {result.items.length ? (
            <div className="child-growth-history-scroll">
              <MeasurementRows
                child={child}
                entries={result.items}
                attributions={names}
                canCorrect={(entry) =>
                  allowed &&
                  (standard.data === true || entry.author_id === user.id)
                }
              />
            </div>
          ) : (
            <p className="empty-state">
              Aucune mesure documentée sur cette page.
            </p>
          )}
          <Link
            className="growth-action"
            href={`/patients/${id}/records?kind=growth`}
          >
            Historique et corrections
          </Link>
          {(page > 1 || page * 30 < result.total) && (
            <nav className="pagination" aria-label="Pagination des mesures">
              {page > 1 && (
                <Link href={`?page=${page - 1}#history`}>Page précédente</Link>
              )}
              <span>Page {page}</span>
              {page * 30 < result.total && page < 10000 && (
                <Link href={`?page=${page + 1}#history`}>Page suivante</Link>
              )}
            </nav>
          )}
        </ChildPanel>
        <div className="child-growth-chart">
          <MeasurementChart key={`${id}/${page}`} entries={result.items} />
        </div>
      </div>
    </div>
  );
}
