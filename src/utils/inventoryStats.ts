/**
 * Calculation layer for the real Smartworld inventory dataset.
 * Mirrors the source sales-intelligence tool's `stats()` function so
 * numbers match exactly: Total / Available / Booked / Management,
 * plus value-available and value-booked in INR.
 */
import type { InventoryUnit } from "../types/inventoryRaw";

export interface InventoryStats {
  total: number;
  available: number;
  booked: number;
  management: number;
  valueAvailable: number; // INR
  valueBooked: number; // INR
  areaAvailable: number; // sq ft, available stock only (matches source tool)
}

export function computeStats(units: InventoryUnit[]): InventoryStats {
  const available = units.filter((u) => u.status === "AVAILABLE");
  const booked = units.filter((u) => u.status === "BOOKED");
  const management = units.filter((u) => u.status === "MANAGEMENT");

  return {
    total: units.length,
    available: available.length,
    booked: booked.length,
    management: management.length,
    valueAvailable: available.reduce((sum, u) => sum + u.cost, 0),
    valueBooked: booked.reduce((sum, u) => sum + u.cost, 0),
    areaAvailable: available.reduce((sum, u) => sum + u.area, 0),
  };
}

export function percent(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : (numerator / denominator) * 100;
}

export interface ProjectAvailability {
  projectIndex: number;
  projectName: string;
  units: InventoryUnit[];
  available: number;
  booked: number;
  management: number;
  availablePercent: number;
}

/** Availability by project, sorted most-available-first — matches the
 * source tool's "Availability by project" bar list ordering. */
export function projectAvailability(units: InventoryUnit[]): ProjectAvailability[] {
  const byProject = new Map<number, InventoryUnit[]>();
  units.forEach((u) => {
    const arr = byProject.get(u.projectIndex) ?? [];
    arr.push(u);
    byProject.set(u.projectIndex, arr);
  });

  const rows: ProjectAvailability[] = Array.from(byProject.entries()).map(
    ([projectIndex, projectUnits]) => {
      const available = projectUnits.filter((u) => u.status === "AVAILABLE").length;
      const booked = projectUnits.filter((u) => u.status === "BOOKED").length;
      const management = projectUnits.filter((u) => u.status === "MANAGEMENT").length;
      return {
        projectIndex,
        projectName: projectUnits[0].projectName,
        units: projectUnits,
        available,
        booked,
        management,
        availablePercent: percent(available, projectUnits.length),
      };
    }
  );

  return rows.sort((a, b) => b.availablePercent - a.availablePercent || b.available - a.available);
}

export interface GroupBarItem {
  key: number;
  label: string;
  available: number;
  booked: number;
  management: number;
  total: number;
  availablePercent: number;
}

/** Generic grouping used for "By configuration", "Floor rise", and "By
 * size band" bar lists — groups units by an arbitrary numeric key,
 * sorted most-available-first, matching the source tool's groupBars(). */
export function groupBars(
  units: InventoryUnit[],
  keyFn: (unit: InventoryUnit) => number,
  labels: string[]
): GroupBarItem[] {
  const groups = new Map<number, InventoryUnit[]>();
  units.forEach((u) => {
    const key = keyFn(u);
    const arr = groups.get(key) ?? [];
    arr.push(u);
    groups.set(key, arr);
  });

  const items: GroupBarItem[] = Array.from(groups.entries()).map(([key, groupUnits]) => {
    const available = groupUnits.filter((u) => u.status === "AVAILABLE").length;
    const booked = groupUnits.filter((u) => u.status === "BOOKED").length;
    const management = groupUnits.length - available - booked;
    return {
      key,
      label: labels[key] ?? String(key),
      available,
      booked,
      management,
      total: groupUnits.length,
      availablePercent: percent(available, groupUnits.length),
    };
  });

  return items.sort((a, b) => b.availablePercent - a.availablePercent || b.available - a.available);
}

/** Floor band: matches source tool's floorBand() — Low (<=8), Mid (9-20), High (21+). */
export function floorBand(floorNumber: number): number {
  if (floorNumber <= 8) return 0;
  if (floorNumber <= 20) return 1;
  return 2;
}
export const FLOOR_BAND_LABELS = ["Low (up to 8)", "Mid (9–20)", "High (21+)"];

/** Size band: matches source tool's sizeBand(). */
export function sizeBand(area: number): number {
  if (area < 1000) return 0;
  if (area < 1500) return 1;
  if (area < 2200) return 2;
  return 3;
}
export const SIZE_BAND_LABELS = ["< 1,000 sq ft", "1,000–1,500", "1,500–2,200", "2,200+ sq ft"];

export interface ConfigGapCell {
  projectIndex: number;
  configIndex: number;
  total: number;
  available: number;
  ratio: number; // available / total
  band: "sold_out" | "low" | "available" | "high";
}

/** Config-gap matrix: rows = projects (availability-sorted), columns =
 * configs, cell = available units of that config in that project.
 * Bands match the source tool exactly:
 *   0 available            -> sold_out
 *   ratio < 0.15            -> low
 *   ratio > 0.60            -> high
 *   otherwise               -> available
 */
export function configGapMatrix(
  units: InventoryUnit[],
  projectOrder: number[],
  configCount: number
): ConfigGapCell[][] {
  return projectOrder.map((projectIndex) => {
    const row: ConfigGapCell[] = [];
    for (let configIndex = 0; configIndex < configCount; configIndex++) {
      const cellUnits = units.filter(
        (u) => u.projectIndex === projectIndex && u.configIndex === configIndex
      );
      if (cellUnits.length === 0) {
        row.push({
          projectIndex,
          configIndex,
          total: 0,
          available: 0,
          ratio: 0,
          band: "sold_out",
        });
        continue;
      }
      const available = cellUnits.filter((u) => u.status === "AVAILABLE").length;
      const ratio = available / cellUnits.length;
      const band: ConfigGapCell["band"] =
        available === 0 ? "sold_out" : ratio < 0.15 ? "low" : ratio > 0.6 ? "high" : "available";
      row.push({ projectIndex, configIndex, total: cellUnits.length, available, ratio, band });
    }
    return row;
  });
}

/** Gaps worth calling out: configs completely sold out within a project,
 * only surfaced when there was meaningful stock (>=5 units) to begin with. */
export function configGaps(
  units: InventoryUnit[],
  projectOrder: number[],
  configNames: string[],
  projectNames: string[]
): string[] {
  const gaps: string[] = [];
  projectOrder.forEach((projectIndex) => {
    configNames.forEach((_, configIndex) => {
      const cellUnits = units.filter(
        (u) => u.projectIndex === projectIndex && u.configIndex === configIndex
      );
      if (cellUnits.length >= 5) {
        const available = cellUnits.filter((u) => u.status === "AVAILABLE").length;
        if (available === 0) {
          gaps.push(
            `${configNames[configIndex]} sold out at ${projectNames[projectIndex].replace("Smartworld ", "")}`
          );
        }
      }
    });
  });
  return gaps;
}
