interface TowerRow {
  name: string; sold: number; unsold: number; total: number; sold_pct: number; tsv: number; avg_rate: number;
}

const CARD_STYLE: React.CSSProperties = {
  background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)",
  padding: "16px 18px 14px", height: 400, display: "flex", flexDirection: "column",
  boxSizing: "border-box", minWidth: 0, width: "100%",
};

export function TowerSoldPctCard({ towers, projectTsv, projectSold, onTowerClick }: {
  towers: TowerRow[]; projectTsv: number; projectSold: number; onTowerClick?: (name: string) => void;
}) {
  const filtered = towers.filter(t => t.total > 0).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (filtered.length === 0) {
    return (
      <div style={CARD_STYLE}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#1a3752", marginBottom: 10, flexShrink: 0 }}>TOWER WISE SOLD % — UNITS &amp; TSV</div>
        <p style={{ color: "#9ca3af", fontSize: 13 }}>No tower data.</p>
      </div>
    );
  }

  const BAR_W = 22, PAIR_GAP = 4, GROUP_GAP = 22, PAD = { l: 30, r: 16, t: 30, b: 30 };
  const groupW = BAR_W * 2 + PAIR_GAP;
  const W = filtered.length * (groupW + GROUP_GAP) + PAD.l + PAD.r;
  const H = 220;
  const innerH = H - PAD.t - PAD.b;
  const baseY = PAD.t + innerH;

  return (
    <div style={CARD_STYLE}>
      <div style={{ fontWeight: 700, fontSize: 13, color: "#1a3752", marginBottom: 10, flexShrink: 0 }}>TOWER WISE SOLD % — UNITS &amp; TSV</div>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
          {[0, 25, 50, 75, 100].map(p => {
            const yv = baseY - (p / 100) * innerH;
            return <g key={p}><line x1={PAD.l - 4} x2={W - PAD.r} y1={yv} y2={yv} stroke="#eceff1" strokeDasharray="3,3" /><text x={PAD.l - 8} y={yv + 3} fontSize="9" fill="#9ca3af" textAnchor="end">{p}%</text></g>;
          })}
          {filtered.map((tw, i) => {
            const gx = PAD.l + i * (groupW + GROUP_GAP);
            const tsvPct = projectTsv > 0 ? Math.round((tw.tsv / projectTsv) * 100) : 0;
            // Unit % Sold = this tower's share of TOTAL project units sold —
            // same "contribution" basis as TSV %, not this tower's own
            // absorption rate (sold/tower-total), so the two bars are
            // directly comparable side by side.
            const unitPct = projectSold > 0 ? Math.round((tw.sold / projectSold) * 100) : 0;
            const tsvH = (tsvPct / 100) * innerH;
            const unitH = (unitPct / 100) * innerH;
            return (
              <g key={tw.name} onClick={() => onTowerClick?.(tw.name)} style={{ cursor: onTowerClick ? "pointer" : "default" }}>
                <rect x={gx} y={baseY - unitH} width={BAR_W} height={unitH} fill="#0e7490" rx="2">
                  <title>{tw.name}: {tw.sold} units sold ({unitPct}% of total project sales)</title>
                </rect>
                <text x={gx + BAR_W / 2} y={baseY - unitH - 4} fontSize="9" fill="#0e7490" fontWeight="700" textAnchor="middle">{unitPct}%</text>
                <rect x={gx + BAR_W + PAIR_GAP} y={baseY - tsvH} width={BAR_W} height={tsvH} fill="#f97316" rx="2">
                  <title>{tw.name}: ₹{tw.tsv} Cr TSV ({tsvPct}% of total project TSV)</title>
                </rect>
                <text x={gx + BAR_W + PAIR_GAP + BAR_W / 2} y={baseY - tsvH - 4} fontSize="9" fill="#f97316" fontWeight="700" textAnchor="middle">{tsvPct}%</text>
                <text x={gx + groupW / 2} y={H - 6} fontSize="10" fill="#6b7280" textAnchor="middle" fontWeight="600">{tw.name}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 10.5, marginTop: 6, flexShrink: 0 }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#0e7490", marginRight: 4 }} />Unit % Sold (share of total)</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#f97316", marginRight: 4 }} />TSV % Sold (share of total)</span>
      </div>
    </div>
  );
}
