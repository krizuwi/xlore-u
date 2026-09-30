import { useId } from "react";
import "./CollectionChart.css";

const WIDTH = 720;
const HEIGHT = 220;
const TOP = 12;
const BOTTOM = 190;
const LEFT = 40;
const RIGHT = 704;

export function CollectionChart({ data = [], variant = "line" }) {
  const id = useId();
  const maxRecords = Math.max(5, Math.ceil(Math.max(0, ...data.map((entry) => entry.records)) / 5) * 5);
  const isBar = variant === "bar";
  const points = data.map((entry, index) => ({
    ...entry,
    x: isBar ? LEFT + ((index + 0.5) / data.length) * (RIGHT - LEFT) : data.length > 1 ? LEFT + (index / (data.length - 1)) * (RIGHT - LEFT) : (LEFT + RIGHT) / 2,
    y: BOTTOM - (Math.max(entry.records, 0) / maxRecords) * (BOTTOM - TOP)
  }));
  const line = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const middle = (previous.x + point.x) / 2;
    return `${path} C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
  }, "");
  const area = points.length ? `${line} L ${points.at(-1).x} ${BOTTOM} L ${points[0].x} ${BOTTOM} Z` : "";
  const labelInterval = data.length > 8 ? 2 : 1;

  return (
    <div className="admin-chart">
      <svg
        className="admin-chart-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby={`${id}-title ${id}-description`}
      >
        <title id={`${id}-title`}>{isBar ? "Catalog records by type" : "Records collected over time"}</title>
        <desc id={`${id}-description`}>
          {data.length
            ? `Records by ${isBar ? "type" : "period"}: ${data.map(({ label, records }) => `${label}: ${records}`).join("; ")}. The vertical scale runs from 0 to ${maxRecords} records.`
            : "No collection data is available for this period."}
        </desc>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--admin-accent, #2563eb)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--admin-accent, #2563eb)" stopOpacity="0.015" />
          </linearGradient>
        </defs>
        {Array.from({ length: 6 }, (_, index) => maxRecords * (5 - index) / 5).map((tick) => {
          const y = BOTTOM - (tick / maxRecords) * (BOTTOM - TOP);
          return (
            <g key={tick} aria-hidden="true">
              <line className="admin-chart-grid" x1={LEFT} y1={y} x2={RIGHT} y2={y} />
              <text className="admin-chart-tick" x={LEFT - 12} y={y + 4} textAnchor="end">{tick}</text>
            </g>
          );
        })}
        {!isBar && area && <path d={area} fill={`url(#${id}-fill)`} />}
        {!isBar && line && <path className="admin-chart-line" d={line} />}
        {points.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            {isBar && <>
              <rect x={point.x - 40} y={point.y} width="80" height={BOTTOM - point.y} rx="4" fill="var(--admin-accent, #2563eb)"><title>{point.label}: {point.records.toLocaleString()} records</title></rect>
              <text className="admin-chart-tick" x={point.x} y={point.y - 5} textAnchor="middle">{point.records.toLocaleString()}</text>
            </>}
            <circle className="admin-chart-point" cx={point.x} cy={point.y} r="3.5">
              <title>{point.label}: {point.records.toLocaleString()} records</title>
            </circle>
            {(index % labelInterval === 0 || index === points.length - 1) && (
              <text
                className="admin-chart-tick admin-chart-label"
                x={point.x}
                y={HEIGHT - 8}
                textAnchor={isBar ? "middle" : index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
                aria-hidden="true"
              >
                {point.label}
              </text>
            )}
          </g>
        ))}
        {!points.length && <text className="admin-chart-empty" x="372" y="104" textAnchor="middle">No collection data yet</text>}
      </svg>
    </div>
  );
}

export default CollectionChart;
