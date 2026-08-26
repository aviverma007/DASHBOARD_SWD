import { useMemo } from "react";
import type { CpRecord } from "../../utils/cpLogic";
import { CP, summariseByChannelPartner, fArea, fCr } from "../../utils/cpLogic";

interface CpMonthDrawerProps {
  monthKey: string;   // "YYYY-MM"
  monthLabel: string; // e.g. "Oct'24"
  /** Records already scoped by the page's project/period/CP filters. */
  records: CpRecord[];
  onCpClick: (cpIdx: number) => void;
  onClose: () => void;
}

/** Opens when a month bar on the CP monthly trend is clicked: lists
 * every channel partner active that month with units/area/TSV, sorted
 * by units. Clicking a partner drills into their full CP drawer. */
export function CpMonthDrawer({ monthKey, monthLabel, records, onCpClick, onClose }: CpMonthDrawerProps) {
  const [year, month] = monthKey.split("-").map(Number);

  const monthRecords = useMemo(
    () => records.filter(r => r.status === 0 && r.year === year && r.month === month),
    [records, year, month]
  );

  const cps = useMemo(
    () =>
      summariseByChannelPartner(monthRecords)
        .filter(s => s.name !== "Direct" && s.units > 0)
        .sort((a, b) => b.units - a.units || b.tsv - a.tsv),
    [monthRecords]
  );
  const direct = useMemo(
    () => summariseByChannelPartner(monthRecords).find(s => s.name === "Direct"),
    [monthRecords]
  );

  const totals = useMemo(
    () => cps.reduce((t, s) => ({ units: t.units + s.units, area: t.area + s.area, tsv: t.tsv + s.tsv }), { units: 0, area: 0, tsv: 0 }),
    [cps]
  );
  const maxUnits = Math.max(...cps.map(s => s.units), 1);

  return (
    <>
      <div id="ov" className="open" onClick={onClose} />
      <div id="dw" className="open">
        <div className="dwh">
          <button className="x" onClick={onClose}>✕</button>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 18 }}>Channel partners — {monthLabel}</div>
          <div className="crumbs">
            <button className="crumb" onClick={onClose}>Monthly trend <span className="c">›</span></button>
            <button className="crumb">{monthLabel}</button>
          </div>
        </div>

        <div className="dwb">
          <div className="insight">
            {cps.length} channel partners · {totals.units} units · {fArea(totals.area)} · TSV {fCr(totals.tsv)}
            {direct && direct.units > 0 && ` · +${direct.units} direct (no CP)`}
          </div>

          <div className="card">
            <h3>CP breakdown for {monthLabel} <span className="hint">click → channel partner</span></h3>
            {cps.length === 0 ? (
              <p style={{ color: "var(--mut)", fontSize: 13 }}>No channel-partner sales in this month for the current filters.</p>
            ) : (
              cps.map(s => (
                <div className="barrow" key={s.cpIdx} onClick={() => onCpClick(s.cpIdx)}>
                  <div className="lbl">
                    <span className="nm">{s.name}</span>
                    <span className="r">{s.units} unit{s.units !== 1 ? "s" : ""} · {fArea(s.area)} · {fCr(s.tsv)}</span>
                  </div>
                  <div className="vbar" style={{ width: `${(s.units / maxUnits) * 100}%` }} />
                </div>
              ))
            )}
          </div>

          {/* Units sold that month, per record, for quick reference */}
          {monthRecords.length > 0 && (
            <div className="card">
              <h3>Units booked in {monthLabel}</h3>
              <table>
                <thead><tr><th>Unit</th><th>Project</th><th>Channel partner</th><th className="n">Area</th><th className="n">TSV</th></tr></thead>
                <tbody>
                  {monthRecords.map((r, i) => (
                    <tr key={i} onClick={() => CP.CP[r.cpIdx] !== "Direct" && onCpClick(r.cpIdx)} style={{ cursor: CP.CP[r.cpIdx] !== "Direct" ? "pointer" : "default" }}>
                      <td>{r.unitNo}</td>
                      <td>{CP.P[r.projIdx]}</td>
                      <td>{CP.CP[r.cpIdx]}</td>
                      <td className="n">{r.area.toLocaleString("en-IN")} sq ft</td>
                      <td className="n">{fCr(r.tsv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
