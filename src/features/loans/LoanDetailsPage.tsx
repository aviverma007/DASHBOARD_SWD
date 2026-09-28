import { useEffect, useMemo, useRef, useState } from "react";
import { PageBanner, BannerPills, BANNER_LBL, BANNER_CTL } from "../../components/layout/PageBanner";
import { Zoomable } from "../../components/common/Zoomable";
import { showTip, hideTip } from "../../components/common/hoverTip";
import "../../components/inventory/smartworldInventory.css";
import raw from "../../data/loanData.json";

/** Loan Details — the ZSD loan report, one row per loan-funded booking.
 * The money story: banks have SANCTIONED far more than they have
 * DISBURSED, and a large set of customers owe us instalments while
 * their sanctioned loan balance sits undisbursed — that list is the
 * collection priority. Loan stages per customer:
 *   sanction pending → sanctioned, nothing disbursed → partly → fully */

/* ---------------- styles ---------------- */
const TEAL = "#0E7490", GOLD = "#B8893C", GREEN = "#1BAF7A", RED = "#c0392b", NAVY = "#1c3f6e", PURPLE = "#6b5f8f";
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
const fD = (d: number) => d < 0 ? "—" : new Date(EPOCH + d * DAY).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" });
const AS_ON = Math.round((Date.UTC(2026, 8, 28) - EPOCH) / DAY);

interface LoanFile {
  meta: { asOn: string };
  PROJECTS: string[]; BANKS: string[]; EMPS: string[]; EXECS: string[]; PLANS: string[];
  L: (string | number)[][];
}
const D = raw as unknown as LoanFile;

interface Loan {
  proj: number; so: string; bookDay: number; regId: string; name: string;
  unit: string; tower: string; floor: string; unitType: string; cost: number;
  bank: number; plan: number; fileNo: string; fileDay: number;
  sanctAmt: number; sanctDay: number; disbAmt: number; disbPct: number; balance: number;
  ptmDay: number; tptDay: number; bbaDay: number; emp: number; exec: number; remark: string; due: number;
  stage: 0 | 1 | 2 | 3;        // 0 sanction pending · 1 awaiting disbursement · 2 partly · 3 fully
  sanctAge: number;             // days since sanction (for undisbursed money)
}
const STAGE_LBL = ["Sanction Pending", "Awaiting 1st Disbursement", "Partly Disbursed", "Fully Disbursed"] as const;
const STAGE_COL = [PURPLE, RED, GOLD, GREEN] as const;

const ALL: Loan[] = D.L.map(t => {
  const sanctAmt = t[14] as number, disbAmt = t[16] as number, disbPct = t[17] as number, sanctDay = t[15] as number;
  const stage: 0 | 1 | 2 | 3 = sanctAmt <= 0 ? 0 : disbAmt <= 0 ? 1 : disbPct >= 99 ? 3 : 2;
  return {
    proj: t[0] as number, so: String(t[1]), bookDay: t[2] as number, regId: String(t[3]), name: String(t[4]),
    unit: String(t[5]), tower: String(t[6]), floor: String(t[7]), unitType: String(t[8]), cost: t[9] as number,
    bank: t[10] as number, plan: t[11] as number, fileNo: String(t[12]), fileDay: t[13] as number,
    sanctAmt, sanctDay, disbAmt, disbPct, balance: t[18] as number,
    ptmDay: t[19] as number, tptDay: t[20] as number, bbaDay: t[21] as number,
    emp: t[22] as number, exec: t[23] as number, remark: String(t[24]), due: t[25] as number,
    stage, sanctAge: sanctDay >= 0 ? Math.max(0, AS_ON - sanctDay) : 0,
  };
});

/* ---------------- drill drawer ---------------- */
interface Drill { title: string; sub?: string; loans: Loan[] }

function StagePill({ l }: { l: Loan }) {
  return <span style={{ background: `${STAGE_COL[l.stage]}1c`, color: STAGE_COL[l.stage], fontWeight: 800, fontSize: 10.5, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>{STAGE_LBL[l.stage]}</span>;
}

function LoanDrawer({ sel, onClose }: { sel: Drill | null; onClose: () => void }) {
  const [cur, setCur] = useState<Loan | null>(null);
  if (!sel) return null;
  const ls = sel.loans;
  const sanct = ls.reduce((s, l) => s + l.sanctAmt, 0);
  const disb = ls.reduce((s, l) => s + l.disbAmt, 0);
  const due = ls.reduce((s, l) => s + l.due, 0);
  const tile = (k: string, v: string, col = "var(--ink)") => (
    <div key={k} style={{ background: "#faf9f6", border: "1px solid #eee9dd", borderRadius: 10, padding: "8px 12px", minWidth: 108 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: col, marginTop: 2 }}>{v}</div>
    </div>
  );
  return (
    <>
      <div onClick={() => { setCur(null); onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(14,22,45,0.45)", zIndex: 220 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(700px, 96vw)", background: "#fdfcf9", zIndex: 221, boxShadow: "-18px 0 50px rgba(14,22,45,0.35)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #eae6da", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
                {cur ? <><span onClick={() => setCur(null)} style={{ color: GOLD, cursor: "pointer" }}>‹ {sel.title}</span> · {cur.name}</> : sel.title}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 2 }}>{cur ? `${cur.unit} · ${D.PROJECTS[cur.proj]}` : sel.sub ?? `${fN(ls.length)} loan customers`}</div>
            </div>
            <button onClick={() => { setCur(null); onClose(); }} style={{ background: "none", border: "none", fontSize: 24, color: "var(--mut)", cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>
          {!cur && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {tile("Customers", fN(ls.length))}
              {tile("Sanctioned", fMoney(sanct), TEAL)}
              {tile("Disbursed", fMoney(disb), GREEN)}
              {tile("Undisbursed", fMoney(sanct - disb), "#96691c")}
              {due > 0 ? tile("Dues pending", fMoney(due), RED) : null}
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {cur ? (
            <div style={CARD}>
              <div style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
                <StagePill l={cur} />
                {cur.due > 1000 && cur.balance > 0 && <span style={{ background: `${RED}1c`, color: RED, fontWeight: 800, fontSize: 10.5, borderRadius: 999, padding: "2px 9px" }}>Due {fMoney(cur.due)} · loan balance available</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "6px 10px", fontSize: 12.5 }}>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Customer</div><div style={{ fontWeight: 700 }}>{cur.name} <span style={{ color: "var(--mut)", fontWeight: 400 }}>· {cur.regId}</span></div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Unit</div><div>{cur.unit} · {cur.unitType} · {D.PROJECTS[cur.proj]}</div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Booking / BBA</div><div>{fD(cur.bookDay)} · BBA {fD(cur.bbaDay)}</div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Total cost</div><div>{fMoney(cur.cost)}</div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Bank</div><div style={{ whiteSpace: "normal" }}>{D.BANKS[cur.bank]}</div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Loan file</div><div>{cur.fileNo || "—"} · {fD(cur.fileDay)}</div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Sanctioned</div><div style={{ color: TEAL, fontWeight: 700 }}>{fMoney(cur.sanctAmt)} <span style={{ color: "var(--mut)", fontWeight: 400 }}>on {fD(cur.sanctDay)}{cur.sanctAge > 0 && cur.stage !== 3 ? ` · ${cur.sanctAge} d ago` : ""}</span></div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Disbursed</div>
                <div>
                  <b style={{ color: GREEN }}>{fMoney(cur.disbAmt)}</b> <span style={{ color: "var(--mut)" }}>({cur.disbPct.toFixed(1)}%)</span>
                  <div style={{ height: 8, background: "#f0ede5", borderRadius: 4, overflow: "hidden", marginTop: 4, maxWidth: 260 }}>
                    <div style={{ height: "100%", width: `${Math.min(cur.disbPct, 100)}%`, background: GREEN }} />
                  </div>
                </div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Undisbursed balance</div><div style={{ color: "#96691c", fontWeight: 700 }}>{fMoney(cur.balance)}</div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Dues (incl. tax)</div><div style={{ color: cur.due > 1000 ? RED : "var(--mut)", fontWeight: 700 }}>{fMoney(cur.due)}</div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>PTM / TPT</div><div>{fD(cur.ptmDay)} · {fD(cur.tptDay)}</div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Handled by</div><div>{D.EMPS[cur.emp] || "—"}{D.EXECS[cur.exec] ? ` · ${D.EXECS[cur.exec]}` : ""}</div>
                {cur.remark && <><div style={{ color: "var(--mut)", fontWeight: 700 }}>Remark</div><div style={{ whiteSpace: "normal" }}>{cur.remark}</div></>}
              </div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                <th style={TH}>Customer</th><th style={TH}>Bank</th><th style={TH}>Stage</th>
                <th style={{ ...TH, textAlign: "right" }}>Sanctioned</th><th style={{ ...TH, textAlign: "right" }}>Disb %</th><th style={{ ...TH, textAlign: "right" }}>Due</th>
              </tr></thead>
              <tbody>
                {ls.map((l, i) => (
                  <tr key={i} onClick={() => setCur(l)} style={{ cursor: "pointer" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                    <td style={{ ...TD, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ fontWeight: 800, color: "var(--ink)" }}>{l.name}</span>
                      <span style={{ color: "var(--mut)", marginLeft: 6, fontSize: 10.5 }}>{l.unit}</span>
                    </td>
                    <td style={{ ...TD, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", color: "var(--mut)" }}>{D.BANKS[l.bank]}</td>
                    <td style={TD}><StagePill l={l} /></td>
                    <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: TEAL }}>{fMoney(l.sanctAmt)}</td>
                    <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: l.disbPct > 0 ? GREEN : "var(--mut)" }}>{l.disbPct.toFixed(0)}%</td>
                    <td style={{ ...TD, textAlign: "right", color: l.due > 1000 ? RED : "var(--mut)", fontWeight: l.due > 1000 ? 800 : 500 }}>{l.due > 1000 ? fMoney(l.due) : "—"}</td>
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
function ProjSelect({ selected, onChange }: { selected: string[]; onChange: (s: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = (n: string) => {
    const next = selected.includes(n) ? selected.filter(x => x !== n) : [...selected, n];
    onChange(next.length === D.PROJECTS.length ? [] : next);
  };
  const label = selected.length === 0 ? "All projects" : selected.length === 1 ? selected[0].replace("SMARTWORLD ", "") : `${selected.length} projects`;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={BANNER_LBL}>Project</label>
      <button type="button" onClick={() => setOpen(v => !v)} style={{ ...BANNER_CTL, minWidth: 185, textAlign: "left" }}>
        {label} <span style={{ color: "var(--mut)", marginLeft: 6, fontSize: 9 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60, background: "#fff", border: "1px solid var(--line)", borderRadius: 9, boxShadow: "0 12px 34px rgba(20,33,61,.2)", padding: 8, minWidth: 280, maxHeight: 320, overflowY: "auto" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderBottom: "1px solid var(--line)", marginBottom: 5, paddingBottom: 10, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            <input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])} style={{ accentColor: "#B8893C", width: 15, height: 15 }} />
            All projects
          </label>
          {D.PROJECTS.map(n => (
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
export default function LoanDetailsPage() {
  const [projF, setProjF] = useState<string[]>([]);
  const [bankF, setBankF] = useState(-1);
  const [stageF, setStageF] = useState<"all" | "0" | "1" | "2" | "3">("all");
  const [q, setQ] = useState("");
  const [drill, setDrill] = useState<Drill | null>(null);
  const [showAllPriority, setShowAllPriority] = useState(false);

  const bankOpts = useMemo(() => D.BANKS.map((b, i) => ({ b, i })).filter(x => x.b && x.b !== "—").sort((a, b) => a.b.localeCompare(b.b)), []);

  const scoped = useMemo(() => {
    const s = q.trim().toLowerCase();
    return ALL.filter(l => {
      if (projF.length && !projF.includes(D.PROJECTS[l.proj])) return false;
      if (bankF >= 0 && l.bank !== bankF) return false;
      if (stageF !== "all" && l.stage !== +stageF) return false;
      if (s && !l.name.toLowerCase().includes(s) && !l.unit.toLowerCase().includes(s) &&
          !l.fileNo.toLowerCase().includes(s) && !l.so.toLowerCase().includes(s) &&
          !D.BANKS[l.bank].toLowerCase().includes(s) && !D.EMPS[l.emp].toLowerCase().includes(s)) return false;
      return true;
    });
  }, [projF, bankF, stageF, q]);

  const open = (title: string, loans: Loan[], sub?: string) =>
    setDrill({ title, sub, loans: [...loans].sort((a, b) => b.due - a.due || b.balance - a.balance) });

  const sum = (ls: Loan[], k: "sanctAmt" | "disbAmt" | "balance" | "due") => ls.reduce((s, l) => s + l[k], 0);
  const sanct = sum(scoped, "sanctAmt"), disb = sum(scoped, "disbAmt");
  const priority = scoped.filter(l => l.due > 1000 && l.balance > 0);
  const stages = [0, 1, 2, 3].map(st => scoped.filter(l => l.stage === st));

  function handleReset() { setProjF([]); setBankF(-1); setStageF("all"); setQ(""); }

  const KPIS: [string, string, string, [string, string], () => void][] = [
    ["Loan customers", fN(scoped.length), "bookings funded through bank loans", [NAVY, "#0f2547"], () => open("All loan customers", scoped)],
    ["Sanctioned", fMoney(sanct), "approved by banks for our customers", ["#1a7f9c", "#0e5468"], () => open("Sanctioned loans", scoped.filter(l => l.sanctAmt > 0))],
    ["Disbursed", fMoney(disb), `${sanct ? ((disb / sanct) * 100).toFixed(0) : 0}% of sanctioned received`, ["#1e9a6c", "#0f6647"], () => open("Customers with disbursements", scoped.filter(l => l.disbAmt > 0))],
    ["Undisbursed balance", fMoney(sanct - disb), "sanctioned money still with banks", ["#c8871d", "#96691c"], () => open("Undisbursed loan balance", scoped.filter(l => l.balance > 0))],
    ["Collect now", fMoney(sum(priority, "due")), `${fN(priority.length)} customers owe dues with loan balance available`, ["#c0392b", "#7e1f14"], () => open("Priority: dues pending, loan available", priority, "customer owes an instalment AND their sanctioned loan has undisbursed balance")],
  ];

  /* bank-wise */
  const banks = useMemo(() => {
    const m = new Map<number, Loan[]>();
    scoped.forEach(l => { if (!m.has(l.bank)) m.set(l.bank, []); m.get(l.bank)!.push(l); });
    return [...m.entries()].map(([bi, ls]) => {
      const sa = sum(ls, "sanctAmt"), da = sum(ls, "disbAmt");
      const ages = ls.filter(l => l.stage === 1 || l.stage === 2).map(l => l.sanctAge);
      return { bi, ls, sa, da, pct: sa ? (da / sa) * 100 : 0, due: sum(ls, "due"), avgAge: ages.length ? ages.reduce((s, x) => s + x, 0) / ages.length : 0 };
    }).sort((a, b) => b.sa - a.sa);
  }, [scoped]);

  /* project cards */
  const projCards = useMemo(() => D.PROJECTS.map((p, pi) => {
    const ls = scoped.filter(l => l.proj === pi);
    if (!ls.length) return null;
    return { p, pi, ls, sa: sum(ls, "sanctAmt"), da: sum(ls, "disbAmt"), due: sum(ls, "due"), prio: ls.filter(l => l.due > 1000 && l.balance > 0).length };
  }).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.sa - a.sa), [scoped]);

  /* ageing of undisbursed sanctions */
  const AGE = [["0–30 d", 0, 30], ["31–90 d", 31, 90], ["91–180 d", 91, 180], ["181–365 d", 181, 365], ["> 1 year", 366, 1e9]] as const;
  const ageBands = AGE.map(([lbl, lo, hi]) => {
    const ls = scoped.filter(l => (l.stage === 1 || l.stage === 2) && l.sanctAge >= lo && l.sanctAge <= hi);
    return { lbl, ls, amt: sum(ls, "balance"), col: lo >= 181 ? RED : lo >= 31 ? "#EDA100" : GREEN };
  }).filter(b => b.ls.length);

  /* monthly sanctions */
  const months = useMemo(() => {
    const m = new Map<string, Loan[]>();
    scoped.forEach(l => {
      if (l.sanctDay < 0) return;
      const k = new Date(EPOCH + l.sanctDay * DAY).toISOString().slice(0, 7);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(l);
    });
    return [...m.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1);
  }, [scoped]);

  const prioRows = showAllPriority ? priority : priority.slice(0, 15);
  const prioSorted = [...prioRows].sort((a, b) => b.due - a.due);

  return (
    <div className="sw-inv" style={{ minHeight: "100vh", background: "#f6f4ef", display: "flex", flexDirection: "column" }}>
      <PageBanner bleed title="Loan Details" sub={<>bank-loan funded bookings — sanction to disbursement, and the dues we can collect from sanctioned money · data as on {D.meta.asOn}</>}>
        <ProjSelect selected={projF} onChange={setProjF} />
        <div>
          <label style={BANNER_LBL}>Bank</label>
          <select value={bankF} onChange={e => setBankF(+e.target.value)} style={{ ...BANNER_CTL, maxWidth: 220 }}>
            <option value={-1}>All banks</option>
            {bankOpts.map(x => <option key={x.i} value={x.i}>{x.b}</option>)}
          </select>
        </div>
        <div>
          <label style={BANNER_LBL}>Loan stage</label>
          <BannerPills items={[["all", "All"], ["0", "No Sanction"], ["1", "Awaiting Disb."], ["2", "Partly"], ["3", "Fully"]] as const}
            value={stageF} onChange={setStageF} />
        </div>
        <div>
          <label style={BANNER_LBL}>Search</label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Customer / unit / file no. / bank…"
            style={{ ...BANNER_CTL, cursor: "text", width: 210 }} />
        </div>
        <button onClick={handleReset} className="pb-btn">⟲ Reset</button>
      </PageBanner>

      <div style={{ padding: "14px 20px 24px", flex: 1 }}>
        {/* KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))", gap: 12, marginBottom: 14 }}>
          {KPIS.map(([k, v, sub, [c1, c2], onClick]) => (
            <div key={k} style={{ ...GLASS(c1, c2), cursor: "pointer" }} onClick={onClick}
              onMouseEnter={e => showTip(e, `<b>${k}</b><br/>${sub}<br/>click → customer list`)} onMouseLeave={hideTip}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", opacity: 0.85 }}>{k}</div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 28, fontWeight: 700, margin: "4px 0 2px" }}>{v}</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* funnel + ageing */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 14, marginBottom: 14 }}>
          <Zoomable title="Loan funnel" collapsible>
            <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
              <h3 style={H3}>Where Every Loan Stands</h3>
              <div style={CAP}>each customer sits in exactly one stage · click → list</div>
              {(() => {
                const mx = Math.max(...stages.map(s => s.length), 1);
                return stages.map((ls, st) => (
                  <div key={st} className="barrow" style={{ padding: "6px 0", cursor: "pointer" }}
                    onClick={() => open(STAGE_LBL[st], ls)}
                    onMouseEnter={e => showTip(e, `<b>${STAGE_LBL[st]}</b><br/>${fN(ls.length)} customers · sanctioned ${fMoney(sum(ls, "sanctAmt"))}<br/>click → list`)} onMouseLeave={hideTip}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, color: "var(--ink)" }}>{STAGE_LBL[st]}</span>
                      <span style={{ fontWeight: 800, color: "var(--mut)" }}>{fN(ls.length)} <span style={{ color: GOLD }}>· {fMoney(sum(ls, "sanctAmt"))}</span></span>
                    </div>
                    <div style={{ height: 11, background: "#f0ede5", borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(ls.length / mx) * 100}%`, background: STAGE_COL[st], borderRadius: 6 }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </Zoomable>

          <Zoomable title="Sanction ageing" collapsible>
            <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
              <h3 style={H3}>How Long Has Sanctioned Money Waited?</h3>
              <div style={CAP}>days since sanction, disbursement still incomplete · count + undisbursed balance · click → list</div>
              {(() => {
                const mx = Math.max(...ageBands.map(b => b.ls.length), 1);
                return ageBands.map(b => (
                  <div key={b.lbl} className="barrow" style={{ padding: "5.5px 0", cursor: "pointer" }}
                    onClick={() => open(`Sanctioned ${b.lbl} ago, not fully disbursed`, b.ls)}
                    onMouseEnter={e => showTip(e, `<b>${b.lbl}</b><br/>${fN(b.ls.length)} customers · ${fMoney(b.amt)} undisbursed<br/>click → list`)} onMouseLeave={hideTip}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, color: "var(--ink)" }}>{b.lbl}</span>
                      <span style={{ fontWeight: 800, color: "var(--mut)" }}>{fN(b.ls.length)} <span style={{ color: GOLD }}>· {fMoney(b.amt)}</span></span>
                    </div>
                    <div style={{ height: 10, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(b.ls.length / mx) * 100}%`, background: b.col, borderRadius: 5 }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </Zoomable>
        </div>

        {/* priority table */}
        <Zoomable title="Collect now">
          <div style={CARD}>
            <h3 style={H3}>Collect Now — Dues Pending, Loan Money Available</h3>
            <div style={CAP}>{fN(priority.length)} customers owe instalments while their sanctioned loan balance sits undisbursed · biggest dues first · click a row → full loan detail</div>
            <div style={{ overflowX: "auto", maxHeight: 430, overflowY: "auto", border: "1px solid #f0ede5", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 980 }}>
                <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                  <th style={TH}>Customer</th><th style={TH}>Project · Unit</th><th style={TH}>Bank</th>
                  <th style={{ ...TH, textAlign: "right" }}>Due (incl. tax)</th><th style={{ ...TH, textAlign: "right" }}>Loan balance</th>
                  <th style={{ ...TH, textAlign: "right" }}>Disb %</th><th style={{ ...TH, textAlign: "right" }}>Sanction age</th><th style={TH}>Handler</th>
                </tr></thead>
                <tbody>
                  {prioSorted.map((l, i) => (
                    <tr key={i} onClick={() => setDrill({ title: "Priority customer", loans: [l] })} style={{ cursor: "pointer" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                      <td style={{ ...TD, fontWeight: 800, color: "var(--ink)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</td>
                      <td style={{ ...TD, color: "var(--mut)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{D.PROJECTS[l.proj].replace("SMARTWORLD ", "")} · {l.unit}</td>
                      <td style={{ ...TD, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", color: "var(--mut)" }}>{D.BANKS[l.bank]}</td>
                      <td style={{ ...TD, textAlign: "right", color: RED, fontWeight: 800, fontSize: 12.5 }}>{fMoney(l.due)}</td>
                      <td style={{ ...TD, textAlign: "right", color: TEAL, fontWeight: 700 }}>{fMoney(l.balance)}</td>
                      <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{l.disbPct.toFixed(0)}%</td>
                      <td style={{ ...TD, textAlign: "right", color: l.sanctAge > 180 ? RED : "#96691c", fontWeight: 700 }}>{l.sanctDay >= 0 ? `${l.sanctAge} d` : "—"}</td>
                      <td style={{ ...TD, color: "var(--mut)", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" }}>{D.EMPS[l.emp] || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {priority.length > 15 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 12 }}>
                <span style={{ color: "var(--mut)" }}>Showing {fN(prioSorted.length)} of {fN(priority.length)}</span>
                <button onClick={() => setShowAllPriority(v => !v)}
                  style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid #d8d2c4", background: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                  {showAllPriority ? "Show top 15" : `Show all ${fN(priority.length)}`}
                </button>
              </div>
            )}
          </div>
        </Zoomable>

        {/* project cards */}
        <Zoomable title="Project cards" collapsible>
          <div style={CARD}>
            <h3 style={H3}>Loan Money — Project Wise</h3>
            <div style={CAP}>click a card → that project's loan customers</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(225px, 1fr))", gap: 12 }}>
              {projCards.map(b => {
                const pct = b.sa ? (b.da / b.sa) * 100 : 0;
                return (
                  <div key={b.p} onClick={() => open(`${b.p} — loan customers`, b.ls)}
                    onMouseEnter={e => { showTip(e, `<b>${b.p}</b><br/>${fN(b.ls.length)} customers · ${fMoney(b.sa)} sanctioned<br/>click → list`); (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { hideTip(); (e.currentTarget as HTMLElement).style.transform = ""; }}
                    style={{ background: "#fff", border: "1px solid #eae6da", borderLeft: `5px solid ${TEAL}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", boxShadow: "0 2px 8px rgba(20,33,61,.06)", transition: "transform .15s ease" }}>
                    <div style={{ fontFamily: "Georgia,serif", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{b.p.replace("SMARTWORLD ", "")}</div>
                    <div style={{ fontFamily: "Georgia,serif", fontSize: 23, fontWeight: 700, color: TEAL, margin: "6px 0 1px" }}>{fMoney(b.sa)}</div>
                    <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 7 }}>sanctioned · <b style={{ color: "var(--ink)" }}>{fN(b.ls.length)}</b> customers</div>
                    <div style={{ height: 7, background: "#f0ede5", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: GREEN, borderRadius: 4 }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 700 }}>
                      <span style={{ color: GREEN }}>{pct.toFixed(0)}% disbursed</span>
                      <span style={{ color: b.prio ? RED : "var(--mut)" }}>{b.prio ? `${fN(b.prio)} to collect` : "no pending dues"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Zoomable>

        {/* bank-wise */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 14, marginBottom: 14 }}>
          <Zoomable title="Bank-wise" collapsible>
            <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
              <h3 style={H3}>Bank-Wise — Who Is Slow to Disburse?</h3>
              <div style={CAP}>sanctioned vs disbursed per bank · avg age = days since sanction on incomplete disbursements · click → customers</div>
              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                    <th style={TH}>Bank</th><th style={{ ...TH, textAlign: "right" }}>Custs</th>
                    <th style={{ ...TH, textAlign: "right" }}>Sanctioned</th><th style={{ ...TH, textAlign: "right" }}>Disb %</th><th style={{ ...TH, textAlign: "right" }}>Avg age</th>
                  </tr></thead>
                  <tbody>
                    {banks.map(b => (
                      <tr key={b.bi} onClick={() => open(`${D.BANKS[b.bi]} — loan customers`, b.ls)} style={{ cursor: "pointer" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                        <td style={{ ...TD, fontWeight: 700, color: "var(--ink)", maxWidth: 210, overflow: "hidden", textOverflow: "ellipsis" }}>{D.BANKS[b.bi]}</td>
                        <td style={{ ...TD, textAlign: "right" }}>{fN(b.ls.length)}</td>
                        <td style={{ ...TD, textAlign: "right", color: TEAL, fontWeight: 700 }}>{fMoney(b.sa)}</td>
                        <td style={{ ...TD, textAlign: "right", fontWeight: 800, color: b.pct >= 50 ? GREEN : b.pct >= 20 ? "#96691c" : RED }}>{b.pct.toFixed(0)}%</td>
                        <td style={{ ...TD, textAlign: "right", color: b.avgAge > 180 ? RED : "var(--mut)", fontWeight: 700 }}>{b.avgAge ? `${Math.round(b.avgAge)} d` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Zoomable>

        </div>

        {/* monthly sanctions */}
        <Zoomable title="Monthly sanctions" collapsible>
          <div style={CARD}>
            <h3 style={H3}>Monthly — Loans Sanctioned</h3>
            <div style={CAP}>customers by loan sanction month · amounts on the bars · click → that month's customers</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 170, overflowX: "auto", paddingBottom: 4 }}>
              {(() => {
                const mx = Math.max(...months.map(([, ls]) => ls.length), 1);
                return months.map(([k, ls]) => {
                  const lbl = new Date(k + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
                  const amt = sum(ls, "sanctAmt");
                  return (
                    <div key={k} onClick={() => open(`Sanctioned in ${lbl}`, ls)}
                      onMouseEnter={ev => showTip(ev, `<b>${lbl}</b><br/>${fN(ls.length)} sanctions · ${fMoney(amt)}<br/>click → list`)} onMouseLeave={hideTip}
                      style={{ flex: "1 1 0", minWidth: 34, maxWidth: 90, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", height: "100%" }}>
                      <div style={{ flex: 1, width: "68%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--ink)", textAlign: "center", marginBottom: 2 }}>{ls.length}</div>
                        <div style={{ height: `${(ls.length / mx) * 100}%`, background: TEAL, borderRadius: "4px 4px 0 0", minHeight: 4 }} />
                      </div>
                      <div style={{ fontSize: 9.5, color: "var(--mut)", fontWeight: 700, marginTop: 4, whiteSpace: "nowrap" }}>{lbl}</div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </Zoomable>

        {/* how to read */}
        <div style={{ ...CARD, background: "#fdfaf3", borderColor: "#efe4c8" }}>
          <h3 style={H3}>How to read this page</h3>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.65 }}>
            Every customer here funds their booking through a bank loan. The bank first <b>sanctions</b> an amount, then <b>disburses</b> it to us in tranches as instalments fall due. <b>Undisbursed balance</b> is sanctioned money still sitting with the bank. The <b>Collect Now</b> card is the action list: customers who owe us an instalment <i>and</i> have loan balance available — a disbursement demand to their bank realises that money. Bank names are normalised (the export carries the same bank in different spellings), and rows where the executive shows "CRM IT" are treated as <b>Unassigned</b>. Loan stage per customer: sanction pending → awaiting first disbursement → partly → fully disbursed.
          </div>
        </div>
      </div>

      <LoanDrawer sel={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
