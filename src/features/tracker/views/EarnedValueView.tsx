import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Zoomable } from "../../../components/common/Zoomable";
import { showTip, hideTip } from "../../../components/common/hoverTip";
import { type VTask, type EVPoint, fCr, fN, fPct, earned, sCurve, groupBy, towerOrder, ymLbl, ymOf, ymEnd, VL } from "../vlData";
import { C, CARD, H3, CAP, TH, TD, R, GlassRow, TaskTable, hoverRow, type VDrill } from "../vlUi";

const cr = (v: number) => `₹${(v / 1e7).toFixed(2)}`;

/** VisiLean "Earned Value Variance Report": budget, BCWS, earned value, S-curve, tower and type-of-work split, task list. */
export function EarnedValueView({ ts, cut, open }: { ts: VTask[]; cut: number; open: (d: VDrill) => void }) {
  const costed = useMemo(() => ts.filter(t => t.cost > 0), [ts]);
  const e = earned(costed, cut);
  const curve = useMemo(() => sCurve(costed, cut), [costed, cut]);
  const cm = ymOf(cut), lmIdx = curve.findIndex(p => p.ym === cm) - 1, lm = lmIdx >= 0 ? curve[lmIdx] : null;
  const towers = useMemo(() => {
    const g = groupBy(costed, t => t.tower);
    return towerOrder([...g.keys()]).map(k => ({ k, ts: g.get(k)!, ...earned(g.get(k)!, cut) }));
  }, [costed, cut]);
  const [openType, setOpenType] = useState<string | null>(null);
  const types = useMemo(() => VL.TYPES.map(ty => {
    const x = costed.filter(t => t.type === ty);
    const trades = [...groupBy(x, t => t.trade).entries()].map(([k, v]) => ({ k, ts: v, ...earned(v, cut) })).sort((a, b) => b.budget - a.budget);
    return { ty, ts: x, ...earned(x, cut), trades };
  }).filter(t => t.ts.length), [costed, cut]);
  const tasksByCost = useMemo(() => [...costed].sort((a, b) => a.type.localeCompare(b.type) || a.tower.localeCompare(b.tower, "en", { numeric: true }) || a.bs - b.bs), [costed]);
  const tOpen = (t: VTask) => open({ title: t.tower, tasks: [t], task: t });

  if (!costed.length) return <div style={{ ...CARD, color: "var(--mut)" }}>No baseline cost on the activities in the current filters — earned value needs the VisiLean <b>Cost</b> column.</div>;
  const row = (k: string, x: ReturnType<typeof earned>, onClick: () => void, opts: { bold?: boolean; indent?: boolean; caret?: string } = {}) => (
    <tr key={k} onClick={onClick} style={{ cursor: "pointer", background: opts.bold ? "#faf9f6" : undefined }} {...(opts.bold ? {} : hoverRow)}>
      <td style={{ ...TD, fontWeight: opts.indent ? 600 : 800, paddingLeft: opts.indent ? 28 : 10, color: "var(--ink)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{opts.caret}{k}</td>
      {[x.budget, x.blTill, x.bcwsTill, x.ev].map((v, i) => <td key={i} style={{ ...TD, ...R, fontWeight: opts.indent ? 500 : 700 }}>{v ? cr(v) : ""}</td>)}
      {[x.blPct, x.bcwsPct, x.evPct].map((v, i) => <td key={i} style={{ ...TD, ...R }}>{fPct(v, 2)}</td>)}
      <td style={{ ...TD, ...R, color: x.varBl > 0 ? C.RED : C.GREEN, fontWeight: 700 }}>{x.varBl ? cr(x.varBl) : ""}</td>
      <td style={{ ...TD, ...R }}>{x.budget ? fPct((x.varBl / x.budget) * 100, 2) : ""}</td>
      <td style={{ ...TD, ...R, color: x.variance > 0 ? C.RED : C.GREEN, fontWeight: 700 }}>{x.variance ? cr(x.variance) : ""}</td>
      <td style={{ ...TD, ...R }}>{x.budget ? fPct((x.variance / x.budget) * 100, 2) : ""}</td>
    </tr>
  );

  return (
    <>
      <GlassRow items={[
        { k: "Overall budgeted cost", v: fCr(e.budget), s: `${fN(costed.length)} costed activities`, c: ["#1c3f6e", "#0f2547"], go: () => open({ title: "All costed activities", tasks: costed }) },
        { k: "BCWS to date", v: fCr(e.bcwsTill), s: `${fPct(e.bcwsPct)} · planned value by ${ymLbl(cm)}`, c: ["#1a7f9c", "#0e5468"], go: () => open({ title: "Planned to be done by now", tasks: costed.filter(t => t.ps >= 0 && t.ps <= cut) }) },
        { k: "Earned value", v: fCr(e.ev), s: `${fPct(e.evPct)} · baseline cost × progress`, c: ["#1e9a6c", "#0f6647"], go: () => open({ title: "Activities with progress", tasks: costed.filter(t => t.prog > 0) }) },
        { k: "Variance", v: fCr(e.variance), s: `BCWS − earned · vs baseline ${fCr(e.varBl)}`, c: e.variance > 0 ? ["#c0392b", "#7e1f14"] : ["#1e9a6c", "#0f6647"], go: () => open({ title: "Behind plan", sub: "planned value not yet earned", tasks: costed.filter(t => t.ps >= 0 && t.ps <= cut && t.prog < 100) }) },
        { k: `BCWS ${lm ? ymLbl(lm.ym) : "last month"}`, v: lm ? fCr(lm.bcws) : "—", s: "planned value of last month", c: ["#6b4fa0", "#3f2a73"], go: () => lm && monthDrill(lm) },
        { k: `Earned ${lm ? ymLbl(lm.ym) : "last month"}`, v: lm && lm.ev !== null ? fCr(lm.ev) : "—", s: "spread over actual dates", c: ["#c99a3a", "#96691c"], go: () => lm && monthDrill(lm) },
      ]} />

      <Zoomable title="S-curve" collapsible>
        <div style={CARD}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", paddingRight: 64 }}>
            <div>
              <h3 style={H3}>S-Curve (Earned Value)</h3>
              <div style={CAP}>monthly bars + cumulative lines · baseline & BCWS spread by working days (Mon–Sat) · earned value spread over each task's actual dates · click a month → its activities</div>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 11, fontWeight: 700, color: "var(--mut)", flexWrap: "wrap" }}>
              <span><span style={{ color: "#c9c3b4" }}>■</span> Baseline</span><span><span style={{ color: "#8fb8c4" }}>■</span> BCWS</span><span><span style={{ color: C.TEAL }}>■</span> Earned</span>
              <span><span style={{ color: "#e0457b" }}>—</span> Cum. baseline</span><span><span style={{ color: "#7fcfc0" }}>—</span> Cum. BCWS</span><span><span style={{ color: C.TEAL }}>—</span> Cum. earned</span>
            </div>
          </div>
          <SCurveChart data={curve} cutYm={cm} onMonth={monthDrill} />
        </div>
      </Zoomable>

      <Zoomable title="Progress by tower" collapsible>
        <div style={CARD}>
          <h3 style={H3}>Progress Analysis — Planned vs Achieved % by Tower</h3>
          <div style={CAP}>cost-weighted · <span style={{ color: "#8fd3c8", fontWeight: 800 }}>■</span> BCWS % till date · <span style={{ color: C.TEAL, fontWeight: 800 }}>■</span> earned % · click → tower activities</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 210, overflowX: "auto", padding: "18px 4px 0" }}>
            {towers.map(tw => (
              <div key={tw.k} onClick={() => open({ title: `${tw.k} — earned value`, tasks: tw.ts })} style={{ flex: "1 0 58px", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", height: "100%" }}
                onMouseEnter={ev => showTip(ev, `<b>${tw.k}</b><br/>budget ${fCr(tw.budget)}<br/>BCWS ${fCr(tw.bcwsTill)} (${fPct(tw.bcwsPct)})<br/>earned ${fCr(tw.ev)} (${fPct(tw.evPct)})`)} onMouseLeave={hideTip}>
                <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3 }}>
                  {[[tw.bcwsPct, "#8fd3c8"], [tw.evPct, C.TEAL]].map(([v, c], i) => (
                    <div key={i} style={{ width: 18, height: `${Math.max(Number(v), 0.5)}%`, background: c as string, borderRadius: "3px 3px 0 0", position: "relative" }}>
                      <span style={{ position: "absolute", top: -15, left: "50%", transform: "translateX(-50%)", fontSize: 9.5, fontWeight: 800, color: "var(--mut)", whiteSpace: "nowrap" }}>{Number(v) >= 10 ? Math.round(Number(v)) : Number(v).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--mut)", marginTop: 5, whiteSpace: "nowrap" }}>{tw.k}</div>
              </div>
            ))}
          </div>
        </div>
      </Zoomable>

      <Zoomable title="Type of work" collapsible>
        <div style={CARD}>
          <h3 style={H3}>Earned Value by Type of Work</h3>
          <div style={CAP}>click a type to open its trades · click a trade → activities · variance = planned − earned (red = behind)</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1180 }}>
              <thead><tr>{["Type of work", "Overall budget", "Baseline till date", "BCWS till date", "Earned value", "Baselined %", "Planned %", "Earned %", "Var. vs baseline", "Var. %", "Var. vs BCWS", "Var. %"].map((h, i) => <th key={h + i} style={{ ...TH, ...(i ? R : {}) }}>{h}</th>)}</tr></thead>
              <tbody>
                {types.map(ty => (
                  <React.Fragment key={ty.ty}>
                    {row(ty.ty, ty, () => setOpenType(o => (o === ty.ty ? null : ty.ty)), { caret: openType === ty.ty ? "⊟ " : "⊞ " })}
                    {openType === ty.ty && ty.trades.map(tr => row(tr.k, tr, () => open({ title: `${ty.ty} · ${tr.k}`, tasks: tr.ts }), { indent: true }))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>{row("Total", e, () => open({ title: "All costed activities", tasks: costed }), { bold: true })}</tfoot>
            </table>
          </div>
        </div>
      </Zoomable>

      <Zoomable title="Task list" collapsible>
        <div style={CARD}>
          <h3 style={H3}>Activity Cost List</h3>
          <div style={CAP}>every costed activity · total {fCr(e.budget)} · click a row → detail</div>
          <TaskTable tasks={tasksByCost} onPick={tOpen} cols="cost" limit={400} cut={cut} />
        </div>
      </Zoomable>
    </>
  );

  function monthDrill(p: EVPoint) {
    const s = ymEnd(p.ym) - 30, en = ymEnd(p.ym);
    open({ title: `${ymLbl(p.ym)} — earned value`, sub: `baseline ${fCr(p.bl)} · BCWS ${fCr(p.bcws)} · earned ${p.ev === null ? "—" : fCr(p.ev)}`,
      tasks: costed.filter(t => (t.ps <= en && t.pe >= s) || (t.bs <= en && t.be >= s) || (t.as >= 0 && t.as <= en && (t.ae < 0 || t.ae >= s))) });
  }
}

function SCurveChart({ data, cutYm, onMonth }: { data: EVPoint[]; cutYm: string; onMonth: (p: EVPoint) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(es => setW(es[0].contentRect.width));
    ro.observe(ref.current); return () => ro.disconnect();
  }, []);
  const W = Math.max(w, 420), H = 330, ML = 52, MR = 56, MT = 14, MB = 40;
  const pw = W - ML - MR, ph = H - MT - MB, n = Math.max(data.length, 1), band = pw / n;
  const bw = Math.max(1.5, Math.min(7, band * 0.26));
  const hiBar = Math.max(...data.map(p => Math.max(p.bl, p.bcws, p.ev ?? 0)), 1);
  const hiCum = Math.max(...data.map(p => Math.max(p.cBl, p.cBcws, p.cEv ?? 0)), 1);
  const yb = (v: number) => MT + ph - (v / hiBar) * ph, yc = (v: number) => MT + ph - (v / hiCum) * ph;
  const x = (i: number) => ML + i * band + band / 2;
  const line = (f: (p: EVPoint) => number | null) => data.map((p, i) => [i, f(p)] as const).filter(([, v]) => v !== null)
    .map(([i, v], j) => `${j ? "L" : "M"}${x(i).toFixed(1)},${yc(v as number).toFixed(1)}`).join(" ");
  const step = Math.max(1, Math.ceil(n / Math.max(6, Math.floor(pw / 46))));
  const cutI = data.findIndex(p => p.ym === cutYm);
  return (
    <div ref={ref} style={{ width: "100%", overflow: "hidden" }}>
      {w > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }} role="img" aria-label="Earned value S-curve">
          {[0, 0.25, 0.5, 0.75, 1].map(f => (
            <g key={f}>
              <line x1={ML} x2={W - MR} y1={MT + ph * (1 - f)} y2={MT + ph * (1 - f)} stroke="#eae6da" />
              <text x={ML - 6} y={MT + ph * (1 - f) + 3.5} textAnchor="end" style={{ fontSize: 9.5, fontWeight: 700, fill: "var(--mut)" }}>₹{((hiBar * f) / 1e7).toFixed(0)}</text>
              <text x={W - MR + 6} y={MT + ph * (1 - f) + 3.5} style={{ fontSize: 9.5, fontWeight: 700, fill: "var(--mut)" }}>{((hiCum * f) / 1e7).toFixed(0)}</text>
            </g>
          ))}
          <text x={12} y={MT + ph / 2} transform={`rotate(-90 12 ${MT + ph / 2})`} textAnchor="middle" style={{ fontSize: 9.5, fill: "var(--mut)" }}>monthly (₹ Cr)</text>
          <text x={W - 10} y={MT + ph / 2} transform={`rotate(90 ${W - 10} ${MT + ph / 2})`} textAnchor="middle" style={{ fontSize: 9.5, fill: "var(--mut)" }}>cumulative (₹ Cr)</text>
          {cutI >= 0 && <line x1={x(cutI) + band / 2} x2={x(cutI) + band / 2} y1={MT} y2={MT + ph} stroke="#b8893c" strokeDasharray="4 3" />}
          {data.map((p, i) => (
            <g key={p.ym} style={{ cursor: "pointer" }} onClick={() => onMonth(p)}
              onMouseEnter={ev => showTip(ev, `<b>${ymLbl(p.ym)}</b><br/>Baseline ${cr(p.bl)} · BCWS ${cr(p.bcws)}${p.ev !== null ? ` · Earned ${cr(p.ev)}` : ""}<br/>Cumulative: baseline ${cr(p.cBl)} · BCWS ${cr(p.cBcws)}${p.cEv !== null ? ` · earned ${cr(p.cEv)}` : ""}<br/>click → activities`)}
              onMouseMove={ev => showTip(ev, `<b>${ymLbl(p.ym)}</b> earned ${p.ev !== null ? cr(p.ev) : "—"}`)} onMouseLeave={hideTip}>
              <rect x={ML + i * band} y={MT} width={band} height={ph} fill="transparent" />
              <rect x={x(i) - bw * 1.5} y={yb(p.bl)} width={bw} height={MT + ph - yb(p.bl)} fill="#c9c3b4" />
              <rect x={x(i) - bw / 2} y={yb(p.bcws)} width={bw} height={MT + ph - yb(p.bcws)} fill="#8fb8c4" />
              {p.ev !== null && <rect x={x(i) + bw / 2} y={yb(Math.max(p.ev, 0))} width={bw} height={MT + ph - yb(Math.max(p.ev, 0))} fill={C.TEAL} />}
              {(i % step === 0 || i === n - 1) && <text x={x(i)} y={H - 22} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 700, fill: "var(--mut)" }}>{ymLbl(p.ym)}</text>}
            </g>
          ))}
          <path d={line(p => p.cBl)} fill="none" stroke="#e0457b" strokeWidth={1.8} />
          <path d={line(p => p.cBcws)} fill="none" stroke="#7fcfc0" strokeWidth={1.8} />
          <path d={line(p => p.cEv)} fill="none" stroke={C.TEAL} strokeWidth={2.4} />
          {cutI >= 0 && data[cutI].cEv !== null && <circle cx={x(cutI)} cy={yc(data[cutI].cEv!)} r={4} fill="#fff" stroke={C.TEAL} strokeWidth={2} />}
        </svg>
      )}
    </div>
  );
}
