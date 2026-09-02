import { useMemo, useState } from "react";
import { PDRN, ALL_INVR_PROJECTS, calcProjectStats, type ProjectStats } from "../../utils/pdrnLogic";
import {
  type Bk, type Dim, BROKERS, ROWS, CANCELLED,
  MON, fN, CRf, ymKey, qKey, fyKey, ymLbl, PSHORT, BANDS, bandOf,
} from "../../components/bookings/bookingsShared";
import { BookingsDrillDrawer, type BkDrillSeed } from "../../components/bookings/BookingsDrillDrawer";

import { PdrnDrawer } from "../../components/overview/PdrnDrawer";
import { showTip, hideTip } from "../../components/common/hoverTip";
import { Zoomable } from "../../components/common/Zoomable";
import {
  HBarListRaw as HBarList, Donut, Banner,
  CARD, H3, CAP, SEL, SELLBL, BLUE, TEAL, GOLD, GREEN,
} from "../../components/leads/footfallCharts";
import { AnimatePresence, motion } from "framer-motion";
import "../../components/inventory/smartworldInventory.css";

/** BOOKINGS — modelled on the reference suite's Bookings tab, driven
 * by the PDRN export we already ship (active bookings). The HTML's
 * collection / cancellation / broker / geography KPIs need columns
 * the PDRN export doesn't carry — those KPI slots are kept but
 * marked, and every computable metric is exact. */

export function BookingsPage() {
  const [drill, setDrill] = useState<BkDrillSeed | null>(null);
  const [selProjects, setSelProjects] = useState<number[]>([]);
  const [projOpen, setProjOpen] = useState(false);
  /** Period pills (All time / Year / Quarter / Month) + a key select
   * for the chosen granularity — matches the Overview control. */
  const [perMode, setPerMode] = useState<"all" | "y" | "q" | "m" | "c">("all");
  const [perKey, setPerKey] = useState<string>("");
  const [cFrom, setCFrom] = useState<string>("");
  const [cTo, setCTo] = useState<string>("");
  const [gran, setGran] = useState<"m" | "q" | "y">("m");
  const [mgran, setMgran] = useState<"q" | "y">("q");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Bk | null>(null);
  const [projDrawer, setProjDrawer] = useState<ProjectStats | null>(null);
  /** Same rich project drill as the Overview page: full PDRN drawer
   * with rate extremes, tower/floor/unit levels. */
  function openProject(pdrnIdx: number) {
    const name = PDRN.P[pdrnIdx];
    const inv = ALL_INVR_PROJECTS.find(p => p.name === name);
    if (!inv) return;
    setProjDrawer(calcProjectStats(inv.idx, { type: "all" }, name));
  }
  const [mA, setMA] = useState<string | null>(null);
  const [mB, setMB] = useState<string | null>(null);

  const allMonths = useMemo(() => [...new Set(ROWS.map(ymKey))].filter(k => k !== "undated").sort(), []);
  const perOptions = useMemo(() => {
    const clean = (a: string[]) => a.filter(k => k !== "undated").sort().reverse();
    if (perMode === "y") return clean([...new Set(ROWS.map(fyKey))]);
    if (perMode === "q") return clean([...new Set(ROWS.map(qKey))]);
    if (perMode === "m") return clean([...new Set(ROWS.map(ymKey))]);
    return [];
  }, [perMode]);
  const perSel = perKey && perOptions.includes(perKey) ? perKey : perOptions[0] ?? "";
  const cF = cFrom || allMonths[0], cT = cTo || allMonths[allMonths.length - 1];
  const inPeriod = (b: Bk) => {
    if (perMode === "all") return true;
    if (perMode === "y") return fyKey(b) === perSel;
    if (perMode === "q") return qKey(b) === perSel;
    if (perMode === "m") return ymKey(b) === perSel;
    const k = ymKey(b); return k >= cF && k <= cT; // custom month range
  };
  const inProjects = (b: Bk) => selProjects.length === 0 || selProjects.includes(b.p);
  const rows = useMemo(() => ROWS.filter(b => inPeriod(b) && inProjects(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perMode, perSel, selProjects]);

  const total = rows.length;
  const tcv = rows.reduce((s, b) => s + b.tsv, 0);
  const areaL = rows.reduce((s, b) => s + b.area, 0) / 1e5;
  const avgTicket = total ? tcv / total : 0;
  const avgRate = rows.reduce((s, b) => s + b.area, 0) ? tcv / rows.reduce((s, b) => s + b.area, 0) : 0;
  const vT = rows.reduce((s, b) => s + b.tcvT, 0);
  const recT = rows.reduce((s, b) => s + b.rec, 0);
  const vN = rows.reduce((s, b) => s + b.valN, 0);
  const recNs = rows.reduce((s, b) => s + b.recN, 0);
  const dueNow = rows.reduce((s, b) => s + Math.max(b.due, 0), 0);
  const cancelled = useMemo(() => CANCELLED.filter(b => inPeriod(b) && inProjects(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perMode, perSel, selProjects]);

  /** Every card click opens the side drill drawer (like the other
   * tabs) instead of adding an inline chip. */
  function openDrill(dim: Dim) {
    return (val: number | string, label: string) => setDrill({ dim, val, label });
  }

  const listFrom = (get: (b: Bk) => number, names: string[]) => {
    const m = new Map<number, number>();
    rows.forEach(b => { const k = get(b); if (k >= 0) m.set(k, (m.get(k) ?? 0) + 1); });
    return [...m.entries()].map(([key, value]) => ({ key, label: names[key], value })).sort((a, b) => b.value - a.value);
  };

  // ── trend: value bars + count line, M/Q/Y ──
  const trend = useMemo(() => {
    const key = gran === "m" ? ymKey : gran === "q" ? qKey : fyKey;
    const lbl = gran === "m" ? ymLbl : (k: string) => (gran === "q" ? `Q${k.split("-Q")[1]} FY${k.slice(2, 4)}` : `FY${k.slice(2)}`);
    const m = new Map<string, { n: number; v: number }>();
    rows.forEach(b => { const k = key(b); if (!m.has(k)) m.set(k, { n: 0, v: 0 }); const e = m.get(k)!; e.n++; e.v += b.tsv; });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, e]) => ({ key: k, label: lbl(k), n: e.n, v: e.v }));
  }, [rows, gran]);

  // ── momentum periods ──
  const mkeys = useMemo(() => {
    const key = mgran === "q" ? qKey : fyKey;
    return [...new Set(ROWS.map(key))].sort();
  }, [mgran]);
  const A = mA && mkeys.includes(mA) ? mA : mkeys[mkeys.length - 2] ?? mkeys[0];
  const Bp = mB && mkeys.includes(mB) ? mB : mkeys[mkeys.length - 1];
  const perStat = (k: string) => {
    const key = mgran === "q" ? qKey : fyKey;
    const a = rows.filter(b => key(b) === k);
    const v = a.reduce((s, b) => s + b.tsv, 0);
    return { n: a.length, v, avg: a.length ? v / a.length : 0 };
  };
  const sA = perStat(A), sB = perStat(Bp);
  const delta = (a: number, b: number) => !a ? "—" : `${b >= a ? "▲ +" : "▼ "}${Math.abs(Math.round(((b - a) / a) * 100))}%`;
  const dColor = (a: number, b: number) => !a ? "var(--mut)" : b >= a ? "#1a7a4a" : "#c0392b";
  const perLbl = (k: string) => mgran === "q" ? `Q${k.split("-Q")[1]} FY${k.slice(2, 4)}` : `FY ${k.slice(2)}`;

  // ── records ──
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const arr = [...rows].sort((a, b) => (b.y - a.y) || (b.m - a.m) || (b.tsv - a.tsv));
    if (!s) return arr;
    return arr.filter(b => PSHORT[b.p].toLowerCase().includes(s) || PDRN.CFG[b.cfg].toLowerCase().includes(s) || b.unit.toLowerCase().includes(s) || b.name.toLowerCase().includes(s) || PDRN.TW[b.tw]?.toLowerCase().includes(s));
  }, [rows, q]);
  const PER = 10;
  const pages = Math.max(1, Math.ceil(filtered.length / PER));
  const shown = filtered.slice((page - 1) * PER, page * PER);


  const perLabel =
    perMode === "all" ? "all time" :
    perMode === "y" ? `FY ${perSel.slice(2)}` :
    perMode === "q" ? `Q${perSel.split("-Q")[1]} FY${perSel.slice(2, 4)}` :
    perMode === "m" ? (perSel ? ymLbl(perSel) : "") :
    `${ymLbl(cF)} → ${ymLbl(cT)}`;
  const scopeLabel = `${selProjects.length ? (selProjects.length === 1 ? PSHORT[selProjects[0]] : selProjects.length + " projects") + " · " : ""}${perLabel}`;

  const KPI = ({ k, v, s }: { k: string; v: string; s: string }) => (
    <div style={{ ...CARD, padding: "13px 16px" }}
      onMouseEnter={e => showTip(e, `<b>${k}</b><br/>${v} · ${s}`)}
      onMouseMove={e => showTip(e, `<b>${k}</b><br/>${v} · ${s}`)}
      onMouseLeave={hideTip}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 21, fontWeight: 700, color: "var(--ink)", marginTop: 3 }}>{v}</div>
      <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 1 }}>{s}</div>
    </div>
  );

  const ROW: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 14, marginBottom: 14, alignItems: "start" };
  const seg = (on: boolean): React.CSSProperties => ({ border: "none", background: on ? "#B8893C" : "transparent", color: on ? "#fff" : "var(--mut)", fontWeight: 700, fontSize: 12, padding: "5px 14px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit" });

  // trend svg geometry
  const TW_ = Math.max(trend.length * 46, 320), TH = 190, padB = 26, padT = 26;
  const vmax = Math.max(...trend.map(t => t.v), 1), nmax = Math.max(...trend.map(t => t.n), 1);

  return (
    <div className="sw-inv" style={{ minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)", padding: "18px 24px 16px", borderBottom: "3px solid var(--gold)" }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 20, color: "#fff", fontWeight: 700 }}>Bookings</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 3 }}>
          {fN(ROWS.length)} active bookings · {PDRN.meta.source}
        </div>
      </div>

      <div style={{ padding: "18px 24px 40px", maxWidth: 1500, margin: "0 auto" }}>
        {/* Filters: multi-project + period pills */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
          <div style={{ position: "relative" }}>
            <div style={SELLBL}>Projects</div>
            <button onClick={() => setProjOpen(v => !v)}
              style={{ ...SEL, minWidth: 210, textAlign: "left", cursor: "pointer" }}>
              {selProjects.length === 0 ? "All projects" : selProjects.length === 1 ? PSHORT[selProjects[0]] : `${selProjects.length} projects selected`} ▾
            </button>
            {projOpen && (
              <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 40, marginTop: 4, background: "#fff", border: "1.5px solid #cfd6e2", borderRadius: 10, boxShadow: "0 12px 34px rgba(20,33,61,.18)", padding: "8px 10px", maxHeight: 300, overflowY: "auto", minWidth: 260 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "4px 0", cursor: "pointer", fontWeight: 700 }}>
                  <input type="checkbox" checked={selProjects.length === 0} onChange={() => { setSelProjects([]); setPage(1); }} style={{ accentColor: "#0e7490" }} />
                  All projects
                </label>
                {PSHORT.map((p, i) => (
                  <label key={p} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "4px 0", cursor: "pointer" }}>
                    <input type="checkbox" checked={selProjects.includes(i)}
                      onChange={() => { setSelProjects(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]); setPage(1); }}
                      style={{ accentColor: "#0e7490" }} />
                    {p}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <div style={SELLBL}>Period</div>
            <div style={{ display: "inline-flex", background: "#14213d", borderRadius: 12, padding: 4, gap: 4 }}>
              {([["all", "All time"], ["y", "Year"], ["q", "Quarter"], ["m", "Month"], ["c", "Custom"]] as const).map(([m, l]) => (
                <button key={m} onClick={() => { setPerMode(m); setPerKey(""); setPage(1); }}
                  style={{ border: "none", borderRadius: 9, padding: "7px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    background: perMode === m ? "#B8893C" : "transparent", color: "#fff" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {perMode === "c" && (
            <>
              <div>
                <div style={SELLBL}>From month</div>
                <select style={SEL} value={cF} onChange={e => { setCFrom(e.target.value); setPage(1); }}>
                  {allMonths.map(k => <option key={k} value={k}>{ymLbl(k)}</option>)}
                </select>
              </div>
              <div>
                <div style={SELLBL}>To month</div>
                <select style={SEL} value={cT} onChange={e => { setCTo(e.target.value); setPage(1); }}>
                  {allMonths.filter(k => k >= cF).map(k => <option key={k} value={k}>{ymLbl(k)}</option>)}
                </select>
              </div>
            </>
          )}
          {perMode !== "all" && perMode !== "c" && (
            <div>
              <div style={SELLBL}>{perMode === "y" ? "Financial year" : perMode === "q" ? "Quarter" : "Month"}</div>
              <select style={SEL} value={perSel} onChange={e => { setPerKey(e.target.value); setPage(1); }}>
                {perOptions.map(k => (
                  <option key={k} value={k}>
                    {perMode === "y" ? `FY ${k.slice(2)}` : perMode === "q" ? `Q${k.split("-Q")[1]} FY${k.slice(2, 4)}` : ymLbl(k)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* KPI strip — the reference's six, honestly marked */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 6 }}>
          <KPI k="Bookings" v={fN(total)} s="active (PDRN)" />
          <KPI k="Agreement value" v={CRf(tcv)} s="Σ basic selling price" />
          <KPI k="Avg ticket" v={CRf(avgTicket)} s="value ÷ bookings" />
          <KPI k="Area sold" v={`${areaL.toFixed(2)} L sqft`} s={`avg rate ₹${Math.round(avgRate).toLocaleString("en-IN")}/sqft`} />
          <KPI k="Cancelled" v={fN(cancelled.length)} s={`${fN(cancelled.filter(b => b.reb === 1).length)} rebooked · ${CRf(cancelled.reduce((s, b) => s + b.tsv, 0))}`} />
        </div>

        {/* Collections KPIs — with tax AND excl. tax, scope-aware */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 12, marginBottom: 6 }}>
          <KPI k="Value (with tax)" v={CRf(vT)} s={`excl. tax ${CRf(vN)} (BSP net)`} />
          <KPI k="Collected" v={CRf(recT)} s={`excl. tax ${CRf(recNs)}`} />
          <KPI k="Outstanding" v={CRf(vT - recT)} s={`excl. tax ${CRf(vN - recNs)}`} />
          <KPI k="Collection rate" v={`${vT ? ((recT / vT) * 100).toFixed(0) : 0}%`} s={`excl. tax ${vN ? ((recNs / vN) * 100).toFixed(0) : 0}%`} />
          <KPI k="Due now" v={CRf(dueNow)} s="raised demands unpaid (incl. tax)" />
        </div>

        <div><Banner title="BOOKINGS ANALYSIS" sub={`${fN(total)} bookings · ${CRf(tcv)} · ${scopeLabel}`} /></div>

        {/* Momentum & comparison */}
        <Zoomable title="Momentum & comparison">
        <div style={{ ...CARD, background: "linear-gradient(180deg,#FBF7EE,#fff)", borderColor: "#ECD9B0", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h3 style={H3}>Momentum &amp; comparison</h3>
            <div style={{ display: "inline-flex", background: "#f0ede5", borderRadius: 999, padding: 3 }}>
              <button style={seg(mgran === "q")} onClick={() => setMgran("q")}>Quarter</button>
              <button style={seg(mgran === "y")} onClick={() => setMgran("y")}>Year</button>
            </div>
          </div>
          <div style={CAP}>compare any two periods · respects the filters above</div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", margin: "10px 0 12px", flexWrap: "wrap" }}>
            <div><div style={SELLBL}>Compare</div>
              <select style={SEL} value={A} onChange={e => setMA(e.target.value)}>{mkeys.map(k => <option key={k} value={k}>{perLbl(k)}</option>)}</select></div>
            <div style={{ alignSelf: "center", color: "var(--mut)", paddingBottom: 8 }}>vs</div>
            <div><div style={SELLBL}>With</div>
              <select style={SEL} value={Bp} onChange={e => setMB(e.target.value)}>{mkeys.map(k => <option key={k} value={k}>{perLbl(k)}</option>)}</select></div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ borderBottom: "2px solid var(--line)" }}>
                {["Metric", perLbl(A), perLbl(Bp), "Change"].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "6px 8px", color: "var(--mut)", fontSize: 10.5, letterSpacing: "1px", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {([["Bookings", fN(sA.n), fN(sB.n), delta(sA.n, sB.n), dColor(sA.n, sB.n)],
                   ["Booking value", CRf(sA.v), CRf(sB.v), delta(sA.v, sB.v), dColor(sA.v, sB.v)],
                   ["Avg ticket", CRf(sA.avg), CRf(sB.avg), delta(sA.avg, sB.avg), dColor(sA.avg, sB.avg)]] as const).map(r => (
                  <tr key={r[0]} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 8px 8px 0" }}>{r[0]}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontFamily: "Georgia,serif", fontWeight: 700 }}>{r[1]}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontFamily: "Georgia,serif", fontWeight: 700 }}>{r[2]}</td>
                    <td style={{ padding: "8px 0 8px 8px", textAlign: "right", fontWeight: 700, color: r[4] }}>{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 8 }}>
            {Bp === mkeys[mkeys.length - 1] ? `Note: ${perLbl(Bp)} may be a partial (in-progress) period. ` : ""}
          </div>
        </div>
        </Zoomable>

        {/* Booking trend — value bars + count line */}
        <Zoomable title="Booking trend">
        <div style={{ ...CARD, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h3 style={H3}>Booking trend</h3>
            <div style={{ display: "inline-flex", background: "#f0ede5", borderRadius: 999, padding: 3 }}>
              <button style={seg(gran === "m")} onClick={() => setGran("m")}>Monthly</button>
              <button style={seg(gran === "q")} onClick={() => setGran("q")}>Quarterly</button>
              <button style={seg(gran === "y")} onClick={() => setGran("y")}>Yearly</button>
            </div>
          </div>
          <div style={CAP}>bars = booking value (₹ Cr) · gold line = booking count · click a month → drill drawer</div>
          <div style={{ overflowX: "auto" }}>
            <svg viewBox={`0 0 ${TW_} ${TH}`} width={TW_} height={TH} style={{ display: "block" }}>
              {trend.map((t, i) => {
                const bw = 30, gap = 16, x = i * (bw + gap) + 6;
                const bh = (t.v / vmax) * (TH - padB - padT);
                return (
                  <g key={t.key} style={{ cursor: "pointer" }}
                    onClick={() => gran === "m" && openDrill("mon")(t.key, t.label)}
                    onMouseEnter={e => showTip(e, `<b>${t.label}</b><br/>${CRf(t.v)} · ${fN(t.n)} bookings`)}
                    onMouseMove={e => showTip(e, `<b>${t.label}</b><br/>${CRf(t.v)} · ${fN(t.n)} bookings`)}
                    onMouseLeave={hideTip}>
                    <rect x={x} y={0} width={bw + gap - 4} height={TH - padB} fill="transparent" />
                    <rect x={x} y={TH - padB - bh} width={bw} height={bh} rx="3" fill="#D7E2F0" />
                    <text x={x + bw / 2} y={TH - padB - bh - 5} textAnchor="middle" fontSize="8.5" fill="#3d4a63">{(t.v / 1e7).toFixed(0)}</text>
                    <text x={x + bw / 2} y={TH - 8} textAnchor="middle" fontSize="8.5" fill="#8a94a6">{t.label}</text>
                  </g>
                );
              })}
              <polyline
                fill="none" stroke="#B8893C" strokeWidth="2"
                points={trend.map((t, i) => `${i * 46 + 6 + 15},${TH - padB - (t.n / nmax) * (TH - padB - padT)}`).join(" ")} />
              {trend.map((t, i) => (
                <circle key={t.key} cx={i * 46 + 6 + 15} cy={TH - padB - (t.n / nmax) * (TH - padB - padT)} r="3" fill="#B8893C" style={{ pointerEvents: "none" }} />
              ))}
            </svg>
          </div>
        </div>
        </Zoomable>

        {/* by project | by configuration */}
        <div style={ROW}>
          <Zoomable title="Bookings by project">
          <div style={CARD}>
            <h3 style={H3}>Bookings by project</h3>
            <div style={CAP}>click a project → full drill (rate extremes, towers, units)</div>
            <HBarList items={listFrom(b => b.p, PSHORT)} total={total} color={BLUE} onPick={(k) => openProject(k)} sortable />
          </div>
          </Zoomable>
          <Zoomable title="Bookings by configuration">
          <div style={CARD}>
            <h3 style={H3}>Bookings by configuration</h3>
            <div style={CAP}>unit mix by BHK · click a config → drill drawer</div>
            <HBarList items={listFrom(b => b.cfg, PDRN.CFG)} total={total} color={GOLD} onPick={openDrill("cfg")} sortable />
          </div>
          </Zoomable>
        </div>

        {/* Direct vs channel-partner — from booked walk-ins */}
        <div style={ROW}>
          <Zoomable title="Bookings by source">
          <div style={CARD}>
            <h3 style={H3}>Direct vs channel-partner</h3>
            <div style={CAP}>live from the PDRN broker column · respects filters</div>
            <Donut segs={[
              { key: 1, label: "Via channel partner", value: rows.filter(b => b.broker >= 0).length, color: TEAL },
              { key: 0, label: "Direct", value: rows.filter(b => b.broker < 0).length, color: GOLD },
            ].filter(s => s.value > 0)} />
            <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 6 }}>
              CP value {CRf(rows.filter(b => b.broker >= 0).reduce((s, b) => s + b.tsv, 0))} · direct value {CRf(rows.filter(b => b.broker < 0).reduce((s, b) => s + b.tsv, 0))}
            </div>
          </div>
          </Zoomable>
          <Zoomable title="Channel-partner leaderboard">
          <div style={CARD}>
            <h3 style={H3}>Channel-partner leaderboard</h3>
            <div style={CAP}>real per-booking brokers · bookings, value &amp; share · respects filters</div>
            {(() => {
              const g = new Map<number, { n: number; v: number }>();
              rows.forEach(b => { if (b.broker >= 0) { if (!g.has(b.broker)) g.set(b.broker, { n: 0, v: 0 }); const e = g.get(b.broker)!; e.n++; e.v += b.tsv; } });
              const items = [...g.entries()].map(([k, e]) => ({ k, ...e })).sort((a, b) => b.n - a.n);
              const mx = Math.max(...items.map(i => i.n), 1);
              return (
                <div style={{ maxHeight: 300, overflowY: "auto", paddingRight: 6 }}>
                  {items.map(it => (
                    <div key={it.k} className="barrow"
                      onMouseEnter={e => showTip(e, `<b>${BROKERS[it.k]}</b><br/>${fN(it.n)} bookings · ${((it.n / Math.max(total, 1)) * 100).toFixed(1)}% share<br/>${CRf(it.v)} · avg ${CRf(it.v / it.n)}`)}
                      onMouseMove={e => showTip(e, `<b>${BROKERS[it.k]}</b><br/>${fN(it.n)} bookings · ${((it.n / Math.max(total, 1)) * 100).toFixed(1)}% share<br/>${CRf(it.v)} · avg ${CRf(it.v / it.n)}`)}
                      onMouseLeave={hideTip}
                      style={{ padding: "4px 0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3, gap: 8 }}>
                        <span style={{ color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{BROKERS[it.k]}</span>
                        <span style={{ color: "var(--mut)", whiteSpace: "nowrap" }}>{fN(it.n)} · {CRf(it.v)}</span>
                      </div>
                      <div style={{ height: 9, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                        <div className="hb" style={{ height: "100%", width: `${(it.n / mx) * 100}%`, background: TEAL, borderRadius: 5 }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          </Zoomable>
        </div>

        {/* ticket-size mix | by tower */}
        <div style={ROW}>
          <Zoomable title="Ticket-size mix">
          <div style={CARD}>
            <h3 style={H3}>Ticket-size mix</h3>
            <div style={CAP}>how bookings split across price bands · click a band → drill drawer</div>
            {(() => {
              const g = BANDS.map(() => ({ n: 0, v: 0 }));
              rows.forEach(b => { const i = bandOf(b); if (i >= 0) { g[i].n++; g[i].v += b.tsv; } });
              const mx = Math.max(...g.map(x => x.n), 1);
              return BANDS.map((band, i) => (
                <div key={band.label} className="barrow" onClick={() => openDrill("band")(i, band.label)}
                  onMouseEnter={e => showTip(e, `<b>${band.label}</b><br/>${fN(g[i].n)} bookings · ${((g[i].n / Math.max(total, 1)) * 100).toFixed(1)}%<br/>${CRf(g[i].v)}${g[i].n ? ` · avg ${CRf(g[i].v / g[i].n)}` : ""}`)}
                  onMouseMove={e => showTip(e, `<b>${band.label}</b><br/>${fN(g[i].n)} bookings · ${((g[i].n / Math.max(total, 1)) * 100).toFixed(1)}%<br/>${CRf(g[i].v)}${g[i].n ? ` · avg ${CRf(g[i].v / g[i].n)}` : ""}`)}
                  onMouseLeave={hideTip}
                  style={{ padding: "5px 0", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                    <span style={{ color: "var(--ink)", fontWeight: 600 }}>{band.label}</span>
                    <span style={{ color: "var(--mut)" }}>{fN(g[i].n)} · {CRf(g[i].v)}{g[i].n ? ` · avg ${CRf(g[i].v / g[i].n)}` : ""}</span>
                  </div>
                  <div style={{ height: 9, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                    <div className="hb" style={{ height: "100%", width: `${(g[i].n / mx) * 100}%`, background: TEAL, borderRadius: 5 }} />
                  </div>
                </div>
              ));
            })()}
          </div>
          </Zoomable>
          <Zoomable title="Bookings by tower">
          <div style={CARD}>
            <h3 style={H3}>Bookings by tower</h3>
            <div style={CAP}>all towers · click a tower → drill drawer</div>
            <HBarList items={listFrom(b => b.tw, PDRN.TW)} total={total} color={GREEN} onPick={openDrill("tw")} maxHeight={260} sortable />
          </div>
          </Zoomable>
        </div>

        {/* Value by project (₹ Cr) — the reference's value bars */}
        <Zoomable title="Booking value by project">
        <div style={{ ...CARD, marginBottom: 14 }}>
          <h3 style={H3}>Booking value by project</h3>
          <div style={CAP}>Σ agreement value (₹ Cr) · click a project → full drill</div>
          {(() => {
            const g = new Map<number, number>();
            rows.forEach(b => g.set(b.p, (g.get(b.p) ?? 0) + b.tsv));
            const items = [...g.entries()].sort((a, b) => b[1] - a[1]);
            const mx = Math.max(...items.map(([, v]) => v), 1);
            return items.map(([p, v]) => (
              <div key={p} className="barrow" onClick={() => openProject(p)}
                onMouseEnter={e => showTip(e, `<b>${PSHORT[p]}</b><br/>${CRf(v)} · ${((v / Math.max(tcv, 1)) * 100).toFixed(1)}% of value`)}
                onMouseMove={e => showTip(e, `<b>${PSHORT[p]}</b><br/>${CRf(v)} · ${((v / Math.max(tcv, 1)) * 100).toFixed(1)}% of value`)}
                onMouseLeave={hideTip}
                style={{ padding: "5px 0", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                  <span style={{ color: "var(--ink)", fontWeight: 600 }}>{PSHORT[p]}</span>
                  <span style={{ color: "var(--mut)" }}>{CRf(v)} · {((v / Math.max(tcv, 1)) * 100).toFixed(1)}%</span>
                </div>
                <div style={{ height: 9, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                  <div className="hb" style={{ height: "100%", width: `${(v / mx) * 100}%`, background: "#7b5cb8", borderRadius: 5 }} />
                </div>
              </div>
            ));
          })()}
        </div>
        </Zoomable>

        {/* Collection by project — live, scope-aware */}
        <div><Banner title="COLLECTIONS" sub={`live per-booking received/due · ${scopeLabel}`} /></div>
        {(() => {
          return (
            <>
              <Zoomable title="Collection by project">
              <div style={{ ...CARD, marginBottom: 14 }}>
                <h3 style={H3}>Collection by project</h3>
                <div style={CAP}>received ÷ value (with tax) · green ≥ 50% · respects filters</div>
                {(() => {
                  const g = new Map<number, { t: number; r: number; n: number }>();
                  rows.forEach(b => { if (!g.has(b.p)) g.set(b.p, { t: 0, r: 0, n: 0 }); const e = g.get(b.p)!; e.t += b.tcvT; e.r += b.rec; e.n++; });
                  return [...g.entries()].sort((a, b) => b[1].t - a[1].t).map(([p, e]) => {
                    const pctv = e.t ? (e.r / e.t) * 100 : 0;
                    return (
                      <div key={p} className="barrow"
                        onMouseEnter={ev => showTip(ev, `<b>${PSHORT[p]}</b><br/>${e.n.toLocaleString("en-IN")} bookings · value ${CRf(e.t)}<br/>collected ${CRf(e.r)} (${pctv.toFixed(1)}%) · outstanding ${CRf(e.t - e.r)}`)}
                        onMouseMove={ev => showTip(ev, `<b>${PSHORT[p]}</b><br/>${e.n.toLocaleString("en-IN")} bookings · value ${CRf(e.t)}<br/>collected ${CRf(e.r)} (${pctv.toFixed(1)}%) · outstanding ${CRf(e.t - e.r)}`)}
                        onMouseLeave={hideTip}
                        style={{ padding: "5px 0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                          <span style={{ color: "var(--ink)", fontWeight: 600 }}>{PSHORT[p]}</span>
                          <span style={{ color: "var(--mut)" }}>{CRf(e.r)} of {CRf(e.t)} · <b style={{ color: pctv >= 50 ? "#1a7a4a" : "#c07a1a" }}>{pctv.toFixed(0)}%</b></span>
                        </div>
                        <div style={{ height: 9, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(pctv, 100)}%`, background: pctv >= 50 ? "#1BAF7A" : "#EDA100", borderRadius: 5 }} />
                        </div>
                      </div>
                    );
                  });
                })()}
                <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 10 }}>
                  Live from MERGED_PDRN_02-09.xlsx — per-booking Total Received (with tax), TCV (with tax, after
                  credit/debit adjustment) and Total Due. Fully scope-aware: project, period and drawer filters all apply.
                </div>
              </div>
              </Zoomable>
            </>
          );
        })()}

        {/* Records */}
        <div><Banner title="BOOKING RECORDS" sub={`${fN(filtered.length)} bookings · newest first · click a row for full detail`} /></div>
        <div style={{ ...CARD, paddingBottom: 6 }}>
          <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }}
            placeholder="Search project, unit, customer, config, tower…"
            style={{ width: "100%", boxSizing: "border-box", fontFamily: "inherit", fontSize: 13.5, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #cfd6e2", marginBottom: 10 }} />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr style={{ borderBottom: "2px solid var(--line)" }}>
                {["Booked", "Project", "Tower · Unit", "Config", "Area", "Value"].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 4 ? "right" : "left", padding: "7px 8px", color: "var(--mut)", fontSize: 10.5, letterSpacing: "1px", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {shown.map((b, i) => (
                  <tr key={i} onClick={() => setDetail(b)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
                    style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }}>
                    <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>{MON[b.m - 1]}'{String(b.y).slice(2)}</td>
                    <td style={{ padding: "7px 8px" }}>{PSHORT[b.p]}</td>
                    <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>{PDRN.TW[b.tw] ?? "—"} · {b.unit}</td>
                    <td style={{ padding: "7px 8px" }}>{PDRN.CFG[b.cfg]}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", whiteSpace: "nowrap" }}>{fN(Math.round(b.area))} sqft</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "Georgia,serif", fontWeight: 700, whiteSpace: "nowrap" }}>{CRf(b.tsv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0 6px", fontSize: 12.5, color: "var(--mut)" }}>
            <span>Page {page} of {fN(pages)}</span>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ marginLeft: "auto", border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "5px 12px", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.45 : 1, fontFamily: "inherit" }}>‹ Prev</button>
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={{ border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "5px 12px", cursor: page >= pages ? "default" : "pointer", opacity: page >= pages ? 0.45 : 1, fontFamily: "inherit" }}>Next ›</button>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 12 }}>
          Source: {PDRN.meta.source} ({fN(PDRN.meta.rows)} active bookings). Single source: cpAnalytics.json (full PDRN export — actives with broker, plus cancellations). Collected/Outstanding and customer geography still need collection and postal columns.
        </div>
      </div>

      <BookingsDrillDrawer
        seed={drill}
        baseRows={rows}
        cancelledBase={cancelled}
        baseLabel={scopeLabel}
        onClose={() => setDrill(null)}
        onRecord={b => setDetail(b)}
      />

      {projDrawer && (
        <PdrnDrawer
          invProjIdx={projDrawer.invProjIdx}
          projectName={projDrawer.projectName}
          period={{ type: "all" }}
          onClose={() => setProjDrawer(null)}
          unsoldUnits={projDrawer.unsold.units}
          unsoldArea={projDrawer.unsold.area}
          totalUnits={projDrawer.total.units}
          totalArea={projDrawer.total.area}
        />
      )}

      {/* Record detail slide-over */}
      <AnimatePresence>
        {detail && (
          <>
            <motion.div key="bkov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              onClick={() => setDetail(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.35)", zIndex: 80 }} />
            <motion.div key="bkdw" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(430px, 92vw)", zIndex: 81, background: "#f6f4ef", boxShadow: "-14px 0 46px rgba(20,33,61,.35)", display: "flex", flexDirection: "column" }}>
              <div style={{ background: "#0f2233", padding: "16px 20px", borderBottom: "3px solid #0e7490", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", color: "#7fb8d4" }}>BOOKING RECORD</div>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "#fff", marginTop: 2 }}>{detail.unit}</div>
                </div>
                <button onClick={() => setDetail(null)} aria-label="Close"
                  style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 8, fontSize: 15, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 26px" }}>
                {([["Booked", detail.day >= 0 ? new Date(new Date("2022-01-01T00:00:00").getTime() + detail.day * 86400000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : `${MON[detail.m - 1] ?? "—"} ${detail.y > 0 ? detail.y : ""}`],
                   ["Project", PDRN.P[detail.p]],
                   ["Tower", PDRN.TW[detail.tw] ?? "—"],
                   ["Unit", detail.unit],
                   ["Configuration", PDRN.CFG[detail.cfg]],
                   ["Super area", `${fN(Math.round(detail.area))} sqft`],
                   ["Agreement value", CRf(detail.tsv)],
                   ["Rate", `₹${Math.round(detail.tsv / Math.max(detail.area, 1)).toLocaleString("en-IN")}/sqft`],
                   ["Customer", detail.name],
                   ["Payment plan", detail.plan],
                   ["Received (incl. tax)", CRf(detail.rec)],
                   ["Value (with tax)", CRf(detail.tcvT)],
                   ["Due now", CRf(Math.max(detail.due, 0))]] as const).map(([k, v]) => (
                  <div key={k} style={{ padding: "10px 0", borderBottom: "1px solid #eae6da" }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginTop: 3, wordBreak: "break-word" }}>{v}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
