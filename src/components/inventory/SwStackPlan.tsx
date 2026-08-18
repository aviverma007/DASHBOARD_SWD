import { useMemo } from "react";
import type { RawUnit } from "../../types/smartworldRaw";
import { ordinal } from "../../utils/smartworldLogic";
import { SwLegend } from "./swPieces";

interface SwStackPlanProps {
  arr: RawUnit[];
  TW: string[];
  FL: string[];
  CFG: string[];
  STL: string[];
  onUnitClick: (unit: RawUnit) => void;
  onTowerClick: (towerIndex: number) => void;
}

/** Direct port of stackPlan(arr) — rows = floors, columns = towers, one square per unit. */
export function SwStackPlan({ arr, TW, FL, CFG, STL, onUnitClick, onTowerClick }: SwStackPlanProps) {
  const { tws, floors, cm, colw } = useMemo(() => {
    const towerSet = new Set(arr.map((u) => u[1]));
    const tws = [...towerSet]
      .filter((t) => TW[t] !== "")
      .sort((a, b) => TW[a].localeCompare(TW[b], undefined, { numeric: true }));

    const floors = [...new Set(arr.map((u) => u[2]))].sort((a, b) => b - a);

    const cm = new Map<string, RawUnit[]>();
    arr.forEach((u) => {
      if (TW[u[1]] === "") return;
      const key = `${u[1]}|${u[2]}`;
      const list = cm.get(key) ?? [];
      list.push(u);
      cm.set(key, list);
    });

    let maxU = 1;
    cm.forEach((list) => {
      if (list.length > maxU) maxU = list.length;
    });
    const perRow = Math.min(maxU, 6);
    const colw = Math.round(Math.max(perRow * 15 + 10, ...tws.map((t) => TW[t].length * 7.5 + 10)));

    return { tws, floors, cm, colw };
  }, [arr, TW]);

  if (!tws.length) return null;

  const flab = (f: number): string => {
    const fu = arr.find((u) => u[2] === f);
    return fu ? FL[fu[3]].replace(/ ?floor/i, "") : ordinal(f);
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `48px repeat(${tws.length}, ${colw}px)`,
    gap: 3,
    width: "max-content",
  } as const;

  return (
    <div className="card">
      <h3>
        Stack plan{" "}
        <span className="hint">rows = floors · columns = towers · each square = a unit · click for detail</span>
      </h3>
      <SwLegend />
      <div className="stack">
        <div style={{ ...gridStyle, marginBottom: 5 }}>
          <div />
          {tws.map((t) => (
            <div className="sthd" key={t} onClick={() => onTowerClick(t)}>
              {TW[t]}
            </div>
          ))}
        </div>
        {floors.map((f) => (
          <div className="strow" style={gridStyle} key={f}>
            <div className="stf">{flab(f)}</div>
            {tws.map((t) => {
              const us = cm.get(`${t}|${f}`) ?? [];
              return (
                <div className="stcell" key={t}>
                  {us.map((u) => {
                    const idxLabel = u[8] === 0 ? "a" : u[8] === 1 ? "b" : "k";
                    return (
                      <div
                        key={u[12]}
                        className={`ucell ${idxLabel}`}
                        title={`${TW[u[1]]} · ${flab(u[2])} · ${CFG[u[4]]} · ${STL[u[8]]}`}
                        onClick={() => onUnitClick(u)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
