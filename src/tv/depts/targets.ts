import type { TvDept, TvDeptDef } from "../types";
import { DATA_AS_ON } from "../../config/dataInfo";
import { cr, fN, inrCr, pct, pctN, shortName } from "../../mobile/fmt";

/** Targets & Advance — Target vs Actual (AOP) + EOI / Advance money in hand.
 *  Same aggregation as src/mobile/screens/Target.tsx and Eoi.tsx. */
interface MonthMeta { year: number; month: number; label: string }
interface PT { name: string; units: number[]; area: number[]; rate: number[]; sale_value: number[] }
interface PA { name: string; monthly_units: number[]; monthly_tsv: number[]; monthly_area: number[] }
interface EoiFile { meta: { asOn: string }; PROJECTS: string[]; C: (string | number)[][] }

const fyEnd = (y: number, m: number) => (m >= 4 ? y + 1 : y);
const sumAt = (arr: number[] | undefined, idxs: number[]) => idxs.reduce((s, i) => s + (arr?.[i] ?? 0), 0);
const EPOCH = Date.UTC(2022, 0, 1), DAY = 86400000;
const AS_ON = Math.round((Date.UTC(2026, 8, 25) - EPOCH) / DAY);

async function load(): Promise<TvDept> {
  const [rt, ra, re] = await Promise.all([
    import("../../data/targetData.json"), import("../../data/tvAnalytics.json"), import("../../data/eoiData.json"),
  ]);
  const TD = (rt.default ?? rt) as unknown as { months: MonthMeta[]; projects: PT[] };
  const TV = (ra.default ?? ra) as unknown as { projects: PA[] };
  const D = (re.default ?? re) as unknown as EoiFile;
  const TL = TD.months;

  // ---------- Target vs actual (default FY = current FY, as the mobile screen) ----------
  const NOW = new Date();
  const TODAY_IDX = TL.findIndex(m => m.year === NOW.getFullYear() && m.month === NOW.getMonth() + 1);
  const fys = [...new Set(TL.map(m => fyEnd(m.year, m.month)))].sort((a, b) => a - b);
  const curFy = fyEnd(NOW.getFullYear(), NOW.getMonth() + 1);
  const fy = fys.includes(curFy) ? curFy : fys[fys.length - 1];
  const fyLabel = fy ? `FY ${fy - 1}-${String(fy).slice(-2)}` : "FY";
  const idxs: number[] = [];
  TL.forEach((m, i) => { if (fyEnd(m.year, m.month) === fy) idxs.push(i); });
  const todayIn = TODAY_IDX >= 0 ? idxs.filter(i => i <= TODAY_IDX) : idxs;
  const actOf = (name: string) => TV.projects.find(a => a.name === name);
  const projTsv = (p: PT, ix: number[]) => ({ t: sumAt(p.sale_value, ix), a: sumAt(actOf(p.name)?.monthly_tsv, ix) });
  const projUnits = (p: PT, ix: number[]) => ({ t: sumAt(p.units, ix), a: sumAt(actOf(p.name)?.monthly_units, ix) });
  const tot = (f: (p: PT, ix: number[]) => { t: number; a: number }, ix: number[]) =>
    TD.projects.reduce((s, p) => { const v = f(p, ix); return { t: s.t + v.t, a: s.a + v.a }; }, { t: 0, a: 0 });
  const T = tot(projTsv, idxs), U = tot(projUnits, idxs), toDate = tot(projTsv, todayIn);
  const ach = T.t > 0 ? (T.a / T.t) * 100 : 0;
  const unitsPct = U.t > 0 ? (U.a / U.t) * 100 : 0;
  const pace = toDate.t > 0 ? (toDate.a / toDate.t) * 100 : 0;
  const gap = T.t - T.a;

  const rows = TD.projects.map(p => ({ name: p.name, has: !!actOf(p.name), tsv: projTsv(p, idxs) }))
    .filter(r => r.has && (r.tsv.t || r.tsv.a)).sort((a, b) => b.tsv.a - a.tsv.a).slice(0, 6);
  const topProj = rows[0];
  const projAchieve = [...rows].filter(r => r.tsv.t > 0).sort((a, b) => b.tsv.a / b.tsv.t - a.tsv.a / a.tsv.t)[0];

  const monthIx = todayIn.length ? todayIn : idxs;
  const months = monthIx.slice(-8).map(i => ({
    label: TL[i].label.replace(/\s?\d{4}$/, "").slice(0, 8),
    value: TD.projects.reduce((s, p) => s + (actOf(p.name)?.monthly_tsv[i] ?? 0), 0),
    value2: TD.projects.reduce((s, p) => s + (p.sale_value[i] ?? 0), 0),
  }));
  const hitMonths = months.filter(m => m.value2 > 0 && m.value >= m.value2).length;

  // ---------- EOI / Advance ----------
  const ALL = D.C.map(c => {
    const cleared = c[8] as number, adj = c[9] as number, refunds = c[10] as number, first = c[6] as number;
    return { proj: c[1] as number, status: c[2] as number, cleared, adj, n: c[12] as number, net: cleared + adj + refunds, age: first >= 0 ? Math.max(0, AS_ON - first) : 0 };
  });
  const isPool = (c: (typeof ALL)[number]) => c.n >= 100 && c.cleared > 0 && Math.abs(c.adj) >= 0.9 * c.cleared;
  const REAL = ALL.filter(c => !isPool(c));
  const HOLDING = REAL.filter(c => c.status === 0 && c.net > 1000);
  const isEoi = (p: number) => D.PROJECTS[p] === "CODE 67 GURGAON";
  const sum = (a: typeof ALL) => a.reduce((s, c) => s + c.net, 0);
  const inHand = sum(HOLDING);
  const advAmt = sum(HOLDING.filter(c => !isEoi(c.proj))), eoiAmt = sum(HOLDING.filter(c => isEoi(c.proj)));
  const st = [0, 1, 2].map(s => REAL.filter(c => c.status === s).length);
  const zeroAll = st[0] - HOLDING.length;
  const avgAge = HOLDING.length ? HOLDING.reduce((s, c) => s + c.age, 0) / HOLDING.length : 0;
  const convPct = pctN(st[1], REAL.length);
  const BANDS = [
    { l: "0–90 d", lo: 0, hi: 90 }, { l: "91–180 d", lo: 91, hi: 180 }, { l: "181–270 d", lo: 181, hi: 270 },
    { l: "271–365 d", lo: 271, hi: 365 }, { l: "Over 1 year", lo: 366, hi: 1e9 },
  ].map(b => { const cs = HOLDING.filter(c => c.age >= b.lo && c.age <= b.hi); return { l: b.l, n: cs.length, amt: sum(cs) }; });
  const oldAmt = BANDS[3].amt + BANDS[4].amt;
  const biggestBand = [...BANDS].sort((a, b) => b.amt - a.amt)[0];

  return {
    id: "targets", name: "Targets & Advance", tagline: "AOP target vs actual bookings, and allotment-pending EOI / advance money",
    asOn: DATA_AS_ON,
    kpis: [
      { id: "ach", label: `${fyLabel} achievement`, value: ach, format: v => `${v.toFixed(0)}%`, sub: "of AOP sales-value target", tone: "green" },
      { id: "tsv", label: "Sales value achieved", value: T.a, format: v => cr(v), sub: `of ${cr(T.t)} target`, tone: "navy" },
      { id: "pace", label: "Pace to date", value: pace, format: v => `${v.toFixed(0)}%`, sub: `${cr(toDate.a)} vs ${cr(toDate.t)} planned`, tone: "teal" },
      { id: "units", label: "Units vs target", value: U.a, format: fN, sub: `of ${fN(U.t)} planned units`, tone: "violet" },
      { id: "hand", label: "EOI / advance in hand", value: inHand, format: v => inrCr(v, 1), sub: `${fN(HOLDING.length)} customers awaiting allotment`, tone: "gold" },
      { id: "conv", label: "Converted to allotment", value: convPct, format: v => `${v.toFixed(0)}%`, sub: `${fN(st[1])} of ${fN(REAL.length)} customers`, tone: "amber" },
    ],
    stories: [
      { focus: "ach", headline: T.t > 0 ? `${fyLabel}: ${ach.toFixed(0)}% of the sales-value target achieved` : `No AOP target loaded for ${fyLabel}`,
        detail: T.t > 0 ? (gap >= 0 ? `${cr(gap)} still to go` : `${cr(-gap)} ahead of target`) : undefined,
        visual: { type: "ring", title: "Sales value vs AOP target", pct: Math.min(ach, 100), label: "achieved", sub: `${cr(T.a)} of ${cr(T.t)}` } },
      { focus: "tsv", headline: topProj ? `${shortName(topProj.name)} leads with ${pct(topProj.tsv.a, T.a)} of value achieved${projAchieve ? `; ${shortName(projAchieve.name)} best vs plan` : ""}`.slice(0, 89) : "No project actuals in this year yet",
        visual: { type: "hbars", title: `Sales value achieved by project · ${fyLabel}`, rows: rows.map(r => ({ label: shortName(r.name), value: r.tsv.a, sub: r.tsv.t > 0 ? `target ${cr(r.tsv.t)} · ${Math.round((r.tsv.a / r.tsv.t) * 100)}%` : "no target" })), format: v => cr(v) } },
      { focus: "pace", headline: toDate.t > 0 ? `Running at ${pace.toFixed(0)}% of the plan to date` : "No plan months have fallen due yet",
        detail: months.length ? `${hitMonths} of last ${months.length} months met target` : undefined,
        visual: { type: "columns", title: "Monthly sales value — actual vs target", data: months, format: v => cr(v), legend: ["Actual", "Target"] } },
      { focus: "units", headline: U.t > 0 ? `${fN(U.a)} of ${fN(U.t)} planned units booked (${unitsPct.toFixed(0)}%)` : `${fN(U.a)} units booked, no unit plan loaded`,
        visual: { type: "ring", title: "Units booked vs plan", pct: Math.min(unitsPct, 100), label: "of plan", sub: `${fN(U.a)} of ${fN(U.t)} units` } },
      { focus: "hand", headline: inHand > 0 ? `${inrCr(inHand, 1)} held; ${pct(advAmt, inHand)} is RERA advance, ${pct(eoiAmt, inHand)} EOI` : "No allotment-pending money in hand",
        visual: { type: "donut", title: "Money in hand by type", parts: [{ label: "Advance (RERA)", value: Math.max(advAmt, 0) }, { label: "EOI (Code 67)", value: Math.max(eoiAmt, 0) }].filter(p => p.value > 0), centre: { value: inrCr(inHand, 1), label: "in hand" }, format: v => inrCr(v, 1) } },
      { focus: "conv", headline: biggestBand && biggestBand.amt > 0 ? `${pct(oldAmt, inHand)} of money has waited over 270 days` : `${pct(st[1], REAL.length)} of customers are converted to allotment`,
        detail: `Average wait ${Math.round(avgAge)} days · ${fN(zeroAll)} pending codes show ₹0`,
        visual: { type: "hbars", title: "Money in hand by ageing", rows: BANDS.filter(b => b.n > 0).map(b => ({ label: b.l, value: b.amt, sub: `${fN(b.n)} customers` })), format: v => inrCr(v, 1) } },
    ],
  };
}

export const targets: TvDeptDef = { id: "targets", name: "Targets & Advance", tagline: "AOP target vs actual, EOI and advance money", pages: "Target vs Actual · EOI / Advance", icon: "Target", tone: "green", load };
