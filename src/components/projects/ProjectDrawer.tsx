import { useMemo } from "react";
import type { ProjectCardData } from "./ProjectCard";
import { fArea } from "../../utils/smartworldLogic";
import { CollapsibleCard } from "../common/CollapsibleCard";

interface RawUnit {
  projectIndex: number;
  towerIndex: number;
  floorNumber: number;
  floorLabel: string;
  configName: string;
  area: number;
  status: 0 | 1 | 2;
  unitLabel: string;
}

interface ProjectDrawerProps {
  project: ProjectCardData;
  units: RawUnit[];
  towerNames: string[];
  onClose: () => void;
}

const CELL_CLASS = ["a", "b", "k"];
const STATUS_LABEL = ["Available", "Booked", "Blocked"];

function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0;
}

export function ProjectDrawer({ project, units, towerNames, onClose }: ProjectDrawerProps) {
  const { name, total, available, booked, management, areaAvail } = project;

  const { towers, floors, cellMap, colWidth } = useMemo(() => {
    const towerSet = new Set(units.map((u) => u.towerIndex));
    const towers = [...towerSet].sort((a, b) =>
      towerNames[a].localeCompare(towerNames[b], undefined, { numeric: true })
    );

    const floorSet = new Map<number, string>(); // order -> label
    units.forEach((u) => floorSet.set(u.floorNumber, u.floorLabel));
    const floors = [...floorSet.entries()].sort((a, b) => b[0] - a[0]);

    const cm = new Map<string, RawUnit[]>();
    units.forEach((u) => {
      const key = `${u.towerIndex}|${u.floorNumber}`;
      const list = cm.get(key) ?? [];
      list.push(u);
      cm.set(key, list);
    });

    let maxInCell = 1;
    cm.forEach((list) => { if (list.length > maxInCell) maxInCell = list.length; });
    const perRow = Math.min(maxInCell, 6);
    const colWidth = Math.max(
      perRow * 15 + 10,
      ...towers.map((t) => (towerNames[t]?.length ?? 4) * 7.5 + 10)
    );

    return { towers, floors, cellMap: cm, colWidth };
  }, [units, towerNames]);

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `52px repeat(${towers.length}, ${colWidth}px)`,
    gap: 3,
    width: "max-content",
  } as const;

  return (
    <>
      <div id="ov" className="open" onClick={onClose} />
      <div id="dw" className="open">
        {/* Header */}
        <div className="dwh">
          <button className="x" onClick={onClose}>✕</button>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 18 }}>{name}</div>
          <div style={{ fontSize: 12, color: "#c7cedf", marginTop: 4 }}>
            Project detail · {total} units
          </div>
        </div>

        <div className="dwb">
          {/* Mini KPIs */}
          <div className="dkpis" style={{ marginBottom: 16 }}>
            <div className="dkpi">
              <div className="k">Available</div>
              <div className="v" style={{ color: "var(--av-text)" }}>
                {available.toLocaleString("en-IN")} <small>units</small>
              </div>
              <div style={{ fontSize: 11, color: "var(--mut)" }}>{pct(available, total)}%</div>
            </div>
            <div className="dkpi">
              <div className="k">Booked</div>
              <div className="v" style={{ color: "var(--bk)" }}>
                {booked.toLocaleString("en-IN")} <small>units</small>
              </div>
              <div style={{ fontSize: 11, color: "var(--mut)" }}>{pct(booked, total)}%</div>
            </div>
            <div className="dkpi">
              <div className="k">Total</div>
              <div className="v">{total.toLocaleString("en-IN")} <small>units</small></div>
            </div>
            <div className="dkpi">
              <div className="k">Area available</div>
              <div className="v" style={{ fontSize: 16 }}>{fArea(areaAvail)}</div>
            </div>
          </div>

          {management > 0 && (
            <div className="blkbar" style={{ marginBottom: 14 }}>
              {management} blocked unit{management !== 1 ? "s" : ""} — held back by the developer,
              not available for sale.
            </div>
          )}

          {/* Stack plan — open by default */}
          <CollapsibleCard defaultOpen
            title={<>Stack plan <span className="hint">rows = floors · columns = towers · hover for detail</span></>}
            style={{ marginTop: 4 }}
          >
            <div className="legend" style={{ marginBottom: 10 }}>
              <span><span className="sw" style={{ background: "var(--av)" }} /> Available</span>
              <span><span className="sw" style={{ background: "var(--bk)" }} /> Booked</span>
              {management > 0 && (
                <span><span className="sw" style={{ background: "var(--blk)" }} /> Blocked</span>
              )}
            </div>
            {towers.length === 0 ? (
              <p style={{ color: "var(--mut)", fontSize: 13 }}>No tower data available.</p>
            ) : (
              <div className="stack">
                <div style={{ ...gridStyle, marginBottom: 5 }}>
                  <div />
                  {towers.map((t) => (
                    <div key={t} className="sthd">{towerNames[t]}</div>
                  ))}
                </div>
                {floors.map(([floorNum, floorLabel]) => (
                  <div key={floorNum} className="strow" style={gridStyle}>
                    <div className="stf">{floorLabel.replace(/ ?floor/i, "")}</div>
                    {towers.map((t) => {
                      const cellUnits = cellMap.get(`${t}|${floorNum}`) ?? [];
                      return (
                        <div className="stcell" key={t}>
                          {cellUnits.map((u, idx) => (
                            <div key={idx} className={`ucell ${CELL_CLASS[u.status]}`}
                              title={`${u.unitLabel} · ${u.configName} · ${STATUS_LABEL[u.status]}`} />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </CollapsibleCard>

          {/* Config breakdown — collapsed */}
          <CollapsibleCard title="By configuration" style={{ marginTop: 8 }}>
            {project.configs.map((cfg) => {
              const cfgUnits = units.filter((u) => u.configName === cfg);
              const cfgAv = cfgUnits.filter((u) => u.status === 0).length;
              const cfgBk = cfgUnits.filter((u) => u.status === 1).length;
              const cfgTotal = cfgUnits.length || 1;
              return (
                <div className="barrow" key={cfg} style={{ cursor: "default" }}>
                  <div className="lbl">
                    <span className="nm">{cfg}</span>
                    <span className="r">{cfgAv} avail · {pct(cfgAv, cfgTotal)}% · {cfgTotal} total</span>
                  </div>
                  <div className="track">
                    <div className="a" style={{ width: `${(cfgAv / cfgTotal) * 100}%` }} />
                    <div className="b" style={{ width: `${(cfgBk / cfgTotal) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CollapsibleCard>

          {/* Tower breakdown — collapsed */}
          {towers.length > 1 && (
            <CollapsibleCard title="By tower" style={{ marginTop: 8 }}>
              {towers.map((t) => {
                const twUnits = units.filter((u) => u.towerIndex === t);
                const twAv = twUnits.filter((u) => u.status === 0).length;
                const twBk = twUnits.filter((u) => u.status === 1).length;
                const twBl = twUnits.filter((u) => u.status === 2).length;
                const twTotal = twUnits.length || 1;
                return (
                  <div className="barrow" key={t} style={{ cursor: "default" }}>
                    <div className="lbl">
                      <span className="nm">{towerNames[t]}</span>
                      <span className="r">{twAv} avail · {pct(twAv, twTotal)}% · {twTotal} units</span>
                    </div>
                    <div className="track">
                      <div className="a" style={{ width: `${(twAv / twTotal) * 100}%` }} />
                      <div className="b" style={{ width: `${(twBk / twTotal) * 100}%` }} />
                      <div className="k3" style={{ width: `${(twBl / twTotal) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </CollapsibleCard>
          )}
        </div>
      </div>
    </>
  );
}
