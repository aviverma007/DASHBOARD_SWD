import { ChartTooltip, useChartTooltip, tRow } from "../target/ChartTooltip";
import type { BreakdownRow } from "../../utils/leadLogic";

interface BreakdownBarChartProps {
  title: string;
  rows: BreakdownRow[];
  barColor?: string;
  onRowClick?: (key: string) => void;
  height?: number;
}

const CARD_STYLE_BASE: React.CSSProperties = {
  background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)",
  padding: "16px 18px 14px", display: "flex", flexDirection: "column",
  boxSizing: "border-box", minWidth: 0, width: "100%",
};

export function BreakdownBarChart({ title, rows, barColor = "#0e7490", onRowClick, height = 360 }: BreakdownBarChartProps) {
  const { tooltip, showTooltip, moveTooltip, hideTooltip } = useChartTooltip();

  if (rows.length === 0) {
    return (
      <div style={{ ...CARD_STYLE_BASE, height }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#1a3752", marginBottom: 10 }}>{title}</div>
        <p style={{ color: "#9ca3af", fontSize: 13 }}>No data available.</p>
      </div>
    );
  }

  const maxCount = Math.max(...rows.map(r => r.count), 1);

  return (
    <div style={{ ...CARD_STYLE_BASE, height }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#1a3752", marginBottom: 12, flexShrink: 0 }}>{title}</div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 9, paddingRight: 4 }}>
        {rows.map(r => {
          const pct = (r.count / maxCount) * 100;
          return (
            <div
              key={r.key}
              onClick={() => onRowClick?.(r.key)}
              onMouseEnter={e => showTooltip(e, (
                <>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.key}</div>
                  {tRow("Count", r.count.toLocaleString("en-IN"))}
                  {tRow("Share", `${r.pct}%`)}
                </>
              ))}
              onMouseMove={moveTooltip}
              onMouseLeave={hideTooltip}
              style={{ cursor: onRowClick ? "pointer" : "default" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: "#14213d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "68%" }}>
                  {r.key}
                </span>
                <span style={{ fontWeight: 700, color: barColor }}>{r.count.toLocaleString("en-IN")} <span style={{ color: "#9ca3af", fontWeight: 500 }}>({r.pct}%)</span></span>
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
