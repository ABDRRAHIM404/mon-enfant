import {
  clinicianName,
  type ClinicalAttributions,
} from "@/lib/clinical/attribution";
import { randomUUID } from "node:crypto";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Eye,
  History,
  Pencil,
  Plus,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";
import { NavigationFeedback } from "@/components/workspace-navigation";
import {
  readableAppointmentDate,
  todayCasablanca,
} from "@/lib/appointments/calendar";
import { sourceLabels, type ClinicalEntry } from "@/lib/clinical/types";
import {
  birthLabel,
  patientName,
  type Facility,
  type Patient,
} from "@/lib/registry/types";
import { addCalendarMonths, civilDay } from "@/lib/vaccines/calendar";
import { ChildAvatar } from "../child-avatar";
import { GrowthPickerDisclosure } from "./picker-disclosure";
import { MeasurementChart } from "./measurement-chart";
import { MeasurementForm } from "./measurement-form";

const pageSize = 30;
const formatValue = new Intl.NumberFormat("fr-MA", {
  maximumFractionDigits: 2,
});
const shortDate = new Intl.DateTimeFormat("fr-MA", {
  dateStyle: "medium",
  timeZone: "UTC",
});
const measurements = [
  { key: "weight_kg", name: "Poids (kg)", mobile: "Poids · kg" },
  { key: "height_cm", name: "Taille (cm)", mobile: "Taille · cm" },
  {
    key: "head_cm",
    name: "Périmètre crânien (cm)",
    mobile: "Pér. crânien · cm",
  },
] as const;

function childAge(child: Patient, date: string) {
  if (
    child.birth_date_precision !== "exact" ||
    !child.birth_date ||
    child.birth_date > date
  )
    return null;
  const birth = child.birth_date;
  let months =
    (Number(date.slice(0, 4)) - Number(birth.slice(0, 4))) * 12 +
    Number(date.slice(5, 7)) -
    Number(birth.slice(5, 7));
  if (addCalendarMonths(birth, months) > date) months -= 1;
  if (months >= 12) {
    const years = Math.floor(months / 12);
    return `${years} ${years === 1 ? "an" : "ans"}${months % 12 ? ` ${months % 12} mois` : ""}`;
  }
  if (months > 0) return `${months} mois`;
  const days = civilDay(date) - civilDay(birth);
  return `${days} ${days === 1 ? "jour" : "jours"}`;
}

function Pagination({
  label,
  page,
  total,
  href,
}: {
  label: string;
  page: number;
  total: number;
  href: (n: number) => string;
}) {
  const next = page < 10000 && page * pageSize < total;
  if (page === 1 && !next) return null;
  return (
    <nav className="growth-pagination" aria-label={label}>
      {page > 1 && (
        <Link className="growth-action" href={href(page - 1)} prefetch={false}>
          Précédent
        </Link>
      )}
      <span aria-current="page">Page {page}</span>
      {next && (
        <Link className="growth-action" href={href(page + 1)} prefetch={false}>
          Suivant
        </Link>
      )}
    </nav>
  );
}

export function MeasurementRows({
  child,
  entries,
  canCorrect,
  attributions,
}: {
  child: Patient;
  entries: ClinicalEntry[];
  attributions: ClinicalAttributions;
  canCorrect: (entry: ClinicalEntry) => boolean;
}) {
  return (
    <table
      className="growth-table"
      aria-label="Historique des mesures"
      role="table"
    >
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Âge</th>
          {measurements.map(({ key, name }) => (
            <th scope="col" key={key}>
              {name}
            </th>
          ))}
          <th scope="col">Saisie et provenance</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {entries.map((entry) => {
          const href = `/patients/${child.id}/records/${entry.root_id}`;
          const when = entry.occurred_on
            ? shortDate.format(new Date(`${entry.occurred_on}T12:00:00Z`))
            : "Date inconnue";
          const age =
            entry.occurred_on && entry.occurrence_precision === "exact"
              ? childAge(child, entry.occurred_on)
              : null;
          return (
            <tr key={entry.id} role="row">
              <td className="growth-row-date" role="cell">
                <span>
                  <CalendarDays size={16} aria-hidden="true" />
                  {entry.occurred_on ? (
                    <time dateTime={entry.occurred_on}>{when}</time>
                  ) : (
                    when
                  )}
                </span>
                {entry.occurrence_precision === "estimated" && (
                  <small>Date estimée</small>
                )}
                {entry.entry_state === "withdrawn" && <small>Retirée</small>}
              </td>
              <td className="growth-row-age" role="cell">
                {age ?? "—"}
              </td>
              {measurements.map(({ key, mobile }) => {
                const value = entry.payload[key];
                return (
                  <td key={key} className="growth-row-value" role="cell">
                    <span>{mobile}</span>
                    <strong>
                      {typeof value === "number"
                        ? formatValue.format(value)
                        : "—"}
                    </strong>
                  </td>
                );
              })}
              <td className="growth-row-source" role="cell">
                <strong>
                  {clinicianName(attributions, entry.professional_id)}
                </strong>
                <details>
                  <summary>
                    {sourceLabels[entry.source_type] ?? entry.source_type}
                  </summary>
                  <small>
                    {entry.source_verified
                      ? "Source contrôlée"
                      : "Source non confirmée"}{" "}
                    · {entry.facility_name} · Révision {entry.revision}
                  </small>
                  {entry.source_reference && (
                    <small>{entry.source_reference}</small>
                  )}
                </details>
              </td>
              <td className="growth-row-actions" role="cell">
                <Link
                  className="growth-action growth-icon-action"
                  href={href}
                  prefetch={false}
                  aria-label={`Voir l’historique de la mesure du ${when}`}
                >
                  <Eye size={17} aria-hidden="true" />
                </Link>
                {canCorrect(entry) && (
                  <Link
                    className="growth-action growth-icon-action"
                    href={`${href}#growth-correction`}
                    prefetch={false}
                    aria-label={`Corriger la mesure du ${when}`}
                  >
                    <Pencil size={17} aria-hidden="true" />
                  </Link>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function GrowthWorkspace({
  child,
  matches,
  search,
  childPage,
  childTotal,
  history,
  page,
  canWrite,
  standardAccess,
  userId,
  facilities,
  saved,
  attributions,
}: {
  child: Patient | null;
  matches: Patient[];
  search: string;
  childPage: number;
  childTotal: number;
  history: { items: ClinicalEntry[]; total: number };
  page: number;
  canWrite: boolean;
  standardAccess: boolean;
  userId: string;
  facilities: Facility[];
  saved: boolean;
  attributions: ClinicalAttributions;
}) {
  const childPath = child ? `/patients/${child.id}` : "";
  const recordsHref = `${childPath}/records?kind=growth`;
  const query = (values: Record<string, string>) =>
    `/growth?${new URLSearchParams({ q: search, ...values })}`;
  const age = child ? childAge(child, todayCasablanca()) : null;

  return (
    <div className="consultations-workspace growth-workspace">
      <header className="consultation-heading growth-heading">
        <div className="consultation-heading-copy">
          <span>Espace soignant</span>
          <h1 id="main-content" tabIndex={-1}>
            Croissance
          </h1>
          <p>
            Mesures enregistrées et évolution brute, sans interprétation
            diagnostique.
          </p>
        </div>
        <Image
          src="/dashboard-art/growth-hero.webp"
          width={1050}
          height={371}
          alt=""
          unoptimized
          preload
        />
      </header>
      <div className="growth-layout">
        <aside
          className="consultation-panel growth-picker"
          aria-label="Sélectionner un enfant"
        >
          <h2 className="growth-desktop-only">
            <UsersRound size={21} aria-hidden="true" /> Sélectionner un enfant
          </h2>
          <GrowthPickerDisclosure key={child?.id} hasSelection={Boolean(child)}>
            <form action="/growth" className="consultation-search" key={search}>
              <label htmlFor="growth-search">
                Rechercher dans mes dossiers autorisés
              </label>
              <div className="consultation-search-field">
                <button aria-label="Rechercher un enfant">
                  <Search size={18} aria-hidden="true" />
                </button>
                <input
                  id="growth-search"
                  type="search"
                  name="q"
                  maxLength={100}
                  defaultValue={search}
                  placeholder="Nom de l’enfant…"
                />
              </div>
            </form>
            <ul className="consultation-patients" role="list">
              {matches.map((patient) => (
                <li key={patient.id}>
                  <Link
                    href={query({
                      child: patient.id,
                      childPage: String(childPage),
                    })}
                    aria-current={child?.id === patient.id ? "true" : undefined}
                    prefetch={false}
                  >
                    <ChildAvatar sex={patient.sex} size={40} />
                    <span>
                      <strong>{patientName(patient)}</strong>
                      <small>{birthLabel(patient)}</small>
                    </span>
                    {child?.id === patient.id && (
                      <Check size={20} aria-hidden="true" />
                    )}
                    <NavigationFeedback />
                  </Link>
                </li>
              ))}
            </ul>
            {!matches.length && (
              <p>Aucun dossier ne correspond à cette recherche.</p>
            )}
            <Pagination
              label="Enfants à sélectionner"
              page={childPage}
              total={childTotal}
              href={(n) =>
                query({
                  childPage: String(n),
                  ...(child ? { child: child.id } : {}),
                })
              }
            />
          </GrowthPickerDisclosure>
        </aside>
        {child ? (
          <>
            <section
              className="consultation-panel growth-child"
              aria-label="Dossier sélectionné"
            >
              <div className="growth-child-identity">
                <ChildAvatar sex={child.sex} size={64} />
                <div>
                  <h2>{patientName(child)}</h2>
                  <p>
                    {child.birth_date
                      ? `Naissance le ${readableAppointmentDate(child.birth_date)}${child.birth_date_precision === "estimated" ? " (estimée)" : ""}`
                      : "Date de naissance inconnue"}
                    {age && ` · ${age}`}
                  </p>
                  {child.registers?.[0] && (
                    <p className="growth-register">
                      Registre local · {child.registers[0].number} /{" "}
                      {child.registers[0].year} / {child.registers[0].book}
                    </p>
                  )}
                  <span className="growth-authorized">
                    Dossier autorisé · {history.total}{" "}
                    {history.total === 1 ? "saisie" : "saisies"}
                  </span>
                </div>
              </div>
              <div className="growth-child-actions">
                <Link
                  className="growth-action"
                  href={childPath}
                  prefetch={false}
                >
                  <UserRound size={18} aria-hidden="true" /> Profil de l’enfant
                </Link>
                <Link
                  className="growth-action"
                  href={recordsHref}
                  prefetch={false}
                >
                  <History size={18} aria-hidden="true" /> Historique et
                  corrections
                </Link>
              </div>
            </section>
            <section
              className="consultation-panel growth-entry"
              aria-labelledby="growth-entry-title"
            >
              <h2 id="growth-entry-title">
                <Plus size={21} aria-hidden="true" /> Ajouter une mesure
              </h2>
              {saved && (
                <p className="growth-success" role="status">
                  <Check size={18} aria-hidden="true" /> Mesure enregistrée.
                </p>
              )}
              {canWrite && facilities.length ? (
                <MeasurementForm
                  key={`${child.id}-${history.items[0]?.id ?? "empty"}`}
                  childId={child.id}
                  facilities={facilities}
                  operationId={randomUUID()}
                  query={search}
                  childPage={childPage}
                />
              ) : (
                <p>
                  {canWrite
                    ? "Un lieu d’exercice est nécessaire pour enregistrer une mesure."
                    : "Une habilitation de croissance est nécessaire pour enregistrer une mesure."}{" "}
                  <Link
                    className="text-link"
                    href={
                      canWrite ? "/practices" : "/account/clinical-permissions"
                    }
                  >
                    {canWrite ? "Mes lieux d’exercice" : "Mes habilitations"}
                  </Link>
                </p>
              )}
            </section>
            <MeasurementChart
              key={`${child.id}-${page}-${history.items[0]?.id ?? "empty"}`}
              entries={history.items.map(
                ({
                  entry_state,
                  occurrence_precision,
                  occurred_on,
                  payload,
                  source_verified,
                }) => ({
                  entry_state,
                  occurrence_precision,
                  occurred_on,
                  source_verified,
                  payload: Object.fromEntries(
                    measurements.flatMap(({ key }) =>
                      typeof payload[key] === "number"
                        ? [[key, payload[key]]]
                        : [],
                    ),
                  ),
                }),
              )}
            />
            <section
              className="consultation-panel growth-history"
              aria-labelledby="growth-history-title"
            >
              <div className="growth-history-header">
                <h2 id="growth-history-title">
                  <ClipboardList size={21} aria-hidden="true" /> Historique des
                  mesures
                </h2>
                <Link
                  className="growth-action"
                  href={recordsHref}
                  prefetch={false}
                >
                  Voir tout <ChevronRight size={17} aria-hidden="true" />
                </Link>
              </div>
              {history.items.length ? (
                <MeasurementRows
                  child={child}
                  entries={history.items}
                  attributions={attributions}
                  canCorrect={(entry) =>
                    canWrite &&
                    facilities.length > 0 &&
                    (standardAccess || entry.author_id === userId)
                  }
                />
              ) : (
                <p>Aucune mesure enregistrée sur cette page.</p>
              )}
              <Pagination
                label="Pages de l’historique des mesures"
                page={page}
                total={history.total}
                href={(n) =>
                  query({
                    child: child.id,
                    childPage: String(childPage),
                    page: String(n),
                  })
                }
              />
              {canWrite && facilities.length > 0 && (
                <Link
                  className="growth-standard-link text-link"
                  prefetch={false}
                  href={`${childPath}/records/new?kind=growth`}
                >
                  Nouvelle mesure · formulaire complet
                </Link>
              )}
            </section>
          </>
        ) : (
          <section className="consultation-panel growth-empty">
            <h2>Aucun enfant sélectionné</h2>
            <p>Choisissez un dossier autorisé ou ajustez votre recherche.</p>
            <Link className="growth-action" href="/patients/new">
              Inscrire un enfant
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
