import { useMemo } from "react";
import { Zoomable } from "../../../components/common/Zoomable";
import { showTip, hideTip } from "../../../components/common/hoverTip";
import { type VTask, fD, fN, groupBy, towerOrder, VL } from "../vlData";
import { C, CARD, H3, CAP, TH, TD, R, GlassRow, Donut, Bars, delayCol, hoverRow, type VDrill } from "../vlUi";

/** "TA- B2 Floor Lvl. Slab" → "B2 Floor Lvl. Slab" (milestone legend shared across towers) */
const legendOf = (n: string) => { const m = n.match(/^[A-Z0-9()]{1,8}(?:-[A-Z0-9()]{1,3}){0,2}\s*-\s*(.+)$/); return (m ? m[1] : n).trim(); };

/** VisiLean "Milestone Tracker": milestone activities by tower, baseline vs planned vs actual. */
export function MilestoneView({ ts, open }: { ts: VTask[]; open: (d: VDrill) => void }) {
  const ms = useMemo(() => ts.filter(t => t.milestone), [ts]);
  const towers = useMemo(() => towerOrder(ms.map(t => t.tower)), [ms]);
  const legends = useMemo(() => {
    const g = groupBy(ms, t => legendOf(t.name));
    return [...g.entries()].sort((a, b) => Math.min(...a[1].map(t => t.be)) - Math.min(...b[1].map(t => t.be))).map(([k]) => k);
  }, [ms]);
  const done = ms.filter(t => t.phase === "done"), late = ms.filter(t => t.phase !== "done" && t.pe > t.be && t.be >= 0);
  const reasons = VL.REASONS.map(r => ({ k: r, v: ms.filter(t => t.reasons.includes(r)).length }));
  const reasonTowers = towers.map(tw => ({ k: tw, v: ms.filter(t => t.tower === tw && t.reasons.length).length })).filter(x => x.v);
  const tOpen = (t: VTask) => open({ title: `${t.tower} · milestone`, tasks: [t], task: t });
  const dBl = (t: VTask) => (t.ae >= 0 && t.be >= 0 ? t.ae - t.be : 0), dPl = (t: VTask) => (t.ae >= 0 && t.pe >= 0 ? t.ae - t.pe : 0);

  if (!ms.length) return <div style={{ ...CARD, color: "var(--mut)" }}>No activities are flagged <b>Milestone Tracker = Yes</b> in VisiLean for the current filters.</div>;
  return (
    <>
      <GlassRow items={[
        { k: "Milestones", v: fN(ms.length), s: `${fN(legends.length)} milestone types · ${fN(towers.length)} towers`, c: ["#1c3f6e", "#0f2547"], go: () => open({ title: "All milestones", tasks: ms }) },
        { k: "Achieved", v: fN(done.length), s: `${ms.length ? Math.round((done.length / ms.length) * 100) : 0}% of milestones`, c: ["#1e9a6c", "#0f6647"], go: () => open({ title: "Achieved milestones", tasks: done }) },
        { k: "Planned later than AOP", v: fN(late.length), s: "planned end beyond baseline end", c: ["#c0392b", "#7e1f14"], go: () => open({ title: "Milestones slipping vs AOP", tasks: [...late].sort((a, b) => (b.pe - b.be) - (a.pe - a.be)) }) },
        { k: "Next milestone", v: (() => { const n = ms.filter(t => t.phase !== "done").sort((a, b) => a.pe - b.pe)[0]; return n ? fD(n.pe) : "—"; })(), s: (() => { const n = ms.filter(t => t.phase !== "done").sort((a, b) => a.pe - b.pe)[0]; return n ? `${n.tower} · ${legendOf(n.name)}` : "all achieved"; })(), c: ["#c99a3a", "#96691c"] },
      ]} />

      <Zoomable title="Milestone matrix" collapsible>
        <div style={CARD}>
          <h3 style={H3}>Milestone Tracker — Planned End by Tower</h3>
          <div style={CAP}><span style={{ background: "#14a05a", color: "#fff", padding: "0 6px", borderRadius: 3 }}>green</span> = achieved (actual end shown) · red date = planned later than AOP · click a cell → detail</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 140 + towers.length * 110 }}>
              <thead><tr>
                <th style={{ ...TH, background: C.TEAL, color: "#fff" }}>Milestone</th>
                {towers.map(tw => <th key={tw} style={{ ...TH, background: C.TEAL, color: "#fff", textAlign: "center" }}>{tw}</th>)}
              </tr></thead>
              <tbody>
                {legends.map(lg => (
                  <tr key={lg}>
                    <td style={{ ...TD, fontWeight: 700, color: "var(--ink)", border: "1px solid #eae6da" }}>On completion of {lg}</td>
                    {towers.map(tw => {
                      const t = ms.find(x => x.tower === tw && legendOf(x.name) === lg);
                      if (!t) return <td key={tw} style={{ ...TD, border: "1px solid #eae6da" }} />;
                      const ok = t.phase === "done";
                      return (
                        <td key={tw} onClick={() => tOpen(t)} style={{ ...TD, textAlign: "center", cursor: "pointer", border: "1px solid #eae6da", background: ok ? "#14a05a" : undefined, color: ok ? "#fff" : t.pe > t.be ? C.RED : "var(--ink)", fontWeight: ok ? 800 : 600 }}
                          onMouseEnter={e => showTip(e, `<b>${tw} · ${lg}</b><br/>baseline ${fD(t.be)} · planned ${fD(t.pe)}${ok ? ` · achieved ${fD(t.ae)}` : ""}`)} onMouseLeave={hideTip}>
                          {ok ? fD(t.ae) : fD(t.pe)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Zoomable>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(0, 2.2fr)", gap: 14 }} className="trk-2col">
        <div>
          <Zoomable title="Reasons by tower" collapsible>
            <div style={CARD}>
              <h3 style={H3}>Tower-wise Reason for Variance</h3>
              <div style={CAP}>milestones with a reason ticked · click → list</div>
              {reasonTowers.length ? <Bars items={reasonTowers} color={C.AMBER} onPick={k => open({ title: `${k} — milestones with reasons`, tasks: ms.filter(t => t.tower === k && t.reasons.length) })} />
                : <div style={{ fontSize: 12.5, color: "var(--mut)" }}>No reasons recorded on milestones yet.</div>}
            </div>
          </Zoomable>
          <Zoomable title="Reasons for variance" collapsible>
            <div style={CARD}>
              <h3 style={H3}>Reasons for Variance</h3>
              <div style={CAP}>across all milestones</div>
              <Donut items={reasons} onPick={k => open({ title: `Milestones · ${k}`, tasks: ms.filter(t => t.reasons.includes(k)) })} empty="No reasons recorded on milestones yet." />
            </div>
          </Zoomable>
        </div>
        <Zoomable title="Milestone detail" collapsible>
          <div style={{ ...CARD, height: "100%" }}>
            <h3 style={H3}>Milestone Detail</h3>
            <div style={CAP}>Delay (baseline − actual) = actual end − baseline end · Delay (plan − actual) = actual end − planned end · negative = early</div>
            <div style={{ overflow: "auto", maxHeight: 620 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 820 }}>
                <thead><tr>{["Tower", "Milestone", "Baseline end", "Planned end", "Actual end", "Delay (baseline−actual)", "Delay (plan−actual)", "Reasons"].map((h, i) => <th key={h} style={{ ...TH, ...(i >= 2 && i <= 6 ? R : {}) }}>{h}</th>)}</tr></thead>
                <tbody>
                  {towers.flatMap(tw => ms.filter(t => t.tower === tw).sort((a, b) => a.be - b.be).map((t, i) => (
                    <tr key={`${tw}-${t.id}`} onClick={() => tOpen(t)} style={{ cursor: "pointer" }} {...hoverRow}>
                      <td style={{ ...TD, fontWeight: 800, color: "var(--ink)" }}>{i === 0 ? tw : ""}</td>
                      <td style={TD}>On completion of {legendOf(t.name)}</td>
                      <td style={{ ...TD, ...R }}>{fD(t.be)}</td><td style={{ ...TD, ...R }}>{fD(t.pe)}</td>
                      <td style={{ ...TD, ...R, background: t.ae >= 0 ? "#14a05a" : undefined, color: t.ae >= 0 ? "#fff" : undefined, fontWeight: 800 }}>{t.ae >= 0 ? fD(t.ae) : ""}</td>
                      <td style={{ ...TD, ...R, fontWeight: 700, color: delayCol(dBl(t)) }}>{dBl(t)}</td>
                      <td style={{ ...TD, ...R, fontWeight: 700, color: delayCol(dPl(t)) }}>{dPl(t)}</td>
                      <td style={{ ...TD, color: "var(--mut)" }}>{t.reasons.join(", ")}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
        </Zoomable>
      </div>
    </>
  );
}
