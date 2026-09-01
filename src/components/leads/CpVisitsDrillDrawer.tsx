import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { dayToDate, fNum } from "../../utils/footfallLogic";
import {
  CPV, cpvApply, cpvMonthly, cpvWeekday, cpvInsights, cpvFirstVisitMap,
  CPV_DIM_NAMES, type CpvDim, type CpvChip, type CpvRec,
} from "../../utils/cpVisitsLogic";
import {
  HBarList, Donut, TrendChart, WeekdayChart, Banner, Spark,
  CARD, H3, CAP, PAL, BLUE, TEAL, GOLD, GREEN,
} from "./footfallCharts";
import { showTip, hideTip } from "../common/hoverTip";

export interface CpvDrillSeed { dim: CpvDim; val: number | string; label: string }

/** CHANNEL PARTNER VISITS · DETAILED BREAKDOWN — drill drawer over
 * the dedicated CP gallery-visit export. Same interaction model as
 * the footfall/digital drawers: removable chips that stack, insight
 * tiles, scoped KPIs, breakdown cards, trend + weekday, records and
 * the calculation explainer. No booking data — this file tracks
 * partner engagement, not customer conversion. */
export function CpVisitsDrillDrawer({ seed, baseRows, baseLabel, onClose }: {
  seed: CpvDrillSeed | null;
  baseRows: CpvRec[];
  baseLabel: string;
  onClose: () => void;
}) {
  const [chips, setChips] = useState<CpvChip[]>([]);
  const [page, setPage] = useState(1);
  const [showLogic, setShowLogic] = useState(false);
  const FIRST = useMemo(() => cpvFirstVisitMap(), []);

  useEffect(() => {
    if (seed) { setChips([{ dim: seed.dim, val: seed.val, label: seed.label }]); setPage(1); }
  }, [seed]);

  const rows = useMemo(() => cpvApply(baseRows, chips), [baseRows, chips]);
  const total = rows.length;

  function addChip(dim: CpvDim) {
    return (val: number | string, label: string) => {
      setChips(prev => [...prev.filter(c => c.dim !== dim), { dim, val, label }]);
      setPage(1);
    };
  }
  function removeChip(dim: CpvDim) {
    const next = chips.filter(c => c.dim !== dim);
    if (next.length === 0) onClose(); else setChips(next);
    setPage(1);
  }
  const has = (dim: CpvDim) => chips.some(c => c.dim === dim);

  const insights = useMemo(() => cpvInsights(rows, FIRST), [rows, FIRST]);
  const monthly = useMemo(() => cpvMonthly(rows), [rows]);
  const weekday = useMemo(() => cpvWeekday(rows), [rows]);
  const uniq = new Set(rows.filter(r => r.cp >= 0).map(r => r.cp));
  const revisits = rows.filter(r => r.cp >= 0 && r.day >= 0 && r.day > (FIRST.get(r.cp) ?? Infinity)).length;
  const activeDays = new Set(rows.filter(r => r.day >= 0).map(r => r.day)).size;

  const listFrom = (get: (r: CpvRec) => number, names: string[], top = 8) => {
    const m = new Map<number, number>();
    rows.forEach(r => { const k = get(r); if (k >= 0) m.set(k, (m.get(k) ?? 0) + 1); });
    return [...m.entries()].map(([key, value]) => ({ key, label: names[key], value }))
      .sort((a, b) => b.value - a.value).slice(0, top);
  };

  const PER = 8;
  const sorted = useMemo(() => [...rows].sort((a, b) => b.day - a.day), [rows]);
  const pages = Math.max(1, Math.ceil(sorted.length / PER));
  const shown = sorted.slice((page - 1) * PER, page * PER);

  const KPI = ({ l, v, s, spark }: { l: string; v: string; s?: string; spark?: boolean }) => (
    <div style={{ ...CARD, padding: "12px 15px" }}
      onMouseEnter={e => showTip(e, `<b>${l}</b><br/>${v}${s ? ` · ${s}` : ""}`)}
      onMouseMove={e => showTip(e, `<b>${l}</b><br/>${v}${s ? ` · ${s}` : ""}`)}
      onMouseLeave={hideTip}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)" }}>{l}</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 21, fontWeight: 700, color: "var(--ink)", marginTop: 3 }}>{v}</div>
      {s && <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 1 }}>{s}</div>}
      {spark && <Spark items={monthly.slice(-18)} />}
    </div>
  );

  const title = chips.map(c => `${CPV_DIM_NAMES[c.dim]}: ${c.label}`).join(" · ");

  return (
    <AnimatePresence>
      {seed && (
        <>
          <motion.div key="cpvov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.45)", zIndex: 70 }} />
          <motion.div key="cpvdw" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(880px, 96vw)", zIndex: 71, background: "#f6f4ef", boxShadow: "-14px 0 50px rgba(20,33,61,.3)", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#0f2233", padding: "18px 24px 16px", borderBottom: "3px solid #0e7490" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "1.6px", color: "#7fb8d4" }}>
                    CHANNEL PARTNER VISITS · DETAILED BREAKDOWN
                  </div>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 21, fontWeight: 700, color: "#fff", marginTop: 4 }}>{title}</div>
                </div>
                <button onClick={onClose} aria-label="Close"
                  style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 9, fontSize: 16, cursor: "pointer", flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>
                {chips.map(c => (
                  <button key={c.dim} onClick={() => removeChip(c.dim)}
                    style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.14)", color: "#fff", border: "none", borderRadius: 7, padding: "5px 11px", fontSize: 11.5, fontFamily: "inherit", cursor: "pointer" }}>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", color: "#7fb8d4" }}>{CPV_DIM_NAMES[c.dim].toUpperCase()}</span>
                    {c.label} <span style={{ opacity: 0.7 }}>✕</span>
                  </button>
                ))}
                <span style={{ fontSize: 10.5, color: "#7fb8d4", alignSelf: "center" }}>scope: {baseLabel}</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 30px" }}>
              <div style={{ ...CARD, marginBottom: 14 }}>
                <h3 style={H3}>Key insights for this selection</h3>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                  {insights.map(i => (
                    <div key={i.k} style={{ background: "#faf9f6", border: "1px solid #eae6da", borderRadius: 10, padding: "10px 14px", minWidth: 170 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "var(--mut)" }}>{i.k}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginTop: 3 }}>{i.v}</div>
                      <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 1 }}>{i.hint}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 4 }}>
                <KPI l="CP visits" v={fNum(total)} s="in this selection" spark />
                <KPI l="Unique partners" v={fNum(uniq.size)} />
                <KPI l="Revisits" v={fNum(revisits)} s={`${((revisits / Math.max(total, 1)) * 100).toFixed(1)}%`} />
                <KPI l="Avg / active day" v={activeDays ? (total / activeDays).toFixed(0) : "0"} s={`${fNum(activeDays)} active days`} />
              </div>

              <div><Banner title="CHANNEL PARTNER ENGAGEMENT" sub={`${fNum(total)} CP visits in selection`} /></div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 12 }}>
                {!has("g") && (
                  <div style={CARD}>
                    <h3 style={H3}>By gallery</h3>
                    <div style={CAP}>click → narrow further</div>
                    <HBarList items={listFrom(r => r.g, CPV.G)} total={total} color={BLUE} onPick={addChip("g")} />
                  </div>
                )}
                {!has("p") && (
                  <div style={CARD}>
                    <h3 style={H3}>By project</h3>
                    <div style={CAP}>click → narrow further</div>
                    <HBarList items={listFrom(r => r.p, CPV.PRJ)} total={total} color={GOLD} onPick={addChip("p")} maxHeight={230} />
                  </div>
                )}
                {!has("cp") && (
                  <div style={CARD}>
                    <h3 style={H3}>Top partners</h3>
                    <div style={CAP}>click → partner</div>
                    <HBarList items={listFrom(r => r.cp, CPV.CPN)} total={total} color={TEAL} onPick={addChip("cp")} maxHeight={230} />
                  </div>
                )}
                {!has("asg") && (
                  <div style={CARD}>
                    <h3 style={H3}>Assigned RM</h3>
                    <div style={CAP}>who handles the partner · click → RM</div>
                    <HBarList items={listFrom(r => r.asg, CPV.ASG)} total={total} color="#7b5cb8" onPick={addChip("asg")} maxHeight={230} />
                  </div>
                )}
                {!has("sta") && (
                  <div style={CARD}>
                    <h3 style={H3}>Visit status</h3>
                    <div style={CAP}>click a slice</div>
                    <Donut
                      segs={listFrom(r => r.sta, CPV.STA, 6).map(s => ({
                        ...s,
                        color: s.label === "Completed" ? GREEN : s.label === "Scheduled" ? GOLD : s.label === "In Progress" ? TEAL : PAL[3],
                      }))}
                      onPick={addChip("sta")}
                    />
                  </div>
                )}
                {!has("vt") && (
                  <div style={CARD}>
                    <h3 style={H3}>Visit type</h3>
                    <div style={CAP}>{fNum(rows.filter(r => r.vt >= 0).length)} of {fNum(total)} specified</div>
                    <Donut
                      segs={listFrom(r => r.vt, CPV.VT, 4).map((s, i) => ({ ...s, color: [TEAL, GOLD, BLUE][i % 3] }))}
                      onPick={addChip("vt")}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 12, marginTop: 12, alignItems: "start" }}>
                {!has("mon") && (
                  <div style={CARD}>
                    <h3 style={H3}>Visits trend</h3>
                    <div style={CAP}>click a month → narrow</div>
                    <TrendChart items={monthly} onPick={addChip("mon")} />
                  </div>
                )}
                {!has("dow") && (
                  <div style={CARD}>
                    <h3 style={H3}>Weekday pattern</h3>
                    <div style={CAP}>click a day → narrow</div>
                    <WeekdayChart items={weekday} onPick={addChip("dow")} />
                  </div>
                )}
              </div>

              <div><Banner title="VISIT RECORDS" sub={`${fNum(total)} in selection · rep names excluded`} /></div>
              <div style={{ ...CARD, paddingBottom: 6 }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--line)" }}>
                        {["Date", "Gallery", "Project", "Channel partner", "Assigned RM", "Status", "Type", "Group"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "var(--mut)", fontSize: 10, letterSpacing: "1px", textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                          <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{r.day >= 0 ? dayToDate(r.day).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{r.g >= 0 ? CPV.G[r.g] : "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{r.p >= 0 ? CPV.PRJ[r.p] : "—"}</td>
                          <td style={{ padding: "6px 8px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.cp >= 0 ? CPV.CPN[r.cp] : "—"}</td>
                          <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{r.asg >= 0 ? CPV.ASG[r.asg] : "—"}</td>
                          <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{r.sta >= 0 ? CPV.STA[r.sta] : "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{r.vt >= 0 ? CPV.VT[r.vt] : "—"}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right" }}>{r.nv > 0 ? r.nv : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0 4px", fontSize: 12, color: "var(--mut)" }}>
                  <span>Page {page} of {fNum(pages)}</span>
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ marginLeft: "auto", border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "4px 11px", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.45 : 1, fontFamily: "inherit" }}>‹ Prev</button>
                  <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={{ border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "4px 11px", cursor: page >= pages ? "default" : "pointer", opacity: page >= pages ? 0.45 : 1, fontFamily: "inherit" }}>Next ›</button>
                </div>
              </div>

              <div style={{ ...CARD, marginTop: 12 }}>
                <button onClick={() => setShowLogic(v => !v)}
                  style={{ background: "none", border: "none", fontFamily: "Georgia,serif", fontSize: 14.5, fontWeight: 700, color: "var(--ink)", cursor: "pointer", padding: 0 }}>
                  {showLogic ? "▾" : "▸"} How these numbers are calculated
                </button>
                {showLogic && (
                  <div style={{ fontSize: 12.5, color: "#3d4a63", lineHeight: 1.65, marginTop: 8 }}>
                    Every figure is a straight count over the rows of {CPV.meta.source} ({fNum(CPV.meta.rows)} partner visits)
                    matching the chips above. A row = one channel-partner rep visiting a sales gallery, stamped with its
                    Date &amp; Time of Site visit. <b>Revisit</b> = the partner already had an earlier visit anywhere in the data;
                    <b> group</b> = the "No of Visitors" column where recorded. Blank cells are excluded from a card but never
                    from totals. {CPV.meta.note}.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
