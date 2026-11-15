import { growthPoints, type GrowthObservation } from "@/lib/clinical/growth";
export function GrowthChart({
  entries,
  field,
  label,
  unit,
}: {
  entries: GrowthObservation[];
  field: string;
  label: string;
  unit: string;
}) {
  const points = growthPoints(entries, field);
  if (!points.length)
    return (
      <section className="panel">
        <h2>{label}</h2>
        <p className="muted">
          Aucune mesure active à date exacte sur cette page.
        </p>
      </section>
    );
  const times = points.map((p) => Date.parse(`${p.date}T00:00:00Z`));
  const min = times[0],
    max = times[times.length - 1];
  const ceiling = Math.max(...points.map((p) => p.value)) * 1.1;
  return (
    <section className="panel">
      <h2>
        {label} ({unit})
      </h2>
      <svg
        viewBox="0 0 520 200"
        role="img"
        aria-labelledby={`chart-${field}`}
        className="growth-chart"
      >
        <title id={`chart-${field}`}>
          {`${label}, valeurs enregistrées à date exacte sur cette page. Le tableau donne chaque valeur et sa provenance.`}
        </title>
        <line x1="44" y1="20" x2="44" y2="165" stroke="currentColor" />
        <line x1="44" y1="165" x2="500" y2="165" stroke="currentColor" />
        <text x="4" y="24" fontSize="11">
          {ceiling.toFixed(1)}
        </text>
        <text x="20" y="165" fontSize="11">
          0
        </text>
        {points.map((p, i) => (
          <circle
            key={`${p.date}-${i}`}
            cx={max === min ? 270 : 44 + ((times[i] - min) / (max - min)) * 450}
            cy={165 - (p.value / ceiling) * 145}
            r={5}
            fill={p.confirmed ? "#126b5c" : "#b47b2f"}
          >
            <title>
              {`${p.date} : ${p.value} ${unit}, ${p.confirmed ? "source contrôlée" : "source non confirmée"}`}
            </title>
          </circle>
        ))}
        <text x="44" y="190" fontSize="11">
          {points[0].date}
        </text>
        <text x="500" y="190" textAnchor="end" fontSize="11">
          {points[points.length - 1].date}
        </text>
      </svg>
      <p className="fine">
        Valeurs brutes uniquement ; aucun percentile ni seuil diagnostique. Les
        dates inconnues/estimées figurent dans l’historique.
      </p>
    </section>
  );
}
