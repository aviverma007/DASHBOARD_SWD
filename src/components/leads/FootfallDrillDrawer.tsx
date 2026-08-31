import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FF, ffApply, ffCount, ffMonthly, ffWeekday, ffInsights, fNum, dayToDate,
  type FfFilter, type FfDim, type FfRecord,
} from "../../utils/footfallLogic";
import {
  HBarList, Donut, TrendChart, WeekdayChart, FunnelChart, Banner, Spark,
  CARD, H3, CAP, PAL, BLUE, TEAL, GOLD, GREEN, RED,
} from "./footfallCharts";

export interface DrillSeed { dim: FfDim; val: number | string; label: string }

const DIM_NAMES: Record<FfDim, string> = {
  g: "Gallery", p: "Project", src: "Source", loc: "Locality", age: "Age band",
  mon: "Month", dow: "Weekday", stg: "Stage", cat: "Category", cp: "Channel partner",
};

/** CUSTOMER FOOTFALL · DETAILED BREAKDOWN — right-side drawer opened
 * by clicking any bar/slice/month/weekday/partner, mirroring the
 * reference suite's drill view: filter chips, key-insight tiles,
 * scoped KPI strip (with sparkline), the full analysis card set
 * including the conversion funnel down to Booked, and scoped records.
 * Clicking inside the drawer stacks more chips (e.g. Gallery 62 →
 * One DXP → Nov'24). Every number = a straight count over the Excel
 * rows matching the chips, so nothing can drift from the source. */
export function FootfallDrillDrawer({ seed, baseRows, baseLabel, onClose, showBooking = true }: {
  seed: DrillSeed | null;
  /** Page-scoped rows (global project/period selections already applied) */
  baseRows: FfRecord[];
  baseLabel: string;
  onClose: () => void;
  /** false on the CP-visits tab: hides the funnel, stage card and
   * booking insights (bookings are a footfall/digital concern). */
  showBooking?: boolean;
}) {
  const [chips, setChips] = useState<FfFilter[]>([]);
  const [showLogic, setShowLogic] = useState(false);
  const [page, setPage] = useState(1);

  // Re-seed whenever a new drill is opened
  useEffect(() => {
    if (seed) { setChips([{ dim: seed.dim, val: seed.val, label: seed.label }]); setPage(1); }
  }, [seed]);

  const rows = useMemo(() => ffApply(baseRows, chips), [baseRows, chips]);
  const total = rows.length;

  function addChip(dim: FfDim, val: number | string, label: string) {
    setChips(prev => [...prev.filter(f => f.dim !== dim), { dim, val, label }]);
    setPage(1);
  }
  function removeChip(dim: FfDim) {
    const next = chips.filter(f => f.dim !== dim);
    if (next.length === 0) onClose(); else setChips(next);
    setPage(1);
  }
  const has = (dim: FfDim) => chips.some(f => f.dim === dim);

  const insights = useMemo(
    () => ffInsights(rows).filter(i => showBooking || i.k !== "Booking outcome"),
    [rows, showBooking]
  );
  const monthly = useMemo(() => ffMonthly(rows), [rows]);
  const weekday = useMemo(() => ffWeekday(rows), [rows]);

  const direct = rows.filter(r => r.src === 0 || r.src === 2).length;
  const withCp = rows.filter(r => r.src === 1).length;
  const uProj = new Set(rows.map(r => r.p)).size;
  const activeDays = new Set(rows.filter(r => r.day >= 0).map(r => r.day)).size;

  const listFrom = (map: Map<number, number>, names: string[], top = 8) =>
    [...map.entries()].filter(([k]) => k >= 0).map(([key, value]) => ({ key, label: names[key], value }))
      .sort((a, b) => b.value - a.value).slice(0, top);

  const PER = 8;
  const sorted = useMemo(() => [...rows].sort((a, b) => b.day - a.day), [rows]);
  const pages = Math.max(1, Math.ceil(sorted.length / PER));
  const shown = sorted.slice((page - 1) * PER, page * PER);

  const KPI = ({ l, v, s, spark }: { l: string; v: string; s?: string; spark?: boolean }) => (
    <div style={{ ...CARD, padding: "12px 15px" }}>
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
            key="ffov"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.45)", zIndex: 70 }}
          />
          <motion.div
            key="ffdw"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(880px, 96vw)", zIndex: 71, background: "#f6f4ef", boxShadow: "-14px 0 50px rgba(20,33,61,.3)", display: "flex", flexDirection: "column" }}
          >
            {/* Header — dark, reference-style */}
            <div style={{ background: "#0f2233", padding: "18px 24px 16px", borderBottom: "3px solid #0e7490" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "1.6px", color: "#7fb8d4" }}>
                    CUSTOMER FOOTFALL · DETAILED BREAKDOWN
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
              {/* Chips */}
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
              {/* Key insights */}
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

              {/* KPI strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 4 }}>
                <KPI l="Footfall" v={fNum(total)} s="in this selection" spark />
                <KPI l="Direct" v={fNum(direct)} s={`${((direct / Math.max(total, 1)) * 100).toFixed(1)}%`} />
                <KPI l="With CP" v={fNum(withCp)} s={`${((withCp / Math.max(total, 1)) * 100).toFixed(1)}%`} />
                <KPI l="Unique projects" v={fNum(uProj)} s="visited" />
                <KPI l="Avg / active day" v={activeDays ? (total / activeDays).toFixed(0) : "0"} s={`${fNum(activeDays)} active days`} />
              </div>

              <div><Banner title="FOOTFALL ANALYSIS" sub={`${fNum(total)} customer visits in selection`} /></div>

              {/* Funnel — till booking (footfall/digital only) */}
              {showBooking && (
                <div style={{ ...CARD, marginBottom: 12 }}>
                  <h3 style={H3}>Conversion funnel — till booking</h3>
                  <div style={CAP}>how this selection's visits progressed</div>
                  <FunnelChart records={rows} />
                </div>
              )}

              {/* Breakdown cards (hidden for filtered dims) */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
                {!has("g") && (
                  <div style={CARD}>
                    <h3 style={H3}>By gallery</h3>
                    <div style={CAP}>click → narrow further</div>
                    <HBarList items={listFrom(ffCount(rows, r => r.g), FF.G)} total={total} color={BLUE} onPick={(k, l) => addChip("g", k, l)} />
                  </div>
                )}
                {!has("p") && (
                  <div style={CARD}>
                    <h3 style={H3}>By project</h3>
                    <div style={CAP}>click → narrow further</div>
                    <HBarList items={listFrom(ffCount(rows, r => r.p), FF.P)} total={total} color={GOLD} onPick={(k, l) => addChip("p", k, l)} />
                  </div>
                )}
                {!has("src") && (
                  <div style={CARD}>
                    <h3 style={H3}>Direct vs channel-partner</h3>
                    <div style={CAP}>walk-in source</div>
                    <Donut
                      segs={[
                        { key: 1, label: "With CP", value: withCp, color: TEAL },
                        { key: 0, label: "Direct", value: rows.filter(r => r.src === 0).length, color: BLUE },
                        { key: 2, label: "Direct Loyalty", value: rows.filter(r => r.src === 2).length, color: GOLD },
                      ].filter(s => s.value > 0)}
                      onPick={(k, l) => addChip("src", k, l)}
                    />
                  </div>
                )}
                {!has("loc") && (
                  <div style={CARD}>
                    <h3 style={H3}>Customer locality</h3>
                    <div style={CAP}>click → narrow further</div>
                    <HBarList items={listFrom(ffCount(rows, r => r.loc), FF.LOC)} total={total} color={TEAL} onPick={(k, l) => addChip("loc", k, l)} />
                  </div>
                )}
                {!has("age") && (
                  <div style={CARD}>
                    <h3 style={H3}>Age group</h3>
                    <div style={CAP}>{fNum(rows.filter(r => r.age >= 0).length)} of {fNum(total)} captured</div>
                    <Donut
                      segs={listFrom(ffCount(rows, r => r.age), FF.AGE, 12).map((s, i) => ({ ...s, color: PAL[i % PAL.length] }))}
                      onPick={(k, l) => addChip("age", k, l)}
                    />
                  </div>
                )}
                {showBooking && !has("stg") && (
                  <div style={CARD}>
                    <h3 style={H3}>Opportunity stage</h3>
                    <div style={CAP}>current status mix</div>
                    <Donut
                      segs={listFrom(ffCount(rows, r => r.stg), FF.STG, 8).map(s => ({
                        ...s,
                        color: s.label === "Booked" ? GREEN : s.label === "Closed Lost" ? RED : s.label === "In Progress" ? GOLD : s.label === "Site Visit" ? TEAL : BLUE,
                      }))}
                      onPick={(k, l) => addChip("stg", k, l)}
                    />
                  </div>
                )}
                {!has("cp") && (
                  <div style={CARD}>
                    <h3 style={H3}>Top channel partners</h3>
                    <div style={CAP}>CP-sourced visits · click → partner</div>
                    <HBarList
                      items={listFrom(ffCount(rows.filter(r => r.src === 1), r => r.cp), FF.CPN)}
                      total={withCp} color={BLUE}
                      onPick={(k, l) => addChip("cp", k, l)}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12, marginTop: 12 }}>
                {!has("mon") && (
                  <div style={CARD}>
                    <h3 style={H3}>Footfall trend</h3>
                    <div style={CAP}>click a month → narrow</div>
                    <TrendChart items={monthly} onPick={(k, l) => addChip("mon", k, l)} />
                  </div>
                )}
                {!has("dow") && (
                  <div style={CARD}>
                    <h3 style={H3}>Weekday pattern</h3>
                    <div style={CAP}>click a day → narrow</div>
                    <WeekdayChart items={weekday} onPick={(k, l) => addChip("dow", k, l)} />
                  </div>
                )}
              </div>

              {/* Records */}
              <div><Banner title="SITE-VISIT RECORDS" sub={`${fNum(total)} in selection`} /></div>
              <div style={{ ...CARD, paddingBottom: 6 }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--line)" }}>
                        {["Date", "Gallery", "Project", "Source", "Channel partner", "Stage"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "var(--mut)", fontSize: 10, letterSpacing: "1px", textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                          <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{r.day >= 0 ? dayToDate(r.day).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{r.g >= 0 ? FF.G[r.g] : "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{r.p >= 0 ? FF.P[r.p] : "—"}</td>
                          <td style={{ padding: "6px 8px" }}>{r.src === 1 ? "CP" : r.src === 0 ? "Direct" : r.src === 2 ? "Loyalty" : "—"}</td>
                          <td style={{ padding: "6px 8px", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.cp >= 0 ? FF.CPN[r.cp] : "—"}</td>
                          <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{r.stg >= 0 ? FF.STG[r.stg] : "—"}</td>
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
                    Every figure is a straight count over the Excel rows (Footfall_data_till_21_aug.xlsx · "Customer Site Visit" · 54,222 rows)
                    that match the active chips above — no sampling, weighting or estimation, so totals always reconcile with the source file.
                    <b> Footfall</b> = matching rows. <b>Direct / With CP</b> = split on the Walk-in Source column (Direct Loyalty counts with Direct in the KPI; the source donut shows it separately).
                    <b> Funnel</b>: Opportunity Stage is a <i>current status</i>, so bands are nested populations — In pipeline = everyone not Closed Lost;
                    Progressed = Submitted to CRM / In Progress / Inventory / Booked; Booked = stage exactly "Booked". Percentages show each band vs total footfall and vs the previous band.
                    <b> Insights</b>: each "top" tile is the modal value of its column within this selection, with its share of the selection's visits.
                    <b> Busiest month / trend</b> use Opportunity Created Date; <b>weekday</b> is that date's day-of-week.
                    Rows with a blank in a column are excluded from that column's chart but never from the totals.
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
