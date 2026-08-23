import { ChartTooltip, useChartTooltip, tRow } from "../target/ChartTooltip";

export interface FunnelStage { stage: string; count: number }

interface FunnelChartProps {
  title: string;
  stages: FunnelStage[];
  dropOff?: { label: string; count: number };
  colors?: string[];
  onStageClick?: (stage: string) => void;
}

const DEFAULT_COLORS = ["#1E3163", "#2A4488", "#3c6db0", "#0e7490", "#1a7a4a", "#B8893C"];

const CARD_STYLE: React.CSSProperties = {
  background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)",
  padding: "18px 20px 16px", boxSizing: "border-box", width: "100%",
};

export function FunnelChart({ title, stages, dropOff, colors = DEFAULT_COLORS, onStageClick }: FunnelChartProps) {
  const { tooltip, showTooltip, moveTooltip, hideTooltip } = useChartTooltip();
  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div style={CARD_STYLE}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#1a3752", marginBottom: 16 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {stages.map((s, i) => {
          const widthPct = (s.count / maxCount) * 100;
          const prevCount = i > 0 ? stages[i - 1].count : s.count;
          const stepPct = i > 0 && prevCount > 0 ? Math.round((s.count / prevCount) * 100) : 100;
          const overallPct = stages[0].count > 0 ? Math.round((s.count / stages[0].count) * 100) : 0;
          const color = colors[i % colors.length];
          return (
            <div key={s.stage}>
              {i > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "4px 0", fontSize: 11.5, color: "#9ca3af" }}>
                  <span style={{ borderLeft: "1px dashed #cbd5e1", height: 14 }} />
                  <span>
                    <strong style={{ color: stepPct >= 50 ? "#1a7a4a" : "#c0392b" }}>{stepPct}%</strong> moved from {stages[i - 1].stage}
                  </span>
                </div>
              )}
              <div
                onClick={() => onStageClick?.(s.stage)}
                onMouseEnter={e => showTooltip(e, (
                  <>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{s.stage}</div>
                    {tRow("Count", s.count.toLocaleString("en-IN"))}
                    {tRow("% of total", `${overallPct}%`)}
                    {i > 0 && tRow(`% from ${stages[i - 1].stage}`, `${stepPct}%`)}
                  </>
                ))}
                onMouseMove={moveTooltip}
                onMouseLeave={hideTooltip}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  cursor: onStageClick ? "pointer" : "default",
                }}
              >
                <div style={{ width: 150, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: "#334155", textAlign: "right" }}>
                  {s.stage}
                </div>
                <div style={{ flex: 1, position: "relative" }}>
                  <div style={{
                    width: `${Math.max(widthPct, 3)}%`, minWidth: 2, height: 38,
                    background: color, borderRadius: 6,
                    display: "flex", alignItems: "center", paddingLeft: 12,
                    transition: "width 0.3s",
                  }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap" }}>
                      {s.count.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
                <div style={{ width: 50, flexShrink: 0, fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
                  {overallPct}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {dropOff && dropOff.count > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f0ede6", display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
          <span style={{ color: "#c0392b", fontWeight: 600 }}>{dropOff.label}</span>
          <span style={{ color: "#c0392b", fontWeight: 700 }}>{dropOff.count.toLocaleString("en-IN")}</span>
        </div>
      )}
      <ChartTooltip tooltip={tooltip} />
    </div>
  );
}
