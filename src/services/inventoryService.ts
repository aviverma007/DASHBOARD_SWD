/**
 * Service layer for inventory data.
 *
 * Components must never import mockData or the calculation layer
 * directly — they go through this service. When a real backend
 * exists, only this file changes (swap the body for a fetch to
 * /api/dashboard/inventory); no component code should need to change.
 *
 * MOCKED: every function below reads from src/data/mockData.ts.
 * This is explicitly a demo/mock data path, not a production one.
 */
import { MOCK_DATA } from "../data/mockData";
import { computeInventoryTotals, computeProjectContributions } from "../utils/calculations";
import type { InventoryTotals } from "../utils/calculations";
import type { ProjectContribution, Unit } from "../types/domain";
import type { ProjectSelection } from "../types/filters";

// Simulated network latency so loading states are exercised even
// against mock data — remove once a real API replaces this.
const MOCK_LATENCY_MS = 250;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS));
}

function resolveProjectIds(selection: ProjectSelection): string[] {
  if (selection === "ALL") return MOCK_DATA.projects.map((p) => p.id);
  return selection;
}

export async function getGroupList() {
  return delay(MOCK_DATA.groups);
}

export async function getProjectList() {
  return delay(MOCK_DATA.projects.map((p) => ({ id: p.id, name: p.name })));
}

export async function getInventoryTotals(selection: ProjectSelection): Promise<InventoryTotals> {
  const projectIds = resolveProjectIds(selection);
  const units = MOCK_DATA.units.filter((u) => projectIds.includes(u.projectId));
  return delay(computeInventoryTotals(units));
}

export async function getProjectContributions(
  selection: ProjectSelection
): Promise<ProjectContribution[]> {
  const projectIds = resolveProjectIds(selection);
  const grouped = MOCK_DATA.projects
    .filter((p) => projectIds.includes(p.id))
    .map((p) => ({
      projectId: p.id,
      projectName: p.name,
      units: MOCK_DATA.units.filter((u) => u.projectId === p.id),
    }));
  return delay(computeProjectContributions(grouped));
}

export async function getTowersForProject(projectId: string) {
  const towers = MOCK_DATA.towers.filter((t) => t.projectId === projectId);
  const withTotals = towers.map((t) => {
    const units = MOCK_DATA.units.filter((u) => u.towerId === t.id);
    return { tower: t, totals: computeInventoryTotals(units) };
  });
  return delay(withTotals);
}

export async function getFloorsForTower(towerId: string) {
  const floors = MOCK_DATA.floors.filter((f) => f.towerId === towerId);
  const withTotals = floors.map((f) => {
    const units = MOCK_DATA.units.filter((u) => u.floorId === f.id);
    return { floor: f, totals: computeInventoryTotals(units) };
  });
  return delay(withTotals);
}

export async function getUnitsForFloor(floorId: string): Promise<Unit[]> {
  return delay(MOCK_DATA.units.filter((u) => u.floorId === floorId));
}

export async function getUnitDetail(unitId: string) {
  const unit = MOCK_DATA.units.find((u) => u.id === unitId);
  const customer = unit?.customerId
    ? MOCK_DATA.customers.find((c) => c.id === unit.customerId)
    : undefined;
  return delay({ unit, customer });
}

export async function getDataFreshness() {
  return delay({
    lastRefreshed: new Date().toISOString(),
    sourceFile: "MOCK_DATA (demo — not a real SAP export)",
    uploadedBy: "System (demo)",
    reportingPeriod: "FY2026-27",
    validationStatus: "Pending" as const,
  });
}
