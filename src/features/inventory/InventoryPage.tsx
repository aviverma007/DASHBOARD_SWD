import { useMemo, useState } from "react";
import {
  INVENTORY_UNITS,
  PROJECT_NAMES,
  CONFIG_NAMES,
} from "../../data/inventoryLoader";
import type { InventoryUnit } from "../../types/inventoryRaw";
import {
  computeStats,
  percent,
  projectAvailability,
  configGapMatrix,
  configGaps,
  groupBars,
  floorBand,
  sizeBand,
  FLOOR_BAND_LABELS,
  SIZE_BAND_LABELS,
} from "../../utils/inventoryStats";
import { formatCrore } from "../../utils/format";
import { InvFilterBar } from "../../components/inventory/InvFilterBar";
import { InvKpiCard, InvCard } from "../../components/inventory/InvKpiCard";
import { InvDonut } from "../../components/inventory/InvDonut";
import { AvailabilityBarRow, ValueBarRow } from "../../components/inventory/BarRows";
import { ConfigGapMatrix } from "../../components/inventory/ConfigGapMatrix";
import { GroupBarList } from "../../components/inventory/GroupBarList";
import { StackPlan } from "../../components/inventory/StackPlan";
import { UnitRecordTable } from "../../components/inventory/UnitRecordTable";
import { UnitDetailDrawer } from "../../components/inventory/UnitDetailDrawer";
import { ManagementBreakdown } from "../../components/inventory/ManagementBreakdown";

type StatusFilter = "all" | "available" | "booked" | "management";
type CategoryFilter = "all" | "residential" | "commercial";

const STATUS_TO_ENUM: Record<Exclude<StatusFilter, "all">, InventoryUnit["status"]> = {
  available: "AVAILABLE",
  booked: "BOOKED",
  management: "MANAGEMENT",
};

export function InventoryPage() {
  const [selectedProjects, setSelectedProjects] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedUnit, setSelectedUnit] = useState<InventoryUnit | null>(null);
  const [managementView, setManagementView] = useState(false);

  function toggleProject(index: number) {
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const baseUnits = useMemo(() => {
    return INVENTORY_UNITS.filter((u) => {
      if (selectedProjects.size && !selectedProjects.has(u.projectIndex)) return false;
      if (status !== "all" && u.status !== STATUS_TO_ENUM[status]) return false;
      if (category === "residential" && u.isCommercial) return false;
      if (category === "commercial" && !u.isCommercial) return false;
      return true;
    });
  }, [selectedProjects, status, category]);

  const stats = useMemo(() => computeStats(baseUnits), [baseUnits]);
  const availabilityRows = useMemo(() => projectAvailability(baseUnits), [baseUnits]);
  const projectOrder = useMemo(() => availabilityRows.map((r) => r.projectIndex), [availabilityRows]);

  const unsoldValueRows = useMemo(() => {
    const rows = availabilityRows.map((row) => ({
      projectIndex: row.projectIndex,
      projectName: row.projectName,
      value: row.units.filter((u) => u.status === "AVAILABLE").reduce((sum, u) => sum + u.cost, 0),
    }));
    return rows.sort((a, b) => b.value - a.value);
  }, [availabilityRows]);
  const maxUnsoldValue = Math.max(1, ...unsoldValueRows.map((r) => r.value));

  const gapMatrix = useMemo(
    () => configGapMatrix(baseUnits, projectOrder, CONFIG_NAMES.length),
    [baseUnits, projectOrder]
  );
  const gaps = useMemo(
    () => configGaps(baseUnits, projectOrder, CONFIG_NAMES, PROJECT_NAMES),
    [baseUnits, projectOrder]
  );

  const configBars = useMemo(
    () => groupBars(baseUnits, (u) => u.configIndex, CONFIG_NAMES),
    [baseUnits]
  );
  const floorRiseBars = useMemo(
    () => groupBars(baseUnits, (u) => floorBand(u.floorNumber), FLOOR_BAND_LABELS),
    [baseUnits]
  );
  const sizeBandBars = useMemo(
    () => groupBars(baseUnits, (u) => sizeBand(u.area), SIZE_BAND_LABELS),
    [baseUnits]
  );

  const statusSegments = [
    { label: "Available", value: stats.available, color: "var(--color-inv-available)" },
    { label: "Booked", value: stats.booked, color: "var(--color-inv-booked)" },
    { label: "Management unit", value: stats.management, color: "var(--color-inv-mgmt)" },
  ].filter((s) => s.value > 0);

  const categorySegments = [
    {
      label: "Residential",
      value: baseUnits.filter((u) => !u.isCommercial).length,
      color: "var(--color-teal)",
    },
    {
      label: "Commercial",
      value: baseUnits.filter((u) => u.isCommercial).length,
      color: "var(--color-inv-clay)",
    },
  ].filter((s) => s.value > 0);

  return (
    <div className="-m-4 -mt-4 md:-m-6 md:-mt-6" style={{ background: "var(--color-inv-bg)" }}>
      <InvFilterBar
        projectNames={PROJECT_NAMES}
        selectedProjects={selectedProjects}
        onToggleProject={toggleProject}
        onSelectAllProjects={() => setSelectedProjects(new Set())}
        status={status}
        onStatusChange={setStatus}
        category={category}
        onCategoryChange={setCategory}
      />

      <div className="mx-auto max-w-[1200px] px-4 py-4.5 pb-16 md:px-5.5">
        <div className="mb-3.5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          <InvKpiCard
            label="Total units"
            value={stats.total.toLocaleString("en-IN")}
            unit="units"
            sub="all inventory"
            accentIndex={0}
            onClick={() => {
              setStatus("all");
              setManagementView(false);
            }}
          />
          <InvKpiCard
            label="Available"
            value={stats.available.toLocaleString("en-IN")}
            unit="units"
            sub={`${percent(stats.available, stats.total).toFixed(0)}% of stock`}
            accentIndex={1}
            onClick={() => {
              setStatus("available");
              setManagementView(false);
            }}
          />
          <InvKpiCard
            label="Booked · absorption"
            value={stats.booked.toLocaleString("en-IN")}
            unit="units"
            sub={`${percent(stats.booked, stats.total).toFixed(0)}% absorbed`}
            accentIndex={2}
            onClick={() => {
              setStatus("booked");
              setManagementView(false);
            }}
          />
          <InvKpiCard
            label="Management units"
            value={stats.management.toLocaleString("en-IN")}
            unit="units"
            sub="not for sale"
            accentIndex={3}
            onClick={() => {
              setStatus("management");
              setManagementView(true);
            }}
          />
          <InvKpiCard
            label="Value available"
            value={formatCrore(stats.valueAvailable)}
            sub="available stock"
            accentIndex={4}
            onClick={() => setStatus("available")}
          />
          <InvKpiCard
            label="Value booked"
            value={formatCrore(stats.valueBooked)}
            sub="sold stock"
            accentIndex={5}
            onClick={() => setStatus("booked")}
          />
        </div>

        {managementView && stats.management > 0 && (
          <div className="mb-3.5">
            <ManagementBreakdown units={baseUnits} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <InvCard title="Stock status" hint="click a slice → drill">
            <InvDonut
              segments={statusSegments.map((s) => ({
                ...s,
                onClick:
                  s.label === "Available"
                    ? () => setStatus("available")
                    : s.label === "Booked"
                    ? () => setStatus("booked")
                    : () => {
                        setStatus("management");
                        setManagementView(true);
                      },
              }))}
            />
          </InvCard>
          <InvCard title="By category" hint="click a slice → drill">
            <InvDonut
              segments={categorySegments.map((s) => ({
                ...s,
                onClick: s.label === "Residential" ? () => setCategory("residential") : () => setCategory("commercial"),
              }))}
            />
          </InvCard>
        </div>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <InvCard title="Availability by project" hint="most available first · click → project">
            {availabilityRows.map((row) => (
              <AvailabilityBarRow
                key={row.projectIndex}
                name={row.projectName}
                available={row.available}
                booked={row.booked}
                management={row.management}
                onClick={() => setSelectedProjects(new Set([row.projectIndex]))}
              />
            ))}
          </InvCard>
          <InvCard title="Unsold value by project" hint="₹ available · click → project">
            {unsoldValueRows.map((row) => (
              <ValueBarRow
                key={row.projectIndex}
                name={row.projectName}
                value={formatCrore(row.value)}
                widthPercent={(row.value / maxUnsoldValue) * 100}
                onClick={() => setSelectedProjects(new Set([row.projectIndex]))}
              />
            ))}
          </InvCard>
        </div>

        <InvCard title="Config gap analysis" hint="available units by project × config · click a cell">
          <ConfigGapMatrix
            matrix={gapMatrix}
            projectOrder={projectOrder}
            projectNames={PROJECT_NAMES}
            configNames={CONFIG_NAMES}
            gaps={gaps}
            onCellClick={(projectIndex) => setSelectedProjects(new Set([projectIndex]))}
          />
        </InvCard>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <InvCard title="By configuration" hint="click → config">
            <GroupBarList items={configBars} />
          </InvCard>
          <InvCard title="Floor rise" hint="click → band">
            <GroupBarList items={floorRiseBars} />
          </InvCard>
          <InvCard title="By size band" hint="click → band">
            <GroupBarList items={sizeBandBars} />
          </InvCard>
        </div>

        <InvCard title="Stack plan" hint="rows = floors · columns = towers · each square = a unit · click for detail">
          <StackPlan units={baseUnits} onUnitClick={setSelectedUnit} />
        </InvCard>

        <InvCard title="Unit records" hint="search project, tower, config, floor…">
          <UnitRecordTable units={baseUnits} onRowClick={setSelectedUnit} />
        </InvCard>
      </div>

      <UnitDetailDrawer unit={selectedUnit} onClose={() => setSelectedUnit(null)} />
    </div>
  );
}
