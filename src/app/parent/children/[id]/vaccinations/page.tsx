import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { uuidPattern, patientName, historyLabels } from "@/lib/registry/types";
import { routineReference } from "@/lib/vaccines/calendar";
import { ageLabel, catalogStatus } from "@/lib/vaccines/types";
import type { PatientVaccineItem } from "@/lib/vaccines/patient-types";
import type { ParentChild } from "@/lib/parents/types";
import { todayCasablanca } from "@/lib/appointments/calendar";
export const dynamic = "force-dynamic";
const unavailable: Record<string, string> = {
  unreviewed_version:
    "Version non approuvée ou retirée : nouvelle date non calculée.",
  disabled_reference_only:
    "Calcul automatique désactivé : décision du professionnel nécessaire.",
  birth_date_uncertain: "Naissance incertaine : date non calculée.",
  eligibility_unknown: "Éligibilité inconnue : date non calculée.",
  ineligible:
    "Éligibilité non établie : réexamen par le professionnel nécessaire.",
};
function Reference({
  item,
  child,
  today,
}: {
  item: PatientVaccineItem;
  child: ParentChild;
  today: string;
}) {
  if (item.state === "withdrawn")
    return <p>Référence retirée : aucune nouvelle date calculée.</p>;
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
  if (!reference.startOn)
    return <p>{unavailable[reference.state] ?? "Date non calculée."}</p>;
  return (
    <>
      <p>
        {reference.isWindow
          ? `Fenêtre de routine : ${reference.startOn} au ${reference.endOn} inclus`
          : `Date de référence de routine : ${reference.startOn}`}
      </p>
      {reference.endOn &&
        reference.endOn >= today &&
        !item.documented_entries.length && (
          <p className="notice">
            Référence à venir ou en cours. Le professionnel confirme les soins
            et le rendez-vous à prévoir.
          </p>
        )}
    </>
  );
}
export default async function ParentVaccinations({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase } = await requireUser();
  const { id } = await params;
  const page = Number((await searchParams).page ?? 1);
  if (
    !uuidPattern.test(id) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 10000
  )
    notFound();
  const { data, error } = await supabase.rpc("parent_vaccine_items", {
    p_child_id: id,
    p_page: page,
  });
  if (error?.code === "42501") notFound();
  if (error)
    throw new Error("Impossible de charger les références vaccinales.");
  const view = data as {
    child: ParentChild;
    items: PatientVaccineItem[];
    total: number;
  };
  const today = todayCasablanca();
  return (
    <main className="account-page wide">
      <Link href={`/parent/children/${id}`}>← Carnet de mon enfant</Link>
      <section className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          Vaccinations et références — {patientName(view.child)}
        </h1>
        <p>{historyLabels[view.child.history_status]}</p>
      </section>
      <p className="notice">
        Les références sont choisies par les professionnels. Une date passée ou
        une administration non confirmée ne prouve pas une dose manquée. Les
        dates affichées sont des références de routine ; le professionnel décide
        de toute suite ou de tout rattrapage.
      </p>
      <section className="panel">
        <h2>Références du carnet ({view.total})</h2>
        {!view.items.length && (
          <p>
            Aucune référence assignée. Les administrations déjà enregistrées
            restent visibles dans le carnet. La source initiale du calendrier
            reste brouillon jusqu’à sa revue qualifiée.
          </p>
        )}
        {view.items.map((item) => (
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
            <Reference item={item} child={view.child} today={today} />
            <p className="fine">
              {item.version_label} · {catalogStatus[item.version_status]} · Âge
              configuré : {ageLabel(item.age)} · Source conservée :{" "}
              {ageLabel(item.source_age)}
            </p>
            <p className="fine">
              Référence assignée par {item.professional_id}. Version{" "}
              {item.revision} de la décision.
            </p>
            {item.documented_entries.map((entry) => (
              <p key={entry.id}>
                {entry.occurred_on || "Date inconnue"} · Professionnel{" "}
                {entry.professional_id}
              </p>
            ))}
          </article>
        ))}
        <nav className="pagination" aria-label="Pages des références">
          {page > 1 && <Link href={`?page=${page - 1}`}>Page précédente</Link>}
          <span>Page {page}</span>
          {page * 20 < view.total && (
            <Link href={`?page=${page + 1}`}>Page suivante</Link>
          )}
        </nav>
      </section>
      <div className="actions">
        <Link className="button secondary" href={`/parent/children/${id}`}>
          Voir les soins documentés et leur provenance
        </Link>
        <Link
          className="button secondary"
          href={`/parent/children/${id}/appointments`}
        >
          Consulter les rendez-vous
        </Link>
      </div>
    </main>
  );
}
