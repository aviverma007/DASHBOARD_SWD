/**
 * Types for the REAL Smartworld inventory dataset, sourced from the
 * existing sales-intelligence HTML tool's embedded data (RD object).
 * This replaces the earlier synthetic mock data entirely for the
 * Inventory module.
 *
 * Raw encoding: each unit is a fixed-length array (see UnitRow) that
 * indexes into lookup tables (project/tower/floor/config/unit-type/
 * payment-plan/rate-band names) rather than repeating strings per row.
 */

export type RawUnitRow = [
  number, // 0: project index -> P[]
  number, // 1: tower index -> TW[]
  number, // 2: floor number (numeric, for floor banding/sorting)
  number, // 3: floor label index -> FL[]
  number, // 4: config index -> CFG[]
  number, // 5: unit type index -> UT[]
  number, // 6: total super area (sq ft)
  number, // 7: total unit cost (INR)
  0 | 1 | 2, // 8: status - 0 Available, 1 Booked, 2 Management/blocked
  number, // 9: management sub-category (0 on hold / 1 in progress / 2 mgmt unit) - only meaningful when status===2
  number, // 10: payment plan index -> PP[] (-1 if not applicable)
  number, // 11: rate band index -> RB[]
  string, // 12: unit label/number
];

export interface RawInventoryDataset {
  P: string[]; // projects
  TW: string[]; // towers
  FL: string[]; // floor labels
  CFG: string[]; // configurations (1 BHK, 2 BHK, ... Commercial)
  UT: string[]; // unit types (Apartment, Shop, Retail, KIOSK, PENTHOUSE, ...)
  PP: string[]; // payment plans
  RB: string[]; // rate bands
  U: RawUnitRow[]; // unit records
}

export type UnitStatus = "AVAILABLE" | "BOOKED" | "MANAGEMENT";

/** Normalized unit shape used throughout the app — components work
 * with this, never with the raw array-encoded rows directly. */
export interface InventoryUnit {
  index: number; // position in the original U array, used as a stable id
  projectIndex: number;
  projectName: string;
  towerIndex: number;
  towerName: string;
  floorNumber: number;
  floorLabel: string;
  configIndex: number;
  configName: string;
  unitTypeIndex: number;
  unitTypeName: string;
  area: number; // sq ft
  cost: number; // INR
  status: UnitStatus;
  managementSubCategory?: number;
  paymentPlan?: string;
  rateBand?: string;
  unitLabel: string;
  isCommercial: boolean;
}
