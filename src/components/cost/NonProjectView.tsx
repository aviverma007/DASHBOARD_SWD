import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showTip, hideTip } from "../common/hoverTip";
import { Zoomable } from "../common/Zoomable";
import raw from "../../data/costNonProject.json";
import { fN, fMoney } from "./costShared";

/** Non-project FY-26 cost data (SAP exports: Item Wise PO lines · Summary · Total Actual).
 * L = PO lines  [0 wbs, 1 wdesc, 2 vend, 3 pgrp, 4 plant, 5 gl, 6 dtyp, 7 comp, 8 root, 9 day, 10 po,
 *               11 ord, 12 ordGst, 13 del, 14 delGst, 15 still, 16 mapped]
 * B = per-WBS budget (Summary) [0 wbs, 1 budget, 2 basicBudget, 3 assigned, 4 basicAssigned, 5 actual, 6 basicActual,
 *               7 actualPO, 8 actualNonPO, 9 commit, 10 basicCommit, 11 avail, 12 basicAvail, 13 root, 14 pgrp,
 *               15 poBasic, 16 bh, 17 plant, 18 wdesc]
 * A = actual postings per WBS × posting month × PO/non-PO [wbs, monthDay, isPO, gst, basic]
 * GST view uses Budget/Assigned/Total Actual/Commitment/Budget Available; excl-GST uses the Basic* columns. */
interface NpDataset {
  WBS: string[]; WDESC: string[]; VEND: string[]; PGRP: string[]; PLANT: string[];
  GL: string[]; DTYP: string[]; COMP: string[]; ROOT: string[]; BH: string[];
  L: (number | string)[][]; B: number[][]; A: number[][];
  meta: { asOn: string; lines: number; wbs: number; pos: number };
}
export const NP = raw as unknown as NpDataset;

export interface NpRow {
  i: number; wbs: number; wdesc: number; vend: number; pgrp: number; plant: number;
  gl: number; dtyp: number; comp: number; root: number; day: number; po: string;
  ord: number; ordGst: number; del: number; delGst: number; still: number;
}
export const NP_ROWS: NpRow[] = NP.L.map((r, i) => ({
  i, wbs: r[0] as number, wdesc: r[1] as number, vend: r[2] as number, pgrp: r[3] as number,
  plant: r[4] as number, gl: r[5] as number, dtyp: r[6] as number, comp: r[7] as number,
  root: r[8] as number, day: r[9] as number, po: String(r[10]).replace(/\.0$/, ""),
  ord: r[11] as number, ordGst: r[12] as number, del: r[13] as number, delGst: r[14] as number,
  still: r[15] as number,
}));

/* ---- per-WBS model: attributes + budget/actual values for both GST modes ---- */
interface Vals { budget: number; assigned: number; actual: number; commit: number; avail: number; po: number; nonpo: number }
export interface Wb { w: number; root: number; pgrp: number; plant: number; bh: number; wdesc: number; has: boolean; v: [Vals, Vals] }   // v[0] excl GST · v[1] with GST
const ZERO: Vals = { budget: 0, assigned: 0, actual: 0, commit: 0, avail: 0, po: 0, nonpo: 0 };
export const WB = new Map<number, Wb>();
NP.B.forEach(b => {
  const mk = (g: boolean): Vals => {
    const actual = g ? b[5] : b[6], po = g ? b[7] : b[15];
    return { budget: g ? b[1] : b[2], assigned: g ? b[3] : b[4], actual, commit: g ? b[9] : b[10], avail: g ? b[11] : b[12], po, nonpo: actual - po };
  };
  WB.set(b[0], { w: b[0], root: b[13], pgrp: b[14], plant: b[17], bh: b[16], wdesc: b[18], has: true, v: [mk(false), mk(true)] });
});
// WBS that have POs but no budget row: attributes from their PO lines, no budget
NP_ROWS.forEach(r => { if (!WB.has(r.wbs)) WB.set(r.wbs, { w: r.wbs, root: r.root, pgrp: r.pgrp, plant: r.plant, bh: -1, wdesc: r.wdesc, has: false, v: [ZERO, ZERO] }); });
// one consistent set of WBS attributes everywhere (budget side and PO side)
NP_ROWS.forEach(r => { const w = WB.get(r.wbs); if (w?.has) { r.pgrp = w.pgrp; r.plant = w.plant; r.root = w.root; } });

const statusOf = (b: number, u: number) => b <= 0 ? "nobudget" : u / b > 0.95 ? "critical" : u / b > 0.8 ? "watch" : "healthy";
const ST_COL: Record<string, string> = { healthy: "#1BAF7A", watch: "#EDA100", critical: "#c0392b", nobudget: "#8a94a6" };
const ST_LBL: Record<string, string> = { healthy: "Healthy (<80%)", watch: "Watch (80–95%)", critical: "Critical (>95%)", nobudget: "No budget" };

const NAVY = "#14213D", TEAL = "#0E7490", GOLD = "#B8893C", GREEN = "#1BAF7A", RED = "#c0392b", AMBER = "#EDA100", VIOLET = "#6b4fa0";

/* ---- filters shared with the Cost page banner ---- */
export interface NpFilter { depts: (number | string)[]; plants: (number | string)[]; roots: (number | string)[]; bhs: (number | string)[]; q: string }
const HAY = (() => {   // search text per WBS: code + descriptions + vendors
  const m = new Map<number, string>();
  WB.forEach(w => m.set(w.w, `${NP.WBS[w.w]} ${NP.WDESC[w.wdesc] ?? ""} ${NP.BH[w.bh] ?? ""}`.toLowerCase()));
  NP_ROWS.forEach(r => m.set(r.wbs, `${m.get(r.wbs) ?? ""} ${NP.VEND[r.vend]} ${NP.WDESC[r.wdesc] ?? ""}`.toLowerCase()));
  return m;
})();
/** WBS indices that satisfy the banner filters — budget, actual and PO views all follow this one set. */
export const npScope = (f: NpFilter): Set<number> => {
  const q = f.q.trim().toLowerCase();
  const out = new Set<number>();
  WB.forEach(w => {
    if (f.depts.length && !f.depts.includes(w.pgrp)) return;
    if (f.plants.length && !f.plants.includes(w.plant)) return;
    if (f.roots.length && !f.roots.includes(w.root)) return;
    if (f.bhs.length && !f.bhs.includes(w.bh)) return;
    if (q && !(HAY.get(w.w) ?? "").includes(q)) return;
    out.add(w.w);
  });
  return out;
};

/** Cascading filters: for each filter, the values that still exist once the OTHER filters are applied. */
export const npAvail = (f: NpFilter) => {
  const a = { depts: new Set<number>(), plants: new Set<number>(), roots: new Set<number>(), bhs: new Set<number>() };
  const q = f.q.trim().toLowerCase();
  WB.forEach(w => {
    if (q && !(HAY.get(w.w) ?? "").includes(q)) return;
    const okD = !f.depts.length || f.depts.includes(w.pgrp), okP = !f.plants.length || f.plants.includes(w.plant);
    const okR = !f.roots.length || f.roots.includes(w.root), okB = !f.bhs.length || f.bhs.includes(w.bh);
    if (okP && okR && okB) a.depts.add(w.pgrp);
    if (okD && okR && okB) a.plants.add(w.plant);
    if (okD && okP && okB) a.roots.add(w.root);
    if (okD && okP && okR) a.bhs.add(w.bh);
  });
  return a;
};

/* Glassmorphism KPI + 3D-lift card styles */
const GLASS = (c1: string, c2: string): React.CSSProperties => ({
  background: `linear-gradient(150deg, ${c1} 0%, ${c2} 100%)`,
  border: "1px solid rgba(255,255,255,.35)",
  borderRadius: 14,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), 0 10px 24px rgba(20,33,61,.28), 0 2px 6px rgba(20,33,61,.18)",
  padding: "14px 16px", color: "#fff", position: "relative", overflow: "hidden",
});
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #eae6da", borderRadius: 12, boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)", padding: "14px 16px", marginBottom: 14 };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 15.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 2px" };
const CAP: React.CSSProperties = { fontSize: 11, color: "var(--mut)", marginBottom: 10 };
const EPOCH = Date.UTC(2022, 0, 1);
const dLbl = (d: number) => d >= 0 ? new Date(EPOCH + d * 86400000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const ymOf = (d: number) => { const t = new Date(EPOCH + d * 86400000); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`; };
const ymLbl = (k: string) => k === "0000" ? "Prior" : new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
const FY_START = "2026-04";
const fyKey = (d: number) => { const k = ymOf(d); return k < FY_START ? "0000" : k; };   // anything before the FY collapses into "Prior"
const pctOf = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

/* ---- drill chips: WBS-level dims act on budget + actuals + POs, PO-level dims only on PO lines ---- */
export type NpDim = "wbs" | "vend" | "pgrp" | "plant" | "gl" | "comp" | "root" | "mon" | "dtyp" | "bh" | "status";
export interface NpChip { dim: NpDim; val: number | string; label: string }
const DIMN: Record<NpDim, string> = { wbs: "WBS", vend: "Vendor", pgrp: "Department", plant: "Plant", gl: "GL", comp: "Company code", root: "Company", mon: "Month", dtyp: "Doc type", bh: "Cost head", status: "Status" };
const WBS_DIMS: NpDim[] = ["wbs", "pgrp", "plant", "root", "bh", "status"];
const wbsMatches = (w: Wb, ch: NpChip, gi: 0 | 1): boolean => {
  switch (ch.dim) {
    case "wbs": return w.w === ch.val;
    case "pgrp": return w.pgrp === ch.val;
    case "plant": return w.plant === ch.val;
    case "root": return w.root === ch.val;
    case "bh": return w.bh === ch.val;
    case "status": return statusOf(w.v[gi].budget, w.v[gi].assigned) === ch.val;
    default: return true;
  }
};
const rowMatches = (r: NpRow, ch: NpChip): boolean => {
  switch (ch.dim) {
    case "vend": return r.vend === ch.val;
    case "gl": return r.gl === ch.val;
    case "comp": return r.comp === ch.val;
    case "dtyp": return r.dtyp === ch.val;
    case "mon": return r.day >= 0 && fyKey(r.day) === ch.val;
    default: return true;
  }
};

/** Stacked monthly bars (actual PO · actual non-PO · open commitment by PO date) with a cumulative-utilization line on a
 * right-hand axis. Custom SVG, fits its container, click a month → drill. */
function BudgetTrendChart({ data, onMonth }: {
  data: [string, { po: number; np: number; cm: number }][];
  onMonth: (key: string, label: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(es => setW(es[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const W = Math.max(w, 340), H = 250, ML = 46, MR = 48, MT = 10, MB = 28;
  const plotW = W - ML - MR, plotH = H - MT - MB;
  const n = Math.max(data.length, 1), band = plotW / n, barW = Math.max(6, Math.min(30, band * 0.58));
  const tot = (e: { po: number; np: number; cm: number }) => Math.max(e.po, 0) + Math.max(e.np, 0) + Math.max(e.cm, 0);
  const mx = Math.max(...data.map(([, e]) => tot(e)), 1);
  let run = 0;
  const cum = data.map(([, e]) => (run += e.po + e.np + e.cm));
  const cmx = Math.max(...cum, 1);
  const y = (v: number) => MT + plotH - (v / mx) * plotH;
  const yc = (v: number) => MT + plotH - (v / cmx) * plotH;
  const step = Math.max(1, Math.ceil(n / Math.max(4, Math.floor(plotW / 52))));
  const short = (v: number) => v >= 1e7 ? `${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1)} Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(0)} L` : fN(Math.round(v));
  const line = data.map((_, i) => `${i ? "L" : "M"}${(ML + i * band + band / 2).toFixed(1)},${yc(cum[i]).toFixed(1)}`).join(" ");
  return (
    <div ref={ref} style={{ flex: 1, minHeight: H, width: "100%", overflow: "hidden" }}>
      {w > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
          {[0.25, 0.5, 0.75, 1].map(fr => (
            <g key={fr}>
              <line x1={ML} x2={W - MR} y1={y(mx * fr)} y2={y(mx * fr)} stroke="#eae6da" strokeWidth={1} />
              <text x={ML - 6} y={y(mx * fr) + 3.5} textAnchor="end" style={{ fontSize: 9.5, fontWeight: 700, fill: "var(--mut)" }}>{short(mx * fr)}</text>
              <text x={W - MR + 6} y={yc(cmx * fr) + 3.5} textAnchor="start" style={{ fontSize: 9.5, fontWeight: 700, fill: NAVY }}>{short(cmx * fr)}</text>
            </g>
          ))}
          <line x1={ML} x2={W - MR} y1={MT + plotH} y2={MT + plotH} stroke="#d8d2c4" strokeWidth={1.5} />
          {data.map(([k, e], i) => {
            const cx = ML + i * band + band / 2;
            const segs: [number, string][] = [[Math.max(e.po, 0), TEAL], [Math.max(e.np, 0), VIOLET], [Math.max(e.cm, 0), AMBER]];
            let base = MT + plotH;
            return (
              <g key={k} style={{ cursor: "pointer" }} onClick={() => onMonth(k, ymLbl(k))}
                onMouseEnter={ev => showTip(ev, `<b>${ymLbl(k)}</b><br/>Actual PO — ${fMoney(e.po)}<br/>Actual non-PO — ${fMoney(e.np)}<br/>Open commitment — ${fMoney(e.cm)}<br/>Cumulative — ${fMoney(cum[i])}`)}
                onMouseMove={ev => showTip(ev, `<b>${ymLbl(k)}</b> ${fMoney(e.po + e.np + e.cm)}`)} onMouseLeave={hideTip}>
                <rect x={ML + i * band} y={MT} width={band} height={plotH} fill="transparent" />
                {segs.map(([v, c], j) => {
                  const h = (v / mx) * plotH; base -= h;
                  return h > 0 ? <rect key={j} x={cx - barW / 2} y={base} width={barW} height={Math.max(h, 1)} fill={c} rx={j === 2 ? 2 : 0} /> : null;
                })}
                {(i % step === 0 || i === n - 1) && <text x={cx} y={H - 9} textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 700, fill: "var(--mut)" }}>{ymLbl(k)}</text>}
              </g>
            );
          })}
          <path d={line} fill="none" stroke={NAVY} strokeWidth={2.2} strokeLinejoin="round" />
          {data.map(([k], i) => <circle key={k} cx={ML + i * band + band / 2} cy={yc(cum[i])} r={3} fill="#fff" stroke={NAVY} strokeWidth={1.8} />)}
        </svg>
      )}
    </div>
  );
}



/** Responsive grouped-bar month chart (custom SVG — this project uses no
 * chart library). Fits the container via ResizeObserver: no horizontal
 * scroll, dynamic label step (~1 label per 55px), horizontal gridlines,
 * hover tooltip + click-to-drill per month band. All months stay in the
 * data even when their label is skipped. */
function MonthlyTrendChart({ data, onMonth }: {
  data: [string, { o: number; d: number }][];
  onMonth: (key: string, label: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(es => setW(es[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const W = Math.max(w, 320), H = 236;
  const ML = 46, MR = 6, MT = 8, MB = 28;
  const plotW = W - ML - MR, plotH = H - MT - MB;
  const n = Math.max(data.length, 1);
  const band = plotW / n;
  const barW = Math.max(3.5, Math.min(16, band * 0.34));
  const mx = Math.max(...data.map(([, e]) => Math.max(e.o, e.d)), 1);
  const y = (v: number) => MT + plotH - (v / mx) * plotH;
  const step = Math.max(1, Math.ceil(n / Math.max(4, Math.floor(plotW / 55))));
  const short = (v: number) => v >= 1e7 ? `${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1)} Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(0)} L` : fN(Math.round(v));
  return (
    <div ref={ref} style={{ flex: 1, minHeight: H, width: "100%", overflow: "hidden" }}>
      {w > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
          {[0.25, 0.5, 0.75, 1].map(fr => (
            <g key={fr}>
              <line x1={ML} x2={W - MR} y1={y(mx * fr)} y2={y(mx * fr)} stroke="#eae6da" strokeWidth={1} />
              <text x={ML - 6} y={y(mx * fr) + 3.5} textAnchor="end" style={{ fontSize: 9.5, fontWeight: 700, fill: "var(--mut)" }}>{short(mx * fr)}</text>
            </g>
          ))}
          <line x1={ML} x2={W - MR} y1={MT + plotH} y2={MT + plotH} stroke="#d8d2c4" strokeWidth={1.5} />
          {data.map(([k, e], i) => {
            const cx = ML + i * band + band / 2;
            const showLbl = i % step === 0 || i === n - 1;
            return (
              <g key={k} style={{ cursor: "pointer" }}
                onClick={() => onMonth(k, ymLbl(k))}
                onMouseEnter={ev => showTip(ev, `<b>${ymLbl(k)}</b><br/>Ordered — ${fMoney(e.o)}<br/>Delivered — ${fMoney(e.d)}`)}
                onMouseMove={ev => showTip(ev, `<b>${ymLbl(k)}</b><br/>Ordered — ${fMoney(e.o)} · Delivered — ${fMoney(e.d)}`)}
                onMouseLeave={hideTip}>
                <rect x={ML + i * band} y={MT} width={band} height={plotH} fill="transparent" />
                <rect x={cx - barW - 0.75} y={y(e.o)} width={barW} height={Math.max(MT + plotH - y(e.o), e.o > 0 ? 1.5 : 0)} rx={2} fill="#14213D" />
                <rect x={cx + 0.75} y={y(e.d)} width={barW} height={Math.max(MT + plotH - y(e.d), e.d > 0 ? 1.5 : 0)} rx={2} fill="#0E7490" />
                {showLbl && (
                  <text x={cx} y={H - 9} textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 700, fill: "var(--mut)" }}>{ymLbl(k)}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}


/* ---------------- drill drawer (same shell as the other cost drills) ---------------- */
function NpDrillDrawer({ seed, baseRows, scope, gst, onClose, onAddChip }: {
  seed: { chips: NpChip[] } | null; baseRows: NpRow[]; scope: Set<number>; gst: boolean;
  onClose: () => void; onAddChip: (c: NpChip) => void;
}) {
  const gi: 0 | 1 = gst ? 1 : 0;
  const chips = seed?.chips ?? [];
  const has = (d: NpDim) => chips.some(c => c.dim === d);
  const wbsChips = chips.filter(c => WBS_DIMS.includes(c.dim));
  const rowChips = chips.filter(c => !WBS_DIMS.includes(c.dim) && c.dim !== "mon");
  const mon = chips.find(c => c.dim === "mon")?.val as string | undefined;
  const vOrd = (r: NpRow) => gst ? r.ordGst : r.ord;
  const vDel = (r: NpRow) => gst ? r.delGst : r.del;
  const vStill = (r: NpRow) => gst ? r.ordGst - r.delGst : r.still;

  // PO lines in this drill
  const rows = useMemo(() => baseRows.filter(r => {
    const w = WB.get(r.wbs);
    return w && wbsChips.every(c => wbsMatches(w, c, gi)) && rowChips.every(c => rowMatches(r, c)) && (!mon || (r.day >= 0 && fyKey(r.day) === mon));
  }), [baseRows, chips, gi]);
  // WBS in this drill (budget side): WBS-level chips, narrowed to WBS that have matching PO lines when a PO-only chip is set
  const wbsList = useMemo(() => {
    const poW = rowChips.length ? new Set(rows.map(r => r.wbs)) : null;
    return [...WB.values()].filter(w => scope.has(w.w) && wbsChips.every(c => wbsMatches(w, c, gi)) && (!poW || poW.has(w.w)));
  }, [scope, chips, gi, rows]);
  const wSet = useMemo(() => new Set(wbsList.map(w => w.w)), [wbsList]);
  // actual postings in this drill (month chip narrows to that month)
  const act = useMemo(() => {
    let po = 0, np = 0;
    NP.A.forEach(a => { if (!wSet.has(a[0])) return; if (mon && fyKey(a[1]) !== mon) return; const v = gst ? a[3] : a[4]; if (a[2]) po += v; else np += v; });
    return { po, np };
  }, [wSet, mon, gst]);

  const sum = (f: (v: Vals) => number) => wbsList.reduce((s, w) => s + f(w.v[gi]), 0);
  const budget = sum(v => v.budget), assigned = sum(v => v.assigned), commit = sum(v => v.commit), avail = sum(v => v.avail);
  const actualAll = sum(v => v.actual);
  const actPO = mon ? act.po : sum(v => v.po), actNP = mon ? act.np : sum(v => v.nonpo);
  const ord = rows.reduce((s, r) => s + vOrd(r), 0), del = rows.reduce((s, r) => s + vDel(r), 0), still = rows.reduce((s, r) => s + vStill(r), 0);

  const Bars = ({ items, dim }: { items: { k: number; label: string; v: number }[]; dim: NpDim }) => {
    const mx = Math.max(...items.map(it => Math.abs(it.v)), 1);
    return (
      <div style={{ maxHeight: 210, overflowY: "auto", paddingRight: 4 }}>
        {items.slice(0, 25).map(it => (
          <div key={it.k} className="barrow" onClick={() => onAddChip({ dim, val: it.k, label: it.label })}
            onMouseEnter={e => showTip(e, `<b>${it.label}</b><br/>${fMoney(it.v)} · click → add filter`)}
            onMouseMove={e => showTip(e, `<b>${it.label}</b><br/>${fMoney(it.v)}`)} onMouseLeave={hideTip}
            style={{ padding: "3.5px 0", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2, gap: 8 }}>
              <span style={{ color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
              <span style={{ color: it.v < 0 ? RED : "var(--mut)", whiteSpace: "nowrap" }}>{fMoney(it.v)}</span>
            </div>
            <div style={{ height: 7, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(Math.abs(it.v) / mx) * 100}%`, background: it.v < 0 ? RED : TEAL, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    );
  };
  const agg = (key: (r: NpRow) => number, names: string[]) => {
    const m = new Map<number, number>();
    rows.forEach(r => m.set(key(r), (m.get(key(r)) ?? 0) + vOrd(r)));
    return [...m.entries()].map(([k, v]) => ({ k, label: names[k] ?? "—", v })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  };
  const aggW = (key: (w: Wb) => number, names: string[], val: (v: Vals) => number) => {
    const m = new Map<number, number>();
    wbsList.forEach(w => m.set(key(w), (m.get(key(w)) ?? 0) + val(w.v[gi])));
    return [...m.entries()].map(([k, v]) => ({ k, label: names[k] ?? "—", v })).filter(x => Math.abs(x.v) >= 1).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  };
  const poLines = useMemo(() => [...rows].sort((a, b) => vOrd(b) - vOrd(a)).slice(0, 200), [rows, gst]);
  const topWbs = useMemo(() => [...wbsList].sort((a, b) => b.v[gi].assigned - a.v[gi].assigned).slice(0, 30), [wbsList, gi]);
  const util = pctOf(assigned, budget);

  const Tile = ({ l, v, c, s }: { l: string; v: string; c: string; s?: string }) => (
    <div style={{ background: "#fff", border: "1px solid #eae6da", borderLeft: `5px solid ${c}`, borderRadius: 10, padding: "9px 11px" }}>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 16, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>{v}</div>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", marginTop: 3 }}>{l}</div>
      {s && <div style={{ fontSize: 10, color: "#8a8474", marginTop: 1, whiteSpace: "nowrap" }}>{s}</div>}
    </div>
  );
  const TH = (h: string, right?: boolean) => <th key={h} style={{ textAlign: right ? "right" : "left", fontSize: 9.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "6px 8px", borderBottom: "2px solid #eae6da", whiteSpace: "nowrap" }}>{h}</th>;

  return (
    <AnimatePresence>
      {seed && (
        <>
          <motion.div key="npov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.35)", zIndex: 70 }} />
          <motion.div key="npdw" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(640px, 96vw)", zIndex: 71, background: "#f6f4ef", boxShadow: "-14px 0 46px rgba(20,33,61,.35)", display: "flex", flexDirection: "column" }}>
            <div style={{ background: NAVY, padding: "14px 18px", borderBottom: "3px solid var(--gold)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", color: "#c9b27c" }}>NON-PROJECT DRILL · {gst ? "WITH GST" : "EXCL GST"} · {fN(wbsList.length)} WBS</div>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "#fff", marginTop: 2 }}>
                    {chips.length ? chips[chips.length - 1].label : "All non-project"}
                  </div>
                </div>
                <button onClick={onClose} aria-label="Close"
                  style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 8, fontSize: 15, cursor: "pointer", flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {chips.map((c, i) => (
                  <span key={i} style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.25)", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "4px 11px" }}>
                    {DIMN[c.dim]}: {c.label}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
              {mon ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
                  <Tile l="Actual PO (month)" v={fMoney(actPO)} c={TEAL} />
                  <Tile l="Actual non-PO (month)" v={fMoney(actNP)} c={VIOLET} />
                  <Tile l="Actual total (month)" v={fMoney(actPO + actNP)} c={NAVY} />
                </div>
              ) : (<>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
                  <Tile l="Approved budget" v={fMoney(budget)} c={NAVY} s={`${fN(wbsList.length)} WBS`} />
                  <Tile l="Actual cost" v={fMoney(actualAll)} c={TEAL} s={`${pctOf(actualAll, budget).toFixed(1)}% of budget`} />
                  <Tile l="Open commitment" v={fMoney(commit)} c={AMBER} s={`${pctOf(commit, budget).toFixed(1)}% of budget`} />
                  <Tile l="Available budget" v={fMoney(avail)} c={GREEN} s={`${util.toFixed(1)}% utilized`} />
                  <Tile l="Actual — PO" v={fMoney(actPO)} c={TEAL} />
                  <Tile l="Actual — non-PO" v={fMoney(actNP)} c={VIOLET} />
                </div>
              </>)}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
                <Tile l="PO ordered" v={fMoney(ord)} c={NAVY} s={`${fN(rows.length)} lines`} />
                <Tile l="PO delivered" v={fMoney(del)} c={TEAL} />
                <Tile l="Still to deliver" v={fMoney(still)} c={AMBER} />
              </div>

              {!mon && !has("wbs") && topWbs.length > 0 && (
                <div style={CARD}>
                  <h3 style={H3}>WBS elements</h3>
                  <div style={CAP}>top {topWbs.length} of {fN(wbsList.length)} by utilized · click a row → add filter</div>
                  <div style={{ maxHeight: 300, overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 540 }}>
                      <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                        {TH("WBS")}{TH("Budget", true)}{TH("Actual", true)}{TH("Commit", true)}{TH("Available", true)}{TH("% Util", true)}
                      </tr></thead>
                      <tbody>
                        {topWbs.map(w => {
                          const v = w.v[gi];
                          return (
                            <tr key={w.w} onClick={() => onAddChip({ dim: "wbs", val: w.w, label: NP.WBS[w.w] })} style={{ borderBottom: "1px solid #f0ede5", cursor: "pointer" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                              <td style={{ padding: "5px 8px", fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }} title={NP.WDESC[w.wdesc]}>{NP.WBS[w.w]}</td>
                              <td style={{ padding: "5px 8px", textAlign: "right" }}>{w.has ? fMoney(v.budget) : "—"}</td>
                              <td style={{ padding: "5px 8px", textAlign: "right" }}>{fMoney(v.actual)}</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", color: AMBER }}>{fMoney(v.commit)}</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", color: v.avail < 0 ? RED : GREEN, fontWeight: 700 }}>{w.has ? fMoney(v.avail) : "—"}</td>
                              <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: ST_COL[statusOf(v.budget, v.assigned)] }}>{v.budget > 0 ? `${pctOf(v.assigned, v.budget).toFixed(0)}%` : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {!mon && !has("pgrp") && <div style={CARD}><h3 style={H3}>Actual cost by department</h3><div style={CAP}>PO + non-PO · click → add filter</div><Bars items={aggW(w => w.pgrp, NP.PGRP, v => v.actual)} dim="pgrp" /></div>}
              {!mon && !has("bh") && <div style={CARD}><h3 style={H3}>Actual cost by cost head</h3><div style={CAP}>click → add filter</div><Bars items={aggW(w => w.bh, NP.BH, v => v.actual)} dim="bh" /></div>}
              {!has("vend") && rows.length > 0 && <div style={CARD}><h3 style={H3}>Top vendors</h3><div style={CAP}>PO ordered value · click → add filter</div><Bars items={agg(r => r.vend, NP.VEND)} dim="vend" /></div>}
              {!has("gl") && rows.length > 0 && <div style={CARD}><h3 style={H3}>PO by GL</h3><div style={CAP}>click → add filter</div><Bars items={agg(r => r.gl, NP.GL)} dim="gl" /></div>}
              <div style={CARD}>
                <h3 style={H3}>PO lines</h3>
                <div style={CAP}>top {Math.min(poLines.length, 200)} of {fN(rows.length)} by ordered value</div>
                <div style={{ maxHeight: 320, overflowY: "auto", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 560 }}>
                    <thead>
                      <tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                        {TH("PO")}{TH("Vendor")}{TH("Date")}{TH("Ordered", true)}{TH("Delivered", true)}{TH("Open", true)}
                      </tr>
                    </thead>
                    <tbody>
                      {poLines.map(r => (
                        <tr key={r.i} style={{ borderBottom: "1px solid #f0ede5" }}>
                          <td style={{ padding: "5px 8px", fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>{r.po}</td>
                          <td style={{ padding: "5px 8px", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{NP.VEND[r.vend]}</td>
                          <td style={{ padding: "5px 8px", whiteSpace: "nowrap", color: "var(--mut)" }}>{dLbl(r.day)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700 }}>{fMoney(vOrd(r))}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: TEAL }}>{fMoney(vDel(r))}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: vStill(r) > 0 ? AMBER : "var(--mut)", fontWeight: vStill(r) > 0 ? 700 : 500 }}>{fMoney(vStill(r))}</td>
                        </tr>
                      ))}
                      {poLines.length === 0 && <tr><td colSpan={6} style={{ padding: 14, textAlign: "center", color: "var(--mut)" }}>No PO lines in this selection</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------------- main view ---------------- */
const sumV = (list: Wb[], gi: 0 | 1): Vals => list.reduce((s, w) => {
  const v = w.v[gi];
  return { budget: s.budget + v.budget, assigned: s.assigned + v.assigned, actual: s.actual + v.actual, commit: s.commit + v.commit, avail: s.avail + v.avail, po: s.po + v.po, nonpo: s.nonpo + v.nonpo };
}, { ...ZERO });

export function NonProjectView({ rows, scope, gst }: { rows: NpRow[]; scope: Set<number>; gst: boolean }) {
  const gi: 0 | 1 = gst ? 1 : 0;
  const [drill, setDrill] = useState<{ chips: NpChip[] } | null>(null);
  const open = (chips: NpChip[]) => setDrill({ chips });
  const vOrd = (r: NpRow) => gst ? r.ordGst : r.ord;
  const vDel = (r: NpRow) => gst ? r.delGst : r.del;
  const vStill = (r: NpRow) => gst ? r.ordGst - r.delGst : r.still;

  const wbsList = useMemo(() => [...WB.values()].filter(w => scope.has(w.w)), [scope]);
  const budgeted = useMemo(() => wbsList.filter(w => w.has), [wbsList]);
  const T = useMemo(() => sumV(wbsList, gi), [wbsList, gi]);
  const atRisk = useMemo(() => budgeted.filter(w => statusOf(w.v[gi].budget, w.v[gi].assigned) === "critical").length, [budgeted, gi]);
  const ord = rows.reduce((s, r) => s + vOrd(r), 0);
  const del = rows.reduce((s, r) => s + vDel(r), 0);
  const still = rows.reduce((s, r) => s + vStill(r), 0);
  const pos = new Set(rows.map(r => r.po)).size;
  const vendN = new Set(rows.map(r => r.vend)).size;

  const aggOD = (key: (r: NpRow) => number) => {
    const m = new Map<number, { o: number; d: number; n: number }>();
    rows.forEach(r => { const k = key(r); if (!m.has(k)) m.set(k, { o: 0, d: 0, n: 0 }); const e = m.get(k)!; e.o += vOrd(r); e.d += vDel(r); e.n++; });
    return [...m.entries()].sort((a, b) => b[1].o - a[1].o);
  };
  const byDept = useMemo(() => aggOD(r => r.pgrp), [rows, gst]);
  const byRoot = useMemo(() => aggOD(r => r.root), [rows, gst]);
  const byVend = useMemo(() => aggOD(r => r.vend), [rows, gst]);
  const poByWbs = useMemo(() => { const m = new Map<number, { o: number; d: number }>(); rows.forEach(r => { const e = m.get(r.wbs) ?? { o: 0, d: 0 }; e.o += vOrd(r); e.d += vDel(r); m.set(r.wbs, e); }); return m; }, [rows, gst]);
  const trend = useMemo(() => {
    const m = new Map<string, { o: number; d: number }>();
    rows.forEach(r => { if (r.day < 0) return; const k = fyKey(r.day); if (!m.has(k)) m.set(k, { o: 0, d: 0 }); const e = m.get(k)!; e.o += vOrd(r); e.d += vDel(r); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, gst]);
  // budget-vs-actual trend: actual PO / non-PO by posting month + open commitment by PO month
  const bTrend = useMemo(() => {
    const m = new Map<string, { po: number; np: number; cm: number }>();
    const g = (k: string) => { if (!m.has(k)) m.set(k, { po: 0, np: 0, cm: 0 }); return m.get(k)!; };
    NP.A.forEach(a => { if (!scope.has(a[0])) return; const e = g(fyKey(a[1])); const v = gst ? a[3] : a[4]; if (a[2]) e.po += v; else e.np += v; });
    rows.forEach(r => { if (r.day < 0) return; const s = vStill(r); if (s > 0) g(fyKey(r.day)).cm += s; });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [scope, rows, gst]);
  const grp = (key: (w: Wb) => number, names: string[]) => {
    const m = new Map<number, Wb[]>();
    budgeted.forEach(w => { const k = key(w); if (!m.has(k)) m.set(k, []); m.get(k)!.push(w); });
    return [...m.entries()].map(([k, l]) => ({ k, label: names[k] ?? "—", n: l.length, v: sumV(l, gi) })).sort((a, b) => b.v.assigned - a.v.assigned);
  };
  const byCompany = useMemo(() => grp(w => w.root, NP.ROOT), [budgeted, gi]);
  const byCostHead = useMemo(() => grp(w => w.bh, NP.BH), [budgeted, gi]);
  const depNP = useMemo(() => grp(w => w.pgrp, NP.PGRP).filter(d => Math.abs(d.v.nonpo) >= 1).sort((a, b) => Math.abs(b.v.nonpo) - Math.abs(a.v.nonpo)), [budgeted, gi]);

  const KPI = ({ k, v, s, col, onClick }: { k: string; v: string; s: string; col: string; onClick?: () => void }) => (
    <div onClick={onClick} onMouseEnter={e => showTip(e, `<b>${k}</b><br/>${v} · ${s}`)} onMouseMove={e => showTip(e, `<b>${k}</b><br/>${v}`)} onMouseLeave={hideTip}
      style={{ background: "#fff", border: "1px solid #eae6da", borderLeft: `6px solid ${col}`, borderRadius: 12, boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)", padding: "12px 14px", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 21, fontWeight: 700, color: "var(--ink)", lineHeight: 1, whiteSpace: "nowrap" }}>{v}</div>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "1.1px", textTransform: "uppercase", color: "var(--mut)", marginTop: 5 }}>{k}</div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8a8474", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s}</div>
    </div>
  );

  const BarPair = ({ title, cap, data, names, dim, cardTitle }: {
    title: string; cap: string; data: [number, { o: number; d: number; n: number }][];
    names: string[]; dim: NpDim; cardTitle: string;
  }) => (
    <Zoomable title={cardTitle} collapsible>
      <div style={{ ...CARD, height: "100%", marginBottom: 0, display: "flex", flexDirection: "column" }}>
        <h3 style={H3}>{title}</h3>
        <div style={CAP}>{cap}</div>
        <div style={{ flex: 1, minHeight: 0, maxHeight: 320, overflowY: "auto", paddingRight: 6 }}>
          {(() => {
            const mx = Math.max(...data.map(([, e]) => e.o), 1);
            return data.slice(0, 60).map(([k, e]) => (
              <div key={k} className="barrow" onClick={() => open([{ dim, val: k, label: names[k] }])}
                onMouseEnter={ev => showTip(ev, `<b>${names[k]}</b><br/>Ordered — ${fMoney(e.o)}<br/>Delivered — ${fMoney(e.d)}<br/>${fN(e.n)} PO lines`)}
                onMouseMove={ev => showTip(ev, `<b>${names[k]}</b> ${fMoney(e.o)}`)} onMouseLeave={hideTip}
                style={{ padding: "4px 0", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                  <span style={{ color: "var(--ink)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{names[k]}</span>
                  <span style={{ color: "var(--mut)", fontWeight: 700, flexShrink: 0 }}>{fMoney(e.o)}</span>
                </div>
                <div style={{ position: "relative", height: 8, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, width: `${(e.o / mx) * 100}%`, background: NAVY, borderRadius: 4 }} />
                  <div style={{ position: "absolute", inset: 0, width: `${(e.d / mx) * 100}%`, background: TEAL, borderRadius: 4 }} />
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    </Zoomable>
  );

  /** Budget table grouped by company / cost head — reference "…-wise Budget Overview" layout. */
  const GroupTable = ({ title, sub, label, data, dim, cardTitle }: {
    title: string; sub: string; label: string; cardTitle: string; dim: NpDim;
    data: { k: number; label: string; n: number; v: Vals }[];
  }) => {
    const tot = data.reduce((s, d) => ({ budget: s.budget + d.v.budget, assigned: s.assigned + d.v.assigned, actual: s.actual + d.v.actual, commit: s.commit + d.v.commit, avail: s.avail + d.v.avail }), { budget: 0, assigned: 0, actual: 0, commit: 0, avail: 0 });
    const th = (h: string, r?: boolean) => <th key={h} style={{ textAlign: r ? "right" : "left", fontSize: 10, fontWeight: 700, letterSpacing: ".8px", textTransform: "uppercase", color: "var(--mut)", padding: "8px 6px", borderBottom: "2px solid #eae6da", whiteSpace: "nowrap", position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>{h}</th>;
    const pill = (p: number, has: boolean) => {
      const st = has ? statusOf(100, p) : "nobudget";
      return <span style={{ background: `${ST_COL[st]}22`, color: ST_COL[st], fontWeight: 800, fontSize: 11, borderRadius: 6, padding: "3px 9px", display: "inline-block", minWidth: 44, textAlign: "center" }}>{has ? `${p.toFixed(0)}%` : "—"}</span>;
    };
    const td = (children: React.ReactNode, extra?: React.CSSProperties) => <td style={{ padding: "6px 6px", textAlign: "right", borderBottom: "1px solid #f0ede5", whiteSpace: "nowrap", ...extra }}>{children}</td>;
    return (
      <Zoomable title={cardTitle} collapsible>
        <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
          <h3 style={H3}>{title} <span style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, color: "var(--mut)" }}>{sub}</span></h3>
          <div style={CAP}>{fN(data.length)} {label.toLowerCase()} · click a row → drill</div>
          <div style={{ maxHeight: 330, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 560 }}>
              <thead><tr>{th("#")}{th(label)}{th("Budget", true)}{th("Actual Cost", true)}{th("Commitment", true)}{th("Assigned", true)}{th("Available", true)}{th("Utilization", true)}</tr></thead>
              <tbody>
                {data.map((d, i) => (
                  <tr key={d.k} onClick={() => open([{ dim, val: d.k, label: d.label }])} style={{ cursor: "pointer" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                    {td(i + 1, { textAlign: "left", color: "var(--mut)" })}
                    {td(d.label, { textAlign: "left", fontWeight: 700, color: "var(--ink)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" })}
                    {td(fMoney(d.v.budget))}{td(fMoney(d.v.actual))}{td(fMoney(d.v.commit), { color: AMBER })}{td(fMoney(d.v.assigned))}
                    {td(fMoney(d.v.avail), { color: d.v.avail < 0 ? RED : GREEN, fontWeight: 700 })}
                    {td(pill(pctOf(d.v.assigned, d.v.budget), d.v.budget > 0))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ position: "sticky", bottom: 0, background: "#faf9f6" }}>
                  <td style={{ padding: "8px", borderTop: "2px solid #eae6da" }} />
                  <td style={{ padding: "8px", fontWeight: 800, color: "var(--ink)", borderTop: "2px solid #eae6da" }}>Total</td>
                  {[tot.budget, tot.actual, tot.commit, tot.assigned, tot.avail].map((v, i) => <td key={i} style={{ padding: "8px", textAlign: "right", fontWeight: 800, borderTop: "2px solid #eae6da", color: "var(--ink)" }}>{fMoney(v)}</td>)}
                  <td style={{ padding: "8px", textAlign: "right", borderTop: "2px solid #eae6da" }}>{pill(pctOf(tot.assigned, tot.budget), tot.budget > 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </Zoomable>
    );
  };

  const glass: [string, string, string, [string, string], () => void][] = [
    ["Approved Budget", fMoney(T.budget), `across ${fN(budgeted.length)} WBS elements`, ["#1c3f6e", "#0f2547"], () => open([])],
    ["Actual Cost", fMoney(T.actual), `${pctOf(T.actual, T.budget).toFixed(0)}% of budget · PO ${fMoney(T.po)} + non-PO ${fMoney(T.nonpo)}`, ["#1a7f9c", "#0e5468"], () => open([])],
    ["Open Commitment", fMoney(T.commit), `${pctOf(T.commit, T.budget).toFixed(0)}% of budget`, ["#c99a3a", "#96691c"], () => open([])],
    ["Available Budget", fMoney(T.avail), `${pctOf(T.avail, T.budget).toFixed(0)}% of budget · as on ${NP.meta.asOn}`, ["#1e9a6c", "#0f6647"], () => open([])],
    ["Utilization", `${pctOf(T.assigned, T.budget).toFixed(1)}%`, `${fN(atRisk)} WBS critical (>95%) · click → drill`, atRisk > 0 ? ["#c0392b", "#7e1f14"] : ["#6b4fa0", "#3f2a73"], () => open([{ dim: "status", val: "critical", label: "Critical (>95%)" }])],
  ];

  // donut: actual cost · open commitment · available
  const seg: [string, number, string][] = [["Actual cost", Math.max(T.actual, 0), TEAL], ["Open commitment", Math.max(T.commit, 0), AMBER], ["Available budget", Math.max(T.avail, 0), GREEN]];
  const segTot = Math.max(seg.reduce((s, x) => s + x[1], 0), 1);
  const R = 70, C = 2 * Math.PI * R; let off = 0;

  const byStatus = new Map<string, number>();
  budgeted.forEach(w => { const st = statusOf(w.v[gi].budget, w.v[gi].assigned); byStatus.set(st, (byStatus.get(st) ?? 0) + 1); });
  const noBud = wbsList.length - budgeted.length;
  if (noBud > 0) byStatus.set("nobudget", (byStatus.get("nobudget") ?? 0) + noBud);
  const order = ["healthy", "watch", "critical", "nobudget"].filter(k => (byStatus.get(k) ?? 0) > 0);
  const top10 = [...budgeted].sort((a, b) => b.v[gi].assigned - a.v[gi].assigned).slice(0, 10);
  const mxU = Math.max(...top10.map(w => Math.max(w.v[gi].assigned, w.v[gi].budget)), 1);
  const tblWbs = useMemo(() => [...wbsList].sort((a, b) => b.v[gi].assigned - a.v[gi].assigned || (poByWbs.get(b.w)?.o ?? 0) - (poByWbs.get(a.w)?.o ?? 0)), [wbsList, gi, poByWbs]);
  const mxNP = Math.max(...depNP.map(d => Math.abs(d.v.nonpo)), 1);

  return (
    <>
      {/* ── Row 1 · budget control KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 14 }}>
        {glass.map(([k, v, sub, [c1, c2], go]) => (
          <div key={k} className="g3d" style={{ ...GLASS(c1, c2), cursor: "pointer" }} onClick={go}
            onMouseEnter={e => showTip(e, `<b>${k}</b><br/>${v} · ${sub}`)} onMouseMove={e => showTip(e, `<b>${k}</b> ${v}`)} onMouseLeave={hideTip}>
            <div style={{ position: "absolute", top: -30, right: -30, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,.10)", filter: "blur(2px)" }} />
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.4px", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>{k}</div>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 27, fontWeight: 700, lineHeight: 1.1, marginTop: 6, textShadow: "0 2px 4px rgba(0,0,0,.25)", whiteSpace: "nowrap" }}>{v}</div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,.78)", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Row 2 · PO vs non-PO actual and PO position ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 14 }}>
        <KPI k="Actual — PO" v={fMoney(T.po)} s={`${pctOf(T.po, T.actual).toFixed(0)}% · goods receipts against POs`} col={TEAL} onClick={() => open([])} />
        <KPI k="Actual — Non-PO" v={fMoney(T.nonpo)} s={`${pctOf(T.nonpo, T.actual).toFixed(0)}% · salaries, fees, reimbursements`} col={VIOLET} onClick={() => open([])} />
        <KPI k={`PO ordered ${gst ? "(with GST)" : "(excl GST)"}`} v={fMoney(ord)} s={`${fN(pos)} POs · ${fN(rows.length)} lines`} col={NAVY} onClick={() => open([])} />
        <KPI k="Delivered" v={fMoney(del)} s={`${ord > 0 ? ((del / ord) * 100).toFixed(1) : "—"}% of ordered`} col={GOLD} onClick={() => open([])} />
        <KPI k="Still to deliver" v={fMoney(still)} s="open PO value" col={AMBER} onClick={() => open([])} />
        <KPI k="Vendors in scope" v={fN(vendN)} s={`${fN(wbsList.length)} WBS in scope`} col={GREEN} />
      </div>

      {/* ── Budget breakup donut + monthly budget-vs-actual trend ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 14, marginBottom: 14 }}>
        <Zoomable title="Budget breakup" collapsible>
          <div className="g3d" style={{ ...CARD, height: "100%", marginBottom: 0, display: "flex", flexDirection: "column" }}>
            <h3 style={H3}>Budget Breakup ({gst ? "with GST" : "excl GST"})</h3>
            <div style={CAP}>distribution of approved budget — actual cost, open commitment and available</div>
            <div style={{ flex: 1, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", justifyContent: "center", padding: "4px 0" }}>
              <svg viewBox="0 0 190 190" style={{ width: 200, height: 200, flexShrink: 0 }}>
                {seg.map(([k, v, c]) => {
                  const dash = (v / segTot) * C, o = off; off += dash;
                  return <circle key={k} cx={95} cy={95} r={R} fill="none" stroke={c} strokeWidth={30} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-o} transform="rotate(-90 95 95)" style={{ cursor: "pointer" }}
                    onClick={() => open([])} onMouseEnter={e => showTip(e, `<b>${k}</b><br/>${fMoney(v)} · ${pctOf(v, T.budget).toFixed(1)}% of budget`)} onMouseMove={e => showTip(e, `<b>${k}</b> ${fMoney(v)}`)} onMouseLeave={hideTip} />;
                })}
                <text x={95} y={90} textAnchor="middle" style={{ fontFamily: "Georgia,serif", fontSize: 15, fontWeight: 700, fill: "var(--ink)" }}>{fMoney(T.budget)}</text>
                <text x={95} y={106} textAnchor="middle" style={{ fontSize: 7.5, fill: "var(--mut)", letterSpacing: 0.6 }}>APPROVED BUDGET</text>
              </svg>
              <div style={{ display: "grid", gridTemplateColumns: "12px auto auto auto", columnGap: 10, rowGap: 9, alignItems: "center" }}>
                {seg.map(([k, v, c]) => (
                  <React.Fragment key={k}>
                    <span style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
                    <span style={{ color: "var(--ink)", fontSize: 12.5, whiteSpace: "nowrap" }}>{k}</span>
                    <span style={{ fontWeight: 800, fontSize: 12.5, textAlign: "right", whiteSpace: "nowrap" }}>{fMoney(v)}</span>
                    <span style={{ background: `${c}26`, color: c, fontWeight: 800, fontSize: 11, borderRadius: 6, padding: "3px 8px", textAlign: "center" }}>{pctOf(v, T.budget).toFixed(1)}%</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </Zoomable>
        <Zoomable title="Budget vs actual and commitment trend" collapsible>
          <div className="g3d" style={{ ...CARD, height: "100%", marginBottom: 0, display: "flex", flexDirection: "column" }}>
            <h3 style={H3}>Actual &amp; Commitment Trend</h3>
            <div style={CAP}>
              <span style={{ color: TEAL, fontWeight: 800 }}>■</span> actual PO · <span style={{ color: VIOLET, fontWeight: 800 }}>■</span> actual non-PO (posting month) · <span style={{ color: AMBER, fontWeight: 800 }}>■</span> open commitment (PO month) · <span style={{ color: NAVY, fontWeight: 800 }}>━</span> cumulative (right axis) · click a month → drill
            </div>
            <BudgetTrendChart data={bTrend} onMonth={(k, l) => open([{ dim: "mon", val: k, label: l }])} />
          </div>
        </Zoomable>
      </div>

      {/* ── Company-wise · cost-head-wise ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))", gap: 14, marginBottom: 14 }}>
        <GroupTable title="Company-wise Budget Overview" sub={`(${gst ? "with GST" : "excl GST"})`} label="Company" data={byCompany} dim="root" cardTitle="Company wise budget overview" />
        <GroupTable title="Cost Head-wise Analysis" sub={`(${gst ? "with GST" : "excl GST"})`} label="Cost Head" data={byCostHead} dim="bh" cardTitle="Cost head wise analysis" />
      </div>

      {/* ── Budget health donut + Top 10 WBS by utilization ── */}
      {(() => {
        const R2 = 62, C2 = 2 * Math.PI * R2; let off2 = 0;
        const tot = Math.max(wbsList.length, 1);
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, marginBottom: 14 }}>
            <Zoomable title="Budget health donut" collapsible>
              <div className="g3d" style={{ ...CARD, height: "100%", maxHeight: 316, marginBottom: 0, display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
                <h3 style={H3}>Budget Health — WBS Count by Status</h3>
                <div style={{ ...CAP, marginBottom: 4 }}>utilized ÷ approved budget per WBS · click a status → drill</div>
                <div style={{ flex: 1, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", justifyContent: "center", alignContent: "center", minHeight: 190, padding: "2px 0" }}>
                  <svg viewBox="0 0 170 170" style={{ height: "100%", maxHeight: 200, minHeight: 160, width: "auto", aspectRatio: "1 / 1", flexShrink: 0 }}>
                    {order.map(k => {
                      const v = byStatus.get(k)!; const frac = v / tot; const dash = frac * C2; const o = off2; off2 += dash;
                      return (
                        <circle key={k} cx={85} cy={85} r={R2} fill="none" stroke={ST_COL[k]} strokeWidth={26} style={{ cursor: "pointer" }}
                          strokeDasharray={`${dash} ${C2 - dash}`} strokeDashoffset={-o} transform="rotate(-90 85 85)"
                          onClick={() => open([{ dim: "status", val: k, label: ST_LBL[k] }])}
                          onMouseEnter={e => showTip(e, `<b>${ST_LBL[k]}</b><br/>${fN(v)} WBS (${(frac * 100).toFixed(0)}%)`)}
                          onMouseMove={e => showTip(e, `<b>${ST_LBL[k]}</b> ${fN(v)}`)} onMouseLeave={hideTip} />
                      );
                    })}
                    <text x={85} y={82} textAnchor="middle" style={{ fontFamily: "Georgia,serif", fontSize: 19, fontWeight: 700, fill: "var(--ink)" }}>{fN(wbsList.length)}</text>
                    <text x={85} y={98} textAnchor="middle" style={{ fontSize: 9, fill: "var(--mut)", letterSpacing: 1 }}>WBS</text>
                  </svg>
                  <div style={{ display: "grid", gridTemplateColumns: "12px auto minmax(34px, auto)", columnGap: 8, rowGap: 5, alignItems: "center" }}>
                    {order.map(k => (
                      <React.Fragment key={k}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: ST_COL[k] }} />
                        <span style={{ color: "var(--ink)", fontSize: 12, whiteSpace: "nowrap", cursor: "pointer" }} onClick={() => open([{ dim: "status", val: k, label: ST_LBL[k] }])}>{ST_LBL[k]}</span>
                        <span style={{ fontWeight: 800, fontSize: 12, textAlign: "right" }}>{fN(byStatus.get(k)!)}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </Zoomable>
            <Zoomable title="Top WBS by utilization" collapsible>
              <div className="g3d" style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                <h3 style={H3}>Top 10 WBS by Utilization</h3>
                <div style={CAP}>red = utilized · grey = approved budget · click → drill</div>
                <div style={{ maxHeight: 300, overflowY: "auto", paddingRight: 6 }}>
                  {top10.map(w => {
                    const v = w.v[gi], code = NP.WBS[w.w];
                    return (
                      <div key={w.w} className="barrow" onClick={() => open([{ dim: "wbs", val: w.w, label: code }])}
                        onMouseEnter={e => showTip(e, `<b>${code}</b><br/>Utilized — ${fMoney(v.assigned)}<br/>Budget — ${fMoney(v.budget)}`)}
                        onMouseMove={e => showTip(e, `<b>${code}</b> ${fMoney(v.assigned)}`)} onMouseLeave={hideTip}
                        style={{ padding: "4px 0", cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 2 }}>
                          <span style={{ color: "var(--ink)", fontWeight: 700 }}>{code}</span>
                          <span style={{ color: "var(--mut)", fontWeight: 700 }}>{fMoney(v.assigned)}</span>
                        </div>
                        <div style={{ position: "relative", height: 8, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ position: "absolute", inset: 0, width: `${(v.budget / mxU) * 100}%`, background: "#c9c5b8", borderRadius: 4 }} />
                          <div style={{ position: "absolute", inset: 0, width: `${(v.assigned / mxU) * 100}%`, background: RED, borderRadius: 4 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Zoomable>
          </div>
        );
      })()}

      {/* ── Department: non-PO actual · PO ordered vs delivered ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(430px, 1fr))", gap: 14, marginBottom: 14 }}>
        <Zoomable title="Non-PO actual by department" collapsible>
          <div style={{ ...CARD, height: "100%", marginBottom: 0, display: "flex", flexDirection: "column" }}>
            <h3 style={H3}>Non-PO Actual — by Department</h3>
            <div style={CAP}>postings other than PO goods receipts · red = net credit · click → drill</div>
            <div style={{ flex: 1, minHeight: 0, maxHeight: 320, overflowY: "auto", paddingRight: 6 }}>
              {depNP.map(d => (
                <div key={d.k} className="barrow" onClick={() => open([{ dim: "pgrp", val: d.k, label: d.label }])}
                  onMouseEnter={ev => showTip(ev, `<b>${d.label}</b><br/>Non-PO — ${fMoney(d.v.nonpo)}<br/>PO — ${fMoney(d.v.po)}`)}
                  onMouseMove={ev => showTip(ev, `<b>${d.label}</b> ${fMoney(d.v.nonpo)}`)} onMouseLeave={hideTip}
                  style={{ padding: "4px 0", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                    <span style={{ color: "var(--ink)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{d.label}</span>
                    <span style={{ color: d.v.nonpo < 0 ? RED : "var(--mut)", fontWeight: 700, flexShrink: 0 }}>{fMoney(d.v.nonpo)}</span>
                  </div>
                  <div style={{ position: "relative", height: 8, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, width: `${(Math.abs(d.v.nonpo) / mxNP) * 100}%`, background: d.v.nonpo < 0 ? RED : VIOLET, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Zoomable>
        <BarPair cardTitle="Ordered by department" title="Ordered vs Delivered — by Department" cap="navy = ordered · teal = delivered · click → drill" data={byDept} names={NP.PGRP} dim="pgrp" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(430px, 1fr))", gap: 14, marginBottom: 14 }}>
        <Zoomable title="Monthly PO trend" collapsible>
          <div style={{ ...CARD, height: "100%", marginBottom: 0, display: "flex", flexDirection: "column" }}>
            <h3 style={H3}>Monthly PO — Ordered vs Delivered</h3>
            <div style={CAP}>by document date · navy = ordered · teal = delivered · click a month → drill</div>
            <MonthlyTrendChart data={trend} onMonth={(k, l) => open([{ dim: "mon", val: k, label: l }])} />
          </div>
        </Zoomable>
        <BarPair cardTitle="Top vendors nonproject" title="Top Vendors" cap={`top 60 of ${fN(byVend.length)} · click → drill`} data={byVend} names={NP.VEND} dim="vend" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, marginBottom: 14 }}>
        <BarPair cardTitle="Ordered by company" title="PO Ordered by Company" cap="click → drill" data={byRoot} names={NP.ROOT} dim="root" />
      </div>

      <Zoomable title="WBS wise nonproject table" collapsible>
        <div style={CARD}>
          <h3 style={H3}>WBS-wise Summary</h3>
          <div style={CAP}>{fN(tblWbs.length)} WBS in scope{tblWbs.length > 400 ? " · top 400 by utilized shown" : ""} · click a row → drill</div>
          <div style={{ maxHeight: 420, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1180 }}>
              <thead>
                <tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                  {["WBS", "Description", "Budget", "Actual PO", "Actual Non-PO", "Actual Total", "Commitment", "Available", "PO ordered", "PO delivered", "% Util", "Status"].map(h => (
                    <th key={h} style={{ textAlign: ["WBS", "Description", "Status"].includes(h) ? "left" : "right", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "8px 10px", borderBottom: "2px solid #eae6da", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tblWbs.slice(0, 400).map(w => {
                  const v = w.v[gi], po = poByWbs.get(w.w);
                  const stat = w.has ? statusOf(v.budget, v.assigned) : "nobudget";
                  const c = (x: React.ReactNode, extra?: React.CSSProperties) => <td style={{ padding: "6px 10px", textAlign: "right", borderBottom: "1px solid #f0ede5", whiteSpace: "nowrap", ...extra }}>{x}</td>;
                  return (
                    <tr key={w.w} onClick={() => open([{ dim: "wbs", val: w.w, label: NP.WBS[w.w] }])} style={{ cursor: "pointer" }}
                      onMouseEnter={ev => { (ev.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                      onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.background = ""; }}>
                      {c(NP.WBS[w.w], { textAlign: "left", fontWeight: 700, color: "var(--ink)" })}
                      {c(NP.WDESC[w.wdesc] ?? "—", { textAlign: "left", maxWidth: 230, overflow: "hidden", textOverflow: "ellipsis" })}
                      {c(w.has ? fMoney(v.budget) : "—")}
                      {c(fMoney(v.po))}
                      {c(fMoney(v.nonpo), { color: v.nonpo < 0 ? RED : undefined })}
                      {c(fMoney(v.actual), { fontWeight: 700 })}
                      {c(fMoney(v.commit), { color: AMBER })}
                      {c(w.has ? fMoney(v.avail) : "—", { color: v.avail < 0 ? RED : GREEN, fontWeight: 700 })}
                      {c(po ? fMoney(po.o) : "—")}
                      {c(po ? fMoney(po.d) : "—", { color: TEAL })}
                      {c(w.has && v.budget > 0 ? `${pctOf(v.assigned, v.budget).toFixed(1)}%` : "—", { color: "var(--mut)", fontWeight: 700 })}
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid #f0ede5" }}>
                        <span style={{ background: `${ST_COL[stat]}1f`, color: ST_COL[stat], fontWeight: 800, fontSize: 10.5, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>{ST_LBL[stat]}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Zoomable>

      <NpDrillDrawer seed={drill} baseRows={rows} scope={scope} gst={gst}
        onClose={() => setDrill(null)}
        onAddChip={chip => setDrill(d => (d && !d.chips.some(c => c.dim === chip.dim) ? { chips: [...d.chips, chip] } : d))} />
    </>
  );
}
