import { useEffect, useMemo, useRef, useState } from "react";
import { PageBanner, BannerPills, BANNER_LBL, BANNER_CTL } from "../../components/layout/PageBanner";
import { Zoomable } from "../../components/common/Zoomable";
import { showTip, hideTip } from "../../components/common/hoverTip";
import "../../components/inventory/smartworldInventory.css";

/** Collection dashboard — live from the CRM team's three Excel files
 * in the shared folder, served by /collections/data on the VendorGlobe
 * API. The team saves the Excel → the dashboard shows it on the next
 * load; "data as on" = each file's save time. Sources:
 *   PTP.xlsx                  → per-unit ledger (TCV/Demanded/Recd/Due, RM, PTP)
 *   Daily Collection Report   → receipts per project
 *   Collection Master (PDC)   → post-dated cheques in hand */

const API_BASE = "http://192.168.66.28:5002";

/* ---------------- styles ---------------- */
const GOLD = "#B8893C", GREEN = "#1BAF7A", RED = "#c0392b", NAVY = "#1c3f6e";
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #eae6da", borderRadius: 12, boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)", padding: "14px 16px", marginBottom: 14 };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 15.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 2px" };
const CAP: React.CSSProperties = { fontSize: 11, color: "var(--mut)", marginBottom: 10 };
const TH: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "8px 10px", borderBottom: "2px solid #eae6da", whiteSpace: "nowrap", textAlign: "left" };
const TD: React.CSSProperties = { padding: "6px 10px", borderBottom: "1px solid #f0ede5", whiteSpace: "nowrap" };
const GLASS = (c1: string, c2: string): React.CSSProperties => ({
  background: `linear-gradient(150deg, ${c1} 0%, ${c2} 100%)`,
  border: "1px solid rgba(255,255,255,.35)", borderRadius: 14,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), 0 10px 24px rgba(20,33,61,.28), 0 2px 6px rgba(20,33,61,.18)",
  padding: "14px 16px", color: "#fff", position: "relative", overflow: "hidden",
});
const fN = (n: number) => Math.round(n).toLocaleString("en-IN");
const fMoney = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
};
const fD = (iso: string | null) => !iso ? "—" : new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" });
const TODAY = new Date().toISOString().slice(0, 10);

/* ---------------- data types ---------------- */
interface Led {
  proj: string; phase: string | null; reg: string; unit: string | null; allot: string | null;
  name: string | null; profile: string | null; allotDate: string | null; unitType: string | null;
  plan: string | null; planType: string | null; broker: string | null; area: number; rate: number;
  tcv: number; dem: number; rec: number; due: number; recPct: number;
  letter: string | null; letterDate: string | null; letterDue: string | null;
  rm: string | null; rmFinal: string | null; remarks: string | null; rmStatus: string | null;
  funding: string | null; bank: string | null; sanctDate: string | null; sanctAmt: number;
  bba: string | null; bbaDate: string | null; possession: string | null;
  statusV: string | null; benefit: number;
}
interface Tgt { rm: string; proj: string; tgt: number; recd: number }
interface Rcpt { proj: string; reg: string | null; name: string | null; unit: string | null; amt: number; mode: string | null; chq: string | null; bank: string | null; rcptDate: string | null; chqDate: string | null; clearDate: string | null; created: string | null; rm: string | null; milestone: string | null; dueDate: string | null }
interface Allot { label: string; done: number; pending: number; total: number; tcv: number; called: number; recd: number; due: number; fut: number; kind: "proj" | "phase" | "total"; proj: string | null }

function unpack<T>(p: { cols: string[]; rows: unknown[][] }): T[] {
  return p.rows.map(r => Object.fromEntries(p.cols.map((c, i) => [c, r[i]])) as T);
}

/* ---------------- drill drawer ---------------- */
type Drill =
  | { kind: "custs"; title: string; sub?: string; rows: Led[] }
  | { kind: "rcpts"; title: string; sub?: string; rows: Rcpt[] };

function ColDrawer({ sel, receipts, onClose }: { sel: Drill | null; receipts: Rcpt[]; onClose: () => void }) {
  const [cust, setCust] = useState<Led | null>(null);
  if (!sel) return null;
  const tile = (k: string, v: string, col = "var(--ink)") => (
    <div key={k} style={{ background: "#faf9f6", border: "1px solid #eee9dd", borderRadius: 10, padding: "8px 12px", minWidth: 105 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: col, marginTop: 2 }}>{v}</div>
    </div>
  );
  const myRcpts = cust ? receipts.filter(r => r.reg === cust.reg) : [];
  return (
    <>
      <div onClick={() => { setCust(null); onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(14,22,45,0.45)", zIndex: 220 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(720px, 96vw)", background: "#fdfcf9", zIndex: 221, boxShadow: "-18px 0 50px rgba(14,22,45,0.35)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #eae6da", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
                {cust ? <><span onClick={() => setCust(null)} style={{ color: GOLD, cursor: "pointer" }}>‹ {sel.title}</span> · {cust.name || cust.reg}</> : sel.title}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 2 }}>{cust ? `${cust.unit ?? ""} · ${cust.proj}` : sel.sub ?? `${fN(sel.rows.length)} rows`}</div>
            </div>
            <button onClick={() => { setCust(null); onClose(); }} style={{ background: "none", border: "none", fontSize: 24, color: "var(--mut)", cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>
          {!cust && sel.kind === "custs" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {tile("Customers", fN(sel.rows.length))}
              {tile("Net due", fMoney(sel.rows.reduce((s, l) => s + Math.max(l.due, 0), 0)), RED)}
              {tile("Received", fMoney(sel.rows.reduce((s, l) => s + l.rec, 0)), GREEN)}
            </div>
          )}
          {!cust && sel.kind === "rcpts" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {tile("Receipts", fN(sel.rows.length))}
              {tile("Amount", fMoney(sel.rows.reduce((s, r) => s + r.amt, 0)), GREEN)}
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {cust ? (
            <>
              <div style={{ ...CARD, marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "6px 10px", fontSize: 12.5 }}>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>Customer</div><div style={{ fontWeight: 700 }}>{cust.name || "—"} <span style={{ color: "var(--mut)", fontWeight: 400 }}>· {cust.reg}</span></div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>Unit</div><div>{cust.unit || "—"} · {cust.unitType || "—"} · {cust.proj}{cust.phase ? ` (${cust.phase})` : ""}</div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>Allotment</div><div>{cust.allot || "—"} · {fD(cust.allotDate)}</div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>Payment plan</div><div>{cust.plan || "—"}{cust.planType ? ` · ${cust.planType}` : ""}</div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>TCV / Demanded</div><div>{fMoney(cust.tcv)} · {fMoney(cust.dem)} demanded</div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>Received</div>
                  <div>
                    <b style={{ color: GREEN }}>{fMoney(cust.rec)}</b> <span style={{ color: "var(--mut)" }}>({cust.dem ? ((cust.rec / cust.dem) * 100).toFixed(0) : 0}% of demanded)</span>
                    <div style={{ height: 8, background: "#f0ede5", borderRadius: 4, overflow: "hidden", marginTop: 4, maxWidth: 260 }}>
                      <div style={{ height: "100%", width: `${Math.min(cust.dem ? (cust.rec / cust.dem) * 100 : 0, 100)}%`, background: GREEN }} />
                    </div>
                  </div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>Net due</div><div style={{ color: cust.due > 1000 ? RED : "var(--mut)", fontWeight: 800 }}>{fMoney(cust.due)}</div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>Funding</div><div>{cust.funding || "—"}{cust.bank ? ` · ${cust.bank}` : ""}{cust.sanctAmt > 0 ? ` · sanctioned ${fMoney(cust.sanctAmt)}` : ""}</div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>Last letter</div><div>{cust.letter || "—"}{cust.letterDate ? ` · ${fD(cust.letterDate)}` : ""}{cust.letterDue ? ` · due ${fD(cust.letterDue)}` : ""}</div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>RM</div><div>{cust.rm || "—"}{cust.rmStatus ? ` · ${cust.rmStatus}` : ""}</div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>BBA</div><div>{cust.bba || "—"}{cust.bbaDate ? ` · ${fD(cust.bbaDate)}` : ""}</div>
                  {cust.remarks && <><div style={{ color: "var(--mut)", fontWeight: 700 }}>Remarks</div><div style={{ whiteSpace: "normal" }}>{cust.remarks}</div></>}
                </div>
              </div>
              {myRcpts.length > 0 && (
                <div style={{ ...CARD, marginBottom: 12 }}>
                  <h3 style={H3}>Receipts this month</h3>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 6 }}>
                    <thead><tr><th style={TH}>Date</th><th style={TH}>Mode</th><th style={TH}>Bank</th><th style={{ ...TH, textAlign: "right" }}>Amount</th></tr></thead>
                    <tbody>{myRcpts.map((r, i) => (
                      <tr key={i}><td style={TD}>{fD(r.rcptDate)}</td><td style={TD}>{r.mode || "—"}</td><td style={{ ...TD, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{r.bank || "—"}</td><td style={{ ...TD, textAlign: "right", fontWeight: 700, color: GREEN }}>{fMoney(r.amt)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </>
          ) : sel.kind === "custs" ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                <th style={TH}>Customer</th><th style={TH}>Project</th><th style={TH}>RM</th>
                <th style={{ ...TH, textAlign: "right" }}>Net due</th><th style={{ ...TH, textAlign: "right" }}>Recd %</th><th style={TH}>Status</th>
              </tr></thead>
              <tbody>
                {sel.rows.slice(0, 400).map((l, i) => (
                  <tr key={i} onClick={() => setCust(l)} style={{ cursor: "pointer" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                    <td style={{ ...TD, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ fontWeight: 800, color: "var(--ink)" }}>{l.name || l.reg}</span>
                      <span style={{ color: "var(--mut)", marginLeft: 6, fontSize: 10.5 }}>{l.unit}</span>
                    </td>
                    <td style={{ ...TD, color: "var(--mut)" }}>{l.proj}</td>
                    <td style={{ ...TD, color: "var(--mut)", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis" }}>{l.rm || "—"}</td>
                    <td style={{ ...TD, textAlign: "right", fontWeight: 800, color: l.due > 1000 ? RED : "var(--mut)" }}>{fMoney(l.due)}</td>
                    <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: GREEN }}>{l.dem ? ((l.rec / l.dem) * 100).toFixed(0) : 0}%</td>
                    <td style={{ ...TD, color: "var(--mut)", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" }}>{l.rmStatus || "—"}</td>
                  </tr>
                ))}
                {sel.rows.length > 400 && <tr><td colSpan={6} style={{ ...TD, textAlign: "center", color: "var(--mut)" }}>showing first 400 of {fN(sel.rows.length)} — narrow with filters</td></tr>}
              </tbody>
            </table>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                <th style={TH}>Date</th><th style={TH}>Customer</th><th style={TH}>Project</th><th style={TH}>Mode</th><th style={{ ...TH, textAlign: "right" }}>Amount</th>
              </tr></thead>
              <tbody>
                {sel.rows.slice(0, 400).map((r, i) => (
                  <tr key={i}>
                    <td style={TD}>{fD(r.rcptDate)}</td>
                    <td style={{ ...TD, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", fontWeight: 700, color: "var(--ink)" }}>{r.name || r.reg || "—"} <span style={{ color: "var(--mut)", fontWeight: 400, fontSize: 10.5 }}>{r.unit}</span></td>
                    <td style={{ ...TD, color: "var(--mut)" }}>{r.proj}</td>
                    <td style={TD}>{r.mode || "—"}</td>
                    <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: GREEN }}>{fMoney(r.amt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------------- project multi-select ---------------- */
function ProjSelect({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (s: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = (n: string) => {
    const next = selected.includes(n) ? selected.filter(x => x !== n) : [...selected, n];
    onChange(next.length === options.length ? [] : next);
  };
  const label = selected.length === 0 ? "All projects" : selected.length === 1 ? selected[0] : `${selected.length} projects`;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={BANNER_LBL}>Project</label>
      <button type="button" onClick={() => setOpen(v => !v)} style={{ ...BANNER_CTL, minWidth: 170, textAlign: "left" }}>
        {label} <span style={{ color: "var(--mut)", marginLeft: 6, fontSize: 9 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60, background: "#fff", border: "1px solid var(--line)", borderRadius: 9, boxShadow: "0 12px 34px rgba(20,33,61,.2)", padding: 8, minWidth: 240, maxHeight: 340, overflowY: "auto" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderBottom: "1px solid var(--line)", marginBottom: 5, paddingBottom: 10, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            <input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])} style={{ accentColor: "#B8893C", width: 15, height: 15 }} />
            All projects
          </label>
          {options.map(n => (
            <label key={n} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={selected.includes(n)} onChange={() => toggle(n)} style={{ accentColor: "#B8893C", width: 15, height: 15 }} />
              {n}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}


/* ---------------- charts ----------------
 * Categorical palette: the dataviz reference set, validated for CVD
 * separation & normal-vision floors (adjacent pairs); low-contrast
 * slots get relief via direct labels + the tables alongside. */
const CHART_CAT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

interface Slice { label: string; value: number; onPick?: () => void }
function Donut({ data, total, fmt, center, size = 156 }: { data: Slice[]; total?: number; fmt: (v: number) => string; center?: string; size?: number }) {
  const tot = total ?? data.reduce((s, d) => s + d.value, 0);
  if (tot <= 0) return <div style={{ color: "var(--mut)", fontSize: 12, padding: 20 }}>no data for this selection</div>;
  const C = size / 2, R = C - 16, W = Math.round(size * 0.19);
  let a0 = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const frac = d.value / tot;
    const a1 = a0 + frac * Math.PI * 2;
    const pad = Math.min(0.028, (a1 - a0) * 0.25);           // ~2px surface gap
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
            style={{ cursor: a.d.onPick ? "pointer" : "default" }}
            onClick={a.d.onPick}
            onMouseEnter={e => showTip(e, `<b>${a.d.label}</b><br/>${fmt(a.d.value)} · ${(a.frac * 100).toFixed(1)}%${a.d.onPick ? "<br/>click → list" : ""}`)}
            onMouseLeave={hideTip} />
        ))}
        {arcs.filter(a => a.frac >= 0.055).map(a => (
          <text key={"t" + a.i} x={C + (R - W / 2) * Math.cos(a.mid)} y={C + (R - W / 2) * Math.sin(a.mid)}
            textAnchor="middle" dominantBaseline="central" fontSize={Math.max(10, size * 0.052)} fontWeight={800} fill="#fff" pointerEvents="none">
            {(a.frac * 100).toFixed(0)}%
          </text>
        ))}
        {center && <text x={C} y={C} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(13, size * 0.075)} fontWeight={800} fill="var(--ink)" fontFamily="Georgia,serif">{center}</text>}
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

function CumLine({ days, month }: { days: [string, number][]; month: string }) {
  if (!days.length) return <div style={{ color: "var(--mut)", fontSize: 12, padding: 20 }}>no receipts yet</div>;
  const Wd = 560, Hd = 170, PL = 46, PB = 20, PT = 12;
  let run = 0;
  const pts = days.map(([k, v]) => { run += v; return { k, v, cum: run }; });
  const mx = run || 1;
  const X = (i: number) => PL + (i / Math.max(pts.length - 1, 1)) * (Wd - PL - 8);
  const Y = (v: number) => PT + (1 - v / mx) * (Hd - PT - PB);
  const line = pts.map((pt, i) => `${X(i)},${Y(pt.cum)}`).join(" ");
  const area = `${PL},${Hd - PB} ${line} ${X(pts.length - 1)},${Hd - PB}`;
  const gridVals = [0.25, 0.5, 0.75, 1].map(f => mx * f);
  return (
    <svg viewBox={`0 0 ${Wd} ${Hd}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {gridVals.map((gv, i) => (
        <g key={i}>
          <line x1={PL} x2={Wd - 8} y1={Y(gv)} y2={Y(gv)} stroke="#eee9dd" strokeWidth={1} />
          <text x={PL - 5} y={Y(gv)} textAnchor="end" dominantBaseline="central" fontSize={9} fill="var(--mut)">{(gv / 1e7).toFixed(0)}</text>
        </g>
      ))}
      <polygon points={area} fill="#2a78d6" opacity={0.12} />
      <polyline points={line} fill="none" stroke="#2a78d6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((pt, i) => (
        <g key={pt.k}>
          <circle cx={X(i)} cy={Y(pt.cum)} r={3} fill="#2a78d6" stroke="#fff" strokeWidth={2} pointerEvents="none" />
          <rect x={X(i) - 9} y={PT} width={18} height={Hd - PT - PB} fill="transparent"
            onMouseEnter={e => showTip(e, `<b>${fD(pt.k)}</b><br/>day ${fMoney(pt.v)}<br/>month so far ${fMoney(pt.cum)}`)} onMouseLeave={hideTip} />
          {(i % Math.ceil(pts.length / 10) === 0 || i === pts.length - 1) &&
            <text x={X(i)} y={Hd - 6} textAnchor="middle" fontSize={9} fill="var(--mut)">{pt.k.slice(8)}</text>}
        </g>
      ))}
      <text x={PL} y={PT - 2} fontSize={9} fill="var(--mut)">₹ Cr cumulative · {month}</text>
    </svg>
  );
}

function HBars({ data, fmt }: { data: Slice[]; fmt: (v: number) => string }) {
  const mx = Math.max(...data.map(d => d.value), 1);
  return (<>
    {data.map((d, i) => (
      <div key={d.label} onClick={d.onPick} className="barrow" style={{ padding: "4.5px 0", cursor: d.onPick ? "pointer" : "default" }}
        onMouseEnter={e => showTip(e, `<b>${d.label}</b><br/>${fmt(d.value)}${d.onPick ? "<br/>click → list" : ""}`)} onMouseLeave={hideTip}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 110, fontSize: 11.5, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</div>
          <div style={{ flex: 1, height: 14, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(d.value / mx) * 100}%`, background: CHART_CAT[i % CHART_CAT.length], borderRadius: "0 4px 4px 0", minWidth: 2 }} />
          </div>
          <div style={{ width: 78, textAlign: "right", fontSize: 11.5, fontWeight: 800, color: "var(--ink)" }}>{fmt(d.value)}</div>
        </div>
      </div>
    ))}
  </>);
}

const _npj = (x: string) => x.toUpperCase().split(/\s+/).join(" ").replace(/ - | -|- /g, "-");

/* ---------------- page ---------------- */
type View = "master" | "daily";

export default function CollectionPage() {
  const [raw, setRaw] = useState<{ asOf: Record<string, string | null>; errors: string[]; ledger: Led[]; receipts: Rcpt[]; allot: Allot[]; targets: Tgt[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setViewRaw] = useState<View>("master");
  const [projF, setProjF] = useState<string[]>([]);
  const [rmF, setRmF] = useState("");
  const [q, setQ] = useState("");
  /* The two files have their own project & RM vocabularies, so switching
   * the view clears the filters instead of carrying mismatched names over. */
  const setView = (v: View) => { setViewRaw(v); setProjF([]); setRmF(""); setQ(""); };
  const [sugOpen, setSugOpen] = useState(false);
  const [drill, setDrill] = useState<Drill | null>(null);
  /* User-arranged project order for the Project Summary (▲▼ buttons);
   * saved in this browser, new projects append at their default spot. */
  const [projOrder, setProjOrder] = useState<string[]>(() => {
    try { const v = JSON.parse(localStorage.getItem("colProjOrder") || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
  });
  const saveProjOrder = (arr: string[]) => {
    setProjOrder(arr);
    try { localStorage.setItem("colProjOrder", JSON.stringify(arr)); } catch { /* private mode */ }
  };

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/collections/data`)
      .then(r => r.json())
      .then(j => {
        if (!alive) return;
        if (!j.ok) throw new Error(j.error || "backend error");
        setRaw({ asOf: j.asOf, errors: j.errors || [], ledger: unpack<Led>(j.ledger), receipts: unpack<Rcpt>(j.receipts), allot: j.allot ? unpack<Allot>(j.allot) : [], targets: j.targets ? unpack<Tgt>(j.targets) : [] });
        setLoading(false);
      })
      .catch(e => { if (alive) { setError(String(e.message || e)); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const ledger = raw?.ledger ?? [], receipts = raw?.receipts ?? [], allotAll = raw?.allot ?? [], targets = raw?.targets ?? [];
  /* Each toggle gets its own file's project list — no mixing */
  const projOpts = useMemo(() =>
    view === "master"
      ? [...new Set(ledger.map(l => l.proj))].filter(Boolean).sort()
      : [...new Set([...receipts.map(r => r.proj), ...targets.map(t => t.proj)])].filter(Boolean).sort(),
    [view, ledger, receipts, targets]);
  const rmOpts = useMemo(() =>
    view === "master"
      ? [...new Set(ledger.map(l => l.rm).filter((x): x is string => !!x))].sort()
      : [...new Set(targets.map(t => t.rm))].sort(),
    [view, ledger, targets]);

  /* Search suggestions: customers, reg nos, units and banks that contain
   * the typed text, respecting the project filter. Picking one fills the
   * search box with the exact term. */
  const sugs = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const base = view === "master" ? ledger : receipts.map(r => ({ name: r.name, reg: r.reg, unit: r.unit, proj: r.proj, bank: r.bank }));
    const pool = projF.length ? base.filter(l => projF.includes(l.proj)) : base;
    const out: { label: string; sub: string; term: string }[] = [];
    const seen = new Set<string>();
    for (const l of pool) {
      if (out.length >= 8) break;
      const hitName = (l.name || "").toLowerCase().includes(t);
      const hitReg = (l.reg || "").toLowerCase().includes(t);
      const hitUnit = (l.unit || "").toLowerCase().includes(t);
      if ((hitName || hitReg || hitUnit) && l.reg && !seen.has(l.reg)) {
        seen.add(l.reg);
        out.push({ label: l.name || l.reg!, sub: `${l.reg} · ${l.unit || "—"} · ${l.proj}`, term: l.reg! });
      }
    }
    if (out.length < 8) {
      const banks = new Set<string>();
      for (const l of pool) { if ((l.bank || "").toLowerCase().includes(t)) banks.add(l.bank!); }
      for (const b of [...banks].sort().slice(0, 8 - out.length)) out.push({ label: b, sub: "bank", term: b });
    }
    return out;
  }, [q, ledger, receipts, view, projF]);

  const match = (proj: string, texts: (string | null)[]) => {
    if (projF.length && !projF.includes(proj)) return false;
    const s = q.trim().toLowerCase();
    if (s && !texts.some(t => (t || "").toLowerCase().includes(s))) return false;
    return true;
  };
  const led = useMemo(() => ledger.filter(l => match(l.proj, [l.reg, l.name, l.unit, l.rm, l.bank]) && (!rmF || l.rm === rmF)), [ledger, projF, rmF, q]);
  const rmHit = (rrm: string | null) => !rmF || (rrm || "").toLowerCase().includes(rmF.split("/")[0].toLowerCase().trim());
  const rcp = useMemo(() => receipts.filter(r => match(r.proj, [r.reg, r.name, r.unit, r.rm, r.bank]) && rmHit(r.rm)), [receipts, projF, rmF, q]);
  /* Targets filtered by the daily view's project & RM selection */
  const tgts = useMemo(() => targets.filter(t => (!projF.length || projF.includes(t.proj)) && (!rmF || t.rm === rmF)), [targets, projF, rmF]);
  /* Allotment pivot rows, respecting the project filter */
  const allot = useMemo(() => {
    const rows = allotAll.filter(a => a.kind !== "total" && (!projF.length || (a.proj && projF.includes(a.proj))));
    return rows;
  }, [allotAll, projF]);

  const open = (d: Drill) => setDrill(d);
  const openCusts = (title: string, rows: Led[], sub?: string) =>
    open({ kind: "custs", title, sub, rows: [...rows].sort((a, b) => b.due - a.due) });

  /* ---- derived ---- */
  const withDue = led.filter(l => l.due > 1000);
  // sum ALL rows (credits net off) so the figure equals the sheet's Grand Total
  const totDue = led.reduce((s, l) => s + l.due, 0);
  const totDem = led.reduce((s, l) => s + l.dem, 0);
  const totRec = led.reduce((s, l) => s + l.rec, 0);
  const monthKey = useMemo(() => {
    const ds = rcp.map(r => r.rcptDate).filter((x): x is string => !!x).sort();
    return ds.length ? ds[ds.length - 1].slice(0, 7) : TODAY.slice(0, 7);
  }, [rcp]);
  const mtd = rcp.filter(r => (r.rcptDate || "").startsWith(monthKey));
  const mtdAmt = mtd.reduce((s, r) => s + r.amt, 0);

  type Kpi = [string, string, string, [string, string], () => void];
  const futDue = led.reduce((s, l) => s + Math.max(l.tcv - l.dem, 0), 0);
  const KPIS_M: Kpi[] = [
    ["Net dues outstanding", fMoney(totDue), `${fN(withDue.length)} units with dues`, ["#c0392b", "#7e1f14"], () => openCusts("Units with net dues", withDue)],
    ["Recovery", `${totDem ? ((totRec / totDem) * 100).toFixed(1) : 0}%`, `${fMoney(totRec)} received of ${fMoney(totDem)} demanded`, ["#1e9a6c", "#0f6647"], () => openCusts("All customers", led)],
    ["Future dues", fMoney(futDue), "TCV not yet demanded", [NAVY, "#0f2547"], () => openCusts("Units with future dues", led.filter(l => l.tcv - l.dem > 1000))],
    ["Allotment pending", fN(allot.filter(a => a.kind === "proj").reduce((s, a) => s + a.pending, 0)), `of ${fN(allot.filter(a => a.kind === "proj").reduce((s, a) => s + a.total, 0))} total units`, ["#1a7f9c", "#0e5468"], () => {}],
  ];
  const dayTotals = useMemo(() => {
    const m = new Map<string, number>();
    mtd.forEach(r => m.set(r.rcptDate!, (m.get(r.rcptDate!) || 0) + r.amt));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [mtd]);
  const bestDay = dayTotals.reduce<[string, number]>((b, d) => d[1] > b[1] ? d : b, ["", 0]);
  const monthLbl = new Date(monthKey + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
  const KPIS_D: Kpi[] = [
    ["Collected · " + monthLbl, fMoney(mtdAmt), `${fN(mtd.length)} receipts this month`, ["#1e9a6c", "#0f6647"], () => open({ kind: "rcpts", title: "Receipts this month", rows: [...mtd].sort((a, b) => (b.rcptDate || "").localeCompare(a.rcptDate || "")) })],
    ["Best day", bestDay[0] ? fMoney(bestDay[1]) : "—", bestDay[0] ? `on ${fD(bestDay[0])}` : "no receipts yet", [NAVY, "#0f2547"], () => bestDay[0] && open({ kind: "rcpts", title: `Receipts on ${fD(bestDay[0])}`, rows: mtd.filter(r => r.rcptDate === bestDay[0]) })],
    ["Daily average", dayTotals.length ? fMoney(mtdAmt / dayTotals.length) : "—", `${fN(dayTotals.length)} collection days`, ["#c8871d", "#96691c"], () => {}],
    ["Avg receipt", mtd.length ? fMoney(mtdAmt / mtd.length) : "—", "per receipt this month", ["#1a7f9c", "#0e5468"], () => {}],
  ];
  const KPIS = view === "master" ? KPIS_M : KPIS_D;

  const D_ASON = raw?.asOf.master?.slice(0, 10) ?? TODAY;
  const asOfLine = raw ? `Master ${raw.asOf.master?.slice(0, 16).replace("T", " ") ?? "—"} · Daily ${raw.asOf.daily?.slice(0, 16).replace("T", " ") ?? "—"}` : "";

  return (
    <div className="sw-inv" style={{ minHeight: "100vh", background: "#f6f4ef", display: "flex", flexDirection: "column" }}>
      <PageBanner bleed title="Collection" sub={<>live from the CRM shared-folder files — save the Excel, refresh this page · files saved: {asOfLine}</>}>
        <div>
          <label style={BANNER_LBL}>View</label>
          <BannerPills items={[["master", "Monthly Collection"], ["daily", "Daily Collection"]] as const}
            value={view} onChange={setView} />
        </div>
        <ProjSelect options={projOpts} selected={projF} onChange={setProjF} />
        <div>
          <label style={BANNER_LBL}>RM</label>
          <select value={rmF} onChange={e => setRmF(e.target.value)} style={{ ...BANNER_CTL, maxWidth: 170 }}>
            <option value="">All RMs</option>
            {rmOpts.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ position: "relative" }}>
          <label style={BANNER_LBL}>Search</label>
          <input value={q} onChange={e => { setQ(e.target.value); setSugOpen(true); }}
            onFocus={() => setSugOpen(true)} onBlur={() => window.setTimeout(() => setSugOpen(false), 150)}
            onKeyDown={e => { if (e.key === "Escape" || e.key === "Enter") setSugOpen(false); }}
            placeholder="Reg / customer / unit / bank…"
            style={{ ...BANNER_CTL, cursor: "text", width: 200 }} />
          {sugOpen && sugs.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, width: 300, background: "#fff", border: "1px solid #eae6da", borderRadius: 10, boxShadow: "0 10px 28px rgba(20,33,61,.18)", zIndex: 60, overflow: "hidden" }}>
              {sugs.map((sg, i) => (
                <div key={i} onMouseDown={e => { e.preventDefault(); setQ(sg.term); setSugOpen(false); }}
                  style={{ padding: "7px 12px", cursor: "pointer", borderBottom: i < sugs.length - 1 ? "1px solid #f4f1e9" : "none" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sg.label}</div>
                  <div style={{ fontSize: 10.5, color: "var(--mut)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sg.sub}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => { setProjF([]); setRmF(""); setQ(""); }} className="pb-btn">⟲ Reset</button>
      </PageBanner>

      <div style={{ padding: "14px 20px 24px", flex: 1 }}>
        {loading && <div style={{ ...CARD, textAlign: "center", color: "var(--mut)", padding: 40 }}>Loading collection data from the shared folder…</div>}
        {error && <div style={{ ...CARD, borderColor: RED, color: RED, fontWeight: 700 }}>Could not reach the collection service: {error}<div style={{ fontWeight: 400, color: "var(--mut)", marginTop: 6, fontSize: 12 }}>Check that VendorGlobeAPI is running on 192.168.66.28:5002 and can read the shared folder ( /collections/health shows file status ).</div></div>}
        {raw && raw.errors.length > 0 && <div style={{ ...CARD, borderColor: "#EDA100", color: "#96691c", fontWeight: 600, fontSize: 12.5 }}>{raw.errors.join(" · ")}</div>}

        {raw && !loading && (<>
          {/* KPI strip — always visible */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))", gap: 12, marginBottom: 14 }}>
            {KPIS.map(([k, v, sub, [c1, c2], onClick]) => (
              <div key={k} style={{ ...GLASS(c1, c2), cursor: "pointer" }} onClick={onClick}
                onMouseEnter={e => showTip(e, `<b>${k}</b><br/>${sub}<br/>click → list`)} onMouseLeave={hideTip}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", opacity: 0.85 }}>{k}</div>
                <div style={{ fontFamily: "Georgia,serif", fontSize: 27, fontWeight: 700, margin: "4px 0 2px" }}>{v}</div>
                <div style={{ fontSize: 11, opacity: 0.9 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* ================ COLLECTION MASTER ================ */}
          {view === "master" && (() => {
            const cr = (v: number) => (v / 1e7).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const agg = (ls: Led[]) => ({
              n: ls.length,
              tcv: ls.reduce((s, l) => s + l.tcv, 0), dem: ls.reduce((s, l) => s + l.dem, 0),
              rec: ls.reduce((s, l) => s + l.rec, 0), due: ls.reduce((s, l) => s + l.due, 0),
              fut: ls.reduce((s, l) => s + Math.max(l.tcv - l.dem, 0), 0),
            });
            const HEAD = (
              <tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                <th style={TH}>Row</th><th style={{ ...TH, textAlign: "right" }}>Units</th>
                <th style={{ ...TH, textAlign: "right" }}>TCV</th><th style={{ ...TH, textAlign: "right" }}>Demanded</th>
                <th style={{ ...TH, textAlign: "right" }}>Recd.</th><th style={{ ...TH, textAlign: "right" }}>Net Dues</th>
                <th style={{ ...TH, textAlign: "right" }}>Future Dues</th>
              </tr>
            );
            const arrowBtn = (dis: boolean, glyph: string, title: string, onGo: () => void) => (
              <button disabled={dis} title={title}
                onClick={e => { e.stopPropagation(); onGo(); }}
                style={{ width: 20, height: 17, lineHeight: 1, padding: 0, fontSize: 10, fontWeight: 800, cursor: dis ? "default" : "pointer", color: dis ? "#d8d2c2" : "var(--mut)", background: "#fff", border: "1px solid #e5e0d2", borderRadius: 5 }}
                onMouseEnter={e => { if (!dis) (e.currentTarget as HTMLElement).style.color = "#B8893C"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = dis ? "#d8d2c2" : "var(--mut)"; }}>
                {glyph}
              </button>
            );
            const row = (label: string, ls: Led[], sub: boolean, key: string, reorder?: { up: boolean; down: boolean; onUp: () => void; onDown: () => void }) => {
              const a = agg(ls);
              return (
                <tr key={key} onClick={() => openCusts(label, ls)} style={{ cursor: "pointer", background: sub ? "" : "#f7f5ef" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = sub ? "" : "#f7f5ef"; }}>
                  <td style={{ ...TD, fontWeight: sub ? 500 : 800, color: "var(--ink)", paddingLeft: sub ? 26 : 10 }}>
                    {reorder && (
                      <span style={{ display: "inline-flex", flexDirection: "column", gap: 1, marginRight: 8, verticalAlign: "middle" }}>
                        {arrowBtn(!reorder.up, "▲", "Move project up", reorder.onUp)}
                        {arrowBtn(!reorder.down, "▼", "Move project down", reorder.onDown)}
                      </span>
                    )}
                    {label}
                  </td>
                  <td style={{ ...TD, textAlign: "right", fontWeight: sub ? 500 : 700 }}>{fN(a.n)}</td>
                  <td style={{ ...TD, textAlign: "right" }}>{cr(a.tcv)}</td>
                  <td style={{ ...TD, textAlign: "right" }}>{cr(a.dem)}</td>
                  <td style={{ ...TD, textAlign: "right", color: GREEN }}>{cr(a.rec)}</td>
                  <td style={{ ...TD, textAlign: "right", color: a.due > 1e5 ? RED : "var(--mut)", fontWeight: 800 }}>{cr(a.due)}</td>
                  <td style={{ ...TD, textAlign: "right", color: "#96691c", fontWeight: 700 }}>{cr(a.fut)}</td>
                </tr>
              );
            };
            const totalRow = (ls: Led[]) => {
              const a = agg(ls);
              return (
                <tr style={{ background: "#14213D" }}>
                  <td style={{ ...TD, color: "#fff", fontWeight: 800 }}>Grand Total</td>
                  <td style={{ ...TD, textAlign: "right", color: "#fff", fontWeight: 800 }}>{fN(a.n)}</td>
                  <td style={{ ...TD, textAlign: "right", color: "#fff", fontWeight: 800 }}>{cr(a.tcv)}</td>
                  <td style={{ ...TD, textAlign: "right", color: "#fff", fontWeight: 800 }}>{cr(a.dem)}</td>
                  <td style={{ ...TD, textAlign: "right", color: "#9be8c5", fontWeight: 800 }}>{cr(a.rec)}</td>
                  <td style={{ ...TD, textAlign: "right", color: "#ffb3a7", fontWeight: 800 }}>{cr(a.due)}</td>
                  <td style={{ ...TD, textAlign: "right", color: "#ffd9a0", fontWeight: 800 }}>{cr(a.fut)}</td>
                </tr>
              );
            };
            const byProjDef = [...new Set(led.map(l => l.proj))].map(pj => ({ pj, ls: led.filter(l => l.proj === pj) })).sort((a, b) => agg(b.ls).due - agg(a.ls).due);
            const ordIdx = new Map(projOrder.map((pj, i) => [pj, i]));
            const byProj = [...byProjDef].sort((a, b) =>
              (ordIdx.get(a.pj) ?? 1000 + byProjDef.findIndex(g => g.pj === a.pj)) -
              (ordIdx.get(b.pj) ?? 1000 + byProjDef.findIndex(g => g.pj === b.pj)));
            const moveProj = (pj: string, dir: -1 | 1) => {
              const cur = byProj.map(g => g.pj);
              const i = cur.indexOf(pj), j = i + dir;
              if (i < 0 || j < 0 || j >= cur.length) return;
              [cur[i], cur[j]] = [cur[j], cur[i]];
              saveProjOrder(cur);
            };
            const byStatus = [...new Set(led.map(l => l.statusV || "—"))].map(st => ({ st, ls: led.filter(l => (l.statusV || "—") === st) })).sort((a, b) => agg(b.ls).due - agg(a.ls).due);
            const byRm = [...new Set(led.map(l => l.rmFinal || "Unassigned"))].map(rm => ({ rm, ls: led.filter(l => (l.rmFinal || "Unassigned") === rm) })).sort((a, b) => agg(b.ls).due - agg(a.ls).due);
            return (<>
              <Zoomable title="Project summary">
                <div style={CARD}>
                  <h3 style={H3}>Project Summary — {D_ASON}</h3>
                  <div style={CAP}>
                    figures in ₹ Cr · Future Dues = TCV − Demanded · ▲▼ arrange projects your way (saved on this browser) · click any row → its customers
                    {projOrder.length > 0 && <span onClick={() => saveProjOrder([])} style={{ marginLeft: 8, color: "#B8893C", fontWeight: 700, cursor: "pointer" }}>⟲ default order</span>}
                  </div>
                  <div style={{ overflowX: "auto", maxHeight: 520, overflowY: "auto", border: "1px solid #f0ede5", borderRadius: 10 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 860 }}>
                      <thead>{HEAD}</thead>
                      <tbody>
                        {byProj.map((g, gi) => (<>
                          {row(g.pj, g.ls, false, g.pj, { up: gi > 0, down: gi < byProj.length - 1, onUp: () => moveProj(g.pj, -1), onDown: () => moveProj(g.pj, 1) })}
                          {[...new Set(g.ls.map(l => l.phase).filter((x): x is string => !!x))].sort().map(ph =>
                            row(ph, g.ls.filter(l => l.phase === ph), true, g.pj + ph))}
                        </>))}
                        {totalRow(led)}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Zoomable>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 14, marginBottom: 14 }}>
                <Zoomable title="Dues share" collapsible>
                  <div style={{ ...CARD, height: "100%", marginBottom: 0, display: "flex", flexDirection: "column" }}>
                    <h3 style={H3}>Net Dues — Share by Project</h3>
                    <div style={CAP}>who holds the outstanding money · click → customers</div>
                    <Donut size={240} fmt={fMoney} data={(() => {
                      const rows = byProj.map(g => ({ label: g.pj, value: Math.max(agg(g.ls).due, 0), ls: g.ls }))
                        .filter(x => x.value > 1e5).sort((a, b) => b.value - a.value);
                      const top = rows.slice(0, 7);
                      const rest = rows.slice(7);
                      const out: Slice[] = top.map(x => ({ label: x.label, value: x.value, onPick: () => openCusts(`${x.label} — net dues`, x.ls.filter(l => l.due > 1000)) }));
                      if (rest.length) out.push({ label: "Other", value: rest.reduce((sm, x) => sm + x.value, 0), onPick: () => openCusts("Other projects — net dues", rest.flatMap(x => x.ls).filter(l => l.due > 1000)) });
                      return out;
                    })()} center={`₹${(byProj.reduce((sm, g) => sm + Math.max(agg(g.ls).due, 0), 0) / 1e7).toFixed(0)} Cr`} />
                  </div>
                </Zoomable>
                <Zoomable title="Recovery by project" collapsible>
                  <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                    <h3 style={H3}>Recovery % by Project</h3>
                    <div style={CAP}>received ÷ demanded · click → customers</div>
                    {(() => {
                      const rows = byProj.map(g => { const a = agg(g.ls); return { pj: g.pj, ls: g.ls, pct: a.dem ? (a.rec / a.dem) * 100 : 0 }; })
                        .sort((a, b) => a.pct - b.pct);
                      return rows.map(x => (
                        <div key={x.pj} className="barrow" style={{ padding: "4px 0", cursor: "pointer" }} onClick={() => openCusts(x.pj, x.ls)}
                          onMouseEnter={e => showTip(e, `<b>${x.pj}</b><br/>${x.pct.toFixed(1)}% recovered<br/>click → customers`)} onMouseLeave={hideTip}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 130, fontSize: 11.5, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.pj}</div>
                            <div style={{ flex: 1, height: 14, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${Math.min(x.pct, 100)}%`, background: x.pct >= 95 ? GREEN : x.pct >= 80 ? "#eda100" : RED, borderRadius: "0 4px 4px 0", minWidth: 2 }} />
                            </div>
                            <div style={{ width: 52, textAlign: "right", fontSize: 11.5, fontWeight: 800, color: "var(--ink)" }}>{x.pct.toFixed(1)}%</div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </Zoomable>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: 14, marginBottom: 14 }}>
                <Zoomable title="Status summary" collapsible>
                  <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                    <h3 style={H3}>Status Summary — All Projects</h3>
                    <div style={CAP}>by collection status · figures in ₹ Cr · click → customers</div>
                    <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>{HEAD}</thead>
                        <tbody>{byStatus.map(g => row(g.st, g.ls, false, g.st))}{totalRow(led)}</tbody>
                      </table>
                    </div>
                  </div>
                </Zoomable>
                <Zoomable title="RM summary" collapsible>
                  <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                    <h3 style={H3}>RM Summary — All Projects</h3>
                    <div style={CAP}>by Final Collection RM · figures in ₹ Cr · click → their customers</div>
                    <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>{HEAD}</thead>
                        <tbody>{byRm.map(g => row(g.rm, g.ls, false, g.rm))}{totalRow(led)}</tbody>
                      </table>
                    </div>
                  </div>
                </Zoomable>
              </div>

              <Zoomable title="Allotment status" collapsible>
                <div style={CARD}>
                  <h3 style={H3}>Inventory — Allotment Status</h3>
                  <div style={CAP}>Done / Pending units per project & phase · money in ₹ Cr · click a Done count → those customers</div>
                  <div style={{ overflowX: "auto", maxHeight: 480, overflowY: "auto", border: "1px solid #f0ede5", borderRadius: 10 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
                      <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                        <th style={TH}>Row</th>
                        <th style={{ ...TH, textAlign: "right" }}>Done</th>
                        <th style={{ ...TH, textAlign: "right" }}>Pending</th>
                        <th style={{ ...TH, textAlign: "right" }}>Grand Total</th>
                        <th style={{ ...TH, textAlign: "right" }}>TCV</th>
                        <th style={{ ...TH, textAlign: "right" }}>Called</th>
                        <th style={{ ...TH, textAlign: "right" }}>Recd.</th>
                        <th style={{ ...TH, textAlign: "right" }}>Due</th>
                        <th style={{ ...TH, textAlign: "right" }}>Future Dues</th>
                      </tr></thead>
                      <tbody>
                        {allot.map((a, i2) => {
                          const isP = a.kind === "phase";
                          const crv = (v: number) => v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          const ls = ledger.filter(l => (isP ? _npj(l.phase || "") === _npj(a.label) && l.proj === a.proj : l.proj === a.proj));
                          return (
                            <tr key={i2} style={{ background: isP ? "" : "#faf9f4" }}>
                              <td style={{ ...TD, fontWeight: isP ? 500 : 800, color: isP ? "var(--mut)" : "var(--ink)", paddingLeft: isP ? 26 : 10 }}>{a.label}</td>
                              <td onClick={() => ls.length && openCusts(`${a.label} — allotment done`, ls)}
                                style={{ ...TD, textAlign: "right", fontWeight: isP ? 600 : 800, cursor: ls.length ? "pointer" : "default" }}>{fN(a.done)}</td>
                              <td style={{ ...TD, textAlign: "right", fontWeight: isP ? 600 : 800, color: a.pending ? "#b8860b" : "#d0c9b8" }}>{a.pending ? fN(a.pending) : "—"}</td>
                              <td style={{ ...TD, textAlign: "right", fontWeight: isP ? 600 : 800 }}>{fN(a.total)}</td>
                              <td style={{ ...TD, textAlign: "right" }}>{crv(a.tcv)}</td>
                              <td style={{ ...TD, textAlign: "right" }}>{crv(a.called)}</td>
                              <td style={{ ...TD, textAlign: "right", color: GREEN, fontWeight: 600 }}>{crv(a.recd)}</td>
                              <td style={{ ...TD, textAlign: "right", color: a.due > 0.005 ? RED : "var(--mut)", fontWeight: 700 }}>{crv(a.due)}</td>
                              <td style={{ ...TD, textAlign: "right", color: "#b8860b", fontWeight: 600 }}>{crv(a.fut)}</td>
                            </tr>
                          );
                        })}
                        {(() => {
                          const ps = allot.filter(a => a.kind === "proj");
                          const t = (f: (a: Allot) => number) => ps.reduce((sm, a) => sm + f(a), 0);
                          const crv = (v: number) => v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          return (
                            <tr style={{ background: "#14213D" }}>
                              <td style={{ ...TD, color: "#fff", fontWeight: 800 }}>Grand Total</td>
                              <td style={{ ...TD, textAlign: "right", color: "#fff", fontWeight: 800 }}>{fN(t(a => a.done))}</td>
                              <td style={{ ...TD, textAlign: "right", color: "#ffd9a0", fontWeight: 800 }}>{fN(t(a => a.pending))}</td>
                              <td style={{ ...TD, textAlign: "right", color: "#fff", fontWeight: 800 }}>{fN(t(a => a.total))}</td>
                              <td style={{ ...TD, textAlign: "right", color: "#fff", fontWeight: 800 }}>{crv(t(a => a.tcv))}</td>
                              <td style={{ ...TD, textAlign: "right", color: "#fff", fontWeight: 800 }}>{crv(t(a => a.called))}</td>
                              <td style={{ ...TD, textAlign: "right", color: "#8be3b8", fontWeight: 800 }}>{crv(t(a => a.recd))}</td>
                              <td style={{ ...TD, textAlign: "right", color: "#ffb3a7", fontWeight: 800 }}>{crv(t(a => a.due))}</td>
                              <td style={{ ...TD, textAlign: "right", color: "#ffd9a0", fontWeight: 800 }}>{crv(t(a => a.fut))}</td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Zoomable>
            </>);
          })()}

          {/* ================ DAILY COLLECTION ================ */}
          {view === "daily" && (() => {
            const fx = (v: number) => v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const tgtTot = tgts.reduce((s, t) => s + t.tgt, 0);
            const recTot = tgts.reduce((s, t) => s + t.recd, 0);
            const pct = tgtTot ? (recTot / tgtTot) * 100 : 0;
            const tiles: [string, string, string][] = [
              ["Target (month)", `₹${fx(tgtTot)} Cr`, NAVY],
              ["Received till date", `₹${fx(recTot)} Cr`, GREEN],
              ["Balance", `₹${fx(tgtTot - recTot)} Cr`, RED],
              ["% Achieved", `${pct.toFixed(0)}%`, pct >= 60 ? GREEN : pct >= 35 ? "#96691c" : RED],
            ];
            const byP = [...new Set(tgts.map(t => t.proj))].map(pj => {
              const ts = tgts.filter(t => t.proj === pj);
              return { pj, tgt: ts.reduce((s, t) => s + t.tgt, 0), rec: ts.reduce((s, t) => s + t.recd, 0) };
            }).sort((a, b) => b.tgt - a.tgt);
            const byRm = [...new Set(tgts.map(t => t.rm))].map(rm => {
              const ts = tgts.filter(t => t.rm === rm);
              return { rm, tgt: ts.reduce((s, t) => s + t.tgt, 0), rec: ts.reduce((s, t) => s + t.recd, 0) };
            }).sort((a, b) => b.tgt - a.tgt);
            const pctCell = (v: number) => (
              <td style={{ ...TD, textAlign: "right", fontWeight: 800, color: v >= 60 ? GREEN : v >= 35 ? "#96691c" : RED }}>{v.toFixed(0)}%</td>
            );
            return (<>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
                {tiles.map(([k, v, c]) => (
                  <div key={k} style={{ ...CARD, marginBottom: 0, borderLeft: `5px solid ${c}` }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
                    <div style={{ fontFamily: "Georgia,serif", fontSize: 26, fontWeight: 700, color: c, marginTop: 4 }}>{v}</div>
                  </div>
                ))}
              </div>

              <Zoomable title="Daily trend">
                <div style={CARD}>
                  <h3 style={H3}>Day-Wise Collections — {new Date(monthKey + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</h3>
                  <div style={CAP}>amounts received per day (₹ Cr on bars) · click a bar → that day's receipts</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 180, overflowX: "auto", paddingBottom: 4 }}>
                    {(() => {
                      const mx = Math.max(...dayTotals.map(([, v]) => v), 1);
                      return dayTotals.map(([k, amt]) => {
                        const rs = mtd.filter(r => r.rcptDate === k);
                        return (
                          <div key={k} onClick={() => open({ kind: "rcpts", title: `Receipts on ${fD(k)}`, rows: rs })}
                            onMouseEnter={ev => showTip(ev, `<b>${fD(k)}</b><br/>${fMoney(amt)} · ${fN(rs.length)} receipts<br/>click → list`)} onMouseLeave={hideTip}
                            style={{ flex: "1 1 0", minWidth: 26, maxWidth: 64, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", height: "100%" }}>
                            <div style={{ flex: 1, width: "72%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                              <div style={{ fontSize: 9, fontWeight: 800, color: GREEN, textAlign: "center", marginBottom: 2, whiteSpace: "nowrap" }}>{(amt / 1e7).toFixed(1)}</div>
                              <div style={{ height: `${(amt / mx) * 100}%`, background: GREEN, borderRadius: "4px 4px 0 0", minHeight: 3 }} />
                            </div>
                            <div style={{ fontSize: 9, color: "var(--mut)", fontWeight: 700, marginTop: 4 }}>{k.slice(8)}</div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </Zoomable>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 14, marginBottom: 14 }}>
                <Zoomable title="Cumulative trend" collapsible>
                  <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                    <h3 style={H3}>Month-to-Date — Cumulative Line</h3>
                    <div style={CAP}>how the month is building up, day by day</div>
                    <CumLine days={dayTotals} month={monthLbl} />
                  </div>
                </Zoomable>
                <Zoomable title="Month by project" collapsible>
                  <div style={{ ...CARD, height: "100%", marginBottom: 0, display: "flex", flexDirection: "column" }}>
                    <h3 style={H3}>This Month — Share by Project</h3>
                    <div style={CAP}>collections received this month · click → receipts</div>
                    <Donut size={200} fmt={fMoney} data={(() => {
                      const rows = [...new Set(mtd.map(r => r.proj))].map(pj => {
                        const rs = mtd.filter(r => r.proj === pj);
                        return { pj, rs, v: rs.reduce((sm, r) => sm + r.amt, 0) };
                      }).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
                      const top = rows.slice(0, 7), rest = rows.slice(7);
                      const out: Slice[] = top.map(x => ({ label: x.pj, value: x.v, onPick: () => open({ kind: "rcpts", title: `${x.pj} — receipts this month`, rows: x.rs }) }));
                      if (rest.length) out.push({ label: "Other", value: rest.reduce((sm, x) => sm + x.v, 0), onPick: () => open({ kind: "rcpts", title: "Other projects — receipts", rows: rest.flatMap(x => x.rs) }) });
                      return out;
                    })()} center={fMoney(mtdAmt)} />
                  </div>
                </Zoomable>
                <Zoomable title="Payment modes" collapsible>
                  <div style={{ ...CARD, height: "100%", marginBottom: 0, display: "flex", flexDirection: "column" }}>
                    <h3 style={H3}>By Payment Mode</h3>
                    <div style={CAP}>this month's receipts · click → list</div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}><HBars fmt={fMoney} data={(() => {
                      const rows = [...new Set(mtd.map(r => (r.mode || "Unknown").trim().toUpperCase()))].map(md => {
                        const rs = mtd.filter(r => (r.mode || "Unknown").trim().toUpperCase() === md);
                        return { label: md.charAt(0) + md.slice(1).toLowerCase(), value: rs.reduce((sm, r) => sm + r.amt, 0), onPick: () => open({ kind: "rcpts", title: `${md} receipts`, rows: rs }) };
                      }).sort((a, b) => b.value - a.value);
                      return rows;
                    })()} /></div>
                  </div>
                </Zoomable>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(430px, 1fr))", gap: 14 }}>
                <Zoomable title="Project target" collapsible>
                  <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                    <h3 style={H3}>Project-Wise — Target vs Received</h3>
                    <div style={CAP}>this month's cycle · figures in ₹ Cr</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead><tr>
                        <th style={TH}>Project</th><th style={{ ...TH, textAlign: "right" }}>Target</th>
                        <th style={{ ...TH, textAlign: "right" }}>Received</th><th style={{ ...TH, textAlign: "right" }}>Balance</th><th style={{ ...TH, textAlign: "right" }}>%</th>
                      </tr></thead>
                      <tbody>
                        {byP.map(x => (
                          <tr key={x.pj}>
                            <td style={{ ...TD, fontWeight: 800, color: "var(--ink)" }}>{x.pj}</td>
                            <td style={{ ...TD, textAlign: "right" }}>{fx(x.tgt)}</td>
                            <td style={{ ...TD, textAlign: "right", color: GREEN, fontWeight: 700 }}>{fx(x.rec)}</td>
                            <td style={{ ...TD, textAlign: "right", color: RED, fontWeight: 700 }}>{fx(x.tgt - x.rec)}</td>
                            {pctCell(x.tgt ? (x.rec / x.tgt) * 100 : 0)}
                          </tr>
                        ))}
                        <tr style={{ background: "#14213D" }}>
                          <td style={{ ...TD, color: "#fff", fontWeight: 800 }}>Total</td>
                          <td style={{ ...TD, textAlign: "right", color: "#fff", fontWeight: 800 }}>{fx(tgtTot)}</td>
                          <td style={{ ...TD, textAlign: "right", color: "#9be8c5", fontWeight: 800 }}>{fx(recTot)}</td>
                          <td style={{ ...TD, textAlign: "right", color: "#ffb3a7", fontWeight: 800 }}>{fx(tgtTot - recTot)}</td>
                          <td style={{ ...TD, textAlign: "right", color: "#fff", fontWeight: 800 }}>{pct.toFixed(0)}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Zoomable>

                <Zoomable title="RM target" collapsible>
                  <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                    <h3 style={H3}>RM-Wise — Target vs Received</h3>
                    <div style={CAP}>this month's cycle · figures in ₹ Cr · click → their receipts</div>
                    <div style={{ maxHeight: 420, overflowY: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                          <th style={TH}>RM</th><th style={{ ...TH, textAlign: "right" }}>Target</th>
                          <th style={{ ...TH, textAlign: "right" }}>Received</th><th style={{ ...TH, textAlign: "right" }}>Balance</th><th style={{ ...TH, textAlign: "right" }}>%</th>
                        </tr></thead>
                        <tbody>
                          {byRm.map(x => (
                            <tr key={x.rm} onClick={() => open({ kind: "rcpts", title: `${x.rm} — receipts this month`, rows: mtd.filter(r => (r.rm || "").toLowerCase().includes(x.rm.split("/")[0].toLowerCase().trim())) })} style={{ cursor: "pointer" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                              <td style={{ ...TD, fontWeight: 700, color: "var(--ink)" }}>{x.rm}</td>
                              <td style={{ ...TD, textAlign: "right" }}>{fx(x.tgt)}</td>
                              <td style={{ ...TD, textAlign: "right", color: GREEN, fontWeight: 700 }}>{fx(x.rec)}</td>
                              <td style={{ ...TD, textAlign: "right", color: RED, fontWeight: 700 }}>{fx(x.tgt - x.rec)}</td>
                              {pctCell(x.tgt ? (x.rec / x.tgt) * 100 : 0)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Zoomable>
              </div>
            </>);
          })()}

        </>)}
      </div>

      <ColDrawer sel={drill} receipts={receipts} onClose={() => setDrill(null)} />
    </div>
  );
}
