import { clinicianName } from "@/lib/clinical/attribution";
import { readClinicalAttributions } from "@/lib/clinical/read-attribution";
import Link from "next/link";
import { requireApprovedDoctor } from "@/lib/auth";
import { ClinicalWorkspace } from "@/components/clinician/care-workspace";
import { LiveRefresh } from "@/components/appointments/live-refresh";
import { AppointmentCard } from "@/components/appointments/card";
import {
  appointmentBuckets,
  vaccineFollowupStates,
  type AppointmentPage,
  type AppointmentOption,
} from "@/lib/appointments/types";
import { historyLabels } from "@/lib/registry/types";
export const dynamic = "force-dynamic";
type Reference = AppointmentOption & {
  child_id: string;
  child_given_name: string | null;
  child_family_name: string | null;
  history_status: string;
  followup_state: keyof typeof vaccineFollowupStates;
};
const vaccineBuckets = {
  all: "Toutes les références",
  routine_due: "Routine dans les 30 jours",
  potentially_overdue_unconfirmed: "Potentiellement dépassées / non confirmées",
  unknown_history: "Historique inconnu ou partiel",
  documented: "Administrations documentées",
  reference_review: "Références à réexaminer",
};
export default async function FollowUp({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; bucket?: string; page?: string }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const q = await searchParams,
    mode = q.mode === "vaccines" ? "vaccines" : "appointments",
    buckets = mode === "vaccines" ? vaccineBuckets : appointmentBuckets;
  const bucket =
      q.bucket && Object.hasOwn(buckets, q.bucket)
        ? q.bucket
        : mode === "vaccines"
          ? "potentially_overdue_unconfirmed"
          : "today",
    page = Math.min(10000, Math.max(1, Math.floor(Number(q.page) || 1)));
  const response = await supabase.rpc(
    mode === "vaccines" ? "vaccine_followup_worklist" : "appointment_worklist",
    { p_bucket: bucket, p_page: page },
  );
  if (response.error)
    throw new Error("Impossible de charger les suivis autorisés.");
  const data = response.data as { items: unknown[]; total: number };
  const href = (n: number) =>
    `/follow-up?${new URLSearchParams({ mode, bucket, page: String(n) })}`;
  const items = data.items as (Reference | AppointmentPage["items"][number])[];
  const attributions = await readClinicalAttributions(
    supabase,
    items.flatMap((item) => [
      "professional_id" in item ? item.professional_id : null,
      item.documentation?.professional_id,
    ]),
    { children: items.map((item) => item.child_id) },
  );
  return (
    <ClinicalWorkspace active="tools">
      <div className="page-heading">
        <h1 id="main-content" tabIndex={-1}>
          Suivis et alertes
        </h1>
        <p className="muted">
          Les rendez-vous passés et les administrations non confirmées restent
          des états distincts.
        </p>
      </div>
      <div className="tabs">
        <Link href="/appointments">Mon calendrier</Link>
        <Link href="/follow-up?mode=appointments&bucket=missed_vaccinations">
          Rendez-vous vaccinaux manqués
        </Link>
        <Link href="/follow-up?mode=appointments&bucket=resolved_by_other">
          Dose enregistrée ailleurs
        </Link>
        <Link href="/follow-up?mode=vaccines">Références vaccinales</Link>
      </div>
      <LiveRefresh />
      <section className="panel">
        <form action="/follow-up" className="registry-filters">
          <input type="hidden" name="mode" value={mode} />
          <label>
            File de suivi
            <select name="bucket" defaultValue={bucket}>
              {Object.entries(buckets).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="button primary">Afficher</button>
        </form>
        <p>
          {data.total} résultat(s) · page {page} · 30 par page
        </p>
      </section>
      {mode === "appointments" && <h2>Rendez-vous à suivre</h2>}
      {mode === "appointments"
        ? (data.items as unknown as AppointmentPage["items"]).map(
            (appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                attributions={attributions}
              />
            ),
          )
        : (data.items as Reference[]).map((item) => (
            <article className="panel" key={item.id}>
              <h2>
                {item.dose_code} —{" "}
                {[item.child_given_name, item.child_family_name]
                  .filter(Boolean)
                  .join(" ") || "Identité inconnue"}
              </h2>
              <p>{vaccineFollowupStates[item.followup_state]}</p>
              <p>
                {historyLabels[item.history_status]} · {item.version_label}
              </p>
              {item.reference.start_on && (
                <p>
                  Référence de routine : {item.reference.start_on}
                  {item.reference.is_window
                    ? ` au ${item.reference.end_on} inclus`
                    : ""}
                </p>
              )}
              {item.documentation && (
                <p>
                  Dose documentée par{" "}
                  {clinicianName(
                    attributions,
                    item.documentation.professional_id,
                  )}{" "}
                  le {item.documentation.occurred_on}.
                </p>
              )}
              <p className="fine">
                Une documentation manquante ne prouve pas une dose manquée.
                Relisez le dossier ; toute date de remplacement se choisit
                manuellement.
              </p>
              <div className="tabs">
                <Link href={`/patients/${item.child_id}/vaccinations`}>
                  Examiner les vaccinations
                </Link>
                {!item.documentation && (
                  <Link
                    href={`/patients/${item.child_id}/appointments/new?item=${item.id}`}
                  >
                    Choisir manuellement un rendez-vous
                  </Link>
                )}
              </div>
            </article>
          ))}
      {!data.items.length && (
        <p className="empty-state">
          Aucun suivi pour ce filtre dans vos dossiers actuellement autorisés.
        </p>
      )}
      <nav className="pagination" aria-label="Pagination des suivis">
        {page > 1 && <Link href={href(page - 1)}>Précédent</Link>}
        <span>Page {page}</span>
        {page * 30 < data.total && <Link href={href(page + 1)}>Suivant</Link>}
      </nav>
    </ClinicalWorkspace>
  );
}
