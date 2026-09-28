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
const TEAL = "#0E7490", GOLD = "#B8893C", GREEN = "#1BAF7A", RED = "#c0392b", NAVY = "#1c3f6e";
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
  rm: string | null; remarks: string | null; rmStatus: string | null;
  funding: string | null; bank: string | null; sanctDate: string | null; sanctAmt: number;
  bba: string | null; bbaDate: string | null; possession: string | null;
  statusV: string | null; benefit: number;
}
interface Tgt { rm: string; proj: string; tgt: number; recd: number }
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
type View = "master" | "daily";

export default function CollectionPage() {
  const [raw, setRaw] = useState<{ asOf: Record<string, string | null>; errors: string[]; ledger: Led[]; receipts: Rcpt[]; pdc: Pdc[]; targets: Tgt[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("master");
  const [projF, setProjF] = useState<string[]>([]);
  const [rmF, setRmF] = useState("");
  const [q, setQ] = useState("");
  const [sugOpen, setSugOpen] = useState(false);
  const [drill, setDrill] = useState<Drill | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/collections/data`)
      .then(r => r.json())
      .then(j => {
        if (!alive) return;
        if (!j.ok) throw new Error(j.error || "backend error");
        setRaw({ asOf: j.asOf, errors: j.errors || [], ledger: unpack<Led>(j.ledger), receipts: unpack<Rcpt>(j.receipts), pdc: unpack<Pdc>(j.pdc), targets: j.targets ? unpack<Tgt>(j.targets) : [] });
        setLoading(false);
      })
      .catch(e => { if (alive) { setError(String(e.message || e)); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const ledger = raw?.ledger ?? [], receipts = raw?.receipts ?? [], pdcAll = raw?.pdc ?? [], targets = raw?.targets ?? [];
  const projOpts = useMemo(() => [...new Set([...ledger.map(l => l.proj), ...receipts.map(r => r.proj), ...pdcAll.map(p => p.proj)])].filter(Boolean).sort(), [ledger, receipts, pdcAll]);
  const rmOpts = useMemo(() => [...new Set(ledger.map(l => l.rm).filter((x): x is string => !!x))].sort(), [ledger]);

  /* Search suggestions: customers, reg nos, units and banks that contain
   * the typed text, respecting the project filter. Picking one fills the
   * search box with the exact term. */
  const sugs = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const pool = projF.length ? ledger.filter(l => projF.includes(l.proj)) : ledger;
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
  }, [q, ledger, projF]);

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
  const pdcAmt = pdc.reduce((s, p) => s + p.amt, 0);

  const KPIS: [string, string, string, [string, string], () => void][] = [
    ["Net dues outstanding", fMoney(totDue), `${fN(withDue.length)} units with dues`, ["#c0392b", "#7e1f14"], () => openCusts("Units with net dues", withDue)],
    ["Recovery", `${totDem ? ((totRec / totDem) * 100).toFixed(1) : 0}%`, `${fMoney(totRec)} received of ${fMoney(totDem)} demanded`, ["#1e9a6c", "#0f6647"], () => openCusts("All customers", led)],
    ["Collected · " + new Date(monthKey + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }), fMoney(mtdAmt), `${fN(mtd.length)} receipts this month`, [NAVY, "#0f2547"], () => open({ kind: "rcpts", title: "Receipts this month", rows: [...mtd].sort((a, b) => (b.rcptDate || "").localeCompare(a.rcptDate || "")) })],
    ["PDCs in hand", fMoney(pdcAmt), `${fN(pdc.length)} post-dated cheques`, ["#1a7f9c", "#0e5468"], () => open({ kind: "pdcs", title: "Post-dated cheques in hand", rows: [...pdc].sort((a, b) => (a.chqDate || "9").localeCompare(b.chqDate || "9")) })],
  ];

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
            const row = (label: string, ls: Led[], sub: boolean, key: string) => {
              const a = agg(ls);
              return (
                <tr key={key} onClick={() => openCusts(label, ls)} style={{ cursor: "pointer", background: sub ? "" : "#f7f5ef" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = sub ? "" : "#f7f5ef"; }}>
                  <td style={{ ...TD, fontWeight: sub ? 500 : 800, color: "var(--ink)", paddingLeft: sub ? 26 : 10 }}>{label}</td>
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
            const byProj = [...new Set(led.map(l => l.proj))].map(pj => ({ pj, ls: led.filter(l => l.proj === pj) })).sort((a, b) => agg(b.ls).due - agg(a.ls).due);
            const byStatus = [...new Set(led.map(l => l.statusV || "—"))].map(st => ({ st, ls: led.filter(l => (l.statusV || "—") === st) })).sort((a, b) => agg(b.ls).due - agg(a.ls).due);
            const byRm = [...new Set(led.map(l => l.rm || "Unassigned"))].map(rm => ({ rm, ls: led.filter(l => (l.rm || "Unassigned") === rm) })).sort((a, b) => agg(b.ls).due - agg(a.ls).due);
            return (<>
              <Zoomable title="Project summary">
                <div style={CARD}>
                  <h3 style={H3}>Project Summary — {D_ASON}</h3>
                  <div style={CAP}>figures in ₹ Cr · Future Dues = TCV − Demanded · phase rows indented · click any row → its customers</div>
                  <div style={{ overflowX: "auto", maxHeight: 520, overflowY: "auto", border: "1px solid #f0ede5", borderRadius: 10 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 860 }}>
                      <thead>{HEAD}</thead>
                      <tbody>
                        {byProj.map(g => (<>
                          {row(g.pj, g.ls, false, g.pj)}
                          {[...new Set(g.ls.map(l => l.phase).filter((x): x is string => !!x))].sort().map(ph =>
                            row(ph, g.ls.filter(l => l.phase === ph), true, g.pj + ph))}
                        </>))}
                        {totalRow(led)}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Zoomable>

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
                    <div style={CAP}>each RM's book · figures in ₹ Cr · click → their customers</div>
                    <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>{HEAD}</thead>
                        <tbody>{byRm.map(g => row(g.rm, g.ls, false, g.rm))}{totalRow(led)}</tbody>
                      </table>
                    </div>
                  </div>
                </Zoomable>
              </div>

              <Zoomable title="PDC register" collapsible>
                <div style={CARD}>
                  <h3 style={H3}>Post-Dated Cheques in Hand</h3>
                  <div style={CAP}>{fN(pdc.length)} cheques · {fMoney(pdcAmt)} · earliest maturity first</div>
                  <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto", border: "1px solid #f0ede5", borderRadius: 10 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 800 }}>
                      <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                        <th style={TH}>Cheque date</th><th style={TH}>Reg</th><th style={TH}>Unit</th><th style={TH}>Project</th><th style={TH}>Bank</th><th style={TH}>Cheque no.</th><th style={{ ...TH, textAlign: "right" }}>Amount</th>
                      </tr></thead>
                      <tbody>
                        {[...pdc].sort((a, b) => (a.chqDate || "9").localeCompare(b.chqDate || "9")).map((x, i) => (
                          <tr key={i}>
                            <td style={{ ...TD, fontWeight: 700 }}>{fD(x.chqDate)}</td>
                            <td style={{ ...TD, fontWeight: 700, color: "var(--ink)" }}>{x.reg}</td>
                            <td style={{ ...TD, color: "var(--mut)" }}>{x.unit || "—"}</td>
                            <td style={{ ...TD, color: "var(--mut)" }}>{x.proj}</td>
                            <td style={{ ...TD, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }}>{x.bank || "—"}</td>
                            <td style={{ ...TD, color: "var(--mut)" }}>{x.chq || "—"}</td>
                            <td style={{ ...TD, textAlign: "right", fontWeight: 800, color: TEAL }}>{fMoney(x.amt)}</td>
                          </tr>
                        ))}
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
            const tgtTot = targets.reduce((s, t) => s + t.tgt, 0);
            const recTot = targets.reduce((s, t) => s + t.recd, 0);
            const pct = tgtTot ? (recTot / tgtTot) * 100 : 0;
            const tiles: [string, string, string][] = [
              ["Target (month)", `₹${fx(tgtTot)} Cr`, NAVY],
              ["Received till date", `₹${fx(recTot)} Cr`, GREEN],
              ["Balance", `₹${fx(tgtTot - recTot)} Cr`, RED],
              ["% Achieved", `${pct.toFixed(0)}%`, pct >= 60 ? GREEN : pct >= 35 ? "#96691c" : RED],
            ];
            const byP = [...new Set(targets.map(t => t.proj))].map(pj => {
              const ts = targets.filter(t => t.proj === pj);
              return { pj, tgt: ts.reduce((s, t) => s + t.tgt, 0), rec: ts.reduce((s, t) => s + t.recd, 0) };
            }).sort((a, b) => b.tgt - a.tgt);
            const byRm = [...new Set(targets.map(t => t.rm))].map(rm => {
              const ts = targets.filter(t => t.rm === rm);
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
                </div>
              </Zoomable>

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

      <ColDrawer sel={drill} receipts={receipts} pdc={pdcAll} onClose={() => setDrill(null)} />
    </div>
  );
}
