import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showTip, hideTip } from "../common/hoverTip";
import { Zoomable } from "../common/Zoomable";
import raw from "../../data/costNonProject.json";
import { fN, fMoney, WBS_ROWS } from "./costShared";

/** Non-project FY-26 PO detail (ZALR export, joined to the CN41 master).
 * L = [0 wbs, 1 wdesc, 2 vend, 3 pgrp, 4 plant, 5 gl, 6 dtyp, 7 comp,
 *      8 root, 9 day, 10 po, 11 ord, 12 ordGst, 13 del, 14 delGst,
 *      15 still, 16 mapped] */
interface NpDataset {
  WBS: string[]; WDESC: string[]; VEND: string[]; PGRP: string[]; PLANT: string[];
  GL: string[]; DTYP: string[]; COMP: string[]; ROOT: string[];
  L: (number | string)[][];
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
  root: r[8] as number, day: r[9] as number, po: String(r[10]),
  ord: r[11] as number, ordGst: r[12] as number, del: r[13] as number, delGst: r[14] as number,
  still: r[15] as number,
}));

const NAVY = "#14213D", TEAL = "#0E7490", GOLD = "#B8893C", GREEN = "#1BAF7A", RED = "#c0392b", AMBER = "#EDA100";

/** Approved budget per WBS from the 07-Sep ZALR budget run (same as-on
 * as the PO export) — the PO detail alone carries no budget columns. */
const BUDGET_BY_CODE = (() => {
  const m = new Map<string, { budget: number; assigned: number }>();
  WBS_ROWS.forEach(w => { if (w.typ === 0) m.set(w.wbs, { budget: w.budget, assigned: w.assigned }); });
  return m;
})();
const statusOf = (b: number, u: number) => b <= 0 ? "nobudget" : u / b > 0.95 ? "critical" : u / b > 0.8 ? "watch" : "healthy";
const ST_COL: Record<string, string> = { healthy: GREEN, watch: AMBER, critical: RED, nobudget: "#8a94a6" };
const ST_LBL: Record<string, string> = { healthy: "Healthy (<80%)", watch: "Watch (80–95%)", critical: "Critical (>95%)", nobudget: "No budget" };

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
const ymLbl = (k: string) => new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

export type NpDim = "wbs" | "vend" | "pgrp" | "plant" | "gl" | "comp" | "root" | "mon" | "dtyp";
export interface NpChip { dim: NpDim; val: number | string; label: string }
const DIMN: Record<NpDim, string> = { wbs: "WBS", vend: "Vendor", pgrp: "Department", plant: "Plant", gl: "GL", comp: "Company", root: "Root", mon: "Month", dtyp: "Doc type" };
const matches = (r: NpRow, ch: NpChip): boolean => {
  switch (ch.dim) {
    case "wbs": return r.wbs === ch.val;
    case "vend": return r.vend === ch.val;
    case "pgrp": return r.pgrp === ch.val;
    case "plant": return r.plant === ch.val;
    case "gl": return r.gl === ch.val;
    case "comp": return r.comp === ch.val;
    case "root": return r.root === ch.val;
    case "dtyp": return r.dtyp === ch.val;
    case "mon": return r.day >= 0 && ymOf(r.day) === ch.val;
  }
};


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
function NpDrillDrawer({ seed, baseRows, gst, onClose, onAddChip }: {
  seed: { chips: NpChip[] } | null; baseRows: NpRow[]; gst: boolean;
  onClose: () => void; onAddChip: (c: NpChip) => void;
}) {
  const chips = seed?.chips ?? [];
  const has = (d: NpDim) => chips.some(c => c.dim === d);
  const rows = useMemo(() => baseRows.filter(r => chips.every(ch => matches(r, ch))), [baseRows, chips]);
  const vOrd = (r: NpRow) => gst ? r.ordGst : r.ord;
  const vDel = (r: NpRow) => gst ? r.delGst : r.del;
  const ord = rows.reduce((s, r) => s + vOrd(r), 0);
  const del = rows.reduce((s, r) => s + vDel(r), 0);
  const still = rows.reduce((s, r) => s + r.still, 0);

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
              <span style={{ color: "var(--mut)", whiteSpace: "nowrap" }}>{fMoney(it.v)}</span>
            </div>
            <div style={{ height: 7, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(Math.abs(it.v) / mx) * 100}%`, background: TEAL, borderRadius: 4 }} />
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
  const poLines = useMemo(() => [...rows].sort((a, b) => vOrd(b) - vOrd(a)).slice(0, 200), [rows, gst]);

  return (
    <AnimatePresence>
      {seed && (
        <>
          <motion.div key="npov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.35)", zIndex: 70 }} />
          <motion.div key="npdw" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(580px, 95vw)", zIndex: 71, background: "#f6f4ef", boxShadow: "-14px 0 46px rgba(20,33,61,.35)", display: "flex", flexDirection: "column" }}>
            <div style={{ background: NAVY, padding: "14px 18px", borderBottom: "3px solid var(--gold)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", color: "#c9b27c" }}>NON-PROJECT DRILL · {gst ? "WITH GST" : "EXCL GST"}</div>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
                {[{ l: "Ordered", v: fMoney(ord), c: NAVY }, { l: "Delivered", v: fMoney(del), c: TEAL }, { l: "Still to deliver", v: fMoney(still), c: AMBER }].map(t => (
                  <div key={t.l} style={{ background: "#fff", border: "1px solid #eae6da", borderLeft: `5px solid ${t.c}`, borderRadius: 10, padding: "9px 11px" }}>
                    <div style={{ fontFamily: "Georgia,serif", fontSize: 16, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>{t.v}</div>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", marginTop: 3 }}>{t.l}</div>
                  </div>
                ))}
              </div>
              {!has("vend") && <div style={CARD}><h3 style={H3}>Top vendors</h3><div style={CAP}>ordered value · click → add filter</div><Bars items={agg(r => r.vend, NP.VEND)} dim="vend" /></div>}
              {!has("wbs") && <div style={CARD}><h3 style={H3}>Top WBS</h3><div style={CAP}>ordered value · click → add filter</div><Bars items={agg(r => r.wbs, NP.WBS)} dim="wbs" /></div>}
              {!has("gl") && <div style={CARD}><h3 style={H3}>By GL</h3><div style={CAP}>click → add filter</div><Bars items={agg(r => r.gl, NP.GL)} dim="gl" /></div>}
              <div style={CARD}>
                <h3 style={H3}>PO lines</h3>
                <div style={CAP}>top {Math.min(poLines.length, 200)} of {fN(rows.length)} by ordered value</div>
                <div style={{ maxHeight: 320, overflowY: "auto", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 560 }}>
                    <thead>
                      <tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                        {["PO", "Vendor", "Date", "Ordered", "Delivered", "Open"].map(h => (
                          <th key={h} style={{ textAlign: ["Ordered", "Delivered", "Open"].includes(h) ? "right" : "left", fontSize: 9.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "6px 8px", borderBottom: "2px solid #eae6da", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
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
                          <td style={{ padding: "5px 8px", textAlign: "right", color: r.still > 0 ? AMBER : "var(--mut)", fontWeight: r.still > 0 ? 700 : 500 }}>{fMoney(r.still)}</td>
                        </tr>
                      ))}
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
export function NonProjectView({ rows, gst }: { rows: NpRow[]; gst: boolean }) {
  const [drill, setDrill] = useState<{ chips: NpChip[] } | null>(null);
  const open = (chips: NpChip[]) => setDrill({ chips });
  const vOrd = (r: NpRow) => gst ? r.ordGst : r.ord;
  const vDel = (r: NpRow) => gst ? r.delGst : r.del;

  const ord = rows.reduce((s, r) => s + vOrd(r), 0);
  const del = rows.reduce((s, r) => s + vDel(r), 0);
  const still = rows.reduce((s, r) => s + r.still, 0);
  const pos = new Set(rows.map(r => r.po)).size;
  const wbsN = new Set(rows.map(r => r.wbs)).size;
  const vendN = new Set(rows.map(r => r.vend)).size;

  const aggOD = (key: (r: NpRow) => number) => {
    const m = new Map<number, { o: number; d: number; n: number }>();
    rows.forEach(r => { const k = key(r); if (!m.has(k)) m.set(k, { o: 0, d: 0, n: 0 }); const e = m.get(k)!; e.o += vOrd(r); e.d += vDel(r); e.n++; });
    return [...m.entries()].sort((a, b) => b[1].o - a[1].o);
  };
  const byDept = useMemo(() => aggOD(r => r.pgrp), [rows, gst]);
  const byRoot = useMemo(() => aggOD(r => r.root), [rows, gst]);
  const byVend = useMemo(() => aggOD(r => r.vend), [rows, gst]);
  const byWbs = useMemo(() => aggOD(r => r.wbs), [rows, gst]);
  const trend = useMemo(() => {
    const m = new Map<string, { o: number; d: number }>();
    rows.forEach(r => { if (r.day < 0) return; const k = ymOf(r.day); if (!m.has(k)) m.set(k, { o: 0, d: 0 }); const e = m.get(k)!; e.o += vOrd(r); e.d += vDel(r); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, gst]);

  const KPI = ({ k, v, s, col }: { k: string; v: string; s: string; col: string }) => (
    <div onMouseEnter={e => showTip(e, `<b>${k}</b><br/>${v} · ${s}`)} onMouseMove={e => showTip(e, `<b>${k}</b><br/>${v}`)} onMouseLeave={hideTip}
      style={{ background: "#fff", border: "1px solid #eae6da", borderLeft: `6px solid ${col}`, borderRadius: 12, boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)", padding: "12px 14px" }}>
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

  return (
    <>
      {/* ── Budget control strip — glass cards, reference-sheet metrics ── */}
      {(() => {
        const scopeCodes = new Set(rows.map(r => NP.WBS[r.wbs]));
        const anyFilter = rows.length !== NP_ROWS.length;
        const brows = [...BUDGET_BY_CODE.entries()].filter(([code]) => !anyFilter || scopeCodes.has(code));
        const budget = brows.reduce((s2, [, b]) => s2 + b.budget, 0);
        const utilized = brows.reduce((s2, [, b]) => s2 + b.assigned, 0);
        const balance = budget - utilized;
        const utilPct = budget > 0 ? (utilized / budget) * 100 : 0;
        const risk = brows.filter(([, b]) => statusOf(b.budget, b.assigned) === "critical").length;
        const cards: [string, string, string, [string, string]][] = [
          ["Approved Budget", fMoney(budget), `across ${fN(brows.length)} WBS elements`, ["#1c3f6e", "#0f2547"]],
          ["Utilized", fMoney(utilized), `from ${fN(pos)} PO documents`, ["#1a7f9c", "#0e5468"]],
          ["Balance Available", fMoney(balance), `unspent as on ${NP.meta.asOn}`, ["#1e9a6c", "#0f6647"]],
          ["Utilization %", `${utilPct.toFixed(1)}%`, "watch >80% · critical >95%", ["#c99a3a", "#96691c"]],
          ["WBS at Risk", fN(risk), "critical (>95% utilized)", ["#c0392b", "#7e1f14"]],
        ];
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
            {cards.map(([k, v, sub, [c1, c2]]) => (
              <div key={k} className="g3d" style={GLASS(c1, c2)}
                onMouseEnter={e => showTip(e, `<b>${k}</b><br/>${v} · ${sub}`)} onMouseMove={e => showTip(e, `<b>${k}</b> ${v}`)} onMouseLeave={hideTip}>
                <div style={{ position: "absolute", top: -30, right: -30, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,.10)", filter: "blur(2px)" }} />
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.4px", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>{k}</div>
                <div style={{ fontFamily: "Georgia,serif", fontSize: 27, fontWeight: 700, lineHeight: 1.1, marginTop: 6, textShadow: "0 2px 4px rgba(0,0,0,.25)", whiteSpace: "nowrap" }}>{v}</div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,.75)", marginTop: 6 }}>{sub}</div>
              </div>
            ))}
          </div>
        );
      })()}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 14 }}>
        <KPI k={`Ordered ${gst ? "(with GST)" : "(excl GST)"}`} v={fMoney(ord)} s={`${fN(pos)} POs · ${fN(rows.length)} lines`} col={NAVY} />
        <KPI k="Delivered" v={fMoney(del)} s={`${ord > 0 ? ((del / ord) * 100).toFixed(1) : "—"}% of ordered`} col={TEAL} />
        <KPI k="Still to deliver" v={fMoney(still)} s="open commitment (excl GST)" col={AMBER} />
        <KPI k="WBS in scope" v={fN(wbsN)} s={`${fN(vendN)} vendors`} col={GOLD} />
      </div>

      {/* ── Budget health donut + Top 10 WBS by utilization ── */}
      {(() => {
        const scopeCodes = new Set(rows.map(r => NP.WBS[r.wbs]));
        const anyFilter = rows.length !== NP_ROWS.length;
        const brows = [...BUDGET_BY_CODE.entries()].filter(([code]) => !anyFilter || scopeCodes.has(code));
        const byStatus = new Map<string, number>();
        brows.forEach(([, b]) => { const st = statusOf(b.budget, b.assigned); byStatus.set(st, (byStatus.get(st) ?? 0) + 1); });
        const top10 = [...brows].sort((a, b) => b[1].assigned - a[1].assigned).slice(0, 10);
        const mxU = Math.max(...top10.map(([, b]) => Math.max(b.assigned, b.budget)), 1);
        const R = 62, C = 2 * Math.PI * R; let off = 0;
        const order = ["healthy", "watch", "critical", "nobudget"].filter(k => (byStatus.get(k) ?? 0) > 0);
        const tot = Math.max(brows.length, 1);
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, marginBottom: 14 }}>
            <Zoomable title="Budget health donut" collapsible>
              {/* Compact body (~240px): flex column card capped in height so the
                  grid row can't inflate it; donut + legend centered together,
                  wrapping to a stacked layout on narrow screens. */}
              <div className="g3d" style={{ ...CARD, height: "100%", maxHeight: 316, marginBottom: 0, display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
                <h3 style={H3}>Budget Health — WBS Count by Status</h3>
                <div style={{ ...CAP, marginBottom: 4 }}>utilized ÷ approved budget per WBS</div>
                <div style={{ flex: 1, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", justifyContent: "center", alignContent: "center", minHeight: 190, padding: "2px 0" }}>
                  <svg viewBox="0 0 170 170" style={{ height: "100%", maxHeight: 200, minHeight: 160, width: "auto", aspectRatio: "1 / 1", flexShrink: 0 }}>
                    {order.map(k => {
                      const v = byStatus.get(k)!; const frac = v / tot; const dash = frac * C; const o = off; off += dash;
                      return (
                        <circle key={k} cx={85} cy={85} r={R} fill="none" stroke={ST_COL[k]} strokeWidth={26}
                          strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-o} transform="rotate(-90 85 85)"
                          onMouseEnter={e => showTip(e, `<b>${ST_LBL[k]}</b><br/>${fN(v)} WBS (${(frac * 100).toFixed(0)}%)`)}
                          onMouseMove={e => showTip(e, `<b>${ST_LBL[k]}</b> ${fN(v)}`)} onMouseLeave={hideTip} />
                      );
                    })}
                    <text x={85} y={82} textAnchor="middle" style={{ fontFamily: "Georgia,serif", fontSize: 19, fontWeight: 700, fill: "var(--ink)" }}>{fN(tot)}</text>
                    <text x={85} y={98} textAnchor="middle" style={{ fontSize: 9, fill: "var(--mut)", letterSpacing: 1 }}>WBS</text>
                  </svg>
                  <div style={{ display: "grid", gridTemplateColumns: "12px auto minmax(34px, auto)", columnGap: 8, rowGap: 5, alignItems: "center" }}>
                    {order.map(k => (
                      <React.Fragment key={k}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: ST_COL[k] }} />
                        <span style={{ color: "var(--ink)", fontSize: 12, whiteSpace: "nowrap" }}>{ST_LBL[k]}</span>
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
                  {top10.map(([code, b]) => {
                    const wIdx = NP.WBS.indexOf(code);
                    return (
                      <div key={code} className="barrow" onClick={() => { if (wIdx >= 0) open([{ dim: "wbs", val: wIdx, label: code }]); }}
                        onMouseEnter={e => showTip(e, `<b>${code}</b><br/>Utilized — ${fMoney(b.assigned)}<br/>Budget — ${fMoney(b.budget)}`)}
                        onMouseMove={e => showTip(e, `<b>${code}</b> ${fMoney(b.assigned)}`)} onMouseLeave={hideTip}
                        style={{ padding: "4px 0", cursor: wIdx >= 0 ? "pointer" : "default" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 2 }}>
                          <span style={{ color: "var(--ink)", fontWeight: 700 }}>{code}</span>
                          <span style={{ color: "var(--mut)", fontWeight: 700 }}>{fMoney(b.assigned)}</span>
                        </div>
                        <div style={{ position: "relative", height: 8, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ position: "absolute", inset: 0, width: `${(b.budget / mxU) * 100}%`, background: "#c9c5b8", borderRadius: 4 }} />
                          <div style={{ position: "absolute", inset: 0, width: `${(b.assigned / mxU) * 100}%`, background: RED, borderRadius: 4 }} />
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(430px, 1fr))", gap: 14, marginBottom: 14 }}>
        <BarPair cardTitle="Ordered by department" title="Ordered vs Delivered — by Department" cap="navy = ordered · teal = delivered · click → drill" data={byDept} names={NP.PGRP} dim="pgrp" />
        <Zoomable title="Monthly PO trend" collapsible>
          <div style={{ ...CARD, height: "100%", marginBottom: 0, display: "flex", flexDirection: "column" }}>
            <h3 style={H3}>Monthly PO — Ordered vs Delivered</h3>
            <div style={CAP}>by document date · navy = ordered · teal = delivered · click a month → drill</div>
            <MonthlyTrendChart data={trend} onMonth={(k, l) => open([{ dim: "mon", val: k, label: l }])} />
          </div>
        </Zoomable>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, marginBottom: 14 }}>
        <BarPair cardTitle="Ordered by company" title="By Company (CN41 root)" cap="non-project trees from the master · click → drill" data={byRoot} names={NP.ROOT} dim="root" />
        <BarPair cardTitle="Top vendors nonproject" title="Top Vendors" cap={`top 60 of ${fN(byVend.length)} · click → drill`} data={byVend} names={NP.VEND} dim="vend" />
      </div>

      <Zoomable title="WBS wise nonproject table" collapsible>
        <div style={CARD}>
          <h3 style={H3}>WBS-wise Summary</h3>
          <div style={CAP}>{fN(byWbs.length)} WBS in scope · click a row → drill</div>
          <div style={{ maxHeight: 400, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 760 }}>
              <thead>
                <tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                  {["WBS", "Description", "Budget", "Ordered", "Delivered", "Still to deliver", "% Util", "Status"].map(h => (
                    <th key={h} style={{ textAlign: ["Budget", "Ordered", "Delivered", "Still to deliver", "% Util"].includes(h) ? "right" : "left", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "8px 10px", borderBottom: "2px solid #eae6da", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byWbs.slice(0, 400).map(([k, e]) => {
                  const wr = rows.filter(r => r.wbs === k);
                  const st = wr.reduce((s, r) => s + r.still, 0);
                  const desc = NP.WDESC[wr[0]?.wdesc ?? -1] ?? "—";
                  const bud = BUDGET_BY_CODE.get(NP.WBS[k]);
                  const stat = bud ? statusOf(bud.budget, bud.assigned) : "nobudget";
                  const utilPct = bud && bud.budget > 0 ? (bud.assigned / bud.budget) * 100 : null;
                  return (
                    <tr key={k} onClick={() => open([{ dim: "wbs", val: k, label: NP.WBS[k] }])} style={{ cursor: "pointer" }}
                      onMouseEnter={ev => { (ev.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                      onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.background = ""; }}>
                      <td style={{ padding: "6px 10px", fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", borderBottom: "1px solid #f0ede5" }}>{NP.WBS[k]}</td>
                      <td style={{ padding: "6px 10px", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderBottom: "1px solid #f0ede5" }}>{desc}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--ink)", borderBottom: "1px solid #f0ede5" }}>{bud ? fMoney(bud.budget) : "—"}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, borderBottom: "1px solid #f0ede5" }}>{fMoney(e.o)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: TEAL, borderBottom: "1px solid #f0ede5" }}>{fMoney(e.d)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: st > 0 ? AMBER : "var(--mut)", fontWeight: st > 0 ? 700 : 500, borderBottom: "1px solid #f0ede5" }}>{fMoney(st)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--mut)", fontWeight: 700, borderBottom: "1px solid #f0ede5" }}>{utilPct === null ? "—" : `${utilPct.toFixed(1)}%`}</td>
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

      <NpDrillDrawer seed={drill} baseRows={rows} gst={gst}
        onClose={() => setDrill(null)}
        onAddChip={chip => setDrill(d => (d && !d.chips.some(c => c.dim === chip.dim) ? { chips: [...d.chips, chip] } : d))} />
    </>
  );
}
