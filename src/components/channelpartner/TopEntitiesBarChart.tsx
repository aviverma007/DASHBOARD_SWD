import { ChartTooltip, useChartTooltip, tRow } from "../target/ChartTooltip";
import type { CpSummary } from "../../utils/cpLogic";

interface TopEntitiesBarChartProps {
  title: string;
  rows: CpSummary[];
  valueKey: "units" | "area" | "tsv";
  formatValue: (v: number) => string;
  barColor: string;
  onRowClick?: (cpIdx: number) => void;
}

const CARD_STYLE: React.CSSProperties = {
  background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)",
  padding: "16px 18px 14px", height: 420, display: "flex", flexDirection: "column",
  boxSizing: "border-box", minWidth: 0, width: "100%",
};

export function TopEntitiesBarChart({ title, rows, valueKey, formatValue, barColor, onRowClick }: TopEntitiesBarChartProps) {
  const { tooltip, showTooltip, moveTooltip, hideTooltip } = useChartTooltip();

  if (rows.length === 0) {
    return (
      <div style={CARD_STYLE}>
        <div style={{ fontWeight: 600, fontSize: 15, color: "#1a3752", marginBottom: 10 }}>{title}</div>
        <p style={{ color: "#9ca3af", fontSize: 13 }}>No data available.</p>
      </div>
    );
  }

  const maxVal = Math.max(...rows.map(r => r[valueKey]), 1);

  return (
    <div style={CARD_STYLE}>
      <div style={{ fontWeight: 600, fontSize: 15, color: "#1a3752", marginBottom: 12, flexShrink: 0 }}>{title}</div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
        {rows.map((r, i) => {
          const val = r[valueKey];
          const pct = (val / maxVal) * 100;
          return (
            <div
              key={r.cpIdx}
              onClick={() => onRowClick?.(r.cpIdx)}
              onMouseEnter={e => showTooltip(e, (
                <>
                  <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{r.name}</div>
                  {tRow("Units sold", r.units.toLocaleString("en-IN"))}
                  {tRow("Area", (r.area / 100000).toFixed(2) + " L sqft")}
                  {tRow("TSV", "₹" + (r.tsv / 1e7).toFixed(1) + " Cr")}
                  {r.cancelled > 0 && tRow("Cancelled", `${r.cancelled} (${r.rebooked} rebooked)`)}
                </>
              ))}
              onMouseMove={moveTooltip}
              onMouseLeave={hideTooltip}
              style={{ cursor: onRowClick ? "pointer" : "default" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: "#14213d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" }}>
                  {i + 1}. {r.name}
                </span>
                <span style={{ fontWeight: 700, color: barColor }}>{formatValue(val)}</span>
              </div>
              <div style={{ background: "#eceff1", borderRadius: 4, height: 9, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 4 }} />
              </div>
            </div>
          );
        })}
      </div>
      <ChartTooltip tooltip={tooltip} />
    </div>
  );
}
