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

/** Per-channel-partner totals across all active bookings (+ cancellations for that CP). */
export function summariseByChannelPartner(): CpSummary[] {
  const map = new Map<number, CpSummary>();
  function ensure(cpIdx: number): CpSummary {
    let s = map.get(cpIdx);
    if (!s) {
      s = { cpIdx, name: CP.CP[cpIdx], units: 0, area: 0, tsv: 0, cancelled: 0, rebooked: 0 };
      map.set(cpIdx, s);
    }
    return s;
  }
  ACTIVE_RECORDS.forEach(r => {
    const s = ensure(r.cpIdx);
    s.units += 1; s.area += r.area; s.tsv += r.tsv;
  });
  CANCELLED_RECORDS.forEach(r => {
    const s = ensure(r.cpIdx);
    s.cancelled += 1;
    if (r.rebooked) s.rebooked += 1;
  });
  return [...map.values()];
}

export function topByUnits(n: number, excludeDirect = false): CpSummary[] {
  return summariseByChannelPartner()
    .filter(s => !excludeDirect || s.name !== "Direct")
    .sort((a, b) => b.units - a.units)
    .slice(0, n);
}
export function topByArea(n: number, excludeDirect = false): CpSummary[] {
  return summariseByChannelPartner()
    .filter(s => !excludeDirect || s.name !== "Direct")
    .sort((a, b) => b.area - a.area)
    .slice(0, n);
}
export function topByTsv(n: number, excludeDirect = false): CpSummary[] {
  return summariseByChannelPartner()
    .filter(s => !excludeDirect || s.name !== "Direct")
    .sort((a, b) => b.tsv - a.tsv)
    .slice(0, n);
}
export function topByCancelled(n: number): CpSummary[] {
  return summariseByChannelPartner()
    .filter(s => s.cancelled > 0)
    .sort((a, b) => b.cancelled - a.cancelled)
    .slice(0, n);
}

/** Monthly aggregate (all channel partners combined, excluding Direct) across the full booking history. */
export function monthlyTrend(excludeDirect = true): { key: string; label: string; units: number; area: number; tsv: number }[] {
  const map = new Map<string, { units: number; area: number; tsv: number; year: number; month: number }>();
  ACTIVE_RECORDS.forEach(r => {
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
export function monthlyTrendForCp(cpIdx: number): { key: string; label: string; units: number }[] {
  const map = new Map<string, { units: number; year: number; month: number }>();
  ACTIVE_RECORDS.filter(r => r.cpIdx === cpIdx).forEach(r => {
    const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
    const e = map.get(key) ?? { units: 0, year: r.year, month: r.month };
    e.units += 1;
    map.set(key, e);
  });
  const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({ key, label: `${MONTHS[v.month]}'${String(v.year).slice(2)}`, units: v.units }));
}

/** Cancellation / rebooking portfolio-wide summary. */
export function cancelledRebookingSummary() {
  const cancelled = CANCELLED_RECORDS.length;
  const rebooked = CANCELLED_RECORDS.filter(r => r.rebooked).length;
  const stillVacant = cancelled - rebooked;
  const cancelledTsv = CANCELLED_RECORDS.reduce((s, r) => s + r.tsv, 0);
  const cancelledArea = CANCELLED_RECORDS.reduce((s, r) => s + r.area, 0);
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
