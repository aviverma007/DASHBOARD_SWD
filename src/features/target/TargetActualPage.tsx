import { useEffect, useMemo, useState } from "react";
import rawTarget from "../../data/targetData.json";
import rawTV from "../../data/tvAnalytics.json";
import "../../components/inventory/smartworldInventory.css";
import { UnitsTargetCard } from "../../components/target/UnitsTargetCard";
import type { TVADataPoint } from "../../components/target/UnitsTargetCard";
import { AvgRateCard } from "../../components/target/AvgRateCard";
import type { RatePoint } from "../../components/target/AvgRateCard";
import { TowerSoldPctCard } from "../../components/target/TowerSoldPctCard";
import { TowerRateMovementCard } from "../../components/target/TowerRateMovementCard";
import { RateTrendOverTimeCard } from "../../components/target/RateTrendOverTimeCard";
import { TypeWiseSaleCard } from "../../components/target/TypeWiseSaleCard";
import { MonthDrillDrawer } from "../../components/target/MonthDrillDrawer";
import { ScopeDrawer } from "../../components/target/ScopeDrawer";

interface MonthMeta { year: number; month: number; label: string; }
interface ProjectTarget { name: string; units: number[]; area: number[]; rate: number[]; sale_value: number[]; }
interface TargetData { months: MonthMeta[]; projects: ProjectTarget[]; }
interface TowerRow { name: string; sold: number; unsold: number; total: number; sold_pct: number; tsv: number; avg_rate: number; year_rates: Record<string, number>; }
interface CfgRow { name: string; sold: number; unsold: number; total: number; sold_pct: number; avg_area: number; }
interface RateTrendPt { key: string; rate: number; units: number; }
interface ProjectAnalytics { name: string; sold: number; tsv: number; area: number; avg_rate: number; monthly_units: number[]; monthly_tsv: number[]; monthly_area: number[]; towers: TowerRow[]; configs: CfgRow[]; rate_trend: RateTrendPt[]; }
interface TVData { monthly_rates: RateTrendPt[]; projects: ProjectAnalytics[]; }

const TD = rawTarget as unknown as TargetData;
const TV = rawTV as unknown as TVData;
const TIMELINE = TD.months; // 24 months, Apr'25 .. Mar'27

type PeriodType = "all" | "year" | "quarter" | "month";
const QUARTER_LABELS = ["Q1", "Q2", "Q3", "Q4"];

// FY label = the year the fiscal year ENDS in (Apr'25→Mar'26 = "FY 2025-26").
function fyEndYear(year: number, month: number): number {
  return month >= 4 ? year + 1 : year;
}
function fyQuarter(month: number): number {
  // FY quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
  return month >= 4 ? Math.floor((month - 4) / 3) : Math.floor((month + 8) / 3);
}

// Build the list of fiscal years actually present in the timeline (works
// regardless of where the timeline starts — no hardcoded indices).
const YEAR_OPTIONS = (() => {
  const seen = new Map<number, { start: number; end: number }>();
  TD.months.forEach((m, i) => {
    const fy = fyEndYear(m.year, m.month);
    const existing = seen.get(fy);
    if (existing) existing.end = i;
    else seen.set(fy, { start: i, end: i });
  });
  return [...seen.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([fy, range]) => ({ label: `FY ${fy - 1}-${String(fy).slice(-2)}`, start: range.start, end: range.end }));
})();

function todayIsFuture(year: number, month: number): boolean {
  const now = new Date();
  return year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
}

// ── Single-select project dropdown ────────────────────────────────────────────
function ProjectSelect({ projects, selected, onChange }: { projects: string[]; selected: string; onChange: (n: string) => void }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Project</label>
      <select value={selected} onChange={e => onChange(e.target.value)} style={{ minWidth: 220, background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
        {projects.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function TargetActualPage() {
  const [selectedProject, setSelectedProject] = useState<string>(TD.projects[0]?.name ?? "");
  const [chartGranularity, setChartGranularity] = useState<"month" | "quarter" | "year">("month");
  const [periodType, setPeriodType] = useState<PeriodType>("all");
  const [yearIdx, setYearIdx] = useState<number>(YEAR_OPTIONS.length - 1);
  const [quarter, setQuarter] = useState<number>(1);
  const [month, setMonth] = useState<number>(0); // index into the selected year's 12 months

  const [drillMonth, setDrillMonth] = useState<TVADataPoint | null>(null);
  const [drillScope, setDrillScope] = useState<{ type: "tower" | "config"; label: string } | null>(null);

  const target = TD.projects.find(p => p.name === selectedProject);
  const actual = TV.projects.find(p => p.name === selectedProject);

  function handleReset() {
    setPeriodType("all"); setYearIdx(1); setQuarter(1); setMonth(0); setChartGranularity("month");
  }

  // Visible month range (indices into the 24-month TIMELINE)
  const [rangeStart, rangeEnd] = useMemo<[number, number]>(() => {
    if (periodType === "all") return [0, TIMELINE.length - 1];
    if (periodType === "year") return [YEAR_OPTIONS[yearIdx].start, YEAR_OPTIONS[yearIdx].end];
    if (periodType === "quarter") {
      const yr = YEAR_OPTIONS[yearIdx];
      const qStart = yr.start + (quarter - 1) * 3;
      return [Math.min(qStart, yr.end), Math.min(qStart + 2, yr.end)];
    }
    // month
    const yr = YEAR_OPTIONS[yearIdx];
    return [yr.start + month, yr.start + month];
  }, [periodType, yearIdx, quarter, month]);

  // ── Shared master timeline, aggregated by the selected granularity ─────
  // A month is "active" if ANY of target-units/actual-units/target-TSV/
  // actual-TSV/target-area/actual-area is non-zero.
  const activeIdxs = useMemo(() => {
    const idxs: number[] = [];
    for (let i = rangeStart; i <= rangeEnd; i++) {
      const tU = target?.units[i] ?? 0, aU = actual?.monthly_units[i] ?? 0;
      const tV = target?.sale_value[i] ?? 0, aV = actual?.monthly_tsv[i] ?? 0;
      const tA = target?.area[i] ?? 0, aA = actual?.monthly_area[i] ?? 0;
      if (tU > 0 || aU > 0 || tV > 0 || aV > 0 || tA > 0 || aA > 0) idxs.push(i);
    }
    return idxs;
  }, [target, actual, rangeStart, rangeEnd]);

  interface Bucket { label: string; idxs: number[]; isFuture: boolean; year: number; month: number; }

  // Buckets: one per visible month/quarter/year, each carrying the list of
  // TIMELINE indices to sum over. Every chart (units/TSV/area/rate) derives
  // from this SAME bucket list, so they stay perfectly index-aligned no
  // matter which granularity is selected.
  const buckets = useMemo<Bucket[]>(() => {
    if (chartGranularity === "month") {
      return activeIdxs.map(i => {
        const m = TIMELINE[i];
        return { label: m.label, idxs: [i], isFuture: todayIsFuture(m.year, m.month), year: m.year, month: m.month };
      });
    }
    if (chartGranularity === "quarter") {
      // Group by (fyEndYear, fyQuarter) computed from each month's real
      // calendar date — works no matter where the timeline starts/ends,
      // unlike a hardcoded index/3 loop which assumed index 0 = April.
      const groups = new Map<string, { idxs: number[]; fy: number; q: number }>();
      for (let i = rangeStart; i <= rangeEnd; i++) {
        const m = TIMELINE[i];
        const fy = fyEndYear(m.year, m.month);
        const q = fyQuarter(m.month);
        const key = `${fy}-${q}`;
        const g = groups.get(key) ?? { idxs: [], fy, q };
        g.idxs.push(i);
        groups.set(key, g);
      }
      return [...groups.values()]
        .sort((a, b) => a.fy - b.fy || a.q - b.q)
        .filter(g => g.idxs.some(i => activeIdxs.includes(i)))
        .map(g => {
          const last = g.idxs[g.idxs.length - 1];
          const m = TIMELINE[last];
          return { label: `${QUARTER_LABELS[g.q]} FY${String(g.fy).slice(-2)}`, idxs: g.idxs, isFuture: todayIsFuture(m.year, m.month), year: m.year, month: m.month };
        });
    }
    // year — one bucket per fiscal year actually present in the range
    return YEAR_OPTIONS.map(y => {
      const idxs: number[] = [];
      for (let i = y.start; i <= y.end; i++) if (i >= rangeStart && i <= rangeEnd) idxs.push(i);
      if (idxs.length === 0 || !idxs.some(i => activeIdxs.includes(i))) return null;
      const last = idxs[idxs.length - 1];
      const m = TIMELINE[last];
      return { label: y.label, idxs, isFuture: todayIsFuture(m.year, m.month), year: m.year, month: m.month };
    }).filter((b): b is Bucket => b !== null);
  }, [chartGranularity, activeIdxs, rangeStart, rangeEnd]);

  const WINDOW_SIZE = chartGranularity === "month" ? 6 : chartGranularity === "quarter" ? 4 : 4;

  // Default window: rightmost = latest non-future bucket (or the latest
  // bucket at all, if every bucket is entirely in the future).
  const defaultOffset = useMemo(() => {
    if (buckets.length === 0) return 0;
    const now = new Date();
    let pos = -1;
    for (let p = 0; p < buckets.length; p++) {
      const b = buckets[p];
      const notFuture = b.year < now.getFullYear() || (b.year === now.getFullYear() && b.month <= now.getMonth() + 1);
      if (notFuture) pos = p;
    }
    if (pos === -1) pos = buckets.length - 1;
    const maxOffset = Math.max(0, buckets.length - WINDOW_SIZE);
    return Math.max(0, Math.min(maxOffset, pos - (WINDOW_SIZE - 1)));
  }, [buckets, WINDOW_SIZE]);

  // Single shared offset drives all 4 charts — scrolling/dragging/
  // clicking the arrow in any one of them moves all four together.
  const [sharedOffset, setSharedOffset] = useState(0);
  useEffect(() => { setSharedOffset(defaultOffset); }, [defaultOffset]);

  // Build Units/TSV/Area chart data — sums each bucket's underlying months
  function buildSeries(targetArr: number[] | undefined, actualArr: number[] | undefined, scale = 1): TVADataPoint[] {
    return buckets.map(b => {
      const t = b.idxs.reduce((s, i) => s + (targetArr?.[i] ?? 0), 0);
      const a = b.idxs.reduce((s, i) => s + (actualArr?.[i] ?? 0), 0) * scale;
      return {
        month: b.label,
        target: Math.round(t * 100) / 100,
        achieved: Math.round(a * 100) / 100,
        adjusted: null,
        isFuture: b.isFuture,
        year: b.year,
        calMonth: b.month,
      };
    });
  }

  const unitsData = useMemo(() => buildSeries(target?.units, actual?.monthly_units), [target, actual, buckets]);
  const tsvData = useMemo(() => buildSeries(target?.sale_value, actual?.monthly_tsv), [target, actual, buckets]);
  const areaData = useMemo(() => buildSeries(target?.area?.map(v => v / 100000), actual?.monthly_area), [target, actual, buckets]);

  // Avg Rate series — same bucket order, so it's always aligned with the
  // other three charts regardless of granularity
  const rateData = useMemo<RatePoint[]>(() => {
    if (!target) return [];
    return buckets.map(b => {
      const tsvSum = b.idxs.reduce((s, i) => s + (actual?.monthly_tsv[i] ?? 0), 0);
      const areaSum = b.idxs.reduce((s, i) => s + (actual?.monthly_area[i] ?? 0), 0);
      const achievedRate = !b.isFuture && areaSum > 0 ? Math.round((tsvSum * 1e7) / (areaSum * 1e5)) : null;
      const tgtRates = b.idxs.map(i => target.rate[i]).filter(v => v > 0);
      const targetRate = tgtRates.length ? Math.round(tgtRates.reduce((a, v) => a + v, 0) / tgtRates.length) : null;
      return { month: b.label, achievedRate, targetRate, adjustedRate: null, isFuture: b.isFuture, year: b.year, calMonth: b.month };
    });
  }, [target, actual, buckets]);

  const avgAchievedRate = useMemo(() => {
    const rates = rateData.filter(d => d.achievedRate !== null).map(d => d.achievedRate as number);
    return rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
  }, [rateData]);
  const avgTargetRate = useMemo(() => {
    const rates = rateData.filter(d => d.targetRate !== null).map(d => d.targetRate as number);
    return rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
  }, [rateData]);

  const totalTargetTsvInRange = useMemo(() => {
    if (!target) return 0;
    return target.sale_value.slice(rangeStart, rangeEnd + 1).reduce((a, b) => a + b, 0);
  }, [target, rangeStart, rangeEnd]);
  const totalAchievedTsvInRange = useMemo(() => tsvData.reduce((s, d) => s + d.achieved, 0), [tsvData]);
  const totalTargetAreaInRange = useMemo(() => {
    if (!target) return 0;
    return target.area.slice(rangeStart, rangeEnd + 1).reduce((a, b) => a + b, 0) / 100000;
  }, [target, rangeStart, rangeEnd]);
  const totalAchievedAreaInRange = useMemo(() => areaData.reduce((s, d) => s + d.achieved, 0), [areaData]);

  const requiredRate = useMemo(() => {
    const remainingTsv = totalTargetTsvInRange - totalAchievedTsvInRange;
    const remainingArea = totalTargetAreaInRange - totalAchievedAreaInRange;
    if (remainingArea <= 0.001) return null;
    if (remainingTsv <= 0) return null;
    return Math.round((remainingTsv * 1e7) / (remainingArea * 1e5));
  }, [totalTargetTsvInRange, totalAchievedTsvInRange, totalTargetAreaInRange, totalAchievedAreaInRange]);

  function handleRatePointClick(p: RatePoint) {
    setDrillMonth({ month: p.month, target: 0, achieved: 0, adjusted: null, isFuture: p.isFuture, year: p.year, calMonth: p.calMonth });
  }

  const periodLabel = periodType === "all" ? "All time"
    : periodType === "year" ? YEAR_OPTIONS[yearIdx].label
    : periodType === "quarter" ? `${QUARTER_LABELS[quarter - 1]} ${YEAR_OPTIONS[yearIdx].label}`
    : `${TIMELINE[YEAR_OPTIONS[yearIdx].start + month]?.label}`;

  return (
    <div className="sw-inv" style={{ minHeight: "100vh", zoom: 0.9, overflowX: "hidden" } as React.CSSProperties}>
      {/* Filter bar */}
      <div style={{ background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)", padding: "12px 22px 14px", borderBottom: "3px solid var(--gold)", display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 14 }}>
        <ProjectSelect projects={TD.projects.map(p => p.name)} selected={selectedProject} onChange={setSelectedProject} />

        <div>
          <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Period</label>
          <div style={{ display: "flex", gap: 5 }}>
            {(["all", "year", "quarter", "month"] as PeriodType[]).map(t => (
              <button key={t} onClick={() => setPeriodType(t)} style={{ background: periodType === t ? "#B8893C" : "#1D2A4A", color: "#fff", border: `1px solid ${periodType === t ? "#B8893C" : "#33406B"}`, borderRadius: 7, padding: "9px 14px", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer" }}>
                {t === "all" ? "All time" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {periodType !== "all" && (
          <div>
            <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Year</label>
            <select value={yearIdx} onChange={e => setYearIdx(Number(e.target.value))} style={{ background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
              {YEAR_OPTIONS.map((y, i) => <option key={y.label} value={i}>{y.label}</option>)}
            </select>
          </div>
        )}
        {periodType === "quarter" && (
          <div>
            <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Quarter</label>
            <select value={quarter} onChange={e => setQuarter(+e.target.value)} style={{ background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
              {QUARTER_LABELS.map((q, i) => <option key={q} value={i + 1}>{q}</option>)}
            </select>
          </div>
        )}
        {periodType === "month" && (
          <div>
            <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Month</label>
            <select value={month} onChange={e => setMonth(+e.target.value)} style={{ background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
              {(() => {
                const yr = YEAR_OPTIONS[yearIdx];
                const len = yr.end - yr.start + 1;
                return Array.from({ length: len }, (_, i) => TIMELINE[yr.start + i]).map((m, i) => <option key={m.label} value={i}>{m.label}</option>);
              })()}
            </select>
          </div>
        )}

        <div style={{ flex: 1 }} />
        <button onClick={handleReset} style={{ background: "none", border: "none", color: "#c7cedf", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", paddingBottom: 9 }}>Reset</button>
      </div>

      <div className="wrap">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, color: "var(--mut)" }}>
            <strong>{selectedProject}</strong> · {periodLabel}
          </div>

          {/* Chart granularity toggle — shared across all 4 Target vs Achieved charts */}
          <div style={{
            display: "inline-flex", background: "#fff", borderRadius: 999, padding: 4,
            boxShadow: "0 1px 3px rgba(20,33,61,.08), 0 4px 14px rgba(20,33,61,.08)", border: "1px solid #e4e0d6",
          }}>
            {(["month", "quarter", "year"] as const).map(g => (
              <button
                key={g}
                onClick={() => setChartGranularity(g)}
                style={{
                  border: "none",
                  background: chartGranularity === g ? "#0097a7" : "transparent",
                  color: chartGranularity === g ? "#fff" : "#0097a7",
                  fontWeight: 700,
                  fontSize: 13,
                  padding: "8px 20px",
                  borderRadius: 999,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "background 0.15s, color 0.15s",
                  textTransform: "capitalize",
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {!target && !actual && (
          <div className="card"><p style={{ color: "var(--mut)" }}>No target or actual data for this project.</p></div>
        )}

        {/* Cards 1-2: Units, TSV */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <UnitsTargetCard data={unitsData} title="UNITS — TARGET VS ACHIEVED" unit="Units" onBarClick={setDrillMonth}
            offset={sharedOffset} windowSize={WINDOW_SIZE} onOffsetChange={setSharedOffset} />
          <UnitsTargetCard data={tsvData} title="TSV — TARGET VS ACHIEVED (₹ Crs)" unit="Cr" formatVal={n => n.toFixed(1)} onBarClick={setDrillMonth}
            offset={sharedOffset} windowSize={WINDOW_SIZE} onOffsetChange={setSharedOffset} />
        </div>

        {/* Cards 3-4: Area, Avg Rate — same 2-column size as above, same shared offset */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <UnitsTargetCard data={areaData} title="AREA — TARGET VS ACHIEVED (Lakh sqft)" unit="L sqft" formatVal={n => n.toFixed(2)} onBarClick={setDrillMonth}
            offset={sharedOffset} windowSize={WINDOW_SIZE} onOffsetChange={setSharedOffset} />
          <AvgRateCard
            data={rateData}
            avgAchievedRate={avgAchievedRate}
            targetRate={avgTargetRate}
            requiredRate={requiredRate}
            totalTargetTsv={totalTargetTsvInRange}
            onPointClick={handleRatePointClick}
            offset={sharedOffset} windowSize={WINDOW_SIZE} onOffsetChange={setSharedOffset}
          />
        </div>

        {/* Cards 5-6: Tower charts */}
        {actual && (
          <div className="tv-2x2-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginBottom: 18 }}>
            <TowerSoldPctCard towers={actual.towers} projectTsv={actual.tsv} projectSold={actual.sold} onTowerClick={name => setDrillScope({ type: "tower", label: name })} />
            <TowerRateMovementCard towers={actual.towers} onTowerClick={name => setDrillScope({ type: "tower", label: name })} />
          </div>
        )}

        {/* Cards 7-8: Rate trend + Type wise */}
        {actual && (
          <div className="tv-2x2-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginBottom: 18 }}>
            <RateTrendOverTimeCard data={actual.rate_trend} />
            <TypeWiseSaleCard configs={actual.configs} onConfigClick={name => setDrillScope({ type: "config", label: name })} />
          </div>
        )}
      </div>

      {/* Drill-downs */}
      {drillMonth && (
        <MonthDrillDrawer
          year={drillMonth.year}
          month={drillMonth.calMonth}
          monthLabel={drillMonth.month}
          projectFilter={new Set([selectedProject])}
          onClose={() => setDrillMonth(null)}
        />
      )}
      {drillScope && (
        <ScopeDrawer
          projectName={selectedProject}
          scopeType={drillScope.type}
          scopeLabel={drillScope.label}
          onClose={() => setDrillScope(null)}
        />
      )}
    </div>
  );
}
