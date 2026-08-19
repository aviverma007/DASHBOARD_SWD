/**
 * Core domain types for the Inventory/Sales dashboard.
 *
 * Status values (AVAILABLE/BOOKED/MANAGEMENT) match the real INVR
 * export now powering the Inventory page — confirmed, not a guess.
 * Area type below remains unconfirmed for this generic Overview
 * scaffold specifically, since it doesn't yet read the real per-unit
 * area-type field.
 */

export type UnitStatus = "AVAILABLE" | "BOOKED" | "MANAGEMENT";

// ASSUMPTION: area type is unconfirmed. Kept configurable rather than
// hardcoded so the source convention can be set once confirmed.
export type AreaType =
  | "CARPET"
  | "SALEABLE"
  | "SUPER"
  | "CHARGEABLE"
  | "UNSPECIFIED";

export type PeriodGranularity = "monthly" | "quarterly" | "yearly";

export interface Group {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  groupId: string;
  towerIds: string[];
}

export interface Tower {
  id: string;
  projectId: string;
  name: string;
  floorIds: string[];
}

export interface Floor {
  id: string;
  towerId: string;
  projectId: string;
  name: string;
  unitIds: string[];
  order?: number; // numeric floor position, for sorting across towers in a stack plan
}

export interface Unit {
  id: string;
  floorId: string;
  towerId: string;
  projectId: string;
  status: UnitStatus;
  area: number;
  areaType: AreaType;
  bookingDate?: string; // ISO date string
  customerId?: string;
}

export interface Customer {
  id: string;
  name: string;
  unitId: string;
  bookingDate: string;
  contact?: string;
}

/** Pre-aggregated snapshot for a given project + period, used to drive
 * KPI cards and trend charts without recomputing from raw units every time. */
export interface PeriodSnapshot {
  period: string; // e.g. "2026-08", "FY2026-Q2", "FY2026"
  granularity: PeriodGranularity;
  projectId: string;
  availableUnits: number;
  bookedUnits: number;
  totalUnits: number;
  availableArea: number;
  bookedArea: number;
  totalArea: number;
}

/** Result shape for any KPI computation, kept generic so the same
 * shape can represent Available, Booked, or Total. */
export interface KpiResult {
  label: string;
  units: number;
  area: number;
  percentage: number; // relative to total, 0-100
  previousUnits?: number;
  previousArea?: number;
  changePercent?: number; // % change vs previous period, if available
}

export interface ProjectContribution {
  projectId: string;
  projectName: string;
  availableUnits: number;
  bookedUnits: number;
  totalUnits: number;
  availableArea: number;
  bookedArea: number;
  totalArea: number;
  bookedPercent: number; // absorption — booked units as a % of total
  contributionPercent: number; // this project's share of the group total
}

export type DrillLevel =
  | "group"
  | "project"
  | "tower"
  | "floor"
  | "unit"
  | "customer";

export interface DrillPathSegment {
  level: DrillLevel;
  id: string;
  label: string;
}

export interface DataValidationIssue {
  rowIndex: number;
  field: string;
  issue: "Invalid" | "Warning" | "Missing mapping" | "Duplicate" | "Excluded";
  message: string;
}

export interface DataFreshness {
  lastRefreshed: string; // ISO datetime
  sourceFile: string;
  uploadedBy: string;
  reportingPeriod: string;
  validationStatus: "Validated" | "Pending" | "Failed";
}
