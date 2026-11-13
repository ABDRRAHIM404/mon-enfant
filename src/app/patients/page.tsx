import Link from "next/link";
import { appointmentTime } from "@/lib/appointments/calendar";
import { requireApprovedDoctor } from "@/lib/auth";
import { DoctorNav } from "@/components/registry/doctor-nav";
import {
  historyLabels,
  patientName,
  birthLabel,
  type Patient,
} from "@/lib/registry/types";
export const dynamic = "force-dynamic";
export default async function Patients({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    history?: string;
    age?: string;
    page?: string;
  }>;
}) {
  const { supabase } = await requireApprovedDoctor();
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 100);
  const history = ["unknown", "partial", "reviewed"].includes(
    params.history ?? "",
  )
    ? params.history!
    : "all";
  const age = ["under1", "1to5", "over5", "unknown"].includes(params.age ?? "")
    ? params.age!
    : "all";
  const page = Math.min(
    10000,
    Math.max(1, Math.floor(Number(params.page) || 1)),
  );
  const { data, error } = await supabase.rpc("list_patients", {
    p_query: q,
    p_history: history,
    p_age: age,
    p_page: page,
  });
  if (error) throw new Error("Impossible de charger le registre.");
  const result = data as { items: Patient[]; total: number };
  function pageHref(n: number) {
    return `/patients?${new URLSearchParams({ q, history, age, page: String(n) })}`;
  }
  return (
    <main className="account-page wide">
      <DoctorNav />
      <div className="page-heading">
        <span className="eyebrow">MON REGISTRE</span>
        <h1>Patients</h1>
        <p className="muted">Recherche limitée à vos dossiers autorisés.</p>
      </div>
      <div className="tabs">
        <Link href="/patients/new">Inscrire un enfant</Link>
        <Link href="/patients/new?source=paper">
          Transcrire un dossier papier
        </Link>
        <Link href="/patients/link">Rattacher un dossier existant</Link>
      </div>
      <section className="panel">
        <form className="registry-filters" action="/patients">
          <label>
            Nom, identifiant, contact ou numéro local
            <input name="q" maxLength={100} defaultValue={q} />
          </label>
          <label>
            Historique
            <select name="history" defaultValue={history}>
              <option value="all">Tous</option>
              {Object.entries(historyLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Âge (date exacte)
            <select name="age" defaultValue={age}>
              <option value="all">Tous</option>
              <option value="under1">Moins de 1 an</option>
              <option value="1to5">1 à 5 ans</option>
              <option value="over5">6 ans et plus</option>
              <option value="unknown">Date inconnue / estimée</option>
            </select>
          </label>
          <button className="button primary">Rechercher</button>
        </form>
        <p className="fine">{result.total} dossier(s) · 30 par page</p>
        {result.items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Enfant</th>
                  <th>Naissance</th>
                  <th>Mon registre</th>
                  <th>Historique</th>
                  <th>Dernier soin documenté</th>
                  <th>Mon prochain rendez-vous</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link className="text-link" href={`/patients/${p.id}`}>
                        {patientName(p)}
                      </Link>
                      {p.name_status === "provisional" && (
                        <p className="fine">Identité provisoire</p>
                      )}
                    </td>
                    <td>{birthLabel(p)}</td>
                    <td>
                      {p.registers.map((r, i) => (
                        <p key={i}>
                          {r.number} · {r.year} / {r.book} · {r.facility_name}
                        </p>
                      ))}
                    </td>
                    <td>{historyLabels[p.history_status]}</td>
                    <td>{p.last_documented_care || "Non documenté"}</td>
                    <td>
                      {p.next_own_appointment
                        ? appointmentTime(p.next_own_appointment.starts_at)
                        : "Non planifié"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">
            Aucun dossier ne correspond à ces critères.
          </p>
        )}
        <nav className="pagination" aria-label="Pagination des patients">
          {page > 1 ? (
            <Link className="text-link" href={pageHref(page - 1)}>
              Page précédente
            </Link>
          ) : (
            <span />
          )}
          <span>Page {page}</span>
          {page * 30 < result.total && page < 10000 ? (
            <Link className="text-link" href={pageHref(page + 1)}>
              Page suivante
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </section>
    </main>
  );
}
