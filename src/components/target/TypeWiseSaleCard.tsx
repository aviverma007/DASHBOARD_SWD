import { ChartTooltip, useChartTooltip, tRow } from "./ChartTooltip";
import { useContainerWidth } from "./useContainerWidth";

interface CfgRow { name: string; sold: number; unsold: number; total: number; sold_pct: number; avg_area: number; }

const CARD_STYLE: React.CSSProperties = {
  background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)",
  padding: "16px 18px 14px", height: 420, display: "flex", flexDirection: "column",
  boxSizing: "border-box", minWidth: 0, width: "100%",
};

export function TypeWiseSaleCard({ configs, onConfigClick }: { configs: CfgRow[]; onConfigClick?: (name: string) => void }) {
  const { tooltip, showTooltip, moveTooltip, hideTooltip } = useChartTooltip();
  const { ref: boxRef, width } = useContainerWidth<HTMLDivElement>();
  const filtered = configs.filter(c => c.total > 0);

  if (filtered.length === 0) {
    return (
      <div style={CARD_STYLE}>
        <div style={{ fontWeight: 600, fontSize: 15, color: "#1a3752", marginBottom: 10, flexShrink: 0 }}>TYPE WISE % SALE</div>
        <p style={{ color: "#9ca3af", fontSize: 13 }}>No configuration data.</p>
      </div>
    );
  }

  // Wider bars, generous group spacing, extra top padding for % labels + dashed line
  const BAR_W = 46, GAP_IN_PAIR = 6, PAD = { l: 20, r: 20, t: 46, b: 46 };
  const groupW = BAR_W * 2 + GAP_IN_PAIR;
  // Fill-the-card layout (see TowerSoldPctCard).
  const MIN_SPAN = groupW + 40, MAX_SPAN = groupW + 180, FALLBACK_W = 680;
  const n = filtered.length;
  const cardW = width || FALLBACK_W;
  const avail = cardW - PAD.l - PAD.r;
  const span = Math.max(MIN_SPAN, Math.min(MAX_SPAN, avail / n));
  const W = Math.max(cardW, n * span + PAD.l + PAD.r);
  const startX = PAD.l + Math.max(0, (W - PAD.l - PAD.r - n * span) / 2);
  const H = 280;
  const innerH = H - PAD.t - PAD.b;
  const baseY = PAD.t + innerH;
  const maxUnits = Math.max(...filtered.map(c => c.total), 1);

  function cfgTooltip(c: CfgRow, e: React.MouseEvent) {
    const content = (
      <>
        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13.5 }}>{c.name}</div>
        {tRow("Units Sold", c.sold.toLocaleString("en-IN"), "#22d3ee")}
        {tRow("Unsold Units", c.unsold.toLocaleString("en-IN"), "#7dd3ea")}
        {tRow("% Sold", `${c.sold_pct}%`)}
        {c.avg_area > 0 && tRow("Avg area", `${c.avg_area.toLocaleString("en-IN")} sqft`)}
      </>
    );
    showTooltip(e, content);
  }

  return (
    <div style={CARD_STYLE}>
      <div style={{ fontWeight: 600, fontSize: 15, color: "#1a3752", marginBottom: 10, flexShrink: 0 }}>TYPE WISE % SALE</div>
      {/* Natural-scale chart: the SVG renders at its computed pixel width
          (no stretch/squash — preserveAspectRatio="none" distorted bars
          and text for very few or very many groups). Wide charts scroll
          horizontally; narrow ones sit centred. */}
      <div ref={boxRef} style={{ flex: 1, minHeight: 0, minWidth: 0, overflowX: "auto", overflowY: "hidden" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
          {/* % sold trend line */}
          <path
            d={filtered.map((c, i) => {
              const gx = startX + i * span + span / 2;
              const py = PAD.t + innerH - (c.sold_pct / 100) * innerH;
              return `${i === 0 ? "M" : "L"}${gx} ${py}`;
            }).join(" ")}
            fill="none" stroke="#0e7490" strokeWidth="2" strokeDasharray="6,4"
          />
          {filtered.map((c, i) => {
            const gx = startX + i * span + (span - groupW) / 2;
            const soldH = (c.sold / maxUnits) * innerH;
            const unsoldH = (c.unsold / maxUnits) * innerH;
            const dotY = PAD.t + innerH - (c.sold_pct / 100) * innerH;
            return (
              <g
                key={c.name}
                onClick={() => onConfigClick?.(c.name)}
                onMouseEnter={e => cfgTooltip(c, e)}
                onMouseMove={moveTooltip}
                onMouseLeave={hideTooltip}
                style={{ cursor: onConfigClick ? "pointer" : "default" }}
              >
                {/* Invisible wider hit-zone spanning the whole group */}
                <rect x={gx - (span - groupW) / 2} y={PAD.t} width={span} height={innerH} fill="transparent" />
                <rect x={gx} y={baseY - soldH} width={BAR_W} height={soldH} fill="#0e7490" rx="3" />
                <rect x={gx + BAR_W + GAP_IN_PAIR} y={baseY - unsoldH} width={BAR_W} height={unsoldH} fill="#a5f3fc" rx="3" />
                <circle cx={gx + groupW / 2} cy={dotY} r="6" fill="#fff" stroke="#0e7490" strokeWidth="2.5" />
                <text x={gx + groupW / 2} y={dotY - 12} fontSize="14" fill="#0e7490" fontWeight="700" textAnchor="middle">{c.sold_pct}%</text>
                <text x={gx + groupW / 2} y={H - 28} fontSize="14" fill="#14213d" textAnchor="middle" fontWeight="700">{c.name}</text>
                <text x={gx + groupW / 2} y={H - 10} fontSize="12" fontWeight="600" fill="#475569" textAnchor="middle">{c.avg_area ? `${c.avg_area.toLocaleString("en-IN")} sqft` : ""}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 12, marginTop: 8, flexShrink: 0, color: "#4a5568" }}>
        <span><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: "#0e7490", marginRight: 5, verticalAlign: "middle" }} />Units Sold</span>
        <span><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: "#a5f3fc", marginRight: 5, verticalAlign: "middle" }} />Unsold Units</span>
        <span><span style={{ display: "inline-block", width: 16, height: 3, background: "#0e7490", marginRight: 5, verticalAlign: "middle", borderTop: "2px dashed #0e7490" }} />% Sold</span>
      </div>
      <ChartTooltip tooltip={tooltip} />
    </div>
  );
}
