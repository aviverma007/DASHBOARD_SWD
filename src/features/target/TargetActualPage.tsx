import { useMemo, useState } from "react";
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
const YEAR_OPTIONS = [{ label: "FY 2025-26", start: 0, end: 11 }, { label: "FY 2026-27", start: 12, end: 23 }];
const QUARTER_LABELS = ["Q1", "Q2", "Q3", "Q4"];

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
  const [periodType, setPeriodType] = useState<PeriodType>("all");
  const [yearIdx, setYearIdx] = useState<0 | 1>(1);
  const [quarter, setQuarter] = useState<number>(1);
  const [month, setMonth] = useState<number>(0); // index into the selected year's 12 months

  const [drillMonth, setDrillMonth] = useState<TVADataPoint | null>(null);
  const [drillScope, setDrillScope] = useState<{ type: "tower" | "config"; label: string } | null>(null);

  const target = TD.projects.find(p => p.name === selectedProject);
  const actual = TV.projects.find(p => p.name === selectedProject);

  function handleReset() {
    setPeriodType("all"); setYearIdx(1); setQuarter(1); setMonth(0);
  }

  // Visible month range (indices into the 24-month TIMELINE)
  const [rangeStart, rangeEnd] = useMemo<[number, number]>(() => {
    if (periodType === "all") return [0, 23];
    if (periodType === "year") return [YEAR_OPTIONS[yearIdx].start, YEAR_OPTIONS[yearIdx].end];
    if (periodType === "quarter") {
      const yr = YEAR_OPTIONS[yearIdx];
      const qStart = yr.start + (quarter - 1) * 3;
      return [qStart, qStart + 2];
    }
    // month
    const yr = YEAR_OPTIONS[yearIdx];
    return [yr.start + month, yr.start + month];
  }, [periodType, yearIdx, quarter, month]);

  // Build Units/TSV/Area chart data
  function buildSeries(targetArr: number[] | undefined, actualArr: number[] | undefined, scale = 1): TVADataPoint[] {
    return TIMELINE.map((m, i) => {
      const inRange = i >= rangeStart && i <= rangeEnd;
      const isFuture = todayIsFuture(m.year, m.month);
      const t = targetArr?.[i] ?? 0;
      const a = (actualArr?.[i] ?? 0) * scale;
      return {
        month: m.label,
        target: inRange ? Math.round(t * 100) / 100 : 0,
        achieved: inRange ? Math.round(a * 100) / 100 : 0,
        adjusted: null,
        isFuture: isFuture || !inRange,
        year: m.year,
        calMonth: m.month,
      };
    }).filter(d => d.target > 0 || d.achieved > 0);
  }

  const unitsData = useMemo(() => buildSeries(target?.units, actual?.monthly_units), [target, actual, rangeStart, rangeEnd]);
  const tsvData = useMemo(() => buildSeries(target?.sale_value, actual?.monthly_tsv), [target, actual, rangeStart, rangeEnd]);
  const areaData = useMemo(() => buildSeries(target?.area?.map(v => v / 100000), actual?.monthly_area), [target, actual, rangeStart, rangeEnd]);

  // Avg Rate series
  const rateData = useMemo<RatePoint[]>(() => {
    if (!target) return [];
    const points: (RatePoint | null)[] = TIMELINE.map((m, i) => {
      const inRange = i >= rangeStart && i <= rangeEnd;
      if (!inRange) return null;
      const isFuture = todayIsFuture(m.year, m.month);
      const tgtRate = target.rate[i] || null;
      const monthlyTsv = actual?.monthly_tsv[i] ?? 0;
      const monthlyArea = actual?.monthly_area[i] ?? 0;
      const achievedRate = !isFuture && monthlyArea > 0 ? Math.round((monthlyTsv * 1e7) / (monthlyArea * 1e5)) : null;
      const point: RatePoint = { month: m.label, achievedRate, targetRate: tgtRate, adjustedRate: null, isFuture, year: m.year, calMonth: m.month };
      return point;
    });
    return points.filter((d): d is RatePoint => d !== null && (d.achievedRate !== null || d.targetRate !== null));
  }, [target, actual, rangeStart, rangeEnd]);

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
    <div className="sw-inv" style={{ minHeight: "100vh", zoom: 0.9 } as React.CSSProperties}>
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
            <select value={yearIdx} onChange={e => setYearIdx(Number(e.target.value) as 0 | 1)} style={{ background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
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
              {Array.from({ length: 12 }, (_, i) => TIMELINE[YEAR_OPTIONS[yearIdx].start + i]).map((m, i) => <option key={m.label} value={i}>{m.label}</option>)}
            </select>
          </div>
        )}

        <div style={{ flex: 1 }} />
        <button onClick={handleReset} style={{ background: "none", border: "none", color: "#c7cedf", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", paddingBottom: 9 }}>Reset</button>
      </div>

      <div className="wrap">
        <div style={{ marginBottom: 12, fontSize: 12.5, color: "var(--mut)" }}>
          <strong>{selectedProject}</strong> · {periodLabel}
        </div>

        {!target && !actual && (
          <div className="card"><p style={{ color: "var(--mut)" }}>No target or actual data for this project.</p></div>
        )}

        {/* Cards 1-3: Units, TSV, Area */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <UnitsTargetCard data={unitsData} title="UNITS — TARGET VS ACHIEVED" unit="Units" onBarClick={setDrillMonth} />
          <UnitsTargetCard data={tsvData} title="TSV — TARGET VS ACHIEVED (₹ Crs)" unit="Cr" formatVal={n => n.toFixed(1)} onBarClick={setDrillMonth} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <UnitsTargetCard data={areaData} title="AREA — TARGET VS ACHIEVED (Lakh sqft)" unit="L sqft" formatVal={n => n.toFixed(2)} onBarClick={setDrillMonth} />
        </div>

        {/* Card 4: Avg Rate */}
        <div style={{ marginBottom: 14 }}>
          <AvgRateCard
            data={rateData}
            avgAchievedRate={avgAchievedRate}
            targetRate={avgTargetRate}
            requiredRate={requiredRate}
            totalTargetTsv={totalTargetTsvInRange}
            onPointClick={handleRatePointClick}
          />
        </div>

        {/* Cards 5-6: Tower charts */}
        {actual && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <TowerSoldPctCard towers={actual.towers} projectTsv={actual.tsv} onTowerClick={name => setDrillScope({ type: "tower", label: name })} />
            <TowerRateMovementCard towers={actual.towers} onTowerClick={name => setDrillScope({ type: "tower", label: name })} />
          </div>
        )}

        {/* Cards 7-8: Rate trend + Type wise */}
        {actual && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
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
