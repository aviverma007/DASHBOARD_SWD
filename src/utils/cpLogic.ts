import raw from "../data/cpAnalytics.json";

interface CpRaw { P: string[]; TW: string[]; FL: string[]; CFG: string[]; CP: string[]; R: number[][]; }
const CD = raw as unknown as CpRaw;

export interface CpRecord {
  projIdx: number; towerIdx: number; floorNum: number; floorLabelIdx: number;
  cfgIdx: number; area: number; tsv: number; year: number; month: number;
  unitNo: string; customerName: string; paymentPlan: string; cpIdx: number;
  status: 0 | 1; // 0 = active/booked, 1 = cancelled
  rebooked: 0 | 1; // only meaningful when status=1
}

function toRecord(r: number[]): CpRecord {
  return {
    projIdx: r[0], towerIdx: r[1], floorNum: r[2], floorLabelIdx: r[3], cfgIdx: r[4],
    area: r[5], tsv: r[6], year: r[7], month: r[8],
    unitNo: String(r[9]), customerName: String(r[10]), paymentPlan: String(r[11]),
    cpIdx: r[12], status: r[13] as 0 | 1, rebooked: r[14] as 0 | 1,
  };
}

export const CP = {
  P: CD.P, TW: CD.TW, FL: CD.FL, CFG: CD.CFG, CP: CD.CP,
  R: CD.R.map(toRecord),
};

export const ALL_RECORDS = CP.R;
export const ACTIVE_RECORDS = CP.R.filter(r => r.status === 0);
export const CANCELLED_RECORDS = CP.R.filter(r => r.status === 1);

// ── Fiscal-year helpers (Apr–Mar), matching the convention used on the
// Target vs Actual page, for the Period filter on this page ──────────────
export function fyEndYear(year: number, month: number): number {
  return month >= 4 ? year + 1 : year;
}
export function fyQuarter(month: number): number {
  return month >= 4 ? Math.floor((month - 4) / 3) : Math.floor((month + 8) / 3);
}

/** Every fiscal year actually present in the booking data, oldest first. */
export const CP_YEAR_OPTIONS: { label: string; fy: number }[] = (() => {
  const fys = new Set<number>();
  CP.R.forEach(r => { if (r.year > 0 && r.month > 0) fys.add(fyEndYear(r.year, r.month)); });
  return [...fys].sort((a, b) => a - b).map(fy => ({ label: `FY ${fy - 1}-${String(fy).slice(-2)}`, fy }));
})();

export interface PeriodScope {
  type: "all" | "year" | "quarter" | "month";
  fy?: number;      // fiscal end-year, e.g. 2026 for FY2025-26
  quarter?: number; // 0-3 (Q1..Q4)
  month?: number;   // 1-12 calendar month
  year?: number;    // calendar year, needed alongside month
}

/** Scope the full record set down to a project (optional) + period (optional). */
/** projects: null/empty set = all projects; otherwise records must
 * belong to one of the named projects. (A plain string still works
 * for any older single-select callers.) */
export function filterRecords(projects: string | Set<string> | null, period: PeriodScope): CpRecord[] {
  const projSet = typeof projects === "string" ? (projects ? new Set([projects]) : null)
    : projects && projects.size > 0 ? projects : null;
  return CP.R.filter(r => {
    if (projSet && !projSet.has(CP.P[r.projIdx])) return false;
    if (period.type === "all") return true;
    if (r.year === 0 || r.month === 0) return false; // no valid booking date
    if (period.type === "year") return period.fy !== undefined && fyEndYear(r.year, r.month) === period.fy;
    if (period.type === "quarter") return period.fy !== undefined && fyEndYear(r.year, r.month) === period.fy && period.quarter !== undefined && fyQuarter(r.month) === period.quarter;
    if (period.type === "month") return r.year === period.year && r.month === period.month;
    return true;
  });
}

export interface CpRateExtreme {
  rate: number;          // ₹/sqft for that one unit
  cpIdx: number;
  cpName: string;
  record: CpRecord;
}

/** Highest- and lowest-rate ACTIVE channel-partner sale in the scope
 * (rate = unit TSV ÷ unit super area). Cancelled bookings and Direct
 * (no-CP) sales are excluded — the ask is about channel partners. */
export function cpRateExtremes(records: CpRecord[]): { hi: CpRateExtreme | null; lo: CpRateExtreme | null; avg: number | null } {
  const eligible = records.filter(r =>
    r.status === 0 && r.area > 0 && r.tsv > 0 && CP.CP[r.cpIdx] !== "Direct"
  );
  if (eligible.length === 0) return { hi: null, lo: null, avg: null };
  let hi = eligible[0], lo = eligible[0];
  let tsvSum = 0, areaSum = 0;
  for (const r of eligible) {
    if (r.tsv / r.area > hi.tsv / hi.area) hi = r;
    if (r.tsv / r.area < lo.tsv / lo.area) lo = r;
    tsvSum += r.tsv; areaSum += r.area;
  }
  const wrap = (r: CpRecord): CpRateExtreme => ({ rate: Math.round(r.tsv / r.area), cpIdx: r.cpIdx, cpName: CP.CP[r.cpIdx], record: r });
  return { hi: wrap(hi), lo: wrap(lo), avg: areaSum > 0 ? Math.round(tsvSum / areaSum) : null };
}

export interface CpMinMaxRow {
  metric: string;
  fmt: (v: number) => string;
  max: { cpIdx: number; name: string; value: number };
  min: { cpIdx: number; name: string; value: number };
}

/** One consolidated min/max view across ALL channel partners in scope
 * (active sales, Direct excluded): for each metric, which CP is at the
 * top and which at the bottom. Avg rate only considers CPs with sold
 * area, so a zero-area partner can't fake a ₹0 minimum. */
export function cpMinMax(records: CpRecord[]): CpMinMaxRow[] {
  const cps = summariseByChannelPartner(records).filter(s => s.name !== "Direct" && s.units > 0);
  if (cps.length === 0) return [];
  const pick = (get: (s: CpSummary) => number, eligible = cps) => {
    let max = eligible[0], min = eligible[0];
    for (const s of eligible) {
      if (get(s) > get(max)) max = s;
      if (get(s) < get(min)) min = s;
    }
    return {
      max: { cpIdx: max.cpIdx, name: max.name, value: get(max) },
      min: { cpIdx: min.cpIdx, name: min.name, value: get(min) },
    };
  };
  const withArea = cps.filter(s => s.area > 0);
  return [
    { metric: "Units sold", fmt: v => Math.round(v).toLocaleString("en-IN"), ...pick(s => s.units) },
    { metric: "Area sold", fmt: v => fArea(v), ...pick(s => s.area) },
    { metric: "TSV", fmt: v => fCr(v), ...pick(s => s.tsv) },
    ...(withArea.length ? [{ metric: "Avg rate", fmt: (v: number) => fRate(v), ...pick(s => s.tsv / s.area, withArea) }] : []),
  ];
}

export interface CpRateRange {
  cpIdx: number;
  name: string;
  units: number;
  hiRate: number; hiProj: string; hiUnit: string;
  loRate: number; loProj: string; loUnit: string;
}

/** For EVERY channel partner in scope: their own highest- and lowest-
 * rate sold unit (₹/sqft) with the project it belongs to. Active sales
 * only; Direct excluded; records without area/value can't yield a rate
 * and are skipped. Sorted by highest rate, descending. */
export function cpRateRanges(records: CpRecord[]): CpRateRange[] {
  const byCp = new Map<number, CpRecord[]>();
  records.forEach(r => {
    if (r.status !== 0 || r.area <= 0 || r.tsv <= 0) return;
    if (CP.CP[r.cpIdx] === "Direct") return;
    const list = byCp.get(r.cpIdx) ?? [];
    list.push(r);
    byCp.set(r.cpIdx, list);
  });
  const rows: CpRateRange[] = [];
  byCp.forEach((recs, cpIdx) => {
    let hi = recs[0], lo = recs[0];
    for (const r of recs) {
      if (r.tsv / r.area > hi.tsv / hi.area) hi = r;
      if (r.tsv / r.area < lo.tsv / lo.area) lo = r;
    }
    rows.push({
      cpIdx,
      name: CP.CP[cpIdx],
      units: recs.length,
      hiRate: Math.round(hi.tsv / hi.area), hiProj: CP.P[hi.projIdx], hiUnit: hi.unitNo,
      loRate: Math.round(lo.tsv / lo.area), loProj: CP.P[lo.projIdx], loUnit: lo.unitNo,
    });
  });
  return rows.sort((a, b) => b.hiRate - a.hiRate);
}

export function fRate(n: number | null): string {
  if (n === null || !isFinite(n)) return "—";
  return "₹" + Math.round(n).toLocaleString("en-IN") + "/sqft";
}

export function fArea(sqft: number): string {
  if (sqft >= 100000) return (sqft / 100000).toFixed(2) + " L sq ft";
  return Math.round(sqft).toLocaleString("en-IN") + " sq ft";
}
export function fCr(n: number): string {
  const v = n / 1e7;
  return "₹" + (v >= 100 ? Math.round(v).toLocaleString("en-IN") : v.toFixed(1)) + " Cr";
}

export interface CpSummary {
  cpIdx: number;
  name: string;
  units: number;
  area: number;
  tsv: number;
  cancelled: number;
  rebooked: number;
}

/** Per-channel-partner totals across active bookings (+ cancellations) in the given record scope. */
export function summariseByChannelPartner(records: CpRecord[] = CP.R): CpSummary[] {
  const map = new Map<number, CpSummary>();
  function ensure(cpIdx: number): CpSummary {
    let s = map.get(cpIdx);
    if (!s) {
      s = { cpIdx, name: CP.CP[cpIdx], units: 0, area: 0, tsv: 0, cancelled: 0, rebooked: 0 };
      map.set(cpIdx, s);
    }
    return s;
  }
  records.filter(r => r.status === 0).forEach(r => {
    const s = ensure(r.cpIdx);
    s.units += 1; s.area += r.area; s.tsv += r.tsv;
  });
  records.filter(r => r.status === 1).forEach(r => {
    const s = ensure(r.cpIdx);
    s.cancelled += 1;
    if (r.rebooked) s.rebooked += 1;
  });
  return [...map.values()];
}

export function topByUnits(records: CpRecord[], n: number, excludeDirect = false): CpSummary[] {
  return summariseByChannelPartner(records)
    .filter(s => !excludeDirect || s.name !== "Direct")
    .sort((a, b) => b.units - a.units)
    .slice(0, n);
}
export function topByArea(records: CpRecord[], n: number, excludeDirect = false): CpSummary[] {
  return summariseByChannelPartner(records)
    .filter(s => !excludeDirect || s.name !== "Direct")
    .sort((a, b) => b.area - a.area)
    .slice(0, n);
}
export function topByTsv(records: CpRecord[], n: number, excludeDirect = false): CpSummary[] {
  return summariseByChannelPartner(records)
    .filter(s => !excludeDirect || s.name !== "Direct")
    .sort((a, b) => b.tsv - a.tsv)
    .slice(0, n);
}
export function topByCancelled(records: CpRecord[], n: number): CpSummary[] {
  return summariseByChannelPartner(records)
    .filter(s => s.cancelled > 0)
    .sort((a, b) => b.cancelled - a.cancelled)
    .slice(0, n);
}

/** Monthly aggregate (all channel partners combined, excluding Direct) within the given record scope. */
export function monthlyTrend(records: CpRecord[] = CP.R, excludeDirect = true): { key: string; label: string; units: number; area: number; tsv: number }[] {
  const map = new Map<string, { units: number; area: number; tsv: number; year: number; month: number }>();
  records.filter(r => r.status === 0).forEach(r => {
    if (excludeDirect && CP.CP[r.cpIdx] === "Direct") return;
    const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
    const e = map.get(key) ?? { units: 0, area: 0, tsv: 0, year: r.year, month: r.month };
    e.units += 1; e.area += r.area; e.tsv += r.tsv;
    map.set(key, e);
  });
  const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({ key, label: `${MONTHS[v.month]}'${String(v.year).slice(2)}`, units: v.units, area: v.area / 100000, tsv: v.tsv / 1e7 }));
}

/** Monthly units for one specific channel partner (used inside the drill-down). */
export function monthlyTrendForCp(cpIdx: number): { key: string; label: string; units: number; tsv: number; area: number }[] {
  const map = new Map<string, { units: number; tsv: number; area: number; year: number; month: number }>();
  ACTIVE_RECORDS.filter(r => r.cpIdx === cpIdx).forEach(r => {
    const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
    const e = map.get(key) ?? { units: 0, tsv: 0, area: 0, year: r.year, month: r.month };
    e.units += 1;
    e.tsv += r.tsv;
    e.area += r.area;
    map.set(key, e);
  });
  const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({ key, label: `${MONTHS[v.month]}'${String(v.year).slice(2)}`, units: v.units, tsv: v.tsv, area: v.area }));
}

/** Cancellation / rebooking summary within the given record scope. */
export function cancelledRebookingSummary(records: CpRecord[] = CP.R) {
  const cancelledRecs = records.filter(r => r.status === 1);
  const cancelled = cancelledRecs.length;
  const rebooked = cancelledRecs.filter(r => r.rebooked).length;
  const stillVacant = cancelled - rebooked;
  const cancelledTsv = cancelledRecs.reduce((s, r) => s + r.tsv, 0);
  const cancelledArea = cancelledRecs.reduce((s, r) => s + r.area, 0);
  return { cancelled, rebooked, stillVacant, cancelledTsv, cancelledArea };
}

/** By-project breakdown for one channel partner (active units only). */
export function byProjectForCp(cpIdx: number): { projIdx: number; name: string; units: number; area: number; tsv: number }[] {
  const map = new Map<number, { units: number; area: number; tsv: number }>();
  ACTIVE_RECORDS.filter(r => r.cpIdx === cpIdx).forEach(r => {
    const e = map.get(r.projIdx) ?? { units: 0, area: 0, tsv: 0 };
    e.units += 1; e.area += r.area; e.tsv += r.tsv;
    map.set(r.projIdx, e);
  });
  return [...map.entries()].map(([projIdx, v]) => ({ projIdx, name: CP.P[projIdx], ...v })).sort((a, b) => b.units - a.units);
}

/** All records (active + cancelled) for one CP within one project — used by the drill-down unit list. */
export function unitsForCpAndProject(cpIdx: number, projIdx: number): CpRecord[] {
  return CP.R.filter(r => r.cpIdx === cpIdx && r.projIdx === projIdx);
}

export function unitStatusLabel(r: CpRecord): { label: string; color: string; bg: string } {
  if (r.status === 0) return { label: "Booked", color: "#0f6e56", bg: "#e2f3ec" };
  if (r.rebooked) return { label: "Cancelled · Rebooked", color: "#8a531b", bg: "#f7ead9" };
  return { label: "Cancelled · Vacant", color: "#a13a3a", bg: "#fbe4e4" };
}
