import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageBanner, BANNER_LBL, BANNER_CTL } from "../../components/layout/PageBanner";
import { showTip, hideTip } from "../../components/common/hoverTip";
import "../../components/inventory/smartworldInventory.css";
import raw from "../../data/cpAnalytics.json";

/** SAP Collections — collections view computed from the PDRN export
 * alone (no CRM shared-folder files). Active bookings only. Formulas
 * (per business, Oct 2026):
 *   TCV          = Total BSP Net Value (With Tax)
 *   Called       = Total Demand Amount (With Tax)
 *   Received     = Net Received Including Tax − Pending for Clearance
 *   Net Due      = Called − Received
 *   Future Dues  = TCV − Called
 */

/* ---------------- styles (house) ---------------- */
const GOLD = "#B8893C", GREEN = "#1BAF7A", RED = "#c0392b";
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #eae6da", borderRadius: 12, boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)", padding: "14px 16px", marginBottom: 14 };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 15.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 2px" };
const CAP: React.CSSProperties = { fontSize: 11, color: "var(--mut)", marginBottom: 10 };
const TH: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "8px 10px", borderBottom: "2px solid #eae6da", whiteSpace: "nowrap", textAlign: "left" };
const TD: React.CSSProperties = { padding: "6px 10px", borderBottom: "1px solid #f0ede5", whiteSpace: "nowrap" };
const RIGHT: React.CSSProperties = { ...TD, textAlign: "right" };
const GLASS = (c1: string, c2: string): React.CSSProperties => ({
  background: `linear-gradient(150deg, ${c1} 0%, ${c2} 100%)`,
  border: "1px solid rgba(255,255,255,.35)", borderRadius: 14,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), 0 10px 24px rgba(20,33,61,.28), 0 2px 6px rgba(20,33,61,.18)",
  padding: "14px 16px", color: "#fff", position: "relative", overflow: "hidden",
});
const fN = (n: number) => Math.round(n).toLocaleString("en-IN");
const fCr = (v: number) => `₹${(v / 1e7).toFixed(2)} Cr`;
const fMoney = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
};

/* ---------------- data ---------------- */
interface CpaFile { P: string[]; R: (number | string)[][]; meta: { asOn: string } }
const CD = raw as unknown as CpaFile;

interface Bk {
  proj: string; unit: string; name: string; y: number; m: number;
  tcv: number; called: number; rec: number; due: number; fut: number;
}
/** Active bookings with SAP-collection measures. Fields: see build_pdrn.py. */
const ROWS: Bk[] = CD.R.filter(r => r[13] === 0).map(r => {
  const tcv = (r[26] as number) ?? 0;
  const called = (r[22] as number) ?? 0;
  const rec = ((r[24] as number) ?? 0) - ((r[25] as number) ?? 0);
  return {
    proj: CD.P[r[0] as number], unit: String(r[9]), name: String(r[10]),
    y: r[7] as number, m: r[8] as number,
    tcv, called, rec, due: called - rec, fut: tcv - called,
  };
});
const PROJECTS = [...new Set(ROWS.map(b => b.proj))].sort((a, b) => a.localeCompare(b));

interface Agg { label: string; n: number; tcv: number; called: number; rec: number; due: number; fut: number }
const agg = (rows: Bk[], label: string): Agg => ({
  label, n: rows.length,
  tcv: rows.reduce((s, b) => s + b.tcv, 0),
  called: rows.reduce((s, b) => s + b.called, 0),
  rec: rows.reduce((s, b) => s + b.rec, 0),
  due: rows.reduce((s, b) => s + b.due, 0),
  fut: rows.reduce((s, b) => s + b.fut, 0),
});

/* ---------------- charts ----------------
 * Categorical palette: dataviz reference set (CVD-validated). */
const CHART_CAT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

interface Slice { label: string; value: number; onPick?: () => void }

/** TCV share donut — same motion behavior as the Home page card:
 * slices pop out and dim siblings on hover, center swaps to the
 * hovered project's value, spring-animated entry. */
function SapDonut({ slices, centerTop, centerSub }: { slices: { label: string; value: number; disp: string; onPick?: () => void }[]; centerTop: string; centerSub: string }) {
  const [hov, setHov] = useState<string | null>(null);
  const tot = slices.reduce((s, d) => s + d.value, 0) || 1;
  let cum = 0;
  const coords = (p: number) => [Math.cos(2 * Math.PI * p), Math.sin(2 * Math.PI * p)];
  const spring = { type: "spring" as const, stiffness: 300, damping: 20 };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, justifyContent: "center" }}>
      <div style={{ position: "relative", width: "min(270px, 76%)", aspectRatio: "1" }}>
        <motion.svg
          viewBox="-1.2 -1.2 2.4 2.4" style={{ width: "100%", height: "100%", overflow: "visible" }}
          initial={{ rotate: -180, scale: 0 }} animate={{ rotate: -90, scale: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
        >
          {slices.map((sl, i) => {
            const p0 = cum / tot, p1 = (cum + sl.value) / tot;
            cum += sl.value;
            const [x0, y0] = coords(p0), [x1, y1] = coords(p1);
            const large = sl.value / tot > 0.5 ? 1 : 0;
            const hovd = hov === sl.label, dim = hov !== null && !hovd;
            return (
              <motion.path
                key={sl.label}
                d={`M ${x0} ${y0} A 1 1 0 ${large} 1 ${x1} ${y1} L 0 0`}
                fill={CHART_CAT[i % CHART_CAT.length]} stroke="#fff" strokeWidth={0.03} strokeLinejoin="round"
                animate={{
                  translateX: hovd ? (x0 + x1) * 0.08 : 0, translateY: hovd ? (y0 + y1) * 0.08 : 0,
                  scale: hovd ? 1.05 : 1, opacity: dim ? 0.3 : 1,
                }}
                transition={spring}
                onMouseEnter={() => setHov(sl.label)} onMouseLeave={() => setHov(null)}
                onClick={sl.onPick}
                style={{ cursor: sl.onPick ? "pointer" : "default" }}
              />
            );
          })}
          <motion.circle cx={0} cy={0} r={0.56} fill="#fff" stroke="#eae6da" strokeWidth={0.015}
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, ...spring }} />
        </motion.svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <AnimatePresence mode="popLayout">
            <motion.div key={hov ?? "tot"} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
              transition={spring} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontFamily: "Georgia,serif", fontSize: hov ? 15 : 19, fontWeight: 700, color: "var(--ink)", textAlign: "center", lineHeight: 1.1 }}>
                {hov ? slices.find(d => d.label === hov)?.disp : centerTop}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--mut)", marginTop: 4, maxWidth: 130, textAlign: "center" }}>
                {hov ?? centerSub}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div style={{ width: "100%", marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        {slices.map((sl, i) => (
          <motion.div key={sl.label}
            onMouseEnter={() => setHov(sl.label)} onMouseLeave={() => setHov(null)}
            onClick={sl.onPick}
            animate={{ opacity: hov && hov !== sl.label ? 0.35 : 1, scale: hov === sl.label ? 1.03 : 1 }}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 7px", cursor: sl.onPick ? "pointer" : "default", borderRadius: 7, background: hov === sl.label ? "#faf8f2" : "transparent" }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: CHART_CAT[i % CHART_CAT.length], flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sl.label}</span>
            <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 11.5, color: "var(--mut)" }}>{((sl.value / tot) * 100).toFixed(1)}%</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function HBars({ data, fmt }: { data: Slice[]; fmt: (v: number) => string }) {
  const mx = Math.max(...data.map(d => d.value), 1);
  return (<>
    {data.map((d, i) => (
      <div key={d.label} onClick={d.onPick} style={{ padding: "4.5px 0", cursor: d.onPick ? "pointer" : "default" }}
        onMouseEnter={e => showTip(e, `<b>${d.label}</b><br/>${fmt(d.value)}${d.onPick ? "<br/>click → drill" : ""}`)} onMouseLeave={hideTip}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 120, fontSize: 11.5, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</div>
          <div style={{ flex: 1, height: 14, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(Math.max(d.value, 0) / mx) * 100}%`, background: CHART_CAT[i % CHART_CAT.length], borderRadius: "0 4px 4px 0", minWidth: 2 }} />
          </div>
          <div style={{ width: 84, textAlign: "right", fontSize: 11.5, fontWeight: 800, color: "var(--ink)" }}>{fmt(d.value)}</div>
        </div>
      </div>
    ))}
  </>);
}

/** Received vs Called — ONE bar per project: bar length = called /
 * demand (scaled to the largest project), green fill = the received
 * portion of it, navy remainder = net due still to collect. */
function PairBars({ rows }: { rows: Agg[] }) {
  const mx = Math.max(...rows.map(r => r.called), 1);
  return (<>
    <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--mut)", fontWeight: 700, marginBottom: 6 }}>
      <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: GREEN, marginRight: 5 }} />Received</span>
      <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#1c3f6e", marginRight: 5 }} />Still due (of called)</span>
    </div>
    {rows.map(r => {
      const recFrac = r.called > 0 ? Math.max(Math.min(r.rec / r.called, 1), 0) : 0;
      return (
        <div key={r.label} style={{ padding: "6px 0", borderBottom: "1px solid #f4f1e9" }}
          onMouseEnter={e => showTip(e, `<b>${r.label}</b><br/>Called ${fCr(r.called)}<br/>Received ${fCr(r.rec)} (${r.called > 0 ? ((r.rec / r.called) * 100).toFixed(1) : "—"}%)<br/>Net due ${fCr(r.due)}`)}
          onMouseLeave={hideTip}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink)" }}>
              {r.label} <span style={{ color: "var(--mut)", fontWeight: 600 }}>· {r.called > 0 ? ((r.rec / r.called) * 100).toFixed(1) : "—"}% collected</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--ink)", whiteSpace: "nowrap" }}>
              <span style={{ color: GREEN }}>{fCr(r.rec)}</span>
              <span style={{ color: "var(--mut)", fontWeight: 600 }}> / {fCr(r.called)}</span>
            </div>
          </div>
          <div style={{ height: 16, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(r.called / mx) * 100}%`, background: "#1c3f6e", borderRadius: "0 5px 5px 0", display: "flex", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${recFrac * 100}%`, background: GREEN }} />
            </div>
          </div>
        </div>
      );
    })}
  </>);
}

/* ---------------- drill drawer ---------------- */
function Drawer({ title, rows, onClose }: { title: string; rows: Bk[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const f = t ? rows.filter(b => b.unit.toLowerCase().includes(t) || b.name.toLowerCase().includes(t)) : rows;
    return [...f].sort((a, b) => b.due - a.due);
  }, [rows, q]);
  const a = agg(rows, title);
  const tile = (k: string, v: string, col = "var(--ink)") => (
    <div key={k} style={{ background: "#faf9f6", border: "1px solid #eee9dd", borderRadius: 10, padding: "8px 12px", minWidth: 100 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 16, fontWeight: 700, color: col, marginTop: 2 }}>{v}</div>
    </div>
  );
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(14,22,45,0.45)", zIndex: 220 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(760px, 96vw)", background: "#fdfcf9", zIndex: 221, boxShadow: "-18px 0 50px rgba(14,22,45,0.35)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #eae6da", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>{title}</div>
              <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 2 }}>{fN(rows.length)} active bookings · sorted by net due</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, color: "var(--mut)", cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {tile("TCV", fCr(a.tcv))}
            {tile("Called", fCr(a.called))}
            {tile("Received", fCr(a.rec), GREEN)}
            {tile("Net due", fCr(a.due), RED)}
            {tile("Future dues", fCr(a.fut), GOLD)}
          </div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search unit / customer…"
            style={{ marginTop: 10, width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd8ce", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr>
              <th style={TH}>Unit</th><th style={TH}>Customer</th>
              <th style={{ ...TH, textAlign: "right" }}>TCV</th>
              <th style={{ ...TH, textAlign: "right" }}>Called</th>
              <th style={{ ...TH, textAlign: "right" }}>Received</th>
              <th style={{ ...TH, textAlign: "right" }}>Net due</th>
            </tr></thead>
            <tbody>
              {list.slice(0, 400).map((b, i) => (
                <tr key={i} style={{ background: i % 2 ? "#faf9f6" : "#fff" }}>
                  <td style={{ ...TD, fontWeight: 700 }}>{b.unit}</td>
                  <td style={{ ...TD, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</td>
                  <td style={RIGHT}>{fMoney(b.tcv)}</td>
                  <td style={RIGHT}>{fMoney(b.called)}</td>
                  <td style={{ ...RIGHT, color: GREEN, fontWeight: 700 }}>{fMoney(b.rec)}</td>
                  <td style={{ ...RIGHT, color: b.due > 1000 ? RED : "var(--mut)", fontWeight: 800 }}>{fMoney(b.due)}</td>
                </tr>
              ))}
              {list.length > 400 && (
                <tr><td colSpan={6} style={{ ...TD, textAlign: "center", color: "var(--mut)" }}>
                  showing first 400 of {fN(list.length)} — narrow with search
                </td></tr>
              )}
              {list.length === 0 && (
                <tr><td colSpan={6} style={{ ...TD, textAlign: "center", color: "var(--mut)", padding: 24 }}>no match for "{q}"</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ---------------- page ---------------- */
export function SapCollectionsPage() {
  const [projF, setProjF] = useState("");
  const [q, setQ] = useState("");
  const [drill, setDrill] = useState<{ title: string; rows: Bk[] } | null>(null);

  const scope = useMemo(() => {
    let r = ROWS;
    if (projF) r = r.filter(b => b.proj === projF);
    const t = q.trim().toLowerCase();
    if (t) r = r.filter(b => b.unit.toLowerCase().includes(t) || b.name.toLowerCase().includes(t));
    return r;
  }, [projF, q]);

  const tot = useMemo(() => agg(scope, "Total"), [scope]);
  const byProj = useMemo(() => {
    const names = projF ? [projF] : PROJECTS;
    return names.map(p => agg(scope.filter(b => b.proj === p), p)).filter(a => a.n > 0);
  }, [scope, projF]);

  const kpi = (label: string, value: string, sub: string, g: [string, string]) => (
    <div key={label} style={{ ...GLASS(g[0], g[1]), flex: "1 1 150px", minWidth: 150 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", opacity: 0.85 }}>{label}</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 23, fontWeight: 700, margin: "4px 0 2px" }}>{value}</div>
      <div style={{ fontSize: 10.5, opacity: 0.85 }}>{sub}</div>
    </div>
  );

  const effPct = tot.called > 0 ? (tot.rec / tot.called) * 100 : 0;

  return (
    <div className="sw-inv" style={{ padding: "18px 22px" }}>
      <PageBanner
        title="SAP Collections"
        sub={<>{fN(ROWS.length)} active bookings · PDRN export · data as on {CD.meta.asOn} · Received = net received (incl. tax) − pending clearance</>}
      >
        <div>
          <div style={BANNER_LBL}>Project</div>
          <select value={projF} onChange={e => setProjF(e.target.value)} style={BANNER_CTL}>
            <option value="">All projects</option>
            {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <div style={BANNER_LBL}>Search</div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Unit / customer…" style={{ ...BANNER_CTL, width: 200 }} />
        </div>
        {(projF || q) && (
          <div style={{ alignSelf: "flex-end" }}>
            <button onClick={() => { setProjF(""); setQ(""); }} style={{ ...BANNER_CTL, cursor: "pointer" }}>⟲ Reset</button>
          </div>
        )}
      </PageBanner>

      {/* KPI strip */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        {kpi("TCV (with tax)", fCr(tot.tcv), "Total BSP net value with tax", ["#1E3163", "#2a4a8f"])}
        {kpi("Called / Demand", fCr(tot.called), `${tot.tcv > 0 ? ((tot.called / tot.tcv) * 100).toFixed(1) : 0}% of TCV demanded`, ["#14536e", "#1d7a9c"])}
        {kpi("Received", fCr(tot.rec), "net received − pending clearance", ["#14694f", "#1BAF7A"])}
        {kpi("Net Due", fCr(tot.due), "called − received", ["#8e2f23", "#c0533f"])}
        {kpi("Future Dues", fCr(tot.fut), "TCV − called (not yet demanded)", ["#8a6420", "#B8893C"])}
        {kpi("Collection", `${effPct.toFixed(1)}%`, "received ÷ called", ["#3d3566", "#5a4f94"])}
      </div>

      {/* Project summary */}
      <div style={CARD}>
        <div style={H3}>Project Summary</div>
        <div style={CAP}>per project · click a row to drill into its units · amounts in ₹ Cr</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr>
              <th style={TH}>Project</th>
              <th style={{ ...TH, textAlign: "right" }}>Bookings</th>
              <th style={{ ...TH, textAlign: "right" }}>TCV</th>
              <th style={{ ...TH, textAlign: "right" }}>Called / Demand</th>
              <th style={{ ...TH, textAlign: "right" }}>Received</th>
              <th style={{ ...TH, textAlign: "right" }}>Net Due</th>
              <th style={{ ...TH, textAlign: "right" }}>Future Dues</th>
              <th style={{ ...TH, textAlign: "right" }}>% Collected</th>
            </tr></thead>
            <tbody>
              {byProj.map((a, i) => (
                <tr key={a.label} onClick={() => setDrill({ title: a.label, rows: scope.filter(b => b.proj === a.label) })}
                  style={{ cursor: "pointer", background: i % 2 ? "#faf9f6" : "#fff" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f6f3ea"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 ? "#faf9f6" : "#fff"; }}>
                  <td style={{ ...TD, fontWeight: 700 }}>{a.label}</td>
                  <td style={RIGHT}>{fN(a.n)}</td>
                  <td style={RIGHT}>{(a.tcv / 1e7).toFixed(2)}</td>
                  <td style={RIGHT}>{(a.called / 1e7).toFixed(2)}</td>
                  <td style={{ ...RIGHT, color: GREEN, fontWeight: 700 }}>{(a.rec / 1e7).toFixed(2)}</td>
                  <td style={{ ...RIGHT, color: RED, fontWeight: 800 }}>{(a.due / 1e7).toFixed(2)}</td>
                  <td style={{ ...RIGHT, color: GOLD, fontWeight: 700 }}>{(a.fut / 1e7).toFixed(2)}</td>
                  <td style={{ ...RIGHT, fontWeight: 800 }}>{a.called > 0 ? ((a.rec / a.called) * 100).toFixed(1) : "—"}%</td>
                </tr>
              ))}
              <tr style={{ background: "#1E3163", color: "#fff" }}>
                <td style={{ ...TD, fontWeight: 800, color: "#fff", borderBottom: "none" }}>Grand Total</td>
                <td style={{ ...RIGHT, fontWeight: 800, color: "#fff", borderBottom: "none" }}>{fN(tot.n)}</td>
                <td style={{ ...RIGHT, fontWeight: 800, color: "#fff", borderBottom: "none" }}>{(tot.tcv / 1e7).toFixed(2)}</td>
                <td style={{ ...RIGHT, fontWeight: 800, color: "#fff", borderBottom: "none" }}>{(tot.called / 1e7).toFixed(2)}</td>
                <td style={{ ...RIGHT, fontWeight: 800, color: "#fff", borderBottom: "none" }}>{(tot.rec / 1e7).toFixed(2)}</td>
                <td style={{ ...RIGHT, fontWeight: 800, color: "#fff", borderBottom: "none" }}>{(tot.due / 1e7).toFixed(2)}</td>
                <td style={{ ...RIGHT, fontWeight: 800, color: "#fff", borderBottom: "none" }}>{(tot.fut / 1e7).toFixed(2)}</td>
                <td style={{ ...RIGHT, fontWeight: 800, color: "#fff", borderBottom: "none" }}>{tot.called > 0 ? ((tot.rec / tot.called) * 100).toFixed(1) : "—"}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 14 }}>
        <div style={CARD}>
          <div style={H3}>Received vs Called</div>
          <div style={CAP}>per project · hover for exact amounts</div>
          <PairBars rows={byProj} />
        </div>
        <div style={CARD}>
          <div style={H3}>TCV Share</div>
          <div style={CAP}>each project's share of total consideration value</div>
          <SapDonut
            slices={byProj.map(a => ({ label: a.label, value: a.tcv, disp: fCr(a.tcv), onPick: () => setDrill({ title: a.label, rows: scope.filter(b => b.proj === a.label) }) }))}
            centerTop={fCr(tot.tcv)} centerSub="total" />
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 14 }}>
        <div style={CARD}>
          <div style={H3}>Net Due by Project</div>
          <div style={CAP}>called − received · click a bar to drill</div>
          <HBars data={[...byProj].sort((a, b) => b.due - a.due).map(a => ({ label: a.label, value: a.due, onPick: () => setDrill({ title: a.label, rows: scope.filter(b => b.proj === a.label) }) }))} fmt={fCr} />
        </div>
        <div style={CARD}>
          <div style={H3}>Future Dues by Project</div>
          <div style={CAP}>TCV − called · demands still to be raised</div>
          <HBars data={[...byProj].sort((a, b) => b.fut - a.fut).map(a => ({ label: a.label, value: a.fut, onPick: () => setDrill({ title: a.label, rows: scope.filter(b => b.proj === a.label) }) }))} fmt={fCr} />
        </div>
      </div>

      {drill && <Drawer title={drill.title} rows={drill.rows} onClose={() => setDrill(null)} />}
    </div>
  );
}
