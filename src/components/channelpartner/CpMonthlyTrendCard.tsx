import { useState } from "react";
import { ChartTooltip, useChartTooltip, tRow } from "../target/ChartTooltip";

interface TrendPoint { key: string; label: string; units: number; area: number; tsv: number }
type Metric = "units" | "area" | "tsv";

const CARD_STYLE: React.CSSProperties = {
  background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)",
  padding: "16px 18px 14px", height: 420, display: "flex", flexDirection: "column",
  boxSizing: "border-box", minWidth: 0, width: "100%",
};

const METRIC_META: Record<Metric, { label: string; color: string; fmt: (v: number) => string }> = {
  units: { label: "Units", color: "#0e7490", fmt: v => Math.round(v).toString() },
  area: { label: "Area (L sqft)", color: "#B8893C", fmt: v => v.toFixed(2) },
  tsv: { label: "TSV (₹ Cr)", color: "#7b1414", fmt: v => v.toFixed(1) },
};

export function CpMonthlyTrendCard({ data, title = "MONTHLY TREND — CHANNEL PARTNER SALES" }: { data: TrendPoint[]; title?: string }) {
  const [metric, setMetric] = useState<Metric>("units");
  const { tooltip, showTooltip, moveTooltip, hideTooltip } = useChartTooltip();
  const meta = METRIC_META[metric];

  if (data.length === 0) {
    return (
      <div style={CARD_STYLE}>
        <div style={{ fontWeight: 600, fontSize: 15, color: "#1a3752" }}>{title}</div>
        <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 10 }}>No booking history available.</p>
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d[metric]), 1);
  const BAR_W = 16, GAP = 6, PAD = { l: 46, r: 16, t: 16, b: 58 };
  const W = data.length * (BAR_W + GAP) + PAD.l + PAD.r;
  const H = 300;
  const innerH = H - PAD.t - PAD.b;
  const baseY = PAD.t + innerH;

  return (
    <div style={CARD_STYLE}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexShrink: 0, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: "#1a3752" }}>{title}</div>
        <div style={{ display: "inline-flex", background: "#f4f2ed", borderRadius: 999, padding: 3 }}>
          {(["units", "area", "tsv"] as Metric[]).map(m => (
            <button key={m} onClick={() => setMetric(m)}
              style={{
                border: "none", background: metric === m ? "#1E3163" : "transparent",
                color: metric === m ? "#fff" : "#4a5568", fontWeight: 700, fontSize: 11.5,
                padding: "5px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
              }}>
              {METRIC_META[m].label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
          {[0, 0.5, 1].map(t => {
            const yv = PAD.t + innerH * (1 - t);
            return (
              <g key={t}>
                <line x1={PAD.l - 6} x2={W - PAD.r} y1={yv} y2={yv} stroke="#e9e5db" strokeDasharray="3,4" />
                <text x={PAD.l - 12} y={yv + 4} fontSize="11" fill="#64748b" textAnchor="end">{meta.fmt(maxVal * t)}</text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const val = d[metric];
            const bh = (val / maxVal) * innerH;
            const bx = PAD.l + i * (BAR_W + GAP);
            return (
              <g key={d.key}
                onMouseEnter={e => showTooltip(e, (
                  <>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.label}</div>
                    {tRow("Units", d.units.toLocaleString("en-IN"))}
                    {tRow("Area", d.area.toFixed(2) + " L sqft")}
                    {tRow("TSV", "₹" + d.tsv.toFixed(1) + " Cr")}
                  </>
                ))}
                onMouseMove={moveTooltip}
                onMouseLeave={hideTooltip}
              >
                <rect x={bx} y={baseY - bh} width={BAR_W} height={Math.max(bh, val > 0 ? 2 : 0)} fill={meta.color} rx="2" />
                <text
                  x={bx + BAR_W / 2}
                  y={baseY + 12}
                  fontSize="9.5"
                  fill="#6b7280"
                  textAnchor="end"
                  transform={`rotate(-55 ${bx + BAR_W / 2} ${baseY + 12})`}
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <ChartTooltip tooltip={tooltip} />
    </div>
  );
}
