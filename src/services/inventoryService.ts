/**
 * Service layer for the generic Overview scaffold's inventory data.
 *
 * Components never import realOverviewData.ts or the calculation layer
 * directly — they go through this service. When a real backend exists,
 * only this file changes (swap the body for a fetch to
 * /api/dashboard/inventory); no component code should need to change.
 *
 * Reads from src/data/realOverviewData.ts, which is built from the same
 * real INVR export (REQ-007) that powers the Inventory page — this is
 * real, confirmed data as of the person's last upload, not mock data.
 * Simulated latency below stays only to exercise loading states, since
 * there's no real network round-trip yet.
 */
import { REAL_DATA } from "../data/realOverviewData";
import { computeInventoryTotals, computeProjectContributions } from "../utils/calculations";
import type { InventoryTotals } from "../utils/calculations";
import type { ProjectContribution, Unit } from "../types/domain";
import type { ProjectSelection } from "../types/filters";

// Simulated network latency so loading states are exercised even
// against locally-bundled data — remove once a real API replaces this.
const MOCK_LATENCY_MS = 250;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS));
}

function resolveProjectIds(selection: ProjectSelection): string[] {
  if (selection === "ALL") return REAL_DATA.projects.map((p) => p.id);
  return selection;
}

export async function getGroupList() {
  return delay(REAL_DATA.groups);
}

export async function getProjectList() {
  return delay(REAL_DATA.projects.map((p) => ({ id: p.id, name: p.name })));
}

export async function getInventoryTotals(selection: ProjectSelection): Promise<InventoryTotals> {
  const projectIds = resolveProjectIds(selection);
  const units = REAL_DATA.units.filter((u) => projectIds.includes(u.projectId));
  return delay(computeInventoryTotals(units));
}

export async function getProjectContributions(
  selection: ProjectSelection
): Promise<ProjectContribution[]> {
  const projectIds = resolveProjectIds(selection);
  const grouped = REAL_DATA.projects
    .filter((p) => projectIds.includes(p.id))
    .map((p) => ({
      projectId: p.id,
      projectName: p.name,
      units: REAL_DATA.units.filter((u) => u.projectId === p.id),
    }));
  return delay(computeProjectContributions(grouped));
}

export async function getTowersForProject(projectId: string) {
  const towers = REAL_DATA.towers.filter((t) => t.projectId === projectId);
  const withTotals = towers.map((t) => {
    const units = REAL_DATA.units.filter((u) => u.towerId === t.id);
    return { tower: t, totals: computeInventoryTotals(units) };
  });
  return delay(withTotals);
}

export async function getFloorsForTower(towerId: string) {
  const floors = REAL_DATA.floors.filter((f) => f.towerId === towerId);
  const withTotals = floors.map((f) => {
    const units = REAL_DATA.units.filter((u) => u.floorId === f.id);
    return { floor: f, totals: computeInventoryTotals(units) };
  });
  return delay(withTotals);
}

export async function getUnitsForFloor(floorId: string): Promise<Unit[]> {
  return delay(REAL_DATA.units.filter((u) => u.floorId === floorId));
}

export async function getUnitDetail(unitId: string) {
  const unit = REAL_DATA.units.find((u) => u.id === unitId);
  // No customer/booking data exists in this source (see realOverviewData.ts).
  return delay({ unit, customer: undefined });
}

export async function getDataFreshness() {
  return delay({
    lastRefreshed: new Date().toISOString(),
    sourceFile: "INVR-All_Project_18-8-2026.xlsx (see REQ-007)",
    uploadedBy: "Anirudh",
    reportingPeriod: "As of last INVR upload",
    validationStatus: "Validated" as const,
  });
}
