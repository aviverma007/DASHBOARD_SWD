import { useEffect, useRef, useState } from "react";
import { ChartTooltip, useChartTooltip, tRow } from "../target/ChartTooltip";

interface TrendPoint { key: string; label: string; units: number; area: number; tsv: number }
type Metric = "units" | "area" | "tsv";

const WINDOW_SIZE = 12;

const CARD_STYLE: React.CSSProperties = {
  background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)",
  padding: "16px 18px 14px", height: 440, display: "flex", flexDirection: "column",
  boxSizing: "border-box", minWidth: 0, width: "100%",
};

const METRIC_META: Record<Metric, { label: string; color: string; fmt: (v: number) => string }> = {
  units: { label: "Units", color: "#0e7490", fmt: v => Math.round(v).toLocaleString("en-IN") },
  area: { label: "Area (L sqft)", color: "#B8893C", fmt: v => v.toFixed(2) },
  tsv: { label: "TSV (₹ Cr)", color: "#7b1414", fmt: v => v.toFixed(1) },
};

/** Measures the rendered pixel width of a container so the chart can be
 * drawn 1:1 in real pixels — no preserveAspectRatio stretch, so text and
 * rotated labels never get sheared or distorted. */
function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    observer.observe(el);
    setWidth(el.getBoundingClientRect().width || 600);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function Slider({ offset, maxOffset, total, onOffset }: { offset: number; maxOffset: number; total: number; onOffset: (o: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const thumbPct = Math.min(100, (WINDOW_SIZE / total) * 100);
  const thumbLeft = maxOffset > 0 ? (offset / maxOffset) * (100 - thumbPct) : 0;

  function offsetFromX(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onOffset(Math.round(frac * maxOffset));
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
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

export function CpMonthlyTrendCard({ data, title = "MONTHLY TREND — CHANNEL PARTNER SALES", onBarClick }: { data: TrendPoint[]; title?: string; onBarClick?: (p: TrendPoint) => void }) {
  const [metric, setMetric] = useState<Metric>("units");
  const { tooltip, showTooltip, moveTooltip, hideTooltip } = useChartTooltip();
  const [containerRef, containerWidth] = useContainerWidth<HTMLDivElement>();
  const meta = METRIC_META[metric];

  const maxOffset = Math.max(0, data.length - WINDOW_SIZE);
  // Default to showing the LATEST window (most recent 12 months) —
  // reset whenever the underlying data changes (e.g. filters upstream).
  const [offset, setOffset] = useState(maxOffset);
  useEffect(() => { setOffset(maxOffset); }, [data.length, maxOffset]);

  if (data.length === 0) {
    return (
      <div style={CARD_STYLE}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#1a3752" }}>{title}</div>
        <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 10 }}>No booking history available.</p>
      </div>
    );
  }

  const visible = data.slice(offset, offset + WINDOW_SIZE);
  const maxVal = Math.max(...visible.map(d => d[metric]), 1);
  const H = 320;
  const PAD = { l: 62, r: 20, t: 30, b: 70 };
  const innerW = Math.max(containerWidth - PAD.l - PAD.r, 100);
  const innerH = H - PAD.t - PAD.b;
  const baseY = PAD.t + innerH;

  const n = visible.length;
  const slot = innerW / n;
  const barW = Math.max(6, Math.min(slot * 0.5, 56));
  const x = (i: number) => PAD.l + i * slot + (slot - barW) / 2;
  const rotate = slot < 70;

  return (
    <div style={CARD_STYLE}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexShrink: 0, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#1a3752" }}>{title}{onBarClick && <span style={{ fontSize: 11, fontWeight: 400, color: "#0097a7", marginLeft: 10 }}>click a month → CP breakdown</span>}</div>
        <div style={{ display: "inline-flex", background: "#f4f2ed", borderRadius: 999, padding: 3 }}>
          {(["units", "area", "tsv"] as Metric[]).map(m => (
            <button key={m} onClick={() => setMetric(m)}
              style={{
                border: "none", background: metric === m ? "#1E3163" : "transparent",
                color: metric === m ? "#fff" : "#4a5568", fontWeight: 700, fontSize: 12,
                padding: "6px 14px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
              }}>
              {METRIC_META[m].label}
            </button>
          ))}
        </div>
      </div>

      <Slider offset={offset} maxOffset={maxOffset} total={data.length} onOffset={setOffset} />

      <div ref={containerRef} style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        <svg width={containerWidth} height={H} style={{ display: "block" }}>
          {/* Gridlines + Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map(t => {
            const yv = PAD.t + innerH * (1 - t);
            return (
              <g key={t}>
                <line x1={PAD.l - 8} x2={containerWidth - PAD.r} y1={yv} y2={yv} stroke="#e2e8f0" strokeDasharray="4,4" />
                <text x={PAD.l - 16} y={yv + 5} fontSize="13" fontWeight={700} fill="#334155" textAnchor="end">{meta.fmt(maxVal * t)}</text>
              </g>
            );
          })}

          {/* Bars + value labels + hover targets */}
          {visible.map((d, i) => {
            const val = d[metric];
            const bh = maxVal > 0 ? (val / maxVal) * innerH : 0;
            const bx = x(i);
            const by = baseY - Math.max(bh, val > 0 ? 3 : 0);
            const labelX = bx + barW / 2;
            return (
              <g key={d.key}>
                <rect
                  x={PAD.l + i * slot} y={PAD.t} width={slot} height={innerH} fill="transparent"
                  onClick={() => onBarClick?.(d)}
                  style={{ cursor: onBarClick ? "pointer" : "default" }}
                  onMouseEnter={e => showTooltip(e, (
                    <>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.label}</div>
                      {tRow("Units", d.units.toLocaleString("en-IN"))}
                      {tRow("Area", d.area.toFixed(2) + " L sqft")}
                      {tRow("TSV", "₹" + d.tsv.toFixed(1) + " Cr")}
                    </>
                  ))}
                  onMouseMove={moveTooltip}
                  onMouseLeave={hideTooltip}
                />
                <rect x={bx} y={by} width={barW} height={Math.max(bh, val > 0 ? 3 : 0)} fill={meta.color} rx="3" style={{ pointerEvents: "none" }} />
                {val > 0 && (
                  <text x={labelX} y={by - 8} fontSize="12" fontWeight={700} fill="#334155" textAnchor="middle" style={{ pointerEvents: "none" }}>
                    {meta.fmt(val)}
                  </text>
                )}
                {rotate ? (
                  <text
                    x={labelX} y={baseY + 16} fontSize="11.5" fontWeight={600} fill="#475569"
                    textAnchor="end" transform={`rotate(-50 ${labelX} ${baseY + 16})`}
                  >
                    {d.label}
                  </text>
                ) : (
                  <text x={labelX} y={baseY + 22} fontSize="12.5" fontWeight={600} fill="#475569" textAnchor="middle">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <ChartTooltip tooltip={tooltip} />
    </div>
  );
}
