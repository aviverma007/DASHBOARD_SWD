/**
 * Calculation layer. Pure functions only — no React, no fetching,
 * no presentation concerns. This is the single source of truth for
 * KPI math, matching the locked-formula discipline used elsewhere
 * (e.g. Total = Sold + Unsold, never derived any other way).
 *
 * Formulas per the confirmed spec:
 *   Sold Units    = COUNT DISTINCT(unit_id) WHERE status = SOLD
 *   Unsold Units  = COUNT DISTINCT(unit_id) WHERE status = UNSOLD
 *   Total Units   = Sold Units + Unsold Units   (BLOCKED excluded — see note)
 *   Sold %        = Sold Units / Total Units * 100
 *   Unsold %      = Unsold Units / Total Units * 100
 *   Area figures mirror the unit figures using SUM(area) instead of COUNT.
 *
 * NOTE on BLOCKED units: the spec's confirmed identity is
 * Total = Sold + Unsold. BLOCKED is an assumed status (unconfirmed)
 * and is deliberately excluded from Total here rather than silently
 * folded into either bucket. This needs explicit confirmation once
 * real status values are known — see Section 14 of the blueprint.
 */
import type { Unit, KpiResult, ProjectContribution } from "../types/domain";

export interface InventoryTotals {
  sold: KpiResult;
  unsold: KpiResult;
  total: KpiResult;
  blockedUnits: number; // surfaced separately, not silently merged
}

function sumArea(units: Unit[]): number {
  return units.reduce((acc, u) => acc + u.area, 0);
}

export function computeInventoryTotals(units: Unit[], previousUnits?: Unit[]): InventoryTotals {
  const sold = units.filter((u) => u.status === "SOLD");
  const unsold = units.filter((u) => u.status === "UNSOLD");
  const blocked = units.filter((u) => u.status === "BLOCKED");

  const totalUnitCount = sold.length + unsold.length;
  const totalArea = sumArea(sold) + sumArea(unsold);

  const prevSold = previousUnits?.filter((u) => u.status === "SOLD");
  const prevUnsold = previousUnits?.filter((u) => u.status === "UNSOLD");

  const pct = (n: number, d: number) => (d === 0 ? 0 : (n / d) * 100);
  const changePct = (curr: number, prev?: number) =>
    prev === undefined || prev === 0 ? undefined : ((curr - prev) / prev) * 100;

  const soldArea = sumArea(sold);
  const unsoldArea = sumArea(unsold);

  return {
    sold: {
      label: "Sold",
      units: sold.length,
      area: soldArea,
      percentage: pct(sold.length, totalUnitCount),
      previousUnits: prevSold?.length,
      changePercent: changePct(sold.length, prevSold?.length),
    },
    unsold: {
      label: "Unsold",
      units: unsold.length,
      area: unsoldArea,
      percentage: pct(unsold.length, totalUnitCount),
      previousUnits: prevUnsold?.length,
      changePercent: changePct(unsold.length, prevUnsold?.length),
    },
    total: {
      label: "Total",
      units: totalUnitCount,
      area: totalArea,
      percentage: 100,
    },
    blockedUnits: blocked.length,
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
      soldUnits: totals.sold.units,
      unsoldUnits: totals.unsold.units,
      totalUnits: totals.total.units,
      soldArea: totals.sold.area,
      unsoldArea: totals.unsold.area,
      totalArea: totals.total.area,
      soldPercent: totals.sold.percentage,
      contributionPercent:
        groupTotals.total.units === 0 ? 0 : (totals.total.units / groupTotals.total.units) * 100,
    };
  });
}
