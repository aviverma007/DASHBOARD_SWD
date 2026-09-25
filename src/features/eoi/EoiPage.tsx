import { useEffect, useMemo, useRef, useState } from "react";
import { PageBanner, BannerPills, BANNER_LBL, BANNER_CTL } from "../../components/layout/PageBanner";
import { Zoomable } from "../../components/common/Zoomable";
import { showTip, hideTip } from "../../components/common/hoverTip";
import "../../components/inventory/smartworldInventory.css";
import raw from "../../data/eoiData.json";

/** EOI · Allotment Pending — money still in hand.
 * Business rule (25-Sep-26): "allotment pending" is shown ONLY for
 * customers whose EOI money we still hold. Customers whose money was
 * fully adjusted onto a sale order or refunded are out of the main
 * view (one context link keeps them reachable).
 * Receipt statuses: CLEARED money in · ADJUSTMENT moved by JV ·
 * PAYMENT refunded · BOUNCE failed, excluded everywhere. */

/* ---------------- palette / styles ---------------- */
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

/* ---------------- data ---------------- */
const EPOCH = Date.UTC(2022, 0, 1);
const DAY = 86400000;
const dayMs = (d: number) => EPOCH + d * DAY;
const fD = (d: number) => d < 0 ? "—" : new Date(dayMs(d)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" });
const dayOfIso = (s: string) => Math.round((Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) - EPOCH) / DAY);

interface EoiFile {
  meta: { asOn: string };
  PROJECTS: string[]; RS: string[]; MODE: string[]; PT: string[];
  C: (string | number)[][];
  R: (string | number)[][];
}
const D = raw as unknown as EoiFile;
const AS_ON = dayOfIso("2026-09-25");

interface Rcpt { day: number; amt: number; rs: number; mode: number; pt: number; doc: string }
interface Cust {
  code: string; projIdx: number; status: 0 | 1 | 2;
  name: string; unit: string; allotDay: number; firstDay: number; lastDay: number;
  cleared: number; adj: number; refunds: number; bounced: number; n: number;
  net: number; ageing: number;
  receipts: Rcpt[];
}

const ALL_CUSTS: Cust[] = (() => {
  const cs: Cust[] = D.C.map(c => {
    const cleared = c[8] as number, adj = c[9] as number, refunds = c[10] as number;
    const firstDay = c[6] as number, status = c[2] as 0 | 1 | 2;
    return {
      code: String(c[0]), projIdx: c[1] as number, status,
      name: String(c[3] || ""), unit: String(c[4] || ""), allotDay: c[5] as number,
      firstDay, lastDay: c[7] as number,
      cleared, adj, refunds, bounced: c[11] as number, n: c[12] as number,
      net: cleared + adj + refunds,
      ageing: firstDay >= 0 ? Math.max(0, AS_ON - firstDay) : 0,
      receipts: [],
    };
  });
  D.R.forEach(r => {
    cs[r[0] as number].receipts.push({ day: r[1] as number, amt: r[2] as number, rs: r[3] as number, mode: r[4] as number, pt: r[5] as number, doc: String(r[6] || "") });
  });
  return cs;
})();

const PENDING = ALL_CUSTS.filter(c => c.status === 0);

/** Money type per project (business rule, 25-Sep-26): every RERA-
 * registered project collects ADVANCE money; only CODE 67 is true EOI
 * because its RERA registration has not come yet. */
const isEoiProject = (projIdx: number) => D.PROJECTS[projIdx] === "CODE 67 GURGAON";
const typeLbl = (projIdx: number) => isEoiProject(projIdx) ? "EOI" : "Advance";
const TYPE_COL = { EOI: "#8a5aa8", Advance: "#0E7490" } as const;
/** Pooled collection account (pass-through, not a customer): hundreds of
 * receipts, nearly every cleared rupee mirrored by an equal ADJUSTMENT
 * out. Kept apart from customer numbers. */
const isPool = (c: Cust) => c.n >= 100 && c.cleared > 0 && Math.abs(c.adj) >= 0.9 * c.cleared;
const POOLS = PENDING.filter(isPool);
const REAL_PENDING = PENDING.filter(c => !isPool(c));
/** ₹1,000 floor keeps rounding paise out of "money in hand" */
const HOLDING = REAL_PENDING.filter(c => c.net > 1000);
const ZERO_HAND = REAL_PENDING.filter(c => c.net <= 1000);

/* ---------------- drill drawer ---------------- */
interface Drill { title: string; sub?: string; custs: Cust[] }

function EoiDrawer({ sel, onClose }: { sel: Drill | null; onClose: () => void }) {
  const [cust, setCust] = useState<Cust | null>(null);
  if (!sel) return null;
  const cs = sel.custs;
  const cleared = cs.reduce((s, c) => s + c.cleared, 0);
  const refunded = cs.reduce((s, c) => s + c.refunds, 0);
  const net = cs.reduce((s, c) => s + c.net, 0);
  const avgAge = cs.length ? cs.reduce((s, c) => s + c.ageing, 0) / cs.length : null;
  const tile = (k: string, v: string, col = "var(--ink)") => (
    <div key={k} style={{ background: "#faf9f6", border: "1px solid #eee9dd", borderRadius: 10, padding: "8px 12px", minWidth: 112 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: col, marginTop: 2 }}>{v}</div>
    </div>
  );
  return (
    <>
      <div onClick={() => { setCust(null); onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(14,22,45,0.45)", zIndex: 220 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(660px, 96vw)", background: "#fdfcf9", zIndex: 221, boxShadow: "-18px 0 50px rgba(14,22,45,0.35)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #eae6da", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
                {cust ? <><span onClick={() => setCust(null)} style={{ color: GOLD, cursor: "pointer" }}>‹ {sel.title}</span> · {cust.code}</> : sel.title}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 2 }}>{cust ? "receipt-level detail" : sel.sub ?? `${fN(cs.length)} customers · allotment pending`}</div>
            </div>
            <button onClick={() => { setCust(null); onClose(); }} style={{ background: "none", border: "none", fontSize: 24, color: "var(--mut)", cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>
          {!cust && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {tile("Customers", fN(cs.length))}
              {tile("Paid (cleared)", fMoney(cleared), TEAL)}
              {tile("Refunded", fMoney(Math.abs(refunded)), RED)}
              {tile("Still in hand", fMoney(net), net > 0 ? GREEN : "var(--mut)")}
              {avgAge !== null ? tile("Avg ageing", `${Math.round(avgAge)} d`, avgAge > 365 ? RED : "#96691c") : null}
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {cust ? (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {tile("Paid (cleared)", fMoney(cust.cleared), TEAL)}
                {tile("Refunded", fMoney(Math.abs(cust.refunds)), cust.refunds < 0 ? RED : "var(--mut)")}
                {tile("Adjusted out", fMoney(Math.abs(Math.min(cust.adj, 0))), "#96691c")}
                {tile("Still in hand", fMoney(cust.net), cust.net > 0 ? GREEN : "var(--mut)")}
                {cust.bounced !== 0 ? tile("Bounced (excl.)", fMoney(cust.bounced), RED) : null}
              </div>
              <div style={{ ...CARD, marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "5px 10px", fontSize: 12.5 }}>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>Customer code</div><div style={{ fontWeight: 700 }}>{cust.code}</div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>Name / unit</div><div>— captured only at allotment</div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>First EOI receipt</div><div>{fD(cust.firstDay)}</div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>Last activity</div><div>{fD(cust.lastDay)}</div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>Ageing</div><div style={{ color: cust.ageing > 365 ? RED : "#96691c", fontWeight: 800 }}>{cust.ageing} days waiting for allotment</div>
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6" }}>
                  <th style={TH}>Date</th><th style={TH}>Doc no.</th><th style={TH}>Mode</th><th style={TH}>Status</th><th style={{ ...TH, textAlign: "right" }}>Amount</th>
                </tr></thead>
                <tbody>
                  {cust.receipts.map((r, i) => {
                    const rsCol = r.rs === 2 ? RED : r.rs === 0 ? GREEN : r.amt < 0 ? "#96691c" : "var(--mut)";
                    return (
                      <tr key={i}>
                        <td style={TD}>{fD(r.day)}</td>
                        <td style={{ ...TD, color: "var(--mut)" }}>{r.doc || "—"}</td>
                        <td style={TD}>{D.MODE[r.mode]}</td>
                        <td style={TD}><span style={{ color: rsCol, fontWeight: 700, fontSize: 11 }}>{D.RS[r.rs]}</span></td>
                        <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: r.rs === 2 ? RED : r.amt < 0 ? "#96691c" : "var(--ink)", textDecoration: r.rs === 2 ? "line-through" : undefined }}>{fMoney(r.amt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                <th style={TH}>Customer code</th><th style={TH}>First EOI</th>
                <th style={{ ...TH, textAlign: "right" }}>Paid</th><th style={{ ...TH, textAlign: "right" }}>Refunded</th>
                <th style={{ ...TH, textAlign: "right" }}>In hand</th><th style={{ ...TH, textAlign: "right" }}>Ageing</th>
              </tr></thead>
              <tbody>
                {cs.map(c => (
                  <tr key={c.code} onClick={() => setCust(c)} style={{ cursor: "pointer" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                    <td style={{ ...TD }}>
                      <span style={{ fontWeight: 800, color: "var(--ink)" }}>{c.code}</span>
                      <span style={{ color: "var(--mut)", marginLeft: 6, fontSize: 10.5 }}>{D.PROJECTS[c.projIdx].replace("SMARTWORLD ", "")}</span>
                    </td>
                    <td style={{ ...TD, color: "var(--mut)" }}>{fD(c.firstDay)}</td>
                    <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: TEAL }}>{fMoney(c.cleared)}</td>
                    <td style={{ ...TD, textAlign: "right", color: c.refunds < 0 ? RED : "var(--mut)" }}>{c.refunds < 0 ? fMoney(Math.abs(c.refunds)) : "—"}</td>
                    <td style={{ ...TD, textAlign: "right", color: c.net > 0 ? GREEN : "var(--mut)", fontWeight: 700 }}>{fMoney(c.net)}</td>
                    <td style={{ ...TD, textAlign: "right", fontWeight: c.ageing > 365 ? 800 : 600, color: c.ageing > 365 ? RED : "#96691c" }}>{c.ageing} d</td>
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

/** Multi-select project dropdown in the banner — same interaction as
 * Target vs Actual's, with the EOI/Advance type badge per project. */
function EoiProjectSelect({ selected, onChange }: { selected: string[]; onChange: (s: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = (name: string) => {
    const next = selected.includes(name) ? selected.filter(x => x !== name) : [...selected, name];
    onChange(next.length === D.PROJECTS.length ? [] : next);   // all picked = All
  };
  const label = selected.length === 0 ? "All projects"
    : selected.length === 1 ? selected[0].replace("SMARTWORLD ", "")
    : `${selected.length} projects`;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={BANNER_LBL}>Project</label>
      <button type="button" onClick={() => setOpen(v => !v)} style={{ ...BANNER_CTL, minWidth: 200, textAlign: "left" }}>
        {label} <span style={{ color: "var(--mut)", marginLeft: 6, fontSize: 9 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60, background: "#fff", border: "1px solid var(--line)", borderRadius: 9, boxShadow: "0 12px 34px rgba(20,33,61,.2)", padding: 8, minWidth: 300, maxHeight: 320, overflowY: "auto" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderBottom: "1px solid var(--line)", marginBottom: 5, paddingBottom: 10, fontSize: 13, color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>
            <input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])} style={{ accentColor: "#B8893C", width: 15, height: 15 }} />
            All projects
          </label>
          {D.PROJECTS.map((name, pi) => (
            <label key={name} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderRadius: 6, fontSize: 13, color: "var(--ink)", cursor: "pointer" }}>
              <input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} style={{ accentColor: "#B8893C", width: 15, height: 15 }} />
              <span style={{ flex: 1 }}>{name}</span>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: TYPE_COL[typeLbl(pi)] }}>{typeLbl(pi).toUpperCase()}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- page ---------------- */
export function EoiPage() {
  const [projF, setProjF] = useState<string[]>([]);
  const [typeF, setTypeF] = useState<"all" | "advance" | "eoi">("all");
  const [periodType, setPeriodType] = useState<"all" | "custom">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [drill, setDrill] = useState<Drill | null>(null);

  const openList = (title: string, custs: Cust[], sub?: string) =>
    setDrill({ title, sub, custs: [...custs].sort((a, b) => b.net - a.net) });

  /* scope = customers whose money we still hold */
  const scoped = useMemo(() => {
    const fromD = periodType === "custom" && from ? dayOfIso(from) : -1;
    const toD = periodType === "custom" && to ? dayOfIso(to) : Infinity;
    const s = q.trim().toLowerCase();
    return HOLDING.filter(c => {
      if (projF.length && !projF.includes(D.PROJECTS[c.projIdx])) return false;
      if (typeF !== "all" && (typeF === "eoi") !== isEoiProject(c.projIdx)) return false;
      if (c.firstDay >= 0 && (c.firstDay < fromD || c.firstDay > toD)) return false;
      if (fromD >= 0 && c.firstDay < 0) return false;
      if (s && !c.code.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [projF, typeF, periodType, from, to, q]);

  /** Changing the project picks the matching money type on its own:
   * only-EOI projects → EOI, only-RERA projects → Advance, mixed or
   * All → All. The user can still override the pills afterwards. */
  function handleProjects(next: string[]) {
    setProjF(next);
    if (next.length === 0) { setTypeF("all"); return; }
    const eois = next.filter(p => isEoiProject(D.PROJECTS.indexOf(p))).length;
    setTypeF(eois === next.length ? "eoi" : eois === 0 ? "advance" : "all");
  }

  function handleReset() {
    setProjF([]); setTypeF("all"); setPeriodType("all"); setFrom(""); setTo(""); setQ("");
  }

  const inHand = scoped.reduce((s, c) => s + c.net, 0);
  const paidTot = scoped.reduce((s, c) => s + c.cleared, 0);
  const refTot = scoped.reduce((s, c) => s + c.refunds, 0);
  const adjTot = scoped.reduce((s, c) => s + Math.min(c.adj, 0), 0);
  const avgAge = scoped.length ? scoped.reduce((s, c) => s + c.ageing, 0) / scoped.length : null;

  /* in-hand table: own search + sortable columns (ageing desc default) */
  type SortKey = "code" | "proj" | "first" | "last" | "n" | "paid" | "ref" | "adj" | "hand" | "age";
  const [tSort, setTSort] = useState<{ k: SortKey; d: 1 | -1 }>({ k: "age", d: -1 });
  const [tq, setTq] = useState("");
  const oldest = useMemo(() => {
    const s = tq.trim().toLowerCase();
    const f = !s ? scoped : scoped.filter(c =>
      c.code.toLowerCase().includes(s) || D.PROJECTS[c.projIdx].toLowerCase().includes(s));
    const val = (c: Cust): number | string =>
      tSort.k === "code" ? c.code : tSort.k === "proj" ? D.PROJECTS[c.projIdx] :
      tSort.k === "first" ? c.firstDay : tSort.k === "last" ? c.lastDay :
      tSort.k === "n" ? c.n : tSort.k === "paid" ? c.cleared :
      tSort.k === "ref" ? Math.abs(c.refunds) : tSort.k === "adj" ? Math.abs(Math.min(c.adj, 0)) :
      tSort.k === "hand" ? c.net : c.ageing;
    return [...f].sort((a, b) => {
      const va = val(a), vb = val(b);
      const cmp = typeof va === "string" ? String(va).localeCompare(String(vb)) : (va as number) - (vb as number);
      return cmp * tSort.d;
    });
  }, [scoped, tq, tSort]);
  const sortTh = (label: string, k: SortKey, right?: boolean) => (
    <th onClick={() => setTSort(s => s.k === k ? { k, d: s.d === 1 ? -1 : 1 } : { k, d: -1 })}
      title="Click to sort ascending / descending"
      style={{ ...TH, textAlign: right ? "right" : "left", cursor: "pointer", userSelect: "none", color: tSort.k === k ? "var(--ink)" : undefined }}>
      {label} <span style={{ fontSize: 8.5, opacity: tSort.k === k ? 1 : 0.35 }}>{tSort.k === k ? (tSort.d === 1 ? "▲" : "▼") : "▲▼"}</span>
    </th>
  );

  const advCs = scoped.filter(c => !isEoiProject(c.projIdx));
  const eoiCs = scoped.filter(c => isEoiProject(c.projIdx));
  const KPIS: [string, string, string, [string, string], () => void][] = [
    ["Allotment Pending", fN(scoped.length), "customers whose money is still with us", ["#c8871d", "#96691c"], () => openList("Allotment pending — money in hand", scoped)],
    ["Money in hand", fMoney(inHand), "total held, awaiting allotment", ["#1e9a6c", "#0f6647"], () => openList("Money in hand", scoped)],
    ["Advance in hand", fMoney(advCs.reduce((s, c) => s + c.net, 0)), `${fN(advCs.length)} customers · RERA projects`, ["#1a7f9c", "#0e5468"], () => openList("Advance money in hand (RERA projects)", advCs)],
    ["EOI in hand", fMoney(eoiCs.reduce((s, c) => s + c.net, 0)), `${fN(eoiCs.length)} customers · Code 67 (RERA awaited)`, ["#8a5aa8", "#5d3b75"], () => openList("EOI money in hand (Code 67)", eoiCs)],
    ["They paid in total", fMoney(paidTot), "cleared receipts from these customers", [NAVY, "#0f2547"], () => openList("Total paid by in-hand customers", scoped)],
    ["Part refunded / adjusted", fMoney(Math.abs(refTot + adjTot)), "portion of their money already returned or moved", ["#c0392b", "#7e1f14"], () => openList("In-hand customers with part refunded / adjusted", scoped.filter(c => c.refunds < 0 || c.adj < 0))],
    ["Avg ageing", avgAge !== null ? `${Math.round(avgAge)} d` : "—", "days since first payment, still not allotted", ["#6b5f8f", "#453a63"], () => openList("In-hand customers by ageing", scoped)],
  ];

  return (
    <div className="sw-inv" style={{ minHeight: "100vh", background: "#f6f4ef", display: "flex", flexDirection: "column" }}>
      <PageBanner bleed title="EOI / Advance" sub={<>allotment-pending customers whose money is still in hand · RERA projects = Advance, Code 67 = EOI (RERA awaited) · data as on {D.meta.asOn} · bounced instruments excluded</>}>
        <EoiProjectSelect selected={projF} onChange={handleProjects} />
        <div>
          <label style={BANNER_LBL}>Money type</label>
          <BannerPills items={[["all", "All"], ["advance", "Advance"], ["eoi", "EOI"]] as const}
            value={typeF} onChange={setTypeF} />
        </div>
        <div>
          <label style={BANNER_LBL}>Period · first payment</label>
          <BannerPills items={[["all", "All time"], ["custom", "Custom"]] as const}
            value={periodType} onChange={setPeriodType} />
        </div>
        {periodType === "custom" && (
          <>
            <div>
              <label style={BANNER_LBL}>From</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...BANNER_CTL, cursor: "text" }} />
            </div>
            <div>
              <label style={BANNER_LBL}>To</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...BANNER_CTL, cursor: "text" }} />
            </div>
          </>
        )}
        <div>
          <label style={BANNER_LBL}>Search</label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Customer code…"
            style={{ ...BANNER_CTL, cursor: "text", width: 190 }} />
        </div>
        <button onClick={handleReset} className="pb-btn">⟲ Reset</button>
      </PageBanner>
      <div style={{ padding: "14px 20px 24px", flex: 1 }}>

        {/* ---------- in-hand KPI cards (the top of the page) ---------- */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))", gap: 12, marginBottom: 14 }}>
          {KPIS.map(([k, v, sub, [c1, c2], onClick]) => (
            <div key={k} style={{ ...GLASS(c1, c2), cursor: "pointer" }} onClick={onClick}
              onMouseEnter={e => showTip(e, `<b>${k}</b><br/>${sub}<br/>click → customer list`)} onMouseLeave={hideTip}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", opacity: 0.85 }}>{k}</div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 29, fontWeight: 700, margin: "4px 0 2px" }}>{v}</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ---------- project-wise cards ---------- */}
        {(() => {
          const ACCENTS = ["#3c6db0", "#2e7d6f", "#b8893c", "#c2674a", "#7a5c84", "#4b7b3f"];
          const byProj = D.PROJECTS.map((p, pi) => {
            const cs = scoped.filter(c => c.projIdx === pi);
            if (!cs.length) return null;
            const hand = cs.reduce((s, c) => s + c.net, 0);
            const paid = cs.reduce((s, c) => s + c.cleared, 0);
            const age = cs.reduce((s, c) => s + c.ageing, 0) / cs.length;
            const old = Math.max(...cs.map(c => c.ageing));
            return { p, pi, cs, hand, paid, age, old };
          }).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.hand - a.hand);
          if (!byProj.length) return null;
          const totHand = byProj.reduce((s, b) => s + b.hand, 0) || 1;
          return (
            <Zoomable title="Project cards" collapsible>
              <div style={CARD}>
                <h3 style={H3}>Money In Hand — Project Wise</h3>
                <div style={CAP}>each project's share of the {fMoney(totHand)} we hold · click a card → that project's customers</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
                  {byProj.map(b => {
                    const acc = ACCENTS[b.pi % ACCENTS.length];
                    const share = (b.hand / totHand) * 100;
                    return (
                      <div key={b.p} onClick={() => openList(`${b.p} — money in hand`, b.cs)}
                        onMouseEnter={e => { showTip(e, `<b>${b.p}</b><br/>${fN(b.cs.length)} customers · ${fMoney(b.hand)} in hand<br/>click → list`); (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                        onMouseLeave={e => { hideTip(); (e.currentTarget as HTMLElement).style.transform = ""; }}
                        style={{ background: "#fff", border: "1px solid #eae6da", borderLeft: `5px solid ${acc}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", boxShadow: "0 2px 8px rgba(20,33,61,.06)", transition: "transform .15s ease, box-shadow .15s ease" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div style={{ fontFamily: "Georgia,serif", fontSize: 13.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.25 }}>
                            {b.p.replace("SMARTWORLD ", "")}
                          </div>
                          <span style={{ background: `${TYPE_COL[typeLbl(b.pi)]}1c`, color: TYPE_COL[typeLbl(b.pi)], fontWeight: 800, fontSize: 9.5, borderRadius: 999, padding: "2px 9px", flexShrink: 0 }}>
                            {typeLbl(b.pi).toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontFamily: "Georgia,serif", fontSize: 25, fontWeight: 700, color: GREEN, margin: "7px 0 1px" }}>{fMoney(b.hand)}</div>
                        <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 8 }}>
                          in hand · <b style={{ color: "var(--ink)" }}>{fN(b.cs.length)}</b> customers · paid {fMoney(b.paid)}
                        </div>
                        <div style={{ height: 7, background: "#f0ede5", borderRadius: 4, overflow: "hidden", marginBottom: 7 }}>
                          <div style={{ height: "100%", width: `${share}%`, background: acc, borderRadius: 4 }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 700 }}>
                          <span style={{ color: acc }}>{share.toFixed(0)}% of held money</span>
                          <span style={{ color: b.age > 365 ? RED : "#96691c" }}>avg {Math.round(b.age)} d · oldest {b.old} d</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Zoomable>
          );
        })()}

        {/* ---------- ageing + largest holdings + intake ---------- */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 14, marginBottom: 14 }}>
          <Zoomable title="Ageing" collapsible>
            <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
              <h3 style={H3}>How Long Has Their Money Waited?</h3>
              <div style={CAP}>days since first payment, still not allotted · count + money in hand · click → list</div>
              {(() => {
                const AGE_BANDS = [["0–90 d", 0, 90], ["91–180 d", 91, 180], ["181–270 d", 181, 270], ["271–365 d", 271, 365], ["> 1 year", 366, 1e9]] as const;
                const bands = AGE_BANDS.map(([l, lo, hi]) => {
                  const cs = scoped.filter(c => c.ageing >= lo && c.ageing <= hi);
                  return { l, cs, amt: cs.reduce((s, c) => s + c.net, 0) };
                });
                const mx = Math.max(...bands.map(b => b.cs.length), 1);
                return bands.map((b, i) => (
                  <div key={b.l} className="barrow" style={{ padding: "5.5px 0", cursor: "pointer" }}
                    onClick={() => openList(`Waiting ${b.l}`, b.cs)}
                    onMouseEnter={e => showTip(e, `<b>${b.l}</b><br/>${fN(b.cs.length)} customers · ${fMoney(b.amt)} in hand<br/>click → list`)} onMouseLeave={hideTip}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, color: "var(--ink)" }}>{b.l}</span>
                      <span style={{ fontWeight: 800, color: "var(--mut)" }}>{fN(b.cs.length)} <span style={{ color: GOLD }}>· {fMoney(b.amt)}</span></span>
                    </div>
                    <div style={{ height: 10, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(b.cs.length / mx) * 100}%`, background: i >= 3 ? RED : i >= 1 ? "#EDA100" : GREEN, borderRadius: 5 }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </Zoomable>

          <Zoomable title="Largest holdings" collapsible>
            <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
              <h3 style={H3}>Largest Amounts We Hold</h3>
              <div style={CAP}>the customers holding the most money · click → their receipts</div>
              {(() => {
                const top = [...scoped].sort((a, b) => b.net - a.net).slice(0, 8);
                const mx = Math.max(...top.map(c => c.net), 1);
                return top.map(c => (
                  <div key={c.code} className="barrow" style={{ padding: "4.5px 0", cursor: "pointer" }}
                    onClick={() => setDrill({ title: "Pending customer", custs: [c] })}
                    onMouseEnter={e => showTip(e, `<b>${c.code}</b> · ${D.PROJECTS[c.projIdx].replace("SMARTWORLD ", "")}<br/>${fMoney(c.net)} in hand · waiting ${c.ageing} d<br/>click → receipts`)} onMouseLeave={hideTip}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, color: "var(--ink)" }}>
                        {c.code} <span style={{ color: "var(--mut)", fontWeight: 600, fontSize: 10.5 }}>· {D.PROJECTS[c.projIdx].replace("SMARTWORLD ", "")}</span>
                      </span>
                      <span style={{ fontWeight: 800, color: GREEN }}>{fMoney(c.net)} <span style={{ color: c.ageing > 365 ? RED : "#96691c", fontSize: 10.5 }}>· {c.ageing} d</span></span>
                    </div>
                    <div style={{ height: 8, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(c.net / mx) * 100}%`, background: TEAL, borderRadius: 4 }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </Zoomable>

          <Zoomable title="When they paid" collapsible>
            <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
              <h3 style={H3}>When Did This Money Come In?</h3>
              <div style={CAP}>in-hand customers by month of first payment · older bars = longer-waiting money · click → list</div>
              {(() => {
                const m = new Map<string, Cust[]>();
                scoped.forEach(c => {
                  if (c.firstDay < 0) return;
                  const k = new Date(dayMs(c.firstDay)).toISOString().slice(0, 7);
                  if (!m.has(k)) m.set(k, []);
                  m.get(k)!.push(c);
                });
                const months = [...m.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1);
                const mx = Math.max(...months.map(([, cs]) => cs.length), 1);
                return (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 150, overflowX: "auto", paddingBottom: 4 }}>
                    {months.map(([k, cs]) => {
                      const lbl = new Date(k + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
                      const amt = cs.reduce((s, c) => s + c.net, 0);
                      return (
                        <div key={k} onClick={() => openList(`Money in hand since ${lbl}`, cs)}
                          onMouseEnter={ev => showTip(ev, `<b>${lbl}</b><br/>${fN(cs.length)} customers · ${fMoney(amt)} in hand<br/>click → list`)} onMouseLeave={hideTip}
                          style={{ flex: "0 0 42px", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", height: "100%" }}>
                          <div style={{ flex: 1, width: 26, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--ink)", textAlign: "center", marginBottom: 2 }}>{cs.length}</div>
                            <div style={{ height: `${(cs.length / mx) * 100}%`, background: GOLD, borderRadius: "3px 3px 0 0", minHeight: 3 }} />
                          </div>
                          <div style={{ fontSize: 9, color: "var(--mut)", fontWeight: 700, marginTop: 4, whiteSpace: "nowrap" }}>{lbl}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </Zoomable>
        </div>

        {/* ---------- the customers, one card, all details ---------- */}
        <Zoomable title="In-hand customers">
          <div style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
              <div>
                <h3 style={H3}>Customers Whose Money We Hold</h3>
                <div style={CAP}>{fN(oldest.length)} customers · click any column heading to sort ▲▼ · scroll for more · click a row → full receipt ledger</div>
              </div>
              <input value={tq} onChange={e => setTq(e.target.value)} placeholder="Search code / project…"
                style={{ width: 230, padding: "7px 12px", borderRadius: 9, border: "1px solid #d8d2c4", fontFamily: "inherit", fontSize: 12.5, outline: "none" }} />
            </div>
            <div style={{ overflowX: "auto", maxHeight: 430, overflowY: "auto", border: "1px solid #f0ede5", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 900 }}>
                <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                  {sortTh("Customer code", "code")}{sortTh("Project", "proj")}{sortTh("First EOI", "first")}{sortTh("Last activity", "last")}
                  {sortTh("Receipts", "n", true)}{sortTh("Paid (cleared)", "paid", true)}
                  {sortTh("Refunded", "ref", true)}{sortTh("Adjusted out", "adj", true)}
                  {sortTh("In hand", "hand", true)}{sortTh("Ageing", "age", true)}
                </tr></thead>
                <tbody>
                  {oldest.map(c => (
                    <tr key={c.code} onClick={() => setDrill({ title: "Pending customer", custs: [c] })} style={{ cursor: "pointer" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                      <td style={{ ...TD, fontWeight: 800, color: "var(--ink)" }}>{c.code}</td>
                      <td style={{ ...TD, color: "var(--mut)", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }}>{D.PROJECTS[c.projIdx].replace("SMARTWORLD ", "")}</td>
                      <td style={{ ...TD, color: "var(--mut)" }}>{fD(c.firstDay)}</td>
                      <td style={{ ...TD, color: "var(--mut)" }}>{fD(c.lastDay)}</td>
                      <td style={{ ...TD, textAlign: "right" }}>{c.n}</td>
                      <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: TEAL }}>{fMoney(c.cleared)}</td>
                      <td style={{ ...TD, textAlign: "right", color: c.refunds < 0 ? RED : "var(--mut)" }}>{c.refunds < 0 ? fMoney(Math.abs(c.refunds)) : "—"}</td>
                      <td style={{ ...TD, textAlign: "right", color: c.adj < 0 ? "#96691c" : "var(--mut)" }}>{c.adj < 0 ? fMoney(Math.abs(c.adj)) : "—"}</td>
                      <td style={{ ...TD, textAlign: "right", color: GREEN, fontWeight: 800, fontSize: 13 }}>{fMoney(c.net)}</td>
                      <td style={{ ...TD, textAlign: "right", fontWeight: 800, color: c.ageing > 365 ? RED : c.ageing > 180 ? "#96691c" : "var(--mut)" }}>{c.ageing} d</td>
                    </tr>
                  ))}
                  {!oldest.length && (
                    <tr><td colSpan={9} style={{ ...TD, textAlign: "center", color: "var(--mut)", padding: 24 }}>No customers match the current filters</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Zoomable>

        {/* ---------- pool + zero-in-hand context, one slim strip ---------- */}
        <div style={{ ...CARD, display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", background: "#faf9f6" }}>
          {POOLS.length > 0 && (
            <div onClick={() => openList("Collection pool account (pass-through)", POOLS, "EOIs land here first, then move to the customer's own code by journal voucher")}
              style={{ cursor: "pointer" }}
              onMouseEnter={e => showTip(e, "<b>Collection pool</b><br/>not a customer — click for its ledger")} onMouseLeave={hideTip}>
              <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                <b style={{ color: "#453a63" }}>Collection pool {POOLS.map(p => p.code).join(", ")}</b> — pass-through, holds {fMoney(POOLS.reduce((s, c) => s + c.net, 0))} in transit · <span style={{ color: GOLD, fontWeight: 700 }}>view ledger ›</span>
              </span>
            </div>
          )}
          <div onClick={() => openList("Pending in ERP, ₹0 in hand", ZERO_HAND, "status still ALLOTMENT PENDING but their money was fully adjusted to a sale order or refunded")}
            style={{ cursor: "pointer" }}
            onMouseEnter={e => showTip(e, "<b>₹0 in hand</b><br/>money fully adjusted or refunded — likely stale ERP status<br/>click → list")} onMouseLeave={hideTip}>
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
              <b>{fN(ZERO_HAND.length)} other codes</b> still say ALLOTMENT PENDING in the ERP but have ₹0 in hand (money adjusted to sale orders or refunded) · <span style={{ color: GOLD, fontWeight: 700 }}>view list ›</span>
            </span>
          </div>
        </div>

        {/* ---------- plain-language note ---------- */}
        <div style={{ ...CARD, background: "#fdfaf3", borderColor: "#efe4c8" }}>
          <h3 style={H3}>How to read this page</h3>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.65 }}>
            This page shows only the allotment-pending customers whose money is <b>still with us</b> — paid, cleared, not yet adjusted onto a sale order and not refunded. <b>Money type:</b> projects with RERA registration collect <b>Advance</b>; only <b>Code 67</b> collects <b>EOI</b>, because its RERA registration has not come yet. <b>In hand</b> = cleared − adjusted − refunded, per customer. <b>Ageing</b> counts days since their first EOI payment. Bounced instruments are excluded everywhere. Codes whose money already left (adjusted or refunded) and the pass-through collection pool are kept out of the numbers and reachable from the links above. No name or unit shows because the ERP captures those only at allotment.
          </div>
        </div>
      </div>

      <EoiDrawer sel={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
