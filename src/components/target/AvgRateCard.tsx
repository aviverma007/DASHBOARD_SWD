import { useRef } from "react";
import { ChartTooltip, useChartTooltip, tRow } from "./ChartTooltip";

export interface RatePoint {
  month: string;
  achievedRate: number | null; // null if no bookings that month
  targetRate: number | null;
  adjustedRate: number | null; // only set for "balance year" months
  isFuture: boolean;
  isCurrent: boolean;
  year: number;
  calMonth: number;
}

interface AvgRateCardProps {
  data: RatePoint[];
  avgAchievedRate: number;
  targetRate: number;
  requiredRate: number | null;
  onPointClick?: (p: RatePoint) => void;
  /** Controlled shared window position, same as the bar charts */
  offset: number;
  windowSize: number;
  onOffsetChange: (o: number) => void;
}

function Slider({ offset, maxOffset, total, windowSize, onOffset }: { offset: number; maxOffset: number; total: number; windowSize: number; onOffset: (o: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const thumbPct = Math.min(100, (windowSize / total) * 100);
  const thumbLeft = maxOffset > 0 ? (offset / maxOffset) * (100 - thumbPct) : 0;

  function offsetFromX(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onOffset(Math.round(frac * maxOffset));
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 2px" }}>
      <button onClick={() => onOffset(Math.max(0, offset - 1))} disabled={offset === 0}
        style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid #b0bec5", background: offset === 0 ? "#f5f5f5" : "#fff", cursor: offset === 0 ? "default" : "pointer", fontSize: 14, color: "#546e7a", flexShrink: 0 }}>‹</button>
      <div ref={trackRef} onClick={e => offsetFromX(e.clientX)} style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(0,151,167,0.1)", position: "relative", cursor: "pointer" }}>
        <div onMouseDown={e => {
            dragging.current = true;
            const move = (ev: MouseEvent) => { if (dragging.current) offsetFromX(ev.clientX); };
            const up = () => { dragging.current = false; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
            window.addEventListener("mousemove", move); window.addEventListener("mouseup", up); e.preventDefault();
          }}
          style={{ position: "absolute", top: 0, left: `${thumbLeft}%`, width: `${thumbPct}%`, height: "100%", background: "#0097a7", borderRadius: 3, cursor: "grab" }} />
      </div>
      <button onClick={() => onOffset(Math.min(maxOffset, offset + 1))} disabled={offset === maxOffset}
        style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid #b0bec5", background: offset === maxOffset ? "#f5f5f5" : "#fff", cursor: offset === maxOffset ? "default" : "pointer", fontSize: 14, color: "#546e7a", flexShrink: 0 }}>›</button>
    </div>
  );
}

export function AvgRateCard({ data, avgAchievedRate, targetRate, requiredRate, onPointClick, offset, windowSize, onOffsetChange }: AvgRateCardProps) {
  const { tooltip, showTooltip, moveTooltip, hideTooltip } = useChartTooltip();
  const maxOffset = Math.max(0, data.length - windowSize);
  const clampedOffset = Math.min(offset, maxOffset);
  const visible = data.slice(clampedOffset, clampedOffset + windowSize);

  const allVals = visible.flatMap(d => [d.achievedRate, d.targetRate, d.adjustedRate]).filter((v): v is number => v != null);
  const min = allVals.length ? Math.min(...allVals) * 0.95 : 15000;
  const max = allVals.length ? Math.max(...allVals) * 1.05 : 25000;

  const W = 620, H = 240, PAD = { l: 62, r: 16, t: 20, b: 34 };
  const innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (visible.length > 1 ? i * (innerW / (visible.length - 1)) : innerW / 2);
  const y = (v: number) => PAD.t + innerH - ((v - min) / (max - min)) * innerH;

  function pathFor(key: "achievedRate" | "targetRate" | "adjustedRate") {
    const pts = visible.map((d, i) => ({ i, v: d[key] })).filter(p => p.v != null) as { i: number; v: number }[];
    if (pts.length < 2) return "";
    return pts.map((p, idx) => `${idx === 0 ? "M" : "L"}${x(p.i)} ${y(p.v)}`).join(" ");
  }

  // Bright variants — the old #7b1414/#1E3163 read as near-black on the
  // chart, and #1E3163 was invisible against the #14213d tooltip.
  const achColor = "#dc2626", tgtColor = "#3b82f6", adjColor = "#1a7a4a";
  const achievedPct = targetRate > 0 ? Math.round((avgAchievedRate / targetRate) * 100) : 0;
  const badgeColor = achievedPct >= 100 ? "#1a7a4a" : achievedPct >= 85 ? "#B8893C" : "#c0392b";

  function pointTooltip(d: RatePoint, e: React.MouseEvent) {
    const content = (
      <>
        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13.5 }}>{d.month}</div>
        {tRow("Target Rate", d.targetRate != null ? `₹${d.targetRate.toLocaleString("en-IN")}/sqft` : "No target available", "#93c5fd")}
        {tRow("Achieved Rate", d.achievedRate != null ? `₹${d.achievedRate.toLocaleString("en-IN")}/sqft` : "No data", "#f87171")}
        {d.adjustedRate != null && tRow("Adjusted Rate", `₹${d.adjustedRate.toLocaleString("en-IN")}/sqft`, "#4ade80")}
      </>
    );
    showTooltip(e, content);
  }

  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 420px", minWidth: 0, background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)", padding: "16px 18px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1a3752", letterSpacing: "0.3px" }}>AVG RATE — TARGET VS ACHIEVED</div>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#00838f", color: "#fff", borderRadius: 6, padding: "4px 12px 4px 10px", fontSize: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 11, opacity: 0.85 }}>AVG ACHIEVED RATE (THIS FILTER)</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>₹{avgAchievedRate.toLocaleString("en-IN")}/sqft</span>
        </div>
        <Slider offset={clampedOffset} maxOffset={maxOffset} total={data.length} windowSize={windowSize} onOffset={onOffsetChange} />
        <div style={{ overflowX: "auto" }}>
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMinYMid meet" style={{ display: "block", minWidth: 320 }}>
            {[0, 0.25, 0.5, 0.75, 1].map(t => {
              const yv = PAD.t + innerH * t;
              return <line key={t} x1={PAD.l} x2={W - PAD.r} y1={yv} y2={yv} stroke="#e9e5db" strokeDasharray="3,4" />;
            })}
            {[0, 0.5, 1].map(t => {
              const v = min + (max - min) * (1 - t);
              return <text key={t} x={PAD.l - 10} y={PAD.t + innerH * t + 4} fontSize="12" fontWeight={600} fill="#64748b" textAnchor="end">₹{Math.round(v / 1000)}k</text>;
            })}
            <path d={pathFor("targetRate")} fill="none" stroke={tgtColor} strokeWidth="2.2" />
            <path d={pathFor("adjustedRate")} fill="none" stroke={adjColor} strokeWidth="2.2" strokeDasharray="6,3" />
            <path d={pathFor("achievedRate")} fill="none" stroke={achColor} strokeWidth="2.4" />
            {visible.map((d, i) => (
              <g key={`hit${i}`}
                onMouseEnter={e => pointTooltip(d, e)}
                onMouseMove={moveTooltip}
                onMouseLeave={hideTooltip}
                onClick={() => (d.achievedRate != null || d.targetRate != null) && onPointClick?.(d)}
                style={{ cursor: onPointClick ? "pointer" : "default" }}
              >
                <circle cx={x(i)} cy={y(d.achievedRate ?? d.targetRate ?? min)} r="12" fill="transparent" />
              </g>
            ))}
            {visible.map((d, i) => d.achievedRate != null && (
              <circle key={`a${i}`} cx={x(i)} cy={y(d.achievedRate)} r="5" fill={achColor} stroke="#fff" strokeWidth="1.5" style={{ pointerEvents: "none" }} />
            ))}
            {visible.map((d, i) => d.targetRate != null && <circle key={`t${i}`} cx={x(i)} cy={y(d.targetRate)} r="4" fill={tgtColor} style={{ pointerEvents: "none" }} />)}
            {visible.map((d, i) => d.adjustedRate != null && <circle key={`j${i}`} cx={x(i)} cy={y(d.adjustedRate)} r="4.5" fill={adjColor} style={{ pointerEvents: "none" }} />)}
            {visible.map((d, i) => <text key={`m${i}`} x={x(i)} y={H - 8} fontSize="13" fontWeight={600} fill="#374151" textAnchor="middle">{d.month}</text>)}
          </svg>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, marginTop: 8, flexWrap: "wrap", color: "#4a5568" }}>
          <span><span style={{ display: "inline-block", width: 16, height: 3, background: achColor, marginRight: 5, verticalAlign: "middle" }} />Achieved Rate (psf)</span>
          <span><span style={{ display: "inline-block", width: 16, height: 3, background: tgtColor, marginRight: 5, verticalAlign: "middle" }} />Target Rate (psf)</span>
          <span><span style={{ display: "inline-block", width: 16, height: 3, background: adjColor, marginRight: 5, verticalAlign: "middle", borderTop: `2px dashed ${adjColor}` }} />Adjusted Rate for Balance Year</span>
        </div>
        <ChartTooltip tooltip={tooltip} />
      </div>

      {/* Risk panel */}
      <div style={{ flex: "0 0 220px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ background: "#FDF3E3", border: "1px solid #f0d9a8", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: badgeColor }}>{achievedPct}%</span>
        </div>
        {avgAchievedRate > 0 && targetRate > 0 && avgAchievedRate < targetRate && (
          <div style={{ background: "#F5EFFB", border: "1px solid #ddd0f0", borderRadius: 8, padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#6d3ba8", textAlign: "center" }}>
            TARGET BUSINESS PLAN TSV AT RISK WITH CURRENT RATE
          </div>
        )}
        <div style={{ background: "#fff", border: "1px solid #e4e0d6", borderRadius: 8, padding: "12px 14px", fontSize: 12.5 }}>
          <div style={{ fontWeight: 700, color: "#14213d", marginBottom: 6 }}>Rate (Target Vs Actual)</div>
          {requiredRate != null ? (
            <div style={{ color: "#c0392b", fontWeight: 600 }}>New required rate of ₹{requiredRate.toLocaleString("en-IN")}</div>
          ) : (
            <div style={{ color: "#1a7a4a", fontSize: 12 }}>On track — no rate correction needed at current pace.</div>
          )}
        </div>
      </div>
    </div>
  );
}
