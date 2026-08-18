/**
 * MOCK DATA — clearly labeled placeholder.
 *
 * This is NOT real SAP/Excel data. It exists so the dashboard can be
 * built and demoed before real data mappings are confirmed. Every
 * value here is synthetic. See src/types/domain.ts for the fields
 * that will eventually be replaced with validated source data.
 */
import type {
  Group,
  Project,
  Tower,
  Floor,
  Unit,
  Customer,
  UnitStatus,
} from "../types/domain";

const GROUP: Group = { id: "grp-swd", name: "Smart World Developers" };

const PROJECT_DEFS = [
  { id: "proj-edition", name: "Smartworld The Edition", towers: 4, floorsPerTower: 12, unitsPerFloor: 8 },
  { id: "proj-skyarc", name: "Smartworld Sky Arc", towers: 3, floorsPerTower: 14, unitsPerFloor: 8 },
  { id: "proj-trump", name: "Trump Residences Gurgaon", towers: 2, floorsPerTower: 16, unitsPerFloor: 6 },
];

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function pickStatus(rand: () => number): UnitStatus {
  const r = rand();
  if (r < 0.58) return "SOLD";
  if (r < 0.92) return "UNSOLD";
  return "BLOCKED";
}

interface BuiltData {
  groups: Group[];
  projects: Project[];
  towers: Tower[];
  floors: Floor[];
  units: Unit[];
  customers: Customer[];
}

function buildMockData(): BuiltData {
  const rand = seededRandom(42);
  const projects: Project[] = [];
  const towers: Tower[] = [];
  const floors: Floor[] = [];
  const units: Unit[] = [];
  const customers: Customer[] = [];

  for (const pDef of PROJECT_DEFS) {
    const towerIds: string[] = [];

    for (let t = 1; t <= pDef.towers; t++) {
      const towerId = `${pDef.id}-t${t}`;
      towerIds.push(towerId);
      const floorIds: string[] = [];

      for (let f = 1; f <= pDef.floorsPerTower; f++) {
        const floorId = `${towerId}-f${f}`;
        floorIds.push(floorId);
        const unitIds: string[] = [];

        for (let u = 1; u <= pDef.unitsPerFloor; u++) {
          const unitId = `${floorId}-u${u}`;
          unitIds.push(unitId);

          const status = pickStatus(rand);
          const area = Math.round(1100 + rand() * 1900); // sq ft, synthetic
          const unit: Unit = {
            id: unitId,
            floorId,
            towerId,
            projectId: pDef.id,
            status,
            area,
            areaType: "UNSPECIFIED",
          };

          if (status === "SOLD") {
            const monthOffset = Math.floor(rand() * 20); // spread bookings over ~20 months
            const date = new Date(2025, 0, 1);
            date.setMonth(date.getMonth() + monthOffset);
            unit.bookingDate = date.toISOString().slice(0, 10);
            const customerId = `${unitId}-cust`;
            unit.customerId = customerId;
            customers.push({
              id: customerId,
              name: `Customer ${customerId.slice(-6).toUpperCase()}`,
              unitId,
              bookingDate: unit.bookingDate,
            });
          }

          units.push(unit);
        }

        floors.push({ id: floorId, towerId, projectId: pDef.id, name: `Floor ${f}`, unitIds });
      }

      towers.push({ id: towerId, projectId: pDef.id, name: `Tower ${t}`, floorIds });
    }

    projects.push({ id: pDef.id, name: pDef.name, groupId: GROUP.id, towerIds });
  }

  return { groups: [GROUP], projects, towers, floors, units, customers };
}

// Built once per session — deterministic seed keeps numbers stable
// across renders/reloads so the demo is coherent.
export const MOCK_DATA = buildMockData();
