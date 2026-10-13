import type { TvDept, TvDeptDef } from "../types";
import { DATA_AS_ON } from "../../config/dataInfo";
import { fN, pct, pctN, shortName, sqftL } from "../../mobile/fmt";
import { makeCatOf, baseUnits, stats } from "../../utils/smartworldLogic";
import type { RawInventoryDataset, RawUnit, FilterState } from "../../types/smartworldRaw";

/* Tracker definitions copied from mobile/screens/Tracker.tsx: activities = leaf WBS tasks,
   Overdue = planned end passed and not complete, Slip = planned end later than baseline. */
const EPOCH = Date.UTC(2022, 0, 1);
const DAY = 86400000;
const AS_ON = Math.round((Date.UTC(2026, 8, 28) - EPOCH) / DAY);
interface TrkFile {
  meta: { asOn: string };
  PROJECTS: string[]; STATUS: string[];
  T: (string | number)[][];
}
interface Task { proj: number; pct: number; done: boolean; active: boolean; overdue: boolean; slip: number; pe: number }
const AGE = [["0–30 d", 0, 30], ["31–90 d", 31, 90], ["91–180 d", 91, 180], ["> 180 d", 181, 1e9]] as const;
const avg = (xs: Task[]) => (xs.length ? xs.reduce((s, t) => s + t.pct, 0) / xs.length : 0);

async function load(): Promise<TvDept> {
  const RD = (await import("../../data/smartworldInventory.json")).default as unknown as RawInventoryDataset;
  const D = (await import("../../data/projectTracker.json")).default as unknown as TrkFile;

  // ---- Inventory (unfiltered, same baseUnits/stats as the screen)
  const catOf = makeCatOf(RD);
  const state: FilterState = { proj: new Set<number>(), status: "all", cat: -1, cfg: -1 };
  const arr = baseUnits(RD.U, state, catOf);
  const s = stats(arr);
  const byProj = new Map<number, RawUnit[]>();
  arr.forEach(u => { const l = byProj.get(u[0]) ?? []; l.push(u); byProj.set(u[0], l); });
  const projInv = [...byProj.entries()]
    .map(([i, us]) => ({ i, n: us.length, av: us.filter(u => u[8] === 0).length, bk: us.filter(u => u[8] === 1).length }))
    .sort((a, b) => b.av - a.av);
  const availRows = projInv.filter(p => p.av > 0).slice(0, 6)
    .map(p => ({ label: shortName(RD.P[p.i]), value: p.av, sub: `${pct(p.av, p.n)} of ${fN(p.n)} units` }));

  // ---- Tracker
  const acts: Task[] = D.T.filter(t => (t[15] as number) === 1).map(t => {
    const st = t[4] as number, p = t[3] as number, pe = t[6] as number, be = t[9] as number;
    const sName = D.STATUS[st];
    const done = sName === "Complete" || sName === "Quality checked" || p >= 100;
    return { proj: t[0] as number, pct: p, pe, done, active: sName === "Started",
      overdue: !done && pe >= 0 && pe < AS_ON, slip: pe >= 0 && be >= 0 && pe > be ? pe - be : 0 };
  });
  const done = acts.filter(t => t.done);
  const late = acts.filter(t => t.overdue);
  const slipped = acts.filter(t => t.slip > 0);
  const overall = avg(acts);
  const avgLate = late.length ? late.reduce((a, t) => a + (AS_ON - t.pe), 0) / late.length : 0;
  const avgSlip = slipped.length ? slipped.reduce((a, t) => a + t.slip, 0) / slipped.length : 0;
  const projTrk = D.PROJECTS.map((name, pi) => {
    const a = acts.filter(t => t.proj === pi);
    return { name, n: a.length, pct: avg(a), d: done.filter(t => t.proj === pi).length, od: a.filter(t => t.overdue).length, slip: a.filter(t => t.slip > 0).length };
  }).filter(p => p.n);
  const bands = AGE.map(([l, lo, hi]) => ({ label: l, value: late.filter(t => { const d = AS_ON - t.pe; return d >= lo && d <= hi; }).length }));
  const slipRows = [...projTrk].filter(p => p.slip > 0).sort((a, b) => b.slip - a.slip).slice(0, 6)
    .map(p => ({ label: shortName(p.name), value: p.slip, sub: `${pct(p.slip, p.n)} of ${fN(p.n)} activities` }));

  const stories: TvDept["stories"] = [];
  if (availRows.length) stories.push({
    focus: "avail",
    headline: `${availRows[0].label} has the most unsold stock: ${fN(availRows[0].value)} units available`,
    visual: { type: "hbars", title: "Available units by project", rows: availRows, format: fN },
  });
  stories.push({
    focus: "area",
    headline: `${sqftL(s.areaAv)} is still available against ${sqftL(s.areaBk)} booked`,
    visual: { type: "donut", title: "Super area by status", parts: [{ label: "Available", value: s.areaAv, color: "#16a06f" }, { label: "Booked", value: s.areaBk, color: "#1e3163" }, { label: "Blocked", value: s.areaBl, color: "#e0a21a" }].filter(p => p.value > 0), centre: { value: sqftL(s.areaAv + s.areaBk + s.areaBl).replace(" sq ft", ""), label: "total area" }, format: sqftL },
  });
  stories.push({
    focus: "bkpct",
    headline: `${pct(s.bk, s.t)} of ${fN(s.t)} units are booked; ${fN(s.bl)} are held back`,
    visual: { type: "ring", title: "Inventory booked", pct: pctN(s.bk, s.t), label: "booked", sub: `${fN(s.bk)} of ${fN(s.t)} units` },
  });
  if (projTrk.length) {
    const lead = [...projTrk].sort((a, b) => b.pct - a.pct)[0];
    stories.push({
      focus: "progress",
      headline: `Construction averages ${overall.toFixed(0)}% complete; ${shortName(lead.name)} leads at ${lead.pct.toFixed(0)}%`,
      visual: { type: "hbars", title: "Average completion by project", rows: projTrk.slice(0, 8).map(p => ({ label: shortName(p.name), value: p.pct, sub: `${fN(p.d)} of ${fN(p.n)} activities done` })), format: v => `${v.toFixed(0)}%` },
    });
  }
  if (late.length) stories.push({
    focus: "late",
    headline: `${fN(late.length)} activities are overdue, ${avgLate.toFixed(0)} days past plan on average`,
    visual: { type: "columns", title: "Overdue activities by ageing", data: bands, format: fN },
  });
  if (slipRows.length) stories.push({
    focus: "slip",
    headline: `${fN(slipped.length)} activities run later than baseline, by ${avgSlip.toFixed(0)} days on average`,
    visual: { type: "hbars", title: "Slipped activities by project", rows: slipRows, format: fN },
  });

  return {
    id: "projects", name: "Projects & Inventory", tagline: "Unit availability and construction progress",
    asOn: `${DATA_AS_ON} · tracker ${D.meta.asOn}`,
    kpis: [
      { id: "avail", label: "Units available", value: s.av, format: fN, sub: `${pct(s.av, s.t)} of ${fN(s.t)} units`, tone: "green" },
      { id: "area", label: "Available area", value: s.areaAv, format: sqftL, sub: `${sqftL(s.areaBk)} booked`, tone: "teal" },
      { id: "bkpct", label: "Units booked", value: s.bk, format: fN, sub: `${pct(s.bk, s.t)} of inventory`, tone: "navy" },
      { id: "progress", label: "Construction progress", value: overall, format: v => `${v.toFixed(0)}%`, sub: `${fN(done.length)} of ${fN(acts.length)} activities done`, tone: "gold" },
      { id: "late", label: "Overdue activities", value: late.length, format: fN, sub: `avg ${Math.round(avgLate)} d past planned end`, tone: "red" },
      { id: "slip", label: "Slipped vs baseline", value: slipped.length, format: fN, sub: `avg ${Math.round(avgSlip)} d later`, tone: "amber" },
    ],
    stories,
  };
}

export const projects: TvDeptDef = { id: "projects", name: "Projects & Inventory", tagline: "Unit availability and construction progress", pages: "Inventory · Project Tracker", icon: "Building2", tone: "teal", load };
