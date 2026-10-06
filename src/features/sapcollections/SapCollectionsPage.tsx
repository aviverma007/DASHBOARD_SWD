import { useMemo, useState } from "react";
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
function Donut({ data, fmt, center, size = 164 }: { data: Slice[]; fmt: (v: number) => string; center?: string; size?: number }) {
  const tot = data.reduce((s, d) => s + d.value, 0);
  if (tot <= 0) return <div style={{ color: "var(--mut)", fontSize: 12, padding: 20 }}>no data for this selection</div>;
  const C = size / 2, R = C - 16, W = Math.round(size * 0.19);
  let a0 = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const frac = d.value / tot;
    const a1 = a0 + frac * Math.PI * 2;
    const pad = Math.min(0.028, (a1 - a0) * 0.25);
    const s0 = a0 + pad / 2, s1 = Math.max(a1 - pad / 2, s0 + 0.004);
    const p = (a: number, r: number) => [C + r * Math.cos(a), C + r * Math.sin(a)];
    const [x0, y0] = p(s0, R), [x1, y1] = p(s1, R), [x2, y2] = p(s1, R - W), [x3, y3] = p(s0, R - W);
    const lg = s1 - s0 > Math.PI ? 1 : 0;
    const dPath = `M${x0},${y0} A${R},${R} 0 ${lg} 1 ${x1},${y1} L${x2},${y2} A${R - W},${R - W} 0 ${lg} 0 ${x3},${y3} Z`;
    const mid = (s0 + s1) / 2;
    a0 = a1;
    return { d, i, dPath, frac, mid };
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", flex: 1, justifyContent: "center" }}>
      <svg width={C * 2} height={C * 2} style={{ flexShrink: 0 }}>
        {arcs.map(a => (
          <path key={a.i} d={a.dPath} fill={CHART_CAT[a.i % CHART_CAT.length]}
            style={{ cursor: a.d.onPick ? "pointer" : "default" }} onClick={a.d.onPick}
            onMouseEnter={e => showTip(e, `<b>${a.d.label}</b><br/>${fmt(a.d.value)} · ${(a.frac * 100).toFixed(1)}%${a.d.onPick ? "<br/>click → drill" : ""}`)}
            onMouseLeave={hideTip} />
        ))}
        {arcs.filter(a => a.frac >= 0.055).map(a => (
          <text key={"t" + a.i} x={C + (R - W / 2) * Math.cos(a.mid)} y={C + (R - W / 2) * Math.sin(a.mid)}
            textAnchor="middle" dominantBaseline="central" fontSize={Math.max(10, size * 0.052)} fontWeight={800} fill="#fff" pointerEvents="none">
            {(a.frac * 100).toFixed(0)}%
          </text>
        ))}
        {center && <text x={C} y={C} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(12, size * 0.068)} fontWeight={800} fill="var(--ink)" fontFamily="Georgia,serif">{center}</text>}
      </svg>
      <div style={{ flex: 1, minWidth: 190, display: "flex", flexDirection: "column", justifyContent: "center", alignSelf: "stretch" }}>
        {data.map((d, i) => (
          <div key={d.label} onClick={d.onPick}
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 6px", fontSize: 12, cursor: d.onPick ? "pointer" : "default", borderRadius: 6, borderBottom: i < data.length - 1 ? "1px solid #f4f1e9" : "none" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: CHART_CAT[i % CHART_CAT.length], flexShrink: 0 }} />
            <span style={{ flex: 1, color: "var(--ink)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
            <span style={{ color: "var(--mut)", fontWeight: 600, width: 40, textAlign: "right" }}>{((d.value / tot) * 100).toFixed(1)}%</span>
            <span style={{ color: "var(--ink)", fontWeight: 800, width: 88, textAlign: "right" }}>{fmt(d.value)}</span>
          </div>
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

/** Received vs Called — paired horizontal bars per project. */
function PairBars({ rows }: { rows: Agg[] }) {
  const mx = Math.max(...rows.map(r => Math.max(r.called, r.rec)), 1);
  const bar = (v: number, color: string, lbl: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}
      onMouseEnter={e => showTip(e, `<b>${lbl}</b><br/>${fCr(v)}`)} onMouseLeave={hideTip}>
      <div style={{ flex: 1, height: 11, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(Math.max(v, 0) / mx) * 100}%`, background: color, borderRadius: "0 4px 4px 0", minWidth: 2 }} />
      </div>
      <div style={{ width: 86, textAlign: "right", fontSize: 11, fontWeight: 800, color: "var(--ink)" }}>{fCr(v)}</div>
    </div>
  );
  return (<>
    <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--mut)", fontWeight: 700, marginBottom: 6 }}>
      <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#1c3f6e", marginRight: 5 }} />Called / demand</span>
      <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: GREEN, marginRight: 5 }} />Received</span>
    </div>
    {rows.map(r => (
      <div key={r.label} style={{ padding: "5px 0", borderBottom: "1px solid #f4f1e9" }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>
          {r.label} <span style={{ color: "var(--mut)", fontWeight: 600 }}>· {r.called > 0 ? ((r.rec / r.called) * 100).toFixed(1) : "—"}% collected</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {bar(r.called, "#1c3f6e", `${r.label} — called`)}
          {bar(r.rec, GREEN, `${r.label} — received`)}
        </div>
      </div>
    ))}
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
  const topDue = useMemo(() => [...scope].sort((a, b) => b.due - a.due).slice(0, 15), [scope]);

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
          <Donut data={byProj.map(a => ({ label: a.label, value: a.tcv, onPick: () => setDrill({ title: a.label, rows: scope.filter(b => b.proj === a.label) }) }))}
            fmt={fCr} center={fCr(tot.tcv)} />
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

      {/* Top outstanding */}
      <div style={CARD}>
        <div style={H3}>Top Outstanding Units</div>
        <div style={CAP}>15 largest net dues in the current selection</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr>
              <th style={TH}>Unit</th><th style={TH}>Customer</th><th style={TH}>Project</th>
              <th style={{ ...TH, textAlign: "right" }}>TCV</th>
              <th style={{ ...TH, textAlign: "right" }}>Called</th>
              <th style={{ ...TH, textAlign: "right" }}>Received</th>
              <th style={{ ...TH, textAlign: "right" }}>Net Due</th>
            </tr></thead>
            <tbody>
              {topDue.map((b, i) => (
                <tr key={i} style={{ background: i % 2 ? "#faf9f6" : "#fff" }}>
                  <td style={{ ...TD, fontWeight: 700 }}>{b.unit}</td>
                  <td style={{ ...TD, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</td>
                  <td style={TD}>{b.proj}</td>
                  <td style={RIGHT}>{fMoney(b.tcv)}</td>
                  <td style={RIGHT}>{fMoney(b.called)}</td>
                  <td style={{ ...RIGHT, color: GREEN, fontWeight: 700 }}>{fMoney(b.rec)}</td>
                  <td style={{ ...RIGHT, color: RED, fontWeight: 800 }}>{fMoney(b.due)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drill && <Drawer title={drill.title} rows={drill.rows} onClose={() => setDrill(null)} />}
    </div>
  );
}
