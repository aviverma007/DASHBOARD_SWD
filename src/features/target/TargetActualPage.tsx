import { useEffect, useMemo, useRef, useState } from "react";
import rawTarget from "../../data/targetData.json";
import rawSales from "../../data/salesPDRN.json";
import { UnitsTargetCard } from "../../components/target/UnitsTargetCard";
import type { TVADataPoint } from "../../components/target/UnitsTargetCard";
import { MonthDrillDrawer } from "../../components/target/MonthDrillDrawer";
import "../../components/inventory/smartworldInventory.css";

interface ProjectTarget { name: string; units: { monthly: number[]; total: number }; sale_value: { monthly: number[]; total: number }; area: { monthly: number[]; total: number }; }
interface TargetData { months: string[]; projects: ProjectTarget[]; }
interface PdrnData { P: string[]; R: number[][]; }

const TD = rawTarget as unknown as TargetData;
const PD = rawSales as unknown as PdrnData;

const MONTHS = TD.months; // Apr-26 .. Mar-27
const YEARS = [2026, 2027];
const QUARTERS = ["Q1 (Apr–Jun)", "Q2 (Jul–Sep)", "Q3 (Oct–Dec)", "Q4 (Jan–Mar)"];
const MONTHS_LIST = ["April","May","June","July","August","September","October","November","December","January","February","March"];

type PeriodType = "all" | "year" | "quarter" | "month";

// Map FY index (0=Apr-26..11=Mar-27) ↔ (year, month)
function fyIdxToYM(i: number): { year: number; month: number } {
  if (i < 9) return { year: 2026, month: i + 4 };
  return { year: 2027, month: i - 8 };
}
function ymToFyIdx(year: number, month: number): number {
  if (year === 2026 && month >= 4) return month - 4;
  if (year === 2027 && month <= 3) return 9 + month - 1;
  return -1;
}

// Quarter → [startFyIdx, endFyIdx] (inclusive)
const QUARTER_RANGES: [number, number][] = [[0,2],[3,5],[6,8],[9,11]];

// Build actual monthly units from PDRN
function buildMonthlyActuals(projectFilter: Set<string>): number[] {
  const actuals = new Array(12).fill(0);
  PD.R.forEach(r => {
    const proj = PD.P[r[0]];
    if (projectFilter.size > 0 && !projectFilter.has(proj)) return;
    const idx = ymToFyIdx(r[7], r[8]);
    if (idx >= 0 && idx < 12) actuals[idx]++;
  });
  return actuals;
}

function buildMonthlyTargets(projectFilter: Set<string>): number[] {
  const targets = new Array(12).fill(0);
  TD.projects.forEach(p => {
    if (projectFilter.size > 0 && !projectFilter.has(p.name)) return;
    p.units.monthly.forEach((v, i) => { targets[i] += v; });
  });
  return targets.map(Math.round);
}

// Determine which FY months are in scope for the period filter
function periodMonthRange(type: PeriodType, year: number, quarter: number, month: number): [number, number] {
  if (type === "all") return [0, 11];
  if (type === "year") return year === 2026 ? [0, 8] : [9, 11];
  if (type === "quarter") {
    const [s, e] = QUARTER_RANGES[quarter - 1];
    return [s, e];
  }
  // month: month is 0-indexed into MONTHS_LIST (Apr=0..Mar=11)
  return [month, month];
}

// ── Project dropdown ──────────────────────────────────────────────────────────
function ProjectDropdown({ projects, selected, onChange }: { projects: string[]; selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  function toggle(name: string) {
    const next = new Set(selected);
    next.has(name) ? next.delete(name) : next.add(name);
    if (next.size === projects.length) onChange(new Set());
    else onChange(next);
  }
  const label = selected.size === 0 ? "All projects" : selected.size === 1 ? [...selected][0].replace("SMARTWORLD ", "") : `${selected.size} projects`;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Project</label>
      <button type="button" onClick={() => setOpen(v => !v)} style={{ minWidth: 180, background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 34px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}>
        {label} <span style={{ color: "#B8893C" }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60, background: "#fff", border: "1px solid var(--line)", borderRadius: 9, boxShadow: "0 12px 34px rgba(20,33,61,.2)", padding: 8, minWidth: 280, maxHeight: 320, overflowY: "auto" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderBottom: "1px solid var(--line)", marginBottom: 5, paddingBottom: 10, fontSize: 13, color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>
            <input type="checkbox" checked={selected.size === 0} onChange={() => onChange(new Set())} style={{ accentColor: "#B8893C" }} /> All projects
          </label>
          {projects.map(name => (
            <label key={name} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderRadius: 6, fontSize: 13, color: "var(--ink)", cursor: "pointer" }}>
              <input type="checkbox" checked={selected.has(name)} onChange={() => toggle(name)} style={{ accentColor: "#B8893C" }} /> {name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function TargetActualPage() {
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [periodType, setPeriodType] = useState<PeriodType>("all");
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [drillPoint, setDrillPoint] = useState<TVADataPoint | null>(null);

  const today = new Date();

  function handleReset() {
    setSelectedProjects(new Set());
    setPeriodType("all");
    setSelectedYear(2026);
    setSelectedQuarter(1);
    setSelectedMonth(0);
  }

  // Build chart data — all 12 FY months, filter applied to amounts
  const chartData = useMemo<TVADataPoint[]>(() => {
    const actuals = buildMonthlyActuals(selectedProjects);
    const targets = buildMonthlyTargets(selectedProjects);
    const [rangeStart, rangeEnd] = periodMonthRange(periodType, selectedYear, selectedQuarter, selectedMonth);

    return MONTHS.map((m, i) => {
      const { year, month } = fyIdxToYM(i);
      const isFuture = year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1);
      const inRange = i >= rangeStart && i <= rangeEnd;
      return {
        month: m.replace("-", "'").replace("26", "'26").replace("27", "'27"),
        target: inRange ? targets[i] : 0,
        achieved: inRange && !isFuture ? actuals[i] : 0,
        adjusted: null,
        isFuture: isFuture || !inRange,
        year,
        calMonth: month,
      };
    }).filter(d => d.target > 0 || d.achieved > 0);
  }, [selectedProjects, periodType, selectedYear, selectedQuarter, selectedMonth, today]);

  const periodLabel = periodType === "all" ? "All time"
    : periodType === "year" ? `FY ${selectedYear}`
    : periodType === "quarter" ? `Q${selectedQuarter} ${selectedYear}`
    : `${MONTHS_LIST[selectedMonth]} ${selectedYear}`;

  return (
    <div className="sw-inv" style={{ minHeight: "100vh" }}>
      {/* Filter bar */}
      <div style={{ background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)", padding: "12px 22px 14px", borderBottom: "3px solid var(--gold)", display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 14 }}>
        <ProjectDropdown projects={TD.projects.map(p => p.name)} selected={selectedProjects} onChange={setSelectedProjects} />

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
            <select value={selectedYear} onChange={e => setSelectedYear(+e.target.value)} style={{ background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        {periodType === "quarter" && (
          <div>
            <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Quarter</label>
            <select value={selectedQuarter} onChange={e => setSelectedQuarter(+e.target.value)} style={{ background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
              {QUARTERS.map((q, i) => <option key={i + 1} value={i + 1}>{q}</option>)}
            </select>
          </div>
        )}
        {periodType === "month" && (
          <div>
            <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Month</label>
            <select value={selectedMonth} onChange={e => setSelectedMonth(+e.target.value)} style={{ background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
              {MONTHS_LIST.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
        )}

        <div style={{ flex: 1 }} />
        <button onClick={handleReset} style={{ background: "none", border: "none", color: "#c7cedf", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", paddingBottom: 9 }}>Reset</button>
      </div>

      {/* Content */}
      <div className="wrap">
        <div style={{ marginBottom: 10, fontSize: 12.5, color: "var(--mut)" }}>
          {selectedProjects.size > 0 && <><strong>{selectedProjects.size}</strong> project{selectedProjects.size > 1 ? "s" : ""} · </>}
          <strong>{periodLabel}</strong>
        </div>

        {/* Units card */}
        <UnitsTargetCard
          data={chartData}
          title="UNITS — TARGET VS ACHIEVED"
          unit="Units"
          onBarClick={setDrillPoint}
        />
      </div>

      {/* Drill-down drawer — Project → Tower → Unit for the clicked month */}
      {drillPoint && (
        <MonthDrillDrawer
          year={drillPoint.year}
          month={drillPoint.calMonth}
          monthLabel={drillPoint.month}
          projectFilter={selectedProjects}
          onClose={() => setDrillPoint(null)}
        />
      )}
    </div>
  );
}
