/**
 * Generates structured report data from the bundled INVR and PDRN datasets.
 * Each report is an array of row objects — ready for both in-app preview
 * (render as a table) and Excel export (via SheetJS).
 */
import rawInv from "../../data/smartworldInventory.json";
import { PDRN_ACTIVE as rawSales } from "../../data/pdrnActive";
import type { RawInventoryDataset } from "../../types/smartworldRaw";

const INV = rawInv as unknown as RawInventoryDataset;
const PDRN = rawSales as unknown as {
  P: string[]; TW: string[]; FL: string[]; CFG: string[];
  R: number[][];
};

export interface ReportMeta {
  id: string;
  title: string;
  description: string;
  icon: string;
  lastUpdated: string;
}

// ── Report 1: Project Inventory Summary ────────────────────────────────────

export interface ProjectInventoryRow {
  Project: string;
  "Total Units": number;
  "Available Units": number;
  "Booked Units": number;
  "Blocked Units": number;
  "Available %": string;
  "Booked %": string;
  "Total Area (L sq ft)": string;
  "Available Area (L sq ft)": string;
  "Booked Area (L sq ft)": string;
  Configurations: string;
  Towers: number;
}

export function buildProjectInventoryReport(): ProjectInventoryRow[] {
  return INV.P.map((projName, pIdx) => {
    const units = INV.U.filter((u) => u[0] === pIdx);
    const avail = units.filter((u) => u[8] === 0);
    const booked = units.filter((u) => u[8] === 1);
    const mgmt = units.filter((u) => u[8] === 2);
    const total = units.length;
    const configs = [...new Set(units.map((u) => INV.CFG[u[4]]))].sort().join(", ");
    const towers = new Set(units.map((u) => u[1])).size;
    const areaTotal = units.reduce((s, u) => s + u[6], 0);
    const areaAvail = avail.reduce((s, u) => s + u[6], 0);
    const areaBooked = booked.reduce((s, u) => s + u[6], 0);

    return {
      Project: projName,
      "Total Units": total,
      "Available Units": avail.length,
      "Booked Units": booked.length,
      "Blocked Units": mgmt.length,
      "Available %": total ? `${((avail.length / total) * 100).toFixed(1)}%` : "0%",
      "Booked %": total ? `${((booked.length / total) * 100).toFixed(1)}%` : "0%",
      "Total Area (L sq ft)": (areaTotal / 100000).toFixed(2),
      "Available Area (L sq ft)": (areaAvail / 100000).toFixed(2),
      "Booked Area (L sq ft)": (areaBooked / 100000).toFixed(2),
      Configurations: configs,
      Towers: towers,
    };
  });
}

// ── Report 2: Bookings (PDRN Active) ───────────────────────────────────────

export interface BookingRow {
  Project: string;
  Tower: string;
  Floor: string;
  "Unit No": string;
  Configuration: string;
  "Super Area (sq ft)": number;
  "Total BSP (₹ Cr)": string;
  "Booking Year": number;
  "Booking Month": string;
  "Customer Name": string;
  "Payment Plan": string;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function buildBookingsReport(): BookingRow[] {
  return PDRN.R.map((r) => ({
    Project: PDRN.P[r[0]] ?? "",
    Tower: PDRN.TW[r[1]] ?? "",
    Floor: PDRN.FL[r[3]] ?? "",
    "Unit No": String(r[9]),
    Configuration: PDRN.CFG[r[4]] ?? "",
    "Super Area (sq ft)": r[5],
    "Total BSP (₹ Cr)": (r[6] / 1e7).toFixed(2),
    "Booking Year": r[7],
    "Booking Month": MONTHS[(r[8] as number) - 1] ?? "",
    "Customer Name": String(r[10]),
    "Payment Plan": String(r[11]),
  }));
}

// ── Report catalogue ────────────────────────────────────────────────────────

export const REPORTS: ReportMeta[] = [
  {
    id: "project-inventory",
    title: "Project Inventory Summary",
    description: "Unit count, availability, absorption %, area breakdown, and configurations per project. Sourced from INVR dataset.",
    icon: "🏗️",
    lastUpdated: "INVR export 18-Aug-2026",
  },
  {
    id: "bookings",
    title: "Bookings Report",
    description: "All active PDRN bookings with unit details, customer name, payment plan, booking date, and Total Basic Selling Price.",
    icon: "📋",
    lastUpdated: "Merge_Sales 17-Aug-2026",
  },
];

export function getReportRows(id: string): Record<string, unknown>[] {
  if (id === "project-inventory") return buildProjectInventoryReport() as unknown as Record<string, unknown>[];
  if (id === "bookings") return buildBookingsReport() as unknown as Record<string, unknown>[];
  return [];
}
