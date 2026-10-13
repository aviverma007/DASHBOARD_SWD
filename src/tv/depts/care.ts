import type { TvDept, TvDeptDef, TvStory } from "../types";
import { fN, pct } from "../../mobile/fmt";
import { AGE_BANDS, CASES, CM, ageBand, isClosed, loadLiveCases, tatBucket, ymLbl, ymOf } from "../../components/cases/caseShared";

/** Customer Care — case management. Same computations as mobile/screens/Cases.tsx
 *  (unfiltered view). loadLiveCases swaps the live Salesforce set in when reachable. */
const pc = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

async function load(): Promise<TvDept> {
  const stamp = await loadLiveCases("http://192.168.66.28:5002");
  const cases = CASES;                                   // live-bound: live data if the swap succeeded
  const open = cases.filter(c => !isClosed(c));
  const closed = cases.length - open.length;
  const tat = { overdue: 0, atrisk: 0, within: 0 };
  open.forEach(c => { tat[tatBucket(c)]++; });
  const hniOpen = open.filter(c => c.hni === 1).length;

  const ageing = new Array(AGE_BANDS.length).fill(0) as number[];
  open.forEach(c => { ageing[ageBand(c.age)]++; });
  const old = ageing[4] + ageing[5];

  const tm = new Map<string, { o: number; c: number }>();
  cases.forEach(c => {
    if (c.open >= 0) { const k = ymOf(c.open); const e = tm.get(k) ?? { o: 0, c: 0 }; e.o++; tm.set(k, e); }
    if (c.closed >= 0) { const k = ymOf(c.closed); const e = tm.get(k) ?? { o: 0, c: 0 }; e.c++; tm.set(k, e); }
  });
  const trend = [...tm.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  const trendTot = trend.reduce((s, [, v]) => ({ o: s.o + v.o, c: s.c + v.c }), { o: 0, c: 0 });

  const cm = new Map<number, number>();
  open.forEach(c => { if (c.area >= 0) cm.set(c.area, (cm.get(c.area) ?? 0) + 1); });
  const cats = [...cm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const overdueShare = pc(tat.overdue, open.length);
  const stories: TvStory[] = [
    { focus: "open", headline: open.length ? `${fN(open.length)} cases are open — ${pct(tat.overdue, open.length)} already beyond TAT` : "No open cases right now",
      visual: { type: "donut", title: "Open cases by TAT status", parts: [
        { label: "Beyond TAT", value: tat.overdue, color: "#d64545" }, { label: "At risk", value: tat.atrisk, color: "#e0a030" }, { label: "Within TAT", value: tat.within, color: "#16a06f" }],
        centre: { value: fN(open.length), label: "open cases" }, format: fN } },
    { focus: "overdue", headline: `${fN(tat.overdue)} cases have breached TAT, ${pct(tat.overdue, open.length)} of the open book`,
      visual: { type: "ring", title: "Open cases beyond TAT", pct: overdueShare, label: "beyond TAT", sub: `${fN(tat.overdue)} of ${fN(open.length)} open · ${fN(tat.atrisk)} more at risk` } },
    { focus: "open", headline: open.length ? `${fN(old)} open cases are older than 30 days` : "Nothing is ageing — the queue is clear",
      visual: { type: "hbars", title: "Open cases by age", rows: AGE_BANDS.map(b => ({ label: b.label, value: ageing[b.k] })), format: fN } },
  ];
  if (trend.length) stories.push({ focus: "closed", headline: `Last 12 months: ${fN(trendTot.o)} cases raised, ${fN(trendTot.c)} closed`,
    visual: { type: "columns", title: "Cases raised vs closed — last 12 months", data: trend.map(([k, v]) => ({ label: ymLbl(k), value: v.o, value2: v.c })), format: fN, legend: ["Raised", "Closed"] } });
  if (cats.length) stories.push({ focus: "open", headline: `${CM.AREA[cats[0][0]]} drives ${pct(cats[0][1], open.length)} of open cases`,
    visual: { type: "hbars", title: "Open cases by category", rows: cats.map(([k, v]) => ({ label: CM.AREA[k], value: v, sub: `${pct(v, open.length)} of open` })), format: fN } });
  stories.push({ focus: "hni", headline: hniOpen ? `${fN(hniOpen)} priority (HNI) customers are waiting on an open case` : "No HNI customer has an open case",
    visual: { type: "ring", title: "HNI share of open cases", pct: pc(hniOpen, open.length), label: "HNI", sub: `${fN(hniOpen)} of ${fN(open.length)} open cases` } });

  return {
    id: "care", name: "Customer Care — Cases", tagline: "Customer cases, TAT compliance and ageing",
    asOn: stamp ?? CM.meta.asOn, live: !!stamp,
    kpis: [
      { id: "open", label: "Open cases", value: open.length, format: fN, sub: `${fN(cases.length)} total · ${fN(closed)} closed`, tone: "navy" },
      { id: "overdue", label: "Beyond TAT", value: tat.overdue, format: fN, sub: `${pct(tat.overdue, open.length)} of open`, tone: "red" },
      { id: "atrisk", label: "At risk", value: tat.atrisk, format: fN, sub: "escalated", tone: "amber" },
      { id: "closed", label: "Closed", value: closed, format: fN, sub: `${pct(closed, cases.length)} closure rate`, tone: "green" },
      { id: "hni", label: "HNI open", value: hniOpen, format: fN, sub: "priority customers", tone: "gold" },
    ],
    stories: stories.slice(0, 6),
  };
}

export const care: TvDeptDef = { id: "care", name: "Customer Care — Cases", tagline: "Case TAT, ageing and closure", pages: "Case Management", icon: "Headset", tone: "red", load };
