import {
  clinicianName,
  type ClinicalAttributions,
} from "@/lib/clinical/attribution";
import Link from "next/link";
import { CalendarDays, Eye, Pencil } from "lucide-react";
import { sourceLabels, type ClinicalEntry } from "@/lib/clinical/types";
import type { Patient } from "@/lib/registry/types";
import { addCalendarMonths, civilDay } from "@/lib/vaccines/calendar";

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
