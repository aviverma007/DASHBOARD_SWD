import { useMemo, useRef } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";

export interface TVADataPoint {
  month: string;
  target: number;
  achieved: number;
  adjusted: number | null;   // balance-target spread across remaining future periods
  catchUp: number | null;    // adjusted - this period's own target, only if > 0
  showBadge: boolean;        // true only on the first future period with a catch-up
  isFuture: boolean;
  isCurrent: boolean;
  year: number;   // actual calendar year, for drill-down
  calMonth: number; // actual calendar month (1-12), for drill-down
}

interface UnitsCardProps {
  data: TVADataPoint[];
  title?: string;
  achievedLabel?: string;
  formatVal?: (n: number) => string;
  unit?: string;
  onBarClick?: (point: TVADataPoint) => void;
  /** Controlled shared window position — same offset/windowSize passed to
   * every Target-vs-Actual chart on the page so they always show the
   * exact same months. */
  offset: number;
  windowSize: number;
  onOffsetChange: (o: number) => void;
  /** "bar" (default) or "line" — one page-level toggle flips all three
   * Target-vs-Achieved cards together. */
  chartStyle?: "bar" | "line";
}

// ── Custom adjusted dot ───────────────────────────────────────────────────────
function AdjustedDot(props: Record<string, unknown>) {
  const { cx, cy } = props as { cx: number; cy: number };
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={5} fill="#43a047" stroke="#fff" strokeWidth={1.5} />;
}

// ── Slider ────────────────────────────────────────────────────────────────────
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
        style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid #b0bec5", background: offset === 0 ? "#f5f5f5" : "#fff", cursor: offset === 0 ? "default" : "pointer", fontSize: 14, color: "#546e7a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        ‹
      </button>
      <div ref={trackRef} onClick={e => offsetFromX(e.clientX)}
        style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(0,151,167,0.1)", position: "relative", cursor: "pointer" }}>
        <div
          onMouseDown={e => {
            dragging.current = true;
            const move = (ev: MouseEvent) => { if (dragging.current) offsetFromX(ev.clientX); };
            const up = () => { dragging.current = false; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
            e.preventDefault();
          }}
          style={{ position: "absolute", top: 0, left: `${thumbLeft}%`, width: `${thumbPct}%`, height: "100%", background: "#0097a7", borderRadius: 3, cursor: "grab" }}
        />
      </div>
      <button onClick={() => onOffset(Math.min(maxOffset, offset + 1))} disabled={offset === maxOffset}
        style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid #b0bec5", background: offset === maxOffset ? "#f5f5f5" : "#fff", cursor: offset === maxOffset ? "default" : "pointer", fontSize: 14, color: "#546e7a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        ›
      </button>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────
export function UnitsTargetCard({ data, title = "UNITS — TARGET VS ACHIEVED", achievedLabel, formatVal, unit = "Units", onBarClick, offset, windowSize, onOffsetChange, chartStyle = "bar" }: UnitsCardProps) {
  const maxOffset = Math.max(0, data.length - windowSize);
  const clampedOffset = Math.min(offset, maxOffset);
  const visible = data.slice(clampedOffset, clampedOffset + windowSize);
  // Line mode plots achieved only where a real (non-future, non-zero)
  // value exists, and target only where a target exists — recharts
  // leaves gaps at nulls instead of drawing misleading zero dips.
  const visibleLine = visible.map(d => ({
    ...d,
    achievedLine: d.isFuture || d.achieved === 0 ? null : d.achieved,
    targetLine: d.target > 0 ? d.target : null,
  }));
  const fmt = formatVal ?? ((n: number) => n.toString());

  const totalAchieved = useMemo(() => data.filter(d => !d.isFuture).reduce((s, d) => s + d.achieved, 0), [data]);
  const badge = achievedLabel ?? `${fmt(totalAchieved)} ${unit}`;

  // Custom bar label on top of target bar (shows catch-up badge if applicable)
  const TargetLabel = (props: Record<string, unknown>) => {
    const { x, y, width, value, index } = props as { x: number; y: number; width: number; value: number; index: number };
    const d = visible[index];
    if (!d || !value) return null;
    const label = (
      <text key="lbl" x={(x as number) + (width as number) / 2} y={(y as number) - 6} textAnchor="middle" fill="#546e7a" fontSize={12} fontWeight={600}>
        {fmt(value)}
      </text>
    );
    if (d.showBadge && d.adjusted != null) {
      const text = `▲${fmt(d.adjusted)}`;
      const bw = Math.max(40, text.length * 7 + 12), bh = 20;
      const cx2 = (x as number) + (width as number) / 2 - bw / 2;
      const cy2 = (y as number) - bh - 24;
      return (
        <g>
          {label}
          <rect x={cx2} y={cy2} width={bw} height={bh} rx={4} fill="#fff" stroke="#d32f2f" strokeWidth={1.5} />
          <text x={cx2 + bw / 2} y={cy2 + 14} textAnchor="middle" fill="#d32f2f" fontSize={11} fontWeight="700">{text}</text>
        </g>
      );
    }
    return <>{label}</>;
  };

  const AchievedLabel = (props: Record<string, unknown>) => {
    const { x, y, width, value } = props as { x: number; y: number; width: number; value: number };
    if (!value) return null;
    return (
      <text x={(x as number) + (width as number) / 2 + 10} y={(y as number) - 6} textAnchor="middle" fill="#1b5e20" fontSize={13} fontWeight="700">
        {fmt(value)}
      </text>
    );
  };

  // Shared tooltip: shows Target + Achieved together for the hovered month
  function renderTooltip(props: Record<string, unknown>) {
    const active = props.active as boolean | undefined;
    const payload = props.payload as { payload: TVADataPoint }[] | undefined;
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: "#14213d", color: "#fff", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.6, boxShadow: "0 6px 24px rgba(0,0,0,.28)" }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.month}</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: "#a9b2c7" }}>Target</span>
          <span style={{ fontWeight: 700 }}>{d.target > 0 ? `${fmt(d.target)} ${unit}` : "No target available"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: "#a9b2c7" }}>Achieved</span>
          <span style={{ fontWeight: 700, color: "#4ade80" }}>{d.achieved > 0 ? `${fmt(d.achieved)} ${unit}` : "No data"}</span>
        </div>
        {d.adjusted != null && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "#a9b2c7" }}>Adjusted (balance/mo)</span>
            <span style={{ fontWeight: 700, color: "#5eead4" }}>{fmt(d.adjusted)} {unit}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)", padding: "16px 18px 14px", minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#1a3752", letterSpacing: "0.3px" }}>{title}</div>
        {onBarClick && (
          <div style={{ fontSize: 11, color: "#0097a7", textAlign: "right" }}>{chartStyle === "bar" ? "click a green bar → drill down" : "click a green dot → drill down"}</div>
        )}
      </div>

      {/* Badge */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#00838f", color: "#fff", borderRadius: 6, padding: "4px 12px 4px 10px", fontSize: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 11, opacity: 0.85 }}>ACHIEVED (THIS FILTER)</span>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{badge}</span>
      </div>

      {/* Shared slider */}
      <Slider offset={clampedOffset} maxOffset={maxOffset} total={data.length} windowSize={windowSize} onOffset={onOffsetChange} />

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartStyle === "bar" ? visible : visibleLine} margin={{ top: 40, right: 14, left: -6, bottom: 4 }} barCategoryGap="22%" barGap={3}>
          <CartesianGrid vertical={false} stroke="#eceff1" strokeDasharray="3 3" />
          <XAxis dataKey="month" tick={{ fontSize: 13.5, fill: "#1f2937", fontWeight: 700 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 13, fill: "#1f2937", fontWeight: 700 }} axisLine={false} tickLine={false} width={44} />
          <Tooltip content={renderTooltip} />

          {chartStyle === "bar" ? (
            <>
              {/* Target bars — always render regardless of Achieved */}
              <Bar dataKey="target" name="Target" maxBarSize={26} label={<TargetLabel />}>
                {visible.map((d, i) => (
                  <Cell key={i} fill={d.isFuture ? "#eceff1" : "#cfd8dc"} opacity={d.isFuture ? 0.7 : 1} />
                ))}
              </Bar>

              {/* Achieved bars — render whenever achieved>0, independent of target */}
              <Bar dataKey="achieved" name="Achieved" maxBarSize={26}>
                {visible.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.isFuture || d.achieved === 0 ? "transparent" : "#2e7d32"}
                    style={{ cursor: !d.isFuture && d.achieved > 0 && onBarClick ? "pointer" : "default" }}
                    onClick={() => { if (!d.isFuture && d.achieved > 0 && onBarClick) onBarClick(d); }}
                  />
                ))}
                <LabelList content={<AchievedLabel />} />
              </Bar>
            </>
          ) : (
            <>
              {/* Target line — solid grey-blue so Achieved stays the hero */}
              <Line
                dataKey="targetLine"
                name="Target"
                stroke="#8fa0b8"
                strokeWidth={2.2}
                dot={{ r: 3.5, fill: "#8fa0b8", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#8fa0b8" }}
                connectNulls={false}
              />
              {/* Achieved line — green, dots clickable for drill-down */}
              <Line
                dataKey="achievedLine"
                name="Achieved"
                stroke="#2e7d32"
                strokeWidth={2.6}
                dot={(props) => {
                  const { cx, cy, payload, index } = props as { cx?: number; cy?: number; payload: TVADataPoint; index?: number };
                  if (cx == null || cy == null) return <g key={`ad-${index}`} />;
                  return (
                    <circle
                      key={`ad-${index}`}
                      cx={cx} cy={cy} r={5}
                      fill="#2e7d32" stroke="#fff" strokeWidth={1.5}
                      style={{ cursor: onBarClick ? "pointer" : "default" }}
                      onClick={() => onBarClick?.(payload)}
                    />
                  );
                }}
                activeDot={{ r: 7, fill: "#2e7d32" }}
                connectNulls={false}
              />
            </>
          )}

          {/* Adjusted dashed line */}
          <Line
            dataKey="adjusted"
            name="Adjusted"
            stroke="#00897b"
            strokeDasharray="5 4"
            strokeWidth={2}
            dot={<AdjustedDot />}
            activeDot={{ r: 6, fill: "#43a047" }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 6, fontSize: 12, color: "#4a5568" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {chartStyle === "bar"
            ? <span style={{ width: 13, height: 13, borderRadius: 2, background: "#2e7d32", display: "inline-block" }} />
            : <svg width="24" height="12"><line x1="0" y1="6" x2="24" y2="6" stroke="#2e7d32" strokeWidth="2.6" /><circle cx="12" cy="6" r="4" fill="#2e7d32" stroke="#fff" strokeWidth="1.5" /></svg>}
          Achieved
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="24" height="12"><line x1="0" y1="6" x2="14" y2="6" stroke="#00897b" strokeWidth="2" strokeDasharray="5 3" /><circle cx="19" cy="6" r="4" fill="#43a047" /></svg>
          Adjusted
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {chartStyle === "bar"
            ? <span style={{ width: 13, height: 13, borderRadius: 2, background: "#cfd8dc", display: "inline-block" }} />
            : <svg width="24" height="12"><line x1="0" y1="6" x2="24" y2="6" stroke="#8fa0b8" strokeWidth="2.2" /><circle cx="12" cy="6" r="3.5" fill="#8fa0b8" /></svg>}
          Target
        </span>
      </div>
    </div>
  );
}
