import Link from "next/link";
import Image from "next/image";
import { DashboardHeading } from "@/components/dashboard/heading";
import { notFound } from "next/navigation";
import { Plus, ShieldCheck, UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { patientName, birthLabel } from "@/lib/registry/types";
import type { ParentWorkspaceData, ParentBooklet } from "@/lib/parents/types";
import type { ClinicalEntry } from "@/lib/clinical/types";
import type { PatientVaccineItem } from "@/lib/vaccines/patient-types";
import type { ShareList } from "@/lib/sharing/types";
import { EntryCard } from "@/components/clinical/entry-card";
import { GrowthChart } from "@/components/clinical/growth-chart";
import { ParentSharePanel } from "@/components/sharing/parent-share-panel";
import { VaccineRoutineReference } from "@/components/sharing/vaccine-reference";
import { appointmentTime, todayCasablanca } from "@/lib/appointments/calendar";
import { appointmentStates } from "@/lib/appointments/types";
import { ageLabel, catalogStatus } from "@/lib/vaccines/types";

const titles: Record<string, [string, string]> = {
  children: [
    "Mes enfants",
    "Retrouvez les carnets qui vous sont reliés après vérification.",
  ],
  vaccinations: [
    "Vaccinations",
    "Consultez les doses documentées et les références de routine de votre enfant.",
  ],
  growth: [
    "Croissance",
    "Suivez les mesures enregistrées par les professionnels de santé.",
  ],
  appointments: [
    "Rendez-vous",
    "Retrouvez les rendez-vous et leur état enregistré par votre soignant.",
  ],
  documents: ["Documents", "Les documents de votre espace parent."],
  access: [
    "Partage & accès",
    "Gardez le contrôle des partages temporaires de votre carnet.",
  ],
};

export async function ParentSection({
  section,
  childrenList,
  query,
}: {
  section: string;
  childrenList: ParentWorkspaceData["children"];
  query: { child?: string; page?: string };
}) {
  const title = titles[section];
  if (!title) notFound();
  const heading = (
    <DashboardHeading
      title={title[0]}
      description={title[1]}
      section={section}
    />
  );
  if (section === "documents")
    return (
      <>
        {heading}
        <section className="workspace-surface parent-coming-soon">
          <Image
            className="dashboard-document-art"
            src="/dashboard-art/documents-soon.png"
            width={360}
            height={260}
            alt=""
            sizes="(max-width: 700px) 220px, 320px"
          />
          <span className="workspace-chip">Bientôt disponible</span>
          <h2>Vos documents, au même endroit</h2>
          <p>
            La gestion des documents n’est pas encore disponible. Les carnets et
            les exports déjà autorisés restent accessibles depuis « Mes enfants
            ».
          </p>
          <Link className="button secondary" href="/parent?view=children">
            Voir mes enfants
          </Link>
        </section>
      </>
    );
  if (section === "children")
    return (
      <>
        {heading}
        <div className="workspace-child-grid parent-children-list">
          {childrenList.map((child) => (
            <article className="workspace-child-card" key={child.id}>
              <UsersRound
                className="workspace-avatar"
                size={48}
                aria-hidden="true"
              />
              <div>
                <h2>
                  <Link href={`/parent/children/${child.id}`}>
                    {patientName(child)}
                  </Link>
                </h2>
                <p className="muted">{birthLabel(child)}</p>
                <span className="workspace-chip">Accès vérifié</span>
                <div className="actions parent-child-actions">
                  <Link href={`?view=vaccinations&child=${child.id}`}>
                    Vaccinations
                  </Link>
                  <Link href={`?view=growth&child=${child.id}`}>
                    Croissance
                  </Link>
                  <Link href={`?view=appointments&child=${child.id}`}>
                    Rendez-vous
                  </Link>
                  <Link href={`?view=access&child=${child.id}`}>
                    Partage & accès
                  </Link>
                </div>
              </div>
            </article>
          ))}
          <Link
            className="workspace-surface parent-invite-card"
            href="/parent/invitation"
          >
            <Plus size={32} aria-hidden="true" />
            <strong>Relier un enfant</strong>
            <span>Utiliser une invitation sécurisée</span>
          </Link>
        </div>
        {!childrenList.length && (
          <p className="workspace-empty">
            Aucun carnet relié pour le moment. Votre invitation doit être
            vérifiée avant l’ouverture du carnet.
          </p>
        )}
      </>
    );
  // Select exclusively from the current guardian's authorized list. Never fall
  // back to a different child when an explicitly requested link is unavailable.
  const child = query.child
    ? childrenList.find((item) => item.id === query.child)
    : childrenList[0];
  if (query.child && !child) notFound();
  if (!child)
    return (
      <>
        {heading}
        <section className="workspace-surface parent-empty-state">
          <UsersRound size={48} aria-hidden="true" />
          <h2>Aucun enfant relié</h2>
          <p>
            Reliez le carnet de votre enfant avec l’invitation remise par son
            professionnel de santé.
          </p>
          <Link className="button" href="/parent/invitation">
            Utiliser une invitation
          </Link>
        </section>
      </>
    );
  const page = Number(query.page ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) notFound();
  const { supabase } = await requireUser();
  const picker = (
    <form className="parent-child-picker" action="/parent">
      <input type="hidden" name="view" value={section} />
      <label htmlFor="parent-child">Mon enfant</label>
      <select id="parent-child" name="child" defaultValue={child.id}>
        {childrenList.map((item) => (
          <option key={item.id} value={item.id}>
            {patientName(item)}
          </option>
        ))}
      </select>
      <button className="button secondary" type="submit">
        Afficher
      </button>
    </form>
  );
  const pagination = (total: number, size: number) => (
    <nav className="pagination" aria-label={`Pages — ${title[0]}`}>
      {page > 1 && (
        <Link href={`?view=${section}&child=${child.id}&page=${page - 1}`}>
          Page précédente
        </Link>
      )}
      <span>Page {page}</span>
      {page * size < total && (
        <Link href={`?view=${section}&child=${child.id}&page=${page + 1}`}>
          Page suivante
        </Link>
      )}
    </nav>
  );
  let content;
  if (section === "vaccinations") {
    const [history, references] = await Promise.all([
      supabase.rpc("parent_vaccination_history", {
        p_child_id: child.id,
        p_page: page,
      }),
      supabase.rpc("parent_vaccine_items", {
        p_child_id: child.id,
        p_page: page,
      }),
    ]);
    for (const result of [history, references]) {
      if (result.error?.code === "42501") notFound();
      if (result.error)
        throw new Error("Impossible de charger les vaccinations.");
    }
    const recorded = history.data as { items: ClinicalEntry[]; total: number };
    const planned = references.data as {
      items: PatientVaccineItem[];
      total: number;
    };
    content = (
      <>
        <div className="workspace-overview-grid">
          <section className="workspace-surface">
            <h2>Historique vaccinal</h2>
            <strong className="parent-metric">{recorded.total}</strong>
            <p>Entrées actives enregistrées par les professionnels.</p>
          </section>
          <section className="workspace-surface workspace-attention">
            <h2>Références de routine</h2>
            <strong className="parent-metric">{planned.total}</strong>
            <p>
              Les dates calculées sont distinctes des dates vérifiées pour votre
              enfant. HB1 et le rattrapage restent décidés manuellement par le
              soignant.
            </p>
          </section>
        </div>
        <section className="workspace-surface workspace-secondary">
          <h2>Vaccinations documentées</h2>
          {recorded.items.map((entry) => (
            <details className="workspace-vaccine-record" key={entry.id}>
              <summary>
                <div>
                  <h3>
                    {String(entry.payload.vaccine_label || "Vaccination")} ·{" "}
                    {String(entry.payload.dose_label || "Dose non précisée")}
                  </h3>
                  <p className="muted">
                    {entry.occurred_on || "Date inconnue"} ·{" "}
                    {entry.occurrence_precision === "exact"
                      ? "Date déclarée exacte"
                      : "Date incertaine"}{" "}
                    ·{" "}
                    {entry.source_verified
                      ? "Source contrôlée"
                      : "Source non confirmée"}
                  </p>
                  <p className="fine">Professionnel {entry.professional_id}</p>
                </div>
                <span className="workspace-chip">Entrée enregistrée</span>
              </summary>
              <EntryCard entry={entry} link={false} />
            </details>
          ))}
          {!recorded.items.length && (
            <p className="workspace-empty">
              Aucune vaccination enregistrée sur cette page. Un historique
              absent ne prouve pas une dose manquée.
            </p>
          )}
        </section>
        <section className="workspace-surface workspace-secondary">
          <h2>Calendrier de référence</h2>
          {planned.items.map((item) => (
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
                child={child}
                today={todayCasablanca()}
              />
              <p className="fine">
                {item.version_label} · {catalogStatus[item.version_status]} ·
                Âge configuré : {ageLabel(item.age)} · Source :{" "}
                {ageLabel(item.source_age)}
              </p>
              <p className="fine">
                Professionnel {item.professional_id} · Révision {item.revision}
              </p>
            </article>
          ))}
          {!planned.items.length && (
            <p>Aucune référence assignée sur cette page.</p>
          )}
        </section>
        {pagination(Math.max(recorded.total, planned.total), 20)}
        <Link href={`/parent/children/${child.id}/vaccinations`}>
          Historique détaillé et partage vaccinal →
        </Link>
      </>
    );
  } else if (section === "access") {
    const shares = await supabase.rpc("list_clinician_shares", {
      p_child_id: child.id,
    });
    if (shares.error?.code === "42501") notFound();
    if (shares.error)
      throw new Error("Impossible de charger les partages autorisés.");
    content = (
      <div className="workspace-vaccine-grid">
        <div>
          <ParentSharePanel
            childId={child.id}
            list={shares.data as ShareList}
          />
        </div>
        <aside className="workspace-surface">
          <ShieldCheck size={32} aria-hidden="true" />
          <h2>Votre accès vérifié</h2>
          <p>
            Autorisé jusqu’au{" "}
            {new Date(child.expires_at).toLocaleDateString("fr-MA", {
              timeZone: "Africa/Casablanca",
            })}
            .
          </p>
          <p>
            Un partage temporaire donne une lecture limitée à un soignant
            autorisé. Il ne permet pas de modifier le carnet.
          </p>
          <Link
            className="button secondary"
            href={`/parent/children/${child.id}/privacy`}
          >
            Historique des accès
          </Link>
          <p>
            <Link href={`/parent/children/${child.id}#access`}>
              Gérer mon accès à ce carnet
            </Link>
          </p>
        </aside>
      </div>
    );
  } else {
    const result = await supabase.rpc("parent_child_booklet", {
      p_child_id: child.id,
      p_page: page,
    });
    if (result.error?.code === "42501") notFound();
    if (result.error) throw new Error("Impossible de charger le carnet.");
    const booklet = result.data as ParentBooklet;
    if (section === "growth")
      content = (
        <>
          <p className="notice">
            Mesures enregistrées, sans interprétation automatique ni percentiles
            inventés. Les courbes utilisent les dates exactes des 60 dernières
            mesures actives.
          </p>
          <div className="parent-growth-grid">
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
          <section className="workspace-surface workspace-secondary">
            <h2>Mesures et provenance</h2>
            {booklet.growth.map((entry) => (
              <EntryCard key={entry.id} entry={entry} link={false} />
            ))}
            {!booklet.growth.length && (
              <p className="workspace-empty">Aucune mesure enregistrée.</p>
            )}
          </section>
          <p>
            Pour une nouvelle mesure ou une correction, contactez votre
            soignant.
          </p>
        </>
      );
    else
      content = (
        <>
          <section className="workspace-surface">
            <div className="workspace-section-heading">
              <h2>Rendez-vous enregistrés</h2>
              <Link
                className="button secondary"
                href={`/parent/children/${child.id}/appointments`}
              >
                Ouvrir le calendrier
              </Link>
            </div>
            <p className="fine">
              Horaires de Casablanca · {booklet.appointment_total} rendez-vous
            </p>
            <div className="record-list">
              {booklet.appointments.map((appointment) => (
                <article key={appointment.id}>
                  <h3>{appointment.purpose_label}</h3>
                  <p>
                    {appointmentTime(appointment.starts_at)} —{" "}
                    {appointmentTime(appointment.ends_at)}
                  </p>
                  <span className="workspace-chip">
                    {appointmentStates[appointment.effective_state]}
                  </span>
                  <p>
                    {appointment.facility_name} · Professionnel{" "}
                    {appointment.professional_id}
                  </p>
                  {appointment.was_missed && (
                    <p className="fine">
                      Un ancien rendez-vous manqué reste conservé dans
                      l’historique.
                    </p>
                  )}
                  {appointment.recorded_by_other && (
                    <p className="fine">
                      La dose associée a été documentée par un autre
                      professionnel autorisé.
                    </p>
                  )}
                </article>
              ))}
            </div>
            {!booklet.appointments.length && (
              <p className="workspace-empty">
                Aucun rendez-vous enregistré sur cette page.
              </p>
            )}
            {pagination(booklet.appointment_total, 30)}
          </section>
          <p className="notice">
            Pour confirmer ou déplacer un rendez-vous, contactez le
            professionnel. Un rendez-vous passé ne prouve pas une vaccination
            manquée.
          </p>
        </>
      );
  }
  return (
    <>
      {heading}
      {picker}
      {content}
    </>
  );
}
