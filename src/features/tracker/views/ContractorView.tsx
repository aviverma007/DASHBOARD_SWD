import { useMemo, useState } from "react";
import { Zoomable } from "../../../components/common/Zoomable";
import { showTip, hideTip } from "../../../components/common/hoverTip";
import { type VTask, fCr, fN, fPct, sum, groupBy, contractorScore, scoreBand, SCORE_BANDS, sCurve, ymLbl } from "../vlData";
import { C, CARD, H3, CAP, TH, TD, R, GlassRow, hoverRow, type VDrill } from "../vlUi";

/** VisiLean "Contractor Performance Review": score = 40% cost achieved + 60% physical progress. */
export function ContractorView({ ts, cut, open, who = "Contractor" }: { ts: VTask[]; cut: number; open: (d: VDrill) => void; who?: "Contractor" | "Organisation" }) {
  const whoL = who.toLowerCase();
  const withC = useMemo(() => ts.filter(t => t.contractor), [ts]);
  const rows = useMemo(() => [...groupBy(withC, t => t.contractor).entries()].map(([k, x]) => {
    const tr = [...groupBy(x, t => t.trade).entries()].sort((a, b) => sum(b[1], t => t.cost) - sum(a[1], t => t.cost))[0]?.[0] ?? "—";
    return { k, ts: x, scope: tr, ...contractorScore(x) };
  }).sort((a, b) => b.score - a.score), [withC]);
  const tot = contractorScore(withC);
  const [sel, setSel] = useState<string>("");
  const trendTasks = sel ? withC.filter(t => t.contractor === sel) : withC;
  const trend = useMemo(() => sCurve(trendTasks, cut).filter(p => p.ev !== null && (p.bcws > 0 || (p.ev ?? 0) > 0)), [trendTasks, cut]);

  if (!withC.length) return <div style={{ ...CARD, color: "var(--mut)" }}>No activities carry a <b>{who}</b> in VisiLean for the current filters.</div>;
  return (
    <>
      <GlassRow items={[
        { k: `${who}s`, v: fN(rows.length), s: `${fN(withC.length)} activities assigned`, c: ["#1c3f6e", "#0f2547"], go: () => open({ title: `All ${whoL} activities`, tasks: withC }) },
        { k: "Overall performance", v: fPct(tot.score, 2), s: scoreBand(tot.score)[1], c: [scoreBand(tot.score)[2], "#3a3a3a"] },
        { k: "Baseline cost", v: fCr(tot.cost), s: "awarded scope in the schedule", c: ["#1a7f9c", "#0e5468"] },
        { k: "Earned (actual) cost", v: fCr(tot.ev), s: `${fPct(tot.achieved, 2)} achieved`, c: ["#1e9a6c", "#0f6647"] },
        { k: "Physical progress", v: fPct(tot.phys, 2), s: `${tot.executed.toFixed(2)} of ${fN(tot.n)} activities done`, c: ["#c99a3a", "#96691c"] },
      ]} />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(0, 2.4fr)", gap: 14 }} className="trk-2col">
        <Zoomable title="Performance by contractor" collapsible>
          <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
            <h3 style={H3}>{who} Performance %</h3>
            <div style={CAP}>click → show that {whoL}'s monthly trend · double-click → activities</div>
            {rows.map(r => {
              const [, lbl, col] = scoreBand(r.score);
              return (
                <div key={r.k} onClick={() => setSel(s => (s === r.k ? "" : r.k))} onDoubleClick={() => open({ title: r.k, tasks: r.ts })}
                  onMouseEnter={e => showTip(e, `<b>${r.k}</b><br/>${fPct(r.score, 2)} · ${lbl}`)} onMouseLeave={hideTip}
                  style={{ padding: "6px 6px", cursor: "pointer", borderRadius: 6, background: sel === r.k ? "#faf6ea" : undefined }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, marginBottom: 3 }}><span>{r.k}</span><span style={{ color: "var(--mut)" }}>{fPct(r.score, 2)}</span></div>
                  <div style={{ height: 16, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(r.score, 100)}%`, background: col }} /></div>
                </div>
              );
            })}
            <div style={{ marginTop: 14, fontSize: 11 }}>
              <div style={{ fontWeight: 800, color: "var(--mut)", letterSpacing: ".8px", textTransform: "uppercase", fontSize: 10, marginBottom: 4 }}>Legend</div>
              {[...SCORE_BANDS].reverse().map(([lo, n, c], i, a) => (
                <div key={n} style={{ display: "grid", gridTemplateColumns: "110px 1fr", border: "1px solid #eae6da", borderTop: i ? "none" : undefined }}>
                  <span style={{ background: c, color: lo >= 71 || lo < 51 ? "#fff" : "#3a2a00", fontWeight: 800, padding: "2px 6px" }}>{n}</span>
                  <span style={{ padding: "2px 6px" }}>{lo}%–{i < a.length - 1 ? a[i + 1][0] - 1 : 100}%</span>
                </div>
              ))}
            </div>
          </div>
        </Zoomable>
        <div>
          <Zoomable title="Contractor table" collapsible>
            <div style={CARD}>
              <h3 style={H3}>{who} Performance Review</h3>
              {who === "Organisation" && <div style={{ fontSize: 11.5, color: "#8a5a00", background: "#fdf3ea", border: "1px solid #eedcae", borderRadius: 8, padding: "6px 10px", margin: "6px 0 8px" }}>This project's VisiLean export has no Contractor field, so activities are grouped by <b>Organisation</b> (the responsible team) instead.</div>}
              <div style={CAP}>performance = 40% cost achieved + 60% physical progress · click a row → activities</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
                  <thead><tr>{[who, "Main scope", "Performance", "Activities", "Work executed", "Physical progress", "Baseline cost", "Actual (earned) cost", "% achieved"].map((h, i) => <th key={h} style={{ ...TH, ...(i >= 2 ? R : {}) }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.k} onClick={() => open({ title: r.k, tasks: r.ts })} style={{ cursor: "pointer" }} {...hoverRow}>
                        <td style={{ ...TD, fontWeight: 800, color: "var(--ink)" }}>{r.k}</td>
                        <td style={{ ...TD, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }}>{r.scope}</td>
                        <td style={{ ...TD, ...R, background: scoreBand(r.score)[2], color: "#fff", fontWeight: 800 }}>{fPct(r.score, 2)}</td>
                        <td style={{ ...TD, ...R }}>{fN(r.n)}</td>
                        <td style={{ ...TD, ...R }}>{r.executed.toFixed(2)}</td>
                        <td style={{ ...TD, ...R }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                            <div style={{ width: 70, height: 10, background: "#f0ede5", borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(r.phys, 100)}%`, background: "#f2994a" }} /></div>
                            <b>{fPct(r.phys, 2)}</b>
                          </div>
                        </td>
                        <td style={{ ...TD, ...R }}>{fCr(r.cost)}</td>
                        <td style={{ ...TD, ...R, color: C.TEAL, fontWeight: 700 }}>{fCr(r.ev)}</td>
                        <td style={{ ...TD, ...R, fontWeight: 700 }}>{fPct(r.achieved, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{ background: "#e8f6fa" }}>
                    <td style={{ ...TD, fontWeight: 800 }}>Total</td><td style={TD} />
                    <td style={{ ...TD, ...R, fontWeight: 800, background: scoreBand(tot.score)[2], color: "#fff" }}>{fPct(tot.score, 2)}</td>
                    <td style={{ ...TD, ...R, fontWeight: 800 }}>{fN(tot.n)}</td><td style={{ ...TD, ...R, fontWeight: 800 }}>{tot.executed.toFixed(2)}</td>
                    <td style={{ ...TD, ...R, fontWeight: 800 }}>{fPct(tot.phys, 2)}</td><td style={{ ...TD, ...R, fontWeight: 800 }}>{fCr(tot.cost)}</td>
                    <td style={{ ...TD, ...R, fontWeight: 800 }}>{fCr(tot.ev)}</td><td style={{ ...TD, ...R, fontWeight: 800 }}>{fPct(tot.achieved, 2)}</td>
                  </tr></tfoot>
                </table>
              </div>
              <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 8 }}>
                Work executed = sum of task progress to date. Planned vs actual workers aren't shown: the export's workforce column carries progress values, not head-counts.
              </div>
            </div>
          </Zoomable>
          <Zoomable title="Monthly trend" collapsible>
            <div style={CARD}>
              <h3 style={H3}>Monthly Performance Trend{sel ? ` — ${sel}` : ""}</h3>
              <div style={CAP}>earned value in the month ÷ planned value (BCWS) in the month, coloured by the legend · {sel ? `click the ${whoL} again to show all` : `click a ${whoL} on the left to filter`}</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 220, overflowX: "auto", padding: "18px 2px 0" }}>
                {trend.map(p => {
                  const v = p.bcws > 0 ? Math.min(((p.ev ?? 0) / p.bcws) * 100, 150) : 100;
                  const [, lbl, col] = scoreBand(v);
                  return (
                    <div key={p.ym} style={{ flex: "0 0 38px", display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}
                      onMouseEnter={e => showTip(e, `<b>${ymLbl(p.ym)}</b><br/>earned ${fCr(p.ev ?? 0)} vs planned ${fCr(p.bcws)}<br/>${fPct(v)} · ${lbl}`)} onMouseLeave={hideTip}>
                      <div style={{ flex: 1, width: 26, display: "flex", alignItems: "flex-end" }}>
                        <div style={{ width: "100%", height: `${(Math.min(v, 120) / 120) * 100}%`, background: col, borderRadius: "3px 3px 0 0", position: "relative" }}>
                          <span style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 800, color: "var(--mut)", whiteSpace: "nowrap" }}>{v.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--mut)", marginTop: 4, whiteSpace: "nowrap" }}>{ymLbl(p.ym)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Zoomable>
        </div>
      </div>
    </>
  );
}
