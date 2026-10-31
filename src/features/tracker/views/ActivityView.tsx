import { useEffect, useMemo, useState } from "react";
import { Zoomable } from "../../../components/common/Zoomable";
import { showTip, hideTip } from "../../../components/common/hoverTip";
import { type VTask, fD, fN, sum, groupBy, towerOrder, ymOf } from "../vlData";
import { C, CARD, H3, CAP, TD, type VDrill } from "../vlUi";

/** VisiLean "Activity Tracker Dashboard": one tower, floors × trades, end date and % per cell. */
export function ActivityView({ ts, cut, open }: { ts: VTask[]; cut: number; open: (d: VDrill) => void }) {
  const towers = useMemo(() => {
    const g = groupBy(ts.filter(t => t.floor), t => t.tower);
    return towerOrder([...g.keys()]).filter(k => g.get(k)!.length >= 3);
  }, [ts]);
  const [tower, setTower] = useState("");
  const [basis, setBasis] = useState<"planned" | "baseline">("planned");
  useEffect(() => { if (!towers.includes(tower)) setTower(towers.find(t => /^tower/i.test(t)) ?? towers[0] ?? ""); }, [towers, tower]);

  const tt = useMemo(() => ts.filter(t => t.tower === tower), [ts, tower]);
  const endOf = (t: VTask) => (basis === "planned" ? t.pe : t.be);
  const trades = useMemo(() => {
    const g = groupBy(tt, t => t.trade);
    // structure first, then by earliest end — reads like the build sequence
    return [...g.entries()].sort((a, b) => Math.min(...a[1].map(endOf)) - Math.min(...b[1].map(endOf))).map(([k]) => k);
  }, [tt, basis]);   // eslint-disable-line react-hooks/exhaustive-deps
  const floors = useMemo(() => {
    const g = groupBy(tt, t => t.floor || "General");
    // like the VisiLean grid: floor ranges (L36 to Terrace … L01 to L05) first, then LMR / terrace / floors
    // top-down to the basements, then shafts, façade and tower-level work
    const key = (lbl: string, x: VTask[]) => {
      const m = lbl.match(/^L0*(\d+)\s*to\b/i);
      if (m) return 2000 + Number(m[1]);
      if (lbl === "General") return -2000;
      const r = Math.min(...x.map(t => t.frank));
      return r >= 500 ? -1000 : r;
    };
    return [...g.entries()].map(([lbl, x]) => ({ lbl, rank: key(lbl, x), ts: x }))
      .sort((a, b) => b.rank - a.rank || a.lbl.localeCompare(b.lbl));
  }, [tt]);
  const cm = ymOf(cut), lm = (() => { const [y, m] = cm.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; })();
  const head = trades.map(tr => {
    const x = tt.filter(t => t.trade === tr);
    const inM = (ym: string) => x.filter(t => endOf(t) >= 0 && ymOf(endOf(t)) === ym);
    const c = inM(cm), l = inM(lm);
    return { tr, x, end: Math.max(...x.map(endOf)), cur: [c.filter(t => t.phase === "done").length, c.length, c], last: [l.filter(t => t.phase === "done").length, l.length, l], tot: [x.filter(t => t.phase === "done").length, x.length] } as const;
  });
  const cellBg = (x: VTask[]) => x.every(t => t.phase === "done") ? C.MINT : x.some(t => t.phase !== "notStarted") ? C.LAV : "#fff";

  return (
    <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        {towers.map(tn => (
          <button key={tn} onClick={() => setTower(tn)}
            style={{ height: 28, padding: "0 13px", borderRadius: 999, border: `1px solid ${tower === tn ? C.GOLD : "#e0dacb"}`, background: tower === tn ? "#fdf6e8" : "#fff", color: tower === tn ? "#96691c" : "var(--mut)", fontWeight: tower === tn ? 800 : 600, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
            {tn}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", border: "1px solid #d8d2c4", borderRadius: 8, overflow: "hidden" }}>
          {(["planned", "baseline"] as const).map(b => (
            <button key={b} onClick={() => setBasis(b)} style={{ height: 32, padding: "0 18px", border: "none", background: basis === b ? "#1b1f2a" : "#fff", color: basis === b ? "#fff" : "var(--ink)", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              {b === "planned" ? "Planned end" : "Baseline end"}
            </button>
          ))}
        </div>
      </div>

      <Zoomable title="Activity tracker" collapsible>
        <div style={CARD}>
          <h3 style={H3}>Activity Tracker — {tower || "—"}</h3>
          <div style={CAP}>
            {fN(tt.length)} activities · cell = {basis} end date and % complete ·{" "}
            <span style={{ background: C.MINT, padding: "0 6px", borderRadius: 3 }}>completed</span>{" "}
            <span style={{ background: C.LAV, padding: "0 6px", borderRadius: 3 }}>started</span>{" "}
            <span style={{ border: "1px solid #e0dacb", padding: "0 6px", borderRadius: 3 }}>not started</span> · click a cell or header → activities
          </div>
          <div style={{ overflow: "auto", maxHeight: 720, border: "1px solid #eae6da", borderRadius: 8 }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ ...stickyHead, left: 0, zIndex: 4, minWidth: 130 }}>Floor</th>
                  {head.map(h => (
                    <th key={h.tr} onClick={() => open({ title: `${tower} · ${h.tr}`, tasks: h.x })} style={{ ...stickyHead, cursor: "pointer", minWidth: 118, maxWidth: 140, whiteSpace: "normal", lineHeight: 1.25 }}
                      onMouseEnter={e => showTip(e, `<b>${h.tr}</b><br/>${fN(h.x.length)} activities · click → list`)} onMouseLeave={hideTip}>{h.tr}</th>
                  ))}
                </tr>
                {([[`${basis === "planned" ? "Planned" : "Baseline"} end date`, (h: typeof head[number]) => fD(h.end), null],
                  ["Completed / this month", (h: typeof head[number]) => `${h.cur[0]} / ${h.cur[1]}`, "cur"],
                  ["Completed / last month", (h: typeof head[number]) => `${h.last[0]} / ${h.last[1]}`, "last"],
                  ["Completed / total", (h: typeof head[number]) => `${h.tot[0]} / ${h.tot[1]}`, null]] as const).map(([lbl, f, key]) => (
                  <tr key={lbl}>
                    <td style={{ ...sumCell, position: "sticky", left: 0, zIndex: 3, fontWeight: 800, background: "#eef6f8" }}>{lbl}</td>
                    {head.map(h => (
                      <td key={h.tr} style={{ ...sumCell, cursor: key ? "pointer" : "default", color: key && (h[key][1] as number) > (h[key][0] as number) ? C.RED : "var(--ink)" }}
                        onClick={() => key && open({ title: `${tower} · ${h.tr} · ${key === "cur" ? "due this month" : "due last month"}`, tasks: h[key][2] as VTask[] })}>{f(h)}</td>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {floors.map(fl => (
                  <tr key={fl.lbl}>
                    <td style={{ ...TD, position: "sticky", left: 0, zIndex: 2, background: "#faf9f6", fontWeight: 800, color: "var(--ink)", borderRight: "1px solid #eae6da" }}>{fl.lbl}</td>
                    {head.map(h => {
                      const x = fl.ts.filter(t => t.trade === h.tr);
                      if (!x.length) return <td key={h.tr} style={{ ...TD, borderRight: "1px solid #f4f1ea" }} />;
                      const pct = sum(x, t => t.prog) / x.length, end = Math.max(...x.map(endOf));
                      const late = x.some(t => t.lateRunning || t.lateStart);
                      return (
                        <td key={h.tr} onClick={() => open({ title: `${tower} · ${fl.lbl} · ${h.tr}`, tasks: x, task: x.length === 1 ? x[0] : undefined })}
                          onMouseEnter={e => showTip(e, `<b>${h.tr} · ${fl.lbl}</b><br/>${x.map(t => t.name).slice(0, 3).join("<br/>")}<br/>${basis} end ${fD(end)} · ${pct.toFixed(0)}%${late ? "<br/><span style='color:#e57373'>delayed</span>" : ""}`)} onMouseLeave={hideTip}
                          style={{ ...TD, background: cellBg(x), cursor: "pointer", borderRight: "1px solid #f4f1ea", padding: "5px 8px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                            <span style={{ fontWeight: 600, color: late ? C.RED : "var(--ink)" }}>{fD(end)}</span>
                            <b style={{ color: pct >= 100 ? "#0f6e56" : pct > 0 ? C.PURPLE : "#b0a890" }}>{pct.toFixed(0)}</b>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!floors.length && <tr><td style={{ ...TD, color: "var(--mut)", padding: 18 }}>No floor-level activities for this tower in the current filters</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </Zoomable>
    </>
  );
}
const stickyHead: React.CSSProperties = { position: "sticky", top: 0, zIndex: 3, background: "#0e7490", color: "#fff", fontSize: 10.5, fontWeight: 800, padding: "8px 8px", textAlign: "left", borderRight: "1px solid rgba(255,255,255,.2)" };
const sumCell: React.CSSProperties = { padding: "5px 8px", background: "#f4fafb", borderBottom: "1px solid #dbe9ec", borderRight: "1px solid #e8f0f2", whiteSpace: "nowrap", fontSize: 10.5 };
