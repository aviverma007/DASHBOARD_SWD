interface RateTrendPoint { key: string; rate: number; units: number }

const CARD_STYLE: React.CSSProperties = {
  background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)",
  padding: "16px 18px 14px", height: 400, display: "flex", flexDirection: "column",
  boxSizing: "border-box", minWidth: 0, width: "100%",
};

export function RateTrendOverTimeCard({ data, onPointClick }: { data: RateTrendPoint[]; onPointClick?: (key: string) => void }) {
  if (data.length === 0) {
    return (
      <div style={CARD_STYLE}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#1a3752", marginBottom: 10, flexShrink: 0 }}>RATE TREND OVER TIME</div>
        <p style={{ color: "#9ca3af", fontSize: 13 }}>No booking history for this project.</p>
      </div>
    );
  }

  const min = Math.min(...data.map(d => d.rate)) * 0.95;
  const max = Math.max(...data.map(d => d.rate)) * 1.05;
  const avg = data.reduce((s, d) => s + d.rate, 0) / data.length;

  const W = Math.max(560, data.length * 28), H = 220, PAD = { l: 50, r: 12, t: 12, b: 26 };
  const innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (data.length > 1 ? i * (innerW / (data.length - 1)) : innerW / 2);
  const y = (v: number) => PAD.t + innerH - ((v - min) / (max - min)) * innerH;
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(d.rate)}`).join(" ");
  const avgY = y(avg);

  return (
    <div style={CARD_STYLE}>
      <div style={{ fontWeight: 700, fontSize: 13, color: "#1a3752", marginBottom: 10, flexShrink: 0 }}>RATE TREND OVER TIME</div>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
          {[0, 0.5, 1].map(t => {
            const yv = PAD.t + innerH * t, v = max - (max - min) * t;
            return <g key={t}><line x1={PAD.l} x2={W - PAD.r} y1={yv} y2={yv} stroke="#eceff1" strokeDasharray="3,3" /><text x={PAD.l - 6} y={yv + 3} fontSize="9" fill="#9ca3af" textAnchor="end">₹{Math.round(v / 1000)}k</text></g>;
          })}
          <line x1={PAD.l} x2={W - PAD.r} y1={avgY} y2={avgY} stroke="#22c55e" strokeWidth="1.6" strokeDasharray="5,3">
            <title>Overall Average: ₹{Math.round(avg).toLocaleString("en-IN")}/sqft</title>
          </line>
          <path d={line} fill="none" stroke="#0e7490" strokeWidth="1.8" />
          {data.map((d, i) => (
            <g key={d.key}>
              <circle cx={x(i)} cy={y(d.rate)} r="10" fill="transparent"
                style={{ cursor: onPointClick ? "pointer" : "default" }}
                onClick={() => onPointClick?.(d.key)}>
                <title>Month: {d.key}{"\n"}Average Rate: ₹{d.rate.toLocaleString("en-IN")}/sqft{"\n"}Units booked: {d.units}</title>
              </circle>
              <circle cx={x(i)} cy={y(d.rate)} r="4" fill="#0e7490" style={{ pointerEvents: "none" }} />
            </g>
          ))}
          {data.filter((_, i) => i % Math.ceil(data.length / 12) === 0).map(d => {
            const i = data.indexOf(d);
            return <text key={d.key} x={x(i)} y={H - 6} fontSize="8" fill="#9ca3af" textAnchor="middle">{d.key}</text>;
          })}
        </svg>
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 10.5, marginTop: 6, flexShrink: 0 }}>
        <span><span style={{ display: "inline-block", width: 14, height: 2, background: "#0e7490", marginRight: 4, verticalAlign: "middle" }} />Monthly Avg</span>
        <span><span style={{ display: "inline-block", width: 14, height: 2, background: "#22c55e", marginRight: 4, verticalAlign: "middle", borderTop: "1.6px dashed #22c55e" }} />Trend (overall avg)</span>
      </div>
    </div>
  );
}
