import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showTip, hideTip } from "../../components/common/hoverTip";
import { type VTask, fD, fCr, fN, fPct, sum, pctDone, PHASE_LBL } from "./vlData";

/* ---------------- house styles (same language as the other tabs) ---------------- */
export const C = { TEAL: "#0E7490", GOLD: "#B8893C", GREEN: "#1BAF7A", RED: "#c0392b", NAVY: "#1c3f6e", BLUE: "#1a7f9c", GREY: "#9a927e", AMBER: "#EDA100", PURPLE: "#5b2a6e", LAV: "#cdb4e0", MINT: "#bfe8dc" };
export const CAT = ["#0E7490", "#7b5cb8", "#1BAF7A", "#EDA100", "#e34948", "#2a78d6", "#8a94a6"];
export const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #eae6da", borderRadius: 12, boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)", padding: "14px 16px", marginBottom: 14 };
export const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 15.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 2px" };
export const CAP: React.CSSProperties = { fontSize: 11, color: "var(--mut)", marginBottom: 10 };
export const TH: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "8px 10px", borderBottom: "2px solid #eae6da", whiteSpace: "nowrap", textAlign: "left", position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 };
export const TD: React.CSSProperties = { padding: "6px 10px", borderBottom: "1px solid #f0ede5", whiteSpace: "nowrap" };
export const R: React.CSSProperties = { textAlign: "right" };
export const GLASS = (c1: string, c2: string): React.CSSProperties => ({
  background: `linear-gradient(150deg, ${c1} 0%, ${c2} 100%)`, border: "1px solid rgba(255,255,255,.35)", borderRadius: 14,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), 0 10px 24px rgba(20,33,61,.28), 0 2px 6px rgba(20,33,61,.18)",
  padding: "14px 16px", color: "#fff", position: "relative", overflow: "hidden", cursor: "pointer",
});
export const hoverRow = {
  onMouseEnter: (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; },
  onMouseLeave: (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = ""; },
};

/** a row of glass KPI cards; each opens the drill */
export function GlassRow({ items }: { items: { k: string; v: string; s: string; c: [string, string]; go?: () => void; extra?: React.ReactNode }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 14 }}>
      {items.map(it => (
        <div key={it.k} className="g3d" style={{ ...GLASS(it.c[0], it.c[1]), cursor: it.go ? "pointer" : "default" }} onClick={it.go}
          onMouseEnter={e => showTip(e, `<b>${it.k}</b><br/>${it.v} · ${it.s}${it.go ? "<br/>click → list" : ""}`)} onMouseLeave={hideTip}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,.10)" }} />
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.3px", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>{it.k}</div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 25, fontWeight: 700, lineHeight: 1.1, marginTop: 6, textShadow: "0 2px 4px rgba(0,0,0,.25)", whiteSpace: "nowrap" }}>{it.v}</div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,.82)", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.s}</div>
          {it.extra}
        </div>
      ))}
    </div>
  );
}

const STATUS_COL: Record<string, string> = {
  "Complete": C.GREEN, "Started": C.PURPLE, "Not Ready": "#e0605a", "Not Committed": "#e57c6e", "Ready": "#2a9d8f",
  "Forced Ready": "#2a78d6", "Quality checked": C.GREEN, "Stopped": "#7e1f14",
};
export const statusCol = (s: string) => STATUS_COL[s] ?? C.GREY;
export function StatusPill({ s }: { s: string }) {
  const col = statusCol(s);
  return <span style={{ background: col, color: "#fff", fontWeight: 800, fontSize: 10.5, borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap" }}>{s}</span>;
}
export const delayCol = (d: number | null) => d === null ? "var(--mut)" : d > 30 ? C.RED : d > 0 ? "#c8871d" : d < 0 ? C.GREEN : "var(--mut)";

/** horizontal bar list; click → drill */
export function Bars({ items, onPick, color = C.TEAL, fmt = fN, max }: {
  items: { k: string; v: number; sub?: string }[]; onPick?: (k: string) => void; color?: string; fmt?: (v: number) => string; max?: number;
}) {
  const mx = max ?? Math.max(...items.map(i => Math.abs(i.v)), 1);
  return (
    <div>
      {items.map(it => (
        <div key={it.k} className="barrow" onClick={onPick ? () => onPick(it.k) : undefined}
          onMouseEnter={e => showTip(e, `<b>${it.k}</b><br/>${fmt(it.v)}${it.sub ? ` · ${it.sub}` : ""}${onPick ? "<br/>click → list" : ""}`)} onMouseLeave={hideTip}
          style={{ padding: "3.5px 0", cursor: onPick ? "pointer" : "default" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 2, gap: 8 }}>
            <span style={{ fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.k}</span>
            <span style={{ fontWeight: 800, color: "var(--mut)", whiteSpace: "nowrap" }}>{fmt(it.v)}{it.sub ? <span style={{ color: "#b0a890", fontWeight: 600 }}> · {it.sub}</span> : null}</span>
          </div>
          <div style={{ height: 9, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(Math.abs(it.v) / mx) * 100}%`, background: color, borderRadius: 5 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Donut with legend (counts or money). Click a slice → drill. */
export function Donut({ items, fmt = fN, onPick, empty }: { items: { k: string; v: number }[]; fmt?: (v: number) => string; onPick?: (k: string) => void; empty?: string }) {
  const pos = items.filter(i => i.v > 0), tot = sum(pos, i => i.v);
  if (!tot) return <div style={{ fontSize: 12.5, color: "var(--mut)", padding: "24px 4px" }}>{empty ?? "Nothing to show"}</div>;
  const Rr = 58, Cc = 2 * Math.PI * Rr; let off = 0;
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox="0 0 150 150" style={{ width: 150, height: 150, flexShrink: 0 }}>
        {pos.map((h, i) => {
          const dash = (h.v / tot) * Cc, o = off; off += dash;
          return <circle key={h.k} cx={75} cy={75} r={Rr} fill="none" stroke={CAT[i % CAT.length]} strokeWidth={26} strokeDasharray={`${dash} ${Cc - dash}`} strokeDashoffset={-o} transform="rotate(-90 75 75)"
            style={{ cursor: onPick ? "pointer" : "default" }} onClick={() => onPick?.(h.k)}
            onMouseEnter={e => showTip(e, `<b>${h.k}</b><br/>${fmt(h.v)} · ${((h.v / tot) * 100).toFixed(1)}%`)} onMouseLeave={hideTip} />;
        })}
        <text x={75} y={72} textAnchor="middle" style={{ fontSize: 9, fill: "var(--mut)", letterSpacing: 1 }}>TOTAL</text>
        <text x={75} y={89} textAnchor="middle" style={{ fontFamily: "Georgia,serif", fontSize: 15, fontWeight: 700, fill: "var(--ink)" }}>{fmt(tot)}</text>
      </svg>
      <div style={{ flex: 1, minWidth: 160 }}>
        {pos.map((h, i) => (
          <div key={h.k} onClick={() => onPick?.(h.k)} style={{ display: "grid", gridTemplateColumns: "12px 1fr auto 44px", gap: 8, alignItems: "center", padding: "3px 0", fontSize: 12, cursor: onPick ? "pointer" : "default" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: CAT[i % CAT.length] }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.k}</span>
            <b>{fmt(h.v)}</b>
            <span style={{ color: "var(--mut)", textAlign: "right", fontSize: 11 }}>{((h.v / tot) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** One table of tasks used by the tabs and the drawer. */
export function TaskTable({ tasks, onPick, cols = "full", limit = 300, cut }: {
  tasks: VTask[]; onPick: (t: VTask) => void; cols?: "full" | "short" | "cost"; limit?: number; cut: number;
}) {
  const head = cols === "short" ? ["Activity", "Location", "Status", "Planned end", "Delay"]
    : cols === "cost" ? ["Type", "Tower", "Task Id", "Task name", "Trade", "Baseline start", "Baseline end", "Planned start", "Planned end", "Actual start", "Actual end", "Baseline cost", "Earned", "%", "Delay days"]
    : ["Tower", "Trade", "Task Id", "Activity", "Owner", "Location", "Baseline start", "Baseline end", "Planned start", "Planned end", "Actual start", "Actual end", "Delay (auto)", "Delay (actual)", "Status"];
  const numCols = new Set(["Delay", "Baseline cost", "Earned", "%", "Delay days", "Delay (auto)", "Delay (actual)", "Task Id"]);
  void cut;
  return (
    <div style={{ overflow: "auto", maxHeight: 520 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: cols === "short" ? 560 : 1400 }}>
        <thead><tr>{head.map(h => <th key={h} style={{ ...TH, ...(numCols.has(h) ? R : {}) }}>{h}</th>)}</tr></thead>
        <tbody>
          {tasks.slice(0, limit).map((t, i) => (
            <tr key={`${t.proj}-${t.id}-${i}`} onClick={() => onPick(t)} style={{ cursor: "pointer" }} {...hoverRow}>
              {cols === "short" ? <>
                <td style={{ ...TD, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", fontWeight: 700, color: "var(--ink)" }}>{t.name}</td>
                <td style={{ ...TD, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", color: "var(--mut)" }}>{t.loc}</td>
                <td style={TD}><StatusPill s={t.status} /></td>
                <td style={{ ...TD, ...R }}>{fD(t.pe)}</td>
                <td style={{ ...TD, ...R, fontWeight: 800, color: delayCol(t.phase === "done" ? null : t.delayActual) }}>{t.phase === "done" ? "—" : t.delayActual}</td>
              </> : cols === "cost" ? <>
                <td style={TD}>{t.type}</td><td style={TD}>{t.tower}</td><td style={{ ...TD, ...R }}>{t.id}</td>
                <td style={{ ...TD, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", fontWeight: 700, color: "var(--ink)" }}>{t.name}</td>
                <td style={{ ...TD, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }}>{t.trade}</td>
                <td style={TD}>{fD(t.bs)}</td><td style={TD}>{fD(t.be)}</td><td style={TD}>{fD(t.ps)}</td><td style={TD}>{fD(t.pe)}</td>
                <td style={TD}>{fD(t.as)}</td><td style={TD}>{fD(t.ae)}</td>
                <td style={{ ...TD, ...R, fontWeight: 700 }}>{t.cost ? fCr(t.cost) : "—"}</td>
                <td style={{ ...TD, ...R, color: C.TEAL, fontWeight: 700 }}>{t.ev ? fCr(t.ev) : "—"}</td>
                <td style={{ ...TD, ...R }}>{fPct(t.prog, 0)}</td>
                <td style={{ ...TD, ...R, fontWeight: 800, color: delayCol(t.phase === "done" ? null : t.delayActual) }}>{t.phase === "done" ? t.delayActual : t.delayActual || ""}</td>
              </> : <>
                <td style={TD}>{t.tower}</td>
                <td style={{ ...TD, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{t.trade}</td>
                <td style={{ ...TD, ...R }}>{t.id}</td>
                <td style={{ ...TD, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", fontWeight: 700, color: "var(--ink)" }}>{t.critical ? <span title="critical" style={{ color: C.RED }}>● </span> : null}{t.name}</td>
                <td style={TD}>{t.owner || "—"}</td>
                <td style={{ ...TD, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", color: "var(--mut)" }}>{t.loc}</td>
                <td style={TD}>{fD(t.bs)}</td><td style={TD}>{fD(t.be)}</td><td style={TD}>{fD(t.ps)}</td><td style={TD}>{fD(t.pe)}</td>
                <td style={TD}>{fD(t.as)}</td><td style={TD}>{fD(t.ae)}</td>
                <td style={{ ...TD, ...R, color: delayCol(t.delayAuto) }}>{t.delayAuto}</td>
                <td style={{ ...TD, ...R, fontWeight: 800, background: t.delayActual > 0 && t.phase !== "done" ? `rgba(224,50,44,${Math.min(0.12 + t.delayActual / 200, 0.6)})` : undefined, color: t.delayActual > 60 && t.phase !== "done" ? "#fff" : delayCol(t.delayActual) }}>{t.delayActual}</td>
                <td style={TD}><StatusPill s={t.status} /></td>
              </>}
            </tr>
          ))}
          {tasks.length > limit && <tr><td colSpan={head.length} style={{ ...TD, textAlign: "center", color: "var(--mut)" }}>showing {fN(limit)} of {fN(tasks.length)} — narrow with the filters or open the drill</td></tr>}
          {!tasks.length && <tr><td colSpan={head.length} style={{ ...TD, textAlign: "center", color: "var(--mut)", padding: 18 }}>No activities match the filters</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- drill drawer ---------------- */
export interface VDrill { title: string; sub?: string; tasks: VTask[]; task?: VTask }

export function VlDrawer({ sel, cut, onClose }: { sel: VDrill | null; cut: number; onClose: () => void }) {
  const [task, setTask] = useState<VTask | null>(null);
  useEffect(() => setTask(sel?.task ?? null), [sel]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const ts = sel?.tasks ?? [];
  const p = pctDone(ts, cut);
  const cost = sum(ts, t => t.cost), ev = sum(ts, t => t.ev);
  const late = ts.filter(t => t.lateRunning || t.lateStart).length;
  const Tile = ({ l, v, c, s }: { l: string; v: string; c: string; s?: string }) => (
    <div style={{ background: "#fff", border: "1px solid #eae6da", borderLeft: `5px solid ${c}`, borderRadius: 10, padding: "8px 11px" }}>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 16, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>{v}</div>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".8px", textTransform: "uppercase", color: "var(--mut)", marginTop: 3 }}>{l}</div>
      {s && <div style={{ fontSize: 10.5, color: "#8a8474", marginTop: 1, whiteSpace: "nowrap" }}>{s}</div>}
    </div>
  );
  const row = (k: string, v: React.ReactNode) => <><div style={{ color: "var(--mut)", fontWeight: 700 }}>{k}</div><div>{v}</div></>;
  return (
    <AnimatePresence>
      {sel && (
        <>
          <motion.div key="vov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.35)", zIndex: 220 }} />
          <motion.div key="vdw" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 32 }}
            role="dialog" aria-label={sel.title}
            style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(760px, 96vw)", zIndex: 221, background: "#f6f4ef", boxShadow: "-14px 0 46px rgba(20,33,61,.35)", display: "flex", flexDirection: "column" }}>
            <div style={{ background: C.NAVY, padding: "14px 18px", borderBottom: "3px solid var(--gold)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", color: "#c9b27c" }}>PROJECT TRACKER DRILL</div>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 700, color: "#fff", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {task && !sel.task ? <span onClick={() => setTask(null)} style={{ color: "#e7cf98", cursor: "pointer" }}>‹ {sel.title}</span> : sel.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.75)", marginTop: 2 }}>{task ? `Task ${task.id} · ${task.name}` : sel.sub ?? `${fN(ts.length)} activities`}</div>
                </div>
                <button onClick={onClose} aria-label="Close" style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 8, fontSize: 15, cursor: "pointer", flexShrink: 0 }}>✕</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
              {task ? (
                <div style={CARD}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                    <StatusPill s={task.status} />
                    {task.critical && <span style={{ background: "#fde8e6", color: C.RED, fontWeight: 800, fontSize: 10.5, borderRadius: 6, padding: "2px 8px" }}>Critical</span>}
                    {task.milestone && <span style={{ background: "#e6f4ef", color: "#0f6e56", fontWeight: 800, fontSize: 10.5, borderRadius: 6, padding: "2px 8px" }}>Milestone</span>}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "7px 12px", fontSize: 12.5 }}>
                    {row("Activity", <b style={{ whiteSpace: "normal" }}>{task.name}</b>)}
                    {row("Task Id", task.id)}
                    {row("Location", task.loc || "—")}
                    {row("Tower · type · category", `${task.tower} · ${task.type} · ${task.cat}`)}
                    {row("Trade", task.trade)}
                    {row("Owner", task.owner || "—")}
                    {row("Contractor · organisation", `${task.contractor || "—"} · ${task.org || "—"}`)}
                    {row("Progress", <span><b style={{ color: C.TEAL }}>{fPct(task.prog, 0)}</b><span style={{ display: "block", height: 8, background: "#f0ede5", borderRadius: 4, overflow: "hidden", marginTop: 4, maxWidth: 260 }}><span style={{ display: "block", height: "100%", width: `${Math.min(task.prog, 100)}%`, background: task.phase === "done" ? C.GREEN : C.TEAL }} /></span></span>)}
                    {row("Baseline (AOP)", `${fD(task.bs)} → ${fD(task.be)}`)}
                    {row("Planned", `${fD(task.ps)} → ${fD(task.pe)} · ${fN(task.dur)} days`)}
                    {row("Actual", `${fD(task.as)} → ${fD(task.ae)}`)}
                    {row("Delay (auto schedule)", <b style={{ color: delayCol(task.delayAuto) }}>{task.delayAuto} days <span style={{ fontWeight: 500, color: "var(--mut)" }}>planned end vs baseline end</span></b>)}
                    {row("Delay (actual status)", <b style={{ color: delayCol(task.delayActual) }}>{task.delayActual} days <span style={{ fontWeight: 500, color: "var(--mut)" }}>{task.phase === "done" ? "finished vs planned end" : task.phase === "started" ? "as-on vs planned end" : "as-on vs planned start"}</span></b>)}
                    {row("Baseline cost", task.cost ? fCr(task.cost) : "—")}
                    {row("Earned value", task.ev ? fCr(task.ev) : "—")}
                    {row("Reasons for variance", task.reasons.length ? task.reasons.join(", ") : "none recorded")}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
                    <Tile l="Activities" v={fN(ts.length)} c={C.NAVY} s={`${fN(ts.filter(t => t.phase === "done").length)} complete · ${fN(ts.filter(t => t.phase === "started").length)} started`} />
                    <Tile l="% complete" v={fPct(p.actual)} c={C.TEAL} s={`planned ${fPct(p.planned)} by as-on`} />
                    <Tile l="Delayed" v={fN(late)} c={late ? C.RED : C.GREEN} s="late running + late start" />
                    <Tile l="Baseline cost" v={fCr(cost)} c={C.GOLD} />
                    <Tile l="Earned value" v={fCr(ev)} c={C.GREEN} s={cost ? `${fPct((ev / cost) * 100)} of baseline` : undefined} />
                    <Tile l="Critical" v={fN(ts.filter(t => t.critical).length)} c={C.RED} s={`${fN(ts.filter(t => t.milestone).length)} milestones`} />
                  </div>
                  <div style={{ ...CARD, padding: "6px 8px" }}>
                    <TaskTable tasks={ts} onPick={setTask} cols="short" limit={500} cut={cut} />
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export { PHASE_LBL };
