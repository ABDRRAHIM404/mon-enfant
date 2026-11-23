"use client";

import { Circle, Ruler, Weight } from "lucide-react";
import { useId, useState } from "react";
import { growthPoints, type GrowthObservation } from "@/lib/clinical/growth";

const metrics = [
  { field: "weight_kg", name: "Poids", unit: "kg", Icon: Weight },
  { field: "height_cm", name: "Taille", unit: "cm", Icon: Ruler },
  { field: "head_cm", name: "Périmètre crânien", unit: "cm", Icon: Circle },
] as const;
const formatValue = new Intl.NumberFormat("fr-MA", {
  maximumFractionDigits: 2,
});
const formatDate = new Intl.DateTimeFormat("fr-MA", {
  dateStyle: "medium",
  timeZone: "UTC",
});
const day = (date: string) => Date.parse(`${date}T00:00:00Z`);
const dateLabel = (date: string) => formatDate.format(day(date));

export function MeasurementChart({
  entries,
}: {
  entries: GrowthObservation[];
}) {
  const heading = useId();
  const [choice, setChoice] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const { field, name, unit } = metrics[choice];
  const values = growthPoints(entries, field);
  const first = values[0],
    last = values.at(-1);
  const start = first ? day(first.date) : 0,
    end = last ? day(last.date) : 0;
  const max = Math.max(1, ...values.map((point) => point.value));
  const order = 10 ** Math.floor(Math.log10(max / 4));
  const step =
    ([1, 2, 2.5, 5, 10].find((n) => n * order * 4 >= max) ?? 10) * order;
  const ceiling = step * 4;
  const points = values.map((p) => ({
    ...p,
    x: start === end ? 50 : 4 + ((day(p.date) - start) / (end - start)) * 92,
    y: 100 - (p.value / ceiling) * 100,
  }));
  const line = points.map(({ x, y }) => `${x},${y}`).join(" ");
  const active = preview ?? selected;
  const activePoint = active === null ? null : points[active];
  const pointText = (p: (typeof points)[number]) =>
    `${dateLabel(p.date)} · ${formatValue.format(p.value)} ${unit} · ${p.confirmed ? "Source contrôlée" : "Source non confirmée"}`;

  return (
    <section
      className="consultation-panel growth-chart-panel"
      aria-labelledby={heading}
    >
      <div
        className="growth-chart-controls"
        role="group"
        aria-label="Type de mesure"
      >
        {metrics.map(({ field, name, Icon }, index) => (
          <button
            key={field}
            type="button"
            aria-pressed={choice === index}
            onClick={() => {
              setChoice(index);
              setSelected(null);
              setPreview(null);
            }}
          >
            <Icon size={17} aria-hidden="true" /> {name}
          </button>
        ))}
      </div>
      <h2 id={heading}>
        {name} ({unit})
      </h2>
      {first && last ? (
        <figure className="growth-figure" key={field}>
          <div className="growth-graph">
            <div className="growth-axis-values" aria-hidden="true">
              {[4, 3, 2, 1, 0].map((n) => (
                <span key={n} style={{ top: `${(4 - n) * 25}%` }}>
                  {formatValue.format(n * step)}
                </span>
              ))}
            </div>
            <div className="growth-plot">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {[0, 25, 50, 75].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    x2="100"
                    y1={y}
                    y2={y}
                    vectorEffect="non-scaling-stroke"
                    className="growth-gridline"
                  />
                ))}
                {points.length > 1 && (
                  <>
                    <polygon
                      points={`${points[0].x},100 ${line} ${points.at(-1)!.x},100`}
                      className="growth-area"
                    />
                    <polyline
                      points={line}
                      className="growth-line"
                      vectorEffect="non-scaling-stroke"
                    />
                  </>
                )}
              </svg>
              {points.map((point, index) => (
                <button
                  key={`${point.date}-${index}`}
                  type="button"
                  className="growth-point"
                  data-verified={point.confirmed}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  aria-label={pointText(point)}
                  aria-pressed={selected === index}
                  onFocus={() => setPreview(index)}
                  onBlur={() => setPreview(null)}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") setPreview(index);
                  }}
                  onPointerLeave={() => setPreview(null)}
                  onClick={() => setSelected(selected === index ? null : index)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setSelected(null);
                      setPreview(null);
                    }
                  }}
                />
              ))}
            </div>
          </div>
          <div className="growth-axis-dates" aria-hidden="true">
            <time dateTime={first.date}>{dateLabel(first.date)}</time>
            {first.date !== last.date && (
              <time dateTime={last.date}>{dateLabel(last.date)}</time>
            )}
          </div>
          <figcaption className="growth-chart-caption" aria-live="polite">
            {activePoint
              ? pointText(activePoint)
              : "Sélectionnez un point pour voir sa valeur."}
          </figcaption>
        </figure>
      ) : (
        <p className="growth-chart-empty">
          Aucune mesure active à date exacte pour ce type.
        </p>
      )}
      <p className="growth-hint">
        Mesures brutes de cette page. Les dates estimées ou inconnues restent
        dans l’historique.
      </p>
    </section>
  );
}
