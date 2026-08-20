interface CfgRow { name: string; sold: number; unsold: number; total: number; sold_pct: number; avg_area: number; }

export function TypeWiseSaleCard({ configs, onConfigClick }: { configs: CfgRow[]; onConfigClick?: (name: string) => void }) {
  const filtered = configs.filter(c => c.total > 0);
  if (filtered.length === 0) {
    return (
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)", padding: "16px 18px" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#1a3752", marginBottom: 10 }}>TYPE WISE % SALE</div>
        <p style={{ color: "#9ca3af", fontSize: 13 }}>No configuration data.</p>
      </div>
    );
  }

  const BAR_W = 30, GAP_IN_PAIR = 4, GROUP_GAP = 34, PAD = { l: 26, r: 40, t: 34, b: 34 };
  const groupW = BAR_W * 2 + GAP_IN_PAIR;
  const W = filtered.length * (groupW + GROUP_GAP) + PAD.l + PAD.r;
  const H = 190;
  const innerH = H - PAD.t - PAD.b;
  const baseY = PAD.t + innerH;
  const maxUnits = Math.max(...filtered.map(c => c.total), 1);

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)", padding: "16px 18px 14px" }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: "#1a3752", marginBottom: 10 }}>TYPE WISE % SALE</div>
      <div style={{ overflowX: "auto" }}>
        <svg width={Math.max(W, 360)} height={H} style={{ display: "block" }}>
          {/* % sold trend line */}
          <path
            d={filtered.map((c, i) => {
              const gx = PAD.l + i * (groupW + GROUP_GAP) + groupW / 2;
              const py = PAD.t + innerH - (c.sold_pct / 100) * innerH;
              return `${i === 0 ? "M" : "L"}${gx} ${py}`;
            }).join(" ")}
            fill="none" stroke="#0e7490" strokeWidth="1.6" strokeDasharray="5,3"
          />
          {filtered.map((c, i) => {
            const gx = PAD.l + i * (groupW + GROUP_GAP);
            const soldH = (c.sold / maxUnits) * innerH;
            const unsoldH = (c.unsold / maxUnits) * innerH;
            const dotY = PAD.t + innerH - (c.sold_pct / 100) * innerH;
            return (
              <g key={c.name} onClick={() => onConfigClick?.(c.name)} style={{ cursor: onConfigClick ? "pointer" : "default" }}>
                <rect x={gx} y={baseY - soldH} width={BAR_W} height={soldH} fill="#0e7490" rx="2" />
                <rect x={gx + BAR_W + GAP_IN_PAIR} y={baseY - unsoldH} width={BAR_W} height={unsoldH} fill="#a5f3fc" rx="2" />
                <circle cx={gx + groupW / 2} cy={dotY} r="4" fill="#fff" stroke="#0e7490" strokeWidth="2" />
                <text x={gx + groupW / 2} y={dotY - 8} fontSize="10" fill="#0e7490" fontWeight="700" textAnchor="middle">{c.sold_pct}%</text>
                <text x={gx + groupW / 2} y={H - 18} fontSize="10.5" fill="#14213d" textAnchor="middle" fontWeight="600">{c.name}</text>
                <text x={gx + groupW / 2} y={H - 6} fontSize="9" fill="#9ca3af" textAnchor="middle">{c.avg_area ? `${c.avg_area.toLocaleString("en-IN")} sqft` : ""}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 10.5, marginTop: 6 }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#0e7490", marginRight: 4 }} />Units Sold</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#a5f3fc", marginRight: 4 }} />Unsold Units</span>
        <span><span style={{ display: "inline-block", width: 14, height: 2, background: "#0e7490", marginRight: 4, verticalAlign: "middle", borderTop: "1.6px dashed #0e7490" }} />% Sold</span>
      </div>
    </div>
  );
}
