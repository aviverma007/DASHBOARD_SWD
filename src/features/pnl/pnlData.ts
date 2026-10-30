/** Profit vs Loss — joins SAP collections (PDRN export) with project cost
 * (ZALR project export) and non-project cost (FY 26-27), project by project.
 * Built at load time from the same files the Cost and SAP Collection tabs use,
 * so it refreshes whenever they do. view() applies project, GST basis and period
 * to every figure. Definitions:
 *   Collection (with GST)  = Net Received Including Tax − Pending for Clearance  (= SAP Collection tab)
 *   Collection (W/O GST)   = with-GST collection × demand excl GST ÷ demand with GST, per booking
 *   Revenue recognised     = Total Demand Amount (excl GST) — milestone billing
 *   Expenditure            = project actual (ZALR Total Actual) + non-project actual for the project's plant
 *   Surplus / deficit      = Collection − Expenditure            (cash view)
 *   Est. margin on sales   = Sales value − budgeted cost × sold area ÷ saleable area
 * Cost of WBS with no bookings in the export (One DXP PH1, Residencies, Retail 69 …)
 * is listed as "not linked", so every rupee of cost is accounted for. */
import cpRaw from "../../data/cpAnalytics.json";
import pjRaw from "../../data/costProject.json";
import npRaw from "../../data/costNonProject.json";
import invRaw from "../../data/smartworldInventory.json";

/* ---------------- sales projects ---------------- */
export const PROJECTS = [
  { key: "edition", name: "The Edition", sales: "SMARTWORLD THE EDITION", city: "Gurugram" },
  { key: "skyarc", name: "Sky Arc", sales: "SMARTWORLD SKY ARC", city: "Gurugram" },
  { key: "trump", name: "Trump Residences", sales: "TRUMP RESIDENCES GURGAON", city: "Gurugram" },
  { key: "naturescourt", name: "Nature's Court L", sales: "SMARTWORLD NATURE’S COURT L", city: "Gurugram" },
  { key: "onedxp2", name: "One DXP Phase-2", sales: "SMARTWORLD ONE DXP PHASE-2", city: "Gurugram" },
  { key: "street", name: "One DXP Street", sales: "SMARTWORLD ONE DXP STREET", city: "Gurugram" },
  { key: "lecourtyard", name: "Le Courtyard", sales: "SMARTWORLD LE COURTYARD", city: "Noida" },
  { key: "suites", name: "Suites", sales: "SMARTWORLD SUITES", city: "Noida" },
] as const;
export type ProjKey = (typeof PROJECTS)[number]["key"];
const BY_SALES = new Map<string, ProjKey>(PROJECTS.map(p => [p.sales, p.key]));
/** One DXP Phase-2 in sales = towers O and P of cost phase PH4. */
const PH2_TOWERS = new Set(["TO", "TP"]);

/* ---------------- raw files ---------------- */
interface CostFile {
  WBS: string[]; WDESC: string[]; VEND: string[]; PGRP: string[]; PLANT: string[]; ROOT: string[]; BH: string[]; DTYP: string[];
  L: (number | string)[][]; B: number[][]; A: number[][]; meta: { asOn: string };
}
const CP = cpRaw as unknown as { P: string[]; TW: string[]; R: (number | string | null)[][]; meta: { source?: string } };
const PJ = pjRaw as unknown as CostFile;
const NP = npRaw as unknown as CostFile;
const INV = invRaw as unknown as { P: string[]; TW: string[]; U: (number | string)[][]; HY?: { source_file?: string } };

export const AS_ON = { cost: PJ.meta.asOn, nonProject: NP.meta.asOn, sales: (CP.meta.source ?? "").replace(/\.xlsx$/i, "") };
export const EPOCH = Date.UTC(2022, 0, 1);
export const ymOfDay = (d: number) => { const t = new Date(EPOCH + d * 86400000); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`; };

/* ---------------- cost → project mapping ---------------- */
type Target = { key: ProjKey | string; w: number };   // string key = "not linked" group label
const UNL = (label: string): Target[] => [{ key: `unl:${label}`, w: 1 }];

/** Share of PH4 common work (site, roads, licences …) carried by towers O and P,
 *  in proportion to their tower budgets. */
const PH4_SHARE = (() => {
  let op = 0, all = 0;
  PJ.B.forEach(b => {
    const m = /^RE\/0113-PH4-(T[A-Z])\b/.exec(PJ.WBS[b[0]]);
    if (!m) return;
    all += b[1];
    if (PH2_TOWERS.has(m[1])) op += b[1];
  });
  return all > 0 ? op / all : 0;
})();
export const PH4_SHARE_PCT = PH4_SHARE * 100;

function oneDxpPhase(code: string, plant: string): number | null {
  const m = /^RE\/0113-PH(\d)/.exec(code);
  if (m) return Number(m[1]);
  const p = plant.toUpperCase();
  if (p.includes("STREET")) return 2;
  if (p.includes("PHASE-2")) return 4;
  if (p.includes("PHASE5")) return 5;
  if (p.includes("PHASE 3")) return 3;
  if (p === "SMARTWORLD ONE DXP") return 1;
  return null;
}

/** Project WBS → sales project(s). Rules, most specific first. */
export function mapProjectWbs(code: string, plant: string, root: string, segment: string): Target[] {
  const P = plant.toUpperCase();
  if (code.startsWith("RE/0066")) return [{ key: "edition", w: 1 }];
  if (code.startsWith("RE/0069")) {
    if (code.startsWith("RE/0069-TRU") || P.includes("TRUMP")) return [{ key: "trump", w: 1 }];
    if (code.startsWith("RE/0069-RET") || P.includes("RETAIL")) return UNL("Riverday Retail, Sector 69");
    if (P.includes("IFC")) return UNL("Corporate office fit-out (IFC)");
    if (P.includes("SKY ARC")) return [{ key: "skyarc", w: 1 }];
  }
  if (code.startsWith("RE/M011")) return P.includes("NATURE") ? [{ key: "naturescourt", w: 1 }] : UNL("Manesar M11 commercial");
  if (code.startsWith("RE/0098")) {
    if (code.startsWith("RE/0098-SER")) return [{ key: "suites", w: 1 }];
    if (code.startsWith("RE/0098-COM")) return [{ key: "lecourtyard", w: 1 }];
    return P.includes("COURTYARD") ? [{ key: "lecourtyard", w: 1 }] : UNL("Smartworld Residencies");
  }
  if (code.startsWith("RE/0113") || code.startsWith("RE/0111")) {
    const ph = oneDxpPhase(code, plant);
    if (ph === 2) return [{ key: "street", w: 1 }];
    if (ph === 4) {
      const t = /^RE\/0113-PH4-(T[A-Z])\b/.exec(code)?.[1];
      if (t) return PH2_TOWERS.has(t) ? [{ key: "onedxp2", w: 1 }] : UNL("One DXP PH4 · towers I–N");
      return [{ key: "onedxp2", w: PH4_SHARE }, { key: "unl:One DXP PH4 · towers I–N", w: 1 - PH4_SHARE }];
    }
    if (ph === 1) return UNL("One DXP Phase 1");
    if (ph === 5) return UNL("One DXP Phase 5");
    if (ph === 3) return UNL("One DXP Commercial PH3");
    return UNL("One DXP · other");
  }
  if (code.startsWith("RE/0067")) return UNL("Casapark (RE/0067)");
  return UNL(`${root.split(" · ")[0]} · ${segment.split(" · ").pop()}`);
}

/** Non-project cost → project by its plant; everything else is corporate overhead. */
function mapNonProjectPlant(plant: string): Target[] {
  const P = plant.toUpperCase();
  if (P === "SMARTWORLD THE EDITION") return [{ key: "edition", w: 1 }];
  if (P === "SMARTWORLD SKY ARC") return [{ key: "skyarc", w: 1 }];
  if (P.startsWith("TRUMP RESIDENCES")) return [{ key: "trump", w: 1 }];
  if (P.startsWith("SMARTWORLD NATURE")) return [{ key: "naturescourt", w: 1 }];
  if (P === "SMARTWORLD ONE DXP STREET") return [{ key: "street", w: 1 }];
  if (P === "SMARTWORLD ONE DXP PHASE-2") return [{ key: "onedxp2", w: PH4_SHARE }, { key: "unl:One DXP PH4 · towers I–N", w: 1 - PH4_SHARE }];
  if (P === "SMARTWORLD LE COURTYARD") return [{ key: "lecourtyard", w: 1 }];
  if (P === "SMARTWORLD SUITES") return [{ key: "suites", w: 1 }];
  if (P === "SMARTWORLD ONE DXP") return UNL("One DXP Phase 1");
  if (P === "SMARTWORLD RESIDENCIES") return UNL("Smartworld Residencies");
  if (P.includes("RETAIL") && P.includes("69")) return UNL("Riverday Retail, Sector 69");
  return [{ key: "corp", w: 1 }];
}

/* ---------------- model ----------------
 * Every money field is stored twice — In (with GST) and Ex (without GST) — and
 * cost lines carry a month phasing, so one view() can apply GST basis and
 * period to every card at once. */
export interface Booking {
  proj: ProjKey; unit: string; customer: string; tower: string; ym: string; day: number; area: number;
  tsvIn: number; tsvEx: number; tcvIn: number; tcvEx: number; demandIn: number; demandEx: number;
  recIn: number; recEx: number;
}
export interface CostLine {   // one WBS (or its share) on the project-cost side, with GST as exported
  wbs: string; desc: string; head: string; segment: string; plant: string; share: number;
  budget: number; actual: number; commit: number; avail: number; po: number; nonpo: number;
  /** basic ÷ with-GST, from the WBS's own PO lines (1 when it has none: non-PO postings) */
  exRatio: number;
  /** month → share of this WBS's actual, phased by PO delivery dates (empty = can't be dated) */
  phase: Map<string, number>;
  /** month → share of open commitment, by PO date of the open lines */
  cphase: Map<string, number>;
}
export interface PoLine { wbs: string; vendor: string; po: string; day: number; ym: string; orderedIn: number; orderedEx: number; deliveredIn: number; deliveredEx: number; share: number; head: string }
export interface NpLine { wbs: string; desc: string; dept: string; plant: string; share: number; budgetIn: number; budgetEx: number; actualIn: number; actualEx: number; months: Map<string, { in: number; ex: number }> }

export interface Bucket {
  key: string; name: string; linked: boolean;
  bookings: Booking[]; cost: CostLine[]; po: PoLine[]; np: NpLine[];
  inv: { units: number; area: number; unsoldUnits: number; unsoldArea: number; unsoldValueIn: number; unsoldValueEx: number };
}

const blank = (key: string, name: string, linked: boolean): Bucket => ({
  key, name, linked, bookings: [], cost: [], po: [], np: [],
  inv: { units: 0, area: 0, unsoldUnits: 0, unsoldArea: 0, unsoldValueIn: 0, unsoldValueEx: 0 },
});
const BUCKETS = new Map<string, Bucket>(PROJECTS.map(p => [p.key, blank(p.key, p.name, true)]));
const bucket = (key: string) => {
  if (!BUCKETS.has(key)) BUCKETS.set(key, blank(key, key === "corp" ? "Corporate & head office (non-project)" : key.replace(/^unl:/, ""), false));
  return BUCKETS.get(key)!;
};

/* sales — active bookings, one row per unit (an undated duplicate of a dated booking is dropped) */
{
  const n = (v: unknown) => (typeof v === "number" ? v : 0);
  const active = CP.R.filter(r => r[13] === 0);
  const dated = new Set(active.filter(r => n(r[7]) > 0).map(r => `${r[0]}|${r[9]}`));
  active.filter(r => n(r[7]) > 0 || !dated.has(`${r[0]}|${r[9]}`)).forEach(r => {
    const key = BY_SALES.get(String(CP.P[r[0] as number]).toUpperCase());
    if (!key) return;
    const recIn = n(r[24]) - n(r[25]);
    const dEx = n(r[21]), dIn = n(r[22]);
    const gstFactor = dIn > 0 ? dEx / dIn : n(r[26]) > 0 ? n(r[20]) / n(r[26]) : 1;
    const y = n(r[7]), m = n(r[8]);
    bucket(key).bookings.push({
      proj: key, unit: String(r[9]), customer: String(r[10] ?? ""), tower: CP.TW[r[1] as number] ?? "—",
      ym: y > 0 ? `${y}-${String(m).padStart(2, "0")}` : "", day: n(r[18]), area: n(r[5]),
      tsvEx: n(r[6]), tsvIn: n(r[26]) || n(r[6]), tcvIn: n(r[26]), tcvEx: n(r[20]),
      demandIn: dIn, demandEx: dEx, recIn, recEx: recIn * gstFactor,
    });
  });
}

/* inventory — saleable stock per project (INVR) */
INV.P.forEach((name, pi) => {
  const key = BY_SALES.get(name.toUpperCase());
  if (!key) return;
  const inv = bucket(key).inv;
  INV.U.forEach(u => {
    if (u[0] !== pi) return;
    inv.units++; inv.area += u[6] as number;
    if (u[8] !== 1) { inv.unsoldUnits++; inv.unsoldArea += u[6] as number; }
  });
});

/* project cost */
{
  // per WBS: GST ratio and month phasing from its PO lines
  const perWbs = new Map<number, { delIn: number; delEx: number; ordIn: number; ordEx: number; del: Map<string, number>; open: Map<string, number> }>();
  PJ.L.forEach(l => {
    const w = l[0] as number, day = l[9] as number;
    const e = perWbs.get(w) ?? { delIn: 0, delEx: 0, ordIn: 0, ordEx: 0, del: new Map(), open: new Map() };
    e.delIn += l[14] as number; e.delEx += l[13] as number; e.ordIn += l[12] as number; e.ordEx += l[11] as number;
    if (day >= 0) {
      const ym = ymOfDay(day);
      e.del.set(ym, (e.del.get(ym) ?? 0) + (l[14] as number));
      const open = (l[12] as number) - (l[14] as number);
      if (open > 0) e.open.set(ym, (e.open.get(ym) ?? 0) + open);
    }
    perWbs.set(w, e);
  });
  const norm = (m: Map<string, number>) => {
    const t = [...m.values()].reduce((s, v) => s + v, 0);
    return t > 0 ? new Map([...m].map(([k, v]) => [k, v / t])) : new Map<string, number>();
  };
  const meta = new Map<number, { code: string; plant: string; head: string }>();
  PJ.B.forEach(b => {
    const code = PJ.WBS[b[0]], plant = PJ.PLANT[b[17]] ?? "—", root = PJ.ROOT[b[13]] ?? "—", seg = PJ.BH[b[16]] ?? "—";
    const head = PJ.PGRP[b[14]] ?? "—";
    meta.set(b[0], { code, plant, head });
    const pw = perWbs.get(b[0]);
    const exRatio = pw && pw.delIn > 0 ? pw.delEx / pw.delIn : pw && pw.ordIn > 0 ? pw.ordEx / pw.ordIn : 1;
    const phase = pw ? norm(pw.del) : new Map<string, number>(), cphase = pw ? norm(pw.open) : new Map<string, number>();
    mapProjectWbs(code, plant, root, seg).forEach(t => bucket(t.key).cost.push({
      wbs: code, desc: PJ.WDESC[b[18]] ?? "", head, segment: seg.split(" · ").pop() ?? seg, plant, share: t.w,
      budget: b[1] * t.w, actual: b[5] * t.w, commit: b[9] * t.w, avail: b[11] * t.w, po: b[7] * t.w, nonpo: b[8] * t.w,
      exRatio, phase, cphase,
    }));
  });
  PJ.L.forEach(l => {
    const m = meta.get(l[0] as number);
    if (!m) return;
    const day = l[9] as number;
    mapProjectWbs(m.code, m.plant, PJ.ROOT[l[8] as number] ?? "—", "").forEach(t => bucket(t.key).po.push({
      wbs: m.code, vendor: PJ.VEND[l[2] as number] ?? "—", po: String(l[10]), day, ym: day >= 0 ? ymOfDay(day) : "",
      orderedIn: (l[12] as number) * t.w, orderedEx: (l[11] as number) * t.w,
      deliveredIn: (l[14] as number) * t.w, deliveredEx: (l[13] as number) * t.w, share: t.w, head: m.head,
    }));
  });
}

/* non-project cost (FY 26-27): budget/actual per WBS + actual postings by month */
{
  const months = new Map<number, Map<string, { in: number; ex: number }>>();
  NP.A.forEach(a => {
    if (a[1] < 0) return;
    const mm = months.get(a[0]) ?? new Map<string, { in: number; ex: number }>();
    const ym = ymOfDay(a[1]), e = mm.get(ym) ?? { in: 0, ex: 0 };
    e.in += a[3]; e.ex += a[4]; mm.set(ym, e); months.set(a[0], mm);
  });
  NP.B.forEach(b => {
    const plant = NP.PLANT[b[17]] ?? "—";
    const src = months.get(b[0]) ?? new Map();
    mapNonProjectPlant(plant).forEach(t => bucket(t.key).np.push({
      wbs: NP.WBS[b[0]], desc: NP.WDESC[b[18]] ?? "", dept: NP.PGRP[b[14]] ?? "—", plant, share: t.w,
      budgetIn: b[1] * t.w, budgetEx: b[2] * t.w, actualIn: b[5] * t.w, actualEx: b[6] * t.w,
      months: new Map([...src].map(([k, v]) => [k, { in: v.in * t.w, ex: v.ex * t.w }])),
    }));
  });
}

/* unsold stock valued at the project's average booked rate (INVR prices booked units only) */
BUCKETS.forEach(b => {
  const area = b.bookings.reduce((s, x) => s + x.area, 0);
  const ex = b.bookings.reduce((s, x) => s + x.tsvEx, 0), inc = b.bookings.reduce((s, x) => s + x.tsvIn, 0);
  b.inv.unsoldValueEx = area > 0 ? b.inv.unsoldArea * (ex / area) : 0;
  b.inv.unsoldValueIn = area > 0 ? b.inv.unsoldArea * (inc / area) : 0;
});

export const LINKED: Bucket[] = PROJECTS.map(p => BUCKETS.get(p.key)!);
export const UNLINKED: Bucket[] = [...BUCKETS.values()].filter(b => !b.linked)
  .sort((a, b) => (a.key === "corp" ? 1 : 0) - (b.key === "corp" ? 1 : 0) || sumOf(b.cost, "actual") - sumOf(a.cost, "actual"));
/** every month that has a booking, a dated cost or a non-project posting */
export const ALL_MONTHS = (() => {
  const s = new Set<string>();
  BUCKETS.forEach(b => {
    b.bookings.forEach(x => x.ym && s.add(x.ym));
    b.cost.forEach(c => c.phase.forEach((_, k) => s.add(k)));
    b.np.forEach(n => n.months.forEach((_, k) => s.add(k)));
  });
  return [...s].sort();
})();

export function sumOf<T>(rows: T[], f: keyof T): number { return rows.reduce((s, r) => s + (r[f] as unknown as number), 0); }

/* ---------------- one view for every card ---------------- */
/** Period = inclusive months "YYYY-MM"; null = all time. */
export interface Period { from: string; to: string }
export interface ViewOpts { gst: boolean; period: Period | null }

export interface VBooking extends Booking { tsv: number; tcv: number; demand: number; rec: number; due: number; future: number }
export interface VCost extends CostLine { budgetV: number; actualV: number; commitV: number; availV: number }
export interface VPo extends PoLine { ordered: number; delivered: number }
export interface VNp extends NpLine { actualV: number; budgetV: number }

export interface View {
  bookings: VBooking[]; cost: VCost[]; po: VPo[]; np: VNp[];
  m: Measures;
  /** project actual that has no PO delivery dates, so it can't be placed in a period */
  undatedActual: number;
  monthly: [string, { sales: number; spend: number }][];
}
export interface Measures {
  units: number; area: number; tsv: number; tcv: number; demand: number; demandEx: number;
  rec: number; due: number; future: number;
  budget: number; projActual: number; npActual: number; actual: number; commit: number; avail: number;
  invUnits: number; invArea: number; unsoldUnits: number; unsoldArea: number; unsoldValue: number;
}

const inP = (p: Period | null, ym: string) => !p || (!!ym && ym >= p.from && ym <= p.to);
const phaseIn = (ph: Map<string, number>, p: Period) => { let f = 0; ph.forEach((v, k) => { if (k >= p.from && k <= p.to) f += v; }); return f; };

export function view(bs: Bucket[], o: ViewOpts): View {
  const g = o.gst, p = o.period;
  const bookings: VBooking[] = bs.flatMap(b => b.bookings).filter(b => inP(p, b.ym)).map(b => {
    const tcv = g ? b.tcvIn : b.tcvEx, demand = g ? b.demandIn : b.demandEx, rec = g ? b.recIn : b.recEx;
    return { ...b, tsv: g ? b.tsvIn : b.tsvEx, tcv, demand, rec, due: demand - rec, future: tcv - demand };
  });
  let undatedActual = 0;
  const cost: VCost[] = bs.flatMap(b => b.cost).map(c => {
    const r = g ? 1 : c.exRatio;
    const fa = p ? phaseIn(c.phase, p) : 1, fc = p ? phaseIn(c.cphase, p) : 1;
    if (p && c.phase.size === 0) undatedActual += c.actual * r;
    return { ...c, budgetV: c.budget * r, actualV: c.actual * r * fa, commitV: c.commit * r * fc, availV: c.avail * r };
  });
  const po: VPo[] = bs.flatMap(b => b.po).filter(l => inP(p, l.ym))
    .map(l => ({ ...l, ordered: g ? l.orderedIn : l.orderedEx, delivered: g ? l.deliveredIn : l.deliveredEx }));
  const np: VNp[] = bs.flatMap(b => b.np).map(n => {
    let a = g ? n.actualIn : n.actualEx;
    if (p) { a = 0; n.months.forEach((v, k) => { if (k >= p.from && k <= p.to) a += g ? v.in : v.ex; }); }
    return { ...n, actualV: a, budgetV: g ? n.budgetIn : n.budgetEx };
  });
  // monthly series under the same GST basis
  const mm = new Map<string, { sales: number; spend: number }>();
  const at = (k: string) => { const e = mm.get(k) ?? { sales: 0, spend: 0 }; mm.set(k, e); return e; };
  bookings.forEach(b => { if (b.ym) at(b.ym).sales += b.tsv; });
  cost.forEach(c => c.phase.forEach((f, k) => { if (inP(p, k)) at(k).spend += c.actual * (g ? 1 : c.exRatio) * f; }));
  np.forEach(n => n.months.forEach((v, k) => { if (inP(p, k)) at(k).spend += g ? v.in : v.ex; }));

  const projActual = sumOf(cost, "actualV"), npActual = sumOf(np, "actualV");
  const m: Measures = {
    units: bookings.length, area: sumOf(bookings, "area"), tsv: sumOf(bookings, "tsv"), tcv: sumOf(bookings, "tcv"),
    demand: sumOf(bookings, "demand"), demandEx: sumOf(bookings, "demandEx"), rec: sumOf(bookings, "rec"),
    due: sumOf(bookings, "due"), future: sumOf(bookings, "future"),
    budget: sumOf(cost, "budgetV"), projActual, npActual, actual: projActual + npActual,
    commit: sumOf(cost, "commitV"), avail: sumOf(cost, "availV"),
    invUnits: bs.reduce((s, b) => s + b.inv.units, 0), invArea: bs.reduce((s, b) => s + b.inv.area, 0),
    unsoldUnits: bs.reduce((s, b) => s + b.inv.unsoldUnits, 0), unsoldArea: bs.reduce((s, b) => s + b.inv.unsoldArea, 0),
    unsoldValue: bs.reduce((s, b) => s + (g ? b.inv.unsoldValueIn : b.inv.unsoldValueEx), 0),
  };
  return { bookings, cost, po, np, m, undatedActual, monthly: [...mm.entries()].sort((a, b) => a[0].localeCompare(b[0])) };
}

/** Derived P&L figures. `asAt` = all-time figures for the same scope and GST basis:
 *  cost to complete, funding cover and spend progress are positions today, not flows. */
export function pnl(m: Measures, asAt: Measures) {
  const surplus = m.rec - m.actual;
  const soldShare = m.invArea > 0 ? Math.min(m.area / m.invArea, 1) : 0;
  const costOfSold = m.budget * soldShare;
  const margin = m.tsv - costOfSold;
  const costToComplete = Math.max(asAt.budget - asAt.projActual, 0);
  const receivables = asAt.due + asAt.future;
  return {
    collection: m.rec, surplus, soldShare, costOfSold, margin,
    marginPct: m.tsv > 0 ? (margin / m.tsv) * 100 : 0,
    costToComplete, receivables,
    fundingCover: costToComplete > 0 ? receivables / costToComplete : Infinity,
    collectionEff: m.demand > 0 ? (m.rec / m.demand) * 100 : 0,
    spendPct: asAt.budget > 0 ? (asAt.projActual / asAt.budget) * 100 : 0,
    billedPct: m.tcv > 0 ? (m.demand / m.tcv) * 100 : 0,
    soldPct: m.invUnits > 0 ? (m.units / m.invUnits) * 100 : 0,
    ratePerSqft: m.area > 0 ? m.tsv / m.area : 0,
    costPerSqft: m.invArea > 0 ? m.budget / m.invArea : 0,
  };
}

/** Reconciliation check: every rupee of the two cost exports lands in exactly one bucket. */
export const TIE_OUT = (() => {
  const all = [...BUCKETS.values()];
  return {
    projActualFile: PJ.B.reduce((s, b) => s + b[5], 0), projActualMapped: all.reduce((s, b) => s + sumOf(b.cost, "actual"), 0),
    npActualFile: NP.B.reduce((s, b) => s + b[5], 0), npActualMapped: all.reduce((s, b) => s + sumOf(b.np, "actualIn"), 0),
    bookings: LINKED.reduce((s, b) => s + b.bookings.length, 0),
  };
})();
