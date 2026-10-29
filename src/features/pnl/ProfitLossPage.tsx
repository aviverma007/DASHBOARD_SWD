import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PageBanner, BANNER_LBL } from "../../components/layout/PageBanner";
import { Zoomable } from "../../components/common/Zoomable";
import { showTip, hideTip } from "../../components/common/hoverTip";
import "../../components/inventory/smartworldInventory.css";
import {
  PROJECTS, LINKED, UNLINKED, AS_ON, PH4_SHARE_PCT, TIE_OUT, measure, pnl, monthly, sumOf,
  type Bucket, type ProjKey,
} from "./pnlData";

/* ---------------- house styles (same as Cost / SAP Collection) ---------------- */
const NAVY = "#14213D", TEAL = "#0E7490", GOLD = "#B8893C", GREEN = "#1BAF7A", RED = "#c0392b", AMBER = "#EDA100", BLUE = "#2a78d6";
const CAT = ["#0E7490", "#7b5cb8", "#1BAF7A", "#EDA100", "#e34948", "#2a78d6", "#8a94a6"];
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #eae6da", borderRadius: 12, boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)", padding: "14px 16px", marginBottom: 14 };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 15.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 2px" };
const CAP: React.CSSProperties = { fontSize: 11, color: "var(--mut)", marginBottom: 10 };
const GLASS = (c1: string, c2: string): React.CSSProperties => ({
  background: `linear-gradient(150deg, ${c1} 0%, ${c2} 100%)`, border: "1px solid rgba(255,255,255,.35)", borderRadius: 14,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), 0 10px 24px rgba(20,33,61,.28), 0 2px 6px rgba(20,33,61,.18)",
  padding: "14px 16px", color: "#fff", position: "relative", overflow: "hidden", cursor: "pointer",
});
const TH: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "8px 10px", borderBottom: "2px solid #eae6da", whiteSpace: "nowrap", textAlign: "right", position: "sticky", top: 0, background: "#faf9f6" };
const TD: React.CSSProperties = { padding: "7px 10px", borderBottom: "1px solid #f0ede5", whiteSpace: "nowrap", textAlign: "right" };

const fN = (n: number) => Math.round(n).toLocaleString("en-IN");
const fCr = (v: number) => `₹${(v / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} Cr`;
const fMoney = (v: number) => { const a = Math.abs(v); return a >= 1e7 ? fCr(v) : a >= 1e5 ? `₹${(v / 1e5).toFixed(1)} L` : `₹${fN(v)}`; };
const fPct = (v: number, d = 1) => (isFinite(v) ? `${v.toFixed(d)}%` : "—");
const ymLbl = (k: string) => new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(" ", "'");
const short = (v: number) => { const a = Math.abs(v); return a >= 1e9 ? `${(v / 1e7).toFixed(0)} Cr` : a >= 1e7 ? `${(v / 1e7).toFixed(1)} Cr` : a >= 1e5 ? `${(v / 1e5).toFixed(0)} L` : fN(v); };

/* ---------------- drill seed ---------------- */
interface Drill { proj?: ProjKey; head?: string; ym?: string }

/* ---------------- small pieces ---------------- */
function ProjectPicker({ sel, onChange }: { sel: ProjKey[]; onChange: (v: ProjKey[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const label = sel.length === 0 ? "All projects" : sel.length === 1 ? PROJECTS.find(p => p.key === sel[0])!.name : `${sel.length} projects`;
  return (
    <div ref={ref} style={{ position: "relative", width: 220 }}>
      <label style={BANNER_LBL}>Project</label>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width: "100%", height: 34, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", background: "#fff", border: "1px solid #d8d2c4", borderRadius: 8, padding: "0 10px", cursor: "pointer", fontFamily: "inherit" }}>
        <span>{label}</span><span style={{ fontSize: 9, color: "var(--mut)" }}>▼</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, width: 250, marginTop: 5, zIndex: 40, background: "#fff", color: "var(--ink)", border: "1px solid #d8d2c4", borderRadius: 8, boxShadow: "0 8px 22px rgba(20,33,61,.18)", padding: 6 }}>
          {PROJECTS.map(p => {
            const on = sel.includes(p.key);
            return (
              <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: "pointer", borderRadius: 6, background: on ? "rgba(14,116,144,.08)" : "transparent" }}>
                <input type="checkbox" checked={on} onChange={() => onChange(on ? sel.filter(k => k !== p.key) : [...sel, p.key])} />
                {p.name}<span style={{ marginLeft: "auto", fontSize: 11, color: "var(--mut)" }}>{p.city}</span>
              </label>
            );
          })}
          {sel.length > 0 && <button type="button" onClick={() => onChange([])} style={{ width: "100%", marginTop: 4, padding: "6px", fontSize: 12, fontWeight: 600, border: "1px solid #eae6da", background: "#faf8f2", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>Clear selection</button>}
        </div>
      )}
    </div>
  );
}

function Bars({ items, onPick, color = TEAL, money = true, max }: {
  items: { k: string; label: string; v: number; sub?: string }[]; onPick?: (k: string, label: string) => void; color?: string; money?: boolean; max?: number;
}) {
  const mx = max ?? Math.max(...items.map(i => Math.abs(i.v)), 1);
  return (
    <div>
      {items.map(it => (
        <div key={it.k} className="barrow" onClick={onPick ? () => onPick(it.k, it.label) : undefined}
          onMouseEnter={e => showTip(e, `<b>${it.label}</b><br/>${money ? fMoney(it.v) : fN(it.v)}${it.sub ? `<br/>${it.sub}` : ""}${onPick ? "<br/>click → drill" : ""}`)}
          onMouseMove={e => showTip(e, `<b>${it.label}</b> ${money ? fMoney(it.v) : fN(it.v)}`)} onMouseLeave={hideTip}
          style={{ padding: "4px 0", cursor: onPick ? "pointer" : "default" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2, gap: 8 }}>
            <span style={{ color: "var(--ink)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
            <span style={{ color: it.v < 0 ? RED : "var(--mut)", fontWeight: 700, whiteSpace: "nowrap" }}>{money ? fMoney(it.v) : fN(it.v)}</span>
          </div>
          <div style={{ height: 8, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(Math.abs(it.v) / mx) * 100}%`, background: it.v < 0 ? RED : color, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Expense-head donut (top six + other); click a slice → drill into that head. */
function HeadDonut({ heads, total, onPick }: { heads: { k: string; v: number }[]; total: number; onPick: (k: string) => void }) {
  const R = 64, C = 2 * Math.PI * R; let off = 0;
  const pos = heads.filter(h => h.v > 0), tot = Math.max(pos.reduce((s, h) => s + h.v, 0), 1);
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox="0 0 170 170" style={{ width: 170, height: 170, flexShrink: 0 }}>
        {pos.map((h, i) => {
          const dash = (h.v / tot) * C, o = off; off += dash;
          return <circle key={h.k} cx={85} cy={85} r={R} fill="none" stroke={CAT[i % CAT.length]} strokeWidth={28} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-o} transform="rotate(-90 85 85)"
            style={{ cursor: h.k === "Other" ? "default" : "pointer" }} onClick={() => h.k !== "Other" && onPick(h.k)}
            onMouseEnter={e => showTip(e, `<b>${h.k}</b><br/>${fCr(h.v)} · ${((h.v / tot) * 100).toFixed(1)}%`)} onMouseMove={e => showTip(e, `<b>${h.k}</b> ${fCr(h.v)}`)} onMouseLeave={hideTip} />;
        })}
        <text x={85} y={80} textAnchor="middle" style={{ fontSize: 9, fill: "var(--mut)", letterSpacing: 1 }}>TOTAL</text>
        <text x={85} y={98} textAnchor="middle" style={{ fontFamily: "Georgia,serif", fontSize: 16, fontWeight: 700, fill: "var(--ink)" }}>{(total / 1e7).toFixed(1)} Cr</text>
      </svg>
      <div style={{ flex: 1, minWidth: 220 }}>
        {heads.map((h, i) => (
          <div key={h.k} onClick={() => h.k !== "Other" && onPick(h.k)} style={{ display: "grid", gridTemplateColumns: "12px 1fr auto 46px", gap: 8, alignItems: "center", padding: "4px 0", fontSize: 12.5, cursor: h.k === "Other" ? "default" : "pointer" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: CAT[i % CAT.length] }} />
            <span style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.k}</span>
            <b style={{ color: "var(--ink)" }}>{fCr(h.v)}</b>
            <span style={{ color: "var(--mut)", textAlign: "right", fontSize: 11.5 }}>{total ? ((h.v / total) * 100).toFixed(1) : "0"}%</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #eae6da", marginTop: 6, paddingTop: 6, fontSize: 13, fontWeight: 800 }}>
          <span>Total</span><span style={{ color: TEAL }}>{fCr(total)}</span>
        </div>
      </div>
    </div>
  );
}

/** Monthly sales booked vs spend, with net (sales − spend) line; click a month → drill. */
function TrendChart({ data, onMonth }: { data: [string, { sales: number; spend: number }][]; onMonth: (k: string) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(es => setW(es[0].contentRect.width));
    ro.observe(ref.current); return () => ro.disconnect();
  }, []);
  const W = Math.max(w, 360), H = 300, ML = 56, MR = 12, MT = 14, MB = 34;
  const plotW = W - ML - MR, plotH = H - MT - MB, n = Math.max(data.length, 1), band = plotW / n;
  const barW = Math.max(2, Math.min(14, band * 0.32));
  const net = data.map(([, e]) => e.sales - e.spend);
  const hi = Math.max(...data.map(([, e]) => Math.max(e.sales, e.spend)), ...net, 1), lo = Math.min(0, ...net);
  const y = (v: number) => MT + ((hi - v) / (hi - lo)) * plotH;
  const step = Math.max(1, Math.ceil(n / Math.max(4, Math.floor(plotW / 56))));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => lo + (hi - lo) * f);
  const line = data.map(([, ], i) => `${i ? "L" : "M"}${(ML + i * band + band / 2).toFixed(1)},${y(net[i]).toFixed(1)}`).join(" ");
  return (
    <div ref={ref} style={{ width: "100%", overflow: "hidden" }}>
      {w > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }} role="img" aria-label="Monthly sales booked versus spend">
          {ticks.map((t, i) => (
            <g key={i}><line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke="#eae6da" />
              <text x={ML - 6} y={y(t) + 3.5} textAnchor="end" style={{ fontSize: 10, fontWeight: 700, fill: "var(--mut)" }}>₹{short(t)}</text></g>
          ))}
          <line x1={ML} x2={W - MR} y1={y(0)} y2={y(0)} stroke="#c9c3b4" strokeWidth={1.4} />
          {data.map(([k, e], i) => {
            const cx = ML + i * band + band / 2;
            return (
              <g key={k} style={{ cursor: "pointer" }} onClick={() => onMonth(k)}
                onMouseEnter={ev => showTip(ev, `<b>${ymLbl(k)}</b><br/>Sales booked — ${fMoney(e.sales)}<br/>Spend — ${fMoney(e.spend)}<br/>Net — ${fMoney(e.sales - e.spend)}<br/>click → drill`)}
                onMouseMove={ev => showTip(ev, `<b>${ymLbl(k)}</b> net ${fMoney(e.sales - e.spend)}`)} onMouseLeave={hideTip}>
                <rect x={ML + i * band} y={MT} width={band} height={plotH} fill="transparent" />
                <rect x={cx - barW - 0.5} y={y(e.sales)} width={barW} height={Math.max(y(0) - y(e.sales), e.sales > 0 ? 1 : 0)} rx={2} fill={BLUE} />
                <rect x={cx + 0.5} y={y(e.spend)} width={barW} height={Math.max(y(0) - y(e.spend), e.spend > 0 ? 1 : 0)} rx={2} fill={AMBER} />
                {(i % step === 0 || i === n - 1) && <text x={cx} y={H - 12} textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 700, fill: "var(--mut)" }}>{ymLbl(k)}</text>}
              </g>
            );
          })}
          <path d={line} fill="none" stroke="#1BAF7A" strokeWidth={2} strokeDasharray="5 3" />
          {data.map(([k], i) => <circle key={k} cx={ML + i * band + band / 2} cy={y(net[i])} r={2.8} fill={net[i] >= 0 ? GREEN : RED} pointerEvents="none" />)}
        </svg>
      )}
    </div>
  );
}

/* ---------------- drill drawer ---------------- */
function PnlDrawer({ seed, scope, gst, onClose, onAdd, onPop }: {
  seed: Drill | null; scope: Bucket[]; gst: boolean; onClose: () => void; onAdd: (d: Drill) => void; onPop: (k: keyof Drill) => void;
}) {
  const [wbsOpen, setWbsOpen] = useState<string | null>(null);
  useEffect(() => setWbsOpen(null), [seed]);
  const bs = seed?.proj ? LINKED.filter(b => b.key === seed.proj) : scope;
  const head = seed?.head, ym = seed?.ym;
  const m = useMemo(() => measure(bs), [bs]);
  const p = pnl(m, gst);
  const cost = bs.flatMap(b => b.cost).filter(c => !head || c.head === head);
  const po = bs.flatMap(b => b.po).filter(l => (!head || l.head === head) && (!ym || (l.day >= 0 && ymKey(l.day) === ym)));
  const bookings = bs.flatMap(b => b.bookings).filter(b => !ym || b.ym === ym);
  const byKey = <T,>(rows: T[], k: (r: T) => string, v: (r: T) => number) => {
    const mm = new Map<string, number>(); rows.forEach(r => mm.set(k(r), (mm.get(k(r)) ?? 0) + v(r)));
    return [...mm.entries()].map(([kk, vv]) => ({ k: kk, label: kk, v: vv })).filter(x => Math.abs(x.v) >= 1).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  };
  const towers = (() => {
    const t = new Map<string, { n: number; tsv: number; rec: number; due: number }>();
    bookings.forEach(b => { const e = t.get(b.tower) ?? { n: 0, tsv: 0, rec: 0, due: 0 }; e.n++; e.tsv += b.tsv; e.rec += gst ? b.recIn : b.recEx; e.due += b.due; t.set(b.tower, e); });
    return [...t.entries()].sort((a, b) => b[1].tsv - a[1].tsv);
  })();
  const wbs = [...cost].sort((a, b) => Math.abs(b.actual) - Math.abs(a.actual)).slice(0, 60);
  const title = seed?.proj ? PROJECTS.find(x => x.key === seed.proj)!.name : bs.length === LINKED.length ? "All projects" : `${bs.length} projects`;
  const chips: [keyof Drill, string][] = [];
  if (seed?.proj) chips.push(["proj", `Project: ${title}`]);
  if (head) chips.push(["head", `Expense head: ${head}`]);
  if (ym) chips.push(["ym", `Month: ${ymLbl(ym)}`]);
  const Tile = ({ l, v, c, s }: { l: string; v: string; c: string; s?: string }) => (
    <div style={{ background: "#fff", border: "1px solid #eae6da", borderLeft: `5px solid ${c}`, borderRadius: 10, padding: "9px 11px" }}>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 16, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>{v}</div>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".8px", textTransform: "uppercase", color: "var(--mut)", marginTop: 3 }}>{l}</div>
      {s && <div style={{ fontSize: 10.5, color: "#8a8474", marginTop: 1, whiteSpace: "nowrap" }}>{s}</div>}
    </div>
  );
  const th = (h: string, left?: boolean) => <th key={h} style={{ ...TH, textAlign: left ? "left" : "right" }}>{h}</th>;
  return (
    <AnimatePresence>
      {seed && (
        <>
          <motion.div key="pov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.35)", zIndex: 70 }} />
          <motion.div key="pdw" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 32 }}
            role="dialog" aria-label={`P&L drill: ${title}`}
            style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(720px, 96vw)", zIndex: 71, background: "#f6f4ef", boxShadow: "-14px 0 46px rgba(20,33,61,.35)", display: "flex", flexDirection: "column" }}>
            <div style={{ background: NAVY, padding: "14px 18px", borderBottom: "3px solid var(--gold)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", color: "#c9b27c" }}>PROFIT VS LOSS DRILL · COLLECTION {gst ? "WITH" : "W/O"} GST</div>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 700, color: "#fff", marginTop: 2 }}>{head ?? (ym ? ymLbl(ym) : title)}</div>
                </div>
                <button onClick={onClose} aria-label="Close" style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 8, fontSize: 15, cursor: "pointer" }}>✕</button>
              </div>
              {chips.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {chips.map(([k, l]) => (
                    <button key={k} onClick={() => onPop(k)} title="Remove this filter"
                      style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.25)", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "4px 11px", cursor: "pointer", fontFamily: "inherit" }}>{l} ✕</button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
              {!head && !ym && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
                  <Tile l={`Collection ${gst ? "(with GST)" : "(W/O GST)"}`} v={fCr(p.collection)} c={TEAL} s={`${fN(m.units)} units sold`} />
                  <Tile l="Expenditure" v={fCr(m.actual)} c={AMBER} s={`project ${fCr(m.projActual)} + non-project ${fCr(m.npActual)}`} />
                  <Tile l="Surplus / deficit" v={fCr(p.surplus)} c={p.surplus >= 0 ? GREEN : RED} />
                  <Tile l="Approved budget" v={fCr(m.budget)} c={NAVY} s={`${fPct(p.spendPct)} spent`} />
                  <Tile l="Open commitment" v={fCr(m.commit)} c={GOLD} s="ordered, not yet booked" />
                  <Tile l="Est. margin on sales" v={fPct(p.marginPct)} c={p.margin >= 0 ? GREEN : RED} s={fCr(p.margin)} />
                </div>
              )}
              {head && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
                  <Tile l="Budget" v={fCr(sumOf(cost, "budget"))} c={NAVY} s={`${fN(cost.length)} WBS`} />
                  <Tile l="Actual" v={fCr(sumOf(cost, "actual"))} c={AMBER} />
                  <Tile l="Commitment" v={fCr(sumOf(cost, "commit"))} c={GOLD} />
                </div>
              )}
              {ym && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
                  <Tile l="Sales booked" v={fCr(sumOf(bookings, "tsv"))} c={BLUE} s={`${fN(bookings.length)} bookings`} />
                  <Tile l="Delivered on POs" v={fCr(sumOf(po, "delivered"))} c={AMBER} s={`${fN(po.length)} PO lines dated this month`} />
                  <Tile l="Collected so far" v={fCr(bookings.reduce((s, b) => s + (gst ? b.recIn : b.recEx), 0))} c={TEAL} s="on these bookings, to date" />
                </div>
              )}

              {!head && towers.length > 0 && (
                <div style={CARD}>
                  <h3 style={H3}>Revenue by tower</h3>
                  <div style={CAP}>active bookings{ym ? ` made in ${ymLbl(ym)}` : ""}</div>
                  <div style={{ maxHeight: 260, overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead><tr>{th("Tower", true)}{th("Units")}{th("Sales value")}{th("Collected")}{th("Due")}</tr></thead>
                      <tbody>{towers.map(([t, e]) => (
                        <tr key={t}><td style={{ ...TD, textAlign: "left", fontWeight: 700 }}>{t}</td><td style={TD}>{fN(e.n)}</td><td style={TD}>{fMoney(e.tsv)}</td><td style={{ ...TD, color: TEAL }}>{fMoney(e.rec)}</td><td style={{ ...TD, color: e.due > 0 ? RED : "var(--mut)" }}>{fMoney(e.due)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {!head && !ym && (
                <div style={CARD}><h3 style={H3}>Cost by expense head</h3><div style={CAP}>project actual · click → drill into the head</div>
                  <div style={{ maxHeight: 280, overflowY: "auto", paddingRight: 4 }}><Bars items={byKey(cost, c => c.head, c => c.actual).slice(0, 25)} onPick={k => onAdd({ head: k })} color={AMBER} /></div></div>
              )}
              {!ym && (
                <div style={CARD}><h3 style={H3}>Cost by segment</h3><div style={CAP}>project actual{head ? ` · ${head}` : ""}</div>
                  <Bars items={byKey(cost, c => c.segment, c => c.actual).slice(0, 12)} color={NAVY} /></div>
              )}
              {!ym && wbs.length > 0 && (
                <div style={CARD}>
                  <h3 style={H3}>WBS elements</h3>
                  <div style={CAP}>top {wbs.length} of {fN(cost.length)} by actual · click a row for its PO lines{bs.some(b => b.key === "onedxp2") ? ` · One DXP PH4 common work carried at ${PH4_SHARE_PCT.toFixed(1)}%` : ""}</div>
                  <div style={{ maxHeight: 340, overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 600 }}>
                      <thead><tr>{th("WBS", true)}{th("Head", true)}{th("Budget")}{th("Actual")}{th("Commit")}{th("% spent")}</tr></thead>
                      <tbody>{wbs.map((c, i) => (
                        <React.Fragment key={c.wbs + i}>
                          <tr onClick={() => setWbsOpen(o => (o === c.wbs ? null : c.wbs))} style={{ cursor: "pointer", background: wbsOpen === c.wbs ? "#faf8f2" : undefined }}>
                            <td style={{ ...TD, textAlign: "left", fontWeight: 700 }} title={c.desc}>{c.wbs}{c.share < 1 ? <span style={{ color: GOLD, fontWeight: 600 }}> ({(c.share * 100).toFixed(0)}%)</span> : null}</td>
                            <td style={{ ...TD, textAlign: "left", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{c.head}</td>
                            <td style={TD}>{fMoney(c.budget)}</td><td style={{ ...TD, fontWeight: 700 }}>{fMoney(c.actual)}</td>
                            <td style={{ ...TD, color: AMBER }}>{fMoney(c.commit)}</td>
                            <td style={{ ...TD, color: c.budget > 0 && c.actual + c.commit > c.budget ? RED : "var(--mut)" }}>{c.budget > 0 ? fPct(((c.actual + c.commit) / c.budget) * 100, 0) : "—"}</td>
                          </tr>
                          {wbsOpen === c.wbs && (
                            <tr><td colSpan={6} style={{ padding: "4px 10px 10px", background: "#faf8f2" }}>
                              {(() => {
                                const lines = bs.flatMap(b => b.po).filter(l => l.wbs === c.wbs).sort((a, b) => b.ordered - a.ordered).slice(0, 30);
                                return lines.length ? (
                                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                    <thead><tr>{th("PO", true)}{th("Vendor", true)}{th("Date", true)}{th("Ordered")}{th("Delivered")}</tr></thead>
                                    <tbody>{lines.map((l, j) => (
                                      <tr key={j}><td style={{ ...TD, textAlign: "left" }}>{l.po}</td><td style={{ ...TD, textAlign: "left", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }}>{l.vendor}</td>
                                        <td style={{ ...TD, textAlign: "left", color: "var(--mut)" }}>{l.day >= 0 ? dLbl(l.day) : "—"}</td><td style={TD}>{fMoney(l.ordered)}</td><td style={{ ...TD, color: TEAL }}>{fMoney(l.delivered)}</td></tr>
                                    ))}</tbody>
                                  </table>
                                ) : <div style={{ fontSize: 12, color: "var(--mut)", padding: 6 }}>No PO lines on this WBS — its actual is non-PO postings.</div>;
                              })()}
                            </td></tr>
                          )}
                        </React.Fragment>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {po.length > 0 && (
                <div style={CARD}><h3 style={H3}>Top vendors</h3><div style={CAP}>delivered value on POs{head ? ` · ${head}` : ""}{ym ? ` · POs dated ${ymLbl(ym)}` : ""}</div>
                  <Bars items={byKey(po, l => l.vendor, l => l.delivered).slice(0, 12)} color={TEAL} /></div>
              )}
              {!head && bookings.length > 0 && (
                <div style={CARD}>
                  <h3 style={H3}>Bookings</h3>
                  <div style={CAP}>top {Math.min(bookings.length, 100)} of {fN(bookings.length)} by sales value</div>
                  <div style={{ maxHeight: 320, overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 600 }}>
                      <thead><tr>{th("Unit", true)}{th("Customer", true)}{th("Booked", true)}{th("Sales value")}{th("Collected")}{th("Due")}</tr></thead>
                      <tbody>{[...bookings].sort((a, b) => b.tsv - a.tsv).slice(0, 100).map((b, i) => (
                        <tr key={i}><td style={{ ...TD, textAlign: "left", fontWeight: 700 }}>{b.unit}</td><td style={{ ...TD, textAlign: "left", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{b.customer}</td>
                          <td style={{ ...TD, textAlign: "left", color: "var(--mut)" }}>{b.ym ? ymLbl(b.ym) : "—"}</td><td style={TD}>{fMoney(b.tsv)}</td>
                          <td style={{ ...TD, color: TEAL }}>{fMoney(gst ? b.recIn : b.recEx)}</td><td style={{ ...TD, color: b.due > 0 ? RED : "var(--mut)" }}>{fMoney(b.due)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
const dLbl = (d: number) => new Date(Date.UTC(2022, 0, 1) + d * 86400000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" });
const ymKey = (d: number) => { const t = new Date(Date.UTC(2022, 0, 1) + d * 86400000); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`; };

/* ---------------- page ---------------- */
type Range = "12" | "24" | "all";
export function ProfitLossPage() {
  const [sel, setSel] = useState<ProjKey[]>([]);
  const [gst, setGst] = useState(false);
  const [range, setRange] = useState<Range>("24");
  const [drill, setDrill] = useState<Drill | null>(null);
  const [showLogic, setShowLogic] = useState(false);
  const scope = useMemo(() => (sel.length ? LINKED.filter(b => sel.includes(b.key as ProjKey)) : LINKED), [sel]);
  const m = useMemo(() => measure(scope), [scope]);
  const p = pnl(m, gst);
  const open = (d: Drill) => setDrill(d);

  const heads = useMemo(() => {
    const mm = new Map<string, number>();
    scope.flatMap(b => b.cost).forEach(c => mm.set(c.head, (mm.get(c.head) ?? 0) + c.actual));
    const arr = [...mm.entries()].sort((a, b) => b[1] - a[1]);
    const top = arr.slice(0, 6).map(([k, v]) => ({ k, v }));
    const rest = arr.slice(6).reduce((s, [, v]) => s + v, 0);
    return Math.abs(rest) >= 1 ? [...top, { k: "Other", v: rest }] : top;
  }, [scope]);
  const npDepts = useMemo(() => {
    const mm = new Map<string, number>();
    scope.flatMap(b => b.np).forEach(n => mm.set(n.dept, (mm.get(n.dept) ?? 0) + n.actual));
    return [...mm.entries()].map(([k, v]) => ({ k, label: k, v })).filter(x => Math.abs(x.v) >= 1).sort((a, b) => b.v - a.v);
  }, [scope]);
  const series = useMemo(() => {
    const all = monthly(scope);
    if (range === "all") return all;
    const now = new Date(), n = Number(range);
    const from = new Date(Date.UTC(now.getFullYear(), now.getMonth() - n + 1, 1));
    const fk = `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, "0")}`;
    return all.filter(([k]) => k >= fk);
  }, [scope, range]);
  const rows = useMemo(() => LINKED.map(b => ({ b, m: measure([b]) })).map(r => ({ ...r, p: pnl(r.m, gst) })), [gst]);
  const unl = useMemo(() => UNLINKED.map(b => ({ b, m: measure([b]) })).filter(r => Math.abs(r.m.actual) + Math.abs(r.m.budget) >= 1), []);
  const unlTotal = unl.reduce((s, r) => s + r.m.actual, 0);

  const glass: [string, string, string, [string, string], () => void][] = [
    [`Collection ${gst ? "(with GST)" : "(W/O GST)"}`, fCr(p.collection), "received from customers, net of uncleared cheques", ["#1a7f9c", "#0e5468"], () => open({})],
    ["Total expenditure (actual)", fCr(m.actual), `project ${fCr(m.projActual)} + non-project ${fCr(m.npActual)}`, ["#c99a3a", "#96691c"], () => open({})],
    [p.surplus >= 0 ? "Surplus" : "Deficit", `${p.surplus >= 0 ? "▲" : "▼"} ${fCr(Math.abs(p.surplus))}`, "collection − expenditure", p.surplus >= 0 ? ["#1e9a6c", "#0f6647"] : ["#c0392b", "#7e1f14"], () => open({})],
    ["Est. margin on sales", fPct(p.marginPct), `${fCr(p.margin)} on ${fCr(m.tsv)} sold`, ["#1c3f6e", "#0f2547"], () => open({})],
    ["Cost to complete", fCr(p.costToComplete), `budget ${fCr(m.budget)} − project actual`, ["#6b4fa0", "#3f2a73"], () => open({})],
  ];
  const KPI = ({ k, v, s, col, onClick }: { k: string; v: string; s: string; col: string; onClick?: () => void }) => (
    <div onClick={onClick} onMouseEnter={e => showTip(e, `<b>${k}</b><br/>${v} · ${s}`)} onMouseMove={e => showTip(e, `<b>${k}</b> ${v}`)} onMouseLeave={hideTip}
      style={{ background: "#fff", border: "1px solid #eae6da", borderLeft: `6px solid ${col}`, borderRadius: 12, boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)", padding: "12px 14px", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 700, color: "var(--ink)", lineHeight: 1, whiteSpace: "nowrap" }}>{v}</div>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "1.1px", textTransform: "uppercase", color: "var(--mut)", marginTop: 5 }}>{k}</div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8a8474", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s}</div>
    </div>
  );
  // "project at a glance" — money metrics on one scale, counts on their own
  const glance: { l: string; v: number; disp: string; c: string; money: boolean }[] = [
    { l: "Units sold", v: m.units, disp: fN(m.units), c: "#0E7490", money: false },
    { l: "Area sold", v: m.area, disp: `${(m.area / 1e5).toFixed(2)} L sq ft`, c: "#7b5cb8", money: false },
    { l: "Revenue recognised", v: m.demandEx, disp: fCr(m.demandEx), c: "#1BAF7A", money: true },
    { l: "Collection (with GST)", v: m.recIn, disp: fCr(m.recIn), c: "#1a7f9c", money: true },
    { l: "Collection (W/O GST)", v: m.recEx, disp: fCr(m.recEx), c: "#22a7c9", money: true },
    { l: "Expenditure", v: m.actual, disp: fCr(m.actual), c: "#e34948", money: true },
    { l: "Outstanding dues", v: m.due, disp: fCr(m.due), c: "#EDA100", money: true },
    { l: p.surplus >= 0 ? "Surplus" : "Deficit", v: Math.abs(p.surplus), disp: fCr(p.surplus), c: p.surplus >= 0 ? "#0f8a5f" : RED, money: true },
  ];
  const gMax = Math.max(...glance.filter(g => g.money).map(g => g.v), 1);

  const progress = rows.filter(r => !sel.length || sel.includes(r.b.key as ProjKey));
  const subLine = <>{fN(m.units)} active bookings · {sel.length ? `${sel.length} of ${PROJECTS.length}` : PROJECTS.length} projects · cost as on {AS_ON.cost} · non-project as on {AS_ON.nonProject}</>;

  return (
    <div className="sw-inv" style={{ minHeight: "100vh" }}>
      <div className="tv-zoom-desktop">
        <PageBanner title="Profit vs Loss" sub={subLine}>
          <ProjectPicker sel={sel} onChange={setSel} />
          <div>
            <div style={BANNER_LBL}>Collection basis</div>
            <div className="pb-pills">
              {([[false, "W/O GST"], [true, "With GST"]] as const).map(([k, l]) => (
                <button key={l} className={`pb-pill${gst === k ? " on" : ""}`} onClick={() => setGst(k)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={BANNER_LBL}>Trend range</div>
            <div className="pb-pills">
              {([["12", "12 months"], ["24", "24 months"], ["all", "All"]] as const).map(([k, l]) => (
                <button key={k} className={`pb-pill${range === k ? " on" : ""}`} onClick={() => setRange(k)}>{l}</button>
              ))}
            </div>
          </div>
          <button onClick={() => { setSel([]); setGst(false); setRange("24"); }} className="pb-btn">⟲ Reset</button>
        </PageBanner>

        <div style={{ padding: "16px 20px 40px" }}>
          {/* headline P&L */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 14 }}>
            {glass.map(([k, v, s, [c1, c2], go]) => (
              <div key={k} className="g3d" style={GLASS(c1, c2)} onClick={go}
                onMouseEnter={e => showTip(e, `<b>${k}</b><br/>${v} · ${s}<br/>click → drill`)} onMouseMove={e => showTip(e, `<b>${k}</b> ${v}`)} onMouseLeave={hideTip}>
                <div style={{ position: "absolute", top: -30, right: -30, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,.10)" }} />
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.4px", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>{k}</div>
                <div style={{ fontFamily: "Georgia,serif", fontSize: 26, fontWeight: 700, lineHeight: 1.1, marginTop: 6, textShadow: "0 2px 4px rgba(0,0,0,.25)", whiteSpace: "nowrap" }}>{v}</div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,.8)", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s}</div>
              </div>
            ))}
          </div>

          {/* team KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 400px), 1fr))", gap: 12, marginBottom: 14 }}>
            <KPI k="Sales value booked" v={fCr(m.tsv)} s={`${fN(m.units)} units · ${(m.area / 1e5).toFixed(2)} L sq ft`} col={BLUE} onClick={() => open({})} />
            <KPI k="Revenue recognised" v={fCr(m.demandEx)} s={`demand raised excl GST · ${fPct(p.billedPct)} of TCV billed`} col={GREEN} />
            <KPI k="Collection efficiency" v={fPct(p.collectionEff)} s="collected ÷ demanded (with GST)" col={TEAL} />
            <KPI k="Outstanding dues" v={fCr(m.due)} s="demanded, not yet received" col={RED} />
            <KPI k="Future receivables" v={fCr(m.future)} s="TCV not yet demanded" col={GOLD} />
            <KPI k="Funding cover" v={isFinite(p.fundingCover) ? `${p.fundingCover.toFixed(2)}×` : "—"} s="receivables ÷ cost to complete" col={p.fundingCover >= 1 ? GREEN : RED} />
            <KPI k="Open commitment" v={fCr(m.commit)} s="POs ordered, not yet booked" col={AMBER} />
            <KPI k="Unsold stock" v={`${fN(m.unsoldUnits)} units`} s={`${(m.unsoldArea / 1e5).toFixed(2)} L sq ft · ≈${fCr(m.unsoldValue)} at avg booked rate`} col="#7b5cb8" />
            <KPI k="Rate vs cost per sq ft" v={`₹${fN(p.ratePerSqft)} / ₹${fN(p.costPerSqft)}`} s="avg selling rate vs budgeted cost" col={NAVY} />
          </div>

          {/* cost composition */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 14, marginBottom: 14 }}>
            <Zoomable title="Cost of construction" collapsible>
              <div className="g3d" style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                <h3 style={H3}>Cost of Construction — Project Expenditure</h3>
                <div style={CAP}>project actual by expense head · click a head → drill</div>
                <HeadDonut heads={heads} total={m.projActual} onPick={k => open({ head: k })} />
              </div>
            </Zoomable>
            <Zoomable title="Non-project expenditure" collapsible>
              <div className="g3d" style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                <h3 style={H3}>Non-Project Expenditure</h3>
                <div style={CAP}>FY 26-27 site and sales overheads booked on these projects' plants, by department</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--mut)" }}>Total</span>
                  <span style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>{fCr(m.npActual)}</span>
                </div>
                <div style={{ maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                  {npDepts.length ? <Bars items={npDepts} color="#7b5cb8" /> : <div style={{ fontSize: 12.5, color: "var(--mut)" }}>No non-project cost on these projects' plants.</div>}
                </div>
              </div>
            </Zoomable>
          </div>

          {/* trend */}
          <Zoomable title="Sales booked vs spend" collapsible>
            <div style={CARD}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", paddingRight: 64 }}>
                <div>
                  <h3 style={H3}>Sales Booked vs Spend vs Net</h3>
                  <div style={{ ...CAP, marginBottom: 6 }}>monthly · sales by booking month · spend = delivered PO value by PO month + non-project actuals by posting month · click a month → drill</div>
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 11.5, fontWeight: 700, color: "var(--mut)" }}>
                  <span><span style={{ color: BLUE }}>■</span> Sales booked</span><span><span style={{ color: AMBER }}>■</span> Spend</span><span><span style={{ color: GREEN }}>╌</span> Net</span>
                </div>
              </div>
              <TrendChart data={series} onMonth={k => open({ ym: k })} />
            </div>
          </Zoomable>

          {/* at a glance */}
          <Zoomable title="Project at a glance" collapsible>
            <div style={CARD}>
              <h3 style={H3}>{sel.length === 1 ? `${PROJECTS.find(x => x.key === sel[0])!.name} at a Glance` : "Projects at a Glance"}</h3>
              <div style={CAP}>money columns share one scale; units and area are shown for reference</div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${glance.length}, minmax(0, 1fr))`, gap: 10, alignItems: "end", height: 200, padding: "0 4px" }}>
                {glance.map(g => {
                  const h = g.money ? Math.max((g.v / gMax) * 150, 3) : 40;
                  return (
                    <div key={g.l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                      onMouseEnter={e => showTip(e, `<b>${g.l}</b><br/>${g.disp}`)} onMouseLeave={hideTip}>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: g.c, whiteSpace: "nowrap" }}>{g.disp}</div>
                      <motion.div initial={{ height: 0 }} animate={{ height: h }} transition={{ type: "spring", stiffness: 160, damping: 22 }}
                        style={{ width: "100%", background: g.money ? g.c : `repeating-linear-gradient(135deg, ${g.c}, ${g.c} 6px, ${g.c}cc 6px, ${g.c}cc 12px)`, borderRadius: "6px 6px 0 0" }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${glance.length}, minmax(0, 1fr))`, gap: 10, padding: "6px 4px 0", borderTop: "1px solid #eae6da" }}>
                {glance.map(g => <div key={g.l} style={{ fontSize: 11, fontWeight: 700, color: "var(--mut)", textAlign: "center" }}>{g.l}</div>)}
              </div>
            </div>
          </Zoomable>

          {/* progress: sold vs billed vs spent */}
          <Zoomable title="Sold, billed and spent" collapsible>
            <div style={CARD}>
              <h3 style={H3}>Sold vs Billed vs Spent</h3>
              <div style={CAP}>units sold of total · TCV demanded · budget spent — billing far behind spend means construction is being funded ahead of collections</div>
              {progress.map(({ b, p: pp }) => (
                <div key={b.key} onClick={() => open({ proj: b.key as ProjKey })} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, alignItems: "center", padding: "6px 0", cursor: "pointer", borderBottom: "1px solid #f4f1ea" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{b.name}</div>
                  <div style={{ display: "grid", gap: 3 }}>
                    {([["Sold", pp.soldPct, BLUE], ["Billed", pp.billedPct, GREEN], ["Spent", pp.spendPct, AMBER]] as const).map(([l, v, c]) => (
                      <div key={l} style={{ display: "grid", gridTemplateColumns: "48px 1fr 48px", gap: 8, alignItems: "center", fontSize: 11 }}>
                        <span style={{ color: "var(--mut)", fontWeight: 700 }}>{l}</span>
                        <div style={{ height: 7, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${Math.min(v, 100)}%`, height: "100%", background: c, borderRadius: 4 }} /></div>
                        <span style={{ textAlign: "right", fontWeight: 700, color: "var(--ink)" }}>{fPct(v, 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Zoomable>

          {/* project-wise P&L */}
          <Zoomable title="Project-wise P&L" collapsible>
            <div style={CARD}>
              <h3 style={H3}>Project-wise Profit &amp; Loss</h3>
              <div style={CAP}>click a project → drill · collection {gst ? "with" : "W/O"} GST</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 1150 }}>
                  <thead><tr>
                    <th style={{ ...TH, textAlign: "left" }}>Project</th>
                    {["Units", "Sales value", "Collection", "Due", "Budget", "Expenditure", "Commitment", "Surplus / deficit", "Margin on sales", "Funding cover"].map(h => <th key={h} style={TH}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {rows.filter(r => !sel.length || sel.includes(r.b.key as ProjKey)).map(({ b, m: mm, p: pp }) => (
                      <tr key={b.key} onClick={() => open({ proj: b.key as ProjKey })} style={{ cursor: "pointer" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                        <td style={{ ...TD, textAlign: "left", fontWeight: 700, color: "var(--ink)" }}>{b.name}</td>
                        <td style={TD}>{fN(mm.units)}</td><td style={TD}>{fCr(mm.tsv)}</td>
                        <td style={{ ...TD, color: TEAL, fontWeight: 700 }}>{fCr(pp.collection)}</td>
                        <td style={{ ...TD, color: mm.due > 0 ? RED : "var(--mut)" }}>{fCr(mm.due)}</td>
                        <td style={TD}>{fCr(mm.budget)}</td><td style={{ ...TD, fontWeight: 700 }}>{fCr(mm.actual)}</td>
                        <td style={{ ...TD, color: AMBER }}>{fCr(mm.commit)}</td>
                        <td style={{ ...TD, fontWeight: 800, color: pp.surplus >= 0 ? GREEN : RED }}>{fCr(pp.surplus)}</td>
                        <td style={TD}><span style={{ background: `${pp.marginPct >= 25 ? GREEN : pp.marginPct >= 10 ? AMBER : RED}22`, color: pp.marginPct >= 25 ? "#0f6e56" : pp.marginPct >= 10 ? "#8a5a00" : RED, fontWeight: 800, fontSize: 11.5, borderRadius: 6, padding: "3px 8px" }}>{fPct(pp.marginPct)}</span></td>
                        <td style={{ ...TD, color: pp.fundingCover >= 1 ? GREEN : RED, fontWeight: 700 }}>{isFinite(pp.fundingCover) ? `${pp.fundingCover.toFixed(2)}×` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{ background: "#faf9f6" }}>
                    <td style={{ ...TD, textAlign: "left", fontWeight: 800, borderTop: "2px solid #eae6da" }}>Total</td>
                    {[fN(m.units), fCr(m.tsv), fCr(p.collection), fCr(m.due), fCr(m.budget), fCr(m.actual), fCr(m.commit), fCr(p.surplus), fPct(p.marginPct), isFinite(p.fundingCover) ? `${p.fundingCover.toFixed(2)}×` : "—"].map((v, i) => (
                      <td key={i} style={{ ...TD, fontWeight: 800, borderTop: "2px solid #eae6da", color: i === 7 ? (p.surplus >= 0 ? GREEN : RED) : "var(--ink)" }}>{v}</td>
                    ))}
                  </tr></tfoot>
                </table>
              </div>
            </div>
          </Zoomable>

          {/* not linked */}
          <Zoomable title="Cost not linked to a sales project" collapsible>
            <div style={CARD}>
              <h3 style={H3}>Cost Not Linked to a Sales Project</h3>
              <div style={CAP}>{fCr(unlTotal)} of actual cost on phases, sites and offices with no bookings in the sales export — kept out of project surplus so every rupee is still accounted for</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
                  <thead><tr><th style={{ ...TH, textAlign: "left" }}>Cost centre</th>{["Budget", "Project actual", "Non-project actual", "Commitment"].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                  <tbody>{unl.map(({ b, m: mm }) => (
                    <tr key={b.key}><td style={{ ...TD, textAlign: "left", fontWeight: 700 }}>{b.name}</td><td style={TD}>{fCr(mm.budget)}</td><td style={{ ...TD, fontWeight: 700 }}>{fCr(mm.projActual)}</td><td style={TD}>{fCr(mm.npActual)}</td><td style={{ ...TD, color: AMBER }}>{fCr(mm.commit)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </Zoomable>

          {/* method */}
          <div style={{ ...CARD, marginTop: 4 }}>
            <button onClick={() => setShowLogic(v => !v)} aria-expanded={showLogic}
              style={{ background: "none", border: "none", fontFamily: "Georgia,serif", fontSize: 14.5, fontWeight: 700, color: "var(--ink)", cursor: "pointer", padding: 0 }}>
              {showLogic ? "▾" : "▸"} How these numbers are calculated
            </button>
            {showLogic && (
              <div style={{ fontSize: 12.5, color: "#3d4a63", lineHeight: 1.7, marginTop: 8 }}>
                <b>Collection (with GST)</b> = net received including tax − pending for clearance, the same as the SAP Collection tab. <b>W/O GST</b> takes the GST share out per booking (demand excl GST ÷ demand with GST).
                <b> Revenue recognised</b> = demand raised excluding GST. <b>Expenditure</b> = project actual from the ZALR project export (with GST) + non-project actual (FY 26-27) booked on the project's plant.
                <b> Surplus / deficit</b> = collection − expenditure. <b>Est. margin on sales</b> = sales value booked − approved budget × sold area ÷ saleable area.
                <b> Cost to complete</b> = approved budget − project actual. <b>Funding cover</b> = (outstanding dues + future receivables) ÷ cost to complete.
                <br /><b>Project mapping:</b> The Edition = RE/0066 · Sky Arc = RE/0069 residential on the Sky Arc plant · Trump Residences = RE/0069 Trump Tower · Nature's Court L = RE/M011 residential ·
                One DXP Street = RE/0113 PH2 · One DXP Phase-2 = RE/0113 PH4 towers O and P plus {PH4_SHARE_PCT.toFixed(1)}% of PH4 common work (their share of PH4 tower budgets) ·
                Le Courtyard = RE/0098 commercial · Suites = RE/0098 service apartments. Everything else is listed under "not linked".
                <br /><b>Monthly chart:</b> the sales export has no receipt dates and the project export no posting dates, so the trend uses sales value by booking month and spend as delivered PO value by PO month plus non-project actuals by posting month.
                <br /><b>Reconciliation:</b> project actual {fCr(TIE_OUT.projActualMapped)} of {fCr(TIE_OUT.projActualFile)} and non-project actual {fCr(TIE_OUT.npActualMapped)} of {fCr(TIE_OUT.npActualFile)} placed — every rupee in exactly one row. Sales file: {AS_ON.sales || "PDRN export"}.
              </div>
            )}
          </div>
        </div>

        <PnlDrawer seed={drill} scope={scope} gst={gst} onClose={() => setDrill(null)}
          onAdd={d => setDrill(cur => ({ ...(cur ?? {}), ...d }))}
          onPop={k => setDrill(cur => { if (!cur) return cur; const n = { ...cur }; delete n[k]; return n; })} />
      </div>
    </div>
  );
}
