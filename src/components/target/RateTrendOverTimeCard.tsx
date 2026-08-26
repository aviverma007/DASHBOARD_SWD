import { ChartTooltip, useChartTooltip, tRow } from "./ChartTooltip";
import { useContainerWidth } from "./useContainerWidth";

interface RateTrendPoint { key: string; rate: number; units: number }

const CARD_STYLE: React.CSSProperties = {
  background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)",
  padding: "16px 18px 14px", height: 420, display: "flex", flexDirection: "column",
  boxSizing: "border-box", minWidth: 0, width: "100%",
};

export function RateTrendOverTimeCard({ data, onPointClick }: { data: RateTrendPoint[]; onPointClick?: (key: string) => void }) {
  const { tooltip, showTooltip, moveTooltip, hideTooltip } = useChartTooltip();
  const { ref: boxRef, width } = useContainerWidth<HTMLDivElement>();

  if (data.length === 0) {
    return (
      <div style={CARD_STYLE}>
        <div style={{ fontWeight: 600, fontSize: 15, color: "#1a3752", marginBottom: 10, flexShrink: 0 }}>RATE TREND OVER TIME</div>
        <p style={{ color: "#9ca3af", fontSize: 13 }}>No booking history for this project.</p>
      </div>
    );
  }

  const min = Math.min(...data.map(d => d.rate)) * 0.95;
  const max = Math.max(...data.map(d => d.rate)) * 1.06;
  const avg = data.reduce((s, d) => s + d.rate, 0) / data.length;

  // Fill the card exactly; grow (and scroll) only when months need >58px each
  const W = Math.max(width || 680, data.length * 58 + 82), H = 280, PAD = { l: 62, r: 20, t: 24, b: 36 };
  const innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (data.length > 1 ? i * (innerW / (data.length - 1)) : innerW / 2);
  const y = (v: number) => PAD.t + innerH - ((v - min) / (max - min)) * innerH;
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(d.rate)}`).join(" ");
  const avgY = y(avg);

  // Reduce tick density to avoid overlap: aim for ~8-10 labels max
  const tickEvery = Math.max(1, Math.ceil(data.length / 9));

  function pointTooltip(d: RateTrendPoint, e: React.MouseEvent) {
    const content = (
      <>
        {tRow("Month", d.key)}
        {tRow("Average Rate", `₹${d.rate.toLocaleString("en-IN")}/sqft`, "#22d3ee")}
        {tRow("Units booked", d.units.toString())}
      </>
    );
    showTooltip(e, content);
  }

  return (
    <div style={CARD_STYLE}>
      <div style={{ fontWeight: 600, fontSize: 15, color: "#1a3752", marginBottom: 10, flexShrink: 0 }}>RATE TREND OVER TIME</div>
      {/* Natural-scale chart: the SVG renders at its computed pixel width
          (no stretch/squash — preserveAspectRatio="none" distorted bars
          and text for very few or very many groups). Wide charts scroll
          horizontally; narrow ones sit centred. */}
      <div ref={boxRef} style={{ flex: 1, minHeight: 0, minWidth: 0, overflowX: "auto", overflowY: "hidden" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
          {[0, 0.5, 1].map(t => {
            const yv = PAD.t + innerH * t, v = max - (max - min) * t;
            return (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={yv} y2={yv} stroke="#e9e5db" strokeDasharray="3,4" />
                <text x={PAD.l - 10} y={yv + 4} fontSize="13" fontWeight="700" fill="#1f2937" textAnchor="end">₹{Math.round(v / 1000)}k</text>
              </g>
            );
          })}
          <line x1={PAD.l} x2={W - PAD.r} y1={avgY} y2={avgY} stroke="#22c55e" strokeWidth="2" strokeDasharray="6,4">
            <title>Overall Average: ₹{Math.round(avg).toLocaleString("en-IN")}/sqft</title>
          </line>
          <path d={line} fill="none" stroke="#0e7490" strokeWidth="2.4" />
          {data.map((d, i) => (
            <g key={d.key}
              onMouseEnter={e => pointTooltip(d, e)}
              onMouseMove={moveTooltip}
              onMouseLeave={hideTooltip}
              onClick={() => onPointClick?.(d.key)}
              style={{ cursor: onPointClick ? "pointer" : "default" }}
            >
              <circle cx={x(i)} cy={y(d.rate)} r="11" fill="transparent" />
              <circle cx={x(i)} cy={y(d.rate)} r="5" fill="#0e7490" stroke="#fff" strokeWidth="1.5" style={{ pointerEvents: "none" }} />
            </g>
          ))}
          {data.filter((_, i) => i % tickEvery === 0).map(d => {
            const i = data.indexOf(d);
            return <text key={d.key} x={x(i)} y={H - 10} fontSize="12.5" fontWeight="600" fill="#1f2937" textAnchor="middle">{d.key}</text>;
          })}
        </svg>
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 12, marginTop: 8, flexShrink: 0, color: "#4a5568" }}>
        <span><span style={{ display: "inline-block", width: 16, height: 3, background: "#0e7490", marginRight: 5, verticalAlign: "middle" }} />Monthly Avg</span>
        <span><span style={{ display: "inline-block", width: 16, height: 3, background: "#22c55e", marginRight: 5, verticalAlign: "middle", borderTop: "2px dashed #22c55e" }} />Trend (overall avg)</span>
      </div>
      <ChartTooltip tooltip={tooltip} />
    </div>
  );
}
