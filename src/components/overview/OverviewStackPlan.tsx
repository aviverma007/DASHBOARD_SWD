import { useMemo } from "react";
import type { Tower, Floor, Unit } from "../../types/domain";

interface OverviewStackPlanProps {
  towers: Tower[];
  floors: Floor[];
  units: Unit[];
  onUnitClick: (unit: Unit) => void;
  onTowerClick: (towerId: string) => void;
}

const STATUS_CLASS: Record<Unit["status"], string> = {
  AVAILABLE: "a",
  BOOKED: "b",
  MANAGEMENT: "k",
};

const STATUS_LABEL: Record<Unit["status"], string> = {
  AVAILABLE: "Available",
  BOOKED: "Booked",
  MANAGEMENT: "Management",
};

/**
 * Project-wide stack plan (rows = floors, columns = towers, one square
 * per unit), adapted from Inventory's SwStackPlan to Overview's domain
 * Tower/Floor/Unit types instead of raw INVR tuples. Same visual
 * language (.stack/.strow/.stf/.ucell/.sthd/.stcell classes), same
 * click-to-detail behavior.
 */
export function OverviewStackPlan({ towers, floors, units, onUnitClick, onTowerClick }: OverviewStackPlanProps) {
  const { sortedTowers, sortedFloors, cellMap, colWidth } = useMemo(() => {
    const sortedTowers = [...towers].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    // De-duplicate floors by (order, name) across towers so each real
    // floor level gets one row, even though each tower stores its own
    // Floor record.
    const floorLevels = new Map<string, { order: number; name: string }>();
    floors.forEach((f) => {
      const key = `${f.order ?? 0}|${f.name}`;
      if (!floorLevels.has(key)) floorLevels.set(key, { order: f.order ?? 0, name: f.name });
    });
    const sortedFloors = Array.from(floorLevels.values()).sort((a, b) => b.order - a.order);

    const floorIdToLevel = new Map<string, string>(); // floorId -> "order|name" key
    floors.forEach((f) => floorIdToLevel.set(f.id, `${f.order ?? 0}|${f.name}`));

    const cellMap = new Map<string, Unit[]>(); // "towerId|order|name" -> units
    units.forEach((u) => {
      const levelKey = floorIdToLevel.get(u.floorId);
      if (!levelKey) return;
      const key = `${u.towerId}|${levelKey}`;
      const list = cellMap.get(key) ?? [];
      list.push(u);
      cellMap.set(key, list);
    });

    let maxInCell = 1;
    cellMap.forEach((list) => {
      if (list.length > maxInCell) maxInCell = list.length;
    });
    const perRow = Math.min(maxInCell, 6);
    const colWidth = Math.max(perRow * 15 + 10, ...sortedTowers.map((t) => t.name.length * 7.5 + 10));

    return { sortedTowers, sortedFloors, cellMap, colWidth };
  }, [towers, floors, units]);

  if (sortedTowers.length === 0) {
    return <p style={{ color: "var(--mut)", fontSize: 13 }}>No tower data available for this project.</p>;
  }

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `52px repeat(${sortedTowers.length}, ${colWidth}px)`,
    gap: 3,
    width: "max-content",
  } as const;

  return (
    <div className="stack">
      <div style={{ ...gridStyle, marginBottom: 5 }}>
        <div />
        {sortedTowers.map((t) => (
          <div key={t.id} className="sthd" onClick={() => onTowerClick(t.id)}>
            {t.name}
          </div>
        ))}
      </div>

      {sortedFloors.map((level) => (
        <div key={`${level.order}|${level.name}`} className="strow" style={gridStyle}>
          <div className="stf">{level.name.replace(/ ?floor/i, "")}</div>
          {sortedTowers.map((t) => {
            const cellUnits = cellMap.get(`${t.id}|${level.order}|${level.name}`) ?? [];
            return (
              <div className="stcell" key={t.id}>
                {cellUnits.map((unit) => (
                  <div
                    key={unit.id}
                    className={`ucell ${STATUS_CLASS[unit.status]}`}
                    title={`${t.name} · ${level.name} · ${STATUS_LABEL[unit.status]}`}
                    onClick={() => onUnitClick(unit)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
