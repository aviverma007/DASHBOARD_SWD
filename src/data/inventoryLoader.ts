/**
 * Loads the real Smartworld inventory dataset (src/data/smartworldInventory.json)
 * and normalizes it into typed InventoryUnit records.
 *
 * This is REAL unit-level data (10,600+ units across 13 live projects),
 * sourced from the existing sales-intelligence dashboard. It replaces the
 * earlier synthetic mock data for the Inventory module.
 */
import rawData from "../data/smartworldInventory.json";
import type {
  RawInventoryDataset,
  InventoryUnit,
  UnitStatus,
} from "../types/inventoryRaw";

const RD = rawData as unknown as RawInventoryDataset;

const STATUS_MAP: UnitStatus[] = ["AVAILABLE", "BOOKED", "MANAGEMENT"];

// Commercial unit types + the one project (One DXP Street) treated as
// fully commercial regardless of per-unit type, matching the source tool's logic.
const COMMERCIAL_UNIT_TYPES = new Set(["Shop", "Retail", "Restaurant", "KIOSK"]);
const STREET_PROJECT_INDEX = RD.P.indexOf("Smartworld One DXP Street");

function isCommercial(row: RawInventoryDataset["U"][number]): boolean {
  const unitTypeName = RD.UT[row[5]];
  return COMMERCIAL_UNIT_TYPES.has(unitTypeName) || row[0] === STREET_PROJECT_INDEX;
}

function normalizeUnit(row: RawInventoryDataset["U"][number], index: number): InventoryUnit {
  const [
    projectIndex,
    towerIndex,
    floorNumber,
    floorLabelIndex,
    configIndex,
    unitTypeIndex,
    area,
    cost,
    status,
    managementSubCategory,
    paymentPlanIndex,
    rateBandIndex,
    unitLabel,
  ] = row;

  return {
    index,
    projectIndex,
    projectName: RD.P[projectIndex],
    towerIndex,
    towerName: RD.TW[towerIndex] ?? "",
    floorNumber,
    floorLabel: RD.FL[floorLabelIndex] ?? "",
    configIndex,
    configName: RD.CFG[configIndex] ?? "Unspecified",
    unitTypeIndex,
    unitTypeName: RD.UT[unitTypeIndex] ?? "Unspecified",
    area,
    cost,
    status: STATUS_MAP[status],
    managementSubCategory: status === 2 ? managementSubCategory : undefined,
    paymentPlan:
      status === 1 && paymentPlanIndex >= 0 ? RD.PP[paymentPlanIndex] : undefined,
    rateBand: rateBandIndex >= 0 ? RD.RB[rateBandIndex] : undefined,
    unitLabel,
    isCommercial: isCommercial(row),
  };
}

// Parsed once per session — the dataset is static/bundled, not fetched.
export const INVENTORY_UNITS: InventoryUnit[] = RD.U.map((row, i) => normalizeUnit(row, i));

export const PROJECT_NAMES = RD.P;
export const TOWER_NAMES = RD.TW;
export const FLOOR_LABELS = RD.FL;
export const CONFIG_NAMES = RD.CFG;
export const UNIT_TYPE_NAMES = RD.UT;

export function getUnitByIndex(index: number): InventoryUnit | undefined {
  return INVENTORY_UNITS[index];
}
