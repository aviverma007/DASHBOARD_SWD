import type { TvDept, TvDeptDef } from "../types";
import { DATA_AS_ON } from "../../config/dataInfo";
import { fN, pct, pctN } from "../../mobile/fmt";

/** Channel Partners — same aggregation as src/mobile/screens/ChannelPartners.tsx (all time, all projects). */
async function load(): Promise<TvDept> {
  const L = await import("../../utils/cpLogic");
  const scoped = L.filterRecords(null, { type: "all" });
  const all = L.summariseByChannelPartner(scoped);
  const cps = all.filter(s => s.name !== "Direct");
  const direct = all.find(s => s.name === "Direct");
  const tot = { units: cps.reduce((s, c) => s + c.units, 0), area: cps.reduce((s, c) => s + c.area, 0), tsv: cps.reduce((s, c) => s + c.tsv, 0) };
  const cancel = L.cancelledRebookingSummary(scoped);
  const topCancel = L.topByCancelled(scoped, 5);
  const trend = L.monthlyTrend(scoped, true).slice(-12);

  const byTsv = [...cps].filter(c => c.tsv > 0).sort((a, b) => b.tsv - a.tsv);
  const byUnits = [...cps].filter(c => c.units > 0).sort((a, b) => b.units - a.units);
  const top5 = byTsv.slice(0, 5);
  const top5Share = tot.tsv > 0 ? pctN(top5.reduce((s, c) => s + c.tsv, 0), tot.tsv) : 0;
  const avgUnit = tot.units ? tot.tsv / tot.units : 0;
  const recovered = cancel.cancelled ? (cancel.rebooked / cancel.cancelled) * 100 : 0;
  const active = cps.filter(c => c.units > 0).length;
  const last = trend[trend.length - 1], prev = trend[trend.length - 2];
  const mom = last && prev && prev.tsv > 0 ? ((last.tsv - prev.tsv) / prev.tsv) * 100 : null;
  const dirTotal = (direct?.units ?? 0) + tot.units;

  const rest = tot.tsv - top5.reduce((s, c) => s + c.tsv, 0);
  const topParts = top5.map(c => ({ label: String(c.name || "Unnamed partner").slice(0, 22), value: c.tsv }));
  if (rest > 0) topParts.push({ label: "All others", value: rest });

  return {
    id: "partners", name: "Channel Partners", tagline: "Who brings the bookings: partner leaderboard, concentration and cancellations",
    asOn: DATA_AS_ON,
    kpis: [
      { id: "tsv", label: "Sold via partners", value: tot.tsv, format: v => L.fCr(v), sub: `${fN(tot.units)} units · ${L.fArea(tot.area)}`, tone: "gold" },
      { id: "units", label: "Units via partners", value: tot.units, format: fN, sub: dirTotal ? `${pct(tot.units, dirTotal)} of units sold` : "no bookings", tone: "navy" },
      { id: "partners", label: "Active partners", value: active, format: fN, sub: `of ${fN(cps.length)} on record`, tone: "teal" },
      { id: "avg", label: "Average per unit", value: avgUnit, format: v => (v ? L.fCr(v) : "—"), sub: "value ÷ units sold", tone: "green" },
      { id: "cancel", label: "Cancelled", value: cancel.cancelled, format: fN, sub: `${L.fCr(cancel.cancelledTsv)} value`, tone: "red" },
      { id: "recover", label: "Rebooked", value: recovered, format: v => `${v.toFixed(0)}%`, sub: `${fN(cancel.rebooked)} of ${fN(cancel.cancelled)} recovered`, tone: "amber" },
    ],
    stories: [
      { focus: "tsv", headline: top5.length ? `Top 5 partners bring ${top5Share.toFixed(0)}% of channel sales value` : "No channel-partner sales recorded",
        detail: top5.length ? `${top5[0].name} leads with ${pct(top5[0].tsv, tot.tsv)}` : undefined,
        visual: { type: "donut", title: "Share of sales value · top 5 partners", parts: topParts, centre: { value: L.fCr(tot.tsv), label: "via partners" }, format: v => L.fCr(v) } },
      { focus: "units", headline: byUnits.length ? `${String(byUnits[0].name || "Unnamed partner").slice(0, 40)} sold the most units: ${fN(byUnits[0].units)}` : "No units sold through partners",
        visual: { type: "hbars", title: "Top partners by units sold", rows: byUnits.slice(0, 7).map(c => ({ label: String(c.name || "Unnamed partner").slice(0, 24), value: c.units, sub: `${L.fCr(c.tsv)} · ${L.fArea(c.area)}` })), format: fN } },
      { focus: "partners", headline: byTsv.length ? `${fN(active)} partners are active; the leader sits at ${L.fCr(byTsv[0].tsv)}` : "No active partners yet",
        visual: { type: "hbars", title: "Top partners by sales value", rows: byTsv.slice(0, 7).map(c => ({ label: String(c.name || "Unnamed partner").slice(0, 24), value: c.tsv, sub: `${fN(c.units)} units` })), format: v => L.fCr(v) } },
      { focus: "avg", headline: last ? (mom === null ? `${last.label}: ${L.fCr(last.tsv * 1e7)} sold via partners` : mom >= 0 ? `${last.label} partner sales up ${mom.toFixed(0)}% on ${prev.label}` : `${last.label} partner sales down ${Math.abs(mom).toFixed(0)}% on ${prev.label}`) : "No monthly partner bookings yet",
        visual: { type: "columns", title: "Partner sales value by month (₹ Cr)", data: trend.map(t => ({ label: t.label, value: t.tsv })), format: v => `₹${v.toFixed(1)} Cr` } },
      { focus: "cancel", headline: cancel.cancelled ? `${fN(cancel.cancelled)} bookings cancelled, worth ${L.fCr(cancel.cancelledTsv)}` : "No cancellations on record",
        detail: topCancel.length ? `Most cancellations: ${topCancel[0].name} (${topCancel[0].cancelled})` : undefined,
        visual: { type: "hbars", title: "Partners with most cancellations", rows: topCancel.map(c => ({ label: String(c.name || "Unnamed partner").slice(0, 24), value: c.cancelled, sub: `${fN(c.rebooked)} rebooked` })), format: fN } },
      { focus: "recover", headline: cancel.cancelled ? `${recovered.toFixed(0)}% of cancelled units have been rebooked` : "Nothing to recover: no cancellations",
        visual: { type: "ring", title: "Cancelled units rebooked", pct: recovered, label: "rebooked", sub: `${fN(cancel.rebooked)} rebooked · ${fN(cancel.stillVacant)} still vacant` } },
    ],
  };
}

export const partners: TvDeptDef = { id: "partners", name: "Channel Partners", tagline: "Partner leaderboard, concentration and cancellations", pages: "Channel Partners", icon: "Handshake", tone: "gold", load };
