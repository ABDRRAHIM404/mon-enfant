import "../../../growth/growth.css";
import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicalWorkspace } from "@/components/clinician/care-workspace";
import {
  ChildPageHeading,
  ChildPanel,
} from "@/components/clinician/patient-profile";
import { MeasurementChart } from "@/components/clinician/growth/measurement-chart";
import { MeasurementRows } from "@/components/clinician/growth/workspace";
import { readClinicalAttributions } from "@/lib/clinical/read-attribution";
import { growthPoints } from "@/lib/clinical/growth";
import type { ClinicalEntry } from "@/lib/clinical/types";
import { uuidPattern, type ChildProfile } from "@/lib/registry/types";
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
  searchParams: Promise<{ page?: string }>;
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
  const [first, current, profile, capabilities, standard] = await Promise.all([
    history(1),
    page > 1 ? history(page) : null,
    supabase.rpc("get_child_profile", { p_child_id: id }),
    supabase.rpc("my_clinical_capabilities"),
    supabase.rpc("has_standard_child_access", { p_child_id: id }),
  ]);
  if (
    [first, current, profile, standard].some(
      (result) => result?.error?.code === "42501",
    ) ||
    (!profile.error && !profile.data)
  )
    notFound();
  if (
    first.error ||
    current?.error ||
    profile.error ||
    capabilities.error ||
    standard.error
  )
    throw new Error("Impossible de charger les mesures.");
  const child = profile.data as ChildProfile;
  const recent = first.data as History;
  const result = current ? (current.data as History) : recent;
  const allowed = (capabilities.data as string[]).includes("growth");
  const names = await readClinicalAttributions(
    supabase,
    result.items.map((entry) => entry.professional_id),
    { children: [id] },
  );
  return (
    <ClinicalWorkspace
      active="growth"
      childId={id}
      child={child}
      section="growth"
    >
      <ChildPageHeading
        title="Croissance"
        description="Mesures enregistrées et évolution brute."
        actions={
          allowed ? (
            <Link
              className="button primary child-button child-spotlight"
              href={`/patients/${id}/records/new?kind=growth`}
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
      <div className="child-grid child-vitals">
        {metrics.map(({ field, label, unit }) => {
          const point = growthPoints([...recent.items].reverse(), field).at(-1);
          return (
            <ChildPanel title={label} key={field}>
              <strong>
                {point ? `${point.value.toLocaleString("fr-MA")} ${unit}` : "—"}
              </strong>
              <span>
                {point
                  ? bookletDate(point.date)
                  : "Aucune valeur récente datée"}
              </span>
              {point && !point.confirmed && (
                <p className="fine">Source non confirmée</p>
              )}
            </ChildPanel>
          );
        })}
      </div>
      <div className="growth-workspace child-growth-chart">
        <MeasurementChart entries={result.items} />
      </div>
      <ChildPanel title="Historique des mesures" className="child-panel-spaced">
        <p className="fine">
          {result.total} saisie(s) · page {page}. Le graphique affiche les
          mesures actives à date exacte de cette page.
        </p>
        {result.items.length ? (
          <div className="growth-workspace">
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
        {(page > 1 || page * 30 < result.total) && (
          <nav className="pagination" aria-label="Pagination des mesures">
            {page > 1 && (
              <Link href={`?page=${page - 1}`}>Page précédente</Link>
            )}
            {page * 30 < result.total && page < 10000 && (
              <Link href={`?page=${page + 1}`}>Page suivante</Link>
            )}
          </nav>
        )}
      </ChildPanel>
    </ClinicalWorkspace>
  );
}
