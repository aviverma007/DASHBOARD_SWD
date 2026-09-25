import { useMemo, useState } from "react";
import { PageBanner } from "../../components/layout/PageBanner";
import { Zoomable } from "../../components/common/Zoomable";
import { showTip, hideTip } from "../../components/common/hoverTip";
import "../../components/inventory/smartworldInventory.css";
import raw from "../../data/eoiData.json";

/** EOI (Expression of Interest) — ALLOTMENT PENDING dashboard.
 * Built from the full receipt-level ERP export (every row read, every
 * money leg classified). The page answers one question:
 *   "How many customers have PAID EOI money and are still waiting
 *    for allotment — and where did that money go?"
 * Money legs per receipt (Receipt Status):
 *   CLEARED    = money actually received (this is "paid")
 *   PAYMENT    = money refunded back to the customer (−)
 *   ADJUSTMENT = journal transfer (moved onto a sale order / other code)
 *   BOUNCE     = failed instrument — EXCLUDED from every figure here */

/* ---------------- palette / styles ---------------- */
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
/* the page is pending-only */
const PENDING = ALL_CUSTS.filter(c => c.status === 0);

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
                    <td style={{ ...TD, fontWeight: 800, color: "var(--ink)" }}>{c.code}</td>
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

/* ---------------- page ---------------- */
export function EoiPage() {
  const [projF, setProjF] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [drill, setDrill] = useState<Drill | null>(null);
  const [showAllPending, setShowAllPending] = useState(false);

  const openList = (title: string, custs: Cust[], sub?: string) =>
    setDrill({ title, sub, custs: [...custs].sort((a, b) => b.ageing - a.ageing) });

  /* scope: pending only + project + first-EOI window + search */
  const scoped = useMemo(() => {
    const fromD = from ? dayOfIso(from) : -1;
    const toD = to ? dayOfIso(to) : Infinity;
    const s = q.trim().toLowerCase();
    return PENDING.filter(c => {
      if (projF.length && !projF.includes(D.PROJECTS[c.projIdx])) return false;
      if (c.firstDay >= 0 && (c.firstDay < fromD || c.firstDay > toD)) return false;
      if (fromD >= 0 && c.firstDay < 0) return false;
      if (s && !c.code.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [projF, from, to, q]);

  const sum = (cs: Cust[], k: "cleared" | "net" | "refunds" | "adj" | "bounced") => cs.reduce((s, c) => s + c[k], 0);
  /* THE headline: customers who actually paid (cleared money in) and still wait */
  const paid = scoped.filter(c => c.cleared > 0);
  const refunded = scoped.filter(c => c.refunds < 0);
  const adjusted = scoped.filter(c => c.adj < 0);
  const holding = scoped.filter(c => c.net > 1000);
  const avgAge = paid.length ? paid.reduce((s, c) => s + c.ageing, 0) / paid.length : null;

  /* payment kinds — every mode of payment, from CLEARED receipts only
     (money actually received; bounce never counted) */
  const modeCards = useMemo(() => {
    const m = new Map<number, { n: number; amt: number; custs: Set<Cust> }>();
    scoped.forEach(c => c.receipts.forEach(r => {
      if (r.rs !== 0 || r.amt <= 0) return;               // CLEARED, money in
      if (!m.has(r.mode)) m.set(r.mode, { n: 0, amt: 0, custs: new Set() });
      const e = m.get(r.mode)!; e.n++; e.amt += r.amt; e.custs.add(c);
    }));
    return [...m.entries()].sort((a, b) => b[1].amt - a[1].amt);
  }, [scoped]);

  /* ageing + in-hand bifurcations (paid customers) */
  const AGE_BANDS = [["0–90 d", 0, 90], ["91–180 d", 91, 180], ["181–270 d", 181, 270], ["271–365 d", 271, 365], ["> 1 year", 366, 1e9]] as const;
  const ageBreak = AGE_BANDS.map(([l, lo, hi]) => {
    const cs = paid.filter(c => c.ageing >= lo && c.ageing <= hi);
    return { l, cs, amt: sum(cs, "cleared") };
  });
  const moneyBreak = [
    { l: "Still holding money (net > ₹1,000)", cs: holding, col: GREEN },
    { l: "Adjusted to sale order / other code", cs: adjusted, col: "#96691c" },
    { l: "Refunded back", cs: refunded, col: RED },
    { l: "Paid only token (≤ ₹1,000 cleared)", cs: scoped.filter(c => c.cleared > 0 && c.cleared <= 1000), col: "#6b5f8f" },
    { l: "No cleared money at all", cs: scoped.filter(c => c.cleared <= 0), col: "#9a927e" },
  ];

  /* monthly intake of pending customers (first EOI month) */
  const months = useMemo(() => {
    const m = new Map<string, Cust[]>();
    scoped.forEach(c => {
      if (c.firstDay < 0) return;
      const k = isoOfDay(c.firstDay).slice(0, 7);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    });
    return [...m.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1);
  }, [scoped]);

  const oldest = [...paid].sort((a, b) => b.ageing - a.ageing);
  const pendingRows = showAllPending ? oldest : oldest.slice(0, 15);

  const KPIS: [string, string, string, [string, string], () => void][] = [
    ["Paid · Allotment Pending", fN(paid.length), `paid ${fMoney(sum(paid, "cleared"))} · avg waiting ${avgAge !== null ? Math.round(avgAge) : "—"} d`, ["#c8871d", "#96691c"], () => openList("Paid & awaiting allotment", paid, "customers with cleared EOI money, no unit allotted")],
    ["EOI received", fMoney(sum(scoped, "cleared")), `cleared money in from ${fN(paid.length)} customers`, [NAVY, "#0f2547"], () => openList("EOI received — all pending customers", paid)],
    ["Refunded back", fMoney(Math.abs(sum(scoped, "refunds"))), `${fN(refunded.length)} customers got money returned`, ["#c0392b", "#7e1f14"], () => openList("Pending customers refunded", refunded)],
    ["Adjusted / moved out", fMoney(Math.abs(Math.min(sum(scoped, "adj"), 0))), `${fN(adjusted.length)} customers — EOI shifted via journal voucher`, ["#1a7f9c", "#0e5468"], () => openList("Pending customers with EOI adjusted out", adjusted)],
    ["Still in hand", fMoney(sum(scoped, "net")), `${fN(holding.length)} customers' money not yet adjusted or refunded`, ["#1e9a6c", "#0f6647"], () => openList("Pending customers still holding money", holding)],
  ];

  const selCls = (on: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 999, border: `1px solid ${on ? GOLD : "#d8d2c4"}`,
    background: on ? "#fdf6e8" : "#fff", color: on ? "#96691c" : "var(--mut)",
    fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  });

  return (
    <div className="sw-inv" style={{ minHeight: "100vh", background: "#f6f4ef", display: "flex", flexDirection: "column" }}>
      <PageBanner bleed title="EOI · Allotment Pending" sub={<>{fN(PENDING.length)} pending customer codes in the export · data as on {D.meta.asOn} · bounced instruments excluded from every figure</>} />
      <div style={{ padding: "14px 20px 24px", flex: 1 }}>

        {/* ---------- filters ---------- */}
        <div style={{ ...CARD, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--mut)" }}>Project</span>
            {D.PROJECTS.map(p => (
              <button key={p} style={selCls(projF.includes(p))}
                onClick={() => setProjF(f => f.includes(p) ? f.filter(x => x !== p) : [...f, p])}>
                {p.replace("SMARTWORLD ", "")}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--mut)" }}>First EOI between</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid #d8d2c4", fontFamily: "inherit", fontSize: 12 }} />
            <span style={{ color: "var(--mut)" }}>→</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid #d8d2c4", fontFamily: "inherit", fontSize: 12 }} />
            {(from || to) && <button style={selCls(false)} onClick={() => { setFrom(""); setTo(""); }}>✕ clear</button>}
          </div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search customer code…"
            style={{ marginLeft: "auto", width: 220, padding: "7px 12px", borderRadius: 9, border: "1px solid #d8d2c4", fontFamily: "inherit", fontSize: 12.5, outline: "none" }} />
        </div>

        {/* ---------- headline KPI cards ---------- */}
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

        {/* ---------- payment kinds (cleared money in, per mode) ---------- */}
        <Zoomable title="Payment kinds" collapsible>
          <div style={CARD}>
            <h3 style={H3}>How the EOI Money Came In — by Payment Kind</h3>
            <div style={CAP}>cleared receipts only (money actually received) · bounced instruments never counted · click a card → the customers who paid that way</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
              {modeCards.map(([mi, e]) => (
                <div key={mi} onClick={() => openList(`Paid via ${D.MODE[mi]}`, [...e.custs])}
                  onMouseEnter={ev => showTip(ev, `<b>${D.MODE[mi]}</b><br/>${fMoney(e.amt)} across ${fN(e.n)} receipts<br/>${fN(e.custs.size)} customers · click → list`)} onMouseLeave={hideTip}
                  style={{ background: "#faf9f6", border: "1px solid #eee9dd", borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--mut)" }}>{D.MODE[mi]}</div>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, color: TEAL, margin: "3px 0 1px" }}>{fMoney(e.amt)}</div>
                  <div style={{ fontSize: 11, color: "var(--mut)" }}>{fN(e.custs.size)} customers · {fN(e.n)} receipts</div>
                </div>
              ))}
            </div>
          </div>
        </Zoomable>

        {/* ---------- where the money stands + ageing ---------- */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 14, marginBottom: 14 }}>
          <Zoomable title="Money status" collapsible>
            <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
              <h3 style={H3}>Where Their Money Stands Now</h3>
              <div style={CAP}>a customer can appear in more than one row (part refunded, part adjusted) · click → list</div>
              {(() => {
                const mx = Math.max(...moneyBreak.map(b => b.cs.length), 1);
                return moneyBreak.map(b => (
                  <div key={b.l} className="barrow" style={{ padding: "5px 0", cursor: "pointer" }}
                    onClick={() => openList(b.l, b.cs)}
                    onMouseEnter={e => showTip(e, `<b>${b.l}</b><br/>${fN(b.cs.length)} customers<br/>click → list`)} onMouseLeave={hideTip}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, color: "var(--ink)" }}>{b.l}</span>
                      <span style={{ fontWeight: 800, color: "var(--mut)" }}>{fN(b.cs.length)}</span>
                    </div>
                    <div style={{ height: 10, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(b.cs.length / mx) * 100}%`, background: b.col, borderRadius: 5 }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </Zoomable>

          <Zoomable title="Pending ageing" collapsible>
            <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
              <h3 style={H3}>How Long Have Paid Customers Waited?</h3>
              <div style={CAP}>days since first EOI payment, still not allotted · count + money paid · click → list</div>
              {(() => {
                const mx = Math.max(...ageBreak.map(b => b.cs.length), 1);
                return ageBreak.map((b, i) => (
                  <div key={b.l} className="barrow" style={{ padding: "5px 0", cursor: "pointer" }}
                    onClick={() => openList(`Waiting ${b.l}`, b.cs)}
                    onMouseEnter={e => showTip(e, `<b>${b.l}</b><br/>${fN(b.cs.length)} customers · ${fMoney(b.amt)} paid<br/>click → list`)} onMouseLeave={hideTip}>
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
        </div>

        {/* ---------- monthly intake ---------- */}
        <Zoomable title="Monthly intake" collapsible>
          <div style={CARD}>
            <h3 style={H3}>When Did Today's Pending Customers First Pay?</h3>
            <div style={CAP}>pending customers by the month of their first EOI receipt · older bars = longer-waiting money · click a bar → that month's customers</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 150, overflowX: "auto", paddingBottom: 4 }}>
              {(() => {
                const mx = Math.max(...months.map(([, cs]) => cs.length), 1);
                return months.map(([k, cs]) => {
                  const lbl = new Date(k + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
                  const amt = cs.reduce((s, c) => s + c.cleared, 0);
                  return (
                    <div key={k} onClick={() => openList(`Pending since ${lbl}`, cs)}
                      onMouseEnter={ev => showTip(ev, `<b>${lbl}</b><br/>${fN(cs.length)} still-pending customers<br/>${fMoney(amt)} paid · click → list`)} onMouseLeave={hideTip}
                      style={{ flex: "0 0 46px", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", height: "100%" }}>
                      <div style={{ flex: 1, width: 30, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--ink)", textAlign: "center", marginBottom: 2 }}>{cs.length}</div>
                        <div style={{ height: `${(cs.length / mx) * 100}%`, background: AMBER, borderRadius: "3px 3px 0 0" }} />
                      </div>
                      <div style={{ fontSize: 9.5, color: "var(--mut)", fontWeight: 700, marginTop: 4, whiteSpace: "nowrap" }}>{lbl}</div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </Zoomable>

        {/* ---------- oldest paid-pending table ---------- */}
        <Zoomable title="Pending customers" collapsible>
          <div style={CARD}>
            <h3 style={H3}>Paid & Awaiting Allotment — Oldest First</h3>
            <div style={CAP}>{fN(paid.length)} customers who paid real money · longest wait on top · click a row → their receipts</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 880 }}>
                <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                  <th style={TH}>Customer code</th><th style={TH}>First EOI</th><th style={TH}>Last activity</th>
                  <th style={{ ...TH, textAlign: "right" }}>Receipts</th><th style={{ ...TH, textAlign: "right" }}>Paid (cleared)</th>
                  <th style={{ ...TH, textAlign: "right" }}>Refunded</th><th style={{ ...TH, textAlign: "right" }}>Still in hand</th><th style={{ ...TH, textAlign: "right" }}>Ageing</th>
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
                      <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: TEAL }}>{fMoney(c.cleared)}</td>
                      <td style={{ ...TD, textAlign: "right", color: c.refunds < 0 ? RED : "var(--mut)" }}>{c.refunds < 0 ? fMoney(Math.abs(c.refunds)) : "—"}</td>
                      <td style={{ ...TD, textAlign: "right", color: c.net > 1000 ? GREEN : "var(--mut)", fontWeight: 700 }}>{fMoney(c.net)}</td>
                      <td style={{ ...TD, textAlign: "right", fontWeight: 800, color: c.ageing > 365 ? RED : c.ageing > 180 ? "#96691c" : "var(--mut)" }}>{c.ageing} d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {paid.length > 15 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 12 }}>
                <span style={{ color: "var(--mut)" }}>Showing {fN(pendingRows.length)} of {fN(paid.length)}</span>
                <button onClick={() => setShowAllPending(v => !v)}
                  style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid #d8d2c4", background: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                  {showAllPending ? "Show top 15" : `Show all ${fN(paid.length)}`}
                </button>
              </div>
            )}
          </div>
        </Zoomable>

        {/* ---------- plain-language note ---------- */}
        <div style={{ ...CARD, background: "#fdfaf3", borderColor: "#efe4c8" }}>
          <h3 style={H3}>How to read this page</h3>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.65 }}>
            Every customer here is <b>ALLOTMENT PENDING</b> in the ERP — they expressed interest, but no unit is allotted, so no name or unit shows yet (the ERP captures those at allotment). <b>Paid</b> means cleared money actually came in. From there the money went one of three ways: it is <b>still in hand</b>, it was <b>adjusted</b> onto a sale order or another customer code by journal voucher, or it was <b>refunded</b>. <b>Ageing</b> counts days since the first EOI payment. Bounced cheques and failed transfers are excluded from every number on this page.
          </div>
        </div>
      </div>

      <EoiDrawer sel={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
