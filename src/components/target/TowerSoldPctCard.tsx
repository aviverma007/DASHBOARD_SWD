import { ChartTooltip, useChartTooltip, tRow } from "./ChartTooltip";

interface TowerRow {
  name: string; sold: number; unsold: number; total: number; sold_pct: number; tsv: number; avg_rate: number;
}

const CARD_STYLE: React.CSSProperties = {
  background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)",
  padding: "16px 18px 14px", height: 420, display: "flex", flexDirection: "column",
  boxSizing: "border-box", minWidth: 0, width: "100%",
};

export function TowerSoldPctCard({ towers, projectTsv, projectSold, onTowerClick }: {
  towers: TowerRow[]; projectTsv: number; projectSold: number; onTowerClick?: (name: string) => void;
}) {
  const { tooltip, showTooltip, moveTooltip, hideTooltip } = useChartTooltip();
  const filtered = towers.filter(t => t.total > 0).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  if (filtered.length === 0) {
    return (
      <div style={CARD_STYLE}>
        <div style={{ fontWeight: 600, fontSize: 15, color: "#1a3752", marginBottom: 10, flexShrink: 0 }}>TOWER WISE SOLD % — UNITS &amp; TSV</div>
        <p style={{ color: "#9ca3af", fontSize: 13 }}>No tower data.</p>
      </div>
    );
  }

  const BAR_W = 28, PAIR_GAP = 5, GROUP_GAP = 34, PAD = { l: 46, r: 20, t: 40, b: 34 };
  const groupW = BAR_W * 2 + PAIR_GAP;
  const W = filtered.length * (groupW + GROUP_GAP) + PAD.l + PAD.r;
  const H = 280;
  const innerH = H - PAD.t - PAD.b;
  const baseY = PAD.t + innerH;

  function towerTooltip(tw: TowerRow, unitPct: number, tsvPct: number, e: React.MouseEvent) {
    const content = (
      <>
        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13.5 }}>{tw.name}</div>
        {tRow("Units sold", tw.sold.toLocaleString("en-IN"))}
        {tRow("Unit % Sold", `${unitPct}%`, "#22d3ee")}
        {tRow("TSV", `₹${tw.tsv} Cr`)}
        {tRow("TSV % Sold", `${tsvPct}%`, "#f97316")}
      </>
    );
    showTooltip(e, content);
  }

  return (
    <div style={CARD_STYLE}>
      <div style={{ fontWeight: 600, fontSize: 15, color: "#1a3752", marginBottom: 10, flexShrink: 0 }}>TOWER WISE SOLD % — UNITS &amp; TSV</div>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
          {[0, 25, 50, 75, 100].map(p => {
            const yv = baseY - (p / 100) * innerH;
            return (
              <g key={p}>
                <line x1={PAD.l - 6} x2={W - PAD.r} y1={yv} y2={yv} stroke="#e9e5db" strokeDasharray="3,4" />
                <text x={PAD.l - 12} y={yv + 4} fontSize="12" fill="#64748b" textAnchor="end">{p}%</text>
              </g>
            );
          })}
          {filtered.map((tw, i) => {
            const gx = PAD.l + i * (groupW + GROUP_GAP);
            const tsvPct = projectTsv > 0 ? Math.round((tw.tsv / projectTsv) * 100) : 0;
            const unitPct = projectSold > 0 ? Math.round((tw.sold / projectSold) * 100) : 0;
            const tsvH = (tsvPct / 100) * innerH;
            const unitH = (unitPct / 100) * innerH;
            return (
              <g
                key={tw.name}
                onClick={() => onTowerClick?.(tw.name)}
                onMouseEnter={e => towerTooltip(tw, unitPct, tsvPct, e)}
                onMouseMove={moveTooltip}
                onMouseLeave={hideTooltip}
                style={{ cursor: onTowerClick ? "pointer" : "default" }}
              >
                <rect x={gx - GROUP_GAP / 2} y={PAD.t} width={groupW + GROUP_GAP} height={innerH} fill="transparent" />
                <rect x={gx} y={baseY - unitH} width={BAR_W} height={unitH} fill="#0e7490" rx="3" />
                <text x={gx + BAR_W / 2} y={baseY - unitH - 7} fontSize="12" fill="#0e7490" fontWeight="700" textAnchor="middle">{unitPct}%</text>
                <rect x={gx + BAR_W + PAIR_GAP} y={baseY - tsvH} width={BAR_W} height={tsvH} fill="#f97316" rx="3" />
                <text x={gx + BAR_W + PAIR_GAP + BAR_W / 2} y={baseY - tsvH - 7} fontSize="12" fill="#f97316" fontWeight="700" textAnchor="middle">{tsvPct}%</text>
                <text x={gx + groupW / 2} y={H - 8} fontSize="13" fill="#374151" textAnchor="middle" fontWeight="700">{tw.name}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 12, marginTop: 8, flexShrink: 0, color: "#4a5568" }}>
        <span><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: "#0e7490", marginRight: 5, verticalAlign: "middle" }} />Unit % Sold (share of total)</span>
        <span><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: "#f97316", marginRight: 5, verticalAlign: "middle" }} />TSV % Sold (share of total)</span>
      </div>
      <ChartTooltip tooltip={tooltip} />
    </div>
  );
}
