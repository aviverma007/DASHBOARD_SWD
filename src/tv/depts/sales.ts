import type { TvDept, TvDeptDef } from "../types";
import { PDRN } from "../../utils/pdrnLogic";
import { overall, salesByMonth } from "../../mobile/data";
import { DATA_AS_ON } from "../../config/dataInfo";
import { fN, inrCr, pct, shortName } from "../../mobile/fmt";

/** Sales — reference department module (other modules follow this shape). */
async function load(): Promise<TvDept> {
  const ov = overall();
  const months = salesByMonth(12);
  const last = months[months.length - 1], prev = months[months.length - 2];
  const mom = prev && prev.value > 0 ? ((last.value - prev.value) / prev.value) * 100 : 0;
  const top = [...ov.projects].sort((a, b) => b.sold.tsv - a.sold.tsv).filter(p => p.sold.tsv > 0).slice(0, 6);
  const topShare = ov.sold.tsv ? (top[0].sold.tsv / ov.sold.tsv) * 100 : 0;

  // configuration mix from bookings
  const cfg = new Map<number, number>();
  PDRN.R.forEach(r => cfg.set(r.cfgIdx, (cfg.get(r.cfgIdx) ?? 0) + 1));
  const mix = [...cfg.entries()].sort((a, b) => b[1] - a[1]);
  const mixTop = mix.slice(0, 5).map(([c, n]) => ({ label: PDRN.CFG[c], value: n }));
  const rest = mix.slice(5).reduce((s, [, n]) => s + n, 0);
  if (rest) mixTop.push({ label: "Other", value: rest });

  return {
    id: "sales", name: "Sales", tagline: "Bookings, sales value and absorption across the portfolio",
    asOn: DATA_AS_ON,
    kpis: [
      { id: "tsv", label: "Total sales value", value: ov.sold.tsv, format: v => inrCr(v), sub: `${fN(ov.sold.units)} units booked`, tone: "navy" },
      { id: "units", label: "Units sold", value: ov.sold.units, format: fN, sub: `of ${fN(ov.total.units)} in inventory`, tone: "gold" },
      { id: "abs", label: "Absorption", value: ov.total.units ? (ov.sold.units / ov.total.units) * 100 : 0, format: v => `${v.toFixed(0)}%`, sub: "units sold ÷ total units", tone: "green" },
      { id: "rate", label: "Average rate", value: ov.rate.avg ?? 0, format: v => `₹${fN(v)}`, sub: "per sq ft", tone: "teal" },
      { id: "month", label: `${last.label} sales`, value: last.value, format: v => inrCr(v), sub: `${fN(last.units)} units this month`, tone: "violet" },
      { id: "avail", label: "Units available", value: ov.unsold.units, format: fN, sub: `${(ov.unsold.area / 1e5).toFixed(2)} L sq ft left to sell`, tone: "amber" },
    ],
    stories: [
      { focus: "tsv", headline: `${shortName(top[0].projectName)} leads with ${topShare.toFixed(0)}% of total sales value`,
        visual: { type: "hbars", title: "Top projects by sales value", rows: top.map(p => ({ label: shortName(p.projectName), value: p.sold.tsv, sub: `${fN(p.sold.units)} units · ${p.soldPct}% absorbed` })), format: v => inrCr(v) } },
      { focus: "month", headline: mom >= 0 ? `${last.label} is up ${mom.toFixed(0)}% on ${prev.label}` : `${last.label} is down ${Math.abs(mom).toFixed(0)}% on ${prev.label}`,
        visual: { type: "columns", title: "Monthly sales value — last 12 months", data: months.map(m => ({ label: m.label, value: m.value })), format: v => inrCr(v) } },
      { focus: "units", headline: `${fN(ov.sold.units)} homes sold — the configuration mix`,
        visual: { type: "donut", title: "Units sold by configuration", parts: mixTop, centre: { value: fN(ov.sold.units), label: "units sold" }, format: fN } },
      { focus: "abs", headline: `${pct(ov.sold.units, ov.total.units)} of the portfolio is sold`,
        visual: { type: "ring", title: "Portfolio absorption", pct: ov.total.units ? (ov.sold.units / ov.total.units) * 100 : 0, label: "sold", sub: `${fN(ov.sold.units)} of ${fN(ov.total.units)} units` } },
      { focus: "avail", headline: "What is still left to sell, project by project",
        visual: { type: "hbars", title: "Units available by project", rows: [...ov.projects].sort((a, b) => b.unsold.units - a.unsold.units).filter(p => p.unsold.units > 0).slice(0, 6).map(p => ({ label: shortName(p.projectName), value: p.unsold.units, sub: `${(p.unsold.area / 1e5).toFixed(2)} L sq ft` })), format: fN } },
    ],
  };
}

export const sales: TvDeptDef = { id: "sales", name: "Sales", tagline: "Bookings, sales value and absorption", pages: "Bookings · Overview", icon: "ReceiptText", tone: "navy", load };
