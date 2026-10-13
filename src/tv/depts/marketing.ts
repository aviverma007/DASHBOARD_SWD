import type { TvDept, TvDeptDef } from "../types";
import { DATA_AS_ON } from "../../config/dataInfo";
import { fN, pct } from "../../mobile/fmt";

/** Marketing & CRM — Gallery Footfall + Digital Leads (same logic as the mobile/desktop screens). */
async function load(): Promise<TvDept> {
  const ff = await import("../../utils/footfallLogic");
  const dg = await import("../../components/leads/digitalShared");

  // Footfall — "All time", no filters (default view of the screen)
  const rows = ff.FF_RECORDS;
  const total = rows.length;
  const fun = ff.ffFunnel(rows);
  const monthly = ff.ffMonthly(rows).slice(-12);
  const fBooked = fun.steps[3].value;
  const conv = total ? (fBooked / total) * 100 : 0;
  const byProject = new Map<number, number>();
  rows.forEach(r => { if (r.p >= 0) byProject.set(r.p, (byProject.get(r.p) ?? 0) + 1); });
  const topProj = [...byProject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([k, v]) => ({ label: ff.FF.P[k], value: v, sub: `${pct(v, total, 1)} of visits` }));
  const bySrc = new Map<number, number>();
  rows.forEach(r => { if (r.src >= 0) bySrc.set(r.src, (bySrc.get(r.src) ?? 0) + 1); });
  const srcParts = [...bySrc.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: ff.FF.SRC[k], value: v }));

  // Digital — "All time", no filters
  const drows = dg.RECORDS;
  const dTotal = drows.length;
  const dfun = dg.digitalFunnel(drows);
  const dMonthly = dg.digMonthly(drows).slice(-12);
  const qual = dfun.steps[1].value, dBooked = dfun.steps[3].value;
  const qualPct = dTotal ? (qual / dTotal) * 100 : 0;
  const dBookedPct = dTotal ? (dBooked / dTotal) * 100 : 0;
  const bySub = new Map<number, number>();
  drows.forEach(r => { if (r.sub >= 0) bySub.set(r.sub, (bySub.get(r.sub) ?? 0) + 1); });
  const subSorted = [...bySub.entries()].sort((a, b) => b[1] - a[1]);
  const subParts = subSorted.slice(0, 5).map(([k, v]) => ({ label: dg.DG.SUB[k], value: v }));
  const subRest = subSorted.slice(5).reduce((s, [, v]) => s + v, 0);
  if (subRest) subParts.push({ label: "Other", value: subRest });

  const peak = monthly.reduce((b, m) => (m.value > b.value ? m : b), { label: "", value: 0 });
  const dPeak = dMonthly.reduce((b, m) => (m.value > b.value ? m : b), { label: "", value: 0 });

  const stories: TvDept["stories"] = [];
  if (monthly.length) stories.push({
    focus: "visits",
    headline: `${fN(total)} site visits logged; ${peak.label} is the busiest of the last ${monthly.length} months`,
    visual: { type: "columns", title: "Gallery visits by month — last 12 months", data: monthly.map(m => ({ label: m.label, value: m.value })), format: fN },
  });
  if (topProj.length) stories.push({
    focus: "fbooked",
    headline: `${topProj[0].label} draws ${pct(topProj[0].value, total)} of all gallery visits`,
    visual: { type: "hbars", title: "Visits by project", rows: topProj, format: fN },
  });
  stories.push({
    focus: "conv",
    headline: `${pct(fBooked, total, 1)} of site visits end in a booking`,
    visual: { type: "ring", title: "Visit → booked conversion", pct: conv, label: "booked", sub: `${fN(fBooked)} of ${fN(total)} visits` },
  });
  if (dMonthly.length) stories.push({
    focus: "enq",
    headline: `${fN(dTotal)} digital enquiries; ${dPeak.label} was the peak month`,
    visual: { type: "columns", title: "Digital enquiries by month — last 12 months", data: dMonthly.map(m => ({ label: m.label, value: m.value })), format: fN },
  });
  stories.push({
    focus: "qual",
    headline: `${pct(qual, dTotal)} of enquiries qualify; ${fN(dfun.steps[2].value)} reach site visit or beyond`,
    visual: { type: "hbars", title: "Digital conversion funnel", rows: dfun.steps.map(s => ({ label: s.label, value: s.value, sub: `${s.pctOfTotal.toFixed(s.pctOfTotal < 10 ? 1 : 0)}% of enquiries` })), format: fN },
  });
  if (subParts.length) stories.push({
    focus: "dbook",
    headline: `${subParts[0].label} is the top lead source at ${pct(subParts[0].value, dTotal)} of enquiries`,
    visual: { type: "donut", title: "Digital enquiries by source", parts: subParts, centre: { value: fN(dTotal), label: "enquiries" }, format: fN },
  });
  // keep source mix of walk-ins available as a detail on the visits story
  if (srcParts.length && stories[0]) stories[0].detail = srcParts.slice(0, 3).map(p => `${p.label} ${pct(p.value, total)}`).join(" · ");

  return {
    id: "marketing", name: "Marketing & CRM", tagline: "Gallery footfall and digital lead conversion",
    asOn: DATA_AS_ON,
    kpis: [
      { id: "visits", label: "Gallery visits", value: total, format: fN, sub: `since ${monthly.length ? ff.ffMonthly(rows)[0].label : "start"}`, tone: "violet" },
      { id: "fbooked", label: "Visits booked", value: fBooked, format: fN, sub: `${fN(fun.steps[1].value)} still in pipeline`, tone: "green" },
      { id: "conv", label: "Visit → booked", value: conv, format: v => `${v.toFixed(1)}%`, sub: "share of visits at Booked", tone: "gold" },
      { id: "enq", label: "Digital enquiries", value: dTotal, format: fN, sub: `${fN(dfun.lost)} closed-lost`, tone: "navy" },
      { id: "qual", label: "Qualified leads", value: qual, format: fN, sub: `${qualPct.toFixed(0)}% of enquiries`, tone: "teal" },
      { id: "dbook", label: "Digital booked", value: dBooked, format: fN, sub: `${dBookedPct.toFixed(2)}% booked rate`, tone: "amber" },
    ],
    stories,
  };
}

export const marketing: TvDeptDef = { id: "marketing", name: "Marketing & CRM", tagline: "Gallery footfall and digital lead conversion", pages: "Gallery Footfall · Digital Leads", icon: "Zap", tone: "violet", load };
