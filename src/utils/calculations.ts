/**
 * Calculation layer. Pure functions only — no React, no fetching,
 * no presentation concerns. This is the single source of truth for
 * KPI math on this generic Overview scaffold, matching the same
 * locked-formula discipline as the Inventory page's own logic
 * (src/utils/smartworldLogic.ts): Total = Available + Booked, always.
 *
 * Formulas:
 *   Available Units = COUNT DISTINCT(unit_id) WHERE status = AVAILABLE
 *   Booked Units     = COUNT DISTINCT(unit_id) WHERE status = BOOKED
 *   Total Units      = Available Units + Booked Units (Management excluded — see note)
 *   Available %      = Available Units / Total Units * 100
 *   Booked %         = Booked Units / Total Units * 100
 *   Area figures mirror the unit figures using SUM(area) instead of COUNT.
 *
 * NOTE on Management units: matches the Inventory page's own rule —
 * Management units are held back by the developer and are not part of
 * sellable Total. Surfaced separately, never folded into either bucket.
 */
import type { Unit, KpiResult, ProjectContribution } from "../types/domain";

export interface InventoryTotals {
  available: KpiResult;
  booked: KpiResult;
  total: KpiResult;
  managementUnits: number; // surfaced separately, not silently merged
}

function sumArea(units: Unit[]): number {
  return units.reduce((acc, u) => acc + u.area, 0);
}

export function computeInventoryTotals(units: Unit[], previousUnits?: Unit[]): InventoryTotals {
  const available = units.filter((u) => u.status === "AVAILABLE");
  const booked = units.filter((u) => u.status === "BOOKED");
  const management = units.filter((u) => u.status === "MANAGEMENT");

  const totalUnitCount = available.length + booked.length;
  const totalArea = sumArea(available) + sumArea(booked);

  const prevAvailable = previousUnits?.filter((u) => u.status === "AVAILABLE");
  const prevBooked = previousUnits?.filter((u) => u.status === "BOOKED");

  const pct = (n: number, d: number) => (d === 0 ? 0 : (n / d) * 100);
  const changePct = (curr: number, prev?: number) =>
    prev === undefined || prev === 0 ? undefined : ((curr - prev) / prev) * 100;

  const availableArea = sumArea(available);
  const bookedArea = sumArea(booked);

  return {
    available: {
      label: "Available",
      units: available.length,
      area: availableArea,
      percentage: pct(available.length, totalUnitCount),
      previousUnits: prevAvailable?.length,
      changePercent: changePct(available.length, prevAvailable?.length),
    },
    booked: {
      label: "Booked",
      units: booked.length,
      area: bookedArea,
      percentage: pct(booked.length, totalUnitCount),
      previousUnits: prevBooked?.length,
      changePercent: changePct(booked.length, prevBooked?.length),
    },
    total: {
      label: "Total",
      units: totalUnitCount,
      area: totalArea,
      percentage: 100,
    },
    managementUnits: management.length,
  };
}

export function computeProjectContributions(
  unitsByProject: { projectId: string; projectName: string; units: Unit[] }[]
): ProjectContribution[] {
  const groupTotals = computeInventoryTotals(unitsByProject.flatMap((p) => p.units));

  return unitsByProject.map(({ projectId, projectName, units }) => {
    const totals = computeInventoryTotals(units);
    return {
      projectId,
      projectName,
      availableUnits: totals.available.units,
      bookedUnits: totals.booked.units,
      totalUnits: totals.total.units,
      availableArea: totals.available.area,
      bookedArea: totals.booked.area,
      totalArea: totals.total.area,
      bookedPercent: totals.booked.percentage,
      contributionPercent:
        groupTotals.total.units === 0 ? 0 : (totals.total.units / groupTotals.total.units) * 100,
    };
  });
}
