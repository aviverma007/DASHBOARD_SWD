import { useMemo, useState } from "react";
import { PageBanner, BannerPills, BANNER_LBL, BANNER_CTL } from "../../components/layout/PageBanner";
import { LiveDataBadge } from "../../components/layout/LiveDataBadge";
import { showTip, hideTip } from "../../components/common/hoverTip";
import "../../components/inventory/smartworldInventory.css";
import raw from "../../data/dappData.json";

/** Due / Undue — SAP ZSD_DAPP ("Due / Undue as per Payment Plan Milestone"), one row per
 * payment-plan milestone of every booked unit, refreshed from SAP at 1 PM and 5 PM.
 *   Due   = milestones SAP has raised (SAP's "Due" option): amount, received, outstanding, overdue age
 *   Undue = milestones still to come (SAP's "Undue" option): the future collection schedule */

const TEAL = "#0E7490", GOLD = "#B8893C", GREEN = "#1BAF7A", RED = "#c0392b", NAVY = "#1c3f6e", PURPLE = "#6b5f8f";
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #eae6da", borderRadius: 12, boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)", padding: "14px 16px", marginBottom: 14 };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 15.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 2px" };
const CAP: React.CSSProperties = { fontSize: 11, color: "var(--mut)", marginBottom: 10 };
const TH: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "8px 10px", borderBottom: "2px solid #eae6da", whiteSpace: "nowrap", textAlign: "left" };
const TD: React.CSSProperties = { padding: "6px 10px", borderBottom: "1px solid #f0ede5", whiteSpace: "nowrap" };
const NUM: React.CSSProperties = { ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const GLASS = (c1: string, c2: string): React.CSSProperties => ({
  background: `linear-gradient(150deg, ${c1} 0%, ${c2} 100%)`, border: "1px solid rgba(255,255,255,.35)", borderRadius: 14,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), 0 10px 24px rgba(20,33,61,.28), 0 2px 6px rgba(20,33,61,.18)",
  padding: "14px 16px", color: "#fff", cursor: "pointer",
});
const fN = (n: number) => Math.round(n).toLocaleString("en-IN");
const fMoney = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
};
const EPOCH = Date.UTC(2022, 0, 1), DAY = 86400000;
const fD = (d: number) => d < 0 ? "—" : new Date(EPOCH + d * DAY).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" });
const monthKey = (d: number) => { const t = new Date(EPOCH + d * DAY); return t.getUTCFullYear() * 12 + t.getUTCMonth(); };
const monthLbl = (k: number) => new Date(Date.UTC(Math.floor(k / 12), k % 12, 1)).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

interface DappFile {
  meta: { asOn: string; asOnDay: number; rows: number; source: string };
  P: string[]; M: string[]; PL: string[]; T: string[]; C: string[][]; R: (number | string)[][];
}
const D = raw as unknown as DappFile;
interface Ms {
  kind: 0 | 1; proj: number; cust: number; unit: string; so: string; ms: number; due: number; bill: number;
  amount: number; received: number; outstanding: number; plan: number; tower: number;
}
const ALL: Ms[] = D.R.map(r => ({
  kind: r[0] as 0 | 1, proj: r[1] as number, cust: r[2] as number, unit: String(r[3]), so: String(r[4]), ms: r[5] as number,
  due: r[6] as number, bill: r[7] as number, amount: r[8] as number, received: r[9] as number, outstanding: r[10] as number,
  plan: r[11] as number, tower: r[12] as number,
}));
const AS_ON = D.meta.asOnDay >= 0 ? D.meta.asOnDay : Math.round((Date.now() - EPOCH) / DAY);
const AGE = [[0, 30, "0–30 d"], [31, 60, "31–60 d"], [61, 90, "61–90 d"], [91, 180, "91–180 d"], [181, 365, "181–365 d"], [366, 1e9, "> 1 year"]] as const;
const ageOf = (m: Ms) => m.due >= 0 ? AS_ON - m.due : -1;
const sum = (ms: Ms[], f: (m: Ms) => number) => ms.reduce((s, m) => s + f(m), 0);

interface Drill { title: string; rows: Ms[] }

function Drawer({ sel, onClose }: { sel: Drill | null; onClose: () => void }) {
  if (!sel) return null;
  const rows = [...sel.rows].sort((a, b) => b.outstanding - a.outstanding || a.due - b.due);
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(14,22,45,0.45)", zIndex: 220 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(980px, 96vw)", background: "#fdfcf9", zIndex: 221, boxShadow: "-18px 0 50px rgba(14,22,45,0.35)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #eae6da", background: "#fff", display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>{sel.title}</div>
            <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 2 }}>
              {fN(rows.length)} milestones · amount {fMoney(sum(rows, m => m.amount))} · received {fMoney(sum(rows, m => m.received))} · outstanding {fMoney(sum(rows, m => m.outstanding))}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, color: "var(--mut)", cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "10px 14px" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead><tr>
              {["Customer", "Unit", "Project", "Milestone", "Type", "Due date", "Overdue", "Amount", "Received", "Outstanding", "Sales order"].map(h =>
                <th key={h} style={{ ...TH, textAlign: ["Amount", "Received", "Outstanding", "Overdue"].includes(h) ? "right" : "left", position: "sticky", top: 0, background: "#fdfcf9" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.slice(0, 1500).map((m, i) => (
                <tr key={i}>
                  <td style={{ ...TD, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{D.C[m.cust]?.[1] || D.C[m.cust]?.[0]}</td>
                  <td style={TD}>{m.unit}</td>
                  <td style={{ ...TD, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }}>{D.P[m.proj]}</td>
                  <td style={{ ...TD, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }} title={D.M[m.ms]}>{D.M[m.ms]}</td>
                  <td style={TD}><span style={{ color: m.kind === 0 ? RED : TEAL, fontWeight: 700 }}>{m.kind === 0 ? "Due" : "Undue"}</span></td>
                  <td style={TD}>{fD(m.due)}</td>
                  <td style={NUM}>{m.kind === 0 && m.outstanding > 0 && ageOf(m) > 0 ? `${fN(ageOf(m))} d` : "—"}</td>
                  <td style={NUM}>{fMoney(m.amount)}</td>
                  <td style={{ ...NUM, color: GREEN }}>{fMoney(m.received)}</td>
                  <td style={{ ...NUM, color: m.outstanding > 0 ? RED : "var(--mut)", fontWeight: 700 }}>{fMoney(m.outstanding)}</td>
                  <td style={TD}>{m.so}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 1500 && <div style={CAP}>Showing the first 1,500 of {fN(rows.length)} milestones (largest outstanding first).</div>}
        </div>
      </div>
    </>
  );
}

function Bars({ data, color, onPick }: { data: { k: string; v: number; rows: Ms[] }[]; color: string; onPick: (k: string, rows: Ms[]) => void }) {
  const mx = Math.max(1, ...data.map(d => d.v));
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {data.map(d => (
        <div key={d.k} onClick={() => onPick(d.k, d.rows)} style={{ display: "grid", gridTemplateColumns: "110px 1fr 110px", gap: 8, alignItems: "center", cursor: "pointer", fontSize: 12 }}
          onMouseEnter={e => showTip(e, `<b>${d.k}</b><br/>${fMoney(d.v)} · ${fN(d.rows.length)} milestones`)} onMouseLeave={hideTip}>
          <div style={{ color: "var(--mut)", fontWeight: 600 }}>{d.k}</div>
          <div style={{ height: 14, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(d.v / mx) * 100}%`, background: color, borderRadius: 4 }} />
          </div>
          <div style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fMoney(d.v)}</div>
        </div>
      ))}
    </div>
  );
}

export default function DueUnduePage() {
  const [proj, setProj] = useState(-1);
  const [kindF, setKindF] = useState<"all" | "due" | "undue">("all");
  const [q, setQ] = useState("");
  const [drill, setDrill] = useState<Drill | null>(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return ALL.filter(m => (proj < 0 || m.proj === proj)
      && (kindF === "all" || (kindF === "due" ? m.kind === 0 : m.kind === 1))
      && (!s || `${D.C[m.cust]?.join(" ")} ${m.unit} ${m.so} ${D.M[m.ms]}`.toLowerCase().includes(s)));
  }, [proj, kindF, q]);
  const due = rows.filter(m => m.kind === 0), undue = rows.filter(m => m.kind === 1);
  const overdue = due.filter(m => m.outstanding > 0.5);
  const open = (title: string, r: Ms[]) => setDrill({ title, rows: r });

  const byProj = useMemo(() => D.P.map((p, i) => {
    const d = due.filter(m => m.proj === i), u = undue.filter(m => m.proj === i);
    const next90 = u.filter(m => m.due >= AS_ON && m.due <= AS_ON + 90);
    return { p, i, d, u, next90, amt: sum(d, m => m.amount), rec: sum(d, m => m.received), out: sum(d, m => m.outstanding), und: sum(u, m => m.amount) };
  }).filter(x => x.d.length || x.u.length).sort((a, b) => b.out - a.out), [due, undue]);

  const ageing = AGE.map(([lo, hi, k]) => {
    const r = overdue.filter(m => { const a = ageOf(m); return a >= lo && a <= hi; });
    return { k, v: sum(r, m => m.outstanding), rows: r };
  });
  const schedule = useMemo(() => {
    const start = monthKey(AS_ON), out: { k: string; v: number; rows: Ms[] }[] = [];
    for (let i = 0; i < 12; i++) {
      const r = undue.filter(m => m.due >= 0 && monthKey(m.due) === start + i);
      out.push({ k: monthLbl(start + i), v: sum(r, m => m.amount), rows: r });
    }
    const later = undue.filter(m => m.due < 0 || monthKey(m.due) >= start + 12);
    out.push({ k: "Later / no date", v: sum(later, m => m.amount), rows: later });
    return out;
  }, [undue]);
  const topCust = useMemo(() => {
    const m = new Map<number, Ms[]>();
    overdue.forEach(x => { if (!m.has(x.cust)) m.set(x.cust, []); m.get(x.cust)!.push(x); });
    return [...m.entries()].map(([c, r]) => ({ c, r, v: sum(r, x => x.outstanding), oldest: Math.max(...r.map(ageOf)) }))
      .sort((a, b) => b.v - a.v).slice(0, 15);
  }, [overdue]);

  const kpi = (lbl: string, v: string, sub: string, c: [string, string], r: Ms[]) => (
    <div style={GLASS(c[0], c[1])} onClick={() => open(lbl, r)}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "1.1px", textTransform: "uppercase", opacity: 0.85 }}>{lbl}</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 24, fontWeight: 700, marginTop: 4 }}>{v}</div>
      <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>{sub}</div>
    </div>
  );

  return (
    <div className="sw-inv" style={{ padding: "18px 22px" }}>
      <PageBanner title="Due / Undue" sub={<>payment-plan milestones of every booked unit (SAP ZSD_DAPP) · due = raised by SAP, undue = still to come · <LiveDataBadge feed="dapp" /></>}>
        <div>
          <label style={BANNER_LBL}>Project</label>
          <select value={proj} onChange={e => setProj(+e.target.value)} style={{ ...BANNER_CTL, maxWidth: 240 }}>
            <option value={-1}>All projects</option>
            {D.P.map((p, i) => <option key={p} value={i}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={BANNER_LBL}>Show</label>
          <BannerPills items={[["all", "Due + Undue"], ["due", "Due"], ["undue", "Undue"]] as const} value={kindF} onChange={setKindF} />
        </div>
        <div>
          <label style={BANNER_LBL}>Search</label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Customer / unit / SO / milestone…" style={{ ...BANNER_CTL, cursor: "text", width: 220 }} />
        </div>
        <button onClick={() => { setProj(-1); setKindF("all"); setQ(""); }} className="pb-btn">⟲ Reset</button>
      </PageBanner>

      {ALL.length === 0 ? (
        <div style={{ ...CARD, padding: 28, textAlign: "center" }}>
          <div style={{ ...H3, fontSize: 18 }}>Waiting for the first SAP load</div>
          <div style={{ ...CAP, marginTop: 6 }}>This page fills itself from SAP ZSD_DAPP at 1 PM and 5 PM once the VendorGlobe API has loaded it (see /zdapp/health on the server).</div>
        </div>
      ) : <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 14 }}>
          {kpi("Due raised", fMoney(sum(due, m => m.amount)), `${fN(due.length)} milestones due till date`, [NAVY, "#2c5a94"], due)}
          {kpi("Received against due", fMoney(sum(due, m => m.received)), `${(sum(due, m => m.amount) ? (sum(due, m => m.received) / sum(due, m => m.amount)) * 100 : 0).toFixed(1)}% of due collected`, [GREEN, "#138a60"], due.filter(m => m.received > 0))}
          {kpi("Outstanding (overdue)", fMoney(sum(overdue, m => m.outstanding)), `${fN(new Set(overdue.map(m => m.cust)).size)} customers · ${fN(overdue.filter(m => ageOf(m) > 90).length)} over 90 days`, [RED, "#9b2c20"], overdue)}
          {kpi("Undue (future)", fMoney(sum(undue, m => m.amount)), `${fN(undue.length)} milestones still to come`, [TEAL, "#0a5a70"], undue)}
        </div>

        <div style={CARD}>
          <h3 style={H3}>Project-wise</h3>
          <div style={CAP}>Due = milestones SAP has raised · Undue = still to come · next 90 days = undue milestones falling due in the next three months · click a row for its milestones</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
              <thead><tr>
                {["Project", "Due raised", "Received", "% collected", "Outstanding", "Overdue customers", "Undue (future)", "Next 90 days"].map((h, i) =>
                  <th key={h} style={{ ...TH, textAlign: i ? "right" : "left" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {byProj.map(x => (
                  <tr key={x.p} style={{ cursor: "pointer" }} onClick={() => open(x.p, [...x.d, ...x.u])}>
                    <td style={{ ...TD, fontWeight: 700 }}>{x.p}</td>
                    <td style={NUM}>{fMoney(x.amt)}</td>
                    <td style={{ ...NUM, color: GREEN }}>{fMoney(x.rec)}</td>
                    <td style={NUM}>{x.amt ? `${((x.rec / x.amt) * 100).toFixed(1)}%` : "—"}</td>
                    <td style={{ ...NUM, color: RED, fontWeight: 700 }} onClick={e => { e.stopPropagation(); open(`${x.p} · outstanding`, x.d.filter(m => m.outstanding > 0.5)); }}>{fMoney(x.out)}</td>
                    <td style={NUM}>{fN(new Set(x.d.filter(m => m.outstanding > 0.5).map(m => m.cust)).size)}</td>
                    <td style={{ ...NUM, color: TEAL }} onClick={e => { e.stopPropagation(); open(`${x.p} · undue`, x.u); }}>{fMoney(x.und)}</td>
                    <td style={NUM} onClick={e => { e.stopPropagation(); open(`${x.p} · due in the next 90 days`, x.next90); }}>{fMoney(sum(x.next90, m => m.amount))}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...TD, fontWeight: 800 }}>Total</td>
                  <td style={{ ...NUM, fontWeight: 800 }}>{fMoney(sum(due, m => m.amount))}</td>
                  <td style={{ ...NUM, fontWeight: 800, color: GREEN }}>{fMoney(sum(due, m => m.received))}</td>
                  <td style={{ ...NUM, fontWeight: 800 }}>{sum(due, m => m.amount) ? `${((sum(due, m => m.received) / sum(due, m => m.amount)) * 100).toFixed(1)}%` : "—"}</td>
                  <td style={{ ...NUM, fontWeight: 800, color: RED }}>{fMoney(sum(due, m => m.outstanding))}</td>
                  <td style={{ ...NUM, fontWeight: 800 }}>{fN(new Set(overdue.map(m => m.cust)).size)}</td>
                  <td style={{ ...NUM, fontWeight: 800, color: TEAL }}>{fMoney(sum(undue, m => m.amount))}</td>
                  <td style={{ ...NUM, fontWeight: 800 }}>{fMoney(sum(undue.filter(m => m.due >= AS_ON && m.due <= AS_ON + 90), m => m.amount))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={CARD}>
            <h3 style={H3}>Overdue ageing</h3>
            <div style={CAP}>outstanding on due milestones, by days since the due installment date</div>
            <Bars data={ageing} color={RED} onPick={(k, r) => open(`Overdue ${k}`, r)} />
          </div>
          <div style={CARD}>
            <h3 style={H3}>Undue schedule</h3>
            <div style={CAP}>future milestones by the month they fall due — the collection pipeline</div>
            <Bars data={schedule} color={TEAL} onPick={(k, r) => open(`Undue · ${k}`, r)} />
          </div>
        </div>

        <div style={CARD}>
          <h3 style={H3}>Top 15 customers by outstanding</h3>
          <div style={CAP}>due milestones not yet paid · click for their milestones</div>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
            <thead><tr>{["Customer", "Code", "Units", "Projects", "Milestones", "Oldest overdue", "Outstanding"].map((h, i) => <th key={h} style={{ ...TH, textAlign: i >= 4 ? "right" : "left" }}>{h}</th>)}</tr></thead>
            <tbody>
              {topCust.map(x => (
                <tr key={x.c} style={{ cursor: "pointer" }} onClick={() => open(D.C[x.c]?.[1] || D.C[x.c]?.[0], x.r)}>
                  <td style={{ ...TD, fontWeight: 700 }}>{D.C[x.c]?.[1] || "—"}</td>
                  <td style={TD}>{D.C[x.c]?.[0]}</td>
                  <td style={TD}>{[...new Set(x.r.map(m => m.unit))].join(", ")}</td>
                  <td style={{ ...TD, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{[...new Set(x.r.map(m => D.P[m.proj]))].join(", ")}</td>
                  <td style={NUM}>{fN(x.r.length)}</td>
                  <td style={NUM}>{x.oldest > 0 ? `${fN(x.oldest)} d` : "—"}</td>
                  <td style={{ ...NUM, color: RED, fontWeight: 800 }}>{fMoney(x.v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ ...CAP, marginTop: 8, color: PURPLE }}>Amounts are with tax: Total Due Amount With Tax, Received Amount and Outstanding Amount as ZSD_DAPP shows them. <span style={{ color: GOLD }}>{D.meta.source}</span></div>
        </div>
      </>}
      <Drawer sel={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
