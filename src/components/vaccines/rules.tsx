import { ageLabel, type CatalogRule } from "@/lib/vaccines/types";
import Link from "next/link";
export function CatalogRules({
  rules,
  editVersion,
}: {
  rules: CatalogRule[];
  editVersion?: string;
}) {
  return (
    <div className="record-list">
      {rules.map((r) => (
        <article key={r.dose_code}>
          <h3>
            {r.dose_code} · {r.vaccine_code}
          </h3>
          <p>Âge configuré : {ageLabel(r.age)}</p>
          <p>Âge de la source : {ageLabel(r.source_age)}</p>
          <p>
            {r.eligibility === "female"
              ? "Filles uniquement"
              : "Tous les enfants"}{" "}
            ·{" "}
            {r.automatic_scheduling
              ? "Référence de routine après approbation"
              : "Calcul désactivé — référence uniquement"}
          </p>
          {r.dose_code === "HBn" &&
            typeof r.source_row.condition === "string" && (
              <p>{r.source_row.condition}</p>
            )}
          {r.dose_code === "HB1" && (
            <p>
              À envisager avec le BCG dans les quatre premières semaines si le
              registre confirme que HBn a été omise. Si le statut est incertain,
              vérifier le registre.
            </p>
          )}
          <p className="fine">
            Diapositive {String(r.source_row.source_slide ?? "non précisée")} ·
            décision{" "}
            {String(r.source_row.decision_id ?? "transcription de la source")}
          </p>
          {editVersion && (
            <Link
              className="text-link"
              href={`/vaccines/${editVersion}?dose=${encodeURIComponent(r.dose_code)}`}
            >
              Modifier {r.dose_code}
            </Link>
          )}
          <details>
            <summary>Ligne originale conservée</summary>
            <pre className="source-json">
              {JSON.stringify(r.source_row, null, 2)}
            </pre>
          </details>
        </article>
      ))}
    </div>
  );
}
