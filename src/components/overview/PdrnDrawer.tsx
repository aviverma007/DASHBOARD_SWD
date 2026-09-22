import { useMemo, useState } from "react";
import type { SalesRecord, PeriodFilter } from "../../utils/pdrnLogic";
import { getSoldRecords, PDRN, INV, fArea, fCr, fRate, computeRateStats } from "../../utils/pdrnLogic";
import { CollapsibleCard } from "../common/CollapsibleCard";

/** Per-unit ₹/sqft rate; null when the record can't yield one. */
function unitRate(r: SalesRecord): number | null {
  return r.area > 0 && r.tsv > 0 ? r.tsv / r.area : null;
}

/** The records carrying the highest and lowest per-unit rate in a set. */
function rateExtremeUnits(records: SalesRecord[]): { hi: SalesRecord | null; lo: SalesRecord | null } {
  let hi: SalesRecord | null = null;
  let lo: SalesRecord | null = null;
  for (const r of records) {
    const rate = unitRate(r);
    if (rate === null) continue;
    if (hi === null || rate > (unitRate(hi) as number)) hi = r;
    if (lo === null || rate < (unitRate(lo) as number)) lo = r;
  }
  return { hi, lo };
}

interface DrillPath {
  level: "project" | "tower" | "floor" | "unit";
  label: string;
  filter?: { towerIdx?: number; floorNum?: number; unitNo?: string };
}

interface PdrnDrawerProps {
  invProjIdx: number;
  projectName: string;
  period: PeriodFilter;
  onClose: () => void;
  /** INVR stock complement for this project (units with no sale record) */
  unsoldUnits: number;
  unsoldArea: number;
  totalUnits: number;
  totalArea: number;
}

function summarise(records: SalesRecord[]) {
  return {
    units: records.length,
    area: records.reduce((s, r) => s + r.area, 0),
    tsv: records.reduce((s, r) => s + r.tsv, 0),
  };
}

function DkpiRow({ k, v, onClick }: { k: string; v: string; onClick?: () => void }) {
  return (
    <div className="dkpi" onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}
      title={onClick ? "Click → unit-wise list" : undefined}>
      <div className="k">{k}</div>
      <div className="v" style={{ fontSize: 16 }}>
        {v}
      </div>
    </div>
  );
}

/** Unit-wise breakup behind the KPI tiles: every sold unit with its
 * value, and (for stock tiles) the available units from INVR. */
function AllUnitsCard({ mode, records, invProjIdx, projectName, onUnitClick, onClose }: {
  mode: "sold" | "available" | "all";
  records: SalesRecord[];
  invProjIdx: number;
  projectName: string;
  onUnitClick: (r: SalesRecord) => void;
  onClose: () => void;
}) {
  const soldRows = useMemo(() => [...records].sort((a, b) => b.tsv - a.tsv), [records]);
  const availRows = useMemo(() => {
    if (mode === "sold") return [];
    const pdrnProjIdx = PDRN.P.indexOf(projectName);
    const soldNos = pdrnProjIdx >= 0
      ? new Set(PDRN.R.filter(r => r.projIdx === pdrnProjIdx).map(r => r.unitNo))
      : new Set<string>();
    return INV.U.filter(u => (u[0] as number) === invProjIdx && !soldNos.has(u[12] as string))
      .map(u => ({ unitNo: String(u[12]), area: u[6] as number }))
      .sort((a, b) => b.area - a.area);
  }, [mode, invProjIdx, projectName]);
  const title = mode === "sold" ? "Sold units — unit-wise value"
    : mode === "available" ? "Available units"
    : "All units — sold & available";
  return (
    <CollapsibleCard defaultOpen title={<>{title} <span className="hint">
      {mode !== "available" ? `${soldRows.length.toLocaleString("en-IN")} sold` : ""}
      {mode === "all" ? " · " : ""}
      {mode !== "sold" ? `${availRows.length.toLocaleString("en-IN")} available` : ""}
      {" · "}<a onClick={e => { e.stopPropagation(); onClose(); }} style={{ cursor: "pointer", textDecoration: "underline" }}>hide</a>
    </span></>}>
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Unit</th>
              <th>Status</th>
              <th>Config</th>
              <th className="n">Area</th>
              <th className="n">Sold for (TSV)</th>
              <th className="n">Rate</th>
            </tr>
          </thead>
          <tbody>
            {mode !== "available" && soldRows.map((r, i) => (
              <tr key={`s${i}`} onClick={() => onUnitClick(r)} style={{ cursor: "pointer" }}>
                <td>{r.unitNo}</td>
                <td><span className="pill pbk">Sold</span></td>
                <td>{PDRN.CFG[r.cfgIdx]}</td>
                <td className="n">{r.area.toLocaleString("en-IN")} sq ft</td>
                <td className="n" style={{ fontWeight: 700 }}>{fCr(r.tsv)}</td>
                <td className="n">{fRate(unitRate(r))}</td>
              </tr>
            ))}
            {mode !== "sold" && availRows.map((u, i) => (
              <tr key={`a${i}`}>
                <td>{u.unitNo}</td>
                <td><span className="pill pav">Available</span></td>
                <td>—</td>
                <td className="n">{u.area.toLocaleString("en-IN")} sq ft</td>
                <td className="n" style={{ color: "var(--mut)" }}>—</td>
                <td className="n" style={{ color: "var(--mut)" }}>—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleCard>
  );
}

function Breadcrumbs({ path, onCrumb }: { path: DrillPath[]; onCrumb: (i: number) => void }) {
  return (
    <div className="crumbs">
      {path.map((seg, i) => (
        <button key={i} className="crumb" onClick={() => onCrumb(i)}>
          {seg.label}
          {i < path.length - 1 && <span className="c">›</span>}
        </button>
      ))}
    </div>
  );
}

export function PdrnDrawer({ invProjIdx, projectName, period, onClose, unsoldUnits, unsoldArea, totalUnits, totalArea }: PdrnDrawerProps) {
  const allSold = useMemo(() => getSoldRecords(invProjIdx, period), [invProjIdx, period]);
  const [path, setPath] = useState<DrillPath[]>([{ level: "project", label: projectName }]);
  const [selectedUnit, setSelectedUnit] = useState<SalesRecord | null>(null);

  const current = path[path.length - 1];

  // Filtered records for current drill level
  const scopedRecords = useMemo(() => {
    let recs = allSold;
    for (const seg of path) {
      if (seg.filter?.towerIdx !== undefined) recs = recs.filter((r) => r.towerIdx === seg.filter!.towerIdx);
      if (seg.filter?.floorNum !== undefined) recs = recs.filter((r) => r.floorNum === seg.filter!.floorNum);
    }
    return recs;
  }, [allSold, path]);

  const scoped = summarise(scopedRecords);

  function pushPath(seg: DrillPath) {
    setSelectedUnit(null);
    setPath((p) => [...p, seg]);
  }

  function popTo(i: number) {
    setSelectedUnit(null);
    setPath((p) => p.slice(0, i + 1));
  }

  const drawerTitle = selectedUnit ? selectedUnit.unitNo : current.label;

  return (
    <>
      <div id="ov" className="open" onClick={() => { setSelectedUnit(null); onClose(); }} />
      <div id="dw" className="open">
        {/* Header */}
        <div className="dwh">
          <button className="x" onClick={() => { setSelectedUnit(null); onClose(); }}>✕</button>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 18 }}>{drawerTitle}</div>
          <Breadcrumbs path={path} onCrumb={(i) => { setSelectedUnit(null); popTo(i); }} />
        </div>

        <div className="dwb">
          {selectedUnit ? (
            <UnitDetail record={selectedUnit} onBack={() => setSelectedUnit(null)} />
          ) : (
            <DrillContent
              invProjIdx={invProjIdx}
              level={current.level}
              records={scopedRecords}
              scoped={scoped}
              unsoldUnits={current.level === "project" ? unsoldUnits : 0}
              unsoldArea={current.level === "project" ? unsoldArea : 0}
              totalUnits={current.level === "project" ? totalUnits : 0}
              totalArea={current.level === "project" ? totalArea : 0}
              onTowerDrill={(towerIdx) =>
                pushPath({
                  level: "tower",
                  label: PDRN.TW[towerIdx] || `Tower ${towerIdx}`,
                  filter: { towerIdx },
                })
              }
              onFloorDrill={(floorNum, floorLabel) =>
                pushPath({ level: "floor", label: floorLabel, filter: { ...current.filter, floorNum } })
              }
              onUnitClick={setSelectedUnit}
            />
          )}
        </div>
      </div>
    </>
  );
}

interface DrillContentProps {
  level: DrillPath["level"];
  records: SalesRecord[];
  scoped: ReturnType<typeof summarise>;
  unsoldUnits: number;
  unsoldArea: number;
  totalUnits: number;
  totalArea: number;
  invProjIdx: number;
  onTowerDrill: (idx: number) => void;
  onFloorDrill: (floorNum: number, label: string) => void;
  onUnitClick: (r: SalesRecord) => void;
}

function DrillContent({ level, records, scoped, unsoldUnits, unsoldArea, totalUnits, totalArea, invProjIdx, onTowerDrill, onFloorDrill, onUnitClick }: DrillContentProps) {
  const [unitsPanel, setUnitsPanel] = useState<null | "sold" | "available" | "all">(null);
  return (
    <>
      {/* Insight */}
      <div className="insight">
        {scoped.units} units sold · {fArea(scoped.area)} · TSV {fCr(scoped.tsv)}
        {level === "project" && totalUnits > 0 &&
          ` · ${totalUnits.toLocaleString("en-IN")} total · ${Math.round(((totalUnits - unsoldUnits) / totalUnits) * 100)}% absorbed · ${unsoldUnits} available (${fArea(unsoldArea)})`}
      </div>

      {/* KPI strip */}
      <div className="dkpis">
        <DkpiRow k="Sold units" v={scoped.units.toLocaleString("en-IN")} onClick={() => setUnitsPanel(p => p === "sold" ? null : "sold")} />
        <DkpiRow k="Sold area" v={fArea(scoped.area)} onClick={() => setUnitsPanel(p => p === "sold" ? null : "sold")} />
        <DkpiRow k="TSV" v={fCr(scoped.tsv)} onClick={() => setUnitsPanel(p => p === "sold" ? null : "sold")} />
        {level === "project" && (
          <>
            <DkpiRow k="Total units" v={totalUnits.toLocaleString("en-IN")} onClick={() => setUnitsPanel(p => p === "all" ? null : "all")} />
            <DkpiRow k="Total area" v={fArea(totalArea)} onClick={() => setUnitsPanel(p => p === "all" ? null : "all")} />
            <DkpiRow k="Available" v={unsoldUnits.toLocaleString("en-IN") + " units"} onClick={() => setUnitsPanel(p => p === "available" ? null : "available")} />
            <DkpiRow k="Available area" v={fArea(unsoldArea)} onClick={() => setUnitsPanel(p => p === "available" ? null : "available")} />
            <DkpiRow k="Absorption" v={Math.round(((totalUnits - unsoldUnits) / Math.max(totalUnits, 1)) * 100) + "%"} onClick={() => setUnitsPanel(p => p === "all" ? null : "all")} />
          </>
        )}
      </div>

      {unitsPanel && (
        <AllUnitsCard mode={unitsPanel} records={records} invProjIdx={invProjIdx}
          projectName={INV.P[invProjIdx] ?? ""} onUnitClick={onUnitClick} onClose={() => setUnitsPanel(null)} />
      )}

      {/* Highest / lowest rate units in the current scope — shown at
          every drill level, since the extremes change as you narrow in */}
      <RateExtremesCard records={records} onUnitClick={onUnitClick} />

      {/* Level-specific content */}
      {level === "project" && <TowerList records={records} invProjIdx={invProjIdx} onDrill={onTowerDrill} />}
      {level === "tower" && <FloorList records={records} onDrill={onFloorDrill} />}
      {level === "floor" && <UnitList records={records} onUnitClick={onUnitClick} />}
    </>
  );
}

/** One row of the rate-extremes card: rate headline + full unit spec,
 * clickable through to the unit detail sheet. */
function RateExtremeRow({ tag, color, record, onClick }: { tag: string; color: string; record: SalesRecord; onClick: () => void }) {
  const rate = unitRate(record);
  return (
    <div
      className="barrow"
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 4px" }}
    >
      <span
        style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase",
          color: "#fff", background: color, borderRadius: 5, padding: "3px 8px", flexShrink: 0,
        }}
      >
        {tag}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 15, fontWeight: 700, color }}>
          {fRate(rate)}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--mut)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {record.unitNo} · {PDRN.TW[record.towerIdx] || "No tower"} · {PDRN.FL[record.floorLabelIdx] || `Floor ${record.floorNum}`} · {PDRN.CFG[record.cfgIdx]} · {record.area.toLocaleString("en-IN")} sq ft · {fCr(record.tsv)}
        </div>
      </div>
      <span style={{ color: "var(--gold)", fontSize: 13, flexShrink: 0 }}>›</span>
    </div>
  );
}

function RateExtremesCard({ records, onUnitClick }: { records: SalesRecord[]; onUnitClick: (r: SalesRecord) => void }) {
  const { hi, lo } = useMemo(() => rateExtremeUnits(records), [records]);
  const stats = useMemo(() => computeRateStats(records), [records]);
  if (!hi || !lo) return null;
  return (
    <CollapsibleCard defaultOpen title={<>Rate extremes <span className="hint">avg {fRate(stats.avg)} · click → unit detail</span></>}>
      <RateExtremeRow tag="Highest" color="#1a7a4a" record={hi} onClick={() => onUnitClick(hi)} />
      <RateExtremeRow tag="Lowest" color="#c97a1a" record={lo} onClick={() => onUnitClick(lo)} />
    </CollapsibleCard>
  );
}

function TowerList({ records, invProjIdx, onDrill }: { records: SalesRecord[]; invProjIdx: number; onDrill: (idx: number) => void }) {
  /** Projects with zero bookings (e.g. Residencies, INVR-only) would
   * render an empty card — fall back to AVAILABLE stock by tower
   * from the INVR file instead. */
  const availTowers = useMemo(() => {
    if (records.length > 0) return [];
    const m = new Map<string, { units: number; area: number }>();
    INV.U.forEach((u) => {
      if ((u[0] as number) !== invProjIdx) return;
      const tw = INV.TW[u[1] as number] ?? "No tower";
      if (!m.has(tw)) m.set(tw, { units: 0, area: 0 });
      const e = m.get(tw)!;
      e.units++; e.area += u[6] as number;
    });
    return [...m.entries()].map(([name, e]) => ({ name, ...e })).sort((a, b) => b.units - a.units);
  }, [records, invProjIdx]);
  const maxAvail = Math.max(...availTowers.map((t) => t.units), 1);
  const towers = useMemo(() => {
    const m = new Map<number, SalesRecord[]>();
    records.forEach((r) => {
      const list = m.get(r.towerIdx) ?? [];
      list.push(r);
      m.set(r.towerIdx, list);
    });
    return [...m.entries()]
      .map(([idx, recs]) => ({
        idx,
        recs,
        tsv: recs.reduce((s, r) => s + r.tsv, 0),
        area: recs.reduce((s, r) => s + r.area, 0),
        rate: computeRateStats(recs),
      }))
      .sort((a, b) => b.tsv - a.tsv);
  }, [records]);

  const maxTsv = Math.max(...towers.map((t) => t.tsv), 1);

  return (
    <CollapsibleCard defaultOpen title={<>By tower <span className="hint">click → tower</span></>}>
      {towers.length === 0 && availTowers.map((t) => (
        <div className="barrow" key={t.name} style={{ cursor: "default" }}>
          <div className="lbl">
            <span className="nm">{t.name}</span>
            <span className="r">{t.units} available · {fArea(t.area)}</span>
          </div>
          <div className="vbar" style={{ width: `${(t.units / maxAvail) * 100}%`, background: "#7fa8c9" }} />
        </div>
      ))}
      {towers.length === 0 && availTowers.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 6 }}>No bookings yet — showing available stock by tower (INVR).</div>
      )}
      {towers.map((t) => (
        <div className="barrow" key={t.idx} onClick={() => onDrill(t.idx)}>
          <div className="lbl">
            <span className="nm">{PDRN.TW[t.idx] || "No tower"}</span>
            <span className="r">{t.recs.length} sold · {fCr(t.tsv)}</span>
          </div>
          <div className="vbar" style={{ width: `${(t.tsv / maxTsv) * 100}%` }} />
          <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 3 }}>
            Avg {fRate(t.rate.avg)} · <span style={{ color: "#1a7a4a" }}>H {fRate(t.rate.max)}</span> · <span style={{ color: "#c97a1a" }}>L {fRate(t.rate.min)}</span>
          </div>
        </div>
      ))}
    </CollapsibleCard>
  );
}

function FloorList({ records, onDrill }: { records: SalesRecord[]; onDrill: (num: number, label: string) => void }) {
  const floors = useMemo(() => {
    const m = new Map<number, { label: string; recs: SalesRecord[] }>();
    records.forEach((r) => {
      const key = r.floorNum;
      if (!m.has(key)) m.set(key, { label: PDRN.FL[r.floorLabelIdx] ?? `Floor ${r.floorNum}`, recs: [] });
      m.get(key)!.recs.push(r);
    });
    return [...m.entries()]
      .map(([num, { label, recs }]) => ({
        num,
        label,
        recs,
        units: recs.length,
        area: recs.reduce((s, r) => s + r.area, 0),
        rate: computeRateStats(recs),
      }))
      .sort((a, b) => b.num - a.num);
  }, [records]);

  const maxUnits = Math.max(...floors.map((f) => f.units), 1);

  return (
    <CollapsibleCard defaultOpen title={<>By floor <span className="hint">click → floor</span></>}>
      {floors.map((f) => (
        <div className="barrow" key={f.num} onClick={() => onDrill(f.num, f.label)}>
          <div className="lbl">
            <span className="nm">{f.label}</span>
            <span className="r">{f.units} sold · {fArea(f.area)}</span>
          </div>
          <div className="track">
            <div className="a" style={{ width: `${(f.units / maxUnits) * 100}%` }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 3 }}>
            Avg {fRate(f.rate.avg)} · <span style={{ color: "#1a7a4a" }}>H {fRate(f.rate.max)}</span> · <span style={{ color: "#c97a1a" }}>L {fRate(f.rate.min)}</span>
          </div>
        </div>
      ))}
    </CollapsibleCard>
  );
}

function UnitList({ records, onUnitClick }: { records: SalesRecord[]; onUnitClick: (r: SalesRecord) => void }) {
  return (
    <CollapsibleCard defaultOpen title={<>Units on this floor <span className="hint">click → unit detail</span></>}>
      <table>
        <thead>
          <tr>
            <th>Unit</th>
            <th>Config</th>
            <th className="n">Area</th>
            <th className="n">TSV</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={i} onClick={() => onUnitClick(r)}>
              <td>{r.unitNo}</td>
              <td>{PDRN.CFG[r.cfgIdx]}</td>
              <td className="n">{r.area.toLocaleString("en-IN")} sq ft</td>
              <td className="n">{fCr(r.tsv)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </CollapsibleCard>
  );
}

function UnitDetail({ record, onBack }: { record: SalesRecord; onBack: () => void }) {
  return (
    <>
      <button className="back" onClick={onBack}>‹ back to list</button>
      <CollapsibleCard defaultOpen title="Unit detail">
        <span className="pill pav" style={{ marginBottom: 10, display: "inline-block" }}>Sold</span>
        <div className="kv">
          <div className="k">Unit</div>
          <div>{record.unitNo}</div>
          <div className="k">Configuration</div>
          <div>{PDRN.CFG[record.cfgIdx]}</div>
          <div className="k">Tower</div>
          <div>{PDRN.TW[record.towerIdx] || "—"}</div>
          <div className="k">Floor</div>
          <div>{PDRN.FL[record.floorLabelIdx] || "—"}</div>
          <div className="k">Super area</div>
          <div>{record.area.toLocaleString("en-IN")} sq ft</div>
          <div className="k">Rate</div>
          <div style={{ color: "#0e7490", fontWeight: 600 }}>{fRate(unitRate(record))}</div>
          <div className="k">Total BSP (TSV)</div>
          <div style={{ color: "var(--gold)", fontWeight: 600 }}>{fCr(record.tsv)}</div>
          <div className="k">Customer</div>
          <div>{record.customerName || "—"}</div>
          <div className="k">Payment plan</div>
          <div style={{ fontSize: 12.5 }}>{record.paymentPlan || "—"}</div>
          <div className="k">Booking year</div>
          <div>{record.year}</div>
          <div className="k">Booking month</div>
          <div>{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][record.month - 1]}</div>
        </div>
      </CollapsibleCard>
    </>
  );
}
