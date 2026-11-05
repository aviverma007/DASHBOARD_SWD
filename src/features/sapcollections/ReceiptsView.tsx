import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Zoomable } from "../../components/common/Zoomable";
import { showTip, hideTip } from "../../components/common/hoverTip";
import {
  RC, RECEIPTS, KIND, ANCHOR, periods, inP, agg, sumBy, workDays, fCr, fMoney, fN, fDay, fDayS, ymOf, ymLbl, dow, dayOf, pctChg,
  POOL_NAME, holdings, pdrnReceived, PDRN_AS_ON, reconcile, type Rc, type Period, type Agg,
} from "./rcData";

/* ---------------- house styles ---------------- */
const crN = (v: number) => `${v < 0 ? "−" : ""}${(Math.abs(v) / 1e7).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const NAVY = "#1c3f6e", TEAL = "#0E7490", GREEN = "#1BAF7A", RED = "#c0392b", GOLD = "#B8893C", AMBER = "#EDA100", PURPLE = "#6b4fa0";
const CAT = ["#0E7490", "#7b5cb8", "#1BAF7A", "#EDA100", "#e34948", "#2a78d6", "#8a94a6", "#c27c0e"];
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #eae6da", borderRadius: 12, boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)", padding: "14px 16px", marginBottom: 14 };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 15.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 2px" };
const CAP: React.CSSProperties = { fontSize: 11, color: "var(--mut)", marginBottom: 10 };
const TH: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "8px 10px", borderBottom: "2px solid #eae6da", whiteSpace: "nowrap", textAlign: "left", position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 };
const TD: React.CSSProperties = { padding: "6px 10px", borderBottom: "1px solid #f0ede5", whiteSpace: "nowrap" };
const RT: React.CSSProperties = { textAlign: "right" };
const GLASS = (c1: string, c2: string): React.CSSProperties => ({
  background: `linear-gradient(150deg, ${c1} 0%, ${c2} 100%)`, border: "1px solid rgba(255,255,255,.35)", borderRadius: 14,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), 0 10px 24px rgba(20,33,61,.28), 0 2px 6px rgba(20,33,61,.18)",
  color: "#fff", position: "relative", overflow: "hidden",
});
const hoverRow = {
  onMouseEnter: (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; },
  onMouseLeave: (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = ""; },
};
const KIND_COL = ["#1BAF7A", "#2a78d6", "#c0392b", "#EDA100", "#7b5cb8", "#8a94a6"];

function Delta({ cur, prev, label, light }: { cur: number; prev: number; label?: string; light?: boolean }) {
  const c = pctChg(cur, prev);
  if (!isFinite(c) && cur <= 0) return null;
  const up = c >= 0, txt = isFinite(c) ? `${up ? "▲" : "▼"} ${Math.abs(c).toFixed(0)}%` : "▲ new";
  return (
    <span title={`${label ?? "previous"}: ${fMoney(prev)}`} style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: "1px 7px", whiteSpace: "nowrap",
      background: light ? "rgba(255,255,255,.18)" : up ? "#e2f3ec" : "#fde3e3", color: light ? (up ? "#b6f5d6" : "#ffc4bc") : up ? "#0f6e56" : RED }}>
      {txt}{label ? <span style={{ fontWeight: 600, opacity: 0.85 }}> {label}</span> : null}
    </span>
  );
}

/* ---------------- drill drawer ---------------- */
interface Drill { title: string; sub?: string; rows: Rc[] }
function RcDrawer({ d, onClose }: { d: Drill | null; onClose: () => void }) {
  const [sort, setSort] = useState<"date" | "amt">("date");
  const [kindF, setKindF] = useState<number | null>(null);
  useEffect(() => { setKindF(null); setSort("date"); }, [d]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const rows = d?.rows ?? [];
  const a = agg(rows);
  const list = useMemo(() => {
    const x = kindF === null ? rows : rows.filter(r => r.kind === kindF);
    return [...x].sort(sort === "date" ? (p, q) => q.day - p.day || q.amt - p.amt : (p, q) => q.amt - p.amt);
  }, [rows, kindF, sort]);
  const cash = rows.filter(r => r.kind === KIND.CASH);
  const Tile = ({ l, v, c, s, k }: { l: string; v: string; c: string; s?: string; k?: number }) => (
    <div onClick={() => k !== undefined && setKindF(f => (f === k ? null : k))}
      style={{ background: kindF === k && k !== undefined ? "#fdf6e8" : "#fff", border: `1px solid ${kindF === k && k !== undefined ? GOLD : "#eae6da"}`, borderLeft: `5px solid ${c}`, borderRadius: 10, padding: "8px 11px", cursor: k !== undefined ? "pointer" : "default" }}>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 16, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>{v}</div>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".8px", textTransform: "uppercase", color: "var(--mut)", marginTop: 3 }}>{l}</div>
      {s && <div style={{ fontSize: 10.5, color: "#8a8474", marginTop: 1, whiteSpace: "nowrap" }}>{s}</div>}
    </div>
  );
  return (
    <AnimatePresence>
      {d && (
        <>
          <motion.div key="rov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.35)", zIndex: 220 }} />
          <motion.div key="rdw" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 32 }}
            role="dialog" aria-label={d.title}
            style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(820px, 96vw)", zIndex: 221, background: "#f6f4ef", boxShadow: "-14px 0 46px rgba(20,33,61,.35)", display: "flex", flexDirection: "column" }}>
            <div style={{ background: NAVY, padding: "14px 18px", borderBottom: "3px solid var(--gold)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", color: "#c9b27c" }}>COLLECTIONS DRILL · SAP RECEIPTS</div>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 700, color: "#fff", marginTop: 2 }}>{d.title}</div>
                  <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.75)", marginTop: 2 }}>{d.sub ?? `${fN(rows.length)} receipt entries`}</div>
                </div>
                <button onClick={onClose} aria-label="Close" style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 8, fontSize: 15, cursor: "pointer" }}>✕</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
                <Tile l="Cash collected" v={fCr(a.cash)} c={GREEN} s={`${fN(a.n)} receipts · ${fN(a.payers)} customers`} k={KIND.CASH} />
                <Tile l="Average receipt" v={fMoney(a.n ? a.cash / a.n : 0)} c={TEAL} s={`largest ${fMoney(Math.max(0, ...cash.map(r => r.amt)))}`} />
                <Tile l="TDS credit" v={fMoney(a.tds)} c="#2a78d6" s="buyer's TDS challans" k={KIND.TDS} />
                <Tile l="Bounced" v={fMoney(a.bounce)} c={RED} s={`${fN(a.nBounce)} instruments`} k={KIND.BOUNCE} />
                <Tile l="Awaiting clearance" v={fMoney(a.pending)} c={AMBER} k={KIND.PENDING} />
                <Tile l="Refunded" v={fMoney(a.refund)} c={PURPLE} k={KIND.REFUND} />
                {a.notPdrn > 0 && <Tile l="Not counted in PDRN" v={fMoney(a.notPdrn)} c="#7a7366" s="launch cheques, Nov 2023" k={KIND.NOT_PDRN} />}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={CARD}><h3 style={H3}>By project</h3><div style={CAP}>cash collected</div><MiniBars items={sumBy(cash, r => r.proj).slice(0, 8)} color={TEAL} /></div>
                <div style={CARD}><h3 style={H3}>By mode</h3><div style={CAP}>cash collected</div><MiniBars items={sumBy(cash, r => r.mode).slice(0, 8)} color={NAVY} /></div>
              </div>
              <div style={{ ...CARD, padding: "8px 8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 6px 8px", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 11.5, color: "var(--mut)" }}>{kindF === null ? "all entries" : RC.KINDS[kindF]} · {fN(list.length)} rows{list.length > 500 ? " · first 500 shown" : ""}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["date", "amt"] as const).map(s => (
                      <button key={s} onClick={() => setSort(s)} style={{ height: 26, padding: "0 12px", borderRadius: 999, border: `1px solid ${sort === s ? GOLD : "#e0dacb"}`, background: sort === s ? "#fdf6e8" : "#fff", color: sort === s ? "#96691c" : "var(--mut)", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                        {s === "date" ? "Newest first" : "Largest first"}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ maxHeight: 460, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 760 }}>
                    <thead><tr>{["Date", "Customer", "Unit", "Project", "Mode", "Bank", "Type", "Amount"].map(h => <th key={h} style={{ ...TH, ...(h === "Amount" ? RT : {}) }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {list.slice(0, 500).map((r, i) => (
                        <tr key={i} {...hoverRow}>
                          <td style={TD}>{fDay(r.day)}</td>
                          <td style={{ ...TD, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", fontWeight: 700, color: "var(--ink)" }} title={`${r.name} · ${r.code}`}>{r.name}</td>
                          <td style={{ ...TD, color: "var(--mut)" }}>{r.unit || "—"}</td>
                          <td style={TD}>{r.proj}</td>
                          <td style={TD}>{r.mode}</td>
                          <td style={{ ...TD, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", color: "var(--mut)" }}>{r.bank}</td>
                          <td style={TD}><span style={{ background: `${KIND_COL[r.kind]}1c`, color: KIND_COL[r.kind], fontWeight: 800, fontSize: 10.5, borderRadius: 999, padding: "1px 8px" }}>{RC.KINDS[r.kind]}</span></td>
                          <td style={{ ...TD, ...RT, fontWeight: 800, color: r.kind === KIND.BOUNCE ? RED : "var(--ink)", textDecoration: r.kind === KIND.BOUNCE ? "line-through" : undefined }}>{fMoney(r.amt)}</td>
                        </tr>
                      ))}
                      {!list.length && <tr><td colSpan={8} style={{ ...TD, textAlign: "center", color: "var(--mut)", padding: 18 }}>No receipts</td></tr>}
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

/** One card, many views: a sliding toggle bar (pills with a moving highlight) or a range slider,
 *  arrows / keyboard to step, click the body → drill. */
interface Slide { k: string; label?: string; c: string; body: React.ReactNode; go?: () => void }
function SlideCard({ title, cap, items, bar = "pills", id }: { title: string; cap?: string; items: Slide[]; bar?: "pills" | "range"; id: string }) {
  const [i, setI] = useState(0);
  const n = items.length, cur = items[Math.min(i, n - 1)];
  const step = (d: number) => setI(x => (x + d + n) % n);
  if (!cur) return null;
  const arrow: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, border: "1px solid #e2dccd", background: "#fff", cursor: "pointer", fontSize: 15, lineHeight: "24px", color: "var(--ink)" };
  return (
    <div style={{ ...CARD, borderLeft: `5px solid ${cur.c}`, transition: "border-color .25s" }} tabIndex={0}
      onKeyDown={e => { if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={H3}>{title}</h3>
          {cap ? <div style={{ ...CAP, marginBottom: 0 }}>{cap}</div> : null}
        </div>
        <span style={{ fontSize: 11, color: "var(--mut)", whiteSpace: "nowrap" }}>{Math.min(i, n - 1) + 1} / {n}</span>
        <button style={arrow} onClick={() => step(-1)} aria-label="previous">‹</button>
        <button style={arrow} onClick={() => step(1)} aria-label="next">›</button>
      </div>
      {bar === "pills" ? (
        <div className="rc-strip" style={{ display: "flex", gap: 2, overflowX: "auto", background: "#f3efe5", borderRadius: 999, padding: 3, marginBottom: 10 }}>
          {items.map((it, j) => (
            <button key={it.k} onClick={() => setI(j)}
              style={{ position: "relative", flex: "0 0 auto", border: "none", background: "transparent", cursor: "pointer", padding: "6px 12px", borderRadius: 999,
                fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", color: j === i ? "#fff" : "#6b6352" }}>
              {j === i ? <motion.span layoutId={`slide-${id}`} transition={{ type: "spring", stiffness: 420, damping: 34 }}
                style={{ position: "absolute", inset: 0, borderRadius: 999, background: it.c, zIndex: 0 }} /> : null}
              <span style={{ position: "relative", zIndex: 1 }}>{it.label ?? it.k}</span>
            </button>
          ))}
        </div>
      ) : (
        <input type="range" min={0} max={n - 1} step={1} value={Math.min(i, n - 1)} onChange={e => setI(+e.target.value)}
          style={{ width: "100%", accentColor: cur.c, marginBottom: 10, cursor: "pointer" }} />
      )}
      <AnimatePresence mode="wait">
        <motion.div key={cur.k} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .18 }}
          onClick={cur.go} style={{ cursor: cur.go ? "pointer" : "default", minHeight: 62 }}
          onMouseEnter={e => { if (cur.go) showTip(e, "click → the receipts behind it"); }} onMouseLeave={hideTip}>
          {cur.body}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function MiniBars({ items, color, onPick, fmt = fMoney }: { items: { k: string; v: number }[]; color: string; onPick?: (k: string) => void; fmt?: (v: number) => string }) {
  const mx = Math.max(...items.map(i => Math.abs(i.v)), 1);
  return (
    <div>
      {items.map(it => (
        <div key={it.k} className="barrow" onClick={onPick ? () => onPick(it.k) : undefined} style={{ padding: "3px 0", cursor: onPick ? "pointer" : "default" }}
          onMouseEnter={e => showTip(e, `<b>${it.k}</b><br/>${fmt(it.v)}${onPick ? "<br/>click → receipts" : ""}`)} onMouseLeave={hideTip}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 2, gap: 8 }}>
            <span style={{ fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.k}</span>
            <span style={{ fontWeight: 800, color: "var(--mut)", whiteSpace: "nowrap" }}>{fmt(it.v)}</span>
          </div>
          <div style={{ height: 8, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${(Math.abs(it.v) / mx) * 100}%`, background: color, borderRadius: 4 }} /></div>
        </div>
      ))}
    </div>
  );
}

function Donut({ items, onPick }: { items: { k: string; v: number }[]; onPick?: (k: string) => void }) {
  const pos = items.filter(i => i.v > 0), tot = pos.reduce((s, i) => s + i.v, 0);
  if (!tot) return <div style={{ fontSize: 12, color: "var(--mut)", padding: 16 }}>No collection in this period</div>;
  const R = 54, C = 2 * Math.PI * R; let off = 0;
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox="0 0 140 140" style={{ width: 140, height: 140, flexShrink: 0 }}>
        {pos.map((h, i) => { const dash = (h.v / tot) * C, o = off; off += dash;
          return <circle key={h.k} cx={70} cy={70} r={R} fill="none" stroke={CAT[i % CAT.length]} strokeWidth={24} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-o} transform="rotate(-90 70 70)"
            style={{ cursor: onPick ? "pointer" : "default" }} onClick={() => onPick?.(h.k)} onMouseEnter={e => showTip(e, `<b>${h.k}</b><br/>${fMoney(h.v)} · ${((h.v / tot) * 100).toFixed(1)}%`)} onMouseLeave={hideTip} />; })}
        <text x={70} y={67} textAnchor="middle" style={{ fontSize: 8.5, fill: "var(--mut)", letterSpacing: 1 }}>TOTAL</text>
        <text x={70} y={83} textAnchor="middle" style={{ fontFamily: "Georgia,serif", fontSize: 13, fontWeight: 700, fill: "var(--ink)" }}>{(tot / 1e7).toFixed(1)} Cr</text>
      </svg>
      <div style={{ flex: 1, minWidth: 150 }}>
        {pos.map((h, i) => (
          <div key={h.k} onClick={() => onPick?.(h.k)} style={{ display: "grid", gridTemplateColumns: "12px 1fr auto 40px", gap: 8, alignItems: "center", padding: "3px 0", fontSize: 12, cursor: onPick ? "pointer" : "default" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: CAT[i % CAT.length] }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.k}</span>
            <b>{fMoney(h.v)}</b>
            <span style={{ color: "var(--mut)", textAlign: "right", fontSize: 11 }}>{((h.v / tot) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** vertical bar chart (cash per bucket), optional average line; click → drill */
function Columns({ data, onPick, avg, height = 190 }: { data: { k: string; lbl: string; v: number; sub?: string }[]; onPick: (k: string) => void; avg?: number; height?: number }) {
  const mx = Math.max(...data.map(d => d.v), avg ?? 0, 1);
  const step = Math.max(1, Math.ceil(data.length / 16));
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 3, height, padding: "18px 2px 0", overflowX: "auto" }}>
      {avg !== undefined && avg > 0 && <div style={{ position: "absolute", left: 0, right: 0, bottom: 22 + ((avg / mx) * (height - 40)), borderTop: `1.5px dashed ${GOLD}`, pointerEvents: "none" }}>
        <span style={{ position: "absolute", right: 2, top: -15, fontSize: 9.5, fontWeight: 800, color: "#96691c", background: "#fff", padding: "0 3px" }}>avg {fMoney(avg)}</span></div>}
      {data.map((d, i) => (
        <div key={d.k} onClick={() => onPick(d.k)} style={{ flex: "1 0 12px", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", height: "100%" }}
          onMouseEnter={e => showTip(e, `<b>${d.lbl}</b><br/>${fMoney(d.v)}${d.sub ? ` · ${d.sub}` : ""}<br/>click → receipts`)} onMouseLeave={hideTip}>
          <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div style={{ width: "72%", maxWidth: 30, height: `${Math.max((d.v / mx) * 100, d.v > 0 ? 1.5 : 0)}%`, background: dow(Number(d.k)) === 0 && /^\d+$/.test(d.k) ? "#c9c3b4" : TEAL, borderRadius: "3px 3px 0 0", position: "relative" }}>
              {data.length <= 18 && d.v > 0 && <span style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 800, color: "var(--mut)", whiteSpace: "nowrap" }}>{(d.v / 1e7).toFixed(1)}</span>}
            </div>
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--mut)", height: 18, marginTop: 3, whiteSpace: "nowrap", visibility: i % step === 0 || i === data.length - 1 ? "visible" : "hidden" }}>{d.lbl}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- the view ---------------- */
const DD_KEYS = ["today", "week", "lastweek", "mtd", "lastmonth", "last30", "fy", "all", "month", "custom"] as const;
const isoOf = (d: number) => new Date(Date.UTC(2022, 0, 1) + d * 864e5).toISOString().slice(0, 10);
const dayOfIso = (s: string) => Math.round((Date.parse(`${s}T00:00:00Z`) - Date.UTC(2022, 0, 1)) / 864e5);
/** every month that has a receipt, newest first */
const MONTHS_IN_DATA = [...new Set(RECEIPTS.filter(r => r.day >= 0).map(r => ymOf(r.day)))].sort().reverse();

export function ReceiptsView({ projF, q, range }: { projF: string[]; q: string; range?: { from: string; to: string } }) {
  /* banner date filter: a valid from–to turns the 4th card into "Selected period" and the deep dive to Custom */
  const rng = useMemo(() => {
    if (!range?.from || !range?.to) return null;
    let f = dayOfIso(range.from), t = dayOfIso(range.to);
    if (isNaN(f) || isNaN(t)) return null;
    if (f > t) [f, t] = [t, f];
    return { f, t };
  }, [range?.from, range?.to]);
  const [dd, setDd] = useState<(typeof DD_KEYS)[number]>("mtd");
  /* Month = any single month; Custom = any from–to dates. Each compares with the period just before it. */
  const [selMonth, setSelMonth] = useState(MONTHS_IN_DATA[1] ?? MONTHS_IN_DATA[0] ?? ymOf(ANCHOR));
  const [cFrom, setCFrom] = useState(() => isoOf(ANCHOR - 29));
  const [cTo, setCTo] = useState(() => isoOf(ANCHOR));
  const P = useMemo(() => {
    const base = periods();
    const [y, m] = selMonth.split("-").map(Number);
    const mFrom = dayOf(y, m, 1), mTo = dayOf(y, m + 1, 1) - 1;
    const pmFrom = dayOf(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1, 1);
    let f = dayOfIso(cFrom), t = dayOfIso(cTo);
    if (isNaN(f)) f = ANCHOR - 29;
    if (isNaN(t)) t = ANCHOR;
    if (f > t) [f, t] = [t, f];
    const len = t - f + 1;
    return {
      ...base,
      month: { key: "month", label: ymLbl(selMonth), short: `${fDayS(mFrom)} – ${fDayS(Math.min(mTo, ANCHOR))}`, from: mFrom, to: mTo, prev: { from: pmFrom, to: mFrom - 1, label: `vs ${ymLbl(ymOf(pmFrom))}` } },
      custom: { key: "custom", label: `${fDayS(f)} – ${fDayS(t)}`, short: `${len} days`, from: f, to: t, prev: { from: f - len, to: f - 1, label: `vs the ${len} days before` } },
      ...(rng ? { range: { key: "range", label: "Selected period", short: `${fDay(rng.f)} – ${fDay(rng.t)} · ${rng.t - rng.f + 1} days`, from: rng.f, to: rng.t,
        prev: { from: rng.f - (rng.t - rng.f + 1), to: rng.f - 1, label: `vs the ${rng.t - rng.f + 1} days before` } } } : {}),
    } as Record<string, Period>;
  }, [selMonth, cFrom, cTo, rng]);
  useEffect(() => {
    if (!rng) return;
    setCFrom(isoOf(rng.f)); setCTo(isoOf(rng.t)); setDd("custom");
  }, [rng]);
  const [drill, setDrill] = useState<Drill | null>(null);
  const scope = useMemo(() => {
    const t = q.trim().toLowerCase();
    return RECEIPTS.filter(r => (!projF.length || projF.includes(r.proj))
      && (!t || r.name.toLowerCase().includes(t) || r.unit.toLowerCase().includes(t) || r.code.includes(t) || r.doc.includes(t)));
  }, [projF, q]);
  const inPer = (p: { from: number; to: number }) => scope.filter(r => inP(r, p));
  const A = useMemo(() => Object.fromEntries(Object.entries(P).map(([k, p]) => [k, { rows: inPer(p), a: agg(inPer(p)), pa: p.prev ? agg(inPer(p.prev)) : null }])) as Record<string, { rows: Rc[]; a: Agg; pa: Agg | null }>,
    [scope, P]);   // eslint-disable-line react-hooks/exhaustive-deps
  const open = (title: string, rows: Rc[], sub?: string) => setDrill({ title, rows, sub });
  const openP = (p: Period, extra?: (r: Rc) => boolean, tag?: string) =>
    open(`${p.label}${tag ? ` · ${tag}` : ""}`, inPer(p).filter(r => !extra || extra(r)), p.short);

  /* -------- main four cards -------- */
  const Main = ({ k, c }: { k: string; c: [string, string] }) => {
    const p = P[k], x = A[k], cash = x.rows.filter(r => r.kind === KIND.CASH);
    const byProj = sumBy(cash, r => r.proj);
    /* till-date card: also show the figure after taking out money not yet allotted (suspense + awaiting allotment) */
    const isAll = k === "all";
    return (
      <div className="g3d" style={{ ...GLASS(c[0], c[1]), display: "flex", flexDirection: "column", minHeight: 250 }}>
        <div onClick={() => openP(p)} style={{ padding: "14px 16px 10px", cursor: "pointer" }}
          onMouseEnter={e => showTip(e, `<b>${p.label}</b> · ${p.short}<br/>cash ${fCr(x.a.cash)} · ${fN(x.a.n)} receipts<br/>click → all receipts`)} onMouseLeave={hideTip}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,.10)" }} />
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.3px", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>{p.label}</div>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.7)", marginTop: 1 }}>{p.short}</div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 27, fontWeight: 700, lineHeight: 1.1, marginTop: 6, textShadow: "0 2px 4px rgba(0,0,0,.25)" }}>{fCr(x.a.cash)}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 5, fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,.85)" }}>
            <span>{fN(x.a.n)} receipts · {fN(x.a.payers)} customers</span>
            {x.pa && <Delta cur={x.a.cash} prev={x.pa.cash} label={p.prev!.label} light />}
          </div>
          {(x.a.tds > 0 || x.a.bounce > 0) && <div style={{ fontSize: 10, color: "rgba(255,255,255,.75)", marginTop: 3 }}>+ TDS {fMoney(x.a.tds)}{x.a.bounce > 0 ? ` · bounced ${fMoney(x.a.bounce)}` : ""}</div>}
        </div>
        {isAll && (() => {
          /* booked customers' collection = the Booking-wise tab's "Received" (same PDRN data); projects without a
             PDRN use ZREC's booked bucket. Bridge from gross cash uses the reconciliation buckets. */
          const t = RT_, noPdrn = RECON.filter(e => e.pdrn === null).map(e => e.proj);
          return (
            <div onClick={() => setReconOpen(true)}
              onMouseEnter={e => showTip(e, `<b>Booked customers' collection</b> = Booking-wise "Received" (PDRN ${PDRN_AS_ON})<br/>`
                + `Gross cash ${fCr(t.gross)}<br/>± TDS, transfers, refunds ${fCr(t.net - t.gross)}<br/>− suspense ${fCr(t.suspense)} · awaiting allotment (net) ${fCr(t.awaiting)}`
                + `<br/>− cancelled units ${fCr(t.cancelled)}${t.unmatched ? ` · not matched to a booking ${fCr(t.unmatched)}` : ""}<br/>= ZREC booked ${fCr(t.booked)} · Booking-wise ${fCr(t.pdrn)} (gap ${fCr(t.booked - t.pdrn)})`
                + (x.a.notPdrn > 0 ? `<br/><br/>Kept out of gross: ${fCr(x.a.notPdrn)} launch cheques the PDRN does not count` : "")
                + (noPdrn.length ? `<br/>No PDRN for ${noPdrn.join(", ")} — ZREC used` : "") + "<br/>click → project-wise reconciliation")} onMouseLeave={hideTip}
              style={{ margin: "0 12px 10px", padding: "7px 10px", borderRadius: 9, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.22)", cursor: "pointer" }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "rgba(255,255,255,.8)" }}>Booked customers · = Booking-wise</div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 700 }}>{fCr(t.pdrn)}</span>
                <span style={{ fontSize: 10.5, color: "rgba(255,255,255,.8)" }}><b>{fCr(x.a.cash - t.pdrn)}</b> in suspense</span>
              </div>
              {(() => {
                const refunds = x.a.refund, plus = t.net - t.gross + refunds;   // TDS + transfers
                // each part's share of the suspense (gross − Booking-wise): positive adds to it, negative reduces it
                const parts: [string, number][] = [["refunds", refunds], ["not allotted", t.suspense + t.awaiting], ["cancelled", t.cancelled],
                  ["unmatched", t.unmatched], ["timing", t.booked - t.pdrn], ["less TDS & transfers", -plus]];
                return (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", marginTop: 4, fontSize: 10, color: "rgba(255,255,255,.82)" }}>
                    <span style={{ opacity: .75 }}>suspense =</span>
                    {parts.filter(([, v]) => Math.abs(v) >= 5e4).map(([l, v]) => <span key={l}>{l} <b>{v < 0 ? "−" : "+"}{(Math.abs(v) / 1e7).toFixed(2)}</b></span>)}
                  </div>
                );
              })()}
            </div>
          );
        })()}
        {/* scrolling project breakdown */}
        <div className="rc-scroll" style={{ flex: 1, background: "rgba(255,255,255,.10)", borderTop: "1px solid rgba(255,255,255,.18)", maxHeight: 132, overflowY: "auto", padding: "4px 10px 6px" }}>
          {byProj.length ? byProj.map(b => (
            <div key={b.k} onClick={() => openP(p, r => r.proj === b.k, b.k)} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 4px", fontSize: 11.5, cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,.10)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.12)"; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.k}</span>
              {isAll
                ? <b style={{ whiteSpace: "nowrap" }}>{fMoney(b.v)} <span style={{ opacity: 0.75, fontWeight: 600 }}>· booked {fMoney(pdrnReceived(b.k) ?? (RECON.find(e => e.proj === b.k)?.b.booked ?? 0))}</span></b>
                : <b style={{ whiteSpace: "nowrap" }}>{fMoney(b.v)} <span style={{ opacity: 0.7, fontWeight: 600 }}>{x.a.cash ? `${((b.v / x.a.cash) * 100).toFixed(0)}%` : ""}</span></b>}
            </div>
          )) : <div style={{ fontSize: 11.5, opacity: 0.8, padding: "8px 4px" }}>No cash receipts in this period</div>}
        </div>
      </div>
    );
  };

  /* -------- extra cards strip -------- */
  const mtd = A.mtd, lm = A.lastmonth, last30 = A.last30, fy = A.fy;
  const wdDone = workDays(P.mtd.from, P.mtd.to);
  const monthEnd = (() => { const d = new Date(Date.UTC(2022, 0, 1) + ANCHOR * 864e5); return dayOf(d.getUTCFullYear(), d.getUTCMonth() + 2, 1) - 1; })();
  const wdAll = workDays(P.mtd.from, monthEnd);
  const runRate = wdDone ? (mtd.a.cash / wdDone) * wdAll : 0;
  const pendingAll = scope.filter(r => r.kind === KIND.PENDING);
  const H = useMemo(() => holdings(scope), [scope]);
  const holdRows = useMemo(() => {
    const names = [...new Set([...H.suspense.map(x => x.proj), ...H.awaiting.map(x => x.proj)])];
    return names.map(n => {
      const sp = H.suspense.find(x => x.proj === n), aw = H.awaiting.filter(x => x.proj === n);
      const ages = aw.map(x => ANCHOR - x.first).filter(a => a >= 0 && a < 1e6);
      return { n, susp: sp?.net ?? 0, suspRows: sp?.rows ?? [], aw: aw.reduce((s, x) => s + x.net, 0), awN: aw.length, awRows: aw.flatMap(x => x.rows),
        avgAge: ages.length ? ages.reduce((s, a) => s + a, 0) / ages.length : 0, maxAge: ages.length ? Math.max(...ages) : 0, over90: aw.filter(x => x.first < 1e8 && ANCHOR - x.first > 90).reduce((s, x) => s + x.net, 0) };
    }).sort((a, b) => b.susp + b.aw - (a.susp + a.aw));
  }, [H]);
  const notAllotted = H.suspenseTotal + H.awaitingTotal;
  const RECON = useMemo(() => reconcile(scope), [scope]);
  const reconRef = React.useRef<HTMLDivElement>(null);
  const setReconOpen = (_: boolean) => reconRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const RT_ = useMemo(() => RECON.reduce((t, e) => ({
    gross: t.gross + e.gross, net: t.net + e.net, suspense: t.suspense + e.b.suspense, awaiting: t.awaiting + e.b.awaiting,
    cancelled: t.cancelled + e.b.cancelled, booked: t.booked + e.b.booked, unmatched: t.unmatched + e.b.unmatched,
    pdrn: t.pdrn + (e.pdrn ?? e.b.booked),
  }), { gross: 0, net: 0, suspense: 0, awaiting: 0, cancelled: 0, booked: 0, unmatched: 0, pdrn: 0 }), [RECON]);
  const strip: { k: string; v: string; s: string; c: string; go: () => void }[] = [
    { k: "This week", v: fCr(A.week.a.cash), s: `${P.week.short} · ${fN(A.week.a.n)} receipts`, c: TEAL, go: () => openP(P.week) },
    { k: "This month to date", v: fCr(mtd.a.cash), s: `${fN(mtd.a.n)} receipts · ${wdDone} working days`, c: NAVY, go: () => openP(P.mtd) },
    { k: "Month-end at this pace", v: fCr(runRate), s: `run-rate over ${wdAll} working days · last month ${fCr(lm.a.cash)}`, c: runRate >= lm.a.cash ? GREEN : RED, go: () => openP(P.mtd) },
    { k: "Last 30 days", v: fCr(last30.a.cash), s: `avg ${fMoney(last30.a.cash / Math.max(workDays(P.last30.from, P.last30.to), 1))} per working day`, c: PURPLE, go: () => openP(P.last30) },
    { k: P.fy.label, v: fCr(fy.a.cash), s: `${fN(fy.a.n)} receipts · ${fN(fy.a.payers)} customers`, c: GOLD, go: () => openP(P.fy) },
    { k: "TDS credit (FY)", v: fCr(fy.a.tds), s: "buyers' TDS challans", c: "#2a78d6", go: () => openP(P.fy, r => r.kind === KIND.TDS, "TDS") },
    { k: "Bounced this month", v: fMoney(mtd.a.bounce), s: `${fN(mtd.a.nBounce)} instruments · ${mtd.a.cash + mtd.a.bounce ? ((mtd.a.bounce / (mtd.a.cash + mtd.a.bounce)) * 100).toFixed(1) : 0}% of value`, c: RED, go: () => openP(P.mtd, r => r.kind === KIND.BOUNCE, "bounced") },
    { k: "Refunded this month", v: fMoney(mtd.a.refund), s: "paid back to customers", c: "#7b5cb8", go: () => openP(P.mtd, r => r.kind === KIND.REFUND, "refunds") },
    { k: "Not yet allotted", v: fCr(notAllotted), s: `${fCr(H.suspenseTotal)} unidentified · ${fCr(H.awaitingTotal)} with ${fN(H.awaiting.length)} customers`, c: "#c27c0e", go: () => open("Money not yet allotted", [...H.suspense.flatMap(x => x.rows), ...H.awaiting.flatMap(x => x.rows)], "suspense + customers awaiting allotment") },
    { k: "Awaiting clearance", v: fMoney(pendingAll.reduce((s, r) => s + r.amt, 0)), s: `${fN(pendingAll.length)} receipts entered, not cleared`, c: AMBER, go: () => open("Awaiting clearance", pendingAll) },
  ];

  /* -------- deep-dive for the chosen period -------- */
  const dp = P[dd], dx = A[dd], dcash = dx.rows.filter(r => r.kind === KIND.CASH);
  const projRows = useMemo(() => {
    const names = [...new Set(scope.map(r => r.proj))];
    return names.map(n => {
      const cur = agg(dx.rows.filter(r => r.proj === n)), prev = dx.pa ? agg((dp.prev ? inPer(dp.prev) : []).filter(r => r.proj === n)) : null;
      const last = Math.max(-1, ...scope.filter(r => r.proj === n && r.kind === KIND.CASH).map(r => r.day));
      return { n, cur, prev, last };
    }).filter(x => x.cur.cash || x.cur.bounce || x.cur.refund || x.prev?.cash).sort((a, b) => b.cur.cash - a.cur.cash);
  }, [dx, dp, scope]);   // eslint-disable-line react-hooks/exhaustive-deps
  const topPayers = useMemo(() => {
    const m = new Map<string, { name: string; unit: string; proj: string; v: number; n: number }>();
    dcash.filter(r => r.name !== POOL_NAME).forEach(r => { const e = m.get(r.code) ?? { name: r.name, unit: r.unit, proj: r.proj, v: 0, n: 0 }; e.v += r.amt; e.n++; m.set(r.code, e); });
    return [...m.entries()].sort((a, b) => b[1].v - a[1].v).slice(0, 12);
  }, [dcash]);
  const daily = useMemo(() => Array.from({ length: 60 }, (_, i) => ANCHOR - 59 + i).map(d => ({ k: String(d), lbl: fDayS(d), v: scope.filter(r => r.day === d && r.kind === KIND.CASH).reduce((s, r) => s + r.amt, 0) })), [scope]);
  const months = useMemo(() => {
    const out: { k: string; lbl: string; v: number; sub: string }[] = [];
    const end = ymOf(ANCHOR); let [y, m] = end.split("-").map(Number);
    for (let i = 0; i < 18; i++) { const k = `${y}-${String(m).padStart(2, "0")}`; out.unshift({ k, lbl: ymLbl(k), v: 0, sub: "" }); m--; if (!m) { m = 12; y--; } }
    const idx = new Map(out.map((o, i) => [o.k, i]));
    scope.forEach(r => { if (r.kind === KIND.CASH) { const i = idx.get(ymOf(r.day)); if (i !== undefined) out[i].v += r.amt; } });
    out.forEach((o, i) => { if (i) o.sub = `${pctChg(o.v, out[i - 1].v) >= 0 ? "+" : ""}${pctChg(o.v, out[i - 1].v).toFixed(0)}% vs ${out[i - 1].lbl}`; });
    return out;
  }, [scope]);
  const bounceMonths = useMemo(() => months.slice(-12).map(mo => ({ k: mo.k, lbl: mo.lbl, v: scope.filter(r => r.kind === KIND.BOUNCE && ymOf(r.day) === mo.k).reduce((s, r) => s + r.amt, 0) })), [months, scope]);
  const weekday = useMemo(() => {
    const from = ANCHOR - 13 * 7 + 1, names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return [1, 2, 3, 4, 5, 6, 0].map(w => ({ k: names[w], v: scope.filter(r => r.kind === KIND.CASH && r.day >= from && r.day <= ANCHOR && dow(r.day) === w).reduce((s, r) => s + r.amt, 0) / 13 }));
  }, [scope]);

  /* -------- management questions -------- */


  return (
    <>
      <style>{`.rc-scroll::-webkit-scrollbar{width:5px}.rc-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.35);border-radius:3px}
        .rc-strip::-webkit-scrollbar{height:7px}.rc-strip::-webkit-scrollbar-thumb{background:#d8d2c4;border-radius:4px}
        @media (max-width: 1100px){ .rc-2col{grid-template-columns:1fr !important} }`}</style>

      {/* main cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 12 }}>
        <Main k="today" c={["#1a7f9c", "#0e5468"]} />
        <Main k="lastweek" c={["#1e9a6c", "#0f6647"]} />
        <Main k="lastmonth" c={["#6b4fa0", "#3f2a73"]} />
        <Main k={rng ? "range" : "all"} c={["#1c3f6e", "#0f2547"]} />
      </div>

      {/* more figures: one card, sliding toggle */}
      <SlideCard id="figs" title="More Figures" cap="slide through · click the figure → receipts" items={strip.map(x => ({
        k: x.k, c: x.c, go: x.go,
        body: <>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.1px", textTransform: "uppercase", color: "var(--mut)" }}>{x.k}</div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 30, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{x.v}</div>
          <div style={{ fontSize: 12, color: "#8a8474", marginTop: 2 }}>{x.s}</div>
        </>,
      }))} />

      {/* money received but not yet allotted */}
      <Zoomable title="Not yet allotted" collapsible>
        <div style={CARD}>
          <h3 style={H3}>Money Received, Not Yet Allotted</h3>
          <div style={CAP}>balances as on {RC.meta.asOn} · net of journal vouchers and refunds · click any figure → the receipts behind it</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 12 }}>
            {[
              { k: "Unidentified (EOI pool)", v: H.suspenseTotal, s: "still on the EOI collection pool accounts — customer not yet identified", c: ["#c27c0e", "#8a5600"] as [string, string], rows: H.suspense.flatMap(x => x.rows) },
              { k: "Identified, awaiting allotment", v: H.awaitingTotal, s: `${fN(H.awaiting.length)} customers · EOI / advance not yet allotted a unit`, c: ["#6b4fa0", "#3f2a73"] as [string, string], rows: H.awaiting.flatMap(x => x.rows) },
              { k: "Total in suspense", v: RT_.gross - RT_.pdrn, s: `gross cash ${fCr(RT_.gross)} − Booking-wise ${fCr(RT_.pdrn)} · refunds, transfers, cancelled & timing included`, c: ["#8e2f23", "#5e1a12"] as [string, string],
                rows: RECON.flatMap(e => [...e.rows.suspense, ...e.rows.awaiting, ...e.rows.cancelled, ...e.rows.unmatched, ...e.rows.adj.filter(r => r.kind === KIND.REFUND)]) },
              { k: "Total not yet allotted", v: notAllotted, s: `${fCr(holdRows.reduce((s, r) => s + r.over90, 0))} of it waiting over 90 days`, c: ["#1c3f6e", "#0f2547"] as [string, string], rows: [...H.suspense.flatMap(x => x.rows), ...H.awaiting.flatMap(x => x.rows)] },
            ].map(x => (
              <div key={x.k} className="g3d" onClick={() => open(x.k, x.rows)} style={{ ...GLASS(x.c[0], x.c[1]), padding: "12px 14px", cursor: "pointer" }}
                onMouseEnter={e => showTip(e, `<b>${x.k}</b><br/>${fCr(x.v)}<br/>click → receipts`)} onMouseLeave={hideTip}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>{x.k}</div>
                <div style={{ fontFamily: "Georgia,serif", fontSize: 24, fontWeight: 700, marginTop: 4 }}>{fCr(x.v)}</div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.8)", marginTop: 4 }}>{x.s}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: 14 }} className="rc-2col">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
                <thead><tr>{["Project", "In suspense", "Awaiting allotment", "Customers", "Avg wait", "Oldest", "Waiting 90d+"].map((h, i) => <th key={h} style={{ ...TH, ...(i ? RT : {}) }}>{h}</th>)}</tr></thead>
                <tbody>{holdRows.map(r => (
                  <tr key={r.n} {...hoverRow}>
                    <td style={{ ...TD, fontWeight: 800, color: "var(--ink)" }}>{r.n}</td>
                    <td style={{ ...TD, ...RT, color: r.susp ? "#8a5600" : "var(--mut)", fontWeight: 700, cursor: r.susp ? "pointer" : "default" }} onClick={() => r.susp && open(`${r.n} · in suspense`, r.suspRows)}>{r.susp ? fMoney(r.susp) : "—"}</td>
                    <td style={{ ...TD, ...RT, fontWeight: 800, cursor: "pointer" }} onClick={() => open(`${r.n} · awaiting allotment`, r.awRows)}>{r.aw ? fMoney(r.aw) : "—"}</td>
                    <td style={{ ...TD, ...RT }}>{fN(r.awN)}</td>
                    <td style={{ ...TD, ...RT }}>{r.awN ? `${Math.round(r.avgAge)} d` : "—"}</td>
                    <td style={{ ...TD, ...RT, color: r.maxAge > 180 ? RED : "var(--mut)" }}>{r.awN ? `${r.maxAge} d` : "—"}</td>
                    <td style={{ ...TD, ...RT, color: r.over90 ? RED : "var(--mut)", fontWeight: r.over90 ? 700 : 500 }}>{r.over90 ? fMoney(r.over90) : "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".8px", textTransform: "uppercase", color: "var(--mut)", marginBottom: 4 }}>Largest waiting customers</div>
              <div style={{ maxHeight: 260, overflowY: "auto" }}>
                {H.awaiting.slice(0, 25).map(c => (
                  <div key={c.code + c.proj} onClick={() => open(`${c.name} · all receipts`, c.rows, `${c.unit || c.code} · ${c.proj} · waiting ${ANCHOR - c.first} days`)}
                    style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 4px", borderBottom: "1px solid #f0ede5", fontSize: 12, cursor: "pointer" }} {...hoverRow}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b>{c.name}</b> <span style={{ color: "var(--mut)" }}>· {c.proj}{c.first < 1e8 ? ` · ${ANCHOR - c.first} d` : " · moved in by transfer"}</span></span>
                    <b style={{ whiteSpace: "nowrap" }}>{fMoney(c.net)}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Zoomable>

      {/* Collections ↔ Booking-wise reconciliation */}
      <Zoomable title="Collections vs Booking-wise" collapsible>
        <div style={CARD} ref={reconRef}>
          <h3 style={H3}>Collections ↔ Booking-wise, Project by Project</h3>
          <div style={CAP}>₹ Cr · how each project's gross cash becomes the Booking-wise "Received" · every customer counted once · click any figure → receipts</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr>{["Project", "Gross cash", "± TDS / JV / refunds", "= Net held", "− Suspense", "− Awaiting allot.", "− Cancelled", "− Unmatched", "= Booked", "Booking-wise", "Gap"].map((h, i) => <th key={h} style={{ ...TH, ...(i ? RT : {}), padding: "8px 7px", letterSpacing: ".4px" }}>{h}</th>)}</tr></thead>
              <tbody>
                {RECON.map(e => {
                  const c = (v: number, rows: Rc[], t: string, strong?: boolean) => (
                    <td style={{ ...TD, ...RT, padding: "6px 7px", cursor: rows.length ? "pointer" : "default", fontWeight: strong ? 800 : 500, color: v < -5e4 ? RED : undefined }} onClick={() => rows.length && open(`${e.proj} · ${t}`, rows)}>{Math.abs(v) < 5e4 ? "—" : crN(v)}</td>);
                  const gap = e.pdrn === null ? null : e.b.booked - e.pdrn;
                  return (
                    <tr key={e.proj}>
                      <td style={{ ...TD, fontWeight: 700 }}>{e.proj}</td>
                      {c(e.gross, e.rows.gross, "gross cash")}
                      {c(e.net - e.gross, e.rows.adj, "TDS, transfers, refunds")}
                      {c(e.net, [...e.rows.gross, ...e.rows.adj], "net held", true)}
                      {c(e.b.suspense, e.rows.suspense, "suspense")}
                      {c(e.b.awaiting, e.rows.awaiting, "awaiting allotment")}
                      {c(e.b.cancelled, e.rows.cancelled, "cancelled units")}
                      {c(e.b.unmatched, e.rows.unmatched, "not matched to an active booking")}
                      {c(e.b.booked, e.rows.booked, "booked customers", true)}
                      <td style={{ ...TD, ...RT, fontWeight: 800, color: GREEN }}>{e.pdrn === null ? <span style={{ color: "var(--mut)", fontWeight: 500 }}>no PDRN</span> : crN(e.pdrn)}</td>
                      <td style={{ ...TD, ...RT, fontWeight: 700, color: gap === null ? "var(--mut)" : Math.abs(gap) < 1e7 ? GREEN : RED }}>{gap === null ? "—" : crN(gap)}</td>
                    </tr>
                  );
                })}
                <tr style={{ background: NAVY }}>
                  {["Total", RT_.gross, RT_.net - RT_.gross, RT_.net, RT_.suspense, RT_.awaiting, RT_.cancelled, RT_.unmatched, RT_.booked, RT_.pdrn, RT_.booked - RT_.pdrn].map((v, i) => (
                    <td key={i} style={{ ...TD, ...(i ? RT : {}), padding: "6px 7px", color: "#fff", fontWeight: 800, borderBottom: "none" }}>{typeof v === "string" ? v : crN(v)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 8 }}>
            Gap = timing between the ZREC print and the PDRN export, plus transfers in flight · Booking-wise as on {PDRN_AS_ON}, receipts as on {RC.meta.asOn}
            {RECON.some(e => e.pdrn === null) ? ` · ${RECON.filter(e => e.pdrn === null).map(e => e.proj).join(", ")}: no PDRN — booked taken from ZREC` : ""}
          </div>
        </div>
      </Zoomable>

      {/* trends */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 14, marginBottom: 14 }} className="rc-2col">
        <Zoomable title="Daily collection" collapsible>
          <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
            <h3 style={H3}>Daily Collection — Last 60 Days</h3>
            <div style={CAP}>cash cleared per day · grey = Sunday · dashed = working-day average · click a day → receipts</div>
            <Columns data={daily} avg={daily.filter(d => dow(Number(d.k)) !== 0).reduce((s, d) => s + d.v, 0) / Math.max(daily.filter(d => dow(Number(d.k)) !== 0).length, 1)}
              onPick={k => open(`Receipts on ${fDay(Number(k))}`, scope.filter(r => r.day === Number(k)))} />
          </div>
        </Zoomable>
        <Zoomable title="Monthly trend" collapsible>
          <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
            <h3 style={H3}>Monthly Collection — 18 Months</h3>
            <div style={CAP}>₹ Cr per month · current month is to date · click → receipts</div>
            <Columns data={months} onPick={k => open(`Receipts in ${ymLbl(k)}`, scope.filter(r => ymOf(r.day) === k))} />
          </div>
        </Zoomable>
      </div>

      {/* deep dive */}
      <div style={{ ...CARD, padding: "10px 14px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", marginRight: 4 }}>Deep dive for</span>
        {DD_KEYS.filter(k => k !== "month" && k !== "custom").map(k => (
          <button key={k} onClick={() => setDd(k)} style={{ height: 30, padding: "0 13px", borderRadius: 999, border: `1px solid ${dd === k ? GOLD : "#e0dacb"}`, background: dd === k ? "#fdf6e8" : "#fff", color: dd === k ? "#96691c" : "var(--mut)", fontWeight: dd === k ? 800 : 600, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
            {P[k].label.replace("Collection till date", "Till date").replace(/Latest day · .*/, "Latest day")}
          </button>
        ))}
        <span style={{ width: 1, height: 24, background: "#e0dacb", margin: "0 4px" }} />
        {/* pick any month */}
        <label style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 4px 0 12px", borderRadius: 999, border: `1px solid ${dd === "month" ? GOLD : "#e0dacb"}`, background: dd === "month" ? "#fdf6e8" : "#fff", cursor: "pointer" }}
          onClick={() => setDd("month")}>
          <span style={{ fontSize: 11.5, fontWeight: dd === "month" ? 800 : 600, color: dd === "month" ? "#96691c" : "var(--mut)" }}>Month</span>
          <select aria-label="Month" value={selMonth} onChange={e => { setSelMonth(e.target.value); setDd("month"); }}
            style={{ height: 24, minWidth: 84, border: "1px solid #e0dacb", borderRadius: 6, background: "#fff", fontSize: 11.5, fontWeight: 800, color: "#14213d", fontFamily: "inherit", cursor: "pointer", outline: "none", colorScheme: "light", padding: "0 4px" }}>
            {MONTHS_IN_DATA.map(k => <option key={k} value={k}>{ymLbl(k)}</option>)}
          </select>
        </label>
        {/* pick any dates */}
        <label style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px 0 12px", borderRadius: 999, border: `1px solid ${dd === "custom" ? GOLD : "#e0dacb"}`, background: dd === "custom" ? "#fdf6e8" : "#fff", cursor: "pointer" }}
          onClick={() => setDd("custom")}>
          <span style={{ fontSize: 11.5, fontWeight: dd === "custom" ? 800 : 600, color: dd === "custom" ? "#96691c" : "var(--mut)" }}>Custom</span>
          <input type="date" aria-label="From date" value={cFrom} onChange={e => { setCFrom(e.target.value); setDd("custom"); }}
            style={{ height: 24, border: "1px solid #e0dacb", borderRadius: 6, fontSize: 11.5, fontFamily: "inherit", padding: "0 4px", colorScheme: "light" }} />
          <span style={{ color: "var(--mut)" }}>–</span>
          <input type="date" aria-label="To date" value={cTo} onChange={e => { setCTo(e.target.value); setDd("custom"); }}
            style={{ height: 24, border: "1px solid #e0dacb", borderRadius: 6, fontSize: 11.5, fontFamily: "inherit", padding: "0 4px", colorScheme: "light" }} />
        </label>
        <span style={{ fontSize: 11.5, color: "var(--mut)", marginLeft: "auto" }}>{dp.label} · {dp.short} · <b style={{ color: "var(--ink)" }}>{fCr(dx.a.cash)}</b> cash{dx.pa && dp.prev ? <> · <Delta cur={dx.a.cash} prev={dx.pa.cash} label={dp.prev.label} /></> : null}</span>
      </div>

      <Zoomable title="Project-wise" collapsible>
        <div style={CARD}>
          <h3 style={H3}>Project-wise Collection — {dp.label}</h3>
          <div style={CAP}>{dp.prev ? `change ${dp.prev.label}` : ""} · days since last receipt flags projects going quiet · click a row → receipts</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 1000 }}>
              <thead><tr>{["Project", "Cash collected", "Share", "Change", "Receipts", "Customers", "Avg receipt", "TDS", "Bounced", "Refunded", "Last receipt"].map((h, i) => <th key={h} style={{ ...TH, ...(i ? RT : {}) }}>{h}</th>)}</tr></thead>
              <tbody>
                {projRows.map(r => (
                  <tr key={r.n} onClick={() => openP(dp, x => x.proj === r.n, r.n)} style={{ cursor: "pointer" }} {...hoverRow}>
                    <td style={{ ...TD, fontWeight: 800, color: "var(--ink)" }}>{r.n}</td>
                    <td style={{ ...TD, ...RT, fontWeight: 800 }}>{fCr(r.cur.cash)}</td>
                    <td style={{ ...TD, ...RT }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                        <div style={{ width: 60, height: 8, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${dx.a.cash ? (r.cur.cash / dx.a.cash) * 100 : 0}%`, background: TEAL }} /></div>
                        {dx.a.cash ? `${((r.cur.cash / dx.a.cash) * 100).toFixed(0)}%` : "—"}
                      </div>
                    </td>
                    <td style={{ ...TD, ...RT }}>{r.prev ? <Delta cur={r.cur.cash} prev={r.prev.cash} /> : "—"}</td>
                    <td style={{ ...TD, ...RT }}>{fN(r.cur.n)}</td>
                    <td style={{ ...TD, ...RT }}>{fN(r.cur.payers)}</td>
                    <td style={{ ...TD, ...RT }}>{r.cur.n ? fMoney(r.cur.cash / r.cur.n) : "—"}</td>
                    <td style={{ ...TD, ...RT, color: "var(--mut)" }}>{r.cur.tds ? fMoney(r.cur.tds) : "—"}</td>
                    <td style={{ ...TD, ...RT, color: r.cur.bounce ? RED : "var(--mut)" }}>{r.cur.bounce ? fMoney(r.cur.bounce) : "—"}</td>
                    <td style={{ ...TD, ...RT, color: r.cur.refund ? PURPLE : "var(--mut)" }}>{r.cur.refund ? fMoney(r.cur.refund) : "—"}</td>
                    <td style={{ ...TD, ...RT, color: ANCHOR - r.last > 7 ? RED : "var(--mut)", fontWeight: ANCHOR - r.last > 7 ? 800 : 500 }}>{r.last >= 0 ? `${fDayS(r.last)} · ${ANCHOR - r.last}d` : "—"}</td>
                  </tr>
                ))}
                {!projRows.length && <tr><td colSpan={11} style={{ ...TD, textAlign: "center", color: "var(--mut)", padding: 16 }}>No receipts in this period</td></tr>}
              </tbody>
              <tfoot><tr style={{ background: "#faf9f6" }}>
                <td style={{ ...TD, fontWeight: 800, borderTop: "2px solid #eae6da" }}>Total</td>
                <td style={{ ...TD, ...RT, fontWeight: 800, borderTop: "2px solid #eae6da" }}>{fCr(dx.a.cash)}</td>
                <td style={{ ...TD, borderTop: "2px solid #eae6da" }} />
                <td style={{ ...TD, ...RT, borderTop: "2px solid #eae6da" }}>{dx.pa ? <Delta cur={dx.a.cash} prev={dx.pa.cash} /> : "—"}</td>
                <td style={{ ...TD, ...RT, fontWeight: 800, borderTop: "2px solid #eae6da" }}>{fN(dx.a.n)}</td>
                <td style={{ ...TD, ...RT, fontWeight: 800, borderTop: "2px solid #eae6da" }}>{fN(dx.a.payers)}</td>
                <td style={{ ...TD, ...RT, fontWeight: 800, borderTop: "2px solid #eae6da" }}>{dx.a.n ? fMoney(dx.a.cash / dx.a.n) : "—"}</td>
                <td style={{ ...TD, ...RT, fontWeight: 800, borderTop: "2px solid #eae6da" }}>{fMoney(dx.a.tds)}</td>
                <td style={{ ...TD, ...RT, fontWeight: 800, borderTop: "2px solid #eae6da", color: RED }}>{fMoney(dx.a.bounce)}</td>
                <td style={{ ...TD, ...RT, fontWeight: 800, borderTop: "2px solid #eae6da", color: PURPLE }}>{fMoney(dx.a.refund)}</td>
                <td style={{ ...TD, borderTop: "2px solid #eae6da" }} />
              </tr></tfoot>
            </table>
          </div>
        </div>
      </Zoomable>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 14, marginBottom: 14 }}>
        <Zoomable title="How customers pay" collapsible>
          <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
            <h3 style={H3}>How Customers Pay</h3>
            <div style={CAP}>{dp.label} · cash by mode · click → receipts</div>
            <Donut items={sumBy(dcash, r => r.mode)} onPick={k => openP(dp, r => r.kind === KIND.CASH && r.mode === k, k.toLowerCase())} />
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".8px", textTransform: "uppercase", color: "var(--mut)", margin: "12px 0 4px" }}>Received through</div>
            <MiniBars items={sumBy(dcash, r => r.channel)} color={NAVY} onPick={k => openP(dp, r => r.kind === KIND.CASH && r.channel === k, k)} />
          </div>
        </Zoomable>
        <Zoomable title="Who is paying" collapsible>
          <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
            <h3 style={H3}>Who Is Paying</h3>
            <div style={CAP}>{dp.label} · booked customers vs EOI / advance (awaiting allotment) · click → receipts</div>
            <Donut items={sumBy(dcash, r => ({ ACTIVE: "Booked / allotted", "ALLOTMENT PENDING": "EOI / advance (awaiting allotment)", CANCEL: "Cancelled bookings" } as Record<string, string>)[r.cstatus] ?? r.cstatus)}
              onPick={k => openP(dp, r => r.kind === KIND.CASH && (({ ACTIVE: "Booked / allotted", "ALLOTMENT PENDING": "EOI / advance (awaiting allotment)", CANCEL: "Cancelled bookings" } as Record<string, string>)[r.cstatus] ?? r.cstatus) === k, k)} />
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".8px", textTransform: "uppercase", color: "var(--mut)", margin: "12px 0 4px" }}>What it was for</div>
            <MiniBars items={sumBy(dcash, r => r.charge === "UNIT CHARGE" ? "Unit price instalments" : r.charge === "DELAYED INTEREST" ? "Delayed-payment interest" : r.charge === "ADMIN CHARGE" ? "Admin charges" : "Not tagged (EOI / advance)")} color={GOLD} />
          </div>
        </Zoomable>
        <Zoomable title="Top payers" collapsible>
          <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
            <h3 style={H3}>Top Payers — {dp.label}</h3>
            <div style={CAP}>cash collected · excludes the EOI collection pool account · click → that customer's full receipt history</div>
            <div style={{ maxHeight: 330, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr>{["Customer", "Project", "Receipts", "Amount"].map((h, i) => <th key={h} style={{ ...TH, ...(i >= 2 ? RT : {}) }}>{h}</th>)}</tr></thead>
                <tbody>{topPayers.map(([code, p]) => (
                  <tr key={code} onClick={() => open(`${p.name} · all receipts`, scope.filter(r => r.code === code), `${p.unit || code} · ${p.proj}`)} style={{ cursor: "pointer" }} {...hoverRow}>
                    <td style={{ ...TD, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", fontWeight: 700, color: "var(--ink)" }} title={p.name}>{p.name}<div style={{ fontSize: 10.5, color: "var(--mut)", fontWeight: 500 }}>{p.unit || code}</div></td>
                    <td style={TD}>{p.proj}</td><td style={{ ...TD, ...RT }}>{p.n}</td><td style={{ ...TD, ...RT, fontWeight: 800 }}>{fMoney(p.v)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </Zoomable>
        <Zoomable title="Bounces" collapsible>
          <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
            <h3 style={H3}>Bounced Instruments — 12 Months</h3>
            <div style={CAP}>value bounced per month · click → the bounced receipts</div>
            <Columns data={bounceMonths} height={170} onPick={k => open(`Bounced in ${ymLbl(k)}`, scope.filter(r => r.kind === KIND.BOUNCE && ymOf(r.day) === k))} />
          </div>
        </Zoomable>
        <Zoomable title="Weekday pattern" collapsible>
          <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
            <h3 style={H3}>Which Days Money Comes In</h3>
            <div style={CAP}>average cash per weekday over the last 13 weeks</div>
            <MiniBars items={weekday} color={PURPLE} />
          </div>
        </Zoomable>
        <Zoomable title="Payer's bank" collapsible>
          <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
            <h3 style={H3}>Payer's Bank</h3>
            <div style={CAP}>{dp.label} · where the instrument names a bank (often a home-loan disbursement) · click → receipts</div>
            <MiniBars items={sumBy(dcash.filter(r => r.bank !== "Other / not stated"), r => r.bank).slice(0, 10)} color={TEAL} onPick={k => openP(dp, r => r.kind === KIND.CASH && r.bank === k, k)} />
          </div>
        </Zoomable>
      </div>

      <RcDrawer d={drill} onClose={() => setDrill(null)} />
    </>
  );
}
