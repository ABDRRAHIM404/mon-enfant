import Link from "next/link";
import { CalendarDays, Syringe, TriangleAlert } from "lucide-react";
import type { Patient } from "@/lib/registry/types";
import { bookletDate } from "@/lib/vaccines/booklet";
import { ageLabel } from "@/lib/vaccines/types";
import type { VaccinationOverview } from "./projection";
import { ChildPageHeading } from "../patient-profile";

export function RoutineVaccinationFollowup({
  child,
  overview,
  canPlan,
}: {
  child: Patient;
  overview: VaccinationOverview;
  canPlan: boolean;
}) {
  const childPath = `/patients/${child.id}`;
  const rows = overview.projection.upcoming;

  function upcomingRow(row: (typeof rows)[number]) {
    return (
      <li className="vaccination-upcoming-row" key={row.rule.dose_code}>
        <Syringe size={20} aria-hidden="true" />
        <span>
          <strong>
            {row.label && `${row.label} · `}
            {row.rule.dose_code}
          </strong>
          <small>{ageLabel(row.rule.age)}</small>
        </span>
        <span className="vaccination-date">
          <CalendarDays size={16} aria-hidden="true" />
          <span>
            <time dateTime={row.startOn}>{bookletDate(row.startOn)}</time>
            {row.startOn !== row.endOn && (
              <>
                {" "}
                au <time dateTime={row.endOn}>{bookletDate(row.endOn)}</time>
              </>
            )}
          </span>
        </span>
        <span className="vaccination-status" data-tone="review">
          {row.needsReview ? "À vérifier" : "À venir"}
        </span>
      </li>
    );
  }

  return (
    <div className="consultations-workspace vaccination-workspace">
      <ChildPageHeading
        title="Repères vaccinaux de routine"
        actions={
          <Link
            className="button secondary child-button"
            href={`${childPath}/vaccinations`}
          >
            Ouvrir le carnet vaccinal
          </Link>
        }
      />
      <section
        className="consultation-panel vaccination-panel"
        aria-labelledby="vaccination-upcoming-title"
      >
        <div className="consultation-panel-title">
          <span className="consultation-icon">
            <CalendarDays size={22} aria-hidden="true" />
          </span>
          <h2 id="vaccination-upcoming-title">
            Prochaines vaccinations <small>(calendrier PNI)</small>
          </h2>
        </div>
        {overview.projection.reviewHB1 && (
          <aside className="vaccination-guidance">
            <TriangleAlert size={19} aria-hidden="true" />
            <div>
              <strong>Hépatite B : historique à vérifier</strong>
              <p>
                Vérifiez la date et la source au registre. HB1 est envisagée
                seulement si le registre confirme que la dose de naissance HBn a
                été omise.
              </p>
              {canPlan && (
                <Link href={`${childPath}/appointments/new`} prefetch={false}>
                  Planifier un suivi manuel
                </Link>
              )}
            </div>
          </aside>
        )}
        {overview.projection.draftPreview && (
          <p className="notice">
            Bêta · Dates indicatives calculées à partir du calendrier PNI en
            brouillon. Données fictives uniquement. Aucun rendez-vous n’est
            créé.
          </p>
        )}
        {rows.length ? (
          <>
            <p className="consultation-muted">
              Dates calculées · {overview.projection.schedule?.label} · À
              vérifier au registre.
            </p>
            <ul className="vaccination-upcoming" role="list">
              {rows.slice(0, 4).map(upcomingRow)}
            </ul>
            {rows.length > 4 && (
              <details className="vaccination-more">
                <summary>Voir les autres doses ({rows.length - 4})</summary>
                <ul className="vaccination-upcoming" role="list">
                  {rows.slice(4).map(upcomingRow)}
                </ul>
              </details>
            )}
          </>
        ) : (
          <p className="consultation-muted">
            {!overview.historyComplete
              ? "Historique trop volumineux ou incomplet pour vérifier automatiquement les prochaines doses."
              : !overview.projection.schedule
                ? overview.catalogSearchComplete
                  ? "Aucune version du calendrier PNI approuvée et vérifiée n’est disponible."
                  : "Aucune version approuvée dans les versions récentes. Consultez le catalogue pour examiner les autres versions."
                : !child.birth_date || child.birth_date_precision !== "exact"
                  ? "Une date de naissance exacte est nécessaire pour calculer les dates de routine."
                  : "Aucune prochaine référence à afficher pour cet enfant."}
          </p>
        )}
      </section>
    </div>
  );
}
