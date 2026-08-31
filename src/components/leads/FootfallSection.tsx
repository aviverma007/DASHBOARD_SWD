import { useMemo, useState } from "react";
import {
  FF, ffScope, ffCount, ffMonthly, ffWeekday, ffFunnel, fNum, dayToDate,
  periodKeys, inPeriod, quarterLabel, periodPresets, type PeriodPreset,
  type FfFilter, type FfDim, type FfRecord,
} from "../../utils/footfallLogic";

/** Customer-footfall analysis, modelled on the reference suite's
 * footfall tab and rebuilt over the 21-Aug export (54,222 visits):
 * KPI strip · click-to-filter cards (gallery, source donut, project,
 * locality, age donut, monthly trend, weekday) · a conversion FUNNEL
 * from Opportunity Stage (our addition) · paginated records table.
 * Clicking any bar/slice/month/weekday narrows every card at once;
 * active filters show as removable chips. */

const BLUE = "#1E3163", TEAL = "#0e7490", GOLD = "#B8893C", GREEN = "#1a7a4a", RED = "#c0392b";
const PAL = ["#1E3163", "#0e7490", "#B8893C", "#1a7a4a", "#7b5cb8", "#c0392b", "#5a8a9c", "#a8821b", "#446688", "#888066"];

const CARD: React.CSSProperties = { background: "#fff", borderRadius: 12, border: "1px solid #e4e0d6", boxShadow: "0 1px 4px rgba(20,33,61,.06)", padding: "16px 18px" };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 15.5, fontWeight: 700, color: "var(--ink)", margin: 0 };
const CAP: React.CSSProperties = { fontSize: 11.5, color: "#c07a1a", marginTop: 2, marginBottom: 10 };

// ── Small chart primitives (SVG, matching the reference look) ──────────

function HBarList({ items, total, color, onPick }: {
  items: { key: number; label: string; value: number }[];
  total: number; color: string; onPick?: (key: number, label: string) => void;
}) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div>
      {items.map(it => (
        <div key={it.key} onClick={() => onPick?.(it.key, it.label)} style={{ padding: "4px 0", cursor: onPick ? "pointer" : "default" }} className="barrow">
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
  );
}

function Donut({ segs, onPick }: {
  segs: { key: number; label: string; value: number; color: string }[];
  onPick?: (key: number, label: string) => void;
}) {
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;
  const r = 54, cx = 66, cy = 66, sw = 20, C = 2 * Math.PI * r;
  let off = 0;
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox="0 0 132 132" width="132" height="132">
        {segs.map(s => {
          const len = (s.value / total) * C;
          const el = (
            <circle key={s.key} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw}
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ cursor: onPick ? "pointer" : "default" }}
              onClick={() => onPick?.(s.key, s.label)}
            />
          );
          off += len;
          return el;
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="Georgia,serif" fontSize="17" fontWeight="700" fill="var(--ink)">{fNum(total)}</text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="8.5" letterSpacing="1" fill="var(--mut)">TOTAL</text>
      </svg>
      <div style={{ flex: 1, minWidth: 150 }}>
        {segs.map(s => (
          <div key={s.key} onClick={() => onPick?.(s.key, s.label)} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, padding: "3px 0", cursor: onPick ? "pointer" : "default" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
            <b style={{ marginLeft: "auto", color: "var(--ink)" }}>{fNum(s.value)}</b>
            <span style={{ color: "var(--mut)", width: 44, textAlign: "right" }}>{((s.value / total) * 100).toFixed(1)}%</span>
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
        <rect key={it.key} x={i * (bw + gap)} y={cy(it.value)} width={bw} height={h - padB - cy(it.value)} rx="2" fill="#D7E2F0"
          style={{ cursor: onPick ? "pointer" : "default" }} onClick={() => onPick?.(it.key, it.label)}>
          <title>{it.label}: {fNum(it.value)}</title>
        </rect>
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
          <g key={it.key} style={{ cursor: onPick ? "pointer" : "default" }} onClick={() => onPick?.(it.key, it.label)}>
            <rect x={i * (bw + gap)} y={h - padB - bh} width={bw} height={bh} rx="4" fill={TEAL} opacity={0.85}>
              <title>{it.label}: {fNum(it.value)}</title>
            </rect>
            <text x={i * (bw + gap) + bw / 2} y={h - padB - bh - 5} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#0e7490">{fNum(it.value)}</text>
            <text x={i * (bw + gap) + bw / 2} y={h - 8} textAnchor="middle" fontSize="10" fontWeight="600" fill="#1f2937">{it.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Conversion funnel — trapezoid bands narrowing by population, with
 * step-to-step and of-total percentages, plus the closed-lost leak. */
function FunnelChart({ records }: { records: FfRecord[] }) {
  const { steps, lost, blank } = ffFunnel(records);
  const w = 560, bandH = 54, gapH = 26, padX = 10;
  const h = steps.length * bandH + (steps.length - 1) * gapH + 8;
  const max = Math.max(steps[0].value, 1);
  const COLORS = [BLUE, TEAL, GOLD, GREEN];
  const widthFor = (v: number) => Math.max((v / max) * (w - padX * 2), 60);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: "block" }}>
        {steps.map((s, i) => {
          const topW = widthFor(s.value);
          const nextW = i < steps.length - 1 ? widthFor(steps[i + 1].value) : topW;
          const y = i * (bandH + gapH);
          const x0 = (w - topW) / 2, x1 = (w - nextW) / 2;
          return (
            <g key={s.key}>
              <rect x={x0} y={y} width={topW} height={bandH} rx="9" fill={COLORS[i]} />
              {i < steps.length - 1 && (
                <path d={`M${x1} ${y + bandH + gapH} L${x0 + topW / 2 - 12} ${y + bandH} L${x0 + topW / 2 + 12} ${y + bandH} L${w - x1} ${y + bandH + gapH} Z`}
                  fill={COLORS[i + 1]} opacity="0.18" />
              )}
              <text x={w / 2} y={y + 22} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{s.label} — {fNum(s.value)}</text>
              <text x={w / 2} y={y + 40} textAnchor="middle" fontSize="10.5" fill="rgba(255,255,255,.85)">
                {s.pctOfTotal.toFixed(1)}% of footfall{i > 0 ? ` · ${s.pctOfPrev.toFixed(1)}% of previous` : ""}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 8 }}>
        Leakage: <b style={{ color: RED }}>{fNum(lost)}</b> closed lost ({((lost / Math.max(records.length, 1)) * 100).toFixed(1)}%)
        {blank > 0 && <> · {fNum(blank)} without a stage</>}
        {" "}· stages are current statuses, so each band is the population now at-or-beyond that step
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
function MomentumCard({ records }: { records: FfRecord[] }) {
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
    { name: "Booked", fn: rs => rs.filter(r => r.stg === BOOKED).length },
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
              <tr key={m.name} style={{ borderBottom: "1px solid var(--line)" }}>
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
function CpBoard({ rows, onDrill }: { rows: FfRecord[]; onDrill: (cpIdx: number, name: string) => void }) {
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
                ["Booked", (p: typeof selected[number]) => fNum(p.booked)],
                ["Conversion", (p: typeof selected[number]) => ((p.booked / Math.max(p.visits, 1)) * 100).toFixed(1) + "%"],
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
              {["Channel partner", "Customer visits", "Share", "Projects", "Galleries", "Last visit"].map((h, i) => (
                <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: i === 0 ? "7px 8px 7px 0" : "7px 8px", color: "var(--mut)", fontSize: 10.5, letterSpacing: "1px", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(p => (
              <tr key={p.cp}
                onClick={() => compareMode ? toggleSel(p.cp) : onDrill(p.cp, p.name)}
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

// ── Main section ──────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export function FootfallSection() {
  const [filters, setFilters] = useState<FfFilter[]>([]);
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState<-1 | 1>(-1);
  const PRESETS = useMemo(() => periodPresets(), []);
  const [perKey, setPerKey] = useState("all");
  const per: PeriodPreset = PRESETS.find(p => p.key === perKey) ?? PRESETS[0];

  // Dimension filters first, then the global period window
  const dimRows = useMemo(() => ffScope(filters), [filters]);
  const rows = useMemo(
    () => (per.key === "all" ? dimRows : dimRows.filter(r => r.day >= per.from && r.day <= per.to)),
    [dimRows, per]
  );
  const total = rows.length;

  function addFilter(dim: FfDim, val: number | string, label: string) {
    setFilters(prev => [...prev.filter(f => f.dim !== dim), { dim, val, label }]);
    setPage(1);
  }
  function removeFilter(dim: FfDim) {
    setFilters(prev => prev.filter(f => f.dim !== dim));
    setPage(1);
  }
  const has = (dim: FfDim) => filters.some(f => f.dim === dim);

  // KPI computations (mirroring the reference)
  const direct = rows.filter(r => r.src === 0 || r.src === 2).length;
  const withCp = rows.filter(r => r.src === 1).length;
  const uProj = new Set(rows.map(r => r.p)).size;
  const activeDays = new Set(rows.filter(r => r.day >= 0).map(r => r.day)).size;
  const perDay = activeDays ? total / activeDays : 0;
  const bookedPct = total ? (rows.filter(r => FF.STG[r.stg] === "Booked").length / total) * 100 : 0;

  const monthly = useMemo(() => ffMonthly(rows), [rows]);
  const weekday = useMemo(() => ffWeekday(rows), [rows]);

  const listFrom = (map: Map<number, number>, names: string[], top = 10) =>
    [...map.entries()].filter(([k]) => k >= 0).map(([key, value]) => ({ key, label: names[key], value }))
      .sort((a, b) => b.value - a.value).slice(0, top);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => sortDir * (a.day - b.day)),
    [rows, sortDir]
  );
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const shown = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const KPI = ({ l, v, s }: { l: string; v: string; s?: string }) => (
    <div className="card" style={{ ...CARD, padding: "13px 16px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)" }}>{l}</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginTop: 3 }}>{v}</div>
      {s && <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 1 }}>{s}</div>}
    </div>
  );

  const projFilter = filters.find(f => f.dim === "p");

  return (
    <div>
      {/* Global filter bar — project + period, reference-style */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={SELLBL}>Project / campaign</div>
          <select
            style={SEL}
            value={projFilter ? String(projFilter.val) : "all"}
            onChange={e => {
              const v = e.target.value;
              if (v === "all") removeFilter("p");
              else addFilter("p", Number(v), FF.P[Number(v)]);
            }}
          >
            <option value="all">All projects</option>
            {FF.P.map((p, i) => <option key={p} value={i}>{p}</option>)}
          </select>
        </div>
        <div>
          <div style={SELLBL}>Period</div>
          <select style={SEL} value={per.key} onChange={e => { setPerKey(e.target.value); setPage(1); }}>
            {PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* Momentum & comparison (own periods; respects dimension filters) */}
      <MomentumCard records={dimRows} />

      {/* Active filter chips */}
      {filters.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 11.5, color: "var(--mut)" }}>Filtered by:</span>
          {filters.map(f => (
            <button key={f.dim} onClick={() => removeFilter(f.dim)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#1E3163", color: "#fff", border: "none", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
              {f.label} <span style={{ opacity: 0.7 }}>✕</span>
            </button>
          ))}
          <button onClick={() => { setFilters([]); setPage(1); }}
            style={{ background: "none", border: "none", color: "#c07a1a", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            Clear all
          </button>
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 14 }}>
        <div className="card" style={{ ...CARD, padding: "13px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)" }}>Footfall</div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginTop: 3 }}>{fNum(total)}</div>
          <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 1 }}>{per.label} · till {FF.meta.asOn}</div>
          <Spark items={monthly.slice(-18)} />
        </div>
        <KPI l="Direct" v={fNum(direct)} s={`${((direct / Math.max(total, 1)) * 100).toFixed(1)}% of visits`} />
        <KPI l="With CP" v={fNum(withCp)} s={`${((withCp / Math.max(total, 1)) * 100).toFixed(1)}% of visits`} />
        <KPI l="Projects visited" v={fNum(uProj)} s="unique projects/campaigns" />
        <KPI l="Avg / active day" v={perDay.toFixed(0)} s={`${fNum(activeDays)} active days`} />
        <KPI l="Booking conversion" v={bookedPct.toFixed(1) + "%"} s="of footfall booked" />
      </div>

      <div><Banner title="FOOTFALL ANALYSIS" sub={`${fNum(total)} customer visits · ${per.label}`} /></div>

      {/* Funnel — our addition on top of the reference layout */}
      <div style={{ ...CARD, marginBottom: 14 }}>
        <h3 style={H3}>Conversion funnel</h3>
        <div style={CAP}>Footfall → pipeline → progressed → booked · recomputes with every filter</div>
        <FunnelChart records={rows} />
      </div>

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 14 }}>
        {!has("g") && (
          <div style={CARD}>
            <h3 style={H3}>Footfall by gallery</h3>
            <div style={CAP}>click → gallery</div>
            <HBarList items={listFrom(ffCount(rows, r => r.g), FF.G)} total={total} color={BLUE} onPick={(k, l) => addFilter("g", k, l)} />
          </div>
        )}
        {!has("src") && (
          <div style={CARD}>
            <h3 style={H3}>Direct vs channel-partner</h3>
            <div style={CAP}>walk-in source · click a slice</div>
            <Donut
              segs={[
                { key: 1, label: "With CP", value: withCp, color: TEAL },
                { key: 0, label: "Direct", value: rows.filter(r => r.src === 0).length, color: BLUE },
                { key: 2, label: "Direct Loyalty", value: rows.filter(r => r.src === 2).length, color: GOLD },
              ].filter(s => s.value > 0)}
              onPick={(k, l) => addFilter("src", k, l)}
            />
          </div>
        )}
        {!has("p") && (
          <div style={CARD}>
            <h3 style={H3}>Footfall by project</h3>
            <div style={CAP}>top 10 · click → project</div>
            <HBarList items={listFrom(ffCount(rows, r => r.p), FF.P)} total={total} color={GOLD} onPick={(k, l) => addFilter("p", k, l)} />
          </div>
        )}
        {!has("loc") && (
          <div style={CARD}>
            <h3 style={H3}>Customer locality</h3>
            <div style={CAP}>top 10 · click → locality</div>
            <HBarList items={listFrom(ffCount(rows, r => r.loc), FF.LOC)} total={total} color={TEAL} onPick={(k, l) => addFilter("loc", k, l)} />
          </div>
        )}
        {!has("age") && (
          <div style={CARD}>
            <h3 style={H3}>Age group</h3>
            <div style={CAP}>
              {fNum(rows.filter(r => r.age >= 0).length)} of {fNum(total)} captured · click a band
            </div>
            <Donut
              segs={listFrom(ffCount(rows, r => r.age), FF.AGE, 12).map((s, i) => ({ ...s, color: PAL[i % PAL.length] }))}
              onPick={(k, l) => addFilter("age", k, l)}
            />
          </div>
        )}
        {!has("stg") && (
          <div style={CARD}>
            <h3 style={H3}>Opportunity stage</h3>
            <div style={CAP}>current status mix · click a stage</div>
            <Donut
              segs={listFrom(ffCount(rows, r => r.stg), FF.STG, 8).map(s => ({
                ...s,
                color: s.label === "Booked" ? GREEN : s.label === "Closed Lost" ? RED : s.label === "In Progress" ? GOLD : s.label === "Site Visit" ? TEAL : BLUE,
              }))}
              onPick={(k, l) => addFilter("stg", k, l)}
            />
          </div>
        )}
      </div>

      {/* Trend + weekday */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 14, marginTop: 14 }}>
        {!has("mon") && (
          <div style={CARD}>
            <h3 style={H3}>Footfall trend</h3>
            <div style={CAP}>monthly volume with trend line · click a month</div>
            <TrendChart items={monthly} onPick={(k, l) => addFilter("mon", k, l)} />
          </div>
        )}
        {!has("dow") && (
          <div style={CARD}>
            <h3 style={H3}>Weekday pattern</h3>
            <div style={CAP}>visits by day of week · click a day</div>
            <WeekdayChart items={weekday} onPick={(k, l) => addFilter("dow", k, l)} />
          </div>
        )}
      </div>

      {/* Channel-partner performance board */}
      {!has("cp") && (
        <>
          <div>
            <Banner
              title="CHANNEL-PARTNER PERFORMANCE"
              sub={`${fNum(new Set(rows.filter(r => r.src === 1 && r.cp >= 0).map(r => r.cp)).size)} partners brought customer footfall · click a partner to drill`}
            />
          </div>
          <CpBoard rows={rows} onDrill={(cp, name) => addFilter("cp", cp, name)} />
        </>
      )}

      <div><Banner title="SITE-VISIT RECORDS" sub={`${fNum(total)} in scope`} /></div>

      {/* Records table */}
      <div style={{ ...CARD, marginTop: 2, paddingBottom: 8 }}>
        <h3 style={H3}>Site-visit records <span style={{ fontSize: 11.5, fontWeight: 400, color: "var(--mut)" }}>{fNum(total)} in scope</span></h3>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--line)" }}>
                <th onClick={() => setSortDir(d => (d === 1 ? -1 : 1))} style={{ textAlign: "left", padding: "7px 8px 7px 0", cursor: "pointer", color: "var(--mut)", fontSize: 10.5, letterSpacing: "1px", textTransform: "uppercase" }}>
                  Date {sortDir === -1 ? "▼" : "▲"}
                </th>
                {["Gallery", "Project", "Source", "Channel partner", "Locality", "Stage"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "7px 8px", color: "var(--mut)", fontSize: 10.5, letterSpacing: "1px", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "7px 8px 7px 0", whiteSpace: "nowrap" }}>
                    {r.day >= 0 ? dayToDate(r.day).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                  </td>
                  <td style={{ padding: "7px 8px" }}>{r.g >= 0 ? FF.G[r.g] : "—"}</td>
                  <td style={{ padding: "7px 8px" }}>{r.p >= 0 ? FF.P[r.p] : "—"}</td>
                  <td style={{ padding: "7px 8px" }}>{r.src === 1 ? "CP" : r.src === 0 ? "Direct" : r.src === 2 ? "Loyalty" : "—"}</td>
                  <td style={{ padding: "7px 8px", maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.cp >= 0 ? FF.CPN[r.cp] : "—"}</td>
                  <td style={{ padding: "7px 8px" }}>{r.loc >= 0 ? FF.LOC[r.loc] : "—"}</td>
                  <td style={{ padding: "7px 8px" }}>
                    {r.stg >= 0 ? (
                      <span style={{
                        fontSize: 11, fontWeight: 700, borderRadius: 5, padding: "2px 8px",
                        background: FF.STG[r.stg] === "Booked" ? "#e2f3ec" : FF.STG[r.stg] === "Closed Lost" ? "#fde3e3" : "#eef1f7",
                        color: FF.STG[r.stg] === "Booked" ? "#0f6e56" : FF.STG[r.stg] === "Closed Lost" ? "#b3362c" : "#3d4a63",
                      }}>{FF.STG[r.stg]}</span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pager */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0 6px", fontSize: 12.5, color: "var(--mut)" }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "5px 12px", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.45 : 1, fontFamily: "inherit" }}>‹ Prev</button>
          <span>Page {page} of {fNum(pageCount)}</span>
          <button disabled={page >= pageCount} onClick={() => setPage(p => p + 1)} style={{ border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "5px 12px", cursor: page >= pageCount ? "default" : "pointer", opacity: page >= pageCount ? 0.45 : 1, fontFamily: "inherit" }}>Next ›</button>
          <span style={{ marginLeft: "auto", fontSize: 11.5 }}>{FF.meta.source}</span>
        </div>
      </div>
    </div>
  );
}
