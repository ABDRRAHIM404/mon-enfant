import { View } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { Card, Copy, Title } from "./ui";
import { useTheme } from "./theme";
import {
  clinicalLabels,
  clinicalFieldLabels,
  clinicalValueLabels,
  sourceLabels,
  growthPoints,
  type ClinicalEntry,
} from "../lib/domain";
export function Entry({ entry }: { entry: ClinicalEntry }) {
  return (
    <Card>
      <Title small>
        {clinicalLabels[entry.kind]}
        {entry.entry_state === "withdrawn" ? " — retirée" : ""}
      </Title>
      <Copy muted>
        {entry.occurred_on || "Date inconnue"}
        {entry.occurrence_precision === "estimated" ? " (estimée)" : ""} ·{" "}
        {sourceLabels[entry.source_type]} ·{" "}
        {entry.source_verified ? "Source contrôlée" : "Source non confirmée"}
      </Copy>
      {Object.entries(entry.payload)
        .filter(([, v]) => v !== "")
        .map(([key, value]) => (
          <View key={key} style={{ gap: 4 }}>
            <Copy muted small>
              {clinicalFieldLabels[key] || key}
            </Copy>
            <Copy>
              {typeof value === "string" &&
              [
                "category",
                "severity",
                "matching_status",
                "lot_status",
                "site_status",
                "provider_status",
                "administration_facility_status",
              ].includes(key)
                ? clinicalValueLabels[value] || value
                : String(value)}
            </Copy>
          </View>
        ))}
      {entry.vaccine_mapping && (
        <Copy small muted>
          Référence conservée : {entry.vaccine_mapping.dose_code} ·{" "}
          {entry.vaccine_mapping.version_label} ·{" "}
          {entry.vaccine_mapping.version_id}
        </Copy>
      )}
      {entry.duplicate_review && (
        <Copy>Doublon potentiel relu : {entry.duplicate_review.reason}</Copy>
      )}
      <Copy small muted>
        Saisi par {entry.professional_id} · {entry.facility_name} ·{" "}
        {entry.recorded_at} · version {entry.revision}
      </Copy>
      {entry.source_reference && (
        <Copy small>Référence : {entry.source_reference}</Copy>
      )}
      {entry.amendment_reason && (
        <Copy>Motif de correction ou retrait : {entry.amendment_reason}</Copy>
      )}
    </Card>
  );
}
export function Growth({
  entries,
  field,
  label,
  unit,
}: {
  entries: ClinicalEntry[];
  field: string;
  label: string;
  unit: string;
}) {
  const { colors } = useTheme(),
    points = growthPoints(entries, field);
  if (!points.length)
    return (
      <Card>
        <Title small>{label}</Title>
        <Copy muted>Aucune mesure active à date exacte sur cette page.</Copy>
      </Card>
    );
  const times = points.map((p) => Date.parse(p.date + "T00:00:00Z")),
    min = times[0],
    max = times.at(-1)!,
    ceiling = Math.max(...points.map((p) => p.value)) * 1.1 || 1;
  return (
    <Card>
      <Title small>
        {label} ({unit})
      </Title>
      <Svg
        width="100%"
        height={180}
        viewBox="0 0 360 180"
        accessible
        accessibilityLabel={
          label +
          ", valeurs brutes enregistrées à date exacte. Chaque valeur et sa provenance est indiquée ci-dessous."
        }
      >
        <Line x1={35} y1={15} x2={35} y2={140} stroke={colors.muted} />
        <Line x1={35} y1={140} x2={345} y2={140} stroke={colors.muted} />
        <SvgText x={0} y={20} fontSize={11} fill={colors.ink}>
          {ceiling.toFixed(1)}
        </SvgText>
        {points.map((p, i) => (
          <Circle
            key={p.date + i}
            cx={max === min ? 190 : 35 + ((times[i] - min) / (max - min)) * 300}
            cy={140 - (p.value / ceiling) * 120}
            r={5}
            fill={p.confirmed ? colors.teal : "#ad7325"}
          />
        ))}
        <SvgText x={35} y={165} fontSize={11} fill={colors.ink}>
          {points[0].date}
        </SvgText>
        <SvgText
          x={345}
          y={165}
          textAnchor="end"
          fontSize={11}
          fill={colors.ink}
        >
          {points.at(-1)!.date}
        </SvgText>
      </Svg>
      <Copy small muted>
        Valeurs brutes uniquement, sans percentile ni seuil diagnostique. Les
        dates inconnues ou estimées restent dans l’historique.
      </Copy>
      {points.map((p, i) => (
        <Copy small key={p.date + i}>
          {p.date} · {p.value} {unit} ·{" "}
          {p.confirmed ? "Source contrôlée" : "Source non confirmée"}
        </Copy>
      ))}
    </Card>
  );
}
