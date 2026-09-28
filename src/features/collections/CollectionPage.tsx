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
const TEAL = "#0E7490", GOLD = "#B8893C", GREEN = "#1BAF7A", RED = "#c0392b", NAVY = "#1c3f6e", BLUE = "#1a7f9c", PURPLE = "#6b5f8f", AMBER = "#EDA100";
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
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/* ---------------- data types ---------------- */
interface Led {
  proj: string; phase: string | null; reg: string; unit: string | null; allot: string | null;
  name: string | null; profile: string | null; allotDate: string | null; unitType: string | null;
  plan: string | null; planType: string | null; broker: string | null; area: number; rate: number;
  tcv: number; dem: number; rec: number; due: number; recPct: number;
  letter: string | null; letterDate: string | null; letterDue: string | null;
  rm: string | null; remarks: string | null; rmStatus: string | null;
  funding: string | null; bank: string | null; sanctDate: string | null; sanctAmt: number;
  bba: string | null; bbaDate: string | null; ptpDate: string | null; possession: string | null;
}
interface Rcpt { proj: string; reg: string | null; name: string | null; unit: string | null; amt: number; mode: string | null; chq: string | null; bank: string | null; rcptDate: string | null; chqDate: string | null; clearDate: string | null; created: string | null; rm: string | null; milestone: string | null; dueDate: string | null }
interface Pdc { proj: string; reg: string | null; given: string | null; unit: string | null; mode: string | null; chq: string | null; chqDate: string | null; bank: string | null; amt: number; allotDate: string | null; phase: string | null; tower: string | null; received: string | null }

function unpack<T>(p: { cols: string[]; rows: unknown[][] }): T[] {
  return p.rows.map(r => Object.fromEntries(p.cols.map((c, i) => [c, r[i]])) as T);
}

/* ---------------- drill drawer ---------------- */
type Drill =
  | { kind: "custs"; title: string; sub?: string; rows: Led[] }
  | { kind: "rcpts"; title: string; sub?: string; rows: Rcpt[] }
  | { kind: "pdcs"; title: string; sub?: string; rows: Pdc[] };

function ColDrawer({ sel, receipts, pdc, onClose }: { sel: Drill | null; receipts: Rcpt[]; pdc: Pdc[]; onClose: () => void }) {
  const [cust, setCust] = useState<Led | null>(null);
  if (!sel) return null;
  const tile = (k: string, v: string, col = "var(--ink)") => (
    <div key={k} style={{ background: "#faf9f6", border: "1px solid #eee9dd", borderRadius: 10, padding: "8px 12px", minWidth: 105 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: col, marginTop: 2 }}>{v}</div>
    </div>
  );
  const myRcpts = cust ? receipts.filter(r => r.reg === cust.reg) : [];
  const myPdc = cust ? pdc.filter(p => p.reg === cust.reg) : [];
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
          {!cust && sel.kind === "pdcs" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {tile("Cheques", fN(sel.rows.length))}
              {tile("Amount", fMoney(sel.rows.reduce((s, r) => s + r.amt, 0)), TEAL)}
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
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>PTP date</div><div style={{ fontWeight: 700, color: cust.ptpDate && cust.ptpDate < TODAY ? RED : "var(--ink)" }}>{fD(cust.ptpDate)}{cust.ptpDate && cust.ptpDate < TODAY ? " · overdue" : ""}</div>
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
              {myPdc.length > 0 && (
                <div style={CARD}>
                  <h3 style={H3}>Post-dated cheques in hand</h3>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 6 }}>
                    <thead><tr><th style={TH}>Cheque date</th><th style={TH}>Cheque no.</th><th style={TH}>Bank</th><th style={{ ...TH, textAlign: "right" }}>Amount</th></tr></thead>
                    <tbody>{myPdc.map((r, i) => (
                      <tr key={i}><td style={TD}>{fD(r.chqDate)}</td><td style={TD}>{r.chq || "—"}</td><td style={{ ...TD, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{r.bank || "—"}</td><td style={{ ...TD, textAlign: "right", fontWeight: 700, color: TEAL }}>{fMoney(r.amt)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </>
          ) : sel.kind === "custs" ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                <th style={TH}>Customer</th><th style={TH}>Project</th><th style={TH}>RM</th>
                <th style={{ ...TH, textAlign: "right" }}>Net due</th><th style={{ ...TH, textAlign: "right" }}>Recd %</th><th style={{ ...TH, textAlign: "right" }}>PTP</th>
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
                    <td style={{ ...TD, textAlign: "right", color: l.ptpDate && l.ptpDate < TODAY ? RED : "var(--mut)", fontWeight: 700 }}>{fD(l.ptpDate)}</td>
                  </tr>
                ))}
                {sel.rows.length > 400 && <tr><td colSpan={6} style={{ ...TD, textAlign: "center", color: "var(--mut)" }}>showing first 400 of {fN(sel.rows.length)} — narrow with filters</td></tr>}
              </tbody>
            </table>
          ) : sel.kind === "rcpts" ? (
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
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                <th style={TH}>Cheque date</th><th style={TH}>Customer</th><th style={TH}>Project</th><th style={TH}>Bank</th><th style={{ ...TH, textAlign: "right" }}>Amount</th>
              </tr></thead>
              <tbody>
                {sel.rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...TD, fontWeight: 700 }}>{fD(r.chqDate)}</td>
                    <td style={{ ...TD, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{r.reg} <span style={{ color: "var(--mut)", fontSize: 10.5 }}>{r.unit}</span></td>
                    <td style={{ ...TD, color: "var(--mut)" }}>{r.proj}</td>
                    <td style={{ ...TD, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }}>{r.bank || "—"}</td>
                    <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: TEAL }}>{fMoney(r.amt)}</td>
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

/* ---------------- page ---------------- */
type View = "overview" | "outstanding" | "daily" | "ptp" | "pdc";

export default function CollectionPage() {
  const [raw, setRaw] = useState<{ asOf: Record<string, string | null>; errors: string[]; ledger: Led[]; receipts: Rcpt[]; pdc: Pdc[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("overview");
  const [projF, setProjF] = useState<string[]>([]);
  const [rmF, setRmF] = useState("");
  const [q, setQ] = useState("");
  const [drill, setDrill] = useState<Drill | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/collections/data`)
      .then(r => r.json())
      .then(j => {
        if (!alive) return;
        if (!j.ok) throw new Error(j.error || "backend error");
        setRaw({ asOf: j.asOf, errors: j.errors || [], ledger: unpack<Led>(j.ledger), receipts: unpack<Rcpt>(j.receipts), pdc: unpack<Pdc>(j.pdc) });
        setLoading(false);
      })
      .catch(e => { if (alive) { setError(String(e.message || e)); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const ledger = raw?.ledger ?? [], receipts = raw?.receipts ?? [], pdcAll = raw?.pdc ?? [];
  const projOpts = useMemo(() => [...new Set([...ledger.map(l => l.proj), ...receipts.map(r => r.proj), ...pdcAll.map(p => p.proj)])].filter(Boolean).sort(), [ledger, receipts, pdcAll]);
  const rmOpts = useMemo(() => [...new Set(ledger.map(l => l.rm).filter((x): x is string => !!x))].sort(), [ledger]);

  const match = (proj: string, texts: (string | null)[]) => {
    if (projF.length && !projF.includes(proj)) return false;
    const s = q.trim().toLowerCase();
    if (s && !texts.some(t => (t || "").toLowerCase().includes(s))) return false;
    return true;
  };
  const led = useMemo(() => ledger.filter(l => match(l.proj, [l.reg, l.name, l.unit, l.rm, l.bank]) && (!rmF || l.rm === rmF)), [ledger, projF, rmF, q]);
  const rcp = useMemo(() => receipts.filter(r => match(r.proj, [r.reg, r.name, r.unit, r.rm, r.bank]) && (!rmF || r.rm === rmF)), [receipts, projF, rmF, q]);
  const pdc = useMemo(() => pdcAll.filter(p => match(p.proj, [p.reg, p.unit, p.bank])), [pdcAll, projF, q]);

  const open = (d: Drill) => setDrill(d);
  const openCusts = (title: string, rows: Led[], sub?: string) =>
    open({ kind: "custs", title, sub, rows: [...rows].sort((a, b) => b.due - a.due) });

  /* ---- derived ---- */
  const withDue = led.filter(l => l.due > 1000);
  const totDue = withDue.reduce((s, l) => s + l.due, 0);
  const totDem = led.reduce((s, l) => s + l.dem, 0);
  const totRec = led.reduce((s, l) => s + l.rec, 0);
  const monthKey = useMemo(() => {
    const ds = rcp.map(r => r.rcptDate).filter((x): x is string => !!x).sort();
    return ds.length ? ds[ds.length - 1].slice(0, 7) : TODAY.slice(0, 7);
  }, [rcp]);
  const mtd = rcp.filter(r => (r.rcptDate || "").startsWith(monthKey));
  const mtdAmt = mtd.reduce((s, r) => s + r.amt, 0);
  const pdcAmt = pdc.reduce((s, p) => s + p.amt, 0);
  const ptpSet = withDue.filter(l => l.ptpDate);
  const ptpOver = ptpSet.filter(l => l.ptpDate! < TODAY);

  const KPIS: [string, string, string, [string, string], () => void][] = [
    ["Net dues outstanding", fMoney(totDue), `${fN(withDue.length)} units with dues`, ["#c0392b", "#7e1f14"], () => openCusts("Units with net dues", withDue)],
    ["Recovery", `${totDem ? ((totRec / totDem) * 100).toFixed(1) : 0}%`, `${fMoney(totRec)} received of ${fMoney(totDem)} demanded`, ["#1e9a6c", "#0f6647"], () => openCusts("All customers", led)],
    ["Collected · " + new Date(monthKey + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }), fMoney(mtdAmt), `${fN(mtd.length)} receipts this month`, [NAVY, "#0f2547"], () => open({ kind: "rcpts", title: "Receipts this month", rows: [...mtd].sort((a, b) => (b.rcptDate || "").localeCompare(a.rcptDate || "")) })],
    ["PDCs in hand", fMoney(pdcAmt), `${fN(pdc.length)} post-dated cheques`, ["#1a7f9c", "#0e5468"], () => open({ kind: "pdcs", title: "Post-dated cheques in hand", rows: [...pdc].sort((a, b) => (a.chqDate || "9").localeCompare(b.chqDate || "9")) })],
    ["PTPs given", fN(ptpSet.length), `${fN(ptpOver.length)} already overdue`, ["#c8871d", "#96691c"], () => openCusts("Customers with a PTP date", ptpSet, "promise-to-pay commitments")],
  ];

  const barRow = (label: string, n: number, amt: number, mx: number, col: string, onClick: () => void, tip?: string) => (
    <div key={label} className="barrow" style={{ padding: "4.5px 0", cursor: "pointer" }} onClick={onClick}
      onMouseEnter={e => showTip(e, tip || `<b>${label}</b><br/>${fN(n)} · ${fMoney(amt)}<br/>click → list`)} onMouseLeave={hideTip}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
        <span style={{ fontWeight: 700, color: "var(--ink)", maxWidth: "62%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ fontWeight: 800, color: "var(--mut)" }}>{fN(n)} <span style={{ color: GOLD }}>· {fMoney(amt)}</span></span>
      </div>
      <div style={{ height: 10, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(amt / mx) * 100}%`, background: col, borderRadius: 5 }} />
      </div>
    </div>
  );

  const asOfLine = raw ? `PTP ${raw.asOf.ptp?.slice(0, 16).replace("T", " ") ?? "—"} · Daily ${raw.asOf.daily?.slice(0, 16).replace("T", " ") ?? "—"} · Master ${raw.asOf.master?.slice(0, 16).replace("T", " ") ?? "—"}` : "";

  return (
    <div className="sw-inv" style={{ minHeight: "100vh", background: "#f6f4ef", display: "flex", flexDirection: "column" }}>
      <PageBanner bleed title="Collection" sub={<>live from the CRM shared-folder files — save the Excel, refresh this page · files saved: {asOfLine}</>}>
        <div>
          <label style={BANNER_LBL}>View</label>
          <BannerPills items={[["overview", "Overview"], ["outstanding", "Outstanding"], ["daily", "Daily"], ["ptp", "PTP"], ["pdc", "PDC"]] as const}
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
        <div>
          <label style={BANNER_LBL}>Search</label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Reg / customer / unit / bank…"
            style={{ ...BANNER_CTL, cursor: "text", width: 200 }} />
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

          {/* ---------------- OVERVIEW ---------------- */}
          {view === "overview" && (
            <Zoomable title="Project-wise">
              <div style={CARD}>
                <h3 style={H3}>Project-Wise — Dues, Recovery & This Month</h3>
                <div style={CAP}>click a row → that project's customers with dues</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 860 }}>
                    <thead><tr>
                      <th style={TH}>Project</th><th style={{ ...TH, textAlign: "right" }}>Units w/ dues</th>
                      <th style={{ ...TH, textAlign: "right" }}>Net due</th><th style={{ ...TH, width: "22%" }}></th>
                      <th style={{ ...TH, textAlign: "right" }}>Recovery %</th><th style={{ ...TH, textAlign: "right" }}>Collected {new Date(monthKey + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })}</th><th style={{ ...TH, textAlign: "right" }}>PDCs</th>
                    </tr></thead>
                    <tbody>
                      {(() => {
                        const projs = [...new Set(led.map(l => l.proj))].map(p => {
                          const ls = led.filter(l => l.proj === p);
                          const wd = ls.filter(l => l.due > 1000);
                          const dem = ls.reduce((s, l) => s + l.dem, 0), rec = ls.reduce((s, l) => s + l.rec, 0);
                          const m = mtd.filter(r => r.proj === p).reduce((s, r) => s + r.amt, 0);
                          const pd = pdc.filter(x => x.proj === p).reduce((s, x) => s + x.amt, 0);
                          return { p, wd, due: wd.reduce((s, l) => s + l.due, 0), pct: dem ? (rec / dem) * 100 : 0, m, pd };
                        }).sort((a, b) => b.due - a.due);
                        const mx = Math.max(...projs.map(x => x.due), 1);
                        return projs.map(x => (
                          <tr key={x.p} onClick={() => openCusts(`${x.p} — units with dues`, x.wd)} style={{ cursor: "pointer" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                            <td style={{ ...TD, fontWeight: 800, color: "var(--ink)" }}>{x.p}</td>
                            <td style={{ ...TD, textAlign: "right" }}>{fN(x.wd.length)}</td>
                            <td style={{ ...TD, textAlign: "right", color: RED, fontWeight: 800 }}>{fMoney(x.due)}</td>
                            <td style={TD}><div style={{ height: 9, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${(x.due / mx) * 100}%`, background: RED, opacity: 0.75, borderRadius: 5 }} /></div></td>
                            <td style={{ ...TD, textAlign: "right", fontWeight: 800, color: x.pct >= 95 ? GREEN : x.pct >= 85 ? "#96691c" : RED }}>{x.pct.toFixed(1)}%</td>
                            <td style={{ ...TD, textAlign: "right", color: GREEN, fontWeight: 700 }}>{x.m ? fMoney(x.m) : "—"}</td>
                            <td style={{ ...TD, textAlign: "right", color: TEAL, fontWeight: 700 }}>{x.pd ? fMoney(x.pd) : "—"}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </Zoomable>
          )}

          {/* ---------------- OUTSTANDING ---------------- */}
          {view === "outstanding" && (<>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14, marginBottom: 14 }}>
              <Zoomable title="Due slabs" collapsible>
                <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                  <h3 style={H3}>Dues by Size</h3>
                  <div style={CAP}>net due per unit · click → list</div>
                  {(() => {
                    const SLABS = [["Up to ₹5 L", 0, 5e5], ["₹5 L – ₹25 L", 5e5, 25e5], ["₹25 L – ₹1 Cr", 25e5, 1e7], ["Above ₹1 Cr", 1e7, 1e15]] as const;
                    const bands = SLABS.map(([l, lo, hi]) => { const ls = withDue.filter(x => x.due > lo && x.due <= hi); return { l, ls, amt: ls.reduce((s, x) => s + x.due, 0) }; }).filter(b => b.ls.length);
                    const mx = Math.max(...bands.map(b => b.amt), 1);
                    return bands.map(b => barRow(b.l as string, b.ls.length, b.amt, mx, RED, () => openCusts(`Dues ${b.l}`, b.ls)));
                  })()}
                </div>
              </Zoomable>
              <Zoomable title="By RM" collapsible>
                <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                  <h3 style={H3}>Dues by RM</h3>
                  <div style={CAP}>who is chasing how much · click → their customers</div>
                  <div style={{ maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
                    {(() => {
                      const m = new Map<string, Led[]>();
                      withDue.forEach(l => { const k = l.rm || "Unassigned"; if (!m.has(k)) m.set(k, []); m.get(k)!.push(l); });
                      const rows = [...m.entries()].map(([k, ls]) => ({ k, ls, amt: ls.reduce((s, x) => s + x.due, 0) })).sort((a, b) => b.amt - a.amt);
                      const mx = Math.max(...rows.map(r => r.amt), 1);
                      return rows.map(r => barRow(r.k, r.ls.length, r.amt, mx, PURPLE, () => openCusts(`RM: ${r.k} — dues`, r.ls)));
                    })()}
                  </div>
                </div>
              </Zoomable>
            </div>
            <Zoomable title="Top dues">
              <div style={CARD}>
                <h3 style={H3}>Biggest Dues</h3>
                <div style={CAP}>{fN(withDue.length)} units · largest first · click a row → full customer detail with receipts & PDCs</div>
                <div style={{ overflowX: "auto", maxHeight: 440, overflowY: "auto", border: "1px solid #f0ede5", borderRadius: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 980 }}>
                    <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                      <th style={TH}>Customer</th><th style={TH}>Project · Unit</th><th style={TH}>RM</th>
                      <th style={{ ...TH, textAlign: "right" }}>TCV</th><th style={{ ...TH, textAlign: "right" }}>Recd %</th>
                      <th style={{ ...TH, textAlign: "right" }}>Net due</th><th style={TH}>Last letter</th><th style={{ ...TH, textAlign: "right" }}>PTP</th>
                    </tr></thead>
                    <tbody>
                      {[...withDue].sort((a, b) => b.due - a.due).slice(0, 200).map((l, i) => (
                        <tr key={i} onClick={() => open({ kind: "custs", title: "Customer", rows: [l] })} style={{ cursor: "pointer" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                          <td style={{ ...TD, fontWeight: 800, color: "var(--ink)", maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis" }}>{l.name || l.reg}</td>
                          <td style={{ ...TD, color: "var(--mut)" }}>{l.proj} · {l.unit}</td>
                          <td style={{ ...TD, color: "var(--mut)", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis" }}>{l.rm || "—"}</td>
                          <td style={{ ...TD, textAlign: "right" }}>{fMoney(l.tcv)}</td>
                          <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: GREEN }}>{l.dem ? ((l.rec / l.dem) * 100).toFixed(0) : 0}%</td>
                          <td style={{ ...TD, textAlign: "right", fontWeight: 800, color: RED, fontSize: 12.5 }}>{fMoney(l.due)}</td>
                          <td style={{ ...TD, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", color: "var(--mut)" }}>{l.letter || "—"}</td>
                          <td style={{ ...TD, textAlign: "right", color: l.ptpDate && l.ptpDate < TODAY ? RED : "var(--mut)", fontWeight: 700 }}>{fD(l.ptpDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Zoomable>
          </>)}

          {/* ---------------- DAILY ---------------- */}
          {view === "daily" && (<>
            <Zoomable title="Daily trend">
              <div style={CARD}>
                <h3 style={H3}>Day-Wise Collections — {new Date(monthKey + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</h3>
                <div style={CAP}>amounts received per day · click a bar → that day's receipts</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 180, overflowX: "auto", paddingBottom: 4 }}>
                  {(() => {
                    const m = new Map<string, Rcpt[]>();
                    mtd.forEach(r => { const k = r.rcptDate!; if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); });
                    const days = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
                    const mx = Math.max(...days.map(([, rs]) => rs.reduce((s, r) => s + r.amt, 0)), 1);
                    return days.map(([k, rs]) => {
                      const amt = rs.reduce((s, r) => s + r.amt, 0);
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
                <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 4 }}>bar labels in ₹ Cr</div>
              </div>
            </Zoomable>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
              <Zoomable title="Project MTD" collapsible>
                <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                  <h3 style={H3}>Project-Wise This Month</h3>
                  <div style={CAP}>click → receipts</div>
                  {(() => {
                    const m = new Map<string, Rcpt[]>();
                    mtd.forEach(r => { if (!m.has(r.proj)) m.set(r.proj, []); m.get(r.proj)!.push(r); });
                    const rows = [...m.entries()].map(([k, rs]) => ({ k, rs, amt: rs.reduce((s, r) => s + r.amt, 0) })).sort((a, b) => b.amt - a.amt);
                    const mx = Math.max(...rows.map(r => r.amt), 1);
                    return rows.map(r => barRow(r.k, r.rs.length, r.amt, mx, GREEN, () => open({ kind: "rcpts", title: `${r.k} — receipts this month`, rows: r.rs })));
                  })()}
                </div>
              </Zoomable>
              <Zoomable title="Mode split" collapsible>
                <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                  <h3 style={H3}>How the Money Came In</h3>
                  <div style={CAP}>by payment mode · click → receipts</div>
                  {(() => {
                    const m = new Map<string, Rcpt[]>();
                    mtd.forEach(r => { const k = (r.mode || "—").trim().toUpperCase(); if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); });
                    const rows = [...m.entries()].map(([k, rs]) => ({ k, rs, amt: rs.reduce((s, r) => s + r.amt, 0) })).sort((a, b) => b.amt - a.amt);
                    const mx = Math.max(...rows.map(r => r.amt), 1);
                    return rows.map(r => barRow(r.k, r.rs.length, r.amt, mx, BLUE, () => open({ kind: "rcpts", title: `Mode: ${r.k}`, rows: r.rs })));
                  })()}
                </div>
              </Zoomable>
            </div>
          </>)}

          {/* ---------------- PTP ---------------- */}
          {view === "ptp" && (<>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14, marginBottom: 14 }}>
              <Zoomable title="PTP buckets" collapsible>
                <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                  <h3 style={H3}>Promise-to-Pay — Where Do They Stand?</h3>
                  <div style={CAP}>PTP date vs today · click → customers</div>
                  {(() => {
                    const wk = new Date(Date.parse(TODAY) + 7 * 86400000).toISOString().slice(0, 10);
                    const B = [
                      ["Overdue PTP", ptpSet.filter(l => l.ptpDate! < TODAY), RED],
                      ["Due today", ptpSet.filter(l => l.ptpDate === TODAY), AMBER],
                      ["This week", ptpSet.filter(l => l.ptpDate! > TODAY && l.ptpDate! <= wk), GOLD],
                      ["Later", ptpSet.filter(l => l.ptpDate! > wk), GREEN],
                      ["Dues, no PTP taken", withDue.filter(l => !l.ptpDate), "#9a927e"],
                    ] as const;
                    const mx = Math.max(...B.map(([, ls]) => ls.reduce((s, x) => s + x.due, 0)), 1);
                    return B.filter(([, ls]) => ls.length).map(([l, ls, c]) =>
                      barRow(l as string, ls.length, ls.reduce((s, x) => s + x.due, 0), mx, c as string, () => openCusts(l as string, ls as Led[])));
                  })()}
                </div>
              </Zoomable>
              <Zoomable title="Letter ageing" collapsible>
                <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                  <h3 style={H3}>Dunning — Days Since Last Letter</h3>
                  <div style={CAP}>units with dues, by how long ago the last letter went · click → customers</div>
                  {(() => {
                    const B = [["0–15 d", 0, 15], ["16–30 d", 16, 30], ["31–60 d", 31, 60], ["> 60 d", 61, 1e9]] as const;
                    const withL = withDue.filter(l => l.letterDate);
                    const bands = B.map(([l, lo, hi]) => { const ls = withL.filter(x => { const d = daysBetween(x.letterDate!, TODAY); return d >= lo && d <= hi; }); return { l, ls }; }).filter(b => b.ls.length);
                    const noL = withDue.filter(l => !l.letterDate);
                    const mx = Math.max(...bands.map(b => b.ls.reduce((s, x) => s + x.due, 0)), noL.reduce((s, x) => s + x.due, 0), 1);
                    return (<>
                      {bands.map((b, i) => barRow(b.l as string, b.ls.length, b.ls.reduce((s, x) => s + x.due, 0), mx, i >= 2 ? RED : AMBER, () => openCusts(`Last letter ${b.l} ago`, b.ls)))}
                      {noL.length > 0 && barRow("No letter recorded", noL.length, noL.reduce((s, x) => s + x.due, 0), mx, "#9a927e", () => openCusts("Dues with no letter recorded", noL))}
                    </>);
                  })()}
                </div>
              </Zoomable>
            </div>
            <Zoomable title="PTP list">
              <div style={CARD}>
                <h3 style={H3}>PTP Commitments — Earliest First</h3>
                <div style={CAP}>click a row → full customer detail</div>
                <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto", border: "1px solid #f0ede5", borderRadius: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
                    <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                      <th style={TH}>PTP date</th><th style={TH}>Customer</th><th style={TH}>Project · Unit</th><th style={TH}>RM</th>
                      <th style={{ ...TH, textAlign: "right" }}>Net due</th><th style={TH}>Remarks</th>
                    </tr></thead>
                    <tbody>
                      {[...ptpSet].sort((a, b) => a.ptpDate!.localeCompare(b.ptpDate!)).map((l, i) => (
                        <tr key={i} onClick={() => open({ kind: "custs", title: "PTP customer", rows: [l] })} style={{ cursor: "pointer" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                          <td style={{ ...TD, fontWeight: 800, color: l.ptpDate! < TODAY ? RED : "var(--ink)" }}>{fD(l.ptpDate)}{l.ptpDate! < TODAY ? " ⚠" : ""}</td>
                          <td style={{ ...TD, fontWeight: 700, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{l.name || l.reg}</td>
                          <td style={{ ...TD, color: "var(--mut)" }}>{l.proj} · {l.unit}</td>
                          <td style={{ ...TD, color: "var(--mut)", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis" }}>{l.rm || "—"}</td>
                          <td style={{ ...TD, textAlign: "right", fontWeight: 800, color: RED }}>{fMoney(l.due)}</td>
                          <td style={{ ...TD, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", color: "var(--mut)" }}>{l.remarks || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Zoomable>
          </>)}

          {/* ---------------- PDC ---------------- */}
          {view === "pdc" && (<>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14, marginBottom: 14 }}>
              <Zoomable title="PDC maturity" collapsible>
                <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                  <h3 style={H3}>When Do the Cheques Mature?</h3>
                  <div style={CAP}>by cheque month · click → cheques</div>
                  {(() => {
                    const m = new Map<string, Pdc[]>();
                    pdc.forEach(p => { const k = (p.chqDate || "unknown").slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k)!.push(p); });
                    const rows = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
                    const mx = Math.max(...rows.map(([, ps]) => ps.reduce((s, p) => s + p.amt, 0)), 1);
                    return rows.map(([k, ps]) => {
                      const lbl = k === "unknown" ? "No date" : new Date(k + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
                      return barRow(lbl, ps.length, ps.reduce((s, p) => s + p.amt, 0), mx, TEAL, () => open({ kind: "pdcs", title: `PDCs maturing ${lbl}`, rows: ps }));
                    });
                  })()}
                </div>
              </Zoomable>
              <Zoomable title="PDC by project" collapsible>
                <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                  <h3 style={H3}>PDCs by Project</h3>
                  <div style={CAP}>click → cheques</div>
                  {(() => {
                    const m = new Map<string, Pdc[]>();
                    pdc.forEach(p => { if (!m.has(p.proj)) m.set(p.proj, []); m.get(p.proj)!.push(p); });
                    const rows = [...m.entries()].map(([k, ps]) => ({ k, ps, amt: ps.reduce((s, p) => s + p.amt, 0) })).sort((a, b) => b.amt - a.amt);
                    const mx = Math.max(...rows.map(r => r.amt), 1);
                    return rows.map(r => barRow(r.k, r.ps.length, r.amt, mx, BLUE, () => open({ kind: "pdcs", title: `${r.k} — PDCs`, rows: r.ps })));
                  })()}
                </div>
              </Zoomable>
            </div>
            <Zoomable title="All PDCs">
              <div style={CARD}>
                <h3 style={H3}>All Post-Dated Cheques</h3>
                <div style={CAP}>{fN(pdc.length)} cheques · earliest maturity first</div>
                <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto", border: "1px solid #f0ede5", borderRadius: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 820 }}>
                    <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                      <th style={TH}>Cheque date</th><th style={TH}>Reg</th><th style={TH}>Unit</th><th style={TH}>Project</th><th style={TH}>Bank</th><th style={TH}>Cheque no.</th><th style={{ ...TH, textAlign: "right" }}>Amount</th>
                    </tr></thead>
                    <tbody>
                      {[...pdc].sort((a, b) => (a.chqDate || "9").localeCompare(b.chqDate || "9")).map((p, i) => (
                        <tr key={i}>
                          <td style={{ ...TD, fontWeight: 700 }}>{fD(p.chqDate)}</td>
                          <td style={{ ...TD, fontWeight: 700, color: "var(--ink)" }}>{p.reg}</td>
                          <td style={{ ...TD, color: "var(--mut)" }}>{p.unit || "—"}</td>
                          <td style={{ ...TD, color: "var(--mut)" }}>{p.proj}</td>
                          <td style={{ ...TD, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }}>{p.bank || "—"}</td>
                          <td style={{ ...TD, color: "var(--mut)" }}>{p.chq || "—"}</td>
                          <td style={{ ...TD, textAlign: "right", fontWeight: 800, color: TEAL }}>{fMoney(p.amt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Zoomable>
          </>)}
        </>)}
      </div>

      <ColDrawer sel={drill} receipts={receipts} pdc={pdcAll} onClose={() => setDrill(null)} />
    </div>
  );
}
