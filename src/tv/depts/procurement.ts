import type { TvDept, TvDeptDef, TvStory } from "../types";
import { fN, inrCr, shortName } from "../../mobile/fmt";

/** Procurement — PR → PO journey, LIVE from the PR2PO backend.
 *  Mirrors the Executive scorecard of features/pr2po/PrToPoPage.tsx (SAP-origin
 *  journeys, the page's default view) so every number matches the dashboard. */
const API_BASE = "http://192.168.66.28:5002";
const FY_START = "2026-04-01";
const DAY = 86400000;

type PageMod = typeof import("../../features/pr2po/PrToPoPage");
type J = ReturnType<PageMod["buildJourneys"]>[number];

const days = (a: number, b: number) => Math.round((b - a) / DAY);
const todayUtc = () => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); };
/** same as the page's tatOf: end-to-end days for a released journey */
const tatOf = (j: J): number | null => {
  if (!j.done) return null;
  const a = j.m.sap_created ?? j.m.qms_created, b = j.m.po_released ?? j.m.po_created;
  return a !== null && b !== null && b >= a ? days(a, b) : null;
};
const createdOf = (j: J) => j.m.sap_created ?? j.m.qms_created;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pc = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

async function load(): Promise<TvDept> {
  const iso = new Date().toISOString().slice(0, 10);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  let json: { ok?: boolean; sap_pr: never[]; sap_po: never[]; vg: never[] };
  try {
    const r = await fetch(`${API_BASE}/pr2po/data?startdate=${FY_START}&enddate=${iso}`, { signal: ctl.signal });
    if (!r.ok) throw new Error("bad status");
    json = await r.json();
    if (!json || json.ok === false) throw new Error("backend error");
  } catch {
    throw new Error("PR→PO live feed unreachable");
  } finally {
    clearTimeout(timer);
  }
  const { buildJourneys, plantOf } = await import("../../features/pr2po/PrToPoPage");
  const rows = buildJourneys(json).filter(j => j.origin === "sap");

  const tot = rows.length;
  const done = rows.filter(j => j.done);
  const exc = rows.filter(j => j.exception && !j.done);
  const pend = rows.filter(j => !j.done && !j.exception);
  const sum = (js: J[]) => js.reduce((s, j) => s + j.value, 0);
  const tats = done.map(tatOf).filter((x): x is number => x !== null);
  const avgTat = avg(tats);
  const conv = pc(done.length, tot);

  // stage reach (same tests as the page's SC_STEPS)
  const steps: { l: string; n: number }[] = [
    { l: "PR created", n: tot },
    { l: "SAP approval", n: rows.filter(j => j.reached.sap_released || j.reached.qms_created || j.reached.po_created).length },
    { l: "QMS approval", n: rows.filter(j => j.reached.qms_approved || j.reached.po_created).length },
    { l: "Vendor selection (NFA)", n: rows.filter(j => j.reached.nfa_approved || j.reached.po_created).length },
    { l: "PO released", n: done.length },
  ];

  // monthly cohort
  const mm = new Map<string, { c: number; p: number }>();
  rows.forEach(j => {
    const c = createdOf(j); if (c === null) return;
    const k = new Date(c).toISOString().slice(0, 7);
    const e = mm.get(k) ?? { c: 0, p: 0 }; e.c++; if (j.done) e.p++; mm.set(k, e);
  });
  const monthly = [...mm.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
    .map(([k, v]) => ({ label: MON[+k.slice(5) - 1], value: v.c, value2: v.p }));

  // pending ageing since creation
  const today = todayUtc();
  const ageOf = (j: J) => { const c = createdOf(j) ?? j.pendingSince; return c === null ? null : Math.max(0, days(c, today)); };
  const BANDS: [string, number, number, string][] = [["0–15 days", 0, 15, "#1BAF7A"], ["16–30 days", 16, 30, "#2a7fd4"], ["31–60 days", 31, 60, "#EDA100"], ["> 60 days", 61, 1e9, "#c0392b"]];
  const bands = BANDS.map(([l, lo, hi, color]) => ({ label: l, color, value: pend.filter(j => { const a = ageOf(j); return a !== null && a >= lo && a <= hi; }).length }));
  const aged = bands[3].value;

  // project summary
  const byProj = new Map<string, J[]>();
  rows.forEach(j => { const k = plantOf(j); if (k) { const a = byProj.get(k) ?? []; a.push(j); byProj.set(k, a); } });
  const projs = [...byProj.entries()].map(([k, js]) => {
    const d = js.filter(j => j.done), x = js.filter(j => j.exception && !j.done), p = js.filter(j => !j.done && !j.exception);
    return { name: shortName(k), total: js.length, done: d.length, exc: x.length, pend: p.length, conv: pc(d.length, js.length), tat: avg(d.map(tatOf).filter((v): v is number => v !== null)) };
  });
  const topProj = [...projs].sort((a, b) => b.total - a.total).slice(0, 6);
  const topPend = [...projs].filter(p => p.pend > 0).sort((a, b) => b.pend - a.pend).slice(0, 6);
  const topExc = [...projs].filter(p => p.exc > 0).sort((a, b) => b.exc - a.exc).slice(0, 6);

  // departments by avg TAT
  const byDept = new Map<string, J[]>();
  rows.forEach(j => { if (j.dept !== "—") { const a = byDept.get(j.dept) ?? []; a.push(j); byDept.set(j.dept, a); } });
  const deptTat = [...byDept.entries()]
    .map(([k, js]) => ({ k, n: js.filter(j => j.done).length, t: avg(js.map(tatOf).filter((v): v is number => v !== null)) }))
    .filter((d): d is { k: string; n: number; t: number } => d.t !== null)
    .sort((a, b) => b.t - a.t).slice(0, 6);

  const stories: TvStory[] = [];
  const prevStep = steps[steps.length - 2];
  stories.push({
    focus: "total",
    headline: tot ? `${fN(done.length)} of ${fN(tot)} PRs have reached a released PO` : "No PRs in the financial year yet",
    detail: `${steps[1].n ? fN(steps[1].n) : "0"} cleared SAP approval · ${fN(prevStep.n)} cleared NFA`,
    visual: { type: "hbars", title: "PRs reaching each stage", rows: steps.map(s => ({ label: s.l, value: s.n, sub: `${pc(s.n, tot).toFixed(1)}% of PRs` })), format: fN },
  });
  stories.push({
    focus: "released",
    headline: `${conv.toFixed(0)}% of PRs are converted to a released PO`,
    visual: { type: "ring", title: "PR → PO conversion", pct: conv, label: "converted", sub: `${fN(done.length)} of ${fN(tot)} PRs · ${inrCr(sum(done))}` },
  });
  if (monthly.length) stories.push({
    focus: "total",
    headline: `${monthly[monthly.length - 1].label} saw ${fN(monthly[monthly.length - 1].value)} new PRs, ${fN(monthly[monthly.length - 1].value2 ?? 0)} already released`,
    visual: { type: "columns", title: "PRs created vs PO released, by month", data: monthly, format: fN, legend: ["PRs created", "PO released"] },
  });
  stories.push({
    focus: "pending",
    headline: pend.length ? `${fN(aged)} of ${fN(pend.length)} pending PRs are older than 60 days` : "No PRs are pending conversion",
    detail: `${inrCr(sum(pend))} of PR value awaiting a PO`,
    visual: { type: "donut", title: "Pending PRs by age since creation", parts: bands, centre: { value: fN(pend.length), label: "pending" }, format: fN },
  });
  if (topPend.length) stories.push({
    focus: "pending",
    headline: `${topPend[0].name} holds the most pending PRs (${fN(topPend[0].pend)})`,
    visual: { type: "hbars", title: "Pending conversion by project", rows: topPend.map(p => ({ label: p.name, value: p.pend, sub: `${p.conv.toFixed(0)}% converted` })), format: fN },
  });
  if (deptTat.length) stories.push({
    focus: "tat",
    headline: `${deptTat[0].k} is slowest at ${deptTat[0].t.toFixed(0)} days PR to PO`,
    visual: { type: "hbars", title: "Average PR → PO days by department", rows: deptTat.map(d => ({ label: d.k, value: Math.round(d.t), sub: `${fN(d.n)} released` })), format: v => `${fN(v)} d` },
  });
  else if (topProj.length) stories.push({
    focus: "total",
    headline: `${topProj[0].name} raised the most PRs (${fN(topProj[0].total)})`,
    visual: { type: "hbars", title: "PRs by project", rows: topProj.map(p => ({ label: p.name, value: p.total, sub: `${fN(p.done)} released` })), format: fN },
  });
  if (topExc.length && stories.length < 6) stories.push({
    focus: "exc",
    headline: `${fN(exc.length)} PRs were returned or cancelled, led by ${topExc[0].name}`,
    visual: { type: "hbars", title: "Returned / cancelled by project", rows: topExc.map(p => ({ label: p.name, value: p.exc, sub: `of ${fN(p.total)} PRs` })), format: fN },
  });

  return {
    id: "procurement", name: "Procurement — PR to PO", tagline: "From purchase requisition to released PO, live from SAP and QMS",
    asOn: `live · ${new Date().toLocaleString("en-IN")}`, live: true,
    kpis: [
      { id: "total", label: "Total PRs", value: tot, format: fN, sub: `${inrCr(sum(rows))} requisitioned`, tone: "navy" },
      { id: "released", label: "PO released", value: done.length, format: fN, sub: `${conv.toFixed(1)}% of PRs`, tone: "green" },
      { id: "pending", label: "Pending conversion", value: pend.length, format: fN, sub: `${inrCr(sum(pend))} in flight`, tone: "amber" },
      { id: "exc", label: "Returned / cancelled", value: exc.length, format: fN, sub: `${pc(exc.length, tot).toFixed(1)}% of PRs`, tone: "red" },
      { id: "tat", label: "Avg PR → PO TAT", value: avgTat ?? 0, format: v => (avgTat === null ? "—" : `${v.toFixed(0)} days`), sub: `${fN(tats.length)} released journeys`, tone: "violet" },
    ],
    stories: stories.slice(0, 6),
  };
}

export const procurement: TvDeptDef = { id: "procurement", name: "Procurement — PR to PO", tagline: "PR to PO conversion, ageing and turnaround", pages: "PR to PO journey", icon: "Workflow", tone: "teal", load };
