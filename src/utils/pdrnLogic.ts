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
  U: number[][];
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
}

export interface OverallStats {
  sold: { units: number; area: number; tsv: number };
  unsold: { units: number; area: number };
  total: { units: number; area: number };
  soldPct: number;
  management: number;
  projects: ProjectStats[];
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

  // UNSOLD: from INVR available (point-in-time, not period-filtered)
  const invUnits = INV.U.filter((u) => u[0] === invProjIdx);
  const invAvail = invUnits.filter((u) => u[8] === 0);
  const invMgmt = invUnits.filter((u) => u[8] === 2);

  // UNSOLD = available + management (held-back units are also not sold)
  const unsold = {
    units: invAvail.length + invMgmt.length,
    area: invAvail.reduce((s, u) => s + u[6], 0) + invMgmt.reduce((s, u) => s + u[6], 0),
  };

  // TOTAL = SOLD + UNSOLD (from INVR excl. management)
  const total = {
    units: sold.units + unsold.units,
    area: sold.area + unsold.area,
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
