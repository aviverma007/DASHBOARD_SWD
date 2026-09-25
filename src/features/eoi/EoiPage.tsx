import { useMemo, useState } from "react";
import { PageBanner } from "../../components/layout/PageBanner";
import { Zoomable } from "../../components/common/Zoomable";
import { showTip, hideTip } from "../../components/common/hoverTip";
import "../../components/inventory/smartworldInventory.css";
import raw from "../../data/eoiData.json";

/** EOI (Expression of Interest) dashboard — receipt-level export from
 * the ERP, aggregated to one row per customer. A customer's Customer
 * Status is the journey state:
 *   ALLOTMENT PENDING → EOI money in, unit not yet allotted
 *   ACTIVE            → allotted (has unit + allotment date)
 *   CANCEL            → cancelled after EOI/allotment
 * Money legs per customer, from Receipt Status:
 *   cleared  = realised EOI receipts (CLEARED)
 *   adj      = journal transfers out/in (ADJUSTMENT, usually −)
 *   refunds  = money returned (PAYMENT, −)
 *   bounced  = cheques/transfers that bounced (excluded from all totals)
 * net in hand = cleared + adj + refunds. */

/* ---------------- palette / styles (same language as PR→PO) ---------------- */
const TEAL = "#0E7490", GOLD = "#B8893C", GREEN = "#1BAF7A", RED = "#c0392b", AMBER = "#EDA100", NAVY = "#1c3f6e";
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
const isoOfDay = (d: number) => new Date(dayMs(d)).toISOString().slice(0, 10);
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
  net: number; ageing: number; convDays: number | null;
  receipts: Rcpt[];
}
const STATUS_LBL = ["Allotment Pending", "Allotted", "Cancelled"] as const;
const STATUS_COL = [AMBER, GREEN, RED] as const;

const ALL_CUSTS: Cust[] = (() => {
  const cs: Cust[] = D.C.map(c => {
    const cleared = c[8] as number, adj = c[9] as number, refunds = c[10] as number;
    const firstDay = c[6] as number, allotDay = c[5] as number, status = c[2] as 0 | 1 | 2;
    return {
      code: String(c[0]), projIdx: c[1] as number, status,
      name: String(c[3] || ""), unit: String(c[4] || ""), allotDay,
      firstDay, lastDay: c[7] as number,
      cleared, adj, refunds, bounced: c[11] as number, n: c[12] as number,
      net: cleared + adj + refunds,
      ageing: status === 0 && firstDay >= 0 ? Math.max(0, AS_ON - firstDay) : 0,
      convDays: status !== 0 && allotDay >= 0 && firstDay >= 0 ? Math.max(0, allotDay - firstDay) : null,
      receipts: [],
    };
  });
  D.R.forEach(r => {
    cs[r[0] as number].receipts.push({ day: r[1] as number, amt: r[2] as number, rs: r[3] as number, mode: r[4] as number, pt: r[5] as number, doc: String(r[6] || "") });
  });
  return cs;
})();

/* ---------------- drill drawer ---------------- */
interface Drill { title: string; sub?: string; custs: Cust[]; notes?: Map<string, string> }

function StatusPill({ s }: { s: 0 | 1 | 2 }) {
  return <span style={{ background: `${STATUS_COL[s]}1c`, color: STATUS_COL[s], fontWeight: 800, fontSize: 10.5, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>{STATUS_LBL[s]}</span>;
}

function EoiDrawer({ sel, onClose }: { sel: Drill | null; onClose: () => void }) {
  const [cust, setCust] = useState<Cust | null>(null);
  if (!sel) return null;
  const cs = sel.custs;
  const cleared = cs.reduce((s, c) => s + c.cleared, 0);
  const net = cs.reduce((s, c) => s + c.net, 0);
  const pend = cs.filter(c => c.status === 0);
  const avgAge = pend.length ? pend.reduce((s, c) => s + c.ageing, 0) / pend.length : null;
  const tile = (k: string, v: string, col = "var(--ink)") => (
    <div key={k} style={{ background: "#faf9f6", border: "1px solid #eee9dd", borderRadius: 10, padding: "8px 12px", minWidth: 118 }}>
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
                {cust ? <><span onClick={() => setCust(null)} style={{ color: GOLD, cursor: "pointer" }}>‹ {sel.title}</span> · {cust.name || cust.code}</> : sel.title}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 2 }}>{cust ? "receipt-level detail" : sel.sub ?? `${fN(cs.length)} customers`}</div>
            </div>
            <button onClick={() => { setCust(null); onClose(); }} style={{ background: "none", border: "none", fontSize: 24, color: "var(--mut)", cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>
          {!cust && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {tile("Customers", fN(cs.length))}
              {tile("EOI received", fMoney(cleared), TEAL)}
              {tile("Net in hand", fMoney(net), net >= 0 ? GREEN : RED)}
              {avgAge !== null ? tile("Avg ageing", `${Math.round(avgAge)} d`, avgAge > 180 ? RED : "#96691c") : null}
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {cust ? (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {tile("Status", STATUS_LBL[cust.status], STATUS_COL[cust.status])}
                {tile("EOI received", fMoney(cust.cleared), TEAL)}
                {tile("Adjustments", fMoney(cust.adj), cust.adj < 0 ? "#96691c" : "var(--ink)")}
                {tile("Refunds", fMoney(cust.refunds), cust.refunds < 0 ? RED : "var(--ink)")}
                {tile("Net in hand", fMoney(cust.net), cust.net >= 0 ? GREEN : RED)}
                {cust.bounced !== 0 ? tile("Bounced (excl.)", fMoney(cust.bounced), RED) : null}
              </div>
              <div style={{ ...CARD, marginBottom: 12 }}>
                <div className="kv" style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "5px 10px", fontSize: 12.5 }}>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>Customer code</div><div style={{ fontWeight: 700 }}>{cust.code}</div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>Name</div><div>{cust.name || "— (not captured until allotment)"}</div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>Unit</div><div>{cust.unit || "— not allotted yet"}</div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>First EOI receipt</div><div>{fD(cust.firstDay)}</div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>Last activity</div><div>{fD(cust.lastDay)}</div>
                  <div style={{ color: "var(--mut)", fontWeight: 700 }}>Allotment date</div><div>{cust.allotDay >= 0 ? fD(cust.allotDay) : "— pending"}</div>
                  {cust.status === 0 && <><div style={{ color: "var(--mut)", fontWeight: 700 }}>Ageing</div><div style={{ color: cust.ageing > 180 ? RED : "#96691c", fontWeight: 800 }}>{cust.ageing} days since first EOI</div></>}
                  {cust.convDays !== null && <><div style={{ color: "var(--mut)", fontWeight: 700 }}>EOI → allotment</div><div style={{ fontWeight: 700 }}>{cust.convDays} days</div></>}
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
                <th style={TH}>Customer</th><th style={TH}>Status</th><th style={TH}>First EOI</th>
                <th style={{ ...TH, textAlign: "right" }}>EOI received</th><th style={{ ...TH, textAlign: "right" }}>Net</th><th style={{ ...TH, textAlign: "right" }}>Ageing</th>
              </tr></thead>
              <tbody>
                {cs.map(c => (
                  <tr key={c.code} onClick={() => setCust(c)} style={{ cursor: "pointer" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                    <td style={{ ...TD, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ fontWeight: 800, color: "var(--ink)" }}>{c.name || c.code}</span>
                      <span style={{ color: "var(--mut)", marginLeft: 6, fontSize: 11 }}>{c.name ? c.code : ""}{c.unit ? ` · ${c.unit}` : ""}</span>
                      {sel.notes?.get(c.code) && <span style={{ color: GOLD, marginLeft: 6, fontSize: 11, fontWeight: 700 }}>{sel.notes.get(c.code)}</span>}
                    </td>
                    <td style={TD}><StatusPill s={c.status} /></td>
                    <td style={{ ...TD, color: "var(--mut)" }}>{fD(c.firstDay)}</td>
                    <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{fMoney(c.cleared)}</td>
                    <td style={{ ...TD, textAlign: "right", color: c.net >= 0 ? "var(--ink)" : "#96691c", fontWeight: 600 }}>{fMoney(c.net)}</td>
                    <td style={{ ...TD, textAlign: "right", fontWeight: c.status === 0 && c.ageing > 180 ? 800 : 600, color: c.status !== 0 ? "var(--mut)" : c.ageing > 180 ? RED : "#96691c" }}>
                      {c.status === 0 ? `${c.ageing} d` : c.convDays !== null ? `→ ${c.convDays} d` : "—"}
                    </td>
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

/* ---------------- page ---------------- */
export function EoiPage() {
  const [projF, setProjF] = useState<string[]>([]);          // empty = all
  const [statusF, setStatusF] = useState<-1 | 0 | 1 | 2>(-1);
  const [from, setFrom] = useState("");                       // ISO or ""
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [drill, setDrill] = useState<Drill | null>(null);
  const [showAllPending, setShowAllPending] = useState(false);

  const openList = (title: string, custs: Cust[], sub?: string, notes?: Map<string, string>) =>
    setDrill({ title, sub, custs: [...custs].sort((a, b) => b.cleared - a.cleared), notes });

  /* scope: project + status + first-EOI-date window + search */
  const scoped = useMemo(() => {
    const fromD = from ? dayOfIso(from) : -1;
    const toD = to ? dayOfIso(to) : Infinity;
    const s = q.trim().toLowerCase();
    return ALL_CUSTS.filter(c => {
      if (projF.length && !projF.includes(D.PROJECTS[c.projIdx])) return false;
      if (statusF !== -1 && c.status !== statusF) return false;
      if (c.firstDay >= 0 && (c.firstDay < fromD || c.firstDay > toD)) return false;
      if (fromD >= 0 && c.firstDay < 0) return false;
      if (s && !c.code.toLowerCase().includes(s) && !c.name.toLowerCase().includes(s) && !c.unit.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [projF, statusF, from, to, q]);

  const pending = scoped.filter(c => c.status === 0);
  const allotted = scoped.filter(c => c.status === 1);
  const cancelled = scoped.filter(c => c.status === 2);
  const sum = (cs: Cust[], k: "cleared" | "net" | "refunds" | "bounced") => cs.reduce((s, c) => s + c[k], 0);
  const avgAge = pending.length ? pending.reduce((s, c) => s + c.ageing, 0) / pending.length : null;
  const convs = allotted.map(c => c.convDays).filter((x): x is number => x !== null).sort((a, b) => a - b);
  const avgConv = convs.length ? convs.reduce((s, x) => s + x, 0) / convs.length : null;
  const bouncedTotal = sum(scoped, "bounced");
  const bouncedCusts = scoped.filter(c => c.bounced !== 0);

  /* pending bifurcations */
  const AGE_BANDS = [["0–90 d", 0, 90], ["91–180 d", 91, 180], ["181–270 d", 181, 270], ["271–365 d", 271, 365], ["> 1 year", 366, 1e9]] as const;
  const ageBreak = AGE_BANDS.map(([l, lo, hi]) => {
    const cs = pending.filter(c => c.ageing >= lo && c.ageing <= hi);
    return { l, cs, amt: sum(cs, "cleared") };
  });
  const AMT_SLABS = [["Fully adjusted / ≤ 0", -1e15, 0], ["Up to ₹1 L", 0.01, 1e5], ["₹1 L – ₹10 L", 1e5 + 0.01, 1e6], ["₹10 L – ₹50 L", 1e6 + 0.01, 5e6], ["₹50 L – ₹1 Cr", 5e6 + 0.01, 1e7], ["Above ₹1 Cr", 1e7 + 0.01, 1e15]] as const;
  const slabBreak = AMT_SLABS.map(([l, lo, hi]) => {
    const cs = pending.filter(c => c.net >= (lo as number) && c.net <= (hi as number));
    return { l, cs, amt: sum(cs, "cleared") };
  });
  const CONV_BANDS = [["Same month (0–30 d)", 0, 30], ["31–60 d", 31, 60], ["61–90 d", 61, 90], ["> 90 d", 91, 1e9]] as const;
  const convBreak = CONV_BANDS.map(([l, lo, hi]) => ({ l, cs: allotted.filter(c => c.convDays !== null && c.convDays >= lo && c.convDays <= hi) }));

  /* monthly intake: first-EOI month, stacked by outcome */
  const months = useMemo(() => {
    const m = new Map<string, { p: Cust[]; a: Cust[]; c: Cust[] }>();
    scoped.forEach(c => {
      if (c.firstDay < 0) return;
      const k = isoOfDay(c.firstDay).slice(0, 7);
      if (!m.has(k)) m.set(k, { p: [], a: [], c: [] });
      const e = m.get(k)!;
      (c.status === 0 ? e.p : c.status === 1 ? e.a : e.c).push(c);
    });
    return [...m.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1);
  }, [scoped]);

  const oldestPending = [...pending].sort((a, b) => b.ageing - a.ageing);
  const pendingRows = showAllPending ? oldestPending : oldestPending.slice(0, 15);

  const KPIS: [string, string, string, [string, string], () => void][] = [
    ["EOI customers", fN(scoped.length), `${fMoney(sum(scoped, "cleared"))} received · net ${fMoney(sum(scoped, "net"))}`, [NAVY, "#0f2547"], () => openList("All EOI customers", scoped)],
    ["Allotment Pending", fN(pending.length), `${fMoney(sum(pending, "cleared"))} EOI in · avg ageing ${avgAge !== null ? Math.round(avgAge) : "—"} d`, ["#c8871d", "#96691c"], () => openList("Allotment-pending customers", pending, "EOI paid, unit not yet allotted — oldest money first")],
    ["Allotted", fN(allotted.length), `${fMoney(sum(allotted, "cleared"))} · avg EOI→allotment ${avgConv !== null ? Math.round(avgConv) : "—"} d`, ["#1e9a6c", "#0f6647"], () => openList("Allotted customers", allotted)],
    ["Cancelled", fN(cancelled.length), `${fMoney(sum(cancelled, "cleared"))} received · ${fMoney(sum(cancelled, "refunds"))} refunded`, ["#c0392b", "#7e1f14"], () => openList("Cancelled customers", cancelled)],
    ["Bounced (excluded)", fMoney(bouncedTotal), `${fN(bouncedCusts.length)} customers had a bounce — not counted anywhere`, ["#6b5f8f", "#453a63"], () => openList("Customers with bounced instruments", bouncedCusts)],
  ];

  const selCls = (on: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 999, border: `1px solid ${on ? GOLD : "#d8d2c4"}`,
    background: on ? "#fdf6e8" : "#fff", color: on ? "#96691c" : "var(--mut)",
    fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  });

  return (
    <div className="sw-inv" style={{ minHeight: "100vh", background: "#f6f4ef", display: "flex", flexDirection: "column" }}>
      <PageBanner bleed title="EOI · Expression of Interest" sub={<>EOI money received vs allotment progress · data as on {D.meta.asOn} · bounced instruments excluded from every total</>} />
      <div style={{ padding: "14px 20px 24px", flex: 1 }}>

        {/* ---------- filters ---------- */}
        <div style={{ ...CARD, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          {/* project multi-select */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--mut)" }}>Project</span>
            {D.PROJECTS.map(p => {
              const on = projF.length === 0 || projF.includes(p);
              return (
                <button key={p} style={selCls(projF.includes(p))} title={on ? "Shown" : "Hidden"}
                  onClick={() => setProjF(f => f.includes(p) ? f.filter(x => x !== p) : [...f, p])}>
                  {p.replace("SMARTWORLD ", "")}
                </button>
              );
            })}
          </div>
          {/* status */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--mut)" }}>Status</span>
            {([[-1, "All"], [0, "Allotment Pending"], [1, "Allotted"], [2, "Cancelled"]] as const).map(([v, l]) => (
              <button key={v} style={selCls(statusF === v)} onClick={() => setStatusF(v)}>{l}</button>
            ))}
          </div>
          {/* period */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--mut)" }}>First EOI between</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid #d8d2c4", fontFamily: "inherit", fontSize: 12 }} />
            <span style={{ color: "var(--mut)" }}>→</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid #d8d2c4", fontFamily: "inherit", fontSize: 12 }} />
            {(from || to) && <button style={selCls(false)} onClick={() => { setFrom(""); setTo(""); }}>✕ clear</button>}
          </div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search customer code / name / unit…"
            style={{ marginLeft: "auto", width: 250, padding: "7px 12px", borderRadius: 9, border: "1px solid #d8d2c4", fontFamily: "inherit", fontSize: 12.5, outline: "none" }} />
        </div>

        {/* ---------- KPI strip ---------- */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))", gap: 12, marginBottom: 14 }}>
          {KPIS.map(([k, v, sub, [c1, c2], onClick]) => (
            <div key={k} style={{ ...GLASS(c1, c2), cursor: "pointer" }} onClick={onClick}
              onMouseEnter={e => showTip(e, `<b>${k}</b><br/>${sub}<br/>click → customer list`)} onMouseLeave={hideTip}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", opacity: 0.85 }}>{k}</div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 30, fontWeight: 700, margin: "4px 0 2px" }}>{v}</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ---------- pending bifurcation ---------- */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14, marginBottom: 14 }}>
          <Zoomable title="Pending ageing" collapsible>
            <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
              <h3 style={H3}>Allotment Pending — Ageing</h3>
              <div style={CAP}>days since the customer's first EOI receipt, still not allotted · count + EOI money waiting</div>
              {(() => {
                const mx = Math.max(...ageBreak.map(b => b.cs.length), 1);
                return ageBreak.map((b, i) => (
                  <div key={b.l} className="barrow" style={{ padding: "5px 0", cursor: "pointer" }}
                    onClick={() => openList(`Pending ${b.l}`, b.cs, "sorted by EOI amount")}
                    onMouseEnter={e => showTip(e, `<b>${b.l}</b><br/>${fN(b.cs.length)} customers · ${fMoney(b.amt)} EOI received<br/>click → list`)} onMouseLeave={hideTip}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, color: "var(--ink)" }}>{b.l}</span>
                      <span style={{ fontWeight: 800, color: "var(--mut)" }}>{fN(b.cs.length)} <span style={{ color: GOLD }}>· {fMoney(b.amt)}</span></span>
                    </div>
                    <div style={{ height: 10, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(b.cs.length / mx) * 100}%`, background: i >= 3 ? RED : i >= 1 ? AMBER : GREEN, borderRadius: 5 }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </Zoomable>

          <Zoomable title="Pending by amount" collapsible>
            <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
              <h3 style={H3}>Allotment Pending — Money In Hand</h3>
              <div style={CAP}>net EOI money still held per customer (received − adjusted out − refunded) · most pending EOIs have already been adjusted to a sale order or refunded</div>
              {(() => {
                const mx = Math.max(...slabBreak.map(b => b.cs.length), 1);
                return slabBreak.map(b => (
                  <div key={b.l} className="barrow" style={{ padding: "5px 0", cursor: "pointer" }}
                    onClick={() => openList(`Pending · ${b.l}`, b.cs)}
                    onMouseEnter={e => showTip(e, `<b>${b.l}</b><br/>${fN(b.cs.length)} customers · ${fMoney(b.amt)} originally received<br/>click → list`)} onMouseLeave={hideTip}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, color: "var(--ink)" }}>{b.l}</span>
                      <span style={{ fontWeight: 800, color: "var(--mut)" }}>{fN(b.cs.length)}</span>
                    </div>
                    <div style={{ height: 10, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(b.cs.length / mx) * 100}%`, background: TEAL, borderRadius: 5 }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </Zoomable>

          <Zoomable title="EOI to allotment speed" collapsible>
            <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
              <h3 style={H3}>How Fast Do EOIs Convert?</h3>
              <div style={CAP}>days from first EOI receipt to allotment, for the {fN(allotted.length)} allotted customers</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {[["Average", avgConv !== null ? `${Math.round(avgConv)} d` : "—"],
                  ["Median", convs.length ? `${convs[Math.floor(convs.length / 2)]} d` : "—"],
                  ["Fastest", convs.length ? `${convs[0]} d` : "—"],
                  ["Slowest", convs.length ? `${convs[convs.length - 1]} d` : "—"]].map(([k, v]) => (
                    <div key={k} style={{ background: "#faf9f6", border: "1px solid #eee9dd", borderRadius: 10, padding: "7px 12px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
                      <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: GREEN }}>{v}</div>
                    </div>
                  ))}
              </div>
              {(() => {
                const mx = Math.max(...convBreak.map(b => b.cs.length), 1);
                return convBreak.map(b => (
                  <div key={b.l} className="barrow" style={{ padding: "4.5px 0", cursor: "pointer" }}
                    onClick={() => openList(`Converted in ${b.l}`, b.cs)}
                    onMouseEnter={e => showTip(e, `<b>${b.l}</b><br/>${fN(b.cs.length)} customers<br/>click → list`)} onMouseLeave={hideTip}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, color: "var(--ink)" }}>{b.l}</span>
                      <span style={{ fontWeight: 800, color: "var(--mut)" }}>{fN(b.cs.length)}</span>
                    </div>
                    <div style={{ height: 9, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(b.cs.length / mx) * 100}%`, background: GREEN, borderRadius: 5 }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </Zoomable>
        </div>

        {/* ---------- monthly intake ---------- */}
        <Zoomable title="Monthly EOI intake" collapsible>
          <div style={CARD}>
            <h3 style={H3}>Monthly EOI Intake — Where Did Each Month's Customers End Up?</h3>
            <div style={CAP}>customers by month of their first EOI receipt · <span style={{ color: "#96691c", fontWeight: 800 }}>■ still pending</span> · <span style={{ color: GREEN, fontWeight: 800 }}>■ allotted</span> · <span style={{ color: RED, fontWeight: 800 }}>■ cancelled</span> · click a bar → that month's customers</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 170, overflowX: "auto", paddingBottom: 4 }}>
              {(() => {
                const mx = Math.max(...months.map(([, e]) => e.p.length + e.a.length + e.c.length), 1);
                return months.map(([k, e]) => {
                  const tot = e.p.length + e.a.length + e.c.length;
                  const lbl = new Date(k + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
                  return (
                    <div key={k} onClick={() => openList(`EOIs started in ${lbl}`, [...e.p, ...e.a, ...e.c])}
                      onMouseEnter={ev => showTip(ev, `<b>${lbl}</b><br/>${fN(tot)} customers<br/>pending ${e.p.length} · allotted ${e.a.length} · cancelled ${e.c.length}<br/>click → list`)} onMouseLeave={hideTip}
                      style={{ flex: "0 0 46px", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", height: "100%" }}>
                      <div style={{ flex: 1, width: 30, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--ink)", textAlign: "center", marginBottom: 2 }}>{tot}</div>
                        <div style={{ height: `${(e.c.length / mx) * 100}%`, background: RED, borderRadius: e.p.length + e.a.length === 0 ? "3px 3px 0 0" : 0 }} />
                        <div style={{ height: `${(e.a.length / mx) * 100}%`, background: GREEN }} />
                        <div style={{ height: `${(e.p.length / mx) * 100}%`, background: AMBER, borderRadius: "0 0 3px 3px" }} />
                      </div>
                      <div style={{ fontSize: 9.5, color: "var(--mut)", fontWeight: 700, marginTop: 4, whiteSpace: "nowrap" }}>{lbl}</div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </Zoomable>

        {/* ---------- oldest pending table ---------- */}
        <Zoomable title="Pending customers" collapsible>
          <div style={CARD}>
            <h3 style={H3}>Allotment Pending — Oldest First</h3>
            <div style={CAP}>{fN(pending.length)} customers waiting · the ones whose EOI money has waited longest on top · click a row → receipts</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 860 }}>
                <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                  <th style={TH}>Customer code</th><th style={TH}>First EOI</th><th style={TH}>Last activity</th>
                  <th style={{ ...TH, textAlign: "right" }}>Receipts</th><th style={{ ...TH, textAlign: "right" }}>EOI received</th>
                  <th style={{ ...TH, textAlign: "right" }}>Net in hand</th><th style={{ ...TH, textAlign: "right" }}>Ageing</th>
                </tr></thead>
                <tbody>
                  {pendingRows.map(c => (
                    <tr key={c.code} onClick={() => setDrill({ title: "Pending customer", custs: [c] })} style={{ cursor: "pointer" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                      <td style={{ ...TD, fontWeight: 800, color: "var(--ink)" }}>{c.code}</td>
                      <td style={{ ...TD, color: "var(--mut)" }}>{fD(c.firstDay)}</td>
                      <td style={{ ...TD, color: "var(--mut)" }}>{fD(c.lastDay)}</td>
                      <td style={{ ...TD, textAlign: "right" }}>{c.n}</td>
                      <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{fMoney(c.cleared)}</td>
                      <td style={{ ...TD, textAlign: "right", color: c.net > 0 ? GREEN : "var(--mut)", fontWeight: 700 }}>{fMoney(c.net)}</td>
                      <td style={{ ...TD, textAlign: "right", fontWeight: 800, color: c.ageing > 365 ? RED : c.ageing > 180 ? "#96691c" : "var(--mut)" }}>{c.ageing} d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pending.length > 15 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 12 }}>
                <span style={{ color: "var(--mut)" }}>Showing {fN(pendingRows.length)} of {fN(pending.length)}</span>
                <button onClick={() => setShowAllPending(v => !v)}
                  style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid #d8d2c4", background: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                  {showAllPending ? "Show top 15" : `Show all ${fN(pending.length)}`}
                </button>
              </div>
            )}
          </div>
        </Zoomable>

        {/* ---------- plain-language note ---------- */}
        <div style={{ ...CARD, background: "#fdfaf3", borderColor: "#efe4c8" }}>
          <h3 style={H3}>How to read this page</h3>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.65 }}>
            An <b>EOI customer</b> paid expression-of-interest money before getting a unit. <b>Allotment Pending</b> means the money came in but no unit is allotted yet — their <b>ageing</b> counts the days since their first payment. Once allotted they become <b>Allotted</b> (name, unit and allotment date appear in the ERP at that point, which is why pending customers show only their code). <b>Net in hand</b> is what remains after journal adjustments (money moved onto a sale order) and refunds — so a pending customer with ₹0 net usually had their EOI adjusted or refunded already, and the ones with real money still held are the ones to chase. <b>Bounced</b> instruments are excluded from every figure on this page.
          </div>
        </div>
      </div>

      <EoiDrawer sel={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
