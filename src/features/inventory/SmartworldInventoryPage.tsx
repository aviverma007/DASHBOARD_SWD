import { useMemo, useState } from "react";
import rawData from "../../data/smartworldInventory.json";
import type { RawInventoryDataset, RawUnit, ScopeCondition, FilterState } from "../../types/smartworldRaw";
import {
  makeCatOf,
  baseUnits,
  stats,
  fArea,
  pct,
  groupByKey,
  floorBand,
  sizeBand,
  FB,
  SB,
} from "../../utils/smartworldLogic";
import { SwFilters } from "../../components/inventory/SwFilters";
import { SwKpis } from "../../components/inventory/SwKpis";
import { SwDonut, SwDLegend } from "../../components/inventory/swPieces";
import { SwGroupBars } from "../../components/inventory/SwGroupBars";
import { SwBar3, SwLegend } from "../../components/inventory/swPieces";
import { SwConfigGap } from "../../components/inventory/SwConfigGap";
import { SwRecordsCard } from "../../components/inventory/SwRecordsCard";
import { SwDrawer, SwUnitDetail } from "../../components/inventory/SwDrawer";
import { SwBlkByProjCard } from "../../components/inventory/SwBlkByProjCard";
import "../../components/inventory/smartworldInventory.css";

const RD = rawData as unknown as RawInventoryDataset;

/** Direct port of the reference tool's top-level state + renderOverview().
 * State shape, filter semantics, and render structure match the source
 * exactly: `state` drives the main page, `scope` drives the drawer, and
 * the two are independent, matching the original architecture. */
export function SmartworldInventoryPage() {
  const catOf = useMemo(() => makeCatOf(RD), []);
  const { P, TW, CFG, UT } = RD;

  const [filterState, setFilterState] = useState<FilterState>({
    proj: new Set(),
    status: "all",
    cat: -1,
    cfg: -1,
  });

  // scope=[] means the drawer is closed. A non-empty scope opens it.
  const [scope, setScope] = useState<ScopeCondition[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<RawUnit | null>(null);

  const arr = useMemo(() => baseUnits(RD.U, filterState, catOf), [filterState, catOf]);
  const s = useMemo(() => stats(arr), [arr]);

  // byP / pae — project-availability ranking used by "Availability by project",
  // "Unsold value by project", and the config-gap matrix row order.
  const pae = useMemo(() => {
    const byP = new Map<number, RawUnit[]>();
    arr.forEach((u) => {
      const list = byP.get(u[0]) ?? [];
      list.push(u);
      byP.set(u[0], list);
    });
    return Array.from(byP.entries())
      .map(([i, us]) => ({ i, us, av: us.filter((u) => u[8] === 0).length }))
      .sort((a, b) => b.av / b.us.length - a.av / a.us.length || b.av - a.av);
  }, [arr]);

  const ua = useMemo(() => {
    const rows = pae.map((x) => ({
      i: x.i,
      v: x.us.filter((u) => u[8] === 0).reduce((sum, u) => sum + u[6], 0),
    }));
    return rows.sort((a, b) => b.v - a.v);
  }, [pae]);
  const maxUa = Math.max(...ua.map((x) => x.v), 1);

  const rowsP = pae.map((x) => x.i);
  const cols = CFG.map((_, i) => i);

  const statusSegs = [
    { label: "Available", value: s.av, color: "var(--av)", act: "kst", v: 0 },
    { label: "Booked", value: s.bk, color: "var(--bk)", act: "kst", v: 1 },
    { label: "Management unit", value: s.bl, color: "var(--blk)", act: "kst", v: 2 },
  ].filter((x) => x.value > 0);

  const statusAreaSegs = [
    { label: "Available", value: s.areaAv, color: "var(--av)", act: "kst", v: 0 },
    { label: "Booked", value: s.areaBk, color: "var(--bk)", act: "kst", v: 1 },
    { label: "Management unit", value: s.areaBl, color: "var(--blk)", act: "kst", v: 2 },
  ].filter((x) => x.value > 0);

  const catSegs = [
    { label: "Residential", value: arr.filter((u) => catOf(u) === 0).length, color: "var(--teal)", act: "sc_cat", v: 0 },
    { label: "Commercial", value: arr.filter((u) => catOf(u) === 1).length, color: "var(--clay)", act: "sc_cat", v: 1 },
  ].filter((x) => x.value > 0);

  const catAreaSegs = [
    {
      label: "Residential",
      value: arr.filter((u) => catOf(u) === 0).reduce((sum, u) => sum + u[6], 0),
      color: "var(--teal)",
      act: "sc_cat",
      v: 0,
    },
    {
      label: "Commercial",
      value: arr.filter((u) => catOf(u) === 1).reduce((sum, u) => sum + u[6], 0),
      color: "var(--clay)",
      act: "sc_cat",
      v: 1,
    },
  ].filter((x) => x.value > 0);

  const cfgBars = useMemo(() => groupByKey(arr, (u) => u[4]), [arr]);
  const fbBars = useMemo(() => groupByKey(arr, (u) => floorBand(u[2])), [arr]);
  const sbBars = useMemo(() => groupByKey(arr, (u) => sizeBand(u[6])), [arr]);
  const utBars = useMemo(() => groupByKey(arr, (u) => u[5]), [arr]);

  // Drawer's own scoped units, derived from `arr` (baseUnits) + scope.
  const drawerBase = arr;

  function openScopeKey(k: ScopeCondition["k"], v: number, label: string) {
    setScope((prev) => [...prev, { k, v, label }]);
  }

  function handleKAll() {
    setScope([]);
  }
  function handleKSt(v: number) {
    setScope([{ k: "st", v, label: ["Available", "Booked", "Management unit"][v] }]);
  }
  function handleProj(pi: number) {
    setScope([{ k: "p", v: pi, label: P[pi] }]);
  }
  function handleCell(pi: number, b: number) {
    setScope([
      { k: "p", v: pi, label: P[pi] },
      { k: "cfg", v: b, label: CFG[b] },
    ]);
  }
  function handleCrumbRemove(i: number) {
    const next = scope.slice(0, i);
    setScope(next);
  }
  function closeDrawer() {
    setScope([]);
    setSelectedUnit(null);
  }

  const isDrawerOpen = scope.length > 0;

  return (
    <div className="sw-inv">
      <header>
        <div className="topbar">
          <SwFilters P={P} CFG={CFG} state={filterState} onChangeState={setFilterState} />
        </div>
      </header>

      <div className="wrap">
        <SwKpis s={s} onAll={handleKAll} onStatus={handleKSt} />

        {s.bl > 0 && (
          <div className="blkbar">
            Management units: {s.bl} — held back by the developer, not available for sale
          </div>
        )}

        {filterState.status === "blk" && <SwBlkByProjCard arr={arr} P={P} onRowClick={handleProj} />}

        {/* All cards flow left-to-right in a single auto-fill grid.
            Cards that need full width get gridColumn:"1/-1". */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 14,
        }}>
          {/* Stock status — dual donut */}
          <div className="card">
            <h3>
              Stock status <span className="hint">click a slice → drill</span>
            </h3>
            <div className="dual-donut">
              <div className="dual-donut-col">
                <div className="dual-donut-label">Units</div>
                <div className="donut-wrap">
                  <SwDonut
                    segs={statusSegs}
                    onSegmentClick={(seg) => seg.v !== undefined && handleKSt(seg.v)}
                  />
                  <SwDLegend segs={statusSegs} onItemClick={(seg) => seg.v !== undefined && handleKSt(seg.v)} />
                </div>
              </div>
              <div className="dual-donut-col">
                <div className="dual-donut-label">
                  Area <span className="unit-tag">sq ft</span>
                </div>
                <div className="donut-wrap">
                  <SwDonut
                    segs={statusAreaSegs}
                    valueFormatter={fArea}
                    onSegmentClick={(seg) => seg.v !== undefined && handleKSt(seg.v)}
                  />
                  <SwDLegend
                    segs={statusAreaSegs}
                    valueFormatter={fArea}
                    onItemClick={(seg) => seg.v !== undefined && handleKSt(seg.v)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* By category — dual donut */}
          <div className="card">
            <h3>
              By category <span className="hint">click a slice → drill</span>
            </h3>
            <div className="dual-donut">
              <div className="dual-donut-col">
                <div className="dual-donut-label">Units</div>
                <div className="donut-wrap">
                  <SwDonut
                    segs={catSegs}
                    onSegmentClick={(seg) => seg.v !== undefined && openScopeKey("cat", seg.v, ["Residential", "Commercial"][seg.v])}
                  />
                  <SwDLegend
                    segs={catSegs}
                    onItemClick={(seg) => seg.v !== undefined && openScopeKey("cat", seg.v, ["Residential", "Commercial"][seg.v])}
                  />
                </div>
              </div>
              <div className="dual-donut-col">
                <div className="dual-donut-label">
                  Area <span className="unit-tag">sq ft</span>
                </div>
                <div className="donut-wrap">
                  <SwDonut
                    segs={catAreaSegs}
                    valueFormatter={fArea}
                    onSegmentClick={(seg) => seg.v !== undefined && openScopeKey("cat", seg.v, ["Residential", "Commercial"][seg.v])}
                  />
                  <SwDLegend
                    segs={catAreaSegs}
                    valueFormatter={fArea}
                    onItemClick={(seg) => seg.v !== undefined && openScopeKey("cat", seg.v, ["Residential", "Commercial"][seg.v])}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Availability by project */}
          <div className="card">
            <h3>
              Availability by project <span className="hint">most available first · click → project</span>
            </h3>
            <SwLegend />
            {pae.map((x) => {
              const bk = x.us.filter((u) => u[8] === 1).length;
              const bl = x.us.length - x.av - bk;
              return (
                <div className="barrow" key={x.i} onClick={() => handleProj(x.i)}>
                  <div className="lbl">
                    <span className="nm">{P[x.i]}</span>
                    <span className="r">
                      {pct(x.av, x.us.length)}% avail · {x.av} units
                    </span>
                  </div>
                  <SwBar3 av={x.av} bk={bk} bl={bl} />
                </div>
              );
            })}
          </div>

          {/* Unsold area by project */}
          <div className="card">
            <h3>
              Unsold area by project <span className="hint">sq ft available · click → project</span>
            </h3>
            {ua.map((x) => (
              <div className="barrow" key={x.i} onClick={() => handleProj(x.i)}>
                <div className="lbl">
                  <span className="nm">{P[x.i]}</span>
                  <span className="r">{fArea(x.v)}</span>
                </div>
                <div className="vbar" style={{ width: `${(x.v / maxUa) * 100}%` }} />
              </div>
            ))}
          </div>

          {/* Config gap — full width */}
          <div style={{ gridColumn: "1 / -1" }}>
            <SwConfigGap arr={arr} rowsP={rowsP} cols={cols} P={P} CFG={CFG} onCellClick={handleCell} />
          </div>

          {/* By configuration */}
          <div className="card">
            <h3>
              By configuration <span className="hint">click → config</span>
            </h3>
            <SwGroupBars items={cfgBars} names={CFG} onClick={(v) => openScopeKey("cfg", v, CFG[v])} />
          </div>

          {/* Floor rise */}
          <div className="card">
            <h3>
              Floor rise <span className="hint">click → band</span>
            </h3>
            <SwGroupBars items={fbBars} names={FB} onClick={(v) => openScopeKey("fb", v, FB[v])} />
          </div>

          {/* By size band */}
          <div className="card">
            <h3>
              By size band <span className="hint">click → band</span>
            </h3>
            <SwGroupBars items={sbBars} names={SB} onClick={(v) => openScopeKey("sb", v, SB[v])} />
          </div>

          {/* By unit type */}
          <div className="card">
            <h3>
              By unit type <span className="hint">click → type</span>
            </h3>
            <SwGroupBars items={utBars} names={UT} onClick={(v) => openScopeKey("ut", v, UT[v])} />
          </div>

          {/* Unit records — full width */}
          <div style={{ gridColumn: "1 / -1" }}>
            <SwRecordsCard
              arr={arr}
              P={P}
              TW={TW}
              FL={RD.FL}
              CFG={CFG}
              UT={UT}
              onRowClick={(u) => {
                setScope((prev) => (prev.length ? prev : [{ k: "p", v: u[0], label: P[u[0]] }]));
                setSelectedUnit(u);
              }}
            />
          </div>
        </div>
      </div>

      {isDrawerOpen && !selectedUnit && (
        <SwDrawer
          RD={RD}
          base={drawerBase}
          scope={scope}
          catOf={catOf}
          onClose={closeDrawer}
          onCrumbClick={handleCrumbRemove}
          onPushScope={(cond) => setScope((prev) => [...prev, cond])}
          onUnitClick={(u) => setSelectedUnit(u)}
        />
      )}

      {isDrawerOpen && selectedUnit && (
        <SwUnitDetail
          RD={RD}
          unit={selectedUnit}
          onBack={() => setSelectedUnit(null)}
          onClose={closeDrawer}
        />
      )}
    </div>
  );
}
