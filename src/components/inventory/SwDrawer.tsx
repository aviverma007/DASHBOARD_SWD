import type { RawInventoryDataset, RawUnit, ScopeCondition } from "../../types/smartworldRaw";
import {
  fArea,
  pct,
  stats,
  scopedUnits,
  showTower,
  groupByKey,
  statusBarsData,
  floorBand,
  sizeBand,
  ordinal,
  FB,
  SB,
  BLL,
  STL,
} from "../../utils/smartworldLogic";
import { SwDonut, SwBar3, SwLegend, SwStatusPill } from "./swPieces";
import { SwGroupBars, SwStatusBars } from "./SwGroupBars";
import { SwStackPlan } from "./SwStackPlan";
import { SwRecordsCard } from "./SwRecordsCard";

interface SwDrawerProps {
  RD: RawInventoryDataset;
  base: RawUnit[]; // baseUnits() result
  scope: ScopeCondition[];
  catOf: (u: RawUnit) => number;
  onClose: () => void;
  onCrumbClick: (index: number) => void;
  onPushScope: (cond: ScopeCondition) => void;
  onUnitClick: (unit: RawUnit) => void;
}

/** crumbHTML() — breadcrumb chip trail. */
function Crumbs({ scope, onCrumbClick }: { scope: ScopeCondition[]; onCrumbClick: (i: number) => void }) {
  return (
    <div className="crumbs">
      {scope.map((c, i) => (
        <button key={i} className="crumb" onClick={() => onCrumbClick(i)}>
          {c.label}
          <span className="c">✕</span>
        </button>
      ))}
    </div>
  );
}

/** insightLine(arr,s,hp,ht) — the one-line insight summary at the top of the drawer. */
function insightLine(
  RD: RawInventoryDataset,
  arr: RawUnit[],
  s: ReturnType<typeof stats>,
  hp: ScopeCondition | undefined,
  ht: ScopeCondition | undefined
): string {
  const parts = [`${s.av} of ${s.t} available (${pct(s.av, s.t)}%)`, `${fArea(s.areaAv)} available`, `${pct(s.bk, s.t)}% sold`];

  if (hp && !ht) {
    if (showTower(hp.v, arr, RD.TW)) {
      const tws = [...new Set(arr.map((u) => u[1]))]
        .filter((t) => RD.TW[t] !== "")
        .map((t) => {
          const us = arr.filter((u) => u[1] === t);
          return { t, r: pct(us.filter((u) => u[8] === 1).length, us.length), av: us.filter((u) => u[8] === 0).length };
        });
      const sold = tws.slice().sort((a, b) => b.r - a.r)[0];
      const deep = tws.slice().sort((a, b) => b.av - a.av)[0];
      if (sold) parts.push(`${RD.TW[sold.t]} ${sold.r >= 95 ? "cleared" : "most sold"}`);
      if (deep && deep.av > 0) parts.push(`${RD.TW[deep.t]} deepest stock`);
    }
    RD.CFG.forEach((n, b) => {
      const us = arr.filter((u) => u[4] === b);
      if (us.length >= 5) {
        const av = us.filter((u) => u[8] === 0).length;
        if (av === 0) parts.push(`${n} sold out`);
      }
    });
  }

  return parts.join(" · ") + ".";
}

/** blockedLine(s) — management-units summary sentence. */
function blockedLine(s: ReturnType<typeof stats>): string {
  if (!s.bl) return "";
  return `Management units: ${s.bl} — held back by the developer, not available for sale`;
}

/** Direct port of renderDrawer() — right-side sliding panel with breadcrumbs,
 * insight line, drawer KPIs, stock-status donut, and contextual drill content
 * depending on scope depth (project → tower → floor). */
export function SwDrawer({ RD, base, scope, catOf, onClose, onCrumbClick, onPushScope, onUnitClick }: SwDrawerProps) {
  const { P, TW, FL, CFG, UT } = RD;
  const arr = scopedUnits(base, scope, catOf);
  const s = stats(arr);
  const hp = scope.find((c) => c.k === "p");
  const ht = scope.find((c) => c.k === "tw");
  const hf = scope.find((c) => c.k === "fl");
  const hst = scope.find((c) => c.k === "st");
  const scopeTitle = scope.length ? scope[scope.length - 1].label : "All inventory";

  const dseg = [
    { label: "Available", value: s.av, color: "var(--av)" },
    { label: "Booked", value: s.bk, color: "var(--bk)" },
    { label: "Management unit", value: s.bl, color: "var(--blk)" },
  ].filter((x) => x.value > 0);

  return (
    <>
      <div id="ov" className="open" onClick={onClose} />
      <div id="dw" className="open">
        <div id="dwhead">
          <div className="dwh">
            <button className="x" onClick={onClose}>
              ✕
            </button>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 19 }}>{scopeTitle}</div>
            <Crumbs scope={scope} onCrumbClick={onCrumbClick} />
          </div>
        </div>
        <div className="dwb" id="dwbody">
          <div className="insight">{insightLine(RD, arr, s, hp, ht)}</div>

          <div className="dkpis">
            <div className="dkpi">
              <div className="k">Units</div>
              <div className="v">
                {s.t.toLocaleString("en-IN")} <small>units</small>
              </div>
            </div>
            <div className="dkpi">
              <div className="k">Available</div>
              <div className="v" style={{ color: "#0f6e56" }}>
                {s.av} <small>units</small>
              </div>
            </div>
            <div className="dkpi">
              <div className="k">Absorption</div>
              <div className="v">{pct(s.bk, s.t)}%</div>
            </div>
            <div className="dkpi">
              <div className="k">Area available</div>
              <div className="v">{fArea(s.areaAv)}</div>
            </div>
          </div>

          {s.bl > 0 && <div className="blkbar" style={{ marginBottom: 14 }}>{blockedLine(s)}</div>}

          {dseg.length > 1 && (
            <div className="card">
              <h3>Stock status</h3>
              <div className="donut-wrap">
                <SwDonut segs={dseg} />
                <div className="dlg">
                  {dseg.map((seg) => (
                    <div className="li" key={seg.label}>
                      <span className="sw" style={{ background: seg.color }} />
                      {seg.label}
                      <b>{seg.value.toLocaleString("en-IN")}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {hp && !ht && !hf && (
            <ProjectDrillContent RD={RD} arr={arr} projectIndex={hp.v} onPushScope={onPushScope} onUnitClick={onUnitClick} />
          )}

          {ht && !hf && (
            <TowerDrillContent RD={RD} arr={arr} onPushScope={onPushScope} />
          )}

          {!hp && !ht && !hf && (
            <GroupDrillContent
              RD={RD}
              arr={arr}
              hst={hst}
              onPushScope={onPushScope}
            />
          )}

          <SwRecordsCard arr={arr} P={P} TW={TW} FL={FL} CFG={CFG} UT={UT} onRowClick={onUnitClick} />
        </div>
      </div>
    </>
  );
}

/** Drawer content when scope narrows to a single project (hp && !ht && !hf). */
function ProjectDrillContent({
  RD,
  arr,
  projectIndex,
  onPushScope,
  onUnitClick,
}: {
  RD: RawInventoryDataset;
  arr: RawUnit[];
  projectIndex: number;
  onPushScope: (c: ScopeCondition) => void;
  onUnitClick: (u: RawUnit) => void;
}) {
  const { TW, CFG } = RD;
  const canShowTower = showTower(projectIndex, arr, TW);

  const towerRows = canShowTower
    ? [...new Set(arr.map((u) => u[1]))]
        .filter((t) => TW[t] !== "" && TW[t] !== "No tower")
        .map((t) => {
          const us = arr.filter((u) => u[1] === t);
          return { t, us, av: us.filter((u) => u[8] === 0).length, bk: us.filter((u) => u[8] === 1).length };
        })
        .sort((a, b) => b.av - a.av)
    : [];

  const cfgBars = groupByKey(arr, (u) => u[4]);
  const fbBars = groupByKey(arr, (u) => floorBand(u[2]));
  const sbBars = groupByKey(arr, (u) => sizeBand(u[6]));

  return (
    <>
      {canShowTower && (
        <>
          <div className="card">
            <h3>
              Tower absorption ranking <span className="hint">most available first · click → tower</span>
            </h3>
            <SwLegend />
            {towerRows.map((x) => (
              <div className="barrow" key={x.t} onClick={() => onPushScope({ k: "tw", v: x.t, label: TW[x.t] })}>
                <div className="lbl">
                  <span className="nm">
                    {TW[x.t]} — {x.av} left · {pct(x.bk, x.us.length)}% sold
                  </span>
                </div>
                <SwBar3 av={x.av} bk={x.bk} bl={x.us.length - x.av - x.bk} />
              </div>
            ))}
          </div>
          <SwStackPlan
            arr={arr}
            TW={TW}
            FL={RD.FL}
            CFG={CFG}
            STL={STL}
            onUnitClick={onUnitClick}
            onTowerClick={(tw) => onPushScope({ k: "tw", v: tw, label: TW[tw] })}
          />
        </>
      )}
      <div className="grid g2">
        <div className="card">
          <h3>By configuration</h3>
          <SwGroupBars items={cfgBars} names={CFG} onClick={(v) => onPushScope({ k: "cfg", v, label: CFG[v] })} />
        </div>
        <div className="card">
          <h3>Floor rise</h3>
          <SwGroupBars items={fbBars} names={FB} onClick={(v) => onPushScope({ k: "fb", v, label: FB[v] })} />
        </div>
      </div>
      <div className="card">
        <h3>By size band</h3>
        <SwGroupBars items={sbBars} names={SB} onClick={(v) => onPushScope({ k: "sb", v, label: SB[v] })} />
      </div>
    </>
  );
}

/** Drawer content when scope narrows to a tower but not a floor (ht && !hf). */
function TowerDrillContent({
  RD,
  arr,
  onPushScope,
}: {
  RD: RawInventoryDataset;
  arr: RawUnit[];
  onPushScope: (c: ScopeCondition) => void;
}) {
  const { CFG } = RD;
  const fls = [...new Set(arr.map((u) => u[2]))].sort((a, b) => b - a);
  const cfgBars = groupByKey(arr, (u) => u[4]);

  return (
    <>
      <div className="card">
        <h3>
          Floors in this tower <span className="hint">click → floor</span>
        </h3>
        <SwLegend />
        {fls.map((f) => {
          const us = arr.filter((u) => u[2] === f);
          const av = us.filter((u) => u[8] === 0).length;
          const bk = us.filter((u) => u[8] === 1).length;
          return (
            <div className="barrow" key={f} onClick={() => onPushScope({ k: "fl", v: f, label: ordinal(f) })}>
              <div className="lbl">
                <span className="nm">{ordinal(f)}</span>
                <span className="r">
                  {av} avail · {us.length}
                </span>
              </div>
              <SwBar3 av={av} bk={bk} bl={us.length - av - bk} />
            </div>
          );
        })}
      </div>
      <div className="card">
        <h3>By configuration</h3>
        <SwGroupBars items={cfgBars} names={CFG} onClick={(v) => onPushScope({ k: "cfg", v, label: CFG[v] })} />
      </div>
    </>
  );
}

/** Drawer content at group level (no project/tower/floor scope — e.g. a KPI or status scope). */
function GroupDrillContent({
  RD,
  arr,
  hst,
  onPushScope,
}: {
  RD: RawInventoryDataset;
  arr: RawUnit[];
  hst: ScopeCondition | undefined;
  onPushScope: (c: ScopeCondition) => void;
}) {
  const { P, CFG } = RD;
  const projs = [...new Set(arr.map((u) => u[0]))];

  if (hst) {
    const projBars = statusBarsData(arr, (u) => u[0], hst.v);
    const cfgBars = statusBarsData(arr, (u) => u[4], hst.v);
    return (
      <>
        {projs.length > 1 && (
          <div className="card">
            <h3>By project</h3>
            <SwStatusBars items={projBars} names={P} stCode={hst.v} onClick={(v) => onPushScope({ k: "p", v, label: P[v] })} />
          </div>
        )}
        <div className="card">
          <h3>By configuration</h3>
          <SwStatusBars items={cfgBars} names={CFG} stCode={hst.v} onClick={(v) => onPushScope({ k: "cfg", v, label: CFG[v] })} />
        </div>
      </>
    );
  }

  const projBars = groupByKey(arr, (u) => u[0]);
  const cfgBars = groupByKey(arr, (u) => u[4]);
  return (
    <>
      {projs.length > 1 && (
        <div className="card">
          <h3>By project</h3>
          <SwGroupBars items={projBars} names={P} onClick={(v) => onPushScope({ k: "p", v, label: P[v] })} />
        </div>
      )}
      <div className="card">
        <h3>By configuration</h3>
        <SwGroupBars items={cfgBars} names={CFG} onClick={(v) => onPushScope({ k: "cfg", v, label: CFG[v] })} />
      </div>
    </>
  );
}

/** Direct port of unitDetail(idx) — replaces drawer body with a single unit's spec sheet.
 * "Total unit cost" and "Rate" (₹/sq ft) are dropped — this app shows area, not value,
 * and there's no area-equivalent for a per-sq-ft rate. */
export function SwUnitDetail({
  RD,
  unit,
  onBack,
  onClose,
}: {
  RD: RawInventoryDataset;
  unit: RawUnit;
  onBack: () => void;
  onClose: () => void;
}) {
  const { P, TW, FL, CFG, UT } = RD;

  return (
    <>
      <div id="ov" className="open" onClick={onClose} />
      <div id="dw" className="open">
        <div id="dwhead">
          <div className="dwh">
            <button className="x" onClick={onClose}>
              ✕
            </button>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 19 }}>{unit[12]}</div>
            <div style={{ fontSize: 12, color: "#c7cedf", marginTop: 4 }}>{P[unit[0]]}</div>
          </div>
        </div>
        <div className="dwb" id="dwbody">
          <button className="back" onClick={onBack}>
            ‹ back to list
          </button>
          <div className="card">
            <SwStatusPill status={unit[8]} />
            {unit[8] === 2 && (
              <span style={{ fontSize: 12, color: "var(--mut)" }}> ({BLL[unit[9]]})</span>
            )}
            <div className="kv">
              <div className="k">Unit description</div>
              <div>{unit[12]}</div>
              <div className="k">Project</div>
              <div>{P[unit[0]]}</div>
              <div className="k">Tower</div>
              <div>{TW[unit[1]] || "—"}</div>
              <div className="k">Floor</div>
              <div>{FL[unit[3]]}</div>
              <div className="k">Configuration</div>
              <div>{CFG[unit[4]]}</div>
              <div className="k">Unit type</div>
              <div>{UT[unit[5]]}</div>
              <div className="k">Total super area</div>
              <div>{unit[6].toLocaleString("en-IN")} sq ft</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
