import { clinicianName } from "@/lib/clinical/attribution";
import { readClinicalAttributions } from "@/lib/clinical/read-attribution";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedDoctor } from "@/lib/auth";
import { uuidPattern, patientName, historyLabels } from "@/lib/registry/types";
import { TemporaryView } from "@/components/sharing/temporary-view";
import { EntryCard } from "@/components/clinical/entry-card";
import { GrowthChart } from "@/components/clinical/growth-chart";
import { VaccineRoutineReference } from "@/components/sharing/vaccine-reference";
import {
  shareLabels,
  type SharedView,
  type VaccinationShareData,
} from "@/lib/sharing/types";
import type { ParentBooklet } from "@/lib/parents/types";
import { ageLabel, catalogStatus } from "@/lib/vaccines/types";
import { todayCasablanca, appointmentTime } from "@/lib/appointments/calendar";
import { appointmentStates } from "@/lib/appointments/types";
export const dynamic = "force-dynamic";
export default async function SharedBooklet({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const { id } = await params;
  const page = Number((await searchParams).page ?? 1);
  if (
    !uuidPattern.test(id) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 10000
  )
    notFound();
  const { data, error } = await supabase.rpc("read_clinician_share", {
    p_share_id: id,
    p_page: page,
  });
  if (error?.code === "42501") notFound();
  if (error) throw new Error("Partage temporaire indisponible.");
  const view = data as SharedView;
  const vaccinations =
    view.scope === "vaccination_read"
      ? (view.data as VaccinationShareData)
      : null;
  const booklet =
    view.scope === "booklet_read"
      ? (view.data as Omit<ParentBooklet, "link">)
      : null;
  const child = vaccinations?.references.child ?? booklet?.child;
  if (!child) notFound();
  const more = vaccinations
    ? page * 20 < vaccinations.references.total ||
      page * 20 < vaccinations.history.total
    : booklet
      ? page * 30 < booklet.entry_total || page * 30 < booklet.appointment_total
      : false;
  const attributions = await readClinicalAttributions(
    supabase,
    [
      ...(vaccinations?.history.items.map((entry) => entry.professional_id) ??
        []),
      ...(vaccinations?.references.items.flatMap((item) => [
        item.professional_id,
        ...item.documented_entries.map((entry) => entry.professional_id),
      ]) ?? []),
      ...(booklet?.entries.map((entry) => entry.professional_id) ?? []),
      ...(booklet?.appointments.map((item) => item.professional_id) ?? []),
    ],
    { share: id, page },
  );
  return (
    <>
      <TemporaryView
        key={view.id}
        expiresAt={view.expires_at}
        serverNow={view.server_now}
      >
        <section className="workspace-heading">
          <span className="eyebrow">PARTAGE TEMPORAIRE · LECTURE SEULE</span>
          <h1 id="main-content" tabIndex={-1}>
            {patientName(child)}
          </h1>
          <p>
            {shareLabels[view.scope]} · {historyLabels[child.history_status]}
          </p>
        </section>
        <p className="notice">
          Le responsable a autorisé cette lecture pour le motif indiqué. Ce
          partage ne vous autorise pas à modifier le carnet ou à y enregistrer
          des soins. Les dates incertaines et les références non revues restent
          explicites.
        </p>
        {vaccinations && (
          <>
            <section className="panel">
              <h2>Historique vaccinal partagé</h2>
              {vaccinations.history.items.length ? (
                vaccinations.history.items.map((entry) => (
                  <EntryCard
                    entry={entry}
                    key={entry.id}
                    link={false}
                    attributions={attributions}
                  />
                ))
              ) : (
                <p>
                  Aucune entrée vaccinale active enregistrée. Une information
                  absente ne prouve pas une dose manquée.
                </p>
              )}
            </section>
            <section className="panel">
              <h2>Références vaccinales partagées</h2>
              {!vaccinations.references.items.length && (
                <p>
                  Aucune référence assignée. Aucune date de rattrapage n’est
                  calculée.
                </p>
              )}
              {vaccinations.references.items.map((item) => (
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
                  <VaccineRoutineReference
                    item={item}
                    child={child}
                    today={todayCasablanca()}
                  />
                  <p className="fine">
                    {item.version_label} · {catalogStatus[item.version_status]}{" "}
                    · Âge configuré : {ageLabel(item.age)} · Source :{" "}
                    {ageLabel(item.source_age)} · Décision de{" "}
                    {clinicianName(attributions, item.professional_id)},
                    révision {item.revision}
                  </p>
                  {item.documented_entries.map((entry) => (
                    <p key={entry.id}>
                      {entry.occurred_on || "Date inconnue"} ·{" "}
                      {clinicianName(attributions, entry.professional_id)}
                    </p>
                  ))}
                </article>
              ))}
            </section>
          </>
        )}
        {booklet && (
          <>
            <section className="panel">
              <h2>Soins partagés</h2>
              {booklet.entries.length ? (
                booklet.entries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    link={false}
                    attributions={attributions}
                  />
                ))
              ) : (
                <p>Aucun soin documenté sur cette page.</p>
              )}
            </section>
            <section className="panel">
              <h2>Croissance partagée</h2>
              <div className="two-columns">
                <GrowthChart
                  entries={booklet.growth}
                  field="weight_kg"
                  label="Poids"
                  unit="kg"
                />
                <GrowthChart
                  entries={booklet.growth}
                  field="height_cm"
                  label="Taille"
                  unit="cm"
                />
                <GrowthChart
                  entries={booklet.growth}
                  field="head_cm"
                  label="Périmètre crânien"
                  unit="cm"
                />
              </div>
            </section>
            <section className="panel">
              <h2>Rendez-vous partagés</h2>
              {booklet.appointments.length ? (
                booklet.appointments.map((item) => (
                  <article className="panel" key={item.id}>
                    <h3>{item.purpose_label}</h3>
                    <p>
                      {appointmentTime(item.starts_at)} ·{" "}
                      {appointmentStates[item.effective_state]}
                    </p>
                    <p>
                      {item.facility_name} ·{" "}
                      {clinicianName(attributions, item.professional_id)}
                    </p>
                  </article>
                ))
              ) : (
                <p>Aucun rendez-vous enregistré sur cette page.</p>
              )}
            </section>
          </>
        )}
        <nav className="pagination" aria-label="Pages du partage">
          {page > 1 && <Link href={`?page=${page - 1}`}>Page précédente</Link>}
          <span>Page {page}</span>
          {more && <Link href={`?page=${page + 1}`}>Page suivante</Link>}
        </nav>
      </TemporaryView>
      <Link className="text-link" href="/share">
        Présenter un autre code
      </Link>
    </>
  );
}
