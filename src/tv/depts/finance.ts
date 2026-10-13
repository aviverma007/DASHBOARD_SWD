import type { TvDept, TvDeptDef } from "../types";
import { DATA_AS_ON } from "../../config/dataInfo";
import { fN, inrCr, pct, pctN, shortName } from "../../mobile/fmt";

/** Finance & Collections — same logic as mobile Collections.tsx (active bookings, r[13]===0)
 *  and Loans.tsx (ZSD loan report). Numbers match the dashboard screens. */
async function load(): Promise<TvDept> {
  const [{ default: cpRaw }, { default: loanRaw }] = await Promise.all([
    import("../../data/cpAnalytics.json"),
    import("../../data/loanData.json"),
  ]);

  /* ---------- Collections ---------- */
  const CD = cpRaw as unknown as { P: string[]; R: number[][]; meta: { asOn: string } };
  interface Bk { proj: string; y: number; tcv: number; called: number; rec: number; due: number; fut: number }
  const ROWS: Bk[] = CD.R.filter(r => r[13] === 0).map(r => {
    const tcv = r[26] ?? 0, called = r[22] ?? 0, rec = (r[24] ?? 0) - (r[25] ?? 0);
    return { proj: CD.P[r[0]], y: r[7], tcv, called, rec, due: called - rec, fut: tcv - called };
  });
  interface Agg { label: string; n: number; dueUnits: number; tcv: number; called: number; rec: number; due: number; fut: number }
  const agg = (rows: Bk[], label: string): Agg => {
    const a: Agg = { label, n: rows.length, dueUnits: 0, tcv: 0, called: 0, rec: 0, due: 0, fut: 0 };
    for (const b of rows) { a.tcv += b.tcv; a.called += b.called; a.rec += b.rec; a.due += b.due; a.fut += b.fut; if (b.due > 0) a.dueUnits++; }
    return a;
  };
  const tot = agg(ROWS, "Total");
  const byProj = (() => {
    const m = new Map<string, Bk[]>();
    ROWS.forEach(b => { if (!m.has(b.proj)) m.set(b.proj, []); m.get(b.proj)!.push(b); });
    return [...m.entries()].map(([p, r]) => agg(r, p)).sort((a, b) => b.due - a.due);
  })();
  const topDue = byProj.filter(a => a.due > 0).slice(0, 6);
  const collPct = pctN(tot.rec, tot.called);
  const byYear = (() => {
    const m = new Map<number, Bk[]>();
    ROWS.forEach(b => { if (b.y > 0) { if (!m.has(b.y)) m.set(b.y, []); m.get(b.y)!.push(b); } });
    return [...m.entries()].sort((a, b) => a[0] - b[0]).slice(-6).map(([y, r]) => agg(r, String(y)));
  })();

  /* ---------- Loans ---------- */
  interface LoanFile { meta: { asOn: string }; PROJECTS: string[]; BANKS: string[]; L: (string | number)[][] }
  const D = loanRaw as unknown as LoanFile;
  const EPOCH = Date.UTC(2022, 0, 1), DAY = 86400000;
  const AS_ON = Math.round((Date.UTC(2026, 8, 28) - EPOCH) / DAY);
  interface Loan { bank: number; sanctAmt: number; disbAmt: number; balance: number; stage: 0 | 1 | 2 | 3; sanctAge: number }
  const ALL: Loan[] = D.L.map(t => {
    const sanctAmt = t[14] as number, disbAmt = t[16] as number, disbPct = t[17] as number, sanctDay = t[15] as number;
    const stage: 0 | 1 | 2 | 3 = sanctAmt <= 0 ? 0 : disbAmt <= 0 ? 1 : disbPct >= 99 ? 3 : 2;
    return { bank: t[10] as number, sanctAmt, disbAmt, balance: t[18] as number, stage, sanctAge: sanctDay >= 0 ? Math.max(0, AS_ON - sanctDay) : 0 };
  });
  const sum = (ls: Loan[], k: "sanctAmt" | "disbAmt" | "balance") => ls.reduce((s, l) => s + l[k], 0);
  const sanct = sum(ALL, "sanctAmt"), disb = sum(ALL, "disbAmt");
  const stuck = ALL.filter(l => (l.stage === 1 || l.stage === 2) && l.sanctAge > 180);
  const banks = (() => {
    const m = new Map<number, Loan[]>();
    ALL.forEach(l => { if (!m.has(l.bank)) m.set(l.bank, []); m.get(l.bank)!.push(l); });
    return [...m.entries()].map(([bi, ls]) => {
      const sa = sum(ls, "sanctAmt"), da = sum(ls, "disbAmt");
      return { bi, n: ls.length, sa, pct: sa ? (da / sa) * 100 : 0 };
    }).filter(b => b.sa > 0).sort((a, b) => b.sa - a.sa);
  })();
  const AGE = [["0–30 d", 0, 30], ["31–90 d", 31, 90], ["91–180 d", 91, 180], ["181–365 d", 181, 365], ["> 1 year", 366, 1e9]] as const;
  const ageBands = AGE.map(([lbl, lo, hi]) => {
    const ls = ALL.filter(l => (l.stage === 1 || l.stage === 2) && l.sanctAge >= lo && l.sanctAge <= hi);
    return { lbl, n: ls.length, amt: sum(ls, "balance") };
  }).filter(b => b.n > 0);

  const bankName = (i: number) => (D.BANKS[i] || "—").replace(/\s+/g, " ").slice(0, 24);

  return {
    id: "finance", name: "Finance & Collections", tagline: "Customer collections against demand, and home-loan disbursements",
    asOn: DATA_AS_ON,
    kpis: [
      { id: "recd", label: "Received", value: tot.rec, format: v => inrCr(v), sub: `of ${inrCr(tot.called)} demanded`, tone: "green" },
      { id: "demand", label: "Demand raised", value: tot.called, format: v => inrCr(v), sub: `${pct(tot.called, tot.tcv)} of ${inrCr(tot.tcv, 0)} TCV`, tone: "navy" },
      { id: "due", label: "Net due", value: tot.due, format: v => inrCr(v), sub: `${fN(tot.dueUnits)} units with dues`, tone: "red" },
      { id: "coll", label: "Collection rate", value: collPct, format: v => `${v.toFixed(1)}%`, sub: "received ÷ demand", tone: "teal" },
      { id: "lsan", label: "Loans sanctioned", value: sanct, format: v => inrCr(v), sub: `${fN(ALL.length)} cases · ${pct(disb, sanct)} disbursed`, tone: "gold" },
      { id: "lstuck", label: "Loans stuck > 180 d", value: stuck.length, format: fN, sub: `${inrCr(sum(stuck, "balance"))} waiting at banks`, tone: "amber" },
    ],
    stories: [
      { focus: "coll", headline: `${collPct.toFixed(0)}% of the demand raised has been collected`,
        visual: { type: "ring", title: "Collected vs demand", pct: collPct, label: "collected", sub: `${inrCr(tot.rec)} of ${inrCr(tot.called)}` } },
      { focus: "due", headline: topDue.length ? `${shortName(topDue[0].label)} carries the biggest net due, ${inrCr(topDue[0].due)}` : "No net dues outstanding",
        visual: { type: "hbars", title: "Top projects by net due", rows: topDue.map(a => ({ label: shortName(a.label), value: a.due, sub: `${fN(a.dueUnits)} units · ${pct(a.rec, a.called)} collected` })), format: v => inrCr(v) } },
      { focus: "recd", headline: `${pct(tot.rec, tot.tcv)} of total contract value is already in the bank`,
        visual: { type: "donut", title: "Where the money sits (share of TCV)", parts: [
          { label: "Received", value: Math.max(tot.rec, 0), color: "#16a06f" },
          { label: "Net due", value: Math.max(tot.due, 0), color: "#d64545" },
          { label: "Future", value: Math.max(tot.fut, 0), color: "#d5daea" },
        ], centre: { value: inrCr(tot.tcv, 0), label: "TCV" }, format: v => inrCr(v) } },
      { focus: "demand", headline: `${inrCr(tot.called)} demanded so far, ${inrCr(tot.fut)} still to be raised`,
        visual: { type: "columns", title: "Demand vs received by booking year", data: byYear.map(a => ({ label: a.label, value: a.called, value2: a.rec })), format: v => inrCr(v), legend: ["Demand", "Received"] } },
      { focus: "lsan", headline: banks.length ? `${bankName(banks[0].bi)} leads sanctions at ${inrCr(banks[0].sa)}` : "No loan sanctions recorded",
        visual: { type: "hbars", title: "Loans sanctioned by bank", rows: banks.slice(0, 6).map(b => ({ label: bankName(b.bi), value: b.sa, sub: `${fN(b.n)} cases · ${b.pct.toFixed(0)}% disbursed` })), format: v => inrCr(v) } },
      { focus: "lstuck", headline: `${fN(stuck.length)} loan cases have waited over 180 days for disbursement`,
        visual: { type: "hbars", title: "Sanction ageing — cases not fully disbursed", rows: ageBands.map(b => ({ label: b.lbl, value: b.n, sub: `${inrCr(b.amt)} undisbursed` })), format: fN } },
    ],
  };
}

export const finance: TvDeptDef = { id: "finance", name: "Finance & Collections", tagline: "Collections against demand and loan disbursements", pages: "SAP Collections · Loans", icon: "IndianRupee", tone: "green", load };
