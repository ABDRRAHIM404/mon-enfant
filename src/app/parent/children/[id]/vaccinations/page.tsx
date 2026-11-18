import Link from "next/link";
import { notFound } from "next/navigation";
import { UsersRound, ShieldCheck, ChevronDown } from "lucide-react";
import { ParentWorkflow } from "@/components/parents/workflow";
import { EntryCard } from "@/components/clinical/entry-card";
import type { ClinicalEntry } from "@/lib/clinical/types";
import { requireUser } from "@/lib/auth";
import { uuidPattern, patientName, historyLabels } from "@/lib/registry/types";
import { VaccineRoutineReference } from "@/components/sharing/vaccine-reference";
import { ParentSharePanel } from "@/components/sharing/parent-share-panel";
import type { ShareList } from "@/lib/sharing/types";
import { ageLabel, catalogStatus } from "@/lib/vaccines/types";
import type { PatientVaccineItem } from "@/lib/vaccines/patient-types";
import type { ParentChild } from "@/lib/parents/types";
import { todayCasablanca } from "@/lib/appointments/calendar";
export const dynamic = "force-dynamic";
export default async function ParentVaccinations({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; history_page?: string }>;
}) {
  const { supabase } = await requireUser();
  const { id } = await params;
  const q = await searchParams;
  const page = Number(q.page ?? 1);
  const historyPage = Number(q.history_page ?? 1);
  if (
    !uuidPattern.test(id) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 10000 ||
    !Number.isInteger(historyPage) ||
    historyPage < 1 ||
    historyPage > 10000
  )
    notFound();
  const [references, history, shares] = await Promise.all([
    supabase.rpc("parent_vaccine_items", { p_child_id: id, p_page: page }),
    supabase.rpc("parent_vaccination_history", {
      p_child_id: id,
      p_page: historyPage,
    }),
    supabase.rpc("list_clinician_shares", { p_child_id: id }),
  ]);
  const { data, error } = references;
  if (shares.error?.code === "42501") notFound();
  if (shares.error)
    throw new Error("Impossible de charger les partages autorisés.");
  if (history.error?.code === "42501") notFound();
  if (history.error)
    throw new Error("Impossible de charger l’historique vaccinal.");
  const recorded = history.data as { items: ClinicalEntry[]; total: number };
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
    <ParentWorkflow
      active="vaccinations"
      childId={id}
      childSection="vaccinations"
      child={view.child}
    >
      <Link className="workspace-breadcrumb" href={`/parent/children/${id}`}>
        ← Mes enfants / {patientName(view.child)} / Vaccinations
      </Link>
      <section className="workspace-heading workspace-child-heading">
        <UsersRound className="workspace-avatar" size={54} aria-hidden="true" />
        <div>
          <h1 id="main-content" tabIndex={-1}>
            {patientName(view.child)} · Vaccinations
          </h1>
          <p className="muted">
            {historyLabels[view.child.history_status]} · Carnet de vaccination
            numérique
          </p>
        </div>
      </section>
      <div className="workspace-vaccine-grid">
        <div>
          <section className="workspace-surface workspace-vaccine-summary">
            <div className="workspace-section-heading">
              <h2>Suivi vaccinal</h2>
              <span className="workspace-chip">Historique</span>
            </div>
            <p className="muted">
              Consultez les entrées enregistrées et leur provenance.
            </p>
            <p className="workspace-secondary">
              <strong>
                {recorded.total} entrée{recorded.total > 1 ? "s" : ""} vaccinale
                {recorded.total > 1 ? "s" : ""} active
                {recorded.total > 1 ? "s" : ""}
              </strong>{" "}
              · {view.total} référence{view.total > 1 ? "s" : ""} assignée
              {view.total > 1 ? "s" : ""}
            </p>
            <p className="fine">
              Ces nombres ne mesurent pas la couverture vaccinale. Une
              information absente ne prouve pas une dose manquée.
            </p>
          </section>
          <section className="workspace-surface workspace-vaccine-history">
            <h2>Historique des vaccinations</h2>
            {recorded.items.length ? (
              recorded.items.map((entry) => (
                <details className="workspace-vaccine-record" key={entry.id}>
                  <summary>
                    <ShieldCheck size={20} aria-hidden="true" />
                    <div>
                      <h3>
                        {String(entry.payload.vaccine_label || "Vaccination")} ·{" "}
                        {String(
                          entry.payload.dose_label || "Dose non précisée",
                        )}
                      </h3>
                      <p className="muted">
                        {entry.occurred_on || "Date inconnue"} ·{" "}
                        {entry.occurrence_precision === "exact"
                          ? "Date déclarée exacte"
                          : "Date incertaine"}
                      </p>
                    </div>
                    <span className="workspace-chip">Entrée enregistrée</span>
                    <ChevronDown size={17} aria-hidden="true" />
                  </summary>
                  <EntryCard entry={entry} link={false} />
                </details>
              ))
            ) : (
              <p className="workspace-empty">
                Aucune entrée vaccinale active enregistrée. Les informations
                historiques manquantes restent inconnues.
              </p>
            )}
            <nav
              className="pagination"
              aria-label="Pages de l’historique vaccinal"
            >
              {historyPage > 1 && (
                <Link href={`?page=${page}&history_page=${historyPage - 1}`}>
                  Historique précédent
                </Link>
              )}
              <span>Page {historyPage}</span>
              {historyPage * 20 < recorded.total && (
                <Link href={`?page=${page}&history_page=${historyPage + 1}`}>
                  Historique suivant
                </Link>
              )}
            </nav>
          </section>
          <section className="workspace-surface workspace-secondary">
            <h2>Références du carnet ({view.total})</h2>
            {!view.items.length && (
              <p>
                Aucune référence assignée. Les administrations déjà enregistrées
                restent visibles dans le carnet. La source initiale du
                calendrier reste brouillon jusqu’à sa revue qualifiée.
              </p>
            )}
            {view.items.map((item) => (
              <article className="workspace-reference-record" key={item.id}>
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
                <VaccineRoutineReference
                  item={item}
                  child={view.child}
                  today={today}
                />
                <p className="fine">
                  {item.version_label} · {catalogStatus[item.version_status]} ·
                  Âge configuré : {ageLabel(item.age)} · Source conservée :{" "}
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
              {page > 1 && (
                <Link href={`?page=${page - 1}&history_page=${historyPage}`}>
                  Page précédente
                </Link>
              )}
              <span>Page {page}</span>
              {page * 20 < view.total && (
                <Link href={`?page=${page + 1}&history_page=${historyPage}`}>
                  Page suivante
                </Link>
              )}
            </nav>
          </section>
        </div>
        <aside className="workspace-vaccine-aside">
          <section className="workspace-surface workspace-attention">
            <h2>À retenir</h2>
            <p className="muted">
              Votre soignant confirme les rendez-vous et les procédures de
              rattrapage. Les dates affichées sont des références de routine.
            </p>
          </section>
          <ParentSharePanel childId={id} list={shares.data as ShareList} />
        </aside>
      </div>
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
    </ParentWorkflow>
  );
}
