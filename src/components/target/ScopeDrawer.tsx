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
  return { projIdx: r[0], towerIdx: r[1], floorNum: r[2], floorLabelIdx: r[3], cfgIdx: r[4],
    area: r[5], tsv: r[6], year: r[7], month: r[8], unitNo: String(r[9]), customerName: String(r[10]), paymentPlan: String(r[11]) };
}
function fCr(n: number) { const v = n / 1e7; return "₹" + (v >= 100 ? Math.round(v).toLocaleString("en-IN") : v.toFixed(1)) + " Cr"; }

interface ScopeDrawerProps {
  projectName: string;        // display label for the drawer header
  /** Actual projects to include; defaults to [projectName]. More than
   * one when a merged (multi-project) config scope is drilled. */
  projectNames?: string[];
  scopeType: "tower" | "config" | "project";
  scopeLabel: string; // tower name, config name, or project display name
  onClose: () => void;
}

export function ScopeDrawer({ projectName, projectNames, scopeType, scopeLabel, onClose }: ScopeDrawerProps) {
  const [selectedUnit, setSelectedUnit] = useState<SalesRecord | null>(null);

  const records = useMemo(() => {
    const projIdxs = new Set((projectNames?.length ? projectNames : [projectName]).map(n => PD.P.indexOf(n)));
    return PD.R.map(toRecord).filter(r => {
      if (!projIdxs.has(r.projIdx)) return false;
      if (scopeType === "project") return true;   // whole-project scope
      if (scopeType === "tower") return (PD.TW[r.towerIdx] || "No tower") === scopeLabel;
      return PD.CFG[r.cfgIdx] === scopeLabel;
    });
  }, [projectName, projectNames, scopeType, scopeLabel]);

  const totalTsv = records.reduce((s, r) => s + r.tsv, 0);
  const totalArea = records.reduce((s, r) => s + r.area, 0);

  return (
    <>
      <div id="ov" className="open" onClick={() => { setSelectedUnit(null); onClose(); }} />
      <div id="dw" className="open">
        <div className="dwh">
          <button className="x" onClick={() => { setSelectedUnit(null); onClose(); }}>✕</button>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 18 }}>{selectedUnit ? selectedUnit.unitNo : scopeLabel}</div>
          <div className="crumbs">
            <button className="crumb" onClick={() => setSelectedUnit(null)}>
              {projectName} <span className="c">›</span>
            </button>
            <button className="crumb" onClick={() => setSelectedUnit(null)}>{scopeLabel}</button>
          </div>
        </div>

        <div className="dwb">
          {selectedUnit ? (
            <>
              <button className="back" onClick={() => setSelectedUnit(null)}>‹ back to list</button>
              <div className="card">
                <span className="pill pav" style={{ marginBottom: 10, display: "inline-block" }}>Sold</span>
                <div className="kv">
                  <div className="k">Unit</div><div>{selectedUnit.unitNo}</div>
                  <div className="k">Tower</div><div>{PD.TW[selectedUnit.towerIdx] || "—"}</div>
                  <div className="k">Floor</div><div>{PD.FL[selectedUnit.floorLabelIdx] || "—"}</div>
                  <div className="k">Configuration</div><div>{PD.CFG[selectedUnit.cfgIdx]}</div>
                  <div className="k">Super area</div><div>{selectedUnit.area.toLocaleString("en-IN")} sq ft</div>
                  <div className="k">Total BSP (TSV)</div><div style={{ color: "var(--gold)", fontWeight: 600 }}>{fCr(selectedUnit.tsv)}</div>
                  <div className="k">Customer</div><div>{selectedUnit.customerName || "—"}</div>
                  <div className="k">Payment plan</div><div style={{ fontSize: 12.5 }}>{selectedUnit.paymentPlan || "—"}</div>
                  <div className="k">Booking date</div>
                  <div>{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][selectedUnit.month - 1]} {selectedUnit.year}</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="insight">{records.length} units sold · {(totalArea / 1e5).toFixed(2)} L sq ft · TSV {fCr(totalTsv)}</div>
              <div className="dkpis">
                <div className="dkpi"><div className="k">Sold units</div><div className="v" style={{ fontSize: 16 }}>{records.length}</div></div>
                <div className="dkpi"><div className="k">Sold area</div><div className="v" style={{ fontSize: 16 }}>{(totalArea / 1e5).toFixed(2)} L sq ft</div></div>
                <div className="dkpi"><div className="k">TSV</div><div className="v" style={{ fontSize: 16 }}>{fCr(totalTsv)}</div></div>
              </div>
              <div className="card">
                <h3>Units {records.length > 100 && "(first 100)"} <span className="hint">click → unit detail</span></h3>
                {records.length === 0 ? (
                  <p style={{ color: "var(--mut)", fontSize: 13 }}>No bookings recorded.</p>
                ) : (
                  <table>
                    <thead><tr><th>Unit</th><th>Tower</th><th>Config</th><th className="n">Area</th><th className="n">TSV</th></tr></thead>
                    <tbody>
                      {records.slice(0, 100).map((r, i) => (
                        <tr key={i} onClick={() => setSelectedUnit(r)}>
                          <td>{r.unitNo}</td>
                          <td>{PD.TW[r.towerIdx] || "—"}</td>
                          <td>{PD.CFG[r.cfgIdx]}</td>
                          <td className="n">{r.area.toLocaleString("en-IN")} sq ft</td>
                          <td className="n">{fCr(r.tsv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
