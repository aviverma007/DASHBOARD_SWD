import { ChartTooltip, useChartTooltip, tRow } from "./ChartTooltip";

interface TowerYearRate {
  name: string;
  year_rates: Record<string, number>;
}

interface TowerRateMovementProps {
  towers: TowerYearRate[];
  onTowerClick?: (towerName: string) => void;
}

const YEAR_COLORS: Record<string, string> = {
  "2023": "#93c5fd",
  "2024": "#38bdf8",
  "2025": "#0ea5e9",
  "2026": "#0c4a6e",
  "2027": "#082f49",
};

const CARD_STYLE: React.CSSProperties = {
  background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)",
  padding: "16px 18px 14px", height: 420, display: "flex", flexDirection: "column",
  boxSizing: "border-box", minWidth: 0, width: "100%",
};

export function TowerRateMovementCard({ towers, onTowerClick }: TowerRateMovementProps) {
  const { tooltip, showTooltip, moveTooltip, hideTooltip } = useChartTooltip();
  const filtered = towers.filter(t => Object.keys(t.year_rates).length > 0);

  if (filtered.length === 0) {
    return (
      <div style={CARD_STYLE}>
        <div style={{ fontWeight: 600, fontSize: 15, color: "#1a3752", marginBottom: 10, flexShrink: 0 }}>TOWER WISE RATE MOVEMENT</div>
        <p style={{ color: "#9ca3af", fontSize: 13 }}>No booking-rate history available for this project's towers.</p>
      </div>
    );
  }

  const allYears = [...new Set(filtered.flatMap(t => Object.keys(t.year_rates)))].sort();
  const allRates = filtered.flatMap(t => Object.values(t.year_rates));
  const maxRate = Math.max(...allRates) * 1.15;
  const minRate = Math.min(...allRates) * 0.9;

  const avgByTower = filtered.map(t => {
    const vals = Object.values(t.year_rates);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });

  // Wider bars, tighter within-group gap, generous group gap and top padding for labels
  const BAR_W = 24, BAR_GAP = 2, GROUP_GAP = 34, PAD = { l: 58, r: 20, t: 40, b: 34 };
  const groupW = allYears.length * (BAR_W + BAR_GAP) - BAR_GAP;
  const W = filtered.length * (groupW + GROUP_GAP) + PAD.l + PAD.r;
  const H = 280;
  const innerH = H - PAD.t - PAD.b;

  const barH = (v: number) => ((v - minRate) / (maxRate - minRate)) * innerH;
  const groupX = (i: number) => PAD.l + i * (groupW + GROUP_GAP);
  const avgY = (v: number) => PAD.t + innerH - ((v - minRate) / (maxRate - minRate)) * innerH;
  const baseY = PAD.t + innerH;

  function towerTooltip(tw: TowerYearRate, avg: number, e: React.MouseEvent) {
    const content = (
      <>
        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13.5 }}>{tw.name}</div>
        {allYears.filter(y => tw.year_rates[y]).map(y => tRow(y, `₹${tw.year_rates[y].toLocaleString("en-IN")}`, YEAR_COLORS[y]))}
        <div style={{ borderTop: "1px solid rgba(255,255,255,.2)", marginTop: 4, paddingTop: 4 }}>
          {tRow("Average", `₹${Math.round(avg).toLocaleString("en-IN")}`, "#22c55e")}
        </div>
      </>
    );
    showTooltip(e, content);
  }

  return (
    <div style={CARD_STYLE}>
      <div style={{ fontWeight: 600, fontSize: 15, color: "#1a3752", marginBottom: 10, flexShrink: 0 }}>TOWER WISE RATE MOVEMENT</div>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
          {[0, 0.25, 0.5, 0.75, 1].map(t => {
            const yv = PAD.t + innerH * t;
            const v = maxRate - (maxRate - minRate) * t;
            return (
              <g key={t}>
                <line x1={PAD.l - 6} x2={W - PAD.r} y1={yv} y2={yv} stroke="#e9e5db" strokeDasharray="3,4" />
                <text x={PAD.l - 12} y={yv + 4} fontSize="12" fill="#64748b" textAnchor="end">₹{Math.round(v).toLocaleString("en-IN")}</text>
              </g>
            );
          })}

          {/* Average dashed line */}
          <path
            d={filtered.map((_, i) => `${i === 0 ? "M" : "L"}${groupX(i) + groupW / 2} ${avgY(avgByTower[i])}`).join(" ")}
            fill="none" stroke="#22c55e" strokeWidth="2.2" strokeDasharray="6,4"
          />

          {filtered.map((tw, ti) => (
            <g
              key={tw.name}
              onClick={() => onTowerClick?.(tw.name)}
              onMouseEnter={e => towerTooltip(tw, avgByTower[ti], e)}
              onMouseMove={moveTooltip}
              onMouseLeave={hideTooltip}
              style={{ cursor: onTowerClick ? "pointer" : "default" }}
            >
              {/* Invisible wider hit-zone spanning the whole group */}
              <rect x={groupX(ti) - GROUP_GAP / 2} y={PAD.t} width={groupW + GROUP_GAP} height={innerH} fill="transparent" />
              {allYears.map((yr, yi) => {
                const v = tw.year_rates[yr];
                if (!v) return null;
                const bx = groupX(ti) + yi * (BAR_W + BAR_GAP);
                const bh = barH(v);
                return (
                  <g key={yr}>
                    <rect x={bx} y={baseY - bh} width={BAR_W} height={bh} fill={YEAR_COLORS[yr] ?? "#94a3b8"} rx="3" />
                    <text x={bx + BAR_W / 2} y={baseY - bh - 7} fontSize="11" fontWeight="600" fill="#374151" textAnchor="middle">
                      {v.toLocaleString("en-IN")}
                    </text>
                  </g>
                );
              })}
              <circle cx={groupX(ti) + groupW / 2} cy={avgY(avgByTower[ti])} r="5" fill="#22c55e" stroke="#fff" strokeWidth="2" />
              <text x={groupX(ti) + groupW / 2} y={H - 8} fontSize="13" fill="#374151" textAnchor="middle" fontWeight="700">
                {tw.name}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 12, marginTop: 8, flexWrap: "wrap", flexShrink: 0, color: "#4a5568" }}>
        <span><span style={{ display: "inline-block", width: 16, height: 3, background: "#22c55e", marginRight: 5, verticalAlign: "middle", borderTop: "2px dashed #22c55e" }} />Average</span>
        {allYears.map(yr => (
          <span key={yr}><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: YEAR_COLORS[yr] ?? "#94a3b8", marginRight: 5, verticalAlign: "middle" }} />{yr}</span>
        ))}
      </div>
      <ChartTooltip tooltip={tooltip} />
    </div>
  );
}
