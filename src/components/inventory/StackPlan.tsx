import { useMemo } from "react";
import type { InventoryUnit } from "../../types/inventoryRaw";

interface StackPlanProps {
  units: InventoryUnit[];
  onUnitClick?: (unit: InventoryUnit) => void;
  onTowerClick?: (towerIndex: number) => void;
}

const STATUS_CLASS: Record<InventoryUnit["status"], string> = {
  AVAILABLE: "bg-inv-available",
  BOOKED: "bg-inv-booked",
  MANAGEMENT: "bg-inv-mgmt",
};

const STATUS_LABEL: Record<InventoryUnit["status"], string> = {
  AVAILABLE: "Available",
  BOOKED: "Booked",
  MANAGEMENT: "Management unit",
};

export function StackPlan({ units, onUnitClick, onTowerClick }: StackPlanProps) {
  const { towers, floors, cellMap, floorLabel } = useMemo(() => {
    const towerIndices = [...new Set(units.map((u) => u.towerIndex))]
      .filter((t) => units.find((u) => u.towerIndex === t)?.towerName !== "")
      .sort((a, b) => {
        const nameA = units.find((u) => u.towerIndex === a)?.towerName ?? "";
        const nameB = units.find((u) => u.towerIndex === b)?.towerName ?? "";
        return nameA.localeCompare(nameB, undefined, { numeric: true });
      });

    const floorNumbers = [...new Set(units.map((u) => u.floorNumber))].sort((a, b) => b - a);

    const map = new Map<string, InventoryUnit[]>();
    units.forEach((u) => {
      if (u.towerName === "") return;
      const key = `${u.towerIndex}|${u.floorNumber}`;
      const arr = map.get(key) ?? [];
      arr.push(u);
      map.set(key, arr);
    });

    const labelFor = (floorNum: number) => {
      const unit = units.find((u) => u.floorNumber === floorNum);
      return unit ? unit.floorLabel.replace(/ ?floor/i, "") : `${floorNum}`;
    };

    return { towers: towerIndices, floors: floorNumbers, cellMap: map, floorLabel: labelFor };
  }, [units]);

  if (towers.length === 0) {
    return <p className="text-sm text-inv-mut">No tower data available for this selection.</p>;
  }

  const towerNames = towers.map((t) => units.find((u) => u.towerIndex === t)?.towerName ?? "");
  const maxUnitsInCell = Math.max(
    1,
    ...Array.from(cellMap.values()).map((arr) => arr.length)
  );
  const perRow = Math.min(maxUnitsInCell, 6);
  const colWidth = Math.max(
    perRow * 15 + 10,
    ...towerNames.map((name) => name.length * 7.5 + 10)
  );

  return (
    <div>
      <Legend />
      <div className="max-h-[520px] overflow-auto rounded-lg border border-inv-line bg-white p-2.5">
        <div
          className="mb-1.5"
          style={{
            display: "grid",
            gridTemplateColumns: `48px repeat(${towers.length}, ${colWidth}px)`,
            gap: 3,
            width: "max-content",
          }}
        >
          <div />
          {towers.map((t, i) => (
            <div
              key={t}
              onClick={() => onTowerClick?.(t)}
              className="cursor-pointer whitespace-nowrap rounded-md px-1 py-0.5 text-center text-[11.5px] font-medium text-inv-ink hover:bg-inv-bg hover:text-inv-gold"
            >
              {towerNames[i]}
            </div>
          ))}
        </div>

        {floors.map((floorNum) => (
          <div
            key={floorNum}
            className="rounded hover:bg-[#faf8f1]"
            style={{
              display: "grid",
              gridTemplateColumns: `48px repeat(${towers.length}, ${colWidth}px)`,
              gap: 3,
              width: "max-content",
              marginBottom: 3,
              alignItems: "center",
            }}
          >
            <div
              className="self-center pr-1.5 text-right text-[10.5px] text-inv-mut"
              style={{ fontFamily: "var(--font-serif-display)" }}
            >
              {floorLabel(floorNum)}
            </div>
            {towers.map((t) => {
              const cellUnits = cellMap.get(`${t}|${floorNum}`) ?? [];
              return (
                <div
                  key={t}
                  className="flex min-h-[17px] flex-wrap content-center justify-center gap-0.5 border-l border-[#f1eee5] px-1 py-0.5"
                >
                  {cellUnits.map((unit) => (
                    <div
                      key={unit.index}
                      onClick={() => onUnitClick?.(unit)}
                      title={`${unit.towerName} · ${floorLabel(unit.floorNumber)} · ${unit.configName} · ${STATUS_LABEL[unit.status]}`}
                      className={`h-[13px] w-[13px] cursor-pointer rounded-[3px] hover:outline hover:outline-2 hover:outline-offset-1 hover:outline-inv-gold ${STATUS_CLASS[unit.status]}`}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-inv-mut">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-inv-available" /> Available
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-inv-booked" /> Booked
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-inv-mgmt" /> Mgmt
      </span>
    </div>
  );
}
