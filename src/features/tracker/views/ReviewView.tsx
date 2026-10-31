import { useMemo, useState } from "react";
import { Zoomable } from "../../../components/common/Zoomable";
import { showTip, hideTip } from "../../../components/common/hoverTip";
import { type VTask, fD, fN, fPct, pctDone, timeline, towerOrder, groupBy, VL } from "../vlData";
import { C, CARD, H3, CAP, TH, TD, R, GlassRow, Donut, TaskTable, delayCol, hoverRow, type VDrill } from "../vlUi";

/** VisiLean "Project Review Dashboard": progress KPIs, planned vs actual by tower,
 *  reasons for variance, tower timeline and the activity list sorted by delay. */
export function ReviewView({ ts, cut, open }: { ts: VTask[]; cut: number; open: (d: VDrill) => void }) {
  const [cat, setCat] = useState<"All" | "C&P" | "Design" | "Execution">("All");
  const [delayOnly, setDelayOnly] = useState(false);
  const scope = useMemo(() => (cat === "All" ? ts : ts.filter(t => t.cat === cat)), [ts, cat]);

  const p = pctDone(scope, cut);
  const run = scope.filter(t => t.phase === "started"), done = scope.filter(t => t.phase === "done");
  const lateRun = scope.filter(t => t.lateRunning), lateStart = scope.filter(t => t.lateStart);
  const stopped = scope.filter(t => t.phase === "stopped");
  const all = timeline(scope, cut);
  const towers = useMemo(() => {
    const g = groupBy(scope, t => t.tower);
    return towerOrder([...g.keys()]).map(k => ({ k, ts: g.get(k)!, ...timeline(g.get(k)!, cut) }));
  }, [scope, cut]);
  const reasons = VL.REASONS.map(r => ({ k: r, v: scope.filter(t => t.reasons.includes(r)).length }));
  const activities = useMemo(() => {
    const a = delayOnly ? scope.filter(t => t.phase !== "done" && t.delayActual > 0) : scope;
    return [...a].sort((x, y) => (y.phase !== "done" ? y.delayActual : -1e4) - (x.phase !== "done" ? x.delayActual : -1e4) || x.pe - y.pe);
  }, [scope, delayOnly]);
  const tOpen = (t: VTask) => open({ title: t.tower, tasks: [t], task: t });

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {(["All", "C&P", "Design", "Execution"] as const).map(k => (
          <button key={k} onClick={() => setCat(k)}
            style={{ height: 34, minWidth: 120, padding: "0 18px", borderRadius: 8, border: `1px solid ${cat === k ? C.NAVY : "#d8d2c4"}`, background: cat === k ? C.NAVY : "#fff", color: cat === k ? "#fff" : "var(--ink)", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", boxShadow: cat === k ? "0 4px 12px rgba(28,63,110,.25)" : "none" }}>
            {k}
          </button>
        ))}
        <span style={{ fontSize: 11, color: "var(--mut)", marginLeft: 6 }}>C&P = procurement & tender · Design = drawings · Execution = site work</span>
      </div>

      <GlassRow items={[
        { k: "% actual complete", v: fPct(p.actual, 2), s: `targeted ${fPct(p.planned, 2)} · ${p.actual - p.planned >= 0 ? "+" : ""}${(p.actual - p.planned).toFixed(2)} pts`, c: ["#1c3f6e", "#0f2547"], go: () => open({ title: "All activities", tasks: scope }),
          extra: <div style={{ height: 6, background: "rgba(255,255,255,.2)", borderRadius: 3, marginTop: 8, position: "relative" }}><div style={{ height: "100%", width: `${Math.min(p.actual, 100)}%`, background: "#5fd0e6", borderRadius: 3 }} /><div style={{ position: "absolute", top: -3, left: `${Math.min(p.planned, 100)}%`, width: 2, height: 12, background: "#ffd27a" }} /></div> },
        { k: "In progress", v: fN(run.length), s: "activities started on site", c: ["#7b4a9e", "#4a2766"], go: () => open({ title: "In-progress activities", tasks: run }) },
        { k: "Completed", v: `${fN(done.length)} / ${fN(scope.length)}`, s: `${fPct(scope.length ? (done.length / scope.length) * 100 : 0, 2)} of activities`, c: ["#1e9a6c", "#0f6647"], go: () => open({ title: "Completed activities", tasks: done }) },
        { k: "Delayed (in progress)", v: fN(lateRun.length), s: `${fPct(run.length ? (lateRun.length / Math.max(scope.length, 1)) * 100 : 0)} · past planned end`, c: ["#c99a3a", "#96691c"], go: () => open({ title: "Delayed — in progress", sub: "started, planned end has passed", tasks: [...lateRun].sort((a, b) => b.delayActual - a.delayActual) }) },
        { k: "Delayed (not started)", v: fN(lateStart.length), s: `${fPct((lateStart.length / Math.max(scope.length, 1)) * 100)} · past planned start`, c: ["#d9822b", "#9a5212"], go: () => open({ title: "Delayed — not started", sub: "planned start has passed, not started", tasks: [...lateStart].sort((a, b) => b.delayActual - a.delayActual) }) },
        { k: "Stopped", v: fN(stopped.length), s: "activities on hold", c: ["#c0392b", "#7e1f14"], go: () => open({ title: "Stopped activities", tasks: stopped }) },
      ]} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
        {[["AOP end date", fD(all.be), C.NAVY], ["Planned end date", fD(all.pe), C.TEAL], ["Current project delay", `${all.delayAop} days`, all.delayAop > 0 ? C.RED : C.GREEN]].map(([k, v, c]) => (
          <div key={k} style={{ ...CARD, marginBottom: 0, borderLeft: `6px solid ${c}`, padding: "10px 14px" }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "1.1px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 21, fontWeight: 700, color: c, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(320px, 1fr)", gap: 14, marginBottom: 14 }} className="trk-2col">
        <Zoomable title="Planned vs actual by tower" collapsible>
          <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
            <h3 style={H3}>Planned % vs Actual % by Tower</h3>
            <div style={CAP}>duration-weighted · <span style={{ color: "#8fd3c8", fontWeight: 800 }}>■</span> planned by as-on · <span style={{ color: C.TEAL, fontWeight: 800 }}>■</span> actual · click a tower → its activities</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 230, overflowX: "auto", padding: "16px 4px 0" }}>
              {towers.map(tw => (
                <div key={tw.k} onClick={() => open({ title: tw.k, tasks: tw.ts })} style={{ flex: "1 0 54px", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", height: "100%" }}
                  onMouseEnter={e => showTip(e, `<b>${tw.k}</b><br/>planned ${fPct(tw.planned)} · actual ${fPct(tw.actual)}<br/>${fN(tw.ts.length)} activities · click → list`)} onMouseLeave={hideTip}>
                  <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3 }}>
                    {[[tw.planned, "#8fd3c8"], [tw.actual, C.TEAL]].map(([v, c], i) => (
                      <div key={i} style={{ width: 18, height: `${Math.max(Number(v), 0.5)}%`, background: c as string, borderRadius: "3px 3px 0 0", position: "relative" }}>
                        <span style={{ position: "absolute", top: -15, left: "50%", transform: "translateX(-50%)", fontSize: 9.5, fontWeight: 800, color: "var(--mut)", whiteSpace: "nowrap" }}>{Math.round(Number(v))}%</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--mut)", marginTop: 5, textAlign: "center", whiteSpace: "nowrap" }}>{tw.k}</div>
                </div>
              ))}
            </div>
          </div>
        </Zoomable>
        <Zoomable title="Reasons for variance" collapsible>
          <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
            <h3 style={H3}>Reasons for Variance</h3>
            <div style={CAP}>activities with a delay reason ticked in VisiLean · click → those activities</div>
            <Donut items={reasons} onPick={k => open({ title: `Reason: ${k}`, tasks: scope.filter(t => t.reasons.includes(k)) })}
              empty="No delay reasons recorded yet — site teams tick them on each delayed task in VisiLean." />
          </div>
        </Zoomable>
      </div>

      <Zoomable title="Overall timeline" collapsible>
        <div style={CARD}>
          <h3 style={H3}>Overall Timeline — Planned (%) vs Actual (%) Progress</h3>
          <div style={CAP}>Delay (AOP) = planned end − AOP baseline end · Delay (actual) = worst delay among unfinished activities · click a row → its activities</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 820 }}>
              <thead><tr>{["Tower", "Baseline end (AOP)", "Planned end", "Delay (AOP)", "Delay (actual)", "% planned complete", "% actual complete"].map((h, i) => <th key={h} style={{ ...TH, ...(i ? R : {}) }}>{h}</th>)}</tr></thead>
              <tbody>
                {towers.map(tw => (
                  <tr key={tw.k} onClick={() => open({ title: tw.k, tasks: tw.ts })} style={{ cursor: "pointer" }} {...hoverRow}>
                    <td style={{ ...TD, fontWeight: 700, color: "var(--ink)" }}>{tw.k}</td>
                    <td style={{ ...TD, ...R }}>{fD(tw.be)}</td><td style={{ ...TD, ...R }}>{fD(tw.pe)}</td>
                    <td style={{ ...TD, ...R, fontWeight: 800, color: "#fff", background: tw.delayAop > 0 ? `rgba(224,90,80,${Math.min(0.35 + tw.delayAop / 80, 0.95)})` : tw.delayAop < 0 ? "rgba(27,175,122,.55)" : undefined }}>
                      <span style={{ color: tw.delayAop === 0 ? "var(--mut)" : "#fff" }}>{tw.delayAop}</span></td>
                    <td style={{ ...TD, ...R, fontWeight: 700, color: delayCol(tw.delayActual) }}>{tw.delayActual ?? ""}</td>
                    {[tw.planned, tw.actual].map((v, i) => (
                      <td key={i} style={{ ...TD, ...R, width: 160 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                          <div style={{ width: 90, height: 12, background: "#f0ede5", borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(v, 100)}%`, background: i ? "#7fcfc0" : "#f2b33d" }} /></div>
                          <b style={{ width: 36 }}>{v.toFixed(0)}%</b>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot><tr style={{ background: "#faf9f6" }}>
                <td style={{ ...TD, fontWeight: 800, borderTop: "2px solid #eae6da" }}>Total</td>
                <td style={{ ...TD, ...R, fontWeight: 800, borderTop: "2px solid #eae6da" }}>{fD(all.be)}</td>
                <td style={{ ...TD, ...R, fontWeight: 800, borderTop: "2px solid #eae6da" }}>{fD(all.pe)}</td>
                <td style={{ ...TD, ...R, fontWeight: 800, borderTop: "2px solid #eae6da", color: delayCol(all.delayAop) }}>{all.delayAop}</td>
                <td style={{ ...TD, ...R, fontWeight: 800, borderTop: "2px solid #eae6da", color: delayCol(all.delayActual) }}>{all.delayActual ?? ""}</td>
                <td style={{ ...TD, ...R, fontWeight: 800, borderTop: "2px solid #eae6da" }}>{all.planned.toFixed(0)}%</td>
                <td style={{ ...TD, ...R, fontWeight: 800, borderTop: "2px solid #eae6da" }}>{all.actual.toFixed(0)}%</td>
              </tr></tfoot>
            </table>
          </div>
        </div>
      </Zoomable>

      <Zoomable title="Activity details" collapsible>
        <div style={CARD}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", paddingRight: 64 }}>
            <div>
              <h3 style={H3}>Activity Details</h3>
              <div style={CAP}>most delayed first · ● = critical · click a row → full detail</div>
            </div>
            <button onClick={() => setDelayOnly(v => !v)}
              style={{ height: 30, padding: "0 16px", borderRadius: 8, border: `1px solid ${delayOnly ? "#e0a08f" : "#e8dccb"}`, background: delayOnly ? "#fde8e1" : "#fdf3ea", color: delayOnly ? C.RED : "#8a5a00", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              {delayOnly ? "✓ Delayed only" : "Delayed only"}
            </button>
          </div>
          <TaskTable tasks={activities} onPick={tOpen} limit={300} cut={cut} />
        </div>
      </Zoomable>
    </>
  );
}
