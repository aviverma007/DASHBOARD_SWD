/**
 * Generates structured report data from the bundled INVR and PDRN datasets.
 * Each report is an array of row objects — ready for both in-app preview
 * (render as a table) and Excel export (via SheetJS).
 */
import rawInv from "../../data/smartworldInventory.json";
import { PDRN_ACTIVE as rawSales } from "../../data/pdrnActive";
import rawEoi from "../../data/eoiData.json";
import rawLoan from "../../data/loanData.json";
import rawTrk from "../../data/projectTracker.json";
import { CASES, isClosed, ymOf, ymLbl } from "../../components/cases/caseShared";
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


// ── Shared date helper (epoch day → dd-MMM-yyyy) ───────────────────────────

const EPOCH = new Date("2022-01-01T00:00:00").getTime();
const dayStr = (d: number) =>
  d >= 0 ? new Date(EPOCH + d * 86400000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

// ── Report 3: EOI / Advance — money in hand ────────────────────────────────

const EOI = rawEoi as unknown as {
  meta: { asOn: string };
  PROJECTS: string[];
  C: [string, number, number, string, string, number, number, number, number, number, number, number, number][];
};

export function buildEoiReport(): Record<string, unknown>[] {
  const asOnDay = Math.round((new Date("2026-09-25T00:00:00").getTime() - EPOCH) / 86400000);
  const STATUS = ["Allotment pending", "Allotted", "Cancelled"];
  return EOI.C.map(c => {
    const [code, projIdx, status, name, unit, , firstDay, , cleared, adj, refunds, bounced, n] = c;
    const inHand = cleared + adj + refunds;
    const pool = n >= 100 && cleared > 0 && Math.abs(adj) >= 0.9 * cleared;
    return {
      "Customer Code": code,
      "Customer Name": name,
      Project: EOI.PROJECTS[projIdx] ?? "",
      "Money Type": EOI.PROJECTS[projIdx] === "CODE 67 GURGAON" ? "EOI" : "Advance",
      "Account Type": pool ? "Collection pool (pass-through)" : "Customer",
      Status: STATUS[status] ?? "",
      Unit: unit,
      "Paid — Cleared (₹)": Math.round(cleared),
      "Adjusted / JV (₹)": Math.round(adj),
      "Refunded (₹)": Math.round(refunds),
      "Bounced — excluded (₹)": Math.round(bounced),
      "In Hand (₹)": Math.round(inHand),
      Receipts: n,
      "First Payment": dayStr(firstDay),
      "Ageing (days)": firstDay >= 0 ? asOnDay - firstDay : "",
    };
  }).sort((a, b) => (b["In Hand (₹)"] as number) - (a["In Hand (₹)"] as number));
}

// ── Report 4: Loan book ────────────────────────────────────────────────────

const LOAN = rawLoan as unknown as {
  meta: { asOn: string };
  PROJECTS: string[]; BANKS: string[]; EMPS: string[]; PLANS: string[];
  L: (string | number)[][];
};

export function buildLoanReport(): Record<string, unknown>[] {
  return LOAN.L.map(l => {
    const sanct = l[14] as number, disb = l[16] as number, pct = l[17] as number;
    const stage = sanct <= 0 ? "Sanction pending"
      : disb <= 0 ? "Awaiting disbursement"
      : pct >= 99.5 ? "Fully disbursed" : "Partly disbursed";
    return {
      Project: LOAN.PROJECTS[l[0] as number] ?? "",
      "Reg ID": l[3], "Customer Name": l[4], Unit: l[5], Tower: l[6], Floor: l[7],
      "Unit Type": l[8],
      "Unit Cost (₹)": Math.round(l[9] as number),
      Bank: LOAN.BANKS[l[10] as number] ?? "",
      "File No": l[12], "File Date": dayStr(l[13] as number),
      "Sanction Amt (₹)": Math.round(sanct), "Sanction Date": dayStr(l[15] as number),
      "Disbursed Amt (₹)": Math.round(disb), "Disbursed %": `${pct.toFixed(1)}%`,
      "Undisbursed Balance (₹)": Math.round(l[18] as number),
      Stage: stage,
      Handler: LOAN.EMPS[l[22] as number] ?? "",
      "BBA Date": dayStr(l[21] as number),
    };
  });
}

// ── Report 5: Project Tracker — tower summary ──────────────────────────────

const TRK = rawTrk as unknown as {
  meta: { asOn: string };
  PROJECTS: string[]; STATUS: string[]; TOWERS: string[];
  T: (string | number)[][];
};

export function buildTrackerReport(): Record<string, unknown>[] {
  const asOnDay = Math.round((new Date("2026-09-28T00:00:00").getTime() - EPOCH) / 86400000);
  const key = (t: (string | number)[]) => `${t[0]}|${t[12]}`;
  const groups = new Map<string, (string | number)[][]>();
  TRK.T.forEach(t => {
    if ((t[15] as number) !== 1) return;              // leaf activities only
    const k = key(t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  });
  return [...groups.entries()].map(([k, ts]) => {
    const [pi, ti] = k.split("|").map(Number);
    const done = ts.filter(t => {
      const st = TRK.STATUS[t[4] as number];
      return st === "Complete" || st === "Quality checked" || (t[3] as number) >= 100;
    });
    const overdue = ts.filter(t => {
      const st = TRK.STATUS[t[4] as number];
      const isDone = st === "Complete" || st === "Quality checked" || (t[3] as number) >= 100;
      return !isDone && (t[6] as number) >= 0 && (t[6] as number) < asOnDay;
    });
    const slipped = ts.filter(t => (t[6] as number) >= 0 && (t[9] as number) >= 0 && (t[6] as number) > (t[9] as number));
    return {
      Project: TRK.PROJECTS[pi] ?? "",
      "Tower / Area": TRK.TOWERS[ti] || "(unassigned)",
      Activities: ts.length,
      Completed: done.length,
      "Avg Completion %": `${(ts.reduce((s, t) => s + (t[3] as number), 0) / ts.length).toFixed(1)}%`,
      Overdue: overdue.length,
      "Slipped vs Baseline": slipped.length,
    };
  }).sort((a, b) =>
    String(a.Project).localeCompare(String(b.Project)) ||
    String(a["Tower / Area"]).localeCompare(String(b["Tower / Area"])));
}

// ── Report 6: CRM cases — monthly summary ──────────────────────────────────

export function buildCasesReport(): Record<string, unknown>[] {
  const byM = new Map<string, { total: number; closed: number }>();
  CASES.forEach(c => {
    const m = ymOf(c.open);
    if (!byM.has(m)) byM.set(m, { total: 0, closed: 0 });
    const g = byM.get(m)!;
    g.total++;
    if (isClosed(c)) g.closed++;
  });
  return [...byM.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([m, g]) => ({
    Month: ymLbl(m),
    "Cases Opened": g.total,
    Resolved: g.closed,
    "Still Open": g.total - g.closed,
    "Resolution %": `${((g.closed / g.total) * 100).toFixed(1)}%`,
  }));
}

// ── Report catalogue ────────────────────────────────────────────────────────

export const REPORTS: ReportMeta[] = [
  {
    id: "project-inventory",
    title: "Project Inventory Summary",
    description: "Unit count, availability, absorption %, area breakdown, and configurations per project. Sourced from INVR dataset.",
    icon: "🏗️",
    lastUpdated: "INVR export 05-Oct-2026",
  },
  {
    id: "bookings",
    title: "Bookings Report",
    description: "All active PDRN bookings with unit details, customer name, payment plan, booking date, and Total Basic Selling Price.",
    icon: "📋",
    lastUpdated: "PDRN export 05-Oct-2026",
  },
  {
    id: "eoi-advance",
    title: "EOI / Advance — Money In Hand",
    description: "Every EOI/advance customer with amounts paid, adjusted, refunded, bounced, money still in hand, ageing and pool-account flag. Advance for RERA projects; EOI for Code 67.",
    icon: "💰",
    lastUpdated: "EOI receipt exports 25-Sep-2026",
  },
  {
    id: "loan-book",
    title: "Home-Loan Book",
    description: "Every loan case with bank, file and sanction details, disbursement progress, undisbursed balance and loan stage.",
    icon: "🏦",
    lastUpdated: "Loan export 28-Sep-2026",
  },
  {
    id: "tracker-summary",
    title: "Construction Progress — Tower Summary",
    description: "Project × tower rollup of the construction schedule: activities, completed, average completion, overdue and slipped-vs-baseline counts across all 7 projects.",
    icon: "🏗️",
    lastUpdated: "Planning exports 28-Sep-2026",
  },
  {
    id: "cases-monthly",
    title: "CRM Cases — Monthly Summary",
    description: "Customer cases opened per month with resolved counts, still-open backlog and the resolution rate.",
    icon: "🎧",
    lastUpdated: "CRM case export",
  },
];

export function getReportRows(id: string): Record<string, unknown>[] {
  if (id === "project-inventory") return buildProjectInventoryReport() as unknown as Record<string, unknown>[];
  if (id === "bookings") return buildBookingsReport() as unknown as Record<string, unknown>[];
  if (id === "eoi-advance") return buildEoiReport();
  if (id === "loan-book") return buildLoanReport();
  if (id === "tracker-summary") return buildTrackerReport();
  if (id === "cases-monthly") return buildCasesReport();
  return [];
}
