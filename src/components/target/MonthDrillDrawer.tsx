import { useMemo, useState } from "react";
import { PDRN_ACTIVE as rawSales } from "../../data/pdrnActive";

interface PdrnRaw { P: string[]; TW: string[]; FL: string[]; CFG: string[]; R: number[][]; }
const PD = rawSales as unknown as PdrnRaw;

interface SalesRecord {
  projIdx: number; towerIdx: number; floorNum: number; floorLabelIdx: number;
  cfgIdx: number; area: number; tsv: number; year: number; month: number;
  unitNo: string; customerName: string; paymentPlan: string;
}

function toRecord(r: number[]): SalesRecord {
  return {
    projIdx: r[0], towerIdx: r[1], floorNum: r[2], floorLabelIdx: r[3], cfgIdx: r[4],
    area: r[5], tsv: r[6], year: r[7], month: r[8],
    unitNo: String(r[9]), customerName: String(r[10]), paymentPlan: String(r[11]),
  };
}

function fArea(sqft: number): string {
  if (sqft >= 100000) return (sqft / 100000).toFixed(2) + " L sq ft";
  return Math.round(sqft).toLocaleString("en-IN") + " sq ft";
}
function fCr(n: number): string {
  const v = n / 1e7;
  return "₹" + (v >= 100 ? Math.round(v).toLocaleString("en-IN") : v.toFixed(1)) + " Cr";
}
function summarise(recs: SalesRecord[]) {
  return { units: recs.length, area: recs.reduce((s, r) => s + r.area, 0), tsv: recs.reduce((s, r) => s + r.tsv, 0) };
}

type DrillLevel = "root" | "project" | "tower" | "unit";
interface DrillPath { level: DrillLevel; label: string; projIdx?: number; towerIdx?: number; }

interface MonthDrillDrawerProps {
  year: number;
  month: number; // 1-12
  monthLabel: string; // e.g. "May'26"
  projectFilter: Set<string>; // empty = all
  onClose: () => void;
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

function DkpiRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="dkpi">
      <div className="k">{k}</div>
      <div className="v" style={{ fontSize: 16 }}>{v}</div>
    </div>
  );
}

export function MonthDrillDrawer({ year, month, monthLabel, projectFilter, onClose }: MonthDrillDrawerProps) {
  // All records booked in this exact (year, month), filtered by selected projects
  const monthRecords = useMemo(() => {
    return PD.R.map(toRecord).filter(r => {
      if (r.year !== year || r.month !== month) return false;
      if (projectFilter.size > 0 && !projectFilter.has(PD.P[r.projIdx])) return false;
      return true;
    });
  }, [year, month, projectFilter]);

  const [path, setPath] = useState<DrillPath[]>([{ level: "root", label: monthLabel }]);
  const [selectedUnit, setSelectedUnit] = useState<SalesRecord | null>(null);

  const current = path[path.length - 1];

  const scopedRecords = useMemo(() => {
    let recs = monthRecords;
    for (const seg of path) {
      if (seg.projIdx !== undefined) recs = recs.filter(r => r.projIdx === seg.projIdx);
      if (seg.towerIdx !== undefined) recs = recs.filter(r => r.towerIdx === seg.towerIdx);
    }
    return recs;
  }, [monthRecords, path]);

  const scoped = summarise(scopedRecords);

  function push(seg: DrillPath) { setSelectedUnit(null); setPath(p => [...p, seg]); }
  function popTo(i: number) { setSelectedUnit(null); setPath(p => p.slice(0, i + 1)); }

  const title = selectedUnit ? selectedUnit.unitNo : current.label;

  return (
    <>
      <div id="ov" className="open" onClick={() => { setSelectedUnit(null); onClose(); }} />
      <div id="dw" className="open">
        <div className="dwh">
          <button className="x" onClick={() => { setSelectedUnit(null); onClose(); }}>✕</button>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 18 }}>{title}</div>
          <Breadcrumbs path={path} onCrumb={i => { setSelectedUnit(null); popTo(i); }} />
        </div>

        <div className="dwb">
          {selectedUnit ? (
            <UnitDetail record={selectedUnit} onBack={() => setSelectedUnit(null)} />
          ) : (
            <>
              <div className="insight">
                {scoped.units} units sold in {monthLabel} · {fArea(scoped.area)} · TSV {fCr(scoped.tsv)}
              </div>
              <div className="dkpis">
                <DkpiRow k="Sold units" v={scoped.units.toLocaleString("en-IN")} />
                <DkpiRow k="Sold area" v={fArea(scoped.area)} />
                <DkpiRow k="TSV" v={fCr(scoped.tsv)} />
              </div>

              {current.level === "root" && (
                <ByProjectList records={scopedRecords} onDrill={(projIdx, label) => push({ level: "project", label, projIdx })} />
              )}
              {current.level === "project" && (
                <ByTowerList records={scopedRecords} onDrill={(towerIdx, label) => push({ level: "tower", label, towerIdx })} />
              )}
              {current.level === "tower" && (
                <UnitList records={scopedRecords} onUnitClick={setSelectedUnit} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function ByProjectList({ records, onDrill }: { records: SalesRecord[]; onDrill: (idx: number, label: string) => void }) {
  const groups = useMemo(() => {
    const m = new Map<number, SalesRecord[]>();
    records.forEach(r => { const l = m.get(r.projIdx) ?? []; l.push(r); m.set(r.projIdx, l); });
    return [...m.entries()]
      .map(([idx, recs]) => ({ idx, recs, tsv: recs.reduce((s, r) => s + r.tsv, 0) }))
      .sort((a, b) => b.tsv - a.tsv);
  }, [records]);
  const maxTsv = Math.max(...groups.map(g => g.tsv), 1);

  if (groups.length === 0) return <p style={{ color: "var(--mut)", fontSize: 13 }}>No bookings this month.</p>;

  return (
    <div className="card">
      <h3>By project <span className="hint">click → project</span></h3>
      {groups.map(g => (
        <div className="barrow" key={g.idx} onClick={() => onDrill(g.idx, PD.P[g.idx])}>
          <div className="lbl">
            <span className="nm">{PD.P[g.idx]}</span>
            <span className="r">{g.recs.length} sold · {fCr(g.tsv)}</span>
          </div>
          <div className="vbar" style={{ width: `${(g.tsv / maxTsv) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

function ByTowerList({ records, onDrill }: { records: SalesRecord[]; onDrill: (idx: number, label: string) => void }) {
  const groups = useMemo(() => {
    const m = new Map<number, SalesRecord[]>();
    records.forEach(r => { const l = m.get(r.towerIdx) ?? []; l.push(r); m.set(r.towerIdx, l); });
    return [...m.entries()]
      .map(([idx, recs]) => ({ idx, recs, tsv: recs.reduce((s, r) => s + r.tsv, 0) }))
      .sort((a, b) => b.tsv - a.tsv);
  }, [records]);
  const maxTsv = Math.max(...groups.map(g => g.tsv), 1);

  if (groups.length === 0) return <p style={{ color: "var(--mut)", fontSize: 13 }}>No bookings this month.</p>;

  return (
    <div className="card">
      <h3>By tower <span className="hint">click → tower</span></h3>
      {groups.map(g => (
        <div className="barrow" key={g.idx} onClick={() => onDrill(g.idx, PD.TW[g.idx] || "No tower")}>
          <div className="lbl">
            <span className="nm">{PD.TW[g.idx] || "No tower"}</span>
            <span className="r">{g.recs.length} sold · {fCr(g.tsv)}</span>
          </div>
          <div className="vbar" style={{ width: `${(g.tsv / maxTsv) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

function UnitList({ records, onUnitClick }: { records: SalesRecord[]; onUnitClick: (r: SalesRecord) => void }) {
  if (records.length === 0) return <p style={{ color: "var(--mut)", fontSize: 13 }}>No units in this tower this month.</p>;
  return (
    <div className="card">
      <h3>Units <span className="hint">click → unit detail</span></h3>
      <table>
        <thead>
          <tr><th>Unit</th><th>Config</th><th className="n">Area</th><th className="n">TSV</th></tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={i} onClick={() => onUnitClick(r)}>
              <td>{r.unitNo}</td>
              <td>{PD.CFG[r.cfgIdx]}</td>
              <td className="n">{r.area.toLocaleString("en-IN")} sq ft</td>
              <td className="n">{fCr(r.tsv)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UnitDetail({ record, onBack }: { record: SalesRecord; onBack: () => void }) {
  return (
    <>
      <button className="back" onClick={onBack}>‹ back to list</button>
      <div className="card">
        <span className="pill pav" style={{ marginBottom: 10, display: "inline-block" }}>Sold</span>
        <div className="kv">
          <div className="k">Unit</div><div>{record.unitNo}</div>
          <div className="k">Project</div><div>{PD.P[record.projIdx]}</div>
          <div className="k">Tower</div><div>{PD.TW[record.towerIdx] || "—"}</div>
          <div className="k">Floor</div><div>{PD.FL[record.floorLabelIdx] || "—"}</div>
          <div className="k">Configuration</div><div>{PD.CFG[record.cfgIdx]}</div>
          <div className="k">Super area</div><div>{record.area.toLocaleString("en-IN")} sq ft</div>
          <div className="k">Total BSP (TSV)</div><div style={{ color: "var(--gold)", fontWeight: 600 }}>{fCr(record.tsv)}</div>
          <div className="k">Customer</div><div>{record.customerName || "—"}</div>
          <div className="k">Payment plan</div><div style={{ fontSize: 12.5 }}>{record.paymentPlan || "—"}</div>
          <div className="k">Booking date</div>
          <div>{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][record.month - 1]} {record.year}</div>
        </div>
      </div>
    </>
  );
}
