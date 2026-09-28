import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { PageBanner, BannerPills, BANNER_LBL, BANNER_CTL } from "../../components/layout/PageBanner";
import { Zoomable } from "../../components/common/Zoomable";
import { showTip, hideTip } from "../../components/common/hoverTip";
import "../../components/inventory/smartworldInventory.css";
import raw from "../../data/projectTracker.json";

/** Project Tracker — construction schedule progress, from the site
 * planning export (VisiLean/MS Project WBS). One row per task; the
 * page works on ACTIVITIES (the deep WBS levels), so parent summary
 * rows never double-count. Overdue = planned end passed, not complete.
 * Slip = planned end moved beyond the baseline end. */

/* ---------------- palette / styles (same language as other tabs) ---------------- */
const TEAL = "#0E7490", GOLD = "#B8893C", GREEN = "#1BAF7A", RED = "#c0392b", NAVY = "#1c3f6e", BLUE = "#1a7f9c", GREY = "#9a927e";
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #eae6da", borderRadius: 12, boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)", padding: "14px 16px", marginBottom: 14 };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 15.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 2px" };
const CAP: React.CSSProperties = { fontSize: 11, color: "var(--mut)", marginBottom: 10 };
const TH: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "8px 10px", borderBottom: "2px solid #eae6da", whiteSpace: "nowrap", textAlign: "left" };
const TD: React.CSSProperties = { padding: "6px 10px", borderBottom: "1px solid #f0ede5", whiteSpace: "nowrap" };
const GLASS = (c1: string, c2: string): React.CSSProperties => ({
  background: `linear-gradient(150deg, ${c1} 0%, ${c2} 100%)`,
  border: "1px solid rgba(255,255,255,.35)", borderRadius: 14,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), 0 10px 24px rgba(20,33,61,.28), 0 2px 6px rgba(20,33,61,.18)",
  padding: "14px 16px", color: "#fff", position: "relative", overflow: "hidden",
});
const fN = (n: number) => Math.round(n).toLocaleString("en-IN");

/* ---------------- data ---------------- */
const EPOCH = Date.UTC(2022, 0, 1);
const DAY = 86400000;
const fD = (d: number) => d < 0 ? "—" : new Date(EPOCH + d * DAY).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" });
const AS_ON = Math.round((Date.UTC(2026, 8, 28) - EPOCH) / DAY);

interface TrkFile {
  meta: { asOn: string };
  PROJECTS: string[]; STATUS: string[]; TRADES: string[]; OWNERS: string[]; TOWERS: string[]; FLOORS: string[];
  T: (string | number)[][];
}
const D = raw as unknown as TrkFile;

interface Task {
  proj: number; name: string; depth: number; pct: number; st: number;
  ps: number; pe: number; as: number; ae: number; be: number;
  trade: number; owner: number; tower: number; floor: number; frank: number;
  done: boolean; active: boolean; overdue: boolean; slip: number;
}
const ALL: Task[] = D.T.map(t => {
  const st = t[4] as number, pct = t[3] as number, pe = t[6] as number, be = t[9] as number;
  const sName = D.STATUS[st];
  const done = sName === "Complete" || sName === "Quality checked" || pct >= 100;
  return {
    proj: t[0] as number, name: t[1] as string, depth: t[2] as number, pct, st,
    ps: t[5] as number, pe, as: t[7] as number, ae: t[8] as number, be,
    trade: t[10] as number, owner: t[11] as number, tower: t[12] as number, floor: t[13] as number, frank: t[14] as number,
    done, active: sName === "Started",
    overdue: !done && pe >= 0 && pe < AS_ON,
    slip: pe >= 0 && be >= 0 && pe > be ? pe - be : 0,
  };
});
/** activities = deepest WBS levels; parent/summary rows excluded so
 * nothing is counted twice */
const ACTS = ALL.filter(t => t.depth >= 7);
const TOWER_ORDER = ["T1", "T2", "T3", "T4", "T5", "T6", "EWS", "Clubhouse", "NTA"];

/* ---------------- drill drawer ---------------- */
interface Drill { title: string; sub?: string; tasks: Task[] }

function StatusPill({ t }: { t: Task }) {
  const [lbl, col] = t.overdue ? ["Overdue", RED] : t.done ? ["Complete", GREEN] : t.active ? ["In progress", BLUE] : [D.STATUS[t.st], GREY];
  return <span style={{ background: `${col}1c`, color: col, fontWeight: 800, fontSize: 10.5, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>{lbl}</span>;
}

function TrkDrawer({ sel, onClose }: { sel: Drill | null; onClose: () => void }) {
  const [task, setTask] = useState<Task | null>(null);
  if (!sel) return null;
  const ts = sel.tasks;
  const done = ts.filter(t => t.done).length;
  const od = ts.filter(t => t.overdue).length;
  const avg = ts.length ? ts.reduce((s, t) => s + t.pct, 0) / ts.length : 0;
  const tile = (k: string, v: string, col = "var(--ink)") => (
    <div key={k} style={{ background: "#faf9f6", border: "1px solid #eee9dd", borderRadius: 10, padding: "8px 12px", minWidth: 105 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: col, marginTop: 2 }}>{v}</div>
    </div>
  );
  return (
    <>
      <div onClick={() => { setTask(null); onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(14,22,45,0.45)", zIndex: 220 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(700px, 96vw)", background: "#fdfcf9", zIndex: 221, boxShadow: "-18px 0 50px rgba(14,22,45,0.35)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #eae6da", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
                {task ? <><span onClick={() => setTask(null)} style={{ color: GOLD, cursor: "pointer" }}>‹ {sel.title}</span> · activity detail</> : sel.title}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 2 }}>{task ? task.name : sel.sub ?? `${fN(ts.length)} activities`}</div>
            </div>
            <button onClick={() => { setTask(null); onClose(); }} style={{ background: "none", border: "none", fontSize: 24, color: "var(--mut)", cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>
          {!task && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {tile("Activities", fN(ts.length))}
              {tile("Complete", `${fN(done)} (${ts.length ? Math.round((done / ts.length) * 100) : 0}%)`, GREEN)}
              {tile("Overdue", fN(od), od ? RED : "var(--mut)")}
              {tile("Avg progress", `${avg.toFixed(0)}%`, TEAL)}
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {task ? (
            <div style={CARD}>
              <div style={{ marginBottom: 10 }}><StatusPill t={task} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "6px 10px", fontSize: 12.5 }}>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Activity</div><div style={{ fontWeight: 700, whiteSpace: "normal" }}>{task.name}</div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Tower / location</div><div>{D.TOWERS[task.tower] || "—"}{D.FLOORS[task.floor] ? ` · ${D.FLOORS[task.floor]}` : ""}</div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Trade</div><div>{D.TRADES[task.trade] || "—"}</div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Owner</div><div>{D.OWNERS[task.owner] || "—"}</div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Progress</div>
                <div>
                  <b style={{ color: TEAL }}>{task.pct.toFixed(0)}%</b>
                  <div style={{ height: 8, background: "#f0ede5", borderRadius: 4, overflow: "hidden", marginTop: 4, maxWidth: 260 }}>
                    <div style={{ height: "100%", width: `${Math.min(task.pct, 100)}%`, background: task.done ? GREEN : TEAL }} />
                  </div>
                </div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Planned</div><div>{fD(task.ps)} → {fD(task.pe)}</div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Actual</div><div>{fD(task.as)} → {fD(task.ae)}</div>
                <div style={{ color: "var(--mut)", fontWeight: 700 }}>Baseline end</div><div>{fD(task.be)}</div>
                {task.slip > 0 && <><div style={{ color: "var(--mut)", fontWeight: 700 }}>Slip vs baseline</div><div style={{ color: RED, fontWeight: 800 }}>{task.slip} days later than baselined</div></>}
                {task.overdue && <><div style={{ color: "var(--mut)", fontWeight: 700 }}>Overdue by</div><div style={{ color: RED, fontWeight: 800 }}>{AS_ON - task.pe} days past planned end</div></>}
              </div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                <th style={TH}>Activity</th><th style={TH}>Location</th><th style={TH}>Status</th>
                <th style={{ ...TH, textAlign: "right" }}>%</th><th style={{ ...TH, textAlign: "right" }}>Planned end</th>
              </tr></thead>
              <tbody>
                {ts.slice(0, 400).map((t, i) => (
                  <tr key={i} onClick={() => setTask(t)} style={{ cursor: "pointer" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                    <td style={{ ...TD, maxWidth: 230, overflow: "hidden", textOverflow: "ellipsis", fontWeight: 700, color: "var(--ink)" }}>{t.name}</td>
                    <td style={{ ...TD, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", color: "var(--mut)" }}>{D.TOWERS[t.tower]}{D.FLOORS[t.floor] ? ` · ${D.FLOORS[t.floor]}` : ""}</td>
                    <td style={TD}><StatusPill t={t} /></td>
                    <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: t.done ? GREEN : TEAL }}>{t.pct.toFixed(0)}%</td>
                    <td style={{ ...TD, textAlign: "right", color: t.overdue ? RED : "var(--mut)", fontWeight: t.overdue ? 800 : 500 }}>{fD(t.pe)}</td>
                  </tr>
                ))}
                {ts.length > 400 && <tr><td colSpan={5} style={{ ...TD, textAlign: "center", color: "var(--mut)" }}>showing first 400 of {fN(ts.length)} — narrow with the filters</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------------- banner tower multi-select ---------------- */
function TowerSelect({ towers, selected, onChange }: { towers: string[]; selected: string[]; onChange: (s: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = (n: string) => {
    const next = selected.includes(n) ? selected.filter(x => x !== n) : [...selected, n];
    onChange(next.length === towers.length ? [] : next);
  };
  const label = selected.length === 0 ? "All towers" : selected.length === 1 ? selected[0] : `${selected.length} towers`;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={BANNER_LBL}>Tower / area</label>
      <button type="button" onClick={() => setOpen(v => !v)} style={{ ...BANNER_CTL, minWidth: 150, textAlign: "left" }}>
        {label} <span style={{ color: "var(--mut)", marginLeft: 6, fontSize: 9 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60, background: "#fff", border: "1px solid var(--line)", borderRadius: 9, boxShadow: "0 12px 34px rgba(20,33,61,.2)", padding: 8, minWidth: 220, maxHeight: 320, overflowY: "auto" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderBottom: "1px solid var(--line)", marginBottom: 5, paddingBottom: 10, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            <input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])} style={{ accentColor: "#B8893C", width: 15, height: 15 }} />
            All towers
          </label>
          {towers.map(n => (
            <label key={n} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={selected.includes(n)} onChange={() => toggle(n)} style={{ accentColor: "#B8893C", width: 15, height: 15 }} />
              {n}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- page ---------------- */
export default function ProjectTrackerPage() {
  const [projF, setProjF] = useState(0);
  const [towerF, setTowerF] = useState<string[]>([]);
  const [tradeF, setTradeF] = useState(-1);
  const [statusF, setStatusF] = useState<"all" | "done" | "run" | "todo" | "late">("all");
  const [q, setQ] = useState("");
  const [drill, setDrill] = useState<Drill | null>(null);
  const [heatTower, setHeatTower] = useState("T1");

  const towerNames = useMemo(() => {
    const present = new Set(ACTS.filter(t => t.proj === projF).map(t => D.TOWERS[t.tower]).filter(Boolean));
    return [...TOWER_ORDER.filter(t => present.has(t)), ...[...present].filter(t => !TOWER_ORDER.includes(t)).sort()];
  }, [projF]);
  const tradeNames = useMemo(() => D.TRADES.map((t, i) => ({ t, i })).filter(x => x.t), []);

  const scoped = useMemo(() => {
    const s = q.trim().toLowerCase();
    return ACTS.filter(t => {
      if (t.proj !== projF) return false;
      if (towerF.length && !towerF.includes(D.TOWERS[t.tower])) return false;
      if (tradeF >= 0 && t.trade !== tradeF) return false;
      if (statusF === "done" && !t.done) return false;
      if (statusF === "run" && !(t.active && !t.done)) return false;
      if (statusF === "todo" && (t.done || t.active || t.overdue)) return false;
      if (statusF === "late" && !t.overdue) return false;
      if (s && !t.name.toLowerCase().includes(s) && !D.TRADES[t.trade].toLowerCase().includes(s) &&
          !D.OWNERS[t.owner].toLowerCase().includes(s) && !D.TOWERS[t.tower].toLowerCase().includes(s)) return false;
      return true;
    });
  }, [projF, towerF, tradeF, statusF, q]);

  const open = (title: string, tasks: Task[], sub?: string) =>
    setDrill({ title, sub, tasks: [...tasks].sort((a, b) => (b.overdue ? 1 : 0) - (a.overdue ? 1 : 0) || a.pe - b.pe) });

  const done = scoped.filter(t => t.done);
  const run = scoped.filter(t => t.active && !t.done);
  const todo = scoped.filter(t => !t.done && !t.active);
  const late = scoped.filter(t => t.overdue);
  const slipped = scoped.filter(t => t.slip > 0);
  const avgPct = scoped.length ? scoped.reduce((s, t) => s + t.pct, 0) / scoped.length : 0;
  const avgLate = late.length ? late.reduce((s, t) => s + (AS_ON - t.pe), 0) / late.length : 0;
  const avgSlip = slipped.length ? slipped.reduce((s, t) => s + t.slip, 0) / slipped.length : 0;

  function handleReset() { setTowerF([]); setTradeF(-1); setStatusF("all"); setQ(""); }

  const KPIS: [string, string, string, [string, string], () => void][] = [
    ["Overall progress", `${avgPct.toFixed(0)}%`, `avg completion across ${fN(scoped.length)} activities`, [NAVY, "#0f2547"], () => open("All activities", scoped)],
    ["Completed", fN(done.length), `${scoped.length ? Math.round((done.length / scoped.length) * 100) : 0}% of activities finished`, ["#1e9a6c", "#0f6647"], () => open("Completed activities", done)],
    ["In progress", fN(run.length), "activities running on site now", ["#1a7f9c", "#0e5468"], () => open("In-progress activities", run)],
    ["Not started", fN(todo.length), "activities yet to begin", ["#6b5f8f", "#453a63"], () => open("Not-started activities", todo)],
    ["Overdue", fN(late.length), `planned end passed · avg ${Math.round(avgLate)} d late`, ["#c0392b", "#7e1f14"], () => open("Overdue activities", late, "planned end date has passed, work not complete")],
    ["Slipped vs baseline", fN(slipped.length), `plan pushed beyond baseline · avg ${Math.round(avgSlip)} d`, ["#c8871d", "#96691c"], () => open("Activities slipped vs baseline", [...slipped].sort((a, b) => b.slip - a.slip))],
  ];

  /* tower cards */
  const towerCards = towerNames.map(tn => {
    const ts = scoped.filter(t => D.TOWERS[t.tower] === tn);
    if (!ts.length) return null;
    const d = ts.filter(t => t.done).length;
    const o = ts.filter(t => t.overdue).length;
    const pct = ts.reduce((s, t) => s + t.pct, 0) / ts.length;
    /* highest floor with any completed structure work = where it has reached */
    const topFloor = Math.max(-9, ...ts.filter(t => t.done && t.frank >= -6 && t.frank < 500).map(t => t.frank));
    const floorLbl = topFloor <= -9 ? "—" : (ts.filter(t => t.frank === topFloor).map(t => D.FLOORS[t.floor])[0] ?? "—");
    return { tn, ts, d, o, pct, floorLbl };
  }).filter((x): x is NonNullable<typeof x> => !!x);

  /* floor progress for the selected heat tower */
  const floors = useMemo(() => {
    const m = new Map<number, { lbl: string; ts: Task[] }>();
    scoped.forEach(t => {
      if (D.TOWERS[t.tower] !== heatTower || !D.FLOORS[t.floor] || t.frank >= 500) return;
      if (!m.has(t.frank)) m.set(t.frank, { lbl: D.FLOORS[t.floor], ts: [] });
      m.get(t.frank)!.ts.push(t);
    });
    return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([, v]) => v);
  }, [scoped, heatTower]);

  /* trade progress: top 14 by activity count */
  const trades = useMemo(() => {
    const m = new Map<number, Task[]>();
    scoped.forEach(t => { if (D.TRADES[t.trade]) { if (!m.has(t.trade)) m.set(t.trade, []); m.get(t.trade)!.push(t); } });
    return [...m.entries()].map(([ti, ts]) => ({
      ti, ts, pct: ts.reduce((s, t) => s + t.pct, 0) / ts.length, od: ts.filter(t => t.overdue).length,
    })).sort((a, b) => b.ts.length - a.ts.length).slice(0, 14);
  }, [scoped]);

  /* owner scorecard */
  const owners = useMemo(() => {
    const m = new Map<number, Task[]>();
    scoped.forEach(t => { if (D.OWNERS[t.owner]) { if (!m.has(t.owner)) m.set(t.owner, []); m.get(t.owner)!.push(t); } });
    return [...m.entries()].map(([oi, ts]) => ({
      oi, ts, d: ts.filter(t => t.done).length, od: ts.filter(t => t.overdue).length,
      pct: ts.reduce((s, t) => s + t.pct, 0) / ts.length,
    })).sort((a, b) => b.ts.length - a.ts.length);
  }, [scoped]);

  /* monthly: planned finishes vs completed-of-those */
  const months = useMemo(() => {
    const m = new Map<string, { plan: Task[]; done: Task[] }>();
    scoped.forEach(t => {
      if (t.pe < 0) return;
      const k = new Date(EPOCH + t.pe * DAY).toISOString().slice(0, 7);
      if (!m.has(k)) m.set(k, { plan: [], done: [] });
      const e = m.get(k)!;
      e.plan.push(t);
      if (t.done) e.done.push(t);
    });
    return [...m.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1);
  }, [scoped]);

  /* overdue ageing bands */
  const AGE = [["0–30 d", 0, 30], ["31–90 d", 31, 90], ["91–180 d", 91, 180], ["> 180 d", 181, 1e9]] as const;
  const lateBands = AGE.map(([l, lo, hi]) => ({ l, ts: late.filter(t => { const d = AS_ON - t.pe; return d >= lo && d <= hi; }) })).filter(b => b.ts.length);

  return (
    <div className="sw-inv" style={{ minHeight: "100vh", background: "#f6f4ef", display: "flex", flexDirection: "column" }}>
      <PageBanner bleed title="Project Tracker" sub={<>construction schedule progress · {fN(ACTS.length)} site activities from the planning export · data as on {D.meta.asOn}</>}>
        <div>
          <label style={BANNER_LBL}>Project</label>
          <select value={projF} onChange={e => setProjF(+e.target.value)} style={{ ...BANNER_CTL, minWidth: 210 }}>
            {D.PROJECTS.map((p, i) => <option key={p} value={i}>{p}</option>)}
          </select>
        </div>
        <TowerSelect towers={towerNames} selected={towerF} onChange={setTowerF} />
        <div>
          <label style={BANNER_LBL}>Trade</label>
          <select value={tradeF} onChange={e => setTradeF(+e.target.value)} style={{ ...BANNER_CTL, maxWidth: 230 }}>
            <option value={-1}>All trades</option>
            {tradeNames.map(x => <option key={x.i} value={x.i}>{x.t}</option>)}
          </select>
        </div>
        <div>
          <label style={BANNER_LBL}>Status</label>
          <BannerPills items={[["all", "All"], ["done", "Complete"], ["run", "Running"], ["todo", "Not started"], ["late", "Overdue"]] as const}
            value={statusF} onChange={setStatusF} />
        </div>
        <div>
          <label style={BANNER_LBL}>Search</label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Activity / trade / owner…"
            style={{ ...BANNER_CTL, cursor: "text", width: 190 }} />
        </div>
        <button onClick={handleReset} className="pb-btn">⟲ Reset</button>
      </PageBanner>

      <div style={{ padding: "14px 20px 24px", flex: 1 }}>
        {/* KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
          {KPIS.map(([k, v, sub, [c1, c2], onClick]) => (
            <div key={k} style={{ ...GLASS(c1, c2), cursor: "pointer" }} onClick={onClick}
              onMouseEnter={e => showTip(e, `<b>${k}</b><br/>${sub}<br/>click → activity list`)} onMouseLeave={hideTip}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", opacity: 0.85 }}>{k}</div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 28, fontWeight: 700, margin: "4px 0 2px" }}>{v}</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* tower cards */}
        <Zoomable title="Tower progress" collapsible>
          <div style={CARD}>
            <h3 style={H3}>Tower-Wise Progress</h3>
            <div style={CAP}>avg completion of each tower's activities · click a card → its activities</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
              {towerCards.map(b => (
                <div key={b.tn} onClick={() => open(`${b.tn} — activities`, b.ts)}
                  onMouseEnter={e => { showTip(e, `<b>${b.tn}</b><br/>${b.pct.toFixed(0)}% · ${fN(b.d)}/${fN(b.ts.length)} done · ${fN(b.o)} overdue<br/>click → list`); (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { hideTip(); (e.currentTarget as HTMLElement).style.transform = ""; }}
                  style={{ background: "#fff", border: "1px solid #eae6da", borderLeft: `5px solid ${b.pct >= 60 ? GREEN : b.pct >= 30 ? GOLD : BLUE}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", boxShadow: "0 2px 8px rgba(20,33,61,.06)", transition: "transform .15s ease" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontFamily: "Georgia,serif", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{b.tn}</div>
                    <div style={{ fontFamily: "Georgia,serif", fontSize: 23, fontWeight: 700, color: b.pct >= 60 ? GREEN : b.pct >= 30 ? "#96691c" : BLUE }}>{b.pct.toFixed(0)}%</div>
                  </div>
                  <div style={{ height: 8, background: "#f0ede5", borderRadius: 4, overflow: "hidden", margin: "8px 0 7px" }}>
                    <div style={{ height: "100%", width: `${b.pct}%`, background: b.pct >= 60 ? GREEN : b.pct >= 30 ? GOLD : BLUE, borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--mut)", display: "flex", justifyContent: "space-between" }}>
                    <span><b style={{ color: GREEN }}>{fN(b.d)}</b> / {fN(b.ts.length)} done</span>
                    <span style={{ color: b.o ? RED : "var(--mut)", fontWeight: b.o ? 800 : 500 }}>{fN(b.o)} overdue</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 3 }}>work reached: <b style={{ color: "var(--ink)" }}>{b.floorLbl}</b></div>
                </div>
              ))}
            </div>
          </div>
        </Zoomable>

        {/* floor progress + trade progress */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 14, marginBottom: 14 }}>
          <Zoomable title="Floor progress" collapsible>
            <div style={{ ...CARD, height: "100%", marginBottom: 0, display: "flex", flexDirection: "column" }}>
              <h3 style={H3}>Floor-by-Floor — {heatTower}</h3>
              <div style={CAP}>how far each floor has progressed, top floor first · click a floor → its activities</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "2px 0 10px" }}>
                {towerNames.map(tn => (
                  <button key={tn} onClick={() => setHeatTower(tn)}
                    style={{ height: 26, padding: "0 13px", borderRadius: 999, border: `1px solid ${heatTower === tn ? GOLD : "#e0dacb"}`, background: heatTower === tn ? "#fdf6e8" : "#fff", color: heatTower === tn ? "#96691c" : "var(--mut)", fontWeight: heatTower === tn ? 800 : 600, fontSize: 11, cursor: "pointer", fontFamily: "inherit", boxShadow: heatTower === tn ? "0 1px 4px rgba(184,137,60,.25)" : "none" }}>
                    {tn}
                  </button>
                ))}
              </div>
              {/* the building: floors as slabs, filled by completion —
                  re-keyed per tower so the fill "constructs" bottom-up */}
              <style>{`
                @keyframes trkStripes { from { background-position: 0 0; } to { background-position: 28px 0; } }
                .trk-floors::-webkit-scrollbar { width: 6px; }
                .trk-floors::-webkit-scrollbar-track { background: transparent; }
                .trk-floors::-webkit-scrollbar-thumb { background: #ddd6c6; border-radius: 3px; }
                .trk-row:hover { background: #faf8f2; }
              `}</style>
              {/* only the floor list scrolls; fills the card row's height */}
              <div className="trk-floors" style={{ flex: 1, minHeight: 420, maxHeight: 640, overflowY: "auto", overflowX: "hidden", paddingRight: 6, scrollbarWidth: "thin" }} key={heatTower}>
                {(() => {
                  if (!floors.length) return <div style={{ color: "var(--mut)", fontSize: 12, padding: 10 }}>No floor-level activities for {heatTower} in the current filters</div>;
                  const rows = floors.map(f => {
                    const pct = f.ts.reduce((s, t) => s + t.pct, 0) / f.ts.length;
                    const od = f.ts.filter(t => t.overdue).length;
                    const below = /basement|raft/i.test(f.lbl);
                    return { ...f, pct, od, below };
                  });
                  const groundIdx = rows.findIndex(r => r.below);          // first below-ground row (list is top-first)
                  const craneIdx = rows.findIndex(r => r.pct > 0 && r.pct < 99); // highest floor being worked on
                  const n = rows.length;
                  const slab = (r: typeof rows[number], i: number) => {
                    const full = r.pct >= 99, none = r.pct <= 0;
                    const fill = full ? GREEN : TEAL;
                    return (
                      <div key={r.lbl} className="trk-row" onClick={() => open(`${heatTower} · ${r.lbl}`, r.ts)}
                        onMouseEnter={e => showTip(e, `<b>${r.lbl}</b><br/>${r.pct.toFixed(0)}% · ${fN(r.ts.length)} activities${r.od ? ` · <span style="color:#e57373">${r.od} overdue</span>` : ""}<br/>click → list`)} onMouseLeave={hideTip}
                        style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "4px 4px", borderRadius: 6 }}>
                        <span style={{ width: 100, textAlign: "right", fontSize: 11, fontWeight: 700, color: none ? "#b0a890" : r.below ? "#8a7f6a" : "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>
                          {i === craneIdx ? "🏗 " : ""}{r.lbl}
                        </span>
                        {/* the slab — building walls + morphing fill, full content width */}
                        <div style={{
                          flex: 1, height: r.below ? 15 : 17, position: "relative",
                          background: none ? "#faf9f5" : "#f0ede5",
                          border: none ? "1px dashed #e2dccc" : `1px solid ${r.below ? "#c9bfa8" : "#d8d2c4"}`,
                          borderRadius: 3, overflow: "hidden",
                          margin: r.below ? "0 12px" : "0",   /* basements: wider footprint illusion via inset walls */
                        }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(r.pct, 100)}%` }}
                            transition={{ delay: (n - 1 - i) * 0.035, duration: 0.55, ease: "easeOut" }}
                            style={{
                              position: "absolute", inset: 0, width: `${Math.min(r.pct, 100)}%`,
                              background: r.below ? (full ? "#7a6f56" : "#a89a7c") : fill,
                              /* windows on completed above-ground floors */
                              ...(full && !r.below ? { backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,.45) 0 3px, transparent 3px 14px)" } : {}),
                              /* animated stripes = under construction */
                              ...(!full && !none ? {
                                backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.35) 0 7px, transparent 7px 14px)",
                                animation: "trkStripes 1.1s linear infinite",
                              } : {}),
                            }}
                          />
                        </div>
                        <span style={{ width: 72, paddingLeft: 8, textAlign: "right", fontSize: 11, fontWeight: none ? 600 : 800, color: full ? GREEN : none ? "#c4bca8" : "#96691c", flexShrink: 0, whiteSpace: "nowrap" }}>
                          {r.pct.toFixed(0)}%{r.od ? <span style={{ color: RED, fontSize: 10 }} title={`${r.od} overdue activities`}> {r.od}⚠</span> : ""}
                        </span>
                      </div>
                    );
                  };
                  return (
                    <div>
                      {/* roof cap */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
                        <span style={{ width: 100, flexShrink: 0 }} />
                        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                          <div style={{ width: "62%", height: 0, borderLeft: "16px solid transparent", borderRight: "16px solid transparent", borderBottom: "12px solid #c9bfa8" }} />
                        </div>
                        <span style={{ width: 72, flexShrink: 0 }} />
                      </div>
                      {rows.map((r, i) => (
                        <div key={r.lbl}>
                          {/* ground line between above-ground and basements */}
                          {i === groundIdx && groundIdx > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0", padding: "0 4px" }}>
                              <span style={{ width: 100, textAlign: "right", fontSize: 8.5, fontWeight: 800, letterSpacing: "1px", color: "#8a7f6a", flexShrink: 0 }}>GROUND</span>
                              <div style={{ flex: 1, borderTop: "2px solid #8a7f6a" }} />
                              <span style={{ width: 72, flexShrink: 0 }} />
                            </div>
                          )}
                          {slab(r, i)}
                        </div>
                      ))}
                      <div style={{ fontSize: 10, color: "var(--mut)", marginTop: 8, display: "flex", gap: 14, flexWrap: "wrap" }}>
                        <span><span style={{ color: GREEN, fontWeight: 800 }}>■</span> complete (windows)</span>
                        <span><span style={{ color: TEAL, fontWeight: 800 }}>▨</span> under construction</span>
                        <span style={{ color: "#b0a890" }}>▢ not started</span>
                        <span>🏗 current working floor</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </Zoomable>

          <Zoomable title="Trade progress" collapsible>
            <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
              <h3 style={H3}>Trade-Wise Progress</h3>
              <div style={CAP}>the biggest trades by activity count · red = overdue activities inside · click → list</div>
              {trades.map(tr => (
                <div key={tr.ti} className="barrow" style={{ padding: "3.5px 0", cursor: "pointer" }}
                  onClick={() => open(`Trade: ${D.TRADES[tr.ti]}`, tr.ts)}
                  onMouseEnter={e => showTip(e, `<b>${D.TRADES[tr.ti]}</b><br/>${tr.pct.toFixed(0)}% · ${fN(tr.ts.length)} activities${tr.od ? ` · <span style="color:#e57373">${tr.od} overdue</span>` : ""}<br/>click → list`)} onMouseLeave={hideTip}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, color: "var(--ink)", maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{D.TRADES[tr.ti]}</span>
                    <span style={{ fontWeight: 800, color: "var(--mut)" }}>{tr.pct.toFixed(0)}% <span style={{ color: "#b0a890" }}>· {fN(tr.ts.length)}</span>{tr.od ? <span style={{ color: RED }}> · {tr.od} late</span> : null}</span>
                  </div>
                  <div style={{ height: 9, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${tr.pct}%`, background: tr.pct >= 80 ? GREEN : tr.pct >= 40 ? GOLD : BLUE, borderRadius: 5 }} />
                  </div>
                </div>
              ))}
            </div>
          </Zoomable>
        </div>

        {/* owners + delays */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 14, marginBottom: 14 }}>
          <Zoomable title="Owner scorecard" collapsible>
            <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
              <h3 style={H3}>Engineer / Owner Scorecard</h3>
              <div style={CAP}>activities per owner, completion and overdue load · click → their activities</div>
              <div style={{ maxHeight: 340, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                    <th style={TH}>Owner</th><th style={{ ...TH, textAlign: "right" }}>Activities</th>
                    <th style={{ ...TH, textAlign: "right" }}>Done</th><th style={{ ...TH, textAlign: "right" }}>Avg %</th><th style={{ ...TH, textAlign: "right" }}>Overdue</th>
                  </tr></thead>
                  <tbody>
                    {owners.map(o => (
                      <tr key={o.oi} onClick={() => open(`Owner: ${D.OWNERS[o.oi]}`, o.ts)} style={{ cursor: "pointer" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                        <td style={{ ...TD, fontWeight: 700, color: "var(--ink)" }}>{D.OWNERS[o.oi]}</td>
                        <td style={{ ...TD, textAlign: "right" }}>{fN(o.ts.length)}</td>
                        <td style={{ ...TD, textAlign: "right", color: GREEN, fontWeight: 700 }}>{fN(o.d)}</td>
                        <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{o.pct.toFixed(0)}%</td>
                        <td style={{ ...TD, textAlign: "right", color: o.od ? RED : "var(--mut)", fontWeight: o.od ? 800 : 500 }}>{fN(o.od)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Zoomable>

          <Zoomable title="Delays" collapsible>
            <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
              <h3 style={H3}>Delay Analysis</h3>
              <div style={CAP}>how late the overdue work is, and the activities that slipped most vs baseline · click → list</div>
              {(() => {
                const mx = Math.max(...lateBands.map(b => b.ts.length), 1);
                return lateBands.map((b, i) => (
                  <div key={b.l} className="barrow" style={{ padding: "4px 0", cursor: "pointer" }}
                    onClick={() => open(`Overdue ${b.l}`, b.ts)}
                    onMouseEnter={e => showTip(e, `<b>Overdue ${b.l}</b><br/>${fN(b.ts.length)} activities<br/>click → list`)} onMouseLeave={hideTip}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, color: "var(--ink)" }}>Overdue {b.l}</span>
                      <span style={{ fontWeight: 800, color: "var(--mut)" }}>{fN(b.ts.length)}</span>
                    </div>
                    <div style={{ height: 9, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(b.ts.length / mx) * 100}%`, background: i >= 2 ? RED : "#EDA100", borderRadius: 5 }} />
                    </div>
                  </div>
                ));
              })()}
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: "var(--mut)", margin: "12px 0 6px" }}>Biggest slips vs baseline</div>
              {[...slipped].sort((a, b) => b.slip - a.slip).slice(0, 6).map((t, i) => (
                <div key={i} onClick={() => open("Slipped activity", [t])} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 0", borderBottom: "1px solid #f0ede5", cursor: "pointer", fontSize: 11.5 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, color: "var(--ink)" }}>{t.name} <span style={{ color: "var(--mut)" }}>· {D.TOWERS[t.tower]}</span></span>
                  <span style={{ color: RED, fontWeight: 800, flexShrink: 0 }}>+{t.slip} d</span>
                </div>
              ))}
            </div>
          </Zoomable>
        </div>

        {/* monthly plan vs actual */}
        <Zoomable title="Monthly plan vs done" collapsible>
          <div style={CARD}>
            <h3 style={H3}>Monthly — Planned Finishes vs Completed</h3>
            <div style={CAP}>activities planned to finish each month · <span style={{ color: GREEN, fontWeight: 800 }}>■ completed</span> vs <span style={{ color: "#b0a890", fontWeight: 800 }}>■ still open</span> · click a bar → that month's activities</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 170, overflowX: "auto", paddingBottom: 4 }}>
              {(() => {
                const mx = Math.max(...months.map(([, e]) => e.plan.length), 1);
                return months.map(([k, e]) => {
                  const lbl = new Date(k + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
                  const isPast = k <= "2026-09";
                  return (
                    <div key={k} onClick={() => open(`Planned to finish in ${lbl}`, e.plan)}
                      onMouseEnter={ev => showTip(ev, `<b>${lbl}</b><br/>${fN(e.plan.length)} planned to finish · ${fN(e.done.length)} completed${isPast && e.plan.length > e.done.length ? ` · <span style="color:#e57373">${fN(e.plan.length - e.done.length)} open</span>` : ""}<br/>click → list`)} onMouseLeave={hideTip}
                      style={{ flex: "0 0 34px", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", height: "100%" }}>
                      <div style={{ flex: 1, width: 22, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                        <div style={{ height: `${((e.plan.length - e.done.length) / mx) * 100}%`, background: isPast ? "#d9a08f" : "#d8d2c4", borderRadius: "3px 3px 0 0" }} />
                        <div style={{ height: `${(e.done.length / mx) * 100}%`, background: GREEN, borderRadius: e.done.length === e.plan.length ? "3px 3px 0 0" : 0 }} />
                      </div>
                      <div style={{ fontSize: 8.5, color: "var(--mut)", fontWeight: 700, marginTop: 4, whiteSpace: "nowrap", transform: "rotate(-38deg)", transformOrigin: "top center", height: 24 }}>{lbl}</div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </Zoomable>

        {/* how to read */}
        <div style={{ ...CARD, background: "#fdfaf3", borderColor: "#efe4c8" }}>
          <h3 style={H3}>How to read this page</h3>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.65 }}>
            Every figure is built from the site's <b>activity-level schedule</b> (the deepest steps of the work plan — summary rows are excluded so nothing counts twice). <b>Overdue</b> means the planned end date has passed and the activity is not complete. <b>Slipped vs baseline</b> means the plan itself was pushed later than the originally baselined date. Tower cards show weighted average completion; "work reached" is the highest floor with completed activities. The monthly chart shows whether each month's planned finishes actually got done — pink tops on past months are the backlog.
          </div>
        </div>
      </div>

      <TrkDrawer sel={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
