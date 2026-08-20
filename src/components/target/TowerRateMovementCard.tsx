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

export function TowerRateMovementCard({ towers, onTowerClick }: TowerRateMovementProps) {
  const filtered = towers.filter(t => Object.keys(t.year_rates).length > 0);
  if (filtered.length === 0) {
    return (
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)", padding: "16px 18px" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#1a3752", marginBottom: 10 }}>TOWER WISE RATE MOVEMENT</div>
        <p style={{ color: "#9ca3af", fontSize: 13 }}>No booking-rate history available for this project's towers.</p>
      </div>
    );
  }

  const allYears = [...new Set(filtered.flatMap(t => Object.keys(t.year_rates)))].sort();
  const allRates = filtered.flatMap(t => Object.values(t.year_rates));
  const maxRate = Math.max(...allRates) * 1.1;
  const minRate = Math.min(...allRates) * 0.9;

  const avgByTower = filtered.map(t => {
    const vals = Object.values(t.year_rates);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });

  const BAR_W = 16, GROUP_GAP = 26, PAD = { l: 46, r: 16, t: 30, b: 30 };
  const groupW = allYears.length * (BAR_W + 3);
  const W = filtered.length * (groupW + GROUP_GAP) + PAD.l + PAD.r;
  const H = 190;
  const innerH = H - PAD.t - PAD.b;

  const barH = (v: number) => ((v - minRate) / (maxRate - minRate)) * innerH;
  const groupX = (i: number) => PAD.l + i * (groupW + GROUP_GAP);
  const avgY = (v: number) => PAD.t + innerH - ((v - minRate) / (maxRate - minRate)) * innerH;

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)", padding: "16px 18px 14px" }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: "#1a3752", marginBottom: 10 }}>TOWER WISE RATE MOVEMENT</div>
      <div style={{ overflowX: "auto" }}>
        <svg width={Math.max(W, 380)} height={H} style={{ display: "block" }}>
          {[0, 0.5, 1].map(t => {
            const yv = PAD.t + innerH * t;
            const v = maxRate - (maxRate - minRate) * t;
            return (
              <g key={t}>
                <line x1={PAD.l - 4} x2={W - PAD.r} y1={yv} y2={yv} stroke="#eceff1" strokeDasharray="3,3" />
                <text x={PAD.l - 8} y={yv + 3} fontSize="9" fill="#9ca3af" textAnchor="end">{Math.round(v).toLocaleString("en-IN")}</text>
              </g>
            );
          })}
          {/* Average dashed line connecting each tower's average rate */}
          <path
            d={filtered.map((_, i) => `${i === 0 ? "M" : "L"}${groupX(i) + groupW / 2} ${avgY(avgByTower[i])}`).join(" ")}
            fill="none" stroke="#22c55e" strokeWidth="1.8" strokeDasharray="5,3"
          />
          {filtered.map((_, i) => (
            <circle key={i} cx={groupX(i) + groupW / 2} cy={avgY(avgByTower[i])} r="3.5" fill="#22c55e" stroke="#fff" strokeWidth="1" />
          ))}

          {filtered.map((tw, ti) => (
            <g key={tw.name} onClick={() => onTowerClick?.(tw.name)} style={{ cursor: onTowerClick ? "pointer" : "default" }}>
              {allYears.map((yr, yi) => {
                const v = tw.year_rates[yr];
                if (!v) return null;
                const bx = groupX(ti) + yi * (BAR_W + 3);
                const bh = barH(v);
                const baseY = PAD.t + innerH;
                return (
                  <g key={yr}>
                    <rect x={bx} y={baseY - bh} width={BAR_W} height={bh} fill={YEAR_COLORS[yr] ?? "#94a3b8"} rx="2" />
                    <text x={bx + BAR_W / 2} y={baseY - bh - 4} fontSize="8" fill="#475569" textAnchor="middle">{v.toLocaleString("en-IN")}</text>
                  </g>
                );
              })}
              <text x={groupX(ti) + groupW / 2} y={H - 6} fontSize="10" fill="#6b7280" textAnchor="middle" fontWeight="600">{tw.name.length > 8 ? tw.name.slice(0, 6) : tw.name}</text>
            </g>
          ))}
        </svg>
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 10.5, marginTop: 6, flexWrap: "wrap" }}>
        <span><span style={{ display: "inline-block", width: 14, height: 2, background: "#22c55e", marginRight: 4, verticalAlign: "middle", borderTop: "2px dashed #22c55e" }} />Average</span>
        {allYears.map(yr => (
          <span key={yr}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: YEAR_COLORS[yr] ?? "#94a3b8", marginRight: 4 }} />{yr}</span>
        ))}
      </div>
    </div>
  );
}
