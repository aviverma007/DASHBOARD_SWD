import { useMemo, useRef, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";

export interface TVADataPoint {
  month: string;
  target: number;
  achieved: number;
  adjusted: number | null;
  isFuture: boolean;
}

interface UnitsCardProps {
  data: TVADataPoint[];
  title?: string;
  achievedLabel?: string;
  formatVal?: (n: number) => string;
  unit?: string;
}

const WINDOW = 6;

// ── Custom adjusted dot ───────────────────────────────────────────────────────
function AdjustedDot(props: Record<string, unknown>) {
  const { cx, cy } = props as { cx: number; cy: number };
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={5} fill="#43a047" stroke="#fff" strokeWidth={1.5} />;
}

// ── Slider ────────────────────────────────────────────────────────────────────
function Slider({ offset, maxOffset, total, onOffset }: { offset: number; maxOffset: number; total: number; onOffset: (o: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const thumbPct = (WINDOW / total) * 100;
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
        style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid #b0bec5", background: offset === 0 ? "#f5f5f5" : "#fff", cursor: offset === 0 ? "default" : "pointer", fontSize: 13, color: "#546e7a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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
        style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid #b0bec5", background: offset === maxOffset ? "#f5f5f5" : "#fff", cursor: offset === maxOffset ? "default" : "pointer", fontSize: 13, color: "#546e7a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        ›
      </button>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────
export function UnitsTargetCard({ data, title = "UNITS — TARGET VS ACHIEVED", achievedLabel, formatVal, unit = "Units" }: UnitsCardProps) {
  const [offset, setOffset] = useState(0);
  const maxOffset = Math.max(0, data.length - WINDOW);
  const visible = data.slice(offset, offset + WINDOW);
  const fmt = formatVal ?? ((n: number) => n.toString());

  const totalAchieved = useMemo(() => data.filter(d => !d.isFuture).reduce((s, d) => s + d.achieved, 0), [data]);
  const badge = achievedLabel ?? `${fmt(totalAchieved)} ${unit}`;

  // Custom bar label on top of target bar (shows catch-up badge if applicable)
  const TargetLabel = (props: Record<string, unknown>) => {
    const { x, y, width, value, index } = props as { x: number; y: number; width: number; value: number; index: number };
    const d = visible[index];
    if (!d) return null;
    // Numeric label
    const label = (
      <text key="lbl" x={(x as number) + (width as number) / 2} y={(y as number) - 4} textAnchor="middle" fill="#546e7a" fontSize={10}>
        {value}
      </text>
    );
    // Catch-up badge
    if (d.adjusted && !d.isFuture) {
      const catchUp = d.adjusted - d.achieved;
      if (catchUp > 0) {
        const bw = 36, bh = 18;
        const cx2 = (x as number) + (width as number) / 2 - bw / 2;
        const cy2 = (y as number) - bh - 22;
        return (
          <g>
            {label}
            <rect x={cx2} y={cy2} width={bw} height={bh} rx={3} fill="#fff" stroke="#d32f2f" strokeWidth={1.5} />
            <text x={cx2 + bw / 2} y={cy2 + 12} textAnchor="middle" fill="#d32f2f" fontSize={10} fontWeight="700">▲{catchUp}</text>
          </g>
        );
      }
    }
    return <>{label}</>;
  };

  const AchievedLabel = (props: Record<string, unknown>) => {
    const { x, y, width, value } = props as { x: number; y: number; width: number; value: number };
    if (!value) return null;
    return (
      <text x={(x as number) + (width as number) / 2} y={(y as number) - 4} textAnchor="middle" fill="#1b5e20" fontSize={10} fontWeight="700">
        {fmt(value)}
      </text>
    );
  };

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)", padding: "16px 18px 14px", minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#1a3752", letterSpacing: "0.3px" }}>{title}</div>
        <div style={{ fontSize: 10.5, color: "#90a4ae" }}>Double-click to zoom</div>
      </div>

      {/* Badge */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#00838f", color: "#fff", borderRadius: 6, padding: "4px 12px 4px 10px", fontSize: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 10.5, opacity: 0.85 }}>ACHIEVED (THIS FILTER)</span>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{badge}</span>
      </div>

      {/* Slider */}
      <Slider offset={offset} maxOffset={maxOffset} total={data.length} onOffset={setOffset} />

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={visible} margin={{ top: 36, right: 8, left: -20, bottom: 0 }} barCategoryGap="25%" barGap={2}>
          <CartesianGrid vertical={false} stroke="#eceff1" strokeDasharray="3 3" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#78909c" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#90a4ae" }} axisLine={false} tickLine={false} width={28} />
          <Tooltip
            contentStyle={{ background: "#fff", border: "1.5px solid #0097a7", borderRadius: 6, fontSize: 11.5, color: "#1a3752" }}
            formatter={(val, name) => [fmt(Number(val ?? 0)), String(name)]}
          />

          {/* Target bars */}
          <Bar dataKey="target" name="Target" maxBarSize={22} label={<TargetLabel />}>
            {visible.map((d, i) => (
              <Cell key={i} fill={d.isFuture ? "#eceff1" : "#cfd8dc"} opacity={d.isFuture ? 0.7 : 1} />
            ))}
          </Bar>

          {/* Achieved bars */}
          <Bar dataKey="achieved" name="Achieved" maxBarSize={22}>
            {visible.map((d, i) => (
              <Cell key={i} fill={d.isFuture || d.achieved === 0 ? "transparent" : "#2e7d32"} />
            ))}
            <LabelList content={<AchievedLabel />} />
          </Bar>

          {/* Adjusted dashed line */}
          <Line
            dataKey="adjusted"
            name="Adjusted"
            stroke="#00897b"
            strokeDasharray="5 4"
            strokeWidth={1.8}
            dot={<AdjustedDot />}
            activeDot={{ r: 5, fill: "#43a047" }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 6, fontSize: 11, color: "#546e7a" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: "#2e7d32", display: "inline-block" }} />
          Achieved
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="24" height="12"><line x1="0" y1="6" x2="14" y2="6" stroke="#00897b" strokeWidth="2" strokeDasharray="5 3" /><circle cx="19" cy="6" r="4" fill="#43a047" /></svg>
          Adjusted
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: "#cfd8dc", display: "inline-block" }} />
          Target
        </span>
      </div>
    </div>
  );
}
