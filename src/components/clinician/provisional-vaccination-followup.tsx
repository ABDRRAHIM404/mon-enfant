import Link from "next/link";
import { appointmentTime, todayCasablanca } from "@/lib/appointments/calendar";
import { ageLabel } from "@/lib/vaccines/types";
import {
  provisionalRoutineRows,
  type ProvisionalFollowup,
} from "@/lib/vaccines/provisional-followup";
export function ProvisionalVaccinationFollowup({
  data,
  childId,
  identity,
}: {
  data: ProvisionalFollowup;
  childId: string;
  identity: Record<string, string>;
}) {
  const rows = provisionalRoutineRows(data, identity, todayCasablanca());
  const upcoming = rows.filter((r) => !r.past),
    past = rows.filter((r) => r.past);
  const approved =
    data.version?.status === "approved" && data.version.review_verified;
  const table = (items: typeof rows) => (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Dose / vaccin</th>
            <th scope="col">Âge de routine</th>
            <th scope="col">Repère pour cet enfant</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.dose_code}>
              <td>
                <strong>{r.dose_code}</strong>
                <br />
                {r.label}
                {r.declared && (
                  <p className="fine">
                    Déjà déclaré dans ce dossier — à vérifier, non validé.
                  </p>
                )}
              </td>
              <td>
                {ageLabel(r.age)}
                {r.eligibility === "female" && (
                  <p className="fine">Filles uniquement</p>
                )}
              </td>
              <td>
                {r.reference.startOn
                  ? r.reference.isWindow
                    ? `Du ${r.reference.startOn} au ${r.reference.endOn}`
                    : r.reference.startOn
                  : r.reference.state === "birth_date_uncertain"
                    ? "Naissance exacte nécessaire"
                    : r.reference.state === "eligibility_unknown"
                      ? "Éligibilité à préciser"
                      : r.reference.state === "disabled_reference_only"
                        ? "Suivi manuel"
                        : "Date indisponible — calendrier non validé"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <>
      <section className="panel" id="routine-followup">
        <h2>Vaccinations à venir et calendrier de routine</h2>
        <p>
          La non-vérification du compte n’empêche pas de consulter le
          calendrier. Ces repères restent distincts des vaccinations déclarées
          et des rendez-vous réellement planifiés.
        </p>
        {data.version ? (
          <>
            <p className="fine">Calendrier : {data.version.label}</p>
            {!approved && (
              <p className="notice">
                Calendrier en attente de validation clinique : les doses et âges
                de référence sont affichés, mais aucune date personnalisée n’est
                activée.
              </p>
            )}
            {!data.declarations_complete && (
              <p className="notice">
                Historique volumineux : les mentions de doses déclarées ne
                couvrent pas tout le dossier. Vérifiez son historique complet.
              </p>
            )}
            {upcoming.length ? (
              <>
                {table(upcoming.slice(0, 4))}
                {upcoming.length > 4 && (
                  <details>
                    <summary>
                      Voir les autres repères ({upcoming.length - 4})
                    </summary>
                    {table(upcoming.slice(4))}
                  </details>
                )}
              </>
            ) : (
              <p>
                Aucun repère futur calculable dans cette version pour les
                informations de naissance et d’éligibilité renseignées. Cela ne
                déclare aucune dose manquée.
              </p>
            )}
            {past.length > 0 && (
              <details>
                <summary>
                  Repères antérieurs ({past.length}) — historique à vérifier
                </summary>
                <p>
                  Une date passée ne prouve ni une dose manquée ni un besoin de
                  rattrapage.
                </p>
                {table(past)}
              </details>
            )}
          </>
        ) : (
          <p>
            Aucun calendrier de routine disponible. Les vaccinations déclarées
            et les suivis planifiés restent conservés.
          </p>
        )}
        <p className="fine">
          Une HB1 déclarée ne masque pas les autres repères de routine. Pour une
          HB1 non administrée, incertaine ou un rattrapage, le suivi reste à
          décider manuellement. Aucun rendez-vous n’est créé par cet affichage.
        </p>
        <Link
          className="button secondary"
          href={`/provisional/${childId}?kind=appointment#entry-form`}
        >
          Planifier un suivi dans ce dossier
        </Link>
      </section>
      <section className="panel" id="planned-followup">
        <h2>Suivis déjà planifiés ({data.appointments_total})</h2>
        <p className="fine">
          Rendez-vous saisis manuellement pour cet enfant, sans rapprochement
          automatique avec une dose.
        </p>
        {data.appointments.length ? (
          data.appointments.map((a) => (
            <article key={a.id}>
              <h3>{a.purpose}</h3>
              <p>
                {appointmentTime(a.scheduled_for)} · Provisoire, non vérifié
              </p>
              <Link className="text-link" href={`/provisional/${childId}`}>
                Ouvrir le dossier et l’historique
              </Link>
            </article>
          ))
        ) : (
          <p>Aucun rendez-vous futur planifié dans ce dossier.</p>
        )}
        {data.appointments_total > data.appointments.length && (
          <p>
            Les 20 prochains rendez-vous sont affichés. Consultez le dossier
            pour l’historique complet.
          </p>
        )}
      </section>
    </>
  );
}
