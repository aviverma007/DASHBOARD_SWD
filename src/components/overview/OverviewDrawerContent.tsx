import { useEffect, useState } from "react";
import { useDrilldownStore } from "../../store/drilldownStore";
import { useFilterStore } from "../../store/filterStore";
import {
  getProjectContributions,
  getInventoryTotals,
  getProjectStackData,
  getUnitsForTower,
  getUnitsForFloor,
  getUnitDetail,
} from "../../services/inventoryService";
import type { ProjectContribution, Unit, Tower, Floor } from "../../types/domain";
import { computeInventoryTotals } from "../../utils/calculations";
import type { InventoryTotals } from "../../utils/calculations";
import { fArea } from "../../utils/smartworldLogic";
import { OverviewStackPlan } from "./OverviewStackPlan";

const KPI_LABELS = { available: "Available", booked: "Booked", total: "Total" } as const;

function insightLine(totals: InventoryTotals): string {
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  return [
    `${totals.available.units} of ${totals.total.units} available (${pct(totals.available.units, totals.total.units)}%)`,
    `${fArea(totals.available.area)} available`,
    `${pct(totals.booked.units, totals.total.units)}% sold`,
  ].join(" · ");
}

function DrawerKpis({ totals }: { totals: InventoryTotals }) {
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  return (
    <div className="dkpis">
      <div className="dkpi">
        <div className="k">Units</div>
        <div className="v">
          {totals.total.units.toLocaleString("en-IN")} <small>units</small>
        </div>
      </div>
      <div className="dkpi">
        <div className="k">Available</div>
        <div className="v" style={{ color: "var(--av)" }}>
          {totals.available.units} <small>units</small>
        </div>
      </div>
      <div className="dkpi">
        <div className="k">Absorption</div>
        <div className="v">{pct(totals.booked.units, totals.total.units)}%</div>
      </div>
      <div className="dkpi">
        <div className="k">Area available</div>
        <div className="v">{fArea(totals.available.area)}</div>
      </div>
    </div>
  );
}

/**
 * Redesigned to match Inventory's SwDrawer content structure: an insight
 * line, a compact dkpis grid, then contextual content per drill level —
 * project ranking at group level, tower absorption ranking + project-wide
 * stack plan at project level, floor breakdown at tower level, a unit
 * list at floor level, and a plain detail sheet at unit level. Same
 * underlying hooks/services as before (useDrilldownStore, useFilterStore,
 * inventoryService) — only the presentation layer changed.
 */
export function OverviewDrawerContent() {
  const { path, kpiContext, push } = useDrilldownStore();
  const current = path[path.length - 1];
  const [loading, setLoading] = useState(true);

  const [groupData, setGroupData] = useState<{ contributions: ProjectContribution[]; totals: InventoryTotals } | null>(
    null
  );
  const [projectData, setProjectData] = useState<{ towers: Tower[]; floors: Floor[]; units: Unit[] } | null>(null);
  const [towerData, setTowerData] = useState<{ floors: Floor[]; units: Unit[] } | null>(null);
  const [floorUnits, setFloorUnits] = useState<Unit[] | null>(null);
  const [unitDetail, setUnitDetail] = useState<{ unit?: Unit } | null>(null);

  const { projects } = useFilterStore();

  useEffect(() => {
    if (!current) return;
    setLoading(true);

    if (current.level === "group") {
      Promise.all([getProjectContributions(projects), getInventoryTotals(projects)]).then(
        ([contributions, totals]) => {
          setGroupData({ contributions, totals });
          setLoading(false);
        }
      );
    } else if (current.level === "project") {
      getProjectStackData(current.id).then((data) => {
        setProjectData(data);
        setLoading(false);
      });
    } else if (current.level === "tower") {
      getUnitsForTower(current.id).then((data) => {
        setTowerData(data);
        setLoading(false);
      });
    } else if (current.level === "floor") {
      getUnitsForFloor(current.id).then((units) => {
        setFloorUnits(units);
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
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: 56, borderRadius: 8, background: "var(--bg)" }} />
        ))}
      </div>
    );
  }

  // GROUP LEVEL
  if (current.level === "group" && groupData) {
    const { contributions, totals } = groupData;
    const sorted = [...contributions].sort(
      (a, b) => b.availableUnits / b.totalUnits - a.availableUnits / a.totalUnits
    );
    return (
      <>
        <div className="insight">{insightLine(totals)}</div>
        <DrawerKpis totals={totals} />
        {sorted.length > 1 && (
          <div className="card">
            <h3>
              By project <span className="hint">most available first · click → project</span>
            </h3>
            {sorted.map((row) => {
              const total = row.totalUnits || 1;
              const value =
                kpiContext === "available" ? row.availableUnits : kpiContext === "booked" ? row.bookedUnits : row.totalUnits;
              return (
                <div
                  className="barrow"
                  key={row.projectId}
                  onClick={() => push({ level: "project", id: row.projectId, label: row.projectName })}
                >
                  <div className="lbl">
                    <span className="nm">{row.projectName}</span>
                    <span className="r">
                      {kpiContext ? KPI_LABELS[kpiContext] : "Total"}: {value.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="track">
                    <div className="a" style={{ width: `${(row.availableUnits / total) * 100}%` }} />
                    <div className="b" style={{ width: `${(row.bookedUnits / total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  // PROJECT LEVEL — tower absorption ranking + project-wide stack plan
  if (current.level === "project" && projectData) {
    const { towers, floors, units } = projectData;
    const totals = computeInventoryTotals(units);

    const towerRows = towers
      .map((t) => {
        const towerUnits = units.filter((u) => u.towerId === t.id);
        const available = towerUnits.filter((u) => u.status === "AVAILABLE").length;
        const booked = towerUnits.filter((u) => u.status === "BOOKED").length;
        return { tower: t, total: towerUnits.length, available, booked };
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.available - a.available);

    return (
      <>
        <div className="insight">{insightLine(totals)}</div>
        <DrawerKpis totals={totals} />

        {towerRows.length > 1 && (
          <div className="card">
            <h3>
              Tower absorption ranking <span className="hint">most available first · click → tower</span>
            </h3>
            <div className="legend">
              <span>
                <span className="sw" style={{ background: "var(--av)" }} /> Available
              </span>
              <span>
                <span className="sw" style={{ background: "var(--bk)" }} /> Booked
              </span>
              <span>
                <span className="sw" style={{ background: "var(--blk)" }} /> Management
              </span>
            </div>
            {towerRows.map((row) => {
              const pctSold = row.total ? Math.round((row.booked / row.total) * 100) : 0;
              const management = row.total - row.available - row.booked;
              return (
                <div
                  className="barrow"
                  key={row.tower.id}
                  onClick={() => push({ level: "tower", id: row.tower.id, label: row.tower.name })}
                >
                  <div className="lbl">
                    <span className="nm">
                      {row.tower.name} — {row.available} left · {pctSold}% sold
                    </span>
                  </div>
                  <div className="track">
                    <div className="a" style={{ width: `${(row.available / row.total) * 100}%` }} />
                    <div className="b" style={{ width: `${(row.booked / row.total) * 100}%` }} />
                    <div className="k3" style={{ width: `${(management / row.total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="card">
          <h3>
            Stack plan <span className="hint">rows = floors · columns = towers · click a unit for detail</span>
          </h3>
          <OverviewStackPlan
            towers={towers}
            floors={floors}
            units={units}
            onUnitClick={(unit) => push({ level: "unit", id: unit.id, label: unit.id.split("-").pop() ?? unit.id })}
            onTowerClick={(towerId) => {
              const tower = towers.find((t) => t.id === towerId);
              if (tower) push({ level: "tower", id: tower.id, label: tower.name });
            }}
          />
        </div>
      </>
    );
  }

  // TOWER LEVEL — floor breakdown
  if (current.level === "tower" && towerData) {
    const { floors, units } = towerData;
    const totals = computeInventoryTotals(units);
    const floorRows = floors
      .map((f) => {
        const floorUnitsList = units.filter((u) => u.floorId === f.id);
        const available = floorUnitsList.filter((u) => u.status === "AVAILABLE").length;
        const booked = floorUnitsList.filter((u) => u.status === "BOOKED").length;
        return { floor: f, total: floorUnitsList.length, available, booked };
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => (b.floor.order ?? 0) - (a.floor.order ?? 0));

    return (
      <>
        <div className="insight">{insightLine(totals)}</div>
        <DrawerKpis totals={totals} />
        <div className="card">
          <h3>
            Floors in this tower <span className="hint">click → floor</span>
          </h3>
          {floorRows.map((row) => (
            <div
              className="barrow"
              key={row.floor.id}
              onClick={() => push({ level: "floor", id: row.floor.id, label: row.floor.name })}
            >
              <div className="lbl">
                <span className="nm">{row.floor.name}</span>
                <span className="r">
                  {row.available} avail · {row.total} units
                </span>
              </div>
              <div className="track">
                <div className="a" style={{ width: `${(row.available / row.total) * 100}%` }} />
                <div className="b" style={{ width: `${(row.booked / row.total) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  // FLOOR LEVEL — unit list
  if (current.level === "floor" && floorUnits) {
    return (
      <div className="card">
        <h3>
          Units on this floor <span className="hint">click a unit → detail</span>
        </h3>
        <table>
          <thead>
            <tr>
              <th>Unit</th>
              <th className="n">Area</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {floorUnits.map((unit) => (
              <tr key={unit.id} onClick={() => push({ level: "unit", id: unit.id, label: unit.id.split("-").pop() ?? unit.id })}>
                <td>Unit {unit.id.split("-").pop()}</td>
                <td className="n">{unit.area.toLocaleString("en-IN")} sq ft</td>
                <td>
                  <span
                    className="pill"
                    style={{
                      background:
                        unit.status === "AVAILABLE" ? "#e2f3ec" : unit.status === "BOOKED" ? "#eee9df" : "#f7ead9",
                      color: unit.status === "AVAILABLE" ? "#0f6e56" : unit.status === "BOOKED" ? "#6b6b6b" : "#8a531b",
                    }}
                  >
                    {unit.status === "AVAILABLE" ? "Available" : unit.status === "BOOKED" ? "Booked" : "Management"}
                  </span>
                </td>
              </tr>
            ))}
            {floorUnits.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", color: "var(--mut)" }}>
                  No units on this floor.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // UNIT LEVEL — detail sheet (no cost/rate/payment/customer data — see REQ-008)
  if (current.level === "unit") {
    if (!unitDetail?.unit) {
      return <p style={{ color: "var(--mut)", fontSize: 13 }}>No detail record found for this unit.</p>;
    }
    const { unit } = unitDetail;
    return (
      <div className="card">
        <span
          className="pill"
          style={{
            background: unit.status === "AVAILABLE" ? "#e2f3ec" : unit.status === "BOOKED" ? "#eee9df" : "#f7ead9",
            color: unit.status === "AVAILABLE" ? "#0f6e56" : unit.status === "BOOKED" ? "#6b6b6b" : "#8a531b",
          }}
        >
          {unit.status === "AVAILABLE" ? "Available" : unit.status === "BOOKED" ? "Booked" : "Management"}
        </span>
        <div className="kv">
          <div className="k">Unit</div>
          <div>Unit {unit.id.split("-").pop()}</div>
          <div className="k">Total super area</div>
          <div>{unit.area.toLocaleString("en-IN")} sq ft</div>
        </div>
        <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--mut)" }}>
          No customer or booking-date detail is available for this unit — the current data source
          doesn't include that field.
        </p>
      </div>
    );
  }

  return null;
}
