import { useMemo, useState } from "react";
import { PageBanner } from "../../components/layout/PageBanner";
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

  const openList = (title: string, custs: Cust[], sub?: string) =>
    setDrill({ title, sub, custs: [...custs].sort((a, b) => b.net - a.net) });

  /* scope = customers whose money we still hold */
  const scoped = useMemo(() => {
    const fromD = from ? dayOfIso(from) : -1;
    const toD = to ? dayOfIso(to) : Infinity;
    const s = q.trim().toLowerCase();
    return HOLDING.filter(c => {
      if (projF.length && !projF.includes(D.PROJECTS[c.projIdx])) return false;
      if (c.firstDay >= 0 && (c.firstDay < fromD || c.firstDay > toD)) return false;
      if (fromD >= 0 && c.firstDay < 0) return false;
      if (s && !c.code.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [projF, from, to, q]);

  const inHand = scoped.reduce((s, c) => s + c.net, 0);
  const paidTot = scoped.reduce((s, c) => s + c.cleared, 0);
  const refTot = scoped.reduce((s, c) => s + c.refunds, 0);
  const adjTot = scoped.reduce((s, c) => s + Math.min(c.adj, 0), 0);
  const avgAge = scoped.length ? scoped.reduce((s, c) => s + c.ageing, 0) / scoped.length : null;
  const oldest = [...scoped].sort((a, b) => b.ageing - a.ageing);

  const KPIS: [string, string, string, [string, string], () => void][] = [
    ["Allotment Pending", fN(scoped.length), "customers whose EOI money is still with us", ["#c8871d", "#96691c"], () => openList("Allotment pending — money in hand", scoped)],
    ["Money in hand", fMoney(inHand), "held EOI money awaiting allotment", ["#1e9a6c", "#0f6647"], () => openList("Money in hand", scoped)],
    ["They paid in total", fMoney(paidTot), "cleared receipts from these customers", [NAVY, "#0f2547"], () => openList("Total paid by in-hand customers", scoped)],
    ["Part refunded / adjusted", fMoney(Math.abs(refTot + adjTot)), "portion of their money already returned or moved", ["#c0392b", "#7e1f14"], () => openList("In-hand customers with part refunded / adjusted", scoped.filter(c => c.refunds < 0 || c.adj < 0))],
    ["Avg ageing", avgAge !== null ? `${Math.round(avgAge)} d` : "—", "days since first EOI payment, still not allotted", ["#1a7f9c", "#0e5468"], () => openList("In-hand customers by ageing", scoped)],
  ];

  const selCls = (on: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 999, border: `1px solid ${on ? GOLD : "#d8d2c4"}`,
    background: on ? "#fdf6e8" : "#fff", color: on ? "#96691c" : "var(--mut)",
    fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  });

  return (
    <div className="sw-inv" style={{ minHeight: "100vh", background: "#f6f4ef", display: "flex", flexDirection: "column" }}>
      <PageBanner bleed title="EOI · Allotment Pending" sub={<>customers whose EOI money is still in hand · data as on {D.meta.asOn} · bounced instruments excluded</>} />
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

        {/* ---------- the customers, one card, all details ---------- */}
        <Zoomable title="In-hand customers">
          <div style={CARD}>
            <h3 style={H3}>Customers Whose Money We Hold — Oldest Wait First</h3>
            <div style={CAP}>every allotment-pending customer with EOI money still in hand · click a row → full receipt ledger</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 900 }}>
                <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                  <th style={TH}>Customer code</th><th style={TH}>First EOI</th><th style={TH}>Last activity</th>
                  <th style={{ ...TH, textAlign: "right" }}>Receipts</th><th style={{ ...TH, textAlign: "right" }}>Paid (cleared)</th>
                  <th style={{ ...TH, textAlign: "right" }}>Refunded</th><th style={{ ...TH, textAlign: "right" }}>Adjusted out</th>
                  <th style={{ ...TH, textAlign: "right" }}>In hand</th><th style={{ ...TH, textAlign: "right" }}>Ageing</th>
                </tr></thead>
                <tbody>
                  {oldest.map(c => (
                    <tr key={c.code} onClick={() => setDrill({ title: "Pending customer", custs: [c] })} style={{ cursor: "pointer" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                      <td style={{ ...TD, fontWeight: 800, color: "var(--ink)" }}>{c.code}</td>
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
            This page shows only the allotment-pending customers whose EOI money is <b>still with us</b> — paid, cleared, not yet adjusted onto a sale order and not refunded. <b>In hand</b> = cleared − adjusted − refunded, per customer. <b>Ageing</b> counts days since their first EOI payment. Bounced instruments are excluded everywhere. Codes whose money already left (adjusted or refunded) and the pass-through collection pool are kept out of the numbers and reachable from the links above. No name or unit shows because the ERP captures those only at allotment.
          </div>
        </div>
      </div>

      <EoiDrawer sel={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
