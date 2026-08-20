import { useMemo, useState } from "react";
import type { SalesRecord, PeriodFilter } from "../../utils/pdrnLogic";
import { getSoldRecords, PDRN, fArea, fCr } from "../../utils/pdrnLogic";
import { CollapsibleCard } from "../common/CollapsibleCard";

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
  /** INVR available units for this project (passed in for UNSOLD display) */
  unsoldUnits: number;
  unsoldArea: number;
}

function summarise(records: SalesRecord[]) {
  return {
    units: records.length,
    area: records.reduce((s, r) => s + r.area, 0),
    tsv: records.reduce((s, r) => s + r.tsv, 0),
  };
}

function DkpiRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="dkpi">
      <div className="k">{k}</div>
      <div className="v" style={{ fontSize: 16 }}>
        {v}
      </div>
    </div>
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

export function PdrnDrawer({ invProjIdx, projectName, period, onClose, unsoldUnits }: PdrnDrawerProps) {
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
              level={current.level}
              records={scopedRecords}
              scoped={scoped}
              unsoldUnits={current.level === "project" ? unsoldUnits : 0}
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
  onTowerDrill: (idx: number) => void;
  onFloorDrill: (floorNum: number, label: string) => void;
  onUnitClick: (r: SalesRecord) => void;
}

function DrillContent({ level, records, scoped, unsoldUnits, onTowerDrill, onFloorDrill, onUnitClick }: DrillContentProps) {
  return (
    <>
      {/* Insight */}
      <div className="insight">
        {scoped.units} units sold · {fArea(scoped.area)} · TSV {fCr(scoped.tsv)}
        {level === "project" && unsoldUnits > 0 && ` · ${unsoldUnits} unsold`}
      </div>

      {/* KPI strip */}
      <div className="dkpis">
        <DkpiRow k="Sold units" v={scoped.units.toLocaleString("en-IN")} />
        <DkpiRow k="Sold area" v={fArea(scoped.area)} />
        <DkpiRow k="TSV" v={fCr(scoped.tsv)} />
        {level === "project" && <DkpiRow k="Unsold" v={unsoldUnits.toLocaleString("en-IN") + " units"} />}
      </div>

      {/* Level-specific content */}
      {level === "project" && <TowerList records={records} onDrill={onTowerDrill} />}
      {level === "tower" && <FloorList records={records} onDrill={onFloorDrill} />}
      {level === "floor" && <UnitList records={records} onUnitClick={onUnitClick} />}
    </>
  );
}

function TowerList({ records, onDrill }: { records: SalesRecord[]; onDrill: (idx: number) => void }) {
  const towers = useMemo(() => {
    const m = new Map<number, SalesRecord[]>();
    records.forEach((r) => {
      const list = m.get(r.towerIdx) ?? [];
      list.push(r);
      m.set(r.towerIdx, list);
    });
    return [...m.entries()]
      .map(([idx, recs]) => ({ idx, recs, tsv: recs.reduce((s, r) => s + r.tsv, 0), area: recs.reduce((s, r) => s + r.area, 0) }))
      .sort((a, b) => b.tsv - a.tsv);
  }, [records]);

  const maxTsv = Math.max(...towers.map((t) => t.tsv), 1);

  return (
    <CollapsibleCard defaultOpen title={<>By tower <span className="hint">click → tower</span></>}>
      {towers.map((t) => (
        <div className="barrow" key={t.idx} onClick={() => onDrill(t.idx)}>
          <div className="lbl">
            <span className="nm">{PDRN.TW[t.idx] || "No tower"}</span>
            <span className="r">{t.recs.length} sold · {fCr(t.tsv)}</span>
          </div>
          <div className="vbar" style={{ width: `${(t.tsv / maxTsv) * 100}%` }} />
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
      .map(([num, { label, recs }]) => ({ num, label, recs, units: recs.length, area: recs.reduce((s, r) => s + r.area, 0) }))
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
