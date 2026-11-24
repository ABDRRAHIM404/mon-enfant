import { randomUUID } from "node:crypto";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  CircleAlert,
  Clock,
  Plus,
  ShieldCheck,
  Syringe,
} from "lucide-react";
import Link from "next/link";
import type { ClinicalAttributions } from "@/lib/clinical/attribution";
import { clinicianName } from "@/lib/clinical/attribution";
import type { ClinicalEntry } from "@/lib/clinical/types";
import type { Patient } from "@/lib/registry/types";
import {
  bookletAge,
  bookletDate,
  bookletStatus,
  vaccinationBooklet,
} from "@/lib/vaccines/booklet";
import { BookletReviewForm, BookletScroll } from "./controls";

type Booklet = ReturnType<typeof vaccinationBooklet>;
type Row = Booklet["rows"][number];

export function BookletDate({ date }: { date: string }) {
  return <time dateTime={date.slice(0, 10)}>{bookletDate(date)}</time>;
}

function referenceDate(row: Row) {
  const { startOn, endOn, isWindow } = row.ref;
  if (!startOn) return null;
  if (isWindow && endOn)
    return (
      <>
        <BookletDate date={startOn} /> au <BookletDate date={endOn} />
      </>
    );
  return <BookletDate date={startOn} />;
}

function Status({
  status,
  children,
}: {
  status: Row["status"];
  children?: React.ReactNode;
}) {
  const Icon =
    status === "completed"
      ? Check
      : status === "upcoming"
        ? Clock
        : status === "overdue" && !children
          ? CircleAlert
          : null;
  return (
    <span className={`booklet-status is-${status}`}>
      {Icon && <Icon size={14} aria-hidden="true" />}{" "}
      {children ?? bookletStatus[status]}
    </span>
  );
}

const doses = (count: number) => `${count} dose${count > 1 ? "s" : ""}`;

function summary(booklet: Booklet, complete: boolean) {
  const next = booklet.upcoming[0];
  return [
    {
      id: "completed",
      label: "Vaccinations réalisées",
      icon: Syringe,
      value: complete ? doses(booklet.completed) : "—",
    },
    {
      id: "next",
      label: "Prochaine vaccination",
      icon: CalendarDays,
      value: next?.rule.dose_code ?? "—",
      detail: next ? referenceDate(next) : null,
    },
    {
      id: "upcoming",
      label: "Vaccinations à venir",
      icon: Clock,
      value:
        booklet.approved && complete ? doses(booklet.upcoming.length) : "—",
    },
    {
      id: "overdue",
      label: "Vaccinations en retard",
      icon: CircleAlert,
      value: booklet.approved && complete ? doses(booklet.overdue) : "—",
      detail: booklet.approved ? "Confirmées" : null,
    },
    {
      id: "state",
      label: "Statut du calendrier",
      icon: ShieldCheck,
      value: !booklet.approved
        ? "PNI indisponible"
        : booklet.needsReview
          ? "À vérifier"
          : "Suivi PNI affiché",
    },
  ];
}

function AdministrationCells({
  child,
  entry,
  names,
  reference,
}: {
  child: Patient;
  entry?: ClinicalEntry;
  names: ClinicalAttributions;
  reference: React.ReactNode;
}) {
  const age =
    child.birth_date_precision === "exact" &&
    child.birth_date &&
    entry?.occurred_on &&
    entry.occurrence_precision === "exact"
      ? bookletAge(child.birth_date, entry.occurred_on)
      : null;
  const weight = entry && Number(entry.payload.weight_kg);
  const reportedProvider =
    entry?.payload.provider_status === "known"
      ? String(entry.payload.administered_by ?? "").trim()
      : "";
  const provider = /(?:\bPRO-[a-z\d-]+\b|^[0-9a-f]{8}-[0-9a-f-]{27}$)/i.test(
    reportedProvider,
  )
    ? ""
    : reportedProvider;
  const place =
    entry?.payload.administration_facility_status === "known"
      ? entry.payload.administration_facility
      : null;
  return (
    <>
      <td>
        {entry?.occurred_on ? (
          <>
            <BookletDate date={entry.occurred_on} />
            {entry.occurrence_precision !== "exact" && (
              <small>Date estimée</small>
            )}
          </>
        ) : (
          "—"
        )}
      </td>
      <td>{age ?? "—"}</td>
      <td>
        {weight && Number.isFinite(weight) && weight > 0
          ? `${weight.toLocaleString("fr-MA")} kg`
          : "—"}
      </td>
      <td>
        {entry?.payload.lot_status === "known" && entry.payload.lot_number
          ? entry.payload.lot_number
          : "—"}
      </td>
      <td className="booklet-reference-cell">{reference}</td>
      <td>
        {entry ? (
          <>
            <span>
              {provider ||
                `Saisi par ${clinicianName(names, entry.professional_id)}`}
            </span>
            <small>
              {place ||
                (entry.facility_name
                  ? `Lieu de saisie · ${entry.facility_name}`
                  : "Lieu non renseigné")}
            </small>
            {provider && (
              <small>
                Saisi par {clinicianName(names, entry.professional_id)}
              </small>
            )}
          </>
        ) : (
          "—"
        )}
      </td>
    </>
  );
}

export function VaccinationBooklet({
  child,
  booklet,
  names,
  allowed,
  complete,
}: {
  child: Patient;
  booklet: Booklet;
  names: ClinicalAttributions;
  allowed: boolean;
  complete: boolean;
}) {
  const base = `/patients/${child.id}`;
  const form = `${base}/records/new?kind=vaccination&from=booklet`;
  const documents = booklet.approved;
  const groups = Map.groupBy(booklet.rows, (row) => row.stage.label);
  return (
    <div className="vaccination-booklet-content">
      <div className="booklet-mobile-heading">
        <Link aria-label="Retour au dossier enfant" href={base}>
          {" "}
          <ArrowLeft size={20} aria-hidden="true" />{" "}
        </Link>
        <div>
          <p className="booklet-mobile-title">Calendrier vaccinal</p>
          <p>
            PNI · Maroc
            {documents?.reviewed_at ? (
              <>
                {" "}
                · Revu le <BookletDate date={documents.reviewed_at} />
              </>
            ) : (
              ""
            )}
          </p>
        </div>
      </div>
      <ul className="booklet-metrics" aria-label="Synthèse des vaccinations">
        {summary(booklet, complete).map(
          ({ id, label, icon: Icon, value, detail }) => (
            <li className={`booklet-metric is-${id}`} key={id}>
              <span className="booklet-metric-icon">
                <Icon size={22} aria-hidden="true" />
              </span>
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
                {detail && <small>{detail}</small>}
              </div>
            </li>
          ),
        )}
      </ul>
      <section className="booklet-panel" aria-labelledby="booklet-title">
        <div className="booklet-heading">
          <div className="booklet-title">
            <Syringe aria-hidden="true" size={28} />
            <div>
              <h1 id="main-content" tabIndex={-1}>
                <span id="booklet-title">Calendrier vaccinal de l’enfant</span>
              </h1>
              <p>
                Programme national d’immunisation · Maroc
                {documents?.reviewed_at ? (
                  <>
                    {" "}
                    · Revu le <BookletDate date={documents.reviewed_at} />
                  </>
                ) : (
                  ""
                )}
              </p>
            </div>
          </div>
          <div className="booklet-actions">
            <Link
              className="booklet-button"
              href={documents ? `/vaccines/${documents.id}` : "/vaccines"}
            >
              <BookOpen size={17} aria-hidden="true" />
              Voir le PNI
            </Link>
            {allowed && (
              <Link className="booklet-button is-primary" href={form}>
                <Plus size={19} aria-hidden="true" />
                Enregistrer une dose
              </Link>
            )}
          </div>
        </div>
        {!allowed && (
          <p className="booklet-note">
            La saisie exige une{" "}
            <Link href="/account/clinical-permissions">
              habilitation de vaccination
            </Link>
            .
          </p>
        )}
        {!documents && (
          <p className="booklet-note">
            Aucune version approuvée et vérifiée du PNI n’est disponible. Les
            saisies existantes restent consultables dans l’historique.
          </p>
        )}
        {!complete && (
          <p className="booklet-note">
            L’historique complet n’a pas pu être rapproché. Les éléments
            incomplets restent à vérifier.
          </p>
        )}
        {groups.size > 0 && (
          <BookletScroll>
            <table className="booklet-table">
              <caption className="sr-only">
                Calendrier vaccinal de l’enfant et administrations documentées
              </caption>
              <thead>
                <tr>
                  {[
                    "Âge recommandé",
                    "Vaccin (dose)",
                    "Date d’administration",
                    "Âge de l’enfant",
                    "Poids",
                    "N° du lot",
                    "Prochaine vaccination",
                    "Professionnel et lieu",
                    "Statut",
                  ].map((title, i) => (
                    <th
                      key={title}
                      scope="col"
                      className={
                        i === 0
                          ? "booklet-sticky-age"
                          : i === 1
                            ? "booklet-sticky-dose"
                            : undefined
                      }
                    >
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              {Array.from(groups, ([age, rows]) => (
                <tbody key={age}>
                  {rows.map((row, index) => {
                    const { entry, item, rule, status } = row;
                    const entryForm = `${form}&version=${rule.version_id}&dose=${encodeURIComponent(rule.dose_code)}`;
                    const href = entry
                      ? `${base}/records/${entry.root_id}`
                      : item
                        ? `${base}/vaccinations/${item.id}`
                        : allowed && status !== "not_applicable"
                          ? entryForm
                          : `/vaccines/${rule.version_id}`;
                    return (
                      <tr key={rule.dose_code}>
                        {index === 0 && (
                          <th
                            rowSpan={rows.length}
                            scope="rowgroup"
                            className="booklet-sticky-age"
                          >
                            {age}
                          </th>
                        )}
                        <th scope="row" className="booklet-sticky-dose">
                          <Link className="booklet-dose" href={href}>
                            <strong>{rule.dose_code}</strong>
                            <small>{row.label}</small>
                          </Link>
                          {row.condition && (
                            <small className="booklet-condition">
                              {row.condition}
                            </small>
                          )}
                        </th>
                        <AdministrationCells
                          child={child}
                          entry={entry}
                          names={names}
                          reference={
                            referenceDate(row) ? (
                              <Status status={status}>
                                {referenceDate(row)}
                              </Status>
                            ) : (
                              "—"
                            )
                          }
                        />
                        <td className="booklet-state-cell">
                          <Status status={status} />
                          {!entry &&
                            item &&
                            allowed &&
                            status !== "withdrawn" &&
                            status !== "not_applicable" && (
                              <Link
                                className="booklet-row-action"
                                href={entryForm}
                              >
                                Saisir la dose
                              </Link>
                            )}
                          {allowed && row.canReview && (
                            <BookletReviewForm
                              key={`${row.review?.id ?? "new"}-${status}`}
                              child={child.id}
                              version={rule.version_id}
                              dose={rule.dose_code}
                              operation={randomUUID()}
                              previous={row.review?.id}
                              outstanding={status === "overdue"}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </BookletScroll>
        )}
        <div className="booklet-foot">
          <p>
            Les dates PNI sont des références de routine. Les créneaux confirmés
            sont dans <Link href={`${base}/appointments`}>Rendez-vous</Link>.
          </p>
          <p>
            Une dose sans preuve reste à vérifier. Le rattrapage est évalué par
            le soignant selon le PNI.
          </p>
        </div>
      </section>
    </div>
  );
}
