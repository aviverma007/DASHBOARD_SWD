import { useMemo, useState } from "react";
import { showTip, hideTip } from "../../components/common/hoverTip";
import { Zoomable } from "../../components/common/Zoomable";
import {
  CB, WBS_ROWS, PO_ROWS, statusOf, STATUS_LBL, TYPE_LBL, ymOf, ymLbl, fMoney, fN,
} from "../../components/cost/costShared";
import { CostDrillDrawer, type CostDrillSeed, type CostChip } from "../../components/cost/CostDrillDrawer";

/* IT Budget Control reference, generalised company-wide, house style. */
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #eae6da", borderRadius: 14, padding: "16px 18px", boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)" };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 16.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 2px" };
const CAP: React.CSSProperties = { fontSize: 11.5, color: "#b8893c", marginBottom: 12 };
const SEL: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "var(--ink)", background: "#fff", border: "1px solid #d8d2c4", borderRadius: 8, padding: "7px 10px", cursor: "pointer", fontFamily: "inherit", maxWidth: 220 };
const WLBL: React.CSSProperties = { fontSize: 9.5, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: "rgba(255,255,255,.75)", marginBottom: 4 };
const NAVY = "#14213D", TEAL = "#0E7490", GOLD = "#B8893C", GREEN = "#1BAF7A", RED = "#c0392b", AMBER = "#EDA100";
const fShort = (v: number) => (Math.abs(v) >= 1e7 ? `${(v / 1e7).toFixed(1)}Cr` : Math.abs(v) >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : `${Math.round(v / 1000)}k`);
const ST_COL = { healthy: GREEN, watch: AMBER, critical: RED, nobudget: "#8d99ae" } as const;

export default function CostPage() {
  const [typF, setTypF] = useState(0); // -1 all · 0 non-project (reference parity) · 1 project
  const [dept, setDept] = useState(-1);
  const [proj, setProj] = useState("");
  const [staF, setStaF] = useState<"" | "healthy" | "watch" | "critical" | "nobudget">("");
  const [q, setQ] = useState("");
  const [drill, setDrill] = useState<CostDrillSeed | null>(null);
  const [tblSort, setTblSort] = useState<{ k: "budget" | "assigned" | "available" | "pct"; d: boolean }>({ k: "assigned", d: true });

  const projects = useMemo(() => [...new Set(WBS_ROWS.map(w => w.proj))].sort(), []);

  const rows = useMemo(() => WBS_ROWS.filter(w =>
    (typF < 0 || w.typ === typF) && (dept < 0 || w.dept === dept) && (!proj || w.proj === proj) && (!staF || statusOf(w) === staF) &&
    (!q.trim() || w.wbs.toLowerCase().includes(q.trim().toLowerCase()) || w.desc.toLowerCase().includes(q.trim().toLowerCase()))
  ), [typF, dept, proj, staF, q]);
  const wSet = useMemo(() => new Set(rows.map(w => w.i)), [rows]);
  const poRows = useMemo(() => PO_ROWS.filter(p => (typF < 0 || p.typ === typF) && p.w >= 0 && wSet.has(p.w)), [wSet, typF]);

  const budget = rows.reduce((s, w) => s + w.budget, 0);
  const assigned = rows.reduce((s, w) => s + w.assigned, 0);
  const available = rows.reduce((s, w) => s + w.available, 0);
  const util = budget > 0 ? (assigned / budget) * 100 : 0;
  const critWbs = rows.filter(w => statusOf(w) === "critical").length;
  const scopeLabel = [typF >= 0 ? TYPE_LBL[typF] : "All budgets", dept >= 0 ? CB.DEPT[dept] : "All departments", proj || null].filter(Boolean).join(" · ");

  const open = (chips: CostChip[]) => {
    const pre: CostChip[] = [];
    if (typF >= 0 && !chips.some(c => c.dim === "typ")) pre.push({ dim: "typ", val: typF, label: TYPE_LBL[typF] });
    if (dept >= 0 && !chips.some(c => c.dim === "dept")) pre.push({ dim: "dept", val: dept, label: CB.DEPT[dept] });
    if (proj && !chips.some(c => c.dim === "proj")) pre.push({ dim: "proj", val: proj, label: proj });
    if (staF && !chips.some(c => c.dim === "status")) pre.push({ dim: "status", val: staF, label: STATUS_LBL[staF] });
    setDrill({ chips: [...pre, ...chips] });
  };

  // by project (budget vs utilized)
  const byProj = useMemo(() => {
    const m = new Map<string, { b: number; a: number; n: number }>();
    rows.forEach(w => { if (!m.has(w.proj)) m.set(w.proj, { b: 0, a: 0, n: 0 }); const e = m.get(w.proj)!; e.b += w.budget; e.a += w.assigned; e.n++; });
    return [...m.entries()].sort((x, y) => y[1].b - x[1].b);
  }, [rows]);
  const byDept = useMemo(() => {
    const m = new Map<number, { b: number; a: number }>();
    rows.forEach(w => { if (!m.has(w.dept)) m.set(w.dept, { b: 0, a: 0 }); const e = m.get(w.dept)!; e.b += w.budget; e.a += w.assigned; });
    return [...m.entries()].sort((x, y) => y[1].a - x[1].a);
  }, [rows]);
  const health = useMemo(() => {
    const m = { healthy: 0, watch: 0, critical: 0, nobudget: 0 };
    rows.forEach(w => { m[statusOf(w)]++; });
    return m;
  }, [rows]);
  const topWbs = useMemo(() => [...rows].sort((a, b) => b.assigned - a.assigned).slice(0, 10), [rows]);
  const trend = useMemo(() => {
    const m = new Map<string, number>();
    poRows.forEach(p => { if (p.day >= 0) m.set(ymOf(p.day), (m.get(ymOf(p.day)) ?? 0) + p.ordered); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [poRows]);
  const tbl = useMemo(() => {
    const arr = byProj.map(([p, e]) => ({ p, ...e, av: e.b - e.a, pct: e.b > 0 ? (e.a / e.b) * 100 : (e.a > 0 ? 999 : 0) }));
    const { k, d } = tblSort;
    arr.sort((x, y) => (k === "pct" ? x.pct - y.pct : k === "available" ? x.av - y.av : x[k === "budget" ? "b" : "a"] - y[k === "budget" ? "b" : "a"]));
    if (d) arr.reverse();
    return arr;
  }, [byProj, tblSort]);

  const KPI = ({ k, v, s, col, onClick }: { k: string; v: string; s: string; col: string; onClick?: () => void }) => (
    <div onClick={onClick}
      onMouseEnter={e => showTip(e, `<b>${k}</b><br/>${v} · ${s}${onClick ? "<br/>click → drill" : ""}`)}
      onMouseMove={e => showTip(e, `<b>${k}</b><br/>${v}`)} onMouseLeave={hideTip}
      style={{ background: "#fff", border: "1px solid #eae6da", borderLeft: `6px solid ${col}`, borderRadius: 12, boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, minHeight: 58, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${col}1f`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ width: 13, height: 13, borderRadius: "50%", background: col }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 21, fontWeight: 700, color: "var(--ink)", lineHeight: 1, whiteSpace: "nowrap" }}>{v}</div>
        <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "1.1px", textTransform: "uppercase", color: "var(--mut)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k}</div>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8a8474", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s}</div>
      </div>
    </div>
  );

  return (
    <div className="sw-inv" style={{ minHeight: "100vh" }}>
      <div className="tv-zoom-desktop">
      {/* Header + filters in the banner */}
      <div style={{ background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)", padding: "14px 22px", borderBottom: "3px solid var(--gold)" }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 20, color: "#fff", fontWeight: 700 }}>Cost — Budget Control</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 2 }}>
          {fN(WBS_ROWS.length)} WBS elements · {fN(PO_ROWS.length)} PO lines · data as on {CB.meta.asOn} · utilized = actual + commitment
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, marginTop: 12 }}>
          <div>
            <div style={WLBL}>Budget type</div>
            <select style={SEL} value={typF} onChange={e => setTypF(Number(e.target.value))}>
              <option value={-1}>All budgets</option>
              <option value={0}>Non-project (opex)</option>
              <option value={1}>Project</option>
            </select>
          </div>
          <div>
            <div style={WLBL}>Department</div>
            <select style={SEL} value={dept} onChange={e => setDept(Number(e.target.value))}>
              <option value={-1}>All departments</option>
              {CB.DEPT.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <div style={WLBL}>Project</div>
            <select style={SEL} value={proj} onChange={e => setProj(e.target.value)}>
              <option value="">All projects</option>
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <div style={WLBL}>Budget status</div>
            <select style={SEL} value={staF} onChange={e => setStaF(e.target.value as typeof staF)}>
              <option value="">All statuses</option>
              {(Object.keys(STATUS_LBL) as (keyof typeof STATUS_LBL)[]).map(k => <option key={k} value={k}>{STATUS_LBL[k]}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 190 }}>
            <div style={WLBL}>Search WBS</div>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="WBS code / description…"
              style={{ width: "100%", boxSizing: "border-box", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", background: "#fff", padding: "8px 10px", border: "1px solid #d8d2c4", borderRadius: 8, fontFamily: "inherit", outline: "none" }} />
          </div>
          <button onClick={() => { setTypF(0); setDept(-1); setProj(""); setStaF(""); setQ(""); }}
            style={{ border: "1px solid rgba(255,255,255,.4)", background: "rgba(255,255,255,.12)", color: "#fff", fontWeight: 700, fontSize: 12, padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
            ⟲ Reset
          </button>
        </div>
      </div>

      <div style={{ padding: "16px 20px 40px" }}>
        {/* KPI tickets — reference set */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 14 }}>
          <KPI k="Approved budget" v={fMoney(budget)} s={`across ${fN(rows.length)} WBS elements`} col={NAVY} />
          <KPI k="Utilized" v={fMoney(assigned)} s={`of ${fMoney(budget)} · ${util.toFixed(1)}% · ${fN(poRows.length)} PO lines`} col={TEAL} />
          <KPI k="Balance available" v={fMoney(available)} s={`${(100 - util).toFixed(1)}% of ${fMoney(budget)} unspent`} col={GREEN} />
          <KPI k="Utilization" v={`${util.toFixed(1)}%`} s={`${fMoney(assigned)} used vs ${fMoney(budget)} total`} col={util > 95 ? RED : util > 80 ? AMBER : GOLD} />
          <KPI k="WBS at risk" v={fN(critWbs)} s={`critical of ${fN(rows.length)} in scope`} col={RED}
            onClick={() => open([{ dim: "status", val: "critical", label: "Critical (>95%)" }])} />
        </div>

        {/* Row 1: Approved vs Utilized by project · Monthly PO trend */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(430px, 1fr))", gap: 14, marginBottom: 14 }}>
          <Zoomable title="Approved vs utilized by project">
            <div style={{ ...CARD, height: "100%", display: "flex", flexDirection: "column" }}>
              <h3 style={H3}>Approved vs Utilized — by Project</h3>
              <div style={CAP}>navy = budget · teal = utilized · click a project → drill</div>
              <div style={{ flex: 1, minHeight: 0, maxHeight: 330, overflowY: "auto", paddingRight: 6 }}>
                {(() => {
                  const mx = Math.max(...byProj.map(([, e]) => e.b), 1);
                  return byProj.map(([p, e]) => (
                    <div key={p} className="barrow" onClick={() => open([{ dim: "proj", val: p, label: p }])}
                      onMouseEnter={ev => showTip(ev, `<b>${p}</b><br/>Budget — ${fMoney(e.b)}<br/>Utilized — ${fMoney(e.a)} (${e.b > 0 ? ((e.a / e.b) * 100).toFixed(1) : "—"}%)<br/>${fN(e.n)} WBS`)}
                      onMouseMove={ev => showTip(ev, `<b>${p}</b><br/>Budget ${fMoney(e.b)} · Utilized ${fMoney(e.a)}`)} onMouseLeave={hideTip}
                      style={{ padding: "4px 0", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                        <span style={{ color: "var(--ink)", fontWeight: 700 }}>{p}</span>
                        <span style={{ color: "var(--mut)", fontWeight: 700 }}>Utilized {fMoney(e.a)} / Budget {fMoney(e.b)} · {e.b > 0 ? `${((e.a / e.b) * 100).toFixed(1)}%` : "—"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <div style={{ flex: 1, height: 8, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${(e.b / mx) * 100}%`, background: NAVY, borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: NAVY, width: 52, textAlign: "right", flexShrink: 0 }}>{fShort(e.b)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1, height: 8, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${(e.a / mx) * 100}%`, background: TEAL, borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: TEAL, width: 52, textAlign: "right", flexShrink: 0 }}>{fShort(e.a)}</span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </Zoomable>
          <Zoomable title="Monthly PO spend">
            <div style={{ ...CARD, height: "100%", display: "flex", flexDirection: "column" }}>
              <h3 style={H3}>Monthly PO Spend Trend</h3>
              <div style={CAP}>ordered value by document month · click a month → drill</div>
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 3, minHeight: 220, overflowX: "auto", overflowY: "hidden", paddingBottom: 6 }}>
                {(() => {
                  const mx = Math.max(...trend.map(([, v]) => v), 1);
                  return trend.map(([k, v]) => (
                    <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: "1 0 40px", minWidth: 40 }}
                      onClick={() => open([{ dim: "mon", val: k, label: ymLbl(k) }])}
                      onMouseEnter={e => showTip(e, `<b>${ymLbl(k)}</b><br/>${fMoney(v)} ordered<br/>click → drill`)}
                      onMouseMove={e => showTip(e, `<b>${ymLbl(k)}</b><br/>${fMoney(v)}`)} onMouseLeave={hideTip}>
                      <span style={{ fontSize: 8.5, fontWeight: 700, color: TEAL, whiteSpace: "nowrap" }}>{fShort(v)}</span>
                      <div style={{ width: "60%", maxWidth: 22, height: `${(v / mx) * 172}px`, background: TEAL, borderRadius: "3px 3px 0 0", minHeight: 2, cursor: "pointer" }} />
                      <span style={{ fontSize: 9, color: "var(--mut)", whiteSpace: "nowrap" }}>{ymLbl(k)}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </Zoomable>
        </div>

        {/* Row 2: health donut · dept split · top WBS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginBottom: 14 }}>
          <Zoomable title="Budget health">
            <div style={{ ...CARD, height: "100%" }}>
              <h3 style={H3}>Budget Health — WBS by Status</h3>
              <div style={CAP}>click a status → drill</div>
              {(() => {
                const items = (Object.keys(health) as (keyof typeof health)[]).filter(k => health[k] > 0)
                  .map(k => ({ k, v: health[k] }));
                const tot = Math.max(items.reduce((s, i) => s + i.v, 0), 1);
                const R = 62, C = 2 * Math.PI * R;
                let off = 0;
                return (
                  <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", justifyContent: "center", minHeight: 190 }}>
                    <svg width={170} height={170} viewBox="0 0 170 170" style={{ flexShrink: 0 }}>
                      {items.map(it => {
                        const dash = (it.v / tot) * C, o = off; off += dash;
                        return (
                          <circle key={it.k} cx={85} cy={85} r={R} fill="none" stroke={ST_COL[it.k]} strokeWidth={26}
                            strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-o} transform="rotate(-90 85 85)"
                            style={{ cursor: "pointer" }}
                            onClick={() => open([{ dim: "status", val: it.k, label: STATUS_LBL[it.k] }])}
                            onMouseEnter={e => showTip(e, `<b>${STATUS_LBL[it.k]}</b><br/>${fN(it.v)} WBS (${((it.v / tot) * 100).toFixed(1)}%)`)}
                            onMouseMove={e => showTip(e, `<b>${STATUS_LBL[it.k]}</b><br/>${fN(it.v)} WBS`)} onMouseLeave={hideTip} />
                        );
                      })}
                      <text x={85} y={82} textAnchor="middle" style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 700, fill: "var(--ink)" }}>{fN(tot)}</text>
                      <text x={85} y={99} textAnchor="middle" style={{ fontSize: 9, fill: "var(--mut)", letterSpacing: 1 }}>WBS</text>
                    </svg>
                    <div style={{ flex: 1, minWidth: 130 }}>
                      {items.map(it => (
                        <div key={it.k} onClick={() => open([{ dim: "status", val: it.k, label: STATUS_LBL[it.k] }])}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer" }}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: ST_COL[it.k] }} />
                          <span style={{ fontSize: 12.5, color: "var(--ink)", flex: 1 }}>{STATUS_LBL[it.k]}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{fN(it.v)} <span style={{ color: "var(--mut)", fontWeight: 600 }}>({((it.v / tot) * 100).toFixed(1)}%)</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </Zoomable>
          <Zoomable title="Department split">
            <div style={{ ...CARD, height: "100%" }}>
              <h3 style={H3}>Utilized by Department</h3>
              <div style={CAP}>click a department → drill</div>
              <div style={{ maxHeight: 240, overflowY: "auto", paddingRight: 6 }}>
                {(() => {
                  const mx = Math.max(...byDept.map(([, e]) => e.a), 1);
                  return byDept.map(([k, e]) => (
                    <div key={k} className="barrow" onClick={() => open([{ dim: "dept", val: k, label: CB.DEPT[k] }])}
                      onMouseEnter={ev => showTip(ev, `<b>${CB.DEPT[k]}</b><br/>Utilized — ${fMoney(e.a)}<br/>Budget — ${fMoney(e.b)} (${e.b > 0 ? ((e.a / e.b) * 100).toFixed(1) : "—"}%)`)}
                      onMouseMove={ev => showTip(ev, `<b>${CB.DEPT[k]}</b><br/>${fMoney(e.a)}`)} onMouseLeave={hideTip}
                      style={{ padding: "4px 0", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2, gap: 8 }}>
                        <span style={{ color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{CB.DEPT[k]}</span>
                        <span style={{ color: "var(--mut)", fontWeight: 700, whiteSpace: "nowrap" }}>{fMoney(e.a)} / {fMoney(e.b)} · {e.b > 0 ? `${((e.a / e.b) * 100).toFixed(0)}%` : "—"}</span>
                      </div>
                      <div style={{ height: 8, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(e.a / mx) * 100}%`, background: GOLD, borderRadius: 5 }} />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </Zoomable>
          <Zoomable title="Top WBS">
            <div style={{ ...CARD, height: "100%" }}>
              <h3 style={H3}>Top 10 WBS by Utilization</h3>
              <div style={CAP}>red = utilized · pale = budget · click → drill</div>
              <div style={{ maxHeight: 240, overflowY: "auto", paddingRight: 6 }}>
                {(() => {
                  const mx = Math.max(...topWbs.map(w => Math.max(w.budget, w.assigned)), 1);
                  return topWbs.map(w => (
                    <div key={w.i} className="barrow" onClick={() => open([{ dim: "wbs", val: w.i, label: w.wbs }])}
                      onMouseEnter={e => showTip(e, `<b>${w.wbs}</b><br/>${w.desc}<br/>Utilized — ${fMoney(w.assigned)} of ${fMoney(w.budget)} (${w.budget > 0 ? ((w.assigned / w.budget) * 100).toFixed(0) : "—"}%)`)}
                      onMouseMove={e => showTip(e, `<b>${w.wbs}</b><br/>${fMoney(w.assigned)}`)} onMouseLeave={hideTip}
                      style={{ padding: "3.5px 0", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 2, gap: 8 }}>
                        <span style={{ color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.wbs}</span>
                        <span style={{ color: "var(--mut)", fontWeight: 700, whiteSpace: "nowrap" }}>{fMoney(w.assigned)} of {fMoney(w.budget)}{w.budget > 0 ? ` (${((w.assigned / w.budget) * 100).toFixed(0)}%)` : ""}</span>
                      </div>
                      <div style={{ height: 6, background: "#f0ede5", borderRadius: 4, overflow: "hidden", position: "relative", marginBottom: 2 }}>
                        <div style={{ position: "absolute", inset: 0, width: `${(w.budget / mx) * 100}%`, background: "#c6d3e3", borderRadius: 4 }} />
                        <div style={{ position: "absolute", inset: 0, width: `${(w.assigned / mx) * 100}%`, background: RED, borderRadius: 4 }} />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </Zoomable>
        </div>

        {/* Project-wise summary table */}
        <Zoomable title="Project-wise summary">
          <div style={{ ...CARD, marginBottom: 14 }}>
            <h3 style={H3}>Project-wise Summary</h3>
            <div style={CAP}>click a heading to sort · click a row → drill</div>
            <div style={{ maxHeight: 380, overflowY: "auto", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 680 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #eae6da", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>
                    <th style={{ textAlign: "left", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "7px 8px 7px 0" }}>Project</th>
                    {([["budget", "Approved"], ["assigned", "Utilized"], ["available", "Balance"], ["pct", "% Utilized"]] as const).map(([k, l]) => (
                      <th key={k} onClick={() => setTblSort(p => ({ k, d: p.k === k ? !p.d : true }))}
                        style={{ textAlign: "right", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: tblSort.k === k ? TEAL : "var(--mut)", padding: "7px 8px", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                        {l}{tblSort.k === k ? (tblSort.d ? " ↓" : " ↑") : ""}
                      </th>
                    ))}
                    <th style={{ textAlign: "left", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "7px 0 7px 8px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tbl.map(r => {
                    const st = r.pct > 95 ? "critical" : r.pct > 80 ? "watch" : "healthy";
                    return (
                      <tr key={r.p} onClick={() => open([{ dim: "proj", val: r.p, label: r.p }])}
                        style={{ borderBottom: "1px solid #f0ede5", cursor: "pointer" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                        <td style={{ padding: "7px 8px 7px 0", fontWeight: 700, color: "var(--ink)" }}>{r.p}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right" }}>{fMoney(r.b)}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right" }}>{fMoney(r.a)}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right" }}>{fMoney(r.av)}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: ST_COL[st] }}>{r.pct >= 999 ? "—" : `${r.pct.toFixed(1)}%`}</td>
                        <td style={{ padding: "7px 0 7px 8px" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 6, padding: "2px 8px", background: `${ST_COL[st]}22`, color: ST_COL[st] }}>{st.toUpperCase()}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Zoomable>

        {/* WBS-wise detail */}
        <Zoomable title="WBS-wise detail">
          <div style={{ ...CARD }}>
            <h3 style={H3}>WBS-wise Detail</h3>
            <div style={CAP}>{fN(rows.length)} WBS in scope · click a row → drill (PO lines inside)</div>
            <div style={{ maxHeight: 420, overflowY: "auto", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 860 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #eae6da", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>
                    {["Department", "Project", "WBS", "Description", "Approved", "Utilized", "% Util", "Status"].map(h => (
                      <th key={h} style={{ textAlign: ["Approved", "Utilized", "% Util"].includes(h) ? "right" : "left", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "7px 8px 7px 0", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...rows].sort((a, b) => b.assigned - a.assigned).map(w => {
                    const st = statusOf(w);
                    const pct = w.budget > 0 ? (w.assigned / w.budget) * 100 : null;
                    return (
                      <tr key={w.i} onClick={() => open([{ dim: "wbs", val: w.i, label: w.wbs }])}
                        style={{ borderBottom: "1px solid #f0ede5", cursor: "pointer" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                        <td style={{ padding: "6px 8px 6px 0", whiteSpace: "nowrap" }}>{CB.DEPT[w.dept]}</td>
                        <td style={{ padding: "6px 8px 6px 0", whiteSpace: "nowrap", fontWeight: 600 }}>{w.proj}</td>
                        <td style={{ padding: "6px 8px 6px 0", whiteSpace: "nowrap", color: TEAL, fontWeight: 700 }}>{w.wbs}</td>
                        <td style={{ padding: "6px 8px 6px 0", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.desc}</td>
                        <td style={{ padding: "6px 8px 6px 0", textAlign: "right", whiteSpace: "nowrap" }}>{fMoney(w.budget)}</td>
                        <td style={{ padding: "6px 8px 6px 0", textAlign: "right", whiteSpace: "nowrap" }}>{fMoney(w.assigned)}</td>
                        <td style={{ padding: "6px 8px 6px 0", textAlign: "right", fontWeight: 700, color: ST_COL[st], whiteSpace: "nowrap" }}>{pct === null ? "—" : `${pct.toFixed(1)}%`}</td>
                        <td style={{ padding: "6px 0 6px 0" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 6, padding: "2px 8px", background: `${ST_COL[st]}22`, color: ST_COL[st] }}>{st === "nobudget" ? "NO BUDGET" : st.toUpperCase()}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Zoomable>
      </div>
      </div>

      <CostDrillDrawer
        seed={drill}
        baseLabel={scopeLabel}
        onClose={() => setDrill(null)}
        onAddChip={(chip: CostChip) => setDrill(d => (d && !d.chips.some(c => c.dim === chip.dim) ? { chips: [...d.chips, chip] } : d))}
      />
    </div>
  );
}
