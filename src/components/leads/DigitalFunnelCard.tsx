/** Table-format funnel card for digital enquiries (enquiry →
 * qualified → opportunity → site-visit+ → booked). */
import { fNum } from "../../utils/footfallLogic";
import { CARD, H3, CAP, BLUE, TEAL, GOLD, GREEN, RED } from "./footfallCharts";
import { digitalFunnel, type DigRec } from "./digitalShared";

export function DigitalFunnelCard({ rows }: { rows: DigRec[] }) {
  const { steps, lost } = digitalFunnel(rows);
  const max = Math.max(steps[0].value, 1);
  const COLORS = [BLUE, TEAL, GOLD, "#7b5cb8", GREEN];
  const cell: React.CSSProperties = { padding: "9px 10px", fontSize: 12.5, verticalAlign: "middle" };
  const th: React.CSSProperties = { ...cell, padding: "5px 10px", fontSize: 10, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "var(--mut)", textAlign: "left" };
  return (
    <div style={{ ...CARD, marginBottom: 14 }}>
      <h3 style={H3}>Conversion funnel — enquiry till booking</h3>
      <div style={CAP}>nested populations · recomputes with every filter</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--line)" }}>
              <th style={{ ...th, width: 118 }}>Step</th>
              <th style={th}>Volume</th>
              <th style={{ ...th, width: 92, textAlign: "right" }}>Of enquiries</th>
              <th style={{ ...th, width: 100, textAlign: "right" }}>Step conv.</th>
              <th style={{ ...th, width: 100, textAlign: "right" }}>Drop-off</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s, i) => {
              const prev = i === 0 ? s.value : steps[i - 1].value;
              const drop = i === 0 ? 0 : prev - s.value;
              return (
                <tr key={s.key} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ ...cell, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    {s.label}
                    <div style={{ fontSize: 10, fontWeight: 400, color: "var(--mut)" }}>{s.hint}</div>
                  </td>
                  <td style={{ ...cell, minWidth: 160 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 18, background: "#f0ede5", borderRadius: 6, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(s.value / max) * 100}%`, background: COLORS[i], borderRadius: 6, transition: "width 0.4s cubic-bezier(0.22,1,0.36,1)" }} />
                      </div>
                      <b style={{ fontFamily: "Georgia,serif", fontSize: 13.5, color: "var(--ink)", whiteSpace: "nowrap" }}>{fNum(s.value)}</b>
                    </div>
                  </td>
                  <td style={{ ...cell, textAlign: "right", color: "var(--mut)", whiteSpace: "nowrap" }}>{s.pctOfTotal.toFixed(1)}%</td>
                  <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap", fontWeight: 700, color: i === 0 ? "var(--mut)" : s.pctOfPrev >= 50 ? "#1a7a4a" : "#c07a1a" }}>
                    {i === 0 ? "—" : `${s.pctOfPrev.toFixed(1)}%`}
                  </td>
                  <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap", color: drop > 0 ? "#c0392b" : "var(--mut)" }}>
                    {i === 0 ? "—" : drop > 0 ? `−${fNum(drop)}` : "0"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 8 }}>
        Of the opportunities, <b style={{ color: RED }}>{fNum(lost)}</b> are closed lost · a Stage exists only once an opportunity is created, so most enquiries have no stage
      </div>
    </div>
  );
}
