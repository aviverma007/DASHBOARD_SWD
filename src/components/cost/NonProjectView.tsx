import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showTip, hideTip } from "../common/hoverTip";
import { Zoomable } from "../common/Zoomable";
import raw from "../../data/costNonProject.json";
import { fN, fMoney } from "./costShared";

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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 14 }}>
        <KPI k={`Ordered ${gst ? "(with GST)" : "(excl GST)"}`} v={fMoney(ord)} s={`${fN(pos)} POs · ${fN(rows.length)} lines`} col={NAVY} />
        <KPI k="Delivered" v={fMoney(del)} s={`${ord > 0 ? ((del / ord) * 100).toFixed(1) : "—"}% of ordered`} col={TEAL} />
        <KPI k="Still to deliver" v={fMoney(still)} s="open commitment (excl GST)" col={AMBER} />
        <KPI k="WBS in scope" v={fN(wbsN)} s={`${fN(vendN)} vendors`} col={GOLD} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(430px, 1fr))", gap: 14, marginBottom: 14 }}>
        <BarPair cardTitle="Ordered by department" title="Ordered vs Delivered — by Department" cap="navy = ordered · teal = delivered · click → drill" data={byDept} names={NP.PGRP} dim="pgrp" />
        <Zoomable title="Monthly PO trend" collapsible>
          <div style={{ ...CARD, height: "100%", marginBottom: 0, display: "flex", flexDirection: "column" }}>
            <h3 style={H3}>Monthly PO — Ordered vs Delivered</h3>
            <div style={CAP}>by document date · navy = ordered · teal = delivered · click a month → drill</div>
            <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 3, minHeight: 220, overflowX: "auto", overflowY: "hidden", paddingTop: 8 }}>
              {(() => {
                const mx = Math.max(...trend.map(([, e]) => e.o), 1);
                return trend.map(([k, e]) => (
                  <div key={k} onClick={() => open([{ dim: "mon", val: k, label: ymLbl(k) }])}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: "1 0 30px", minWidth: 30, height: "100%", justifyContent: "flex-end", cursor: "pointer" }}
                    onMouseEnter={ev => showTip(ev, `<b>${ymLbl(k)}</b><br/>Ordered — ${fMoney(e.o)}<br/>Delivered — ${fMoney(e.d)}`)}
                    onMouseMove={ev => showTip(ev, `<b>${ymLbl(k)}</b> ${fMoney(e.o)}`)} onMouseLeave={hideTip}>
                    <div style={{ width: "72%", position: "relative", height: "85%", display: "flex", alignItems: "flex-end" }}>
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${(e.o / mx) * 100}%`, background: NAVY, borderRadius: "3px 3px 0 0" }} />
                      <div style={{ position: "absolute", bottom: 0, left: "20%", right: "20%", height: `${(e.d / mx) * 100}%`, background: TEAL, borderRadius: "3px 3px 0 0" }} />
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "var(--mut)", whiteSpace: "nowrap", transform: "rotate(-45deg)", transformOrigin: "top center", marginTop: 4 }}>{ymLbl(k)}</span>
                  </div>
                ));
              })()}
            </div>
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
                  {["WBS", "Description", "Ordered", "Delivered", "Still to deliver", "Delivery %"].map(h => (
                    <th key={h} style={{ textAlign: ["Ordered", "Delivered", "Still to deliver", "Delivery %"].includes(h) ? "right" : "left", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "8px 10px", borderBottom: "2px solid #eae6da", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byWbs.slice(0, 400).map(([k, e]) => {
                  const wr = rows.filter(r => r.wbs === k);
                  const st = wr.reduce((s, r) => s + r.still, 0);
                  const desc = NP.WDESC[wr[0]?.wdesc ?? -1] ?? "—";
                  return (
                    <tr key={k} onClick={() => open([{ dim: "wbs", val: k, label: NP.WBS[k] }])} style={{ cursor: "pointer" }}
                      onMouseEnter={ev => { (ev.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                      onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.background = ""; }}>
                      <td style={{ padding: "6px 10px", fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", borderBottom: "1px solid #f0ede5" }}>{NP.WBS[k]}</td>
                      <td style={{ padding: "6px 10px", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderBottom: "1px solid #f0ede5" }}>{desc}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, borderBottom: "1px solid #f0ede5" }}>{fMoney(e.o)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: TEAL, borderBottom: "1px solid #f0ede5" }}>{fMoney(e.d)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: st > 0 ? AMBER : "var(--mut)", fontWeight: st > 0 ? 700 : 500, borderBottom: "1px solid #f0ede5" }}>{fMoney(st)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: e.o > 0 && e.d / e.o < 0.5 ? RED : GREEN, fontWeight: 700, borderBottom: "1px solid #f0ede5" }}>{e.o > 0 ? `${((e.d / e.o) * 100).toFixed(1)}%` : "—"}</td>
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
