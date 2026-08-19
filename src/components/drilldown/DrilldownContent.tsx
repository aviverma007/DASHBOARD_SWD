import { useEffect, useState } from "react";
import { ChevronRight, Download } from "lucide-react";
import { useDrilldownStore } from "../../store/drilldownStore";
import { useFilterStore } from "../../store/filterStore";
import {
  getProjectContributions,
  getTowersForProject,
  getFloorsForTower,
  getUnitsForFloor,
  getUnitDetail,
} from "../../services/inventoryService";
import type { ProjectContribution, Unit, Customer } from "../../types/domain";
import type { InventoryTotals } from "../../utils/calculations";
import { formatNumber, formatArea, formatPercent } from "../../utils/format";

const KPI_LABELS = { available: "Available", booked: "Booked", total: "Total" } as const;

function extractTotalsForKpi(totals: InventoryTotals, kpi: "available" | "booked" | "total") {
  return totals[kpi];
}

export function DrilldownContent() {
  const { path, kpiContext, push } = useDrilldownStore();
  const current = path[path.length - 1];
  const [loading, setLoading] = useState(true);

  const [projectRows, setProjectRows] = useState<ProjectContribution[] | null>(null);
  const [towerRows, setTowerRows] = useState<{ tower: { id: string; name: string }; totals: InventoryTotals }[] | null>(null);
  const [floorRows, setFloorRows] = useState<{ floor: { id: string; name: string }; totals: InventoryTotals }[] | null>(null);
  const [unitRows, setUnitRows] = useState<Unit[] | null>(null);
  const [unitDetail, setUnitDetail] = useState<{ unit?: Unit; customer?: Customer } | null>(null);

  const { projects } = useFilterStore();

  useEffect(() => {
    if (!current) return;
    setLoading(true);

    if (current.level === "group") {
      getProjectContributions(projects).then((rows) => {
        setProjectRows(rows);
        setLoading(false);
      });
    } else if (current.level === "project") {
      getTowersForProject(current.id).then((rows) => {
        setTowerRows(rows as any);
        setLoading(false);
      });
    } else if (current.level === "tower") {
      getFloorsForTower(current.id).then((rows) => {
        setFloorRows(rows as any);
        setLoading(false);
      });
    } else if (current.level === "floor") {
      getUnitsForFloor(current.id).then((rows) => {
        setUnitRows(rows);
        setLoading(false);
      });
    } else if (current.level === "unit") {
      getUnitDetail(current.id).then((detail) => {
        setUnitDetail(detail);
        setLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.level, current?.id]);

  if (!current) return null;

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
    );
  }

  const kpiLabel = kpiContext ? KPI_LABELS[kpiContext] : "Total";

  // GROUP LEVEL — project-wise breakup
  if (current.level === "group" && projectRows) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-charcoal-soft">
          {kpiLabel} — Group Total &amp; Project Breakup
        </h3>
        {projectRows.map((row) => {
          const value =
            kpiContext === "available" ? row.availableUnits : kpiContext === "booked" ? row.bookedUnits : row.totalUnits;
          const area =
            kpiContext === "available" ? row.availableArea : kpiContext === "booked" ? row.bookedArea : row.totalArea;
          return (
            <button
              key={row.projectId}
              onClick={() => push({ level: "project", id: row.projectId, label: row.projectName })}
              className="flex w-full items-center justify-between rounded-lg border border-border-subtle p-3 text-left hover:border-brand-blue/40 hover:bg-surface"
            >
              <div>
                <div className="text-sm font-semibold text-charcoal">{row.projectName}</div>
                <div className="text-xs text-charcoal-soft">
                  {formatPercent(row.contributionPercent)} of group total
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="num text-right">
                  <div className="font-bold text-charcoal">{formatNumber(value)}</div>
                  <div className="text-xs text-charcoal-soft">{formatArea(area)}</div>
                </div>
                <ChevronRight size={16} className="text-charcoal-soft" />
              </div>
            </button>
          );
        })}
        <ExportRow scopeLabel="project breakup" />
      </div>
    );
  }

  // PROJECT LEVEL — tower breakup
  if (current.level === "project" && towerRows) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-charcoal-soft">{kpiLabel} — Tower Breakup</h3>
        {towerRows.map(({ tower, totals }) => {
          const kpi = extractTotalsForKpi(totals, kpiContext ?? "total");
          return (
            <button
              key={tower.id}
              onClick={() => push({ level: "tower", id: tower.id, label: tower.name })}
              className="flex w-full items-center justify-between rounded-lg border border-border-subtle p-3 text-left hover:border-brand-blue/40 hover:bg-surface"
            >
              <span className="text-sm font-semibold text-charcoal">{tower.name}</span>
              <div className="flex items-center gap-2">
                <div className="num text-right">
                  <div className="font-bold text-charcoal">{formatNumber(kpi.units)}</div>
                  <div className="text-xs text-charcoal-soft">{formatArea(kpi.area)}</div>
                </div>
                <ChevronRight size={16} className="text-charcoal-soft" />
              </div>
            </button>
          );
        })}
        <ExportRow scopeLabel="tower breakup" />
      </div>
    );
  }

  // TOWER LEVEL — floor breakup
  if (current.level === "tower" && floorRows) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-charcoal-soft">{kpiLabel} — Floor Breakup</h3>
        {floorRows.map(({ floor, totals }) => {
          const kpi = extractTotalsForKpi(totals, kpiContext ?? "total");
          return (
            <button
              key={floor.id}
              onClick={() => push({ level: "floor", id: floor.id, label: floor.name })}
              className="flex w-full items-center justify-between rounded-lg border border-border-subtle p-3 text-left hover:border-brand-blue/40 hover:bg-surface"
            >
              <span className="text-sm font-semibold text-charcoal">{floor.name}</span>
              <div className="flex items-center gap-2">
                <div className="num text-right">
                  <div className="font-bold text-charcoal">{formatNumber(kpi.units)}</div>
                  <div className="text-xs text-charcoal-soft">{formatArea(kpi.area)}</div>
                </div>
                <ChevronRight size={16} className="text-charcoal-soft" />
              </div>
            </button>
          );
        })}
        <ExportRow scopeLabel="floor breakup" />
      </div>
    );
  }

  // FLOOR LEVEL — unit list
  if (current.level === "floor" && unitRows) {
    const filtered =
      kpiContext && kpiContext !== "total" ? unitRows.filter((u) => u.status === kpiContext.toUpperCase()) : unitRows;
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-charcoal-soft">{kpiLabel} — Unit List</h3>
        {filtered.map((unit) => (
          <button
            key={unit.id}
            onClick={() => push({ level: "unit", id: unit.id, label: unit.id.split("-").pop() ?? unit.id })}
            className="flex w-full items-center justify-between rounded-lg border border-border-subtle p-3 text-left hover:border-brand-blue/40 hover:bg-surface"
          >
            <div>
              <div className="text-sm font-semibold text-charcoal">
                Unit {unit.id.split("-").pop()}
              </div>
              <StatusBadge status={unit.status} />
            </div>
            <div className="flex items-center gap-2">
              <div className="num text-right text-xs text-charcoal-soft">{formatArea(unit.area)}</div>
              <ChevronRight size={16} className="text-charcoal-soft" />
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="rounded-lg bg-surface p-4 text-center text-sm text-charcoal-soft">
            No units match this filter at this level.
          </p>
        )}
        <ExportRow scopeLabel="unit list" />
      </div>
    );
  }

  // UNIT LEVEL — detail (no customer/booking data in this source — see realOverviewData.ts)
  if (current.level === "unit") {
    if (!unitDetail?.unit) {
      return (
        <p className="rounded-lg bg-surface p-4 text-center text-sm text-charcoal-soft">
          No detail record found for this unit.
        </p>
      );
    }
    const { unit } = unitDetail;
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-charcoal-soft">Unit Detail</h3>
        <div className="rounded-lg border border-border-subtle p-3">
          <div className="text-sm font-semibold text-charcoal">Unit {unit.id.split("-").pop()}</div>
          <StatusBadge status={unit.status} />
          <dl className="mt-2 space-y-1 text-sm">
            <Row label="Area" value={formatArea(unit.area)} />
            <Row label="Area type" value={unit.areaType} />
          </dl>
        </div>
        <p className="rounded-lg bg-surface p-3 text-sm text-charcoal-soft">
          No customer or booking-date detail is available for this unit — the current data
          source doesn't include that field.
        </p>
      </div>
    );
  }

  return null;
}

function StatusBadge({ status }: { status: Unit["status"] }) {
  const styles =
    status === "AVAILABLE"
      ? "bg-teal/10 text-teal-dark"
      : status === "BOOKED"
      ? "bg-amber/10 text-amber-dark"
      : "bg-slate-200 text-charcoal-soft";
  return (
    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${styles}`}>
      {status}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-charcoal-soft">{label}</dt>
      <dd className="num font-medium text-charcoal">{value}</dd>
    </div>
  );
}

function ExportRow({ scopeLabel }: { scopeLabel: string }) {
  return (
    <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-subtle py-2.5 text-xs font-medium text-charcoal-soft hover:border-brand-blue/40 hover:text-brand-blue">
      <Download size={13} />
      Export this {scopeLabel}
    </button>
  );
}
