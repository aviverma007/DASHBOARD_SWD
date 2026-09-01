/** Shared footfall chart primitives + boards, used by both the
 * Footfall tab section and the drill-down drawer. All pure SVG/HTML,
 * styled to match the reference suite. */
import { useMemo, useState } from "react";
import { showTip, hideTip } from "../common/hoverTip";
import { Zoomable } from "../common/Zoomable";
import {
  FF, fNum, dayToDate, periodKeys, inPeriod, quarterLabel, ffFunnel,
  type FfRecord,
} from "../../utils/footfallLogic";

const BLUE = "#1E3163", TEAL = "#0e7490", GOLD = "#B8893C", GREEN = "#1a7a4a", RED = "#c0392b";
const PAL = ["#1E3163", "#0e7490", "#B8893C", "#1a7a4a", "#7b5cb8", "#c0392b", "#5a8a9c", "#a8821b", "#446688", "#888066"];

const CARD: React.CSSProperties = { background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)", padding: "16px 18px" };
/** Card inside a masonry (CSS columns) area: keeps natural height and
 * never splits across columns — fixes stretched-whitespace grids. */
const MCARD: React.CSSProperties = { ...CARD, breakInside: "avoid", marginBottom: 14 };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 15.5, fontWeight: 700, color: "var(--ink)", margin: 0 };
const CAP: React.CSSProperties = { fontSize: 11.5, color: "#c07a1a", marginTop: 2, marginBottom: 10 };

// ── Small chart primitives (SVG, matching the reference look) ──────────

function HBarList({ items, total, color, onPick, maxHeight, sortable }: {
  items: { key: number; label: string; value: number }[];
  total: number; color: string; onPick?: (key: number, label: string) => void;
  /** Cap the list area; longer lists scroll inside so paired cards
   * stay the same size. */
  maxHeight?: number;
  /** Show an ascending/descending toggle (default sort: descending). */
  sortable?: boolean;
}) {
  const [desc, setDesc] = useState(true);
  const shown = sortable ? [...items].sort((a, b) => (desc ? b.value - a.value : a.value - b.value)) : items;
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div>
      {sortable && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <button onClick={() => setDesc(v => !v)}
            style={{ border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "2px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", color: "var(--mut)" }}>
            {desc ? "↓ High → low" : "↑ Low → high"}
          </button>
        </div>
      )}
      <div style={maxHeight ? { maxHeight, overflowY: "auto", paddingRight: 6 } : undefined}>
      {shown.map(it => (
        <div key={it.key} onClick={() => onPick?.(it.key, it.label)} className="barrow"
          onMouseEnter={e => showTip(e, `<b>${it.label}</b><br/>${fNum(it.value)} · ${((it.value / Math.max(total, 1)) * 100).toFixed(1)}% of ${fNum(total)}`)}
          onMouseMove={e => showTip(e, `<b>${it.label}</b><br/>${fNum(it.value)} · ${((it.value / Math.max(total, 1)) * 100).toFixed(1)}% of ${fNum(total)}`)}
          onMouseLeave={hideTip}
          style={{ padding: "4px 0", cursor: onPick ? "pointer" : "default" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
            <span style={{ color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{it.label}</span>
            <span style={{ color: "var(--mut)" }}>{fNum(it.value)} · {((it.value / Math.max(total, 1)) * 100).toFixed(1)}%</span>
          </div>
          <div style={{ height: 9, background: "#f0ede5", borderRadius: 5 }}>
            <div style={{ height: "100%", width: `${(it.value / max) * 100}%`, background: color, borderRadius: 5 }} />
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

function Donut({ segs, onPick }: {
  segs: { key: number; label: string; value: number; color: string }[];
  onPick?: (key: number, label: string) => void;
}) {
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;
  const r = 62, cx = 76, cy = 76, sw = 23, C = 2 * Math.PI * r;
  let off = 0;
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", width: "100%" }}>
      <svg viewBox="0 0 152 152" width="152" height="152">
        {segs.map(s => {
          const len = (s.value / total) * C;
          const el = (
            <circle key={s.key} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw}
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ cursor: onPick ? "pointer" : "default" }}
              onClick={() => onPick?.(s.key, s.label)}
              onMouseEnter={e => showTip(e, `<b>${s.label}</b><br/>${fNum(s.value)} · ${((s.value / total) * 100).toFixed(1)}%`)}
              onMouseMove={e => showTip(e, `<b>${s.label}</b><br/>${fNum(s.value)} · ${((s.value / total) * 100).toFixed(1)}%`)}
              onMouseLeave={hideTip}
            />
          );
          off += len;
          return el;
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="Georgia,serif" fontSize="19" fontWeight="700" fill="var(--ink)">{fNum(total)}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" letterSpacing="1" fill="var(--mut)">TOTAL</text>
      </svg>
      {/* Legend: fixed value/percent columns beside the label so the
          numbers sit close and aligned — never flung to the card's far
          edge by the container width. */}
      <div style={{ flex: 1, minWidth: 220, maxWidth: 430 }}>
        {segs.map(s => (
          <div key={s.key} onClick={() => onPick?.(s.key, s.label)}
            onMouseEnter={e => showTip(e, `<b>${s.label}</b><br/>${fNum(s.value)} of ${fNum(total)} · ${((s.value / total) * 100).toFixed(1)}%`)}
            onMouseMove={e => showTip(e, `<b>${s.label}</b><br/>${fNum(s.value)} of ${fNum(total)} · ${((s.value / total) * 100).toFixed(1)}%`)}
            onMouseLeave={hideTip}
            style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, padding: "5px 0", cursor: onPick ? "pointer" : "default" }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
            <b style={{ width: 72, textAlign: "right", color: "var(--ink)", flexShrink: 0 }}>{fNum(s.value)}</b>
            <span style={{ color: "var(--mut)", width: 54, textAlign: "right", flexShrink: 0 }}>{((s.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ items, onPick }: {
  items: { key: string; label: string; value: number }[];
  onPick?: (key: string, label: string) => void;
}) {
  const w = 560, h = 170, padB = 24, padT = 20;
  const max = Math.max(...items.map(x => x.value), 1);
  const n = items.length || 1, gap = n > 24 ? 1 : 3, bw = (w - (n - 1) * gap) / n;
  const cy = (v: number) => h - padB - (v / max) * (h - padB - padT);
  const pts = items.map((it, i) => `${i * (bw + gap) + bw / 2},${cy(it.value)}`).join(" ");
  const every = Math.max(1, Math.ceil(n / 12));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: "block" }}>
      {items.map((it, i) => (
        <g key={it.key}>
          <rect x={i * (bw + gap)} y={cy(it.value)} width={bw} height={h - padB - cy(it.value)} rx="2" fill="#D7E2F0" />
          {/* full-height invisible hover/click target — thin bars and
              line dots become easy to hit */}
          <rect x={i * (bw + gap) - gap / 2} y={0} width={bw + gap} height={h - padB} fill="transparent"
            style={{ cursor: onPick ? "pointer" : "default" }} onClick={() => onPick?.(it.key, it.label)}
            onMouseEnter={e => showTip(e, `<b>${it.label}</b><br/>${fNum(it.value)}`)}
            onMouseMove={e => showTip(e, `<b>${it.label}</b><br/>${fNum(it.value)}`)}
            onMouseLeave={hideTip}
          />
        </g>
      ))}
      <polyline points={pts} fill="none" stroke={GOLD} strokeWidth="2" />
      {items.map((it, i) => (
        <circle key={"d" + it.key} cx={i * (bw + gap) + bw / 2} cy={cy(it.value)} r="2.6" fill={GOLD} />
      ))}
      {items.map((it, i) =>
        i % every === 0 ? (
          <text key={"l" + it.key} x={i * (bw + gap) + bw / 2} y={h - 8} textAnchor="middle" fontSize="9" fill="#8a93a6">{it.label}</text>
        ) : null
      )}
    </svg>
  );
}

function WeekdayChart({ items, onPick }: {
  items: { key: number; label: string; value: number }[];
  onPick?: (key: number, label: string) => void;
}) {
  const w = 560, h = 160, padB = 24, padT = 18;
  const max = Math.max(...items.map(x => x.value), 1);
  const gap = 14, bw = (w - 6 * gap) / 7;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: "block" }}>
      {items.map((it, i) => {
        const bh = (it.value / max) * (h - padB - padT);
        return (
          <g key={it.key} style={{ cursor: onPick ? "pointer" : "default" }} onClick={() => onPick?.(it.key, it.label)}
            onMouseEnter={e => showTip(e, `<b>${it.label}</b><br/>${fNum(it.value)} visits`)}
            onMouseMove={e => showTip(e, `<b>${it.label}</b><br/>${fNum(it.value)} visits`)}
            onMouseLeave={hideTip}>
            <rect x={i * (bw + gap)} y={0} width={bw} height={h - padB} fill="transparent" />
            <rect x={i * (bw + gap)} y={h - padB - bh} width={bw} height={bh} rx="4" fill={TEAL} opacity={0.85} />
            <text x={i * (bw + gap) + bw / 2} y={h - padB - bh - 5} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#0e7490">{fNum(it.value)}</text>
            <text x={i * (bw + gap) + bw / 2} y={h - 8} textAnchor="middle" fontSize="10" fontWeight="600" fill="#1f2937">{it.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Conversion funnel — table-format breakdown (step · volume bar ·
 * share of footfall · step conversion · drop-off). Compact rows with
 * inline bars instead of trapezoids: text never overflows however
 * small a band gets, and degenerate cases (a stage filter making
 * every step equal, or zero) still render cleanly. */
function FunnelChart({ records }: { records: FfRecord[] }) {
  const { steps, lost, blank } = ffFunnel(records);
  const max = Math.max(steps[0].value, 1);
  const COLORS = [BLUE, TEAL, GOLD, GREEN];
  const cell: React.CSSProperties = { padding: "9px 10px", fontSize: 12.5, verticalAlign: "middle" };
  const th: React.CSSProperties = { ...cell, padding: "5px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "var(--mut)", textAlign: "left" };
  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--line)" }}>
              <th style={{ ...th, width: 118 }}>Step</th>
              <th style={th}>Volume</th>
              <th style={{ ...th, width: 92, textAlign: "right" }}>Of footfall</th>
              <th style={{ ...th, width: 110, textAlign: "right" }}>Step conv.</th>
              <th style={{ ...th, width: 110, textAlign: "right" }}>Drop-off</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s, i) => {
              const prev = i === 0 ? s.value : steps[i - 1].value;
              const drop = i === 0 ? 0 : prev - s.value;
              return (
                <tr key={s.key} style={{ borderBottom: "1px solid var(--line)" }}
                  onMouseEnter={e => showTip(e, `<b>${s.label}</b><br/>${fNum(s.value)} · ${s.pctOfTotal.toFixed(1)}% of total${i > 0 ? `<br/>step conv ${s.pctOfPrev.toFixed(1)}% · drop −${fNum(prev - s.value)}` : ""}`)}
                  onMouseMove={e => showTip(e, `<b>${s.label}</b><br/>${fNum(s.value)} · ${s.pctOfTotal.toFixed(1)}% of total${i > 0 ? `<br/>step conv ${s.pctOfPrev.toFixed(1)}% · drop −${fNum(prev - s.value)}` : ""}`)}
                  onMouseLeave={hideTip}>
                  <td style={{ ...cell, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    {s.label}
                    <div style={{ fontSize: 10, fontWeight: 400, color: "var(--mut)" }}>{s.hint}</div>
                  </td>
                  <td style={{ ...cell, minWidth: 160 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 18, background: "#f0ede5", borderRadius: 6, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(s.value / max) * 100}%`, background: COLORS[i], borderRadius: 6, transition: "width 0.4s cubic-bezier(0.22,1,0.36,1)" }} />
                      </div>
                      <b style={{ fontFamily: "Georgia,serif", fontSize: 13.5, color: "var(--ink)", whiteSpace: "nowrap" }}>{fNum(s.value)}</b>
                    </div>
                  </td>
                  <td style={{ ...cell, textAlign: "right", color: "var(--mut)", whiteSpace: "nowrap" }}>{s.pctOfTotal.toFixed(1)}%</td>
                  <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap", fontWeight: 700, color: i === 0 ? "var(--mut)" : s.pctOfPrev >= 50 ? "#1a7a4a" : "#c07a1a" }}>
                    {i === 0 ? "—" : `${s.pctOfPrev.toFixed(1)}%`}
                  </td>
                  <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap", color: drop > 0 ? "#c0392b" : "var(--mut)" }}>
                    {i === 0 ? "—" : drop > 0 ? `−${fNum(drop)}` : "0"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 8 }}>
        Leakage: <b style={{ color: RED }}>{fNum(lost)}</b> closed lost ({((lost / Math.max(records.length, 1)) * 100).toFixed(1)}%)
        {blank > 0 && <> · {fNum(blank)} without a stage</>}
        {" "}· stages are current statuses, so each step is the population now at-or-beyond it
      </div>
    </div>
  );
}


/** Teal section banner, reference-style. */
function Banner({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#0e7490", color: "#fff", borderRadius: 8, padding: "7px 16px", margin: "18px 0 12px", boxShadow: "0 2px 8px rgba(14,116,144,.25)" }}>
      <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "1.4px" }}>{title}</span>
      <span style={{ fontSize: 11.5, opacity: 0.9 }}>{sub}</span>
    </div>
  );
}

/** Tiny sparkline for the Footfall KPI (monthly counts). */
function Spark({ items }: { items: { value: number }[] }) {
  if (items.length < 2) return null;
  const w = 120, h = 26, max = Math.max(...items.map(i => i.value), 1);
  const pts = items.map((it, i) => `${(i / (items.length - 1)) * w},${h - 3 - (it.value / max) * (h - 6)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: "block", marginTop: 6 }}>
      <polyline points={pts} fill="none" stroke="#0e7490" strokeWidth="1.8" />
    </svg>
  );
}

const SEL: React.CSSProperties = { fontFamily: "inherit", fontSize: 13, padding: "8px 12px", borderRadius: 9, border: "1.5px solid #cfd6e2", background: "#fff", color: "var(--ink)", cursor: "pointer", minWidth: 170 };
const SELLBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--mut)", marginBottom: 5 };

/** Momentum & comparison — two periods side by side, Quarter/Year switch. */
function MomentumCard({ records, showBooked = true }: { records: FfRecord[]; showBooked?: boolean }) {
  const [mode, setMode] = useState<"quarter" | "year">("quarter");
  const keys = useMemo(() => periodKeys(records, mode), [records, mode]);
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const ka = a && keys.includes(a) ? a : keys[keys.length - 2] ?? keys[0];
  const kb = b && keys.includes(b) ? b : keys[keys.length - 1];
  if (!keys.length) return null;

  const lab = (k: string) => (mode === "quarter" ? quarterLabel(k) : k);
  const scope = (k: string) => records.filter(r => inPeriod(r, mode, k));
  const ra = scope(ka), rb = scope(kb);
  const BOOKED = FF.STG.indexOf("Booked");
  const metrics: { name: string; fn: (rs: FfRecord[]) => number }[] = [
    { name: "Site visits", fn: rs => rs.length },
    { name: "Direct visits", fn: rs => rs.filter(r => r.src === 0 || r.src === 2).length },
    { name: "With channel partner", fn: rs => rs.filter(r => r.src === 1).length },
    ...(showBooked ? [{ name: "Booked", fn: (rs: FfRecord[]) => rs.filter(r => r.stg === BOOKED).length }] : []),
  ];
  const isLatestPartial = kb === keys[keys.length - 1];

  const Toggle = ({ v, label }: { v: "quarter" | "year"; label: string }) => (
    <button onClick={() => { setMode(v); setA(null); setB(null); }}
      style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 7, border: "1.5px solid " + (mode === v ? "#14213d" : "#cfd6e2"), background: mode === v ? "#14213d" : "#fff", color: mode === v ? "#fff" : "var(--ink)", cursor: "pointer" }}>
      {label}
    </button>
  );

  return (
    <div style={{ ...CARD, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h3 style={H3}>Momentum &amp; comparison</h3>
          <div style={{ ...CAP, marginBottom: 0 }}>Footfall in two periods, side by side · pick either period</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Toggle v="quarter" label="Quarter" /><Toggle v="year" label="Year" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
        <div>
          <div style={SELLBL}>Period A</div>
          <select style={{ ...SEL, minWidth: 120 }} value={ka} onChange={e => setA(e.target.value)}>
            {keys.map(k => <option key={k} value={k}>{lab(k)}</option>)}
          </select>
        </div>
        <div>
          <div style={SELLBL}>Period B</div>
          <select style={{ ...SEL, minWidth: 120 }} value={kb} onChange={e => setB(e.target.value)}>
            {keys.map(k => <option key={k} value={k}>{lab(k)}</option>)}
          </select>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--line)" }}>
            <th style={{ textAlign: "left", padding: "6px 8px 6px 0", fontSize: 10.5, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)" }}>Metric</th>
            <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 10.5, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)" }}>{lab(ka)}</th>
            <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 10.5, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)" }}>{lab(kb)}</th>
            <th style={{ textAlign: "right", padding: "6px 0 6px 8px", fontSize: 10.5, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)" }}>Δ</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map(m => {
            const va = m.fn(ra), vb = m.fn(rb);
            const d = va ? ((vb - va) / va) * 100 : vb ? 100 : 0;
            return (
              <tr key={m.name} style={{ borderBottom: "1px solid var(--line)" }}
                onMouseEnter={e => showTip(e, `<b>${m.name}</b><br/>${lab(ka)}: ${fNum(va)} → ${lab(kb)}: ${fNum(vb)}<br/>Δ ${d >= 0 ? "+" : ""}${d.toFixed(1)}%`)}
                onMouseMove={e => showTip(e, `<b>${m.name}</b><br/>${lab(ka)}: ${fNum(va)} → ${lab(kb)}: ${fNum(vb)}<br/>Δ ${d >= 0 ? "+" : ""}${d.toFixed(1)}%`)}
                onMouseLeave={hideTip}>
                <td style={{ padding: "8px 8px 8px 0", color: "var(--ink)" }}>{m.name}</td>
                <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: "Georgia,serif", fontWeight: 700 }}>{fNum(va)}</td>
                <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: "Georgia,serif", fontWeight: 700 }}>{fNum(vb)}</td>
                <td style={{ padding: "8px 0 8px 8px", textAlign: "right", fontWeight: 700, color: d < 0 ? "#c0392b" : "#1a7a4a" }}>{d >= 0 ? "+" : ""}{d.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {isLatestPartial && <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 8 }}>Period B is the latest {mode} and may be partial.</div>}
    </div>
  );
}

/** Channel-partner performance board: search, compare, paginate. */
function CpBoard({ rows, onDrill, showBooked = true, visitsLabel = "Customer visits" }: { rows: FfRecord[]; onDrill: (cpIdx: number, name: string) => void; showBooked?: boolean; visitsLabel?: string }) {
  const [q, setQ] = useState("");
  const [pg, setPg] = useState(1);
  const [compareMode, setCompareMode] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const PER = 10;

  const partners = useMemo(() => {
    const m = new Map<number, { visits: number; projects: Set<number>; galleries: Set<number>; last: number; booked: number }>();
    const BOOKED = FF.STG.indexOf("Booked");
    rows.forEach(r => {
      if (r.cp < 0 || r.src !== 1) return;
      const e = m.get(r.cp) ?? { visits: 0, projects: new Set<number>(), galleries: new Set<number>(), last: -1, booked: 0 };
      e.visits++;
      if (r.p >= 0) e.projects.add(r.p);
      if (r.g >= 0) e.galleries.add(r.g);
      if (r.day > e.last) e.last = r.day;
      if (r.stg === BOOKED) e.booked++;
      m.set(r.cp, e);
    });
    return [...m.entries()]
      .map(([cp, e]) => ({ cp, name: FF.CPN[cp], ...e }))
      .sort((x, y) => y.visits - x.visits);
  }, [rows]);

  const cpTotal = partners.reduce((s, p) => s + p.visits, 0);
  const filtered = q ? partners.filter(p => p.name.toLowerCase().includes(q.toLowerCase())) : partners;
  const pages = Math.max(1, Math.ceil(filtered.length / PER));
  const page = Math.min(pg, pages);
  const shown = filtered.slice((page - 1) * PER, page * PER);
  const selected = partners.filter(p => sel.has(p.cp));

  function toggleSel(cp: number) {
    setSel(prev => {
      const next = new Set(prev);
      if (next.has(cp)) next.delete(cp);
      else if (next.size < 3) next.add(cp);
      return next;
    });
  }
  const fdate = (d: number) => d >= 0 ? dayToDate(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

  return (
    <div style={{ ...CARD, paddingBottom: 8 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={q} onChange={e => { setQ(e.target.value); setPg(1); }}
          placeholder="Search channel partner…"
          style={{ flex: 1, minWidth: 220, fontFamily: "inherit", fontSize: 13, padding: "9px 14px", borderRadius: 9, border: "1.5px solid #cfd6e2", background: "#fff" }}
        />
        <button
          onClick={() => { setCompareMode(v => !v); setSel(new Set()); }}
          style={{ fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, padding: "9px 16px", borderRadius: 9, border: "1.5px solid " + (compareMode ? "#14213d" : "#cfd6e2"), background: compareMode ? "#14213d" : "#fff", color: compareMode ? "#fff" : "var(--ink)", cursor: "pointer" }}>
          {compareMode ? "Exit compare" : "Compare partners"}
        </button>
      </div>
      {compareMode && (
        <div style={{ fontSize: 11.5, color: "#c07a1a", marginTop: 7 }}>Tick up to 3 partners to compare side by side.</div>
      )}

      {/* Comparison panel */}
      {compareMode && selected.length >= 2 && (
        <div style={{ overflowX: "auto", marginTop: 10, background: "#f8f7f3", borderRadius: 10, padding: "12px 14px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--line)" }}>
                <th style={{ textAlign: "left", padding: "5px 8px 5px 0", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "1px", color: "var(--mut)" }}>Metric</th>
                {selected.map(p => <th key={p.cp} style={{ textAlign: "right", padding: "5px 8px", fontSize: 11.5, color: "var(--ink)" }}>{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {([
                ["Customer visits", (p: typeof selected[number]) => fNum(p.visits)],
                ["Share of CP footfall", (p: typeof selected[number]) => ((p.visits / Math.max(cpTotal, 1)) * 100).toFixed(1) + "%"],
                ["Projects", (p: typeof selected[number]) => String(p.projects.size)],
                ["Galleries", (p: typeof selected[number]) => String(p.galleries.size)],
                ...(showBooked ? [
                  ["Booked", (p: typeof selected[number]) => fNum(p.booked)],
                  ["Conversion", (p: typeof selected[number]) => ((p.booked / Math.max(p.visits, 1)) * 100).toFixed(1) + "%"],
                ] as [string, (p: typeof selected[number]) => string][] : []),
                ["Last visit", (p: typeof selected[number]) => fdate(p.last)],
              ] as [string, (p: typeof selected[number]) => string][]).map(([name, fn]) => (
                <tr key={name} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px 8px 6px 0", color: "var(--ink)" }}>{name}</td>
                  {selected.map(p => <td key={p.cp} style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{fn(p)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ overflowX: "auto", marginTop: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--line)" }}>
              {compareMode && <th style={{ width: 30 }} />}
              {["Channel partner", visitsLabel, "Share", "Projects", "Galleries", ...(showBooked ? ["Booked"] : []), "Last visit"].map((h, i) => (
                <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: i === 0 ? "7px 8px 7px 0" : "7px 8px", color: "var(--mut)", fontSize: 10.5, letterSpacing: "1px", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(p => (
              <tr key={p.cp}
                onClick={() => compareMode ? toggleSel(p.cp) : onDrill(p.cp, p.name)}
                onMouseEnter={e => showTip(e, `<b>${p.name}</b><br/>${fNum(p.visits)} visits · ${((p.visits / Math.max(cpTotal, 1)) * 100).toFixed(1)}% share<br/>${p.projects.size} projects · ${p.galleries.size} galleries · last ${fdate(p.last)}`)}
                onMouseMove={e => showTip(e, `<b>${p.name}</b><br/>${fNum(p.visits)} visits · ${((p.visits / Math.max(cpTotal, 1)) * 100).toFixed(1)}% share<br/>${p.projects.size} projects · ${p.galleries.size} galleries · last ${fdate(p.last)}`)}
                onMouseLeave={hideTip}
                style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }}>
                {compareMode && (
                  <td style={{ padding: "7px 4px" }}>
                    <input type="checkbox" readOnly checked={sel.has(p.cp)} />
                  </td>
                )}
                <td style={{ padding: "7px 8px 7px 0", fontWeight: 600, color: "var(--ink)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "Georgia,serif", fontWeight: 700 }}>{fNum(p.visits)}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--mut)" }}>{((p.visits / Math.max(cpTotal, 1)) * 100).toFixed(1)}%</td>
                <td style={{ padding: "7px 8px", textAlign: "right" }}>{p.projects.size}</td>
                <td style={{ padding: "7px 8px", textAlign: "right" }}>{p.galleries.size}</td>
                {showBooked && (
                  <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: p.booked > 0 ? "#1a7a4a" : "var(--mut)" }}>{fNum(p.booked)}</td>
                )}
                <td style={{ padding: "7px 8px", textAlign: "right", whiteSpace: "nowrap" }}>{fdate(p.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0 6px", fontSize: 12.5, color: "var(--mut)" }}>
        <span>{filtered.length ? (page - 1) * PER + 1 : 0}—{Math.min(page * PER, filtered.length)} of {fNum(filtered.length)}</span>
        <button disabled={page <= 1} onClick={() => setPg(p => p - 1)} style={{ marginLeft: "auto", border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "5px 12px", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.45 : 1, fontFamily: "inherit" }}>‹ Prev</button>
        <button disabled={page >= pages} onClick={() => setPg(p => p + 1)} style={{ border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "5px 12px", cursor: page >= pages ? "default" : "pointer", opacity: page >= pages ? 0.45 : 1, fontFamily: "inherit" }}>Next ›</button>
      </div>
    </div>
  );
}


/** Stacked horizontal bars: each row shows the overall count with a
 * darker "highlight" segment inside it (e.g. qualified enquiries
 * within a channel's total). Sortable, scrollable, tooltipped. */
function StackedHBarList({ items, total, color, hlColor, hlLabel, onPick, maxHeight, sortable }: {
  items: { key: number; label: string; value: number; hl: number }[];
  total: number; color: string; hlColor: string; hlLabel: string;
  onPick?: (key: number, label: string) => void;
  maxHeight?: number; sortable?: boolean;
}) {
  const [desc, setDesc] = useState(true);
  const shown = sortable ? [...items].sort((a, b) => (desc ? b.value - a.value : a.value - b.value)) : items;
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ display: "flex", gap: 12, fontSize: 10.5, color: "var(--mut)" }}>
          <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: color, marginRight: 4 }} />Total</span>
          <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: hlColor, marginRight: 4 }} />{hlLabel}</span>
        </div>
        {sortable && (
          <button onClick={() => setDesc(v => !v)}
            style={{ border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "2px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", color: "var(--mut)" }}>
            {desc ? "↓ High → low" : "↑ Low → high"}
          </button>
        )}
      </div>
      <div style={maxHeight ? { maxHeight, overflowY: "auto", paddingRight: 6 } : undefined}>
        {shown.map(it => (
          <div key={it.key} onClick={() => onPick?.(it.key, it.label)} className="barrow"
            onMouseEnter={e => showTip(e, `<b>${it.label}</b><br/>${fNum(it.value)} total · ${((it.value / Math.max(total, 1)) * 100).toFixed(1)}%<br/>${hlLabel}: ${fNum(it.hl)} (${((it.hl / Math.max(it.value, 1)) * 100).toFixed(1)}%)`)}
            onMouseMove={e => showTip(e, `<b>${it.label}</b><br/>${fNum(it.value)} total · ${((it.value / Math.max(total, 1)) * 100).toFixed(1)}%<br/>${hlLabel}: ${fNum(it.hl)} (${((it.hl / Math.max(it.value, 1)) * 100).toFixed(1)}%)`)}
            onMouseLeave={hideTip}
            style={{ padding: "4px 0", cursor: onPick ? "pointer" : "default" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
              <span style={{ color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{it.label}</span>
              <span style={{ color: "var(--mut)", whiteSpace: "nowrap" }}>{fNum(it.value)} · <b style={{ color: hlColor }}>{fNum(it.hl)}</b> {hlLabel.toLowerCase()}</span>
            </div>
            <div style={{ height: 9, background: "#f0ede5", borderRadius: 5, overflow: "hidden", position: "relative" }}>
              <div className="hb" style={{ position: "absolute", inset: 0, width: `${(it.value / max) * 100}%`, background: color, borderRadius: 5, opacity: 0.45, transition: "opacity 0.15s" }} />
              <div style={{ position: "absolute", inset: 0, width: `${(it.hl / max) * 100}%`, background: hlColor, borderRadius: 5 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Maximize/minimize: every chart ships with a ⛶ button that opens
   it enlarged in a centred overlay (click outside / Esc / ✕ closes).
   Implemented at primitive level so ALL cards on all lead pages and
   inside every drill drawer get it automatically. ── */
function zoomed<P extends object>(Inner: (p: P) => React.ReactNode, title: string) {
  return function Zoomed(props: P) {
    return <Zoomable title={title} btnTop={-46} btnRight={-4}>{Inner(props)}</Zoomable>;
  };
}
const HBarListZ = zoomed(HBarList, "Bar breakdown");
const StackedHBarListZ = zoomed(StackedHBarList, "Stacked breakdown");
const DonutZ = zoomed(Donut, "Distribution");
const TrendChartZ = zoomed(TrendChart, "Trend");
const WeekdayChartZ = zoomed(WeekdayChart, "Weekday pattern");
const FunnelChartZ = zoomed(FunnelChart, "Conversion funnel");

export { HBarListZ as HBarList, StackedHBarListZ as StackedHBarList, DonutZ as Donut, TrendChartZ as TrendChart, WeekdayChartZ as WeekdayChart, FunnelChartZ as FunnelChart, HBarList as HBarListRaw, Banner, Spark, MomentumCard, CpBoard, CARD, MCARD, H3, CAP, SEL, SELLBL, PAL, BLUE, TEAL, GOLD, GREEN, RED };
