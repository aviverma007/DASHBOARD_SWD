import { useMemo, useState } from "react";
import { Zoomable } from "../../../components/common/Zoomable";
import { type VTask, fD, fN, groupBy, towerOrder } from "../vlData";
import { C, CARD, H3, CAP, TH, TD, R, GlassRow, Bars, StatusPill, hoverRow, type VDrill } from "../vlUi";

/** VisiLean "Lookahead Activity Overview": unfinished work planned in the next N weeks. */
export function LookaheadView({ ts, cut, open }: { ts: VTask[]; cut: number; open: (d: VDrill) => void }) {
  const [weeks, setWeeks] = useState(5);
  const end = cut + weeks * 7;
  const win = useMemo(() => ts.filter(t => t.phase !== "done" && t.ps >= 0 && t.pe >= 0 && t.ps <= end && t.pe >= cut)
    .sort((a, b) => a.ps - b.ps), [ts, cut, end]);
  const starting = win.filter(t => t.ps >= cut), finishing = win.filter(t => t.pe <= end);
  const notReady = win.filter(t => /not (ready|committed)/i.test(t.status));
  const critical = win.filter(t => t.critical), running = win.filter(t => t.phase === "started");
  const groups = useMemo(() => {
    const g = groupBy(win, t => t.tower);
    return towerOrder([...g.keys()]).map(tw => ({ tw, trades: [...groupBy(g.get(tw)!, t => t.trade).entries()] }));
  }, [win]);
  const byStatus = [...groupBy(win, t => t.status).entries()].map(([k, v]) => ({ k, v: v.length })).sort((a, b) => b.v - a.v);
  const byOwner = [...groupBy(win, t => t.owner || "Unassigned").entries()].map(([k, v]) => ({ k, v: v.length })).sort((a, b) => b.v - a.v);
  const tOpen = (t: VTask) => open({ title: t.tower, tasks: [t], task: t });

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)" }}>Next</span>
        {[2, 3, 4, 5, 6, 8, 12].map(w => (
          <button key={w} onClick={() => setWeeks(w)}
            style={{ height: 30, minWidth: 44, padding: "0 12px", borderRadius: 999, border: `1px solid ${weeks === w ? C.GOLD : "#e0dacb"}`, background: weeks === w ? "#fdf6e8" : "#fff", color: weeks === w ? "#96691c" : "var(--mut)", fontWeight: weeks === w ? 800 : 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            {w} wk
          </button>
        ))}
        <span style={{ fontSize: 12, color: "var(--mut)" }}>{fD(cut)} – {fD(end)}</span>
      </div>

      <GlassRow items={[
        { k: "Activities in window", v: fN(win.length), s: `unfinished work planned up to ${fD(end)}`, c: ["#1c3f6e", "#0f2547"], go: () => open({ title: `Lookahead — next ${weeks} weeks`, tasks: win }) },
        { k: "Starting", v: fN(starting.length), s: "planned to start in the window", c: ["#1a7f9c", "#0e5468"], go: () => open({ title: "Starting in the window", tasks: starting }) },
        { k: "Finishing", v: fN(finishing.length), s: "planned to finish in the window", c: ["#1e9a6c", "#0f6647"], go: () => open({ title: "Finishing in the window", tasks: finishing }) },
        { k: "Already running", v: fN(running.length), s: "started on site", c: ["#7b4a9e", "#4a2766"], go: () => open({ title: "Running", tasks: running }) },
        { k: "Not ready / committed", v: fN(notReady.length), s: "constraints still open", c: ["#c0392b", "#7e1f14"], go: () => open({ title: "Not ready or not committed", tasks: notReady }) },
        { k: "Critical", v: fN(critical.length), s: "on the critical path", c: ["#c99a3a", "#96691c"], go: () => open({ title: "Critical activities in the window", tasks: critical }) },
      ]} />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2.2fr) minmax(280px, 1fr)", gap: 14 }} className="trk-2col">
        <Zoomable title="Lookahead activities" collapsible>
          <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
            <h3 style={H3}>Lookahead Activity Overview</h3>
            <div style={CAP}>by tower and trade · click a row → detail · click a tower → all its window activities</div>
            <div style={{ overflow: "auto", maxHeight: 640 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 980 }}>
                <thead><tr>{["Tower", "Trade", "Task Id", "Activity", "Owner", "Location", "Baseline start", "Baseline end", "Planned start", "Planned end", "Status"].map(h => <th key={h} style={{ ...TH, ...(h === "Task Id" ? R : {}) }}>{h}</th>)}</tr></thead>
                <tbody>
                  {groups.flatMap(({ tw, trades }) => trades.flatMap(([tr, rows], ti) => rows.map((t, i) => (
                    <tr key={`${tw}-${tr}-${t.id}`} onClick={() => tOpen(t)} style={{ cursor: "pointer" }} {...hoverRow}>
                      <td style={{ ...TD, fontWeight: 800, color: "var(--ink)", borderBottom: "none", verticalAlign: "top" }}
                        onClick={e => { if (ti === 0 && i === 0) { e.stopPropagation(); open({ title: `${tw} — next ${weeks} weeks`, tasks: win.filter(x => x.tower === tw) }); } }}>
                        {ti === 0 && i === 0 ? <span style={{ cursor: "pointer", textDecoration: "underline dotted" }}>{tw}</span> : ""}</td>
                      <td style={{ ...TD, fontWeight: 700, color: "#5a5545", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }}>{i === 0 ? tr : ""}</td>
                      <td style={{ ...TD, ...R, color: "var(--mut)" }}>{t.id}</td>
                      <td style={{ ...TD, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", fontWeight: 700, color: "var(--ink)" }}>{t.critical ? <span style={{ color: C.RED }}>● </span> : null}{t.name}</td>
                      <td style={TD}>{t.owner || "—"}</td>
                      <td style={{ ...TD, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", color: "var(--mut)" }}>{t.loc}</td>
                      <td style={TD}>{fD(t.bs)}</td><td style={TD}>{fD(t.be)}</td>
                      <td style={{ ...TD, fontWeight: 700 }}>{fD(t.ps)}</td><td style={{ ...TD, fontWeight: 700 }}>{fD(t.pe)}</td>
                      <td style={TD}><StatusPill s={t.status} /></td>
                    </tr>
                  ))))}
                  {!win.length && <tr><td colSpan={11} style={{ ...TD, textAlign: "center", color: "var(--mut)", padding: 18 }}>Nothing planned in this window for the current filters</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </Zoomable>
        <div>
          <Zoomable title="By status" collapsible>
            <div style={CARD}>
              <h3 style={H3}>By Status</h3>
              <div style={CAP}>click → those activities</div>
              <Bars items={byStatus} onPick={k => open({ title: `Status: ${k}`, tasks: win.filter(t => t.status === k) })} color={C.NAVY} />
            </div>
          </Zoomable>
          <Zoomable title="By owner" collapsible>
            <div style={CARD}>
              <h3 style={H3}>By Owner</h3>
              <div style={CAP}>who carries the window · click → their activities</div>
              <Bars items={byOwner} onPick={k => open({ title: `Owner: ${k}`, tasks: win.filter(t => (t.owner || "Unassigned") === k) })} color={C.TEAL} />
            </div>
          </Zoomable>
        </div>
      </div>
    </>
  );
}
