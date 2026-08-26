/**
 * Pure calculation layer for the PDRN (sales bookings) dataset.
 * SOLD   = active bookings in salesPDRN.json (PDRN active records)
 * UNSOLD = INVR available units + INVR management units
 *          (management units are held back and also not sold, so included)
 * TOTAL  = SOLD + UNSOLD
 * TSV    = sum of Total Basic Selling Price (sold units only)
 *
 * Period filter applies to SFDC Booking Date (year/month on each record).
 * When a period is active, SOLD counts only bookings within that window;
 * UNSOLD and TOTAL stay as-is (they are a point-in-time inventory snapshot,
 * not date-filtered — this matches standard real-estate reporting practice
 * where "unsold" means currently unsold regardless of when it was counted).
 */

import salesRaw from "../data/salesPDRN.json";
import invRaw from "../data/smartworldInventory.json";

export interface SalesRecord {
  projIdx: number;
  towerIdx: number;
  floorNum: number;
  floorLabelIdx: number;
  cfgIdx: number;
  area: number;       // super area sq ft
  tsv: number;        // Total Basic Selling Price INR
  year: number;
  month: number;      // 1-12
  unitNo: string;
  customerName: string;
  paymentPlan: string;
}

export interface PdrnDataset {
  P: string[];   // project names
  TW: string[];  // tower names
  FL: string[];  // floor labels
  CFG: string[]; // config names (1 BHK, 2 BHK, …)
  R: SalesRecord[];
  meta: { rows: number; source: string; years: number[] };
}

export interface InvDataset {
  P: string[];
  /** Positional unit tuples; index 12 is the unit number string
   * (e.g. "T6-903"), the rest are numeric codes/values. */
  U: (number | string)[][];
}

// Cast raw JSON to typed interfaces
const SD = salesRaw as unknown as { P: string[]; TW: string[]; FL: string[]; CFG: string[]; R: number[][]; meta: { rows: number; source: string; years: number[] } };
const ID = invRaw as unknown as InvDataset;

export const PDRN: PdrnDataset = {
  P: SD.P, TW: SD.TW, FL: SD.FL, CFG: SD.CFG,
  meta: SD.meta,
  R: SD.R.map((r) => ({
    projIdx: r[0], towerIdx: r[1], floorNum: r[2], floorLabelIdx: r[3],
    cfgIdx: r[4], area: r[5], tsv: r[6], year: r[7], month: r[8],
    unitNo: String(r[9]), customerName: String(r[10]), paymentPlan: String(r[11]),
  })),
};

export const INV = ID;

/** INVR project index from PDRN project name (needed for UNSOLD/TOTAL from INVR) */
const INVR_PROJ_MAP: Record<string, number> = {};
PDRN.P.forEach((name) => {
  const idx = INV.P.findIndex((p) => p === name);
  if (idx >= 0) INVR_PROJ_MAP[name] = idx;
  // Smartworld Residencies: in INVR but not PDRN (0 bookings) — handled in INVR-side loop
});

/** All INVR project indices, including those not in PDRN */
export const ALL_INVR_PROJECTS = INV.P.map((name, idx) => ({ name, idx }));

export interface PeriodFilter {
  type: "all" | "year" | "quarter" | "month";
  year?: number;
  quarter?: number; // 1-4
  month?: number;   // 1-12
}

export interface ProjectStats {
  projectName: string;
  pdrnProjIdx: number | null; // null if project is in INVR only (e.g. Residencies)
  invProjIdx: number;
  sold: { units: number; area: number; tsv: number };
  unsold: { units: number; area: number };
  total: { units: number; area: number };
  soldPct: number;   // % of total units sold
  management: number; // management units (from INVR, not in sold/unsold/total)
  rate: RateStats;
}

export interface OverallStats {
  sold: { units: number; area: number; tsv: number };
  unsold: { units: number; area: number };
  total: { units: number; area: number };
  soldPct: number;
  management: number;
  projects: ProjectStats[];
  rate: RateStats;
}

/** Per-sqft sale rate summary over a set of sold records.
 * avg = blended rate (total TSV / total area) — the standard "average
 * selling rate" a project reports, not a simple mean of per-unit rates.
 * max/min = the individual unit rates (TSV/area for that one record)
 * at the extremes. null across the board when there's no sold area to
 * derive a rate from (e.g. a project/period with zero bookings). */
export interface RateStats {
  avg: number | null;
  max: number | null;
  min: number | null;
}

export function computeRateStats(records: SalesRecord[]): RateStats {
  const withArea = records.filter((r) => r.area > 0 && r.tsv > 0);
  if (withArea.length === 0) return { avg: null, max: null, min: null };
  const totalTsv = withArea.reduce((s, r) => s + r.tsv, 0);
  const totalArea = withArea.reduce((s, r) => s + r.area, 0);
  const unitRates = withArea.map((r) => r.tsv / r.area);
  return {
    avg: totalArea > 0 ? totalTsv / totalArea : null,
    max: Math.max(...unitRates),
    min: Math.min(...unitRates),
  };
}

/** Formats a ₹/sqft rate, e.g. "₹12,450/sqft". Returns an em-dash when
 * no rate could be derived (no sold units in scope). */
export function fRate(n: number | null): string {
  if (n === null || !isFinite(n)) return "—";
  return "₹" + Math.round(n).toLocaleString("en-IN") + "/sqft";
}

/** City each project belongs to (per business, Aug 2026). Keyed by the
 * INVR project name, which is the canonical name across the app. */
export const PROJECT_LOCATION: Record<string, string> = {
  "SMARTWORLD THE EDITION":   "Gurgaon",
  "SMARTWORLD SKY ARC":       "Gurgaon",
  "TRUMP RESIDENCES GURGAON": "Gurgaon",
  "SMARTWORLD LE COURTYARD":  "Noida",
  "SMARTWORLD RESIDENCIES":   "Noida",
  "SMARTWORLD SUITES":        "Noida",
};

/** Distinct locations, in display order. */
export const LOCATIONS: string[] = [...new Set(Object.values(PROJECT_LOCATION))];

export function projectLocation(name: string): string | null {
  return PROJECT_LOCATION[name] ?? null;
}

function recordInPeriod(r: SalesRecord, period: PeriodFilter): boolean {
  if (period.type === "all") return true;
  if (period.year !== undefined && r.year !== period.year) return false;
  if (period.type === "quarter" && period.quarter !== undefined) {
    const q = Math.ceil(r.month / 3);
    if (q !== period.quarter) return false;
  }
  if (period.type === "month" && period.month !== undefined) {
    if (r.month !== period.month) return false;
  }
  return true;
}

export function calcProjectStats(
  invProjIdx: number,
  period: PeriodFilter,
  projectName?: string
): ProjectStats {
  const name = projectName ?? INV.P[invProjIdx];
  // Find PDRN project index (may not exist)
  const pdrnProjIdx = PDRN.P.indexOf(name);

  // SOLD: from PDRN, period-filtered
  const soldRecords = pdrnProjIdx >= 0
    ? PDRN.R.filter((r) => r.projIdx === pdrnProjIdx && recordInPeriod(r, period))
    : [];

  const sold = {
    units: soldRecords.length,
    area: soldRecords.reduce((s, r) => s + r.area, 0),
    tsv: soldRecords.reduce((s, r) => s + r.tsv, 0),
  };

  // TOTAL: straight from INVR — the same stock register the Inventory
  // tab counts, so both tabs always show identical project totals.
  const invUnits = INV.U.filter((u) => (u[0] as number) === invProjIdx);
  const invMgmt = invUnits.filter((u) => (u[8] as number) === 2);
  const total = {
    units: invUnits.length,
    area: invUnits.reduce((s, u) => s + (u[6] as number), 0),
  };

  // UNSOLD: INVR units with no matching ALL-TIME sale record, matched
  // by unit number. Deliberately not `total − sold`: sold above is
  // period-filtered, while stock is point-in-time. Unit-level matching
  // also means a unit flagged Booked in INVR without a PDRN sale
  // record (a timing gap between the two exports) counts as unsold
  // here rather than silently shrinking the total.
  const allTimeSoldNos = pdrnProjIdx >= 0
    ? new Set(PDRN.R.filter((r) => r.projIdx === pdrnProjIdx).map((r) => r.unitNo))
    : new Set<string>();
  const unsoldUnits = invUnits.filter((u) => !allTimeSoldNos.has(u[12] as string));
  const unsold = {
    units: unsoldUnits.length,
    area: unsoldUnits.reduce((s, u) => s + (u[6] as number), 0),
  };

  return {
    projectName: name,
    pdrnProjIdx: pdrnProjIdx >= 0 ? pdrnProjIdx : null,
    invProjIdx,
    sold,
    unsold,
    total,
    soldPct: total.units ? Math.round((sold.units / total.units) * 100) : 0,
    management: invMgmt.length,
    rate: computeRateStats(soldRecords),
  };
}

export function calcOverall(period: PeriodFilter): OverallStats {
  const projects = ALL_INVR_PROJECTS.map((p) => calcProjectStats(p.idx, period, p.name));
  return {
    sold: {
      units: projects.reduce((s, p) => s + p.sold.units, 0),
      area: projects.reduce((s, p) => s + p.sold.area, 0),
      tsv: projects.reduce((s, p) => s + p.sold.tsv, 0),
    },
    unsold: {
      units: projects.reduce((s, p) => s + p.unsold.units, 0),
      area: projects.reduce((s, p) => s + p.unsold.area, 0),
    },
    total: {
      units: projects.reduce((s, p) => s + p.total.units, 0),
      area: projects.reduce((s, p) => s + p.total.area, 0),
    },
    soldPct: (() => {
      const tu = projects.reduce((s, p) => s + p.total.units, 0);
      const su = projects.reduce((s, p) => s + p.sold.units, 0);
      return tu ? Math.round((su / tu) * 100) : 0;
    })(),
    management: projects.reduce((s, p) => s + p.management, 0),
    projects,
    rate: (() => {
      const totalTsv = projects.reduce((s, p) => s + p.sold.tsv, 0);
      const totalArea = projects.reduce((s, p) => s + p.sold.area, 0);
      const maxes = projects.map((p) => p.rate.max).filter((v): v is number => v !== null);
      const mins = projects.map((p) => p.rate.min).filter((v): v is number => v !== null);
      return {
        avg: totalArea > 0 ? totalTsv / totalArea : null,
        max: maxes.length ? Math.max(...maxes) : null,
        min: mins.length ? Math.min(...mins) : null,
      };
    })(),
  };
}

export function fCr(n: number): string {
  const v = n / 1e7;
  return "₹" + (v >= 100 ? Math.round(v).toLocaleString("en-IN") : v.toFixed(1)) + " Cr";
}

export function fArea(sqft: number): string {
  if (sqft >= 100000) return (sqft / 100000).toFixed(2) + " L sq ft";
  return Math.round(sqft).toLocaleString("en-IN") + " sq ft";
}

/** All sold records for a project, period-filtered — used by drill-down */
export function getSoldRecords(invProjIdx: number, period: PeriodFilter): SalesRecord[] {
  const name = INV.P[invProjIdx];
  const pdrnIdx = PDRN.P.indexOf(name);
  if (pdrnIdx < 0) return [];
  return PDRN.R.filter((r) => r.projIdx === pdrnIdx && recordInPeriod(r, period));
}
