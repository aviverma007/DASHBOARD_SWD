/**
 * Real-data adapter for the generic Overview scaffold (KpiStrip,
 * ProjectComparisonChart, ProjectBreakupTable, drill-down). Converts
 * the same INVR-derived dataset that powers the Inventory page
 * (src/data/smartworldInventory.json) into this scaffold's Project/
 * Tower/Floor/Unit domain shapes. Replaces the synthetic mock-data
 * generator that used to live at src/data/mockData.ts (removed once
 * this file took over — see git history if it's ever needed again).
 *
 * This is real, confirmed data — the same 6-project, 3,386-unit INVR
 * export from REQ-007 in the requirement register — not a placeholder.
 * No customer/booking-date data exists in that export, so `customers`
 * is intentionally left empty rather than fabricated.
 */
import rawData from "./smartworldInventory.json";
import type { Group, Project, Tower, Floor, Unit, Customer, UnitStatus } from "../types/domain";
import type { RawInventoryDataset, RawUnit } from "../types/smartworldRaw";

const RD = rawData as unknown as RawInventoryDataset;

const GROUP: Group = { id: "grp-swd", name: "Smart World Developers" };

const STATUS_MAP: UnitStatus[] = ["AVAILABLE", "BOOKED", "MANAGEMENT"];

interface BuiltData {
  groups: Group[];
  projects: Project[];
  towers: Tower[];
  floors: Floor[];
  units: Unit[];
  customers: Customer[];
}

function buildRealData(): BuiltData {
  const projects: Project[] = [];
  const towers: Tower[] = [];
  const floors: Floor[] = [];
  const units: Unit[] = [];

  // Stable synthetic ids, namespaced by project/tower/floor index so
  // they're deterministic across rebuilds of the same source data.
  const projectId = (pIdx: number) => `proj-${pIdx}`;
  const towerId = (pIdx: number, tIdx: number) => `proj-${pIdx}-tw-${tIdx}`;
  const floorId = (pIdx: number, tIdx: number, fIdx: number) => `proj-${pIdx}-tw-${tIdx}-fl-${fIdx}`;

  // Group units by project -> tower -> floor to build the id hierarchy
  // the rest of the pipeline (drill-down, floor/tower lookups) expects.
  const towerKeys = new Map<
    string,
    {
      pIdx: number;
      tIdx: number;
      floorKeys: Map<string, { fIdx: number; floorLabelIdx: number; floorOrder: number; unitIds: string[] }>;
    }
  >();
  const projectTowerIds = new Map<number, string[]>();

  RD.U.forEach((raw: RawUnit, unitIdx: number) => {
    const [pIdx, tIdx, floorNumber, flIdx, , , area, , status] = raw;

    const pId = projectId(pIdx);
    const twKey = `${pIdx}|${tIdx}`;
    if (!towerKeys.has(twKey)) {
      towerKeys.set(twKey, { pIdx, tIdx, floorKeys: new Map() });
      const list = projectTowerIds.get(pIdx) ?? [];
      list.push(towerId(pIdx, tIdx));
      projectTowerIds.set(pIdx, list);
    }
    const towerEntry = towerKeys.get(twKey)!;

    const flKey = `${tIdx}|${flIdx}`;
    if (!towerEntry.floorKeys.has(flKey)) {
      towerEntry.floorKeys.set(flKey, {
        fIdx: towerEntry.floorKeys.size,
        floorLabelIdx: flIdx,
        floorOrder: floorNumber,
        unitIds: [],
      });
    }
    const floorEntry = towerEntry.floorKeys.get(flKey)!;

    const unitId = `unit-${unitIdx}`;
    floorEntry.unitIds.push(unitId);

    units.push({
      id: unitId,
      floorId: floorId(pIdx, tIdx, floorEntry.fIdx),
      towerId: towerId(pIdx, tIdx),
      projectId: pId,
      status: STATUS_MAP[status],
      area,
      areaType: "UNSPECIFIED",
      // No customer/booking-date field in this source — left undefined
      // rather than fabricated. See module doc comment.
    });
  });

  // Materialize towers and floors from the maps built above.
  towerKeys.forEach(({ pIdx, tIdx, floorKeys }) => {
    const floorIds: string[] = [];
    floorKeys.forEach(({ fIdx, floorLabelIdx, floorOrder, unitIds }) => {
      const fId = floorId(pIdx, tIdx, fIdx);
      floorIds.push(fId);
      floors.push({
        id: fId,
        towerId: towerId(pIdx, tIdx),
        projectId: projectId(pIdx),
        name: RD.FL[floorLabelIdx] ?? "Floor",
        unitIds,
        order: floorOrder,
      });
    });
    towers.push({
      id: towerId(pIdx, tIdx),
      projectId: projectId(pIdx),
      name: RD.TW[tIdx] || "No tower",
      floorIds,
    });
  });

  RD.P.forEach((name, pIdx) => {
    projects.push({
      id: projectId(pIdx),
      name,
      groupId: GROUP.id,
      towerIds: projectTowerIds.get(pIdx) ?? [],
    });
  });

  return { groups: [GROUP], projects, towers, floors, units, customers: [] };
}

// Built once per session from the static bundled INVR JSON.
export const REAL_DATA = buildRealData();
