import { ChartTooltip, useChartTooltip, tRow } from "./ChartTooltip";
import { useContainerWidth } from "./useContainerWidth";

interface TowerRow {
  name: string; sold: number; unsold: number; total: number; sold_pct: number; tsv: number; avg_rate: number;
}

const CARD_STYLE: React.CSSProperties = {
  background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)",
  padding: "16px 18px 14px", height: 420, display: "flex", flexDirection: "column",
  boxSizing: "border-box", minWidth: 0, width: "100%",
};

export function TowerSoldPctCard({ towers, projectTsv, projectSold, onTowerClick, title }: {
  towers: TowerRow[]; projectTsv: number; projectSold: number; onTowerClick?: (name: string) => void; title?: string;
}) {
  const { tooltip, showTooltip, moveTooltip, hideTooltip } = useChartTooltip();
  const { ref: boxRef, width } = useContainerWidth<HTMLDivElement>();
  const filtered = towers.filter(t => t.total > 0).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  if (filtered.length === 0) {
    return (
      <div style={CARD_STYLE}>
        <div style={{ fontWeight: 600, fontSize: 15, color: "#1a3752", marginBottom: 10, flexShrink: 0 }}>{title ?? "TOWER WISE SOLD % — UNITS & TSV"}</div>
        <p style={{ color: "#9ca3af", fontSize: 13 }}>No tower data.</p>
      </div>
    );
  }

  const BAR_W = 28, PAIR_GAP = 5, PAD = { l: 46, r: 20, t: 40, b: 34 };
  const groupW = BAR_W * 2 + PAIR_GAP;
  // Fill-the-card layout: measure the card and distribute tower groups
  // across its full width. Spacing is clamped — many towers never
  // squeeze below MIN_SPAN (the chart widens and scrolls instead), and
  // one or two towers never stretch beyond MAX_SPAN (the group block
  // centres, with axis + gridlines still spanning the whole card).
  const MIN_SPAN = groupW + 26, MAX_SPAN = groupW + 120, FALLBACK_W = 680;
  const n = filtered.length;
  const cardW = width || FALLBACK_W;
  const avail = cardW - PAD.l - PAD.r;
  const span = Math.max(MIN_SPAN, Math.min(MAX_SPAN, avail / n));
  const W = Math.max(cardW, n * span + PAD.l + PAD.r);
  const startX = PAD.l + Math.max(0, (W - PAD.l - PAD.r - n * span) / 2);
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
      <div style={{ fontWeight: 600, fontSize: 15, color: "#1a3752", marginBottom: 10, flexShrink: 0 }}>{title ?? "TOWER WISE SOLD % — UNITS & TSV"}</div>
      {/* Natural-scale chart: the SVG renders at its computed pixel width
          (no stretch/squash — preserveAspectRatio="none" distorted bars
          and text for very few or very many groups). Wide charts scroll
          horizontally; narrow ones sit centred. */}
      <div ref={boxRef} style={{ flex: 1, minHeight: 0, minWidth: 0, overflowX: "auto", overflowY: "hidden" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
          {[0, 25, 50, 75, 100].map(p => {
            const yv = baseY - (p / 100) * innerH;
            return (
              <g key={p}>
                <line x1={PAD.l - 6} x2={W - PAD.r} y1={yv} y2={yv} stroke="#e9e5db" strokeDasharray="3,4" />
                <text x={PAD.l - 12} y={yv + 4} fontSize="13" fontWeight="700" fill="#1f2937" textAnchor="end">{p}%</text>
              </g>
            );
          })}
          {filtered.map((tw, i) => {
            const gx = startX + i * span + (span - groupW) / 2;
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
                <rect x={gx - (span - groupW) / 2} y={PAD.t} width={span} height={innerH} fill="transparent" />
                <rect x={gx} y={baseY - unitH} width={BAR_W} height={unitH} fill="#0e7490" rx="3" />
                <text x={gx + BAR_W / 2} y={baseY - unitH - 7} fontSize="12" fill="#0e7490" fontWeight="700" textAnchor="middle">{unitPct}%</text>
                <rect x={gx + BAR_W + PAIR_GAP} y={baseY - tsvH} width={BAR_W} height={tsvH} fill="#f97316" rx="3" />
                <text x={gx + BAR_W + PAIR_GAP + BAR_W / 2} y={baseY - tsvH - 7} fontSize="12" fill="#f97316" fontWeight="700" textAnchor="middle">{tsvPct}%</text>
                <text x={gx + groupW / 2} y={H - 8} fontSize="13.5" fill="#1f2937" textAnchor="middle" fontWeight="700">{tw.name}</text>
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
