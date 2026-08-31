import { useEffect, useMemo, useState } from "react";
import { showTip, hideTip } from "../common/hoverTip";
import { AnimatePresence, motion } from "framer-motion";
import { dayToDate, fNum } from "../../utils/footfallLogic";
import {
  HBarList, Donut, TrendChart, WeekdayChart, Banner, Spark,
  CARD, MCARD, H3, CAP, PAL, BLUE, TEAL, GOLD, GREEN, RED,
} from "./footfallCharts";
import {
  DG, applyChips, digMonthly, digWeekday, digInsights,
  DIM_NAMES, type Dim, type Chip, type DigRec,
} from "./digitalShared";
import { DigitalFunnelCard } from "./DigitalFunnelCard";

export interface DigDrillSeed { dim: Dim; val: number | string; label: string }

/** DIGITAL LEADS · DETAILED BREAKDOWN — right-side drawer for the
 * Digital tab, mirroring the footfall drill: removable chips (clicks
 * inside stack more), key-insight tiles, scoped KPIs w/ sparkline,
 * the enquiry→booking funnel, every breakdown card, trend + weekday,
 * scoped records, and the calculation explainer. */
export function DigitalDrillDrawer({ seed, baseRows, baseLabel, onClose }: {
  seed: DigDrillSeed | null;
  baseRows: DigRec[];
  baseLabel: string;
  onClose: () => void;
}) {
  const [chips, setChips] = useState<Chip[]>([]);
  const [page, setPage] = useState(1);
  const [showLogic, setShowLogic] = useState(false);

  useEffect(() => {
    if (seed) { setChips([{ dim: seed.dim, val: seed.val, label: seed.label }]); setPage(1); }
  }, [seed]);

  const rows = useMemo(() => applyChips(baseRows, chips), [baseRows, chips]);
  const total = rows.length;

  function addChip(dim: Dim) {
    return (val: number | string, label: string) => {
      setChips(prev => [...prev.filter(c => c.dim !== dim), { dim, val, label }]);
      setPage(1);
    };
  }
  function removeChip(dim: Dim) {
    const next = chips.filter(c => c.dim !== dim);
    if (next.length === 0) onClose(); else setChips(next);
    setPage(1);
  }
  const has = (dim: Dim) => chips.some(c => c.dim === dim);

  const insights = useMemo(() => digInsights(rows), [rows]);
  const monthly = useMemo(() => digMonthly(rows), [rows]);
  const weekday = useMemo(() => digWeekday(rows), [rows]);
  const QUAL = DG.STA.indexOf("Qualified");
  const qualified = rows.filter(r => r.sta === QUAL).length;
  const opp = rows.filter(r => r.stg >= 0).length;
  const activeDays = new Set(rows.filter(r => r.day >= 0).map(r => r.day)).size;

  const listFrom = (get: (r: DigRec) => number, names: string[], top = 8) => {
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

  const title = chips.map(c => `${DIM_NAMES[c.dim]}: ${c.label}`).join(" · ");

  return (
    <AnimatePresence>
      {seed && (
        <>
          <motion.div
            key="dgov"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.45)", zIndex: 70 }}
          />
          <motion.div
            key="dgdw"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(880px, 96vw)", zIndex: 71, background: "#f6f4ef", boxShadow: "-14px 0 50px rgba(20,33,61,.3)", display: "flex", flexDirection: "column" }}
          >
            {/* Header */}
            <div style={{ background: "#0f2233", padding: "18px 24px 16px", borderBottom: "3px solid #0e7490" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "1.6px", color: "#7fb8d4" }}>
                    DIGITAL LEADS · DETAILED BREAKDOWN
                  </div>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 21, fontWeight: 700, color: "#fff", marginTop: 4 }}>
                    {title}
                  </div>
                </div>
                <button onClick={onClose} aria-label="Close"
                  style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 9, fontSize: 16, cursor: "pointer", flexShrink: 0 }}>
                  ✕
                </button>
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>
                {chips.map(c => (
                  <button key={c.dim} onClick={() => removeChip(c.dim)}
                    style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.14)", color: "#fff", border: "none", borderRadius: 7, padding: "5px 11px", fontSize: 11.5, fontFamily: "inherit", cursor: "pointer" }}>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", color: "#7fb8d4" }}>{DIM_NAMES[c.dim].toUpperCase()}</span>
                    {c.label} <span style={{ opacity: 0.7 }}>✕</span>
                  </button>
                ))}
                <span style={{ fontSize: 10.5, color: "#7fb8d4", alignSelf: "center" }}>scope: {baseLabel}</span>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 30px" }}>
              {/* Insights */}
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

              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 4 }}>
                <KPI l="Enquiries" v={fNum(total)} s="in this selection" spark />
                <KPI l="Qualified" v={fNum(qualified)} s={`${((qualified / Math.max(total, 1)) * 100).toFixed(1)}%`} />
                <KPI l="Opportunities" v={fNum(opp)} s={`${((opp / Math.max(total, 1)) * 100).toFixed(1)}% converted`} />
                <KPI l="Avg / active day" v={activeDays ? (total / activeDays).toFixed(0) : "0"} s={`${fNum(activeDays)} active days`} />
              </div>

              <div><Banner title="DIGITAL LEADS ANALYSIS" sub={`${fNum(total)} enquiries in selection`} /></div>

              <DigitalFunnelCard rows={rows} />

              {/* Breakdown cards */}
              <div style={{ columnWidth: 310, columnGap: 12 }}>
                {!has("sub") && (
                  <div style={MCARD}>
                    <h3 style={H3}>By sub-source</h3>
                    <div style={CAP}>click → narrow further</div>
                    <HBarList items={listFrom(r => r.sub, DG.SUB)} total={total} color={BLUE} onPick={addChip("sub")} />
                  </div>
                )}
                {!has("sta") && (
                  <div style={MCARD}>
                    <h3 style={H3}>Presales status</h3>
                    <div style={CAP}>qualification outcome</div>
                    <Donut
                      segs={listFrom(r => r.sta, DG.STA, 6).map(s => ({
                        ...s,
                        color: s.label === "Qualified" ? GREEN : s.label === "Not Qualified" ? RED : s.label === "In Progress" ? GOLD : TEAL,
                      }))}
                      onPick={addChip("sta")}
                    />
                  </div>
                )}
                {!has("p") && (
                  <div style={MCARD}>
                    <h3 style={H3}>By project / campaign</h3>
                    <div style={CAP}>click → narrow further</div>
                    <HBarList items={listFrom(r => r.p, DG.PRJ)} total={total} color={GOLD} onPick={addChip("p")} />
                  </div>
                )}
                {!has("ag") && (
                  <div style={MCARD}>
                    <h3 style={H3}>Agency source</h3>
                    <div style={CAP}>click → narrow further</div>
                    <HBarList items={listFrom(r => r.ag, DG.AGN)} total={total} color={TEAL} onPick={addChip("ag")} />
                  </div>
                )}
                {!has("ow") && (
                  <div style={MCARD}>
                    <h3 style={H3}>Presales owner</h3>
                    <div style={CAP}>click → narrow further</div>
                    <HBarList items={listFrom(r => r.ow, DG.OWN)} total={total} color="#7b5cb8" onPick={addChip("ow")} />
                  </div>
                )}
                {!has("stg") && (
                  <div style={MCARD}>
                    <h3 style={H3}>Opportunity stage</h3>
                    <div style={CAP}>{fNum(opp)} became opportunities</div>
                    <Donut
                      segs={listFrom(r => r.stg, DG.STG, 8).map((s, i) => ({
                        ...s,
                        color: s.label === "Booked" ? GREEN : s.label === "Closed Lost" ? RED : s.label === "In Progress" ? GOLD : PAL[i % PAL.length],
                      }))}
                      onPick={addChip("stg")}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12, marginTop: 0, alignItems: "start" }}>
                {!has("mon") && (
                  <div style={CARD}>
                    <h3 style={H3}>Enquiry trend</h3>
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

              {/* Records */}
              <div><Banner title="ENQUIRY RECORDS" sub={`${fNum(total)} in selection · PII excluded`} /></div>
              <div style={{ ...CARD, paddingBottom: 6 }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--line)" }}>
                        {["Date", "Sub source", "Project", "Status", "Agency", "Opp. stage"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "var(--mut)", fontSize: 10, letterSpacing: "1px", textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                          <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{r.day >= 0 ? dayToDate(r.day).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{r.sub >= 0 ? DG.SUB[r.sub] : "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{r.p >= 0 ? DG.PRJ[r.p] : "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{r.sta >= 0 ? DG.STA[r.sta] : "—"}</td>
                          <td style={{ padding: "6px 8px", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.ag >= 0 ? DG.AGN[r.ag] : "—"}</td>
                          <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{r.stg >= 0 ? DG.STG[r.stg] : "—"}</td>
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

              {/* Logic explainer */}
              <div style={{ ...CARD, marginTop: 12 }}>
                <button onClick={() => setShowLogic(v => !v)}
                  style={{ background: "none", border: "none", fontFamily: "Georgia,serif", fontSize: 14.5, fontWeight: 700, color: "var(--ink)", cursor: "pointer", padding: 0 }}>
                  {showLogic ? "▾" : "▸"} How these numbers are calculated
                </button>
                {showLogic && (
                  <div style={{ fontSize: 12.5, color: "#3d4a63", lineHeight: 1.65, marginTop: 8 }}>
                    Every figure is a straight count over the rows of {DG.meta.source} matching the chips above — no sampling or estimation,
                    so totals always reconcile with the source file. <b>Qualified</b> counts the presales Status column;
                    <b> Opportunities</b> = rows where an opportunity Stage exists (CRM creates a stage only when an opportunity is created).
                    <b> Funnel</b> steps are nested populations down to Booked. Agency names are case-normalised.
                    Blank cells are excluded from a card but never from totals. {DG.meta.note}.
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
