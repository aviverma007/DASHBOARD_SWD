import { useMemo, useState } from "react";
import {
  CP, summariseByChannelPartner, byProjectForCp, unitsForCpAndProject,
  unitStatusLabel, monthlyTrendForCp, fArea, fCr,
} from "../../utils/cpLogic";
import type { CpRecord } from "../../utils/cpLogic";

interface CpDrillDrawerProps {
  cpIdx: number;
  onClose: () => void;
}

type Level = "cp" | "project" | "unit";

function Breadcrumbs({ path, onCrumb }: { path: { level: Level; label: string }[]; onCrumb: (i: number) => void }) {
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

export function CpDrillDrawer({ cpIdx, onClose }: CpDrillDrawerProps) {
  const cpSummary = useMemo(() => summariseByChannelPartner().find(s => s.cpIdx === cpIdx), [cpIdx]);
  const cpName = CP.CP[cpIdx];

  const [path, setPath] = useState<{ level: Level; label: string; projIdx?: number }[]>([{ level: "cp", label: cpName }]);
  const [selectedUnit, setSelectedUnit] = useState<CpRecord | null>(null);

  const current = path[path.length - 1];

  function push(seg: { level: Level; label: string; projIdx?: number }) { setSelectedUnit(null); setPath(p => [...p, seg]); }
  function popTo(i: number) { setSelectedUnit(null); setPath(p => p.slice(0, i + 1)); }

  const byProject = useMemo(() => byProjectForCp(cpIdx), [cpIdx]);
  const monthly = useMemo(() => monthlyTrendForCp(cpIdx), [cpIdx]);
  const projectUnits = useMemo(
    () => (current.level === "project" && current.projIdx !== undefined ? unitsForCpAndProject(cpIdx, current.projIdx) : []),
    [current, cpIdx]
  );

  const title = selectedUnit ? selectedUnit.unitNo : current.label;

  return (
    <>
      <div id="ov" className="open" onClick={() => { setSelectedUnit(null); onClose(); }} />
      <div id="dw" className="open">
        <div className="dwh">
          <button className="x" onClick={() => { setSelectedUnit(null); onClose(); }}>✕</button>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 17 }}>{title}</div>
          <Breadcrumbs path={path} onCrumb={i => { setSelectedUnit(null); popTo(i); }} />
        </div>

        <div className="dwb">
          {selectedUnit ? (
            <>
              <button className="back" onClick={() => setSelectedUnit(null)}>‹ back to list</button>
              <div className="card">
                {(() => {
                  const st = unitStatusLabel(selectedUnit);
                  return <span className="pill" style={{ background: st.bg, color: st.color, marginBottom: 10, display: "inline-block" }}>{st.label}</span>;
                })()}
                <div className="kv">
                  <div className="k">Unit</div><div>{selectedUnit.unitNo}</div>
                  <div className="k">Project</div><div>{CP.P[selectedUnit.projIdx]}</div>
                  <div className="k">Tower</div><div>{CP.TW[selectedUnit.towerIdx] || "—"}</div>
                  <div className="k">Floor</div><div>{CP.FL[selectedUnit.floorLabelIdx] || "—"}</div>
                  <div className="k">Configuration</div><div>{CP.CFG[selectedUnit.cfgIdx]}</div>
                  <div className="k">Super area</div><div>{selectedUnit.area.toLocaleString("en-IN")} sq ft</div>
                  <div className="k">Total BSP (TSV)</div><div style={{ color: "var(--gold)", fontWeight: 600 }}>{fCr(selectedUnit.tsv)}</div>
                  <div className="k">Customer</div><div>{selectedUnit.customerName || "—"}</div>
                  <div className="k">Payment plan</div><div style={{ fontSize: 12.5 }}>{selectedUnit.paymentPlan || "—"}</div>
                  <div className="k">Channel partner</div><div>{CP.CP[selectedUnit.cpIdx]}</div>
                  <div className="k">Booking date</div>
                  <div>{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][selectedUnit.month - 1]} {selectedUnit.year}</div>
                </div>
              </div>
            </>
          ) : current.level === "cp" ? (
            <>
              <div className="insight">
                {cpSummary?.units ?? 0} units sold · {fArea(cpSummary?.area ?? 0)} · TSV {fCr(cpSummary?.tsv ?? 0)}
                {cpSummary && cpSummary.cancelled > 0 && ` · ${cpSummary.cancelled} cancelled (${cpSummary.rebooked} rebooked)`}
              </div>
              <div className="dkpis">
                <div className="dkpi"><div className="k">Units sold</div><div className="v" style={{ fontSize: 16 }}>{cpSummary?.units ?? 0}</div></div>
                <div className="dkpi"><div className="k">Area</div><div className="v" style={{ fontSize: 16 }}>{fArea(cpSummary?.area ?? 0)}</div></div>
                <div className="dkpi"><div className="k">TSV</div><div className="v" style={{ fontSize: 16 }}>{fCr(cpSummary?.tsv ?? 0)}</div></div>
                <div className="dkpi"><div className="k">Cancelled</div><div className="v" style={{ fontSize: 16, color: (cpSummary?.cancelled ?? 0) > 0 ? "#c0392b" : undefined }}>{cpSummary?.cancelled ?? 0}</div></div>
              </div>

              {/* Monthly trend for this CP */}
              {monthly.length > 0 && (
                <div className="card">
                  <h3>Monthly units sold <span className="hint">this channel partner</span></h3>
                  <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 100, overflowX: "auto" }}>
                    {monthly.map(m => {
                      const max = Math.max(...monthly.map(x => x.units), 1);
                      return (
                        <div key={m.key} title={`${m.label}: ${m.units} units`} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 24, flexShrink: 0 }}>
                          <div style={{ width: 14, height: `${(m.units / max) * 80}px`, background: "#0e7490", borderRadius: 2, minHeight: 2 }} />
                          <div style={{ fontSize: 8.5, color: "var(--mut)", marginTop: 3, whiteSpace: "nowrap" }}>{m.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="card">
                <h3>By project <span className="hint">click → project</span></h3>
                {byProject.map(p => (
                  <div className="barrow" key={p.projIdx} onClick={() => push({ level: "project", label: p.name, projIdx: p.projIdx })}>
                    <div className="lbl">
                      <span className="nm">{p.name}</span>
                      <span className="r">{p.units} sold · {fCr(p.tsv)}</span>
                    </div>
                    <div className="vbar" style={{ width: `${(p.units / Math.max(...byProject.map(x => x.units), 1)) * 100}%` }} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="card">
              <h3>Units <span className="hint">click → unit detail</span></h3>
              <table>
                <thead><tr><th>Unit</th><th>Tower</th><th>Config</th><th className="n">Area</th><th className="n">TSV</th><th>Status</th></tr></thead>
                <tbody>
                  {projectUnits.map((r, i) => {
                    const st = unitStatusLabel(r);
                    return (
                      <tr key={i} onClick={() => setSelectedUnit(r)}>
                        <td>{r.unitNo}</td>
                        <td>{CP.TW[r.towerIdx] || "—"}</td>
                        <td>{CP.CFG[r.cfgIdx]}</td>
                        <td className="n">{r.area.toLocaleString("en-IN")} sq ft</td>
                        <td className="n">{fCr(r.tsv)}</td>
                        <td><span className="pill" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
