import Link from "next/link";
import {
  clinicalLabels,
  clinicalFieldLabels,
  clinicalValueLabels,
  sourceLabels,
  type ClinicalEntry,
} from "@/lib/clinical/types";
export function EntryCard({
  entry,
  link = true,
}: {
  entry: ClinicalEntry;
  link?: boolean;
}) {
  return (
    <article className="panel clinical-entry">
      <h3>
        {clinicalLabels[entry.kind]}
        {entry.entry_state === "withdrawn" ? " — retirée" : ""}
      </h3>
      <p className="fine">
        {entry.occurred_on || "Date inconnue"}
        {entry.occurrence_precision === "estimated" ? " (estimée)" : ""} ·{" "}
        {sourceLabels[entry.source_type]} ·{" "}
        {entry.source_verified ? "Source contrôlée" : "Source non confirmée"}
      </p>
      <dl className="details">
        {Object.entries(entry.payload)
          .filter(([, value]) => value !== "")
          .map(([key, value]) => (
            <div key={key}>
              <dt>{clinicalFieldLabels[key] || key}</dt>
              <dd className="clinical-text">
                {typeof value === "string" &&
                ["category", "severity"].includes(key)
                  ? clinicalValueLabels[value] || value
                  : value}
              </dd>
            </div>
          ))}
      </dl>
      <p className="fine">
        Saisi par {entry.professional_id} · {entry.facility_name} · le{" "}
        {entry.recorded_at} · version {entry.revision}
      </p>
      {entry.source_reference && (
        <p className="fine">Référence : {entry.source_reference}</p>
      )}
      {entry.amendment_reason && (
        <p>Motif de correction / retrait : {entry.amendment_reason}</p>
      )}
      {link && (
        <Link
          className="text-link"
          href={`/patients/${entry.child_id}/records/${entry.root_id}`}
        >
          Historique et correction
        </Link>
      )}
    </article>
  );
}
