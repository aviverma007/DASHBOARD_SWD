/** Profit vs Loss — joins SAP collections (PDRN export) with project cost
 * (ZALR project export) and non-project cost (FY 26-27), project by project.
 * Built at load time from the same files the Cost and SAP Collection tabs use,
 * so it refreshes whenever they do. Definitions:
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
  return [{ key: "corp", w: 1 }];
}

/* ---------------- model ---------------- */
export interface Booking {
  proj: ProjKey; unit: string; customer: string; tower: string; ym: string; day: number;
  area: number; tsv: number; tcv: number; demandEx: number; demandIn: number;
  recIn: number; recEx: number; due: number; future: number;
}
export interface CostLine {   // one WBS (or its share) on the cost side
  wbs: string; desc: string; head: string; segment: string; plant: string; share: number;
  budget: number; actual: number; commit: number; avail: number; po: number; nonpo: number;
}
export interface PoLine { wbs: string; vendor: string; po: string; day: number; ordered: number; delivered: number; share: number; head: string }
export interface NpLine { wbs: string; desc: string; dept: string; plant: string; share: number; budget: number; actual: number }

export interface Bucket {
  key: string; name: string; linked: boolean;
  bookings: Booking[]; cost: CostLine[]; po: PoLine[]; np: NpLine[];
  inv: { units: number; area: number; unsoldUnits: number; unsoldArea: number; unsoldValue: number };
  /** month → sales booked (TSV) and spend (delivered PO value + non-project actuals) */
  monthly: Map<string, { sales: number; spend: number }>;
}

const blank = (key: string, name: string, linked: boolean): Bucket => ({
  key, name, linked, bookings: [], cost: [], po: [], np: [],
  inv: { units: 0, area: 0, unsoldUnits: 0, unsoldArea: 0, unsoldValue: 0 }, monthly: new Map(),
});
const BUCKETS = new Map<string, Bucket>(PROJECTS.map(p => [p.key, blank(p.key, p.name, true)]));
const bucket = (key: string) => {
  if (!BUCKETS.has(key)) BUCKETS.set(key, blank(key, key === "corp" ? "Corporate & head office (non-project)" : key.replace(/^unl:/, ""), false));
  return BUCKETS.get(key)!;
};
const addMonth = (b: Bucket, ym: string, f: "sales" | "spend", v: number) => {
  const e = b.monthly.get(ym) ?? { sales: 0, spend: 0 };
  e[f] += v; b.monthly.set(ym, e);
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
    const b: Booking = {
      proj: key, unit: String(r[9]), customer: String(r[10] ?? ""), tower: CP.TW[r[1] as number] ?? "—",
      ym: y > 0 ? `${y}-${String(m).padStart(2, "0")}` : "", day: n(r[18]),
      area: n(r[5]), tsv: n(r[6]), tcv: n(r[26]), demandEx: dEx, demandIn: dIn,
      recIn, recEx: recIn * gstFactor, due: dIn - recIn, future: n(r[26]) - dIn,
    };
    const bk = bucket(key);
    bk.bookings.push(b);
    if (b.ym) addMonth(bk, b.ym, "sales", b.tsv);
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
/* the inventory export prices booked units only, so unsold stock is valued at
 * the project's average booked rate per sq ft (an estimate, labelled as such) */
BUCKETS.forEach(b => {
  const area = b.bookings.reduce((s, x) => s + x.area, 0), tsv = b.bookings.reduce((s, x) => s + x.tsv, 0);
  b.inv.unsoldValue = area > 0 ? b.inv.unsoldArea * (tsv / area) : 0;
});

/* project cost */
{
  const meta = new Map<number, { code: string; plant: string; head: string; seg: string; desc: string }>();
  PJ.B.forEach(b => {
    const code = PJ.WBS[b[0]], plant = PJ.PLANT[b[17]] ?? "—", root = PJ.ROOT[b[13]] ?? "—", seg = PJ.BH[b[16]] ?? "—";
    const m = { code, plant, head: PJ.PGRP[b[14]] ?? "—", seg: seg.split(" · ").pop() ?? seg, desc: PJ.WDESC[b[18]] ?? "" };
    meta.set(b[0], m);
    mapProjectWbs(code, plant, root, seg).forEach(t => {
      bucket(t.key).cost.push({
        wbs: code, desc: m.desc, head: m.head, segment: m.seg, plant, share: t.w,
        budget: b[1] * t.w, actual: b[5] * t.w, commit: b[9] * t.w, avail: b[11] * t.w, po: b[7] * t.w, nonpo: b[8] * t.w,
      });
    });
  });
  PJ.L.forEach(l => {
    const m = meta.get(l[0] as number);
    if (!m) return;
    mapProjectWbs(m.code, m.plant, PJ.ROOT[l[8] as number] ?? "—", "").forEach(t => {
      const delivered = (l[14] as number) * t.w;
      const bk = bucket(t.key);
      bk.po.push({ wbs: m.code, vendor: PJ.VEND[l[2] as number] ?? "—", po: String(l[10]), day: l[9] as number,
        ordered: (l[12] as number) * t.w, delivered, share: t.w, head: m.head });
      if ((l[9] as number) >= 0 && delivered) addMonth(bk, ymOfDay(l[9] as number), "spend", delivered);
    });
  });
}

/* non-project cost (FY 26-27), with GST like the project export */
{
  const plantOf = new Map<number, string>();
  NP.B.forEach(b => {
    const plant = NP.PLANT[b[17]] ?? "—";
    plantOf.set(b[0], plant);
    mapNonProjectPlant(plant).forEach(t => bucket(t.key).np.push({
      wbs: NP.WBS[b[0]], desc: NP.WDESC[b[18]] ?? "", dept: NP.PGRP[b[14]] ?? "—", plant, share: t.w,
      budget: b[1] * t.w, actual: b[5] * t.w,
    }));
  });
  NP.A.forEach(a => {
    const plant = plantOf.get(a[0]);
    if (!plant || a[1] < 0) return;
    mapNonProjectPlant(plant).forEach(t => addMonth(bucket(t.key), ymOfDay(a[1]), "spend", a[3] * t.w));
  });
}

export const LINKED: Bucket[] = PROJECTS.map(p => BUCKETS.get(p.key)!);
export const UNLINKED: Bucket[] = [...BUCKETS.values()].filter(b => !b.linked)
  .sort((a, b) => (a.key === "corp" ? 1 : 0) - (b.key === "corp" ? 1 : 0) || sumOf(b.cost, "actual") - sumOf(a.cost, "actual"));

/* ---------------- measures ---------------- */
export function sumOf<T>(rows: T[], f: keyof T): number { return rows.reduce((s, r) => s + (r[f] as unknown as number), 0); }

export interface Measures {
  units: number; area: number; tsv: number; tcv: number; demandEx: number; demandIn: number;
  recIn: number; recEx: number; due: number; future: number;
  budget: number; projActual: number; npActual: number; actual: number; commit: number; avail: number; po: number; nonpo: number;
  invUnits: number; invArea: number; unsoldUnits: number; unsoldArea: number; unsoldValue: number;
}
export function measure(bs: Bucket[]): Measures {
  const B = bs.flatMap(b => b.bookings), C = bs.flatMap(b => b.cost), N = bs.flatMap(b => b.np);
  const projActual = sumOf(C, "actual"), npActual = sumOf(N, "actual");
  return {
    units: B.length, area: sumOf(B, "area"), tsv: sumOf(B, "tsv"), tcv: sumOf(B, "tcv"),
    demandEx: sumOf(B, "demandEx"), demandIn: sumOf(B, "demandIn"), recIn: sumOf(B, "recIn"), recEx: sumOf(B, "recEx"),
    due: sumOf(B, "due"), future: sumOf(B, "future"),
    budget: sumOf(C, "budget"), projActual, npActual, actual: projActual + npActual,
    commit: sumOf(C, "commit"), avail: sumOf(C, "avail"), po: sumOf(C, "po"), nonpo: sumOf(C, "nonpo"),
    invUnits: bs.reduce((s, b) => s + b.inv.units, 0), invArea: bs.reduce((s, b) => s + b.inv.area, 0),
    unsoldUnits: bs.reduce((s, b) => s + b.inv.unsoldUnits, 0), unsoldArea: bs.reduce((s, b) => s + b.inv.unsoldArea, 0),
    unsoldValue: bs.reduce((s, b) => s + b.inv.unsoldValue, 0),
  };
}

/** Derived P&L figures for a scope; gst=true uses collection with GST. */
export function pnl(m: Measures, gst: boolean) {
  const collection = gst ? m.recIn : m.recEx;
  const surplus = collection - m.actual;
  const soldShare = m.invArea > 0 ? Math.min(m.area / m.invArea, 1) : 0;
  const costOfSold = m.budget * soldShare;
  const margin = m.tsv - costOfSold;
  const costToComplete = Math.max(m.budget - m.projActual, 0);
  const receivables = m.due + m.future;
  return {
    collection, surplus, soldShare, costOfSold, margin,
    marginPct: m.tsv > 0 ? (margin / m.tsv) * 100 : 0,
    costToComplete, receivables,
    fundingCover: costToComplete > 0 ? receivables / costToComplete : Infinity,
    collectionEff: m.demandIn > 0 ? (m.recIn / m.demandIn) * 100 : 0,
    spendPct: m.budget > 0 ? (m.projActual / m.budget) * 100 : 0,
    billedPct: m.tcv > 0 ? (m.demandIn / m.tcv) * 100 : 0,
    soldPct: m.invUnits > 0 ? (m.units / m.invUnits) * 100 : 0,
    ratePerSqft: m.area > 0 ? m.tsv / m.area : 0,
    costPerSqft: m.invArea > 0 ? m.budget / m.invArea : 0,
  };
}

/** Monthly series for a scope, sorted. */
export function monthly(bs: Bucket[]) {
  const m = new Map<string, { sales: number; spend: number }>();
  bs.forEach(b => b.monthly.forEach((v, k) => {
    const e = m.get(k) ?? { sales: 0, spend: 0 };
    e.sales += v.sales; e.spend += v.spend; m.set(k, e);
  }));
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/** Reconciliation check: every rupee of the two cost exports lands in exactly one bucket. */
export const TIE_OUT = (() => {
  const all = [...BUCKETS.values()];
  return {
    projActualFile: PJ.B.reduce((s, b) => s + b[5], 0), projActualMapped: all.reduce((s, b) => s + sumOf(b.cost, "actual"), 0),
    npActualFile: NP.B.reduce((s, b) => s + b[5], 0), npActualMapped: all.reduce((s, b) => s + sumOf(b.np, "actual"), 0),
    bookings: LINKED.reduce((s, b) => s + b.bookings.length, 0),
  };
})();
