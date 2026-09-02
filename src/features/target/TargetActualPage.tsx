import { useEffect, useMemo, useRef, useState } from "react";
import { Zoomable } from "../../components/common/Zoomable";
import { LOCATIONS, projectLocation } from "../../utils/pdrnLogic";
import { DATA_AS_ON } from "../../config/dataInfo";
import { motion } from "framer-motion";
import { AnimatedNumber } from "../../components/common/AnimatedNumber";
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

type PeriodType = "all" | "year" | "quarter" | "month" | "custom";
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

// ── AOP / current-month summary card ─────────────────────────────────────────
interface SummaryPair { t: number; a: number }
interface SummaryCardRows { units: SummaryPair; area: SummaryPair; tsv: SummaryPair }

function TvaSummaryCard({ title, rows }: { title: string; rows: SummaryCardRows | null }) {
  const fmt = {
    units: (n: number) => Math.round(n).toLocaleString("en-IN"),
    area:  (n: number) => n.toFixed(2) + " L sq ft",
    tsv:   (n: number) => "₹" + (n >= 100 ? Math.round(n).toLocaleString("en-IN") : n.toFixed(1)) + " Cr",
  };
  const pct = (p: SummaryPair) => (p.t > 0 ? Math.round((p.a / p.t) * 100) : null);

  const TH: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)", textAlign: "right", padding: "8px 10px" };
  const TD: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 19, color: "var(--ink)", textAlign: "right", padding: "12px 10px", whiteSpace: "nowrap" };

  return (
    <div
      className="card"
      style={{
        padding: "18px 20px 12px",
        borderLeft: "4px solid var(--gold)",
        boxShadow: "0 2px 4px rgba(20,33,61,.06), 0 8px 28px rgba(20,33,61,.10)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 700, color: "var(--ink)", letterSpacing: "0.2px" }}>{title}</div>
      </div>
      {rows === null ? (
        <p style={{ color: "var(--mut)", fontSize: 13.5, margin: 0, paddingBottom: 8 }}>Outside the plan timeline.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--line)" }}>
              <th style={{ ...TH, textAlign: "left", paddingLeft: 0 }}></th>
              <th style={TH}>Total</th>
              <th style={TH}>Achieved</th>
              <th style={{ ...TH, paddingRight: 0 }}>%age</th>
            </tr>
          </thead>
          <tbody>
            {([
              ["UNITS", rows.units, fmt.units],
              ["AREA",  rows.area,  fmt.area],
              ["TSV",   rows.tsv,   fmt.tsv],
            ] as const).map(([lbl, pair, f], i) => {
              const p = pct(pair);
              const good = p !== null && p >= 100;
              return (
                <tr key={lbl} style={{ borderBottom: i < 2 ? "1px solid var(--line)" : "none" }}>
                  <td style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1.2px", color: "var(--ink-soft)", padding: "12px 10px 12px 0" }}>{lbl}</td>
                  <td style={{ ...TD, color: "var(--ink)" }}><AnimatedNumber value={pair.t} format={f} /></td>
                  <td style={{ ...TD, fontWeight: 700, color: "#1a7a4a" }}><AnimatedNumber value={pair.a} format={f} /></td>
                  <td style={{ ...TD, paddingRight: 0 }}>
                    <span
                      style={{
                        display: "inline-block",
                        minWidth: 52,
                        textAlign: "center",
                        fontFamily: "Georgia,serif",
                        fontSize: 15.5,
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: 999,
                        color: p === null ? "var(--mut)" : good ? "#1a7a4a" : "#c97a1a",
                        background: p === null ? "transparent" : good ? "rgba(26,122,74,.10)" : "rgba(201,122,26,.12)",
                        border: p === null ? "1px solid var(--line)" : `1px solid ${good ? "rgba(26,122,74,.25)" : "rgba(201,122,26,.3)"}`,
                      }}
                    >
                      {p === null ? "—" : p + "%"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Filter controls ───────────────────────────────────────────────────────────
const FILTER_LBL: React.CSSProperties = { display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 };
const FILTER_PILL: React.CSSProperties = { background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" };

function LocationSelect({ locations, value, onChange }: { locations: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={FILTER_LBL}>Location</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...FILTER_PILL, minWidth: 140, padding: "9px 28px 9px 13px" }}>
        <option value="">All locations</option>
        {locations.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
    </div>
  );
}

/** Multi-select project dropdown with an "All projects" master option —
 * same interaction pattern as the Overview page's project filter. */
function ProjectMultiSelect({ projects, selected, onChange }: { projects: string[]; selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name); else next.add(name);
    // selecting every project = same as All → collapse to empty
    if (next.size === projects.length) onChange(new Set());
    else onChange(next);
  }

  const label = selected.size === 0 ? "All projects"
    : selected.size === 1 ? [...selected][0].replace("SMARTWORLD ", "")
    : `${selected.size} projects`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={FILTER_LBL}>Project</label>
      <button type="button" onClick={() => setOpen(v => !v)} style={{ ...FILTER_PILL, minWidth: 200, textAlign: "left" }}>
        {label} <span style={{ color: "#B8893C", marginLeft: 6 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60, background: "#fff", border: "1px solid var(--line)", borderRadius: 9, boxShadow: "0 12px 34px rgba(20,33,61,.2)", padding: 8, minWidth: 280, maxHeight: 320, overflowY: "auto" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderBottom: "1px solid var(--line)", marginBottom: 5, paddingBottom: 10, fontSize: 13, color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>
            <input type="checkbox" checked={selected.size === 0} onChange={() => onChange(new Set())} style={{ accentColor: "#B8893C", width: 15, height: 15 }} />
            All projects
          </label>
          {projects.map(name => (
            <label key={name} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderRadius: 6, fontSize: 13, color: "var(--ink)", cursor: "pointer" }}>
              <input type="checkbox" checked={selected.has(name)} onChange={() => toggle(name)} style={{ accentColor: "#B8893C", width: 15, height: 15 }} />
              {name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
/** Readable short names for project-wise chart rows. */
const PROJECT_SHORT: Record<string, string> = {
  "SMARTWORLD THE EDITION":   "EDITION",
  "SMARTWORLD LE COURTYARD":  "LE COURTYARD",
  "SMARTWORLD RESIDENCIES":   "RESIDENCIES",
  "SMARTWORLD SKY ARC":       "SKY ARC",
  "SMARTWORLD SUITES":        "SUITES",
  "TRUMP RESIDENCES GURGAON": "TRUMP",
};

export function TargetActualPage() {
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set()); // empty = All
  const [location, setLocation] = useState<string>("");                             // "" = all
  const [chartGranularity, setChartGranularity] = useState<"month" | "quarter" | "year">("month");
  const [chartStyle, setChartStyle] = useState<"bar" | "line">("bar");
  const [periodType, setPeriodType] = useState<PeriodType>("all");
  const [yearIdx, setYearIdx] = useState<number>(YEAR_OPTIONS.length - 1);
  const [quarter, setQuarter] = useState<number>(1);
  const [month, setMonth] = useState<number>(0); // index into the selected year's 12 months
  // Custom range — TIMELINE indices, inclusive
  const [customFrom, setCustomFrom] = useState<number>(0);
  const [customTo, setCustomTo] = useState<number>(TIMELINE.length - 1);

  const [drillMonth, setDrillMonth] = useState<TVADataPoint | null>(null);
  const [drillScope, setDrillScope] = useState<{ type: "tower" | "config" | "project"; label: string; projects: string[] } | null>(null);

  // ── Active project scope (location + multi-select) ─────────────────────
  const availableNames = useMemo(
    () => TD.projects.map(p => p.name).filter(n => !location || projectLocation(n) === location),
    [location]
  );
  const activeNames = useMemo(
    () => (selectedProjects.size ? availableNames.filter(n => selectedProjects.has(n)) : availableNames),
    [availableNames, selectedProjects]
  );
  const selectionLabel = activeNames.length === availableNames.length && !location
    ? "All projects"
    : activeNames.length === 1
    ? activeNames[0]
    : `${activeNames.length} projects${location ? ` · ${location}` : ""}`;

  /** Aggregated plan across the active projects (pass-through for one). */
  const target = useMemo<ProjectTarget | undefined>(() => {
    const sel = TD.projects.filter(p => activeNames.includes(p.name));
    if (sel.length === 0) return undefined;
    if (sel.length === 1) return sel[0];
    const len = TIMELINE.length;
    const sum = (get: (p: ProjectTarget) => number[]) =>
      Array.from({ length: len }, (_, i) => sel.reduce((s, p) => s + (get(p)[i] ?? 0), 0));
    const units = sum(p => p.units), area = sum(p => p.area), sale_value = sum(p => p.sale_value);
    // Merged target rate must be value-weighted, not averaged: ₹Cr→₹ via
    // 1e7 over raw sq ft. Averaging the per-project rate arrays would let
    // a tiny project's rate count as much as a huge one's.
    const rate = Array.from({ length: len }, (_, i) => (area[i] > 0 ? Math.round((sale_value[i] * 1e7) / area[i]) : 0));
    return { name: selectionLabel, units, area, rate, sale_value };
  }, [activeNames, selectionLabel]);

  /** Aggregated actuals; tower names get project-code prefixes when
   * merged, with a lookup back to (project, real tower) for drilling. */
  const { actual, towerScopeMap } = useMemo(() => {
    const sel = TV.projects.filter(p => activeNames.includes(p.name));
    const map = new Map<string, { project: string; realLabel: string | null }>();
    if (sel.length === 0) return { actual: undefined as ProjectAnalytics | undefined, towerScopeMap: map };
    if (sel.length === 1) {
      sel[0].towers.forEach(t => map.set(t.name, { project: sel[0].name, realLabel: t.name }));
      return { actual: sel[0], towerScopeMap: map };
    }
    const len = TIMELINE.length;
    const sumArr = (get: (p: ProjectAnalytics) => number[]) =>
      Array.from({ length: len }, (_, i) => sel.reduce((s, p) => s + (get(p)[i] ?? 0), 0));
    const sold = sel.reduce((s, p) => s + p.sold, 0);
    const tsv = sel.reduce((s, p) => s + p.tsv, 0);
    const area = sel.reduce((s, p) => s + p.area, 0);
    // Multi-project view rolls the two "tower wise" charts up to one row
    // PER PROJECT — a merged list of every tower (ED · T-1 … LC · GF-G)
    // was unreadable. Year rates are weighted by each tower's sold units.
    const towers: TowerRow[] = sel.map(p => {
      const display = PROJECT_SHORT[p.name] ?? p.name;
      map.set(display, { project: p.name, realLabel: null });
      const years = new Set<string>();
      p.towers.forEach(t => Object.keys(t.year_rates).forEach(y => years.add(y)));
      const year_rates: Record<string, number> = {};
      years.forEach(y => {
        const having = p.towers.filter(t => t.year_rates[y]);
        if (!having.length) return;
        const w = having.reduce((s, t) => s + t.sold, 0);
        year_rates[y] = w > 0
          ? Math.round(having.reduce((s, t) => s + t.year_rates[y] * t.sold, 0) / w)
          : Math.round(having.reduce((s, t) => s + t.year_rates[y], 0) / having.length);
      });
      return {
        name: display,
        sold: p.sold,
        unsold: p.towers.reduce((s, t) => s + t.unsold, 0),
        total: p.towers.reduce((s, t) => s + t.total, 0),
        sold_pct: 0, // recomputed by the card from share-of-total anyway
        tsv: p.tsv,
        avg_rate: p.avg_rate,
        year_rates,
      };
    });
    const cfgByName = new Map<string, CfgRow>();
    sel.forEach(p => p.configs.forEach(c => {
      const prev = cfgByName.get(c.name);
      if (!prev) { cfgByName.set(c.name, { ...c }); return; }
      const soldSum = prev.sold + c.sold, totalSum = prev.total + c.total;
      cfgByName.set(c.name, {
        name: c.name,
        sold: soldSum,
        unsold: prev.unsold + c.unsold,
        total: totalSum,
        sold_pct: totalSum ? Math.round((soldSum / totalSum) * 100) : 0,
        // Weight by sold units (the metric shown is sold-avg area);
        // fall back to a plain average when neither side has sales.
        avg_area: soldSum > 0
          ? Math.round((prev.avg_area * prev.sold + c.avg_area * c.sold) / soldSum)
          : Math.round((prev.avg_area + c.avg_area) / 2),
      });
    }));
    const trendByKey = new Map<string, { rateWeighted: number; units: number }>();
    sel.forEach(p => p.rate_trend.forEach(t => {
      const prev = trendByKey.get(t.key) ?? { rateWeighted: 0, units: 0 };
      trendByKey.set(t.key, { rateWeighted: prev.rateWeighted + t.rate * t.units, units: prev.units + t.units });
    }));
    const rate_trend: RateTrendPt[] = [...trendByKey.entries()]
      .map(([key, v]) => ({ key, rate: v.units ? Math.round(v.rateWeighted / v.units) : 0, units: v.units }))
      .sort((a, b) => a.key.localeCompare(b.key));
    const merged: ProjectAnalytics = {
      name: selectionLabel,
      sold, tsv, area,
      avg_rate: area > 0 ? Math.round((tsv / area) * 100) : 0, // ₹Cr / L sqft → ₹/sqft
      monthly_units: sumArr(p => p.monthly_units),
      monthly_tsv: sumArr(p => p.monthly_tsv),
      monthly_area: sumArr(p => p.monthly_area),
      towers, configs: [...cfgByName.values()], rate_trend,
    };
    return { actual: merged, towerScopeMap: map };
  }, [activeNames, selectionLabel]);

  function handleLocationChange(loc: string) {
    setLocation(loc);
    setSelectedProjects(new Set());
    setDrillMonth(null); setDrillScope(null);
  }

  function handleTowerDrill(displayName: string) {
    const hit = towerScopeMap.get(displayName);
    if (!hit) return;
    if (hit.realLabel === null) setDrillScope({ type: "project", label: displayName, projects: [hit.project] });
    else setDrillScope({ type: "tower", label: hit.realLabel, projects: [hit.project] });
  }

  function handleReset() {
    setPeriodType("all"); setYearIdx(1); setQuarter(1); setMonth(0); setChartGranularity("month");
    setCustomFrom(0); setCustomTo(TIMELINE.length - 1);
    setSelectedProjects(new Set()); setLocation("");
  }

  // Visible month range (indices into the 24-month TIMELINE)
  const [rangeStart, rangeEnd] = useMemo<[number, number]>(() => {
    if (periodType === "all") return [0, TIMELINE.length - 1];
    if (periodType === "custom") {
      // Order-proof: picking From after To (or vice versa) still yields
      // a valid ascending range rather than an empty chart.
      return [Math.min(customFrom, customTo), Math.max(customFrom, customTo)];
    }
    if (periodType === "year") return [YEAR_OPTIONS[yearIdx].start, YEAR_OPTIONS[yearIdx].end];
    if (periodType === "quarter") {
      const yr = YEAR_OPTIONS[yearIdx];
      const qStart = yr.start + (quarter - 1) * 3;
      return [Math.min(qStart, yr.end), Math.min(qStart + 2, yr.end)];
    }
    // month
    const yr = YEAR_OPTIONS[yearIdx];
    return [yr.start + month, yr.start + month];
  }, [periodType, yearIdx, quarter, month, customFrom, customTo]);

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

  interface Bucket { label: string; idxs: number[]; isFuture: boolean; isCurrent: boolean; year: number; month: number; }

  // Index of "today" in TIMELINE, if it falls within the timeline at all —
  // used to mark whichever bucket contains the current month, so the
  // Adjusted line has an anchor point even when only one future bucket
  // exists (Quarter/Year granularity).
  const todayIdx = useMemo(() => {
    const now = new Date();
    return TIMELINE.findIndex(m => m.year === now.getFullYear() && m.month === now.getMonth() + 1);
  }, []);

  // ── AOP summary cards (top of page) ────────────────────────────────────
  // Fixed-scope summaries, deliberately independent of the Period filter:
  // the AOP card always shows the current fiscal year's plan-vs-achieved,
  // and the month card always shows the running calendar month.
  const aopFy = useMemo(() => {
    const now = new Date();
    const fy = fyEndYear(now.getFullYear(), now.getMonth() + 1);
    const label = `FY ${fy - 1}-${String(fy).slice(-2)}`;
    return YEAR_OPTIONS.find(y => y.label === label) ?? YEAR_OPTIONS[YEAR_OPTIONS.length - 1];
  }, []);

  const summaryRows = useMemo(() => {
    const sum = (arr: number[] | undefined, s: number, e: number) => {
      let t = 0;
      for (let i = s; i <= e; i++) t += arr?.[i] ?? 0;
      return t;
    };
    const build = (s: number, e: number) => ({
      units: { t: sum(target?.units, s, e),      a: sum(actual?.monthly_units, s, e) },
      // Target area is stored in raw sq ft; actuals in lakh sq ft. Same
      // /1e5 normalisation the Area chart applies (areaScaledTarget).
      area:  { t: sum(target?.area, s, e) / 100000, a: sum(actual?.monthly_area, s, e) },
      tsv:   { t: sum(target?.sale_value, s, e), a: sum(actual?.monthly_tsv, s, e) },
    });
    return {
      aop: build(aopFy.start, aopFy.end),
      month: todayIdx >= 0 ? build(todayIdx, todayIdx) : null,
    };
  }, [target, actual, aopFy, todayIdx]);

  // A bucket is "current" if today falls anywhere inside its date range,
  // "future" only if EVERY month in it is after today, "past" otherwise.
  // (Checking only the bucket's last month — as a quarter/year bucket-in-
  // progress's end date — wrongly classified the whole current FY/quarter
  // as "future" just because it hasn't finished yet, which collapsed
  // "current" and "future" into the same bucket and left no second point
  // for the Adjusted line to connect to.)
  function bucketFlags(idxs: number[]): { isCurrent: boolean; isFuture: boolean } {
    if (todayIdx < 0) {
      // "today" isn't on the timeline at all — fall back to date comparison
      const last = TIMELINE[idxs[idxs.length - 1]];
      return { isCurrent: false, isFuture: todayIsFuture(last.year, last.month) };
    }
    return { isCurrent: idxs.includes(todayIdx), isFuture: idxs.every(i => i > todayIdx) };
  }

  // Buckets: one per visible month/quarter/year, each carrying the list of
  // TIMELINE indices to sum over. Every chart (units/TSV/area/rate) derives
  // from this SAME bucket list, so they stay perfectly index-aligned no
  // matter which granularity is selected.
  const buckets = useMemo<Bucket[]>(() => {
    if (chartGranularity === "month") {
      return activeIdxs.map(i => {
        const m = TIMELINE[i];
        const { isCurrent, isFuture } = bucketFlags([i]);
        return { label: m.label, idxs: [i], isFuture, isCurrent, year: m.year, month: m.month };
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
          const { isCurrent, isFuture } = bucketFlags(g.idxs);
          return { label: `${QUARTER_LABELS[g.q]} FY${String(g.fy).slice(-2)}`, idxs: g.idxs, isFuture, isCurrent, year: m.year, month: m.month };
        });
    }
    // year — one bucket per fiscal year actually present in the range
    return YEAR_OPTIONS.map(y => {
      const idxs: number[] = [];
      for (let i = y.start; i <= y.end; i++) if (i >= rangeStart && i <= rangeEnd) idxs.push(i);
      if (idxs.length === 0 || !idxs.some(i => activeIdxs.includes(i))) return null;
      const last = idxs[idxs.length - 1];
      const m = TIMELINE[last];
      const { isCurrent, isFuture } = bucketFlags(idxs);
      return { label: y.label, idxs, isFuture, isCurrent, year: m.year, month: m.month };
    }).filter((b): b is Bucket => b !== null);
  }, [chartGranularity, activeIdxs, rangeStart, rangeEnd, todayIdx]);

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
  function buildSeries(targetArr: number[] | undefined, actualArr: number[] | undefined, scale = 1): Omit<TVADataPoint, "adjusted" | "catchUp" | "showBadge">[] {
    return buckets.map(b => {
      const t = b.idxs.reduce((s, i) => s + (targetArr?.[i] ?? 0), 0);
      const a = b.idxs.reduce((s, i) => s + (actualArr?.[i] ?? 0), 0) * scale;
      return {
        month: b.label,
        target: Math.round(t * 100) / 100,
        achieved: Math.round(a * 100) / 100,
        isFuture: b.isFuture,
        isCurrent: b.isCurrent,
        year: b.year,
        calMonth: b.month,
      };
    });
  }

  // Distribute `amount` across `count` slots. Integer series (round=1) get
  // an integer split with the remainder going to the FIRST slot(s) — e.g.
  // 5 over 3 becomes [2,2,1] (not [1,2,2]). Fractional series (round=10/100
  // for TSV ₹Cr / Area L sqft) get a plain even split.
  function distributeEvenly(amount: number, count: number, round: number): number[] {
    if (count <= 0) return [];
    if (round === 1) {
      const base = Math.floor(amount / count);
      const remainder = Math.round(amount - base * count);
      return Array.from({ length: count }, (_, j) => base + (j < remainder ? 1 : 0));
    }
    const share = Math.round((amount / count) * round) / round;
    return Array.from({ length: count }, () => share);
  }

  // ── Quarter rollover: previous quarter's shortfall folds into current
  // quarter, THEN cascades forward within the current quarter itself ──
  // Used only for Month granularity.
  //
  // Step A: find the fiscal quarter containing "today" and the one right
  // before it (using the FULL raw arrays, not the filtered/bucketed
  // `points`, so this is correct no matter what the Period filter is
  // scoped to). If the previous quarter fell short, spread that shortfall
  // evenly across ALL of the current quarter's months — remainder to the
  // first month(s), e.g. a shortfall of 5 over 3 months becomes +2,+2,+1
  // on top of each month's own original target.
  //
  // Step B: walk the current quarter's months in order. Once a month has
  // actually finished (its TIMELINE index is before today's), compare
  // what it achieved against its OWN adjusted target from Step A. Any
  // shortfall there rolls forward too — spread across the REMAINING
  // months of the same quarter, ADDED on top of whatever they already
  // picked up. E.g. previous-quarter rollover gives a quarter [13,14,14];
  // if the first of those months only achieves 7 against its target of
  // 13, the resulting shortfall of 6 splits across the remaining two
  // months as +3/+3, landing at [—, 17, 17].
  function computeQuarterRollover(targetArr: number[] | undefined, actualArr: number[] | undefined, scale: number, round: number) {
    const empty = { curIdxs: [] as number[], adjustedByIdx: new Map<number, number>() };
    if (todayIdx < 0 || !targetArr) return empty;

    const t = TIMELINE[todayIdx];
    const curFy = fyEndYear(t.year, t.month), curQ = fyQuarter(t.month);
    let prevFy = curFy, prevQ = curQ - 1;
    if (prevQ < 0) { prevQ = 3; prevFy = curFy - 1; }

    const curIdxs: number[] = [];
    const prevIdxs: number[] = [];
    TIMELINE.forEach((m, i) => {
      const fy = fyEndYear(m.year, m.month), q = fyQuarter(m.month);
      if (fy === curFy && q === curQ) curIdxs.push(i);
      else if (fy === prevFy && q === prevQ) prevIdxs.push(i);
    });
    if (curIdxs.length === 0) return empty;

    // Start from each month's own original target
    const adjustedByIdx = new Map<number, number>();
    curIdxs.forEach(idx => adjustedByIdx.set(idx, targetArr[idx] ?? 0));

    // Step A — previous quarter's shortfall, spread flat across all months
    if (prevIdxs.length > 0) {
      const prevTarget = prevIdxs.reduce((s, i) => s + (targetArr[i] ?? 0), 0);
      const prevAchieved = prevIdxs.reduce((s, i) => s + (actualArr?.[i] ?? 0), 0) * scale;
      const prevShortfall = Math.max(0, Math.round((prevTarget - prevAchieved) * round) / round);
      if (prevShortfall > 0) {
        const shares = distributeEvenly(prevShortfall, curIdxs.length, round);
        curIdxs.forEach((idx, j) => adjustedByIdx.set(idx, Math.round((adjustedByIdx.get(idx)! + shares[j]) * round) / round));
      }
    }

    // Step B — cascade forward any shortfall from already-elapsed months
    // within this same quarter, on top of what Step A already gave them
    for (let j = 0; j < curIdxs.length; j++) {
      const idx = curIdxs[j];
      if (idx >= todayIdx) break; // stop at the first not-yet-finished month
      const achieved = (actualArr?.[idx] ?? 0) * scale;
      const adjustedSoFar = adjustedByIdx.get(idx)!;
      const shortfall = Math.max(0, Math.round((adjustedSoFar - achieved) * round) / round);
      const remaining = curIdxs.slice(j + 1);
      if (shortfall > 0 && remaining.length > 0) {
        const shares = distributeEvenly(shortfall, remaining.length, round);
        remaining.forEach((rIdx, k) => adjustedByIdx.set(rIdx, Math.round((adjustedByIdx.get(rIdx)! + shares[k]) * round) / round));
      }
    }

    return { curIdxs, adjustedByIdx };
  }

  // Balance target = totalTarget (whole PLAN window) - totalAchieved (past+
  // current, within that same plan window). Scoped to start at the first
  // bucket where a target actually exists — otherwise, in "All time" view,
  // achieved history that predates the target plan entirely (e.g. Edition's
  // real sales from Nov'23, long before any target was set) would get
  // counted into "achieved", producing a nonsensical negative balance.
  // Adjusted target = that balance spread evenly across the remaining
  // future periods, so each future bar/point shows what pace is actually
  // needed — not just the original monthly plan. Catch-up badge = how much
  // MORE than the original target that adjusted pace requires, shown only
  // on the first future period (not every one, to avoid repeating the same
  // signal). Used for Quarter and Year granularity, where "roll forward
  // one quarter" doesn't map cleanly onto a single bucket.
  //
  // IMPORTANT: adjusted is set on the CURRENT period (as an anchor) AND
  // every future period — not just the first future one. Recharts needs
  // 2+ non-null points to draw a line segment at all; with only the first
  // future point set, Quarter/Year views (which often have just one future
  // bucket in range) rendered a lone dot with no visible line. Anchoring
  // on the current period guarantees a second point whenever at least one
  // future period exists.
  function enrichWithAdjustedPlanWide(points: Omit<TVADataPoint, "adjusted" | "catchUp" | "showBadge">[], round = 100): TVADataPoint[] {
    const planStart = points.findIndex(d => d.target > 0);
    const planPoints = planStart >= 0 ? points.slice(planStart) : points;
    const totalTarget = planPoints.reduce((s, d) => s + d.target, 0);
    const totalAchieved = planPoints.filter(d => !d.isFuture).reduce((s, d) => s + d.achieved, 0);
    const balance = totalTarget - totalAchieved;
    const futureCount = planPoints.filter(d => d.isFuture).length;
    const adjPerPeriod = futureCount > 0 ? balance / futureCount : null;

    return points.map(d => {
      const isAnchorOrFuture = d.isCurrent || d.isFuture;
      if (!isAnchorOrFuture || adjPerPeriod === null || !isFinite(adjPerPeriod)) {
        return { ...d, adjusted: null, catchUp: null, showBadge: false };
      }
      const adjusted = Math.round(adjPerPeriod * round) / round;
      const catchUp = adjusted > d.target ? Math.round((adjusted - d.target) * round) / round : null;
      // Show on every current/future period that needed an upward
      // adjustment — not just the first — so each one flags its own
      // required pace.
      return { ...d, adjusted, catchUp, showBadge: catchUp != null && catchUp > 0 };
    });
  }

  // Month granularity: roll only the immediately preceding quarter's
  // shortfall into the current quarter, per-month. The line and badge
  // only span the current quarter's own months (not the whole rest of
  // the plan) — a deliberately narrower, more actionable "catch up this
  // quarter" signal rather than "here's the pace for the entire year".
  function enrichWithAdjustedQuarterRollover(
    points: Omit<TVADataPoint, "adjusted" | "catchUp" | "showBadge">[],
    targetArr: number[] | undefined,
    actualArr: number[] | undefined,
    scale: number,
    round: number
  ): TVADataPoint[] {
    const { curIdxs, adjustedByIdx } = computeQuarterRollover(targetArr, actualArr, scale, round);
    if (curIdxs.length === 0) return points.map(d => ({ ...d, adjusted: null, catchUp: null, showBadge: false }));

    const curIdxSet = new Set(curIdxs);
    // Map each TIMELINE index to its point's position in the displayed
    // `points` array, using calMonth/year (buildSeries carries these
    // straight through 1:1 for month granularity).
    const timelineIdxOf = (d: { year: number; calMonth: number }) =>
      TIMELINE.findIndex(m => m.year === d.year && m.month === d.calMonth);

    return points.map(d => {
      const tIdx = timelineIdxOf(d);
      const isAnchorOrFuture = d.isCurrent || d.isFuture;
      if (!isAnchorOrFuture || !curIdxSet.has(tIdx)) {
        return { ...d, adjusted: null, catchUp: null, showBadge: false };
      }
      const adjusted = adjustedByIdx.get(tIdx) ?? d.target;
      const catchUp = adjusted > d.target ? Math.round((adjusted - d.target) * round) / round : null;
      // Show on every current/future month in this quarter that needed an
      // upward adjustment — not just the first one — so August AND
      // September both flag their own required pace.
      const showBadge = catchUp != null && catchUp > 0;
      return { ...d, adjusted, catchUp, showBadge };
    });
  }

  function enrichWithAdjusted(
    points: Omit<TVADataPoint, "adjusted" | "catchUp" | "showBadge">[],
    targetArr: number[] | undefined,
    actualArr: number[] | undefined,
    scale = 1,
    round = 100
  ): TVADataPoint[] {
    return chartGranularity === "month"
      ? enrichWithAdjustedQuarterRollover(points, targetArr, actualArr, scale, round)
      : enrichWithAdjustedPlanWide(points, round);
  }

  const unitsData = useMemo(
    () => enrichWithAdjusted(buildSeries(target?.units, actual?.monthly_units), target?.units, actual?.monthly_units, 1, 1),
    [target, actual, buckets, chartGranularity]
  );
  const tsvData = useMemo(
    () => enrichWithAdjusted(buildSeries(target?.sale_value, actual?.monthly_tsv), target?.sale_value, actual?.monthly_tsv, 1, 10),
    [target, actual, buckets, chartGranularity]
  );
  const areaScaledTarget = useMemo(() => target?.area?.map(v => v / 100000), [target]);
  const areaData = useMemo(
    () => enrichWithAdjusted(buildSeries(areaScaledTarget, actual?.monthly_area), areaScaledTarget, actual?.monthly_area, 1, 100),
    [areaScaledTarget, actual, buckets, chartGranularity]
  );

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
      return { month: b.label, achievedRate, targetRate, adjustedRate: null, isFuture: b.isFuture, isCurrent: b.isCurrent, year: b.year, calMonth: b.month };
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

  // Scope the risk-panel calc to months where a TARGET actually exists,
  // not the full extended achieved history. After extending the shared
  // timeline back to Nov'23 for chart display, "All time" now spans many
  // pre-target months with real achieved sales but no target at all — if
  // those get summed into "achieved", it looks like every project has
  // already exceeded its target (false "on track"), when really those
  // sales simply predate the target plan and aren't part of it.
  const targetCoveredIdxs = useMemo(() => {
    if (!target) return [];
    const idxs: number[] = [];
    for (let i = rangeStart; i <= rangeEnd; i++) {
      if (target.sale_value[i] > 0 || target.units[i] > 0 || target.area[i] > 0) idxs.push(i);
    }
    return idxs;
  }, [target, rangeStart, rangeEnd]);

  const totalTargetTsvInRange = useMemo(
    () => targetCoveredIdxs.reduce((s, i) => s + (target?.sale_value[i] ?? 0), 0),
    [targetCoveredIdxs, target]
  );
  const totalAchievedTsvInRange = useMemo(
    () => targetCoveredIdxs.reduce((s, i) => s + (actual?.monthly_tsv[i] ?? 0), 0),
    [targetCoveredIdxs, actual]
  );
  const totalTargetAreaInRange = useMemo(
    () => targetCoveredIdxs.reduce((s, i) => s + (target?.area[i] ?? 0), 0) / 100000,
    [targetCoveredIdxs, target]
  );
  const totalAchievedAreaInRange = useMemo(
    () => targetCoveredIdxs.reduce((s, i) => s + (actual?.monthly_area[i] ?? 0), 0),
    [targetCoveredIdxs, actual]
  );

  const requiredRate = useMemo(() => {
    const remainingTsv = totalTargetTsvInRange - totalAchievedTsvInRange;
    const remainingArea = totalTargetAreaInRange - totalAchievedAreaInRange;
    if (remainingArea <= 0.001) return null; // all target-scoped area already sold
    if (remainingTsv <= 0) return null; // value target already met with area still available
    const rate = Math.round((remainingTsv * 1e7) / (remainingArea * 1e5));
    return isFinite(rate) ? rate : null;
  }, [totalTargetTsvInRange, totalAchievedTsvInRange, totalTargetAreaInRange, totalAchievedAreaInRange]);

  // Flat "Adjusted Rate for Balance Year" line: same requiredRate value on
  // the current period (anchor, so the line has 2+ points to draw from)
  // and every future period. Without an anchor, a single future rate
  // point would render as a lone dot with no visible line.
  const rateDataWithAdjusted = useMemo(
    () => rateData.map(d => ({ ...d, adjustedRate: (d.isCurrent || d.isFuture) ? requiredRate : null })),
    [rateData, requiredRate]
  );

  function handleRatePointClick(p: RatePoint) {
    setDrillMonth({ month: p.month, target: 0, achieved: 0, adjusted: null, catchUp: null, showBadge: false, isFuture: p.isFuture, isCurrent: false, year: p.year, calMonth: p.calMonth });
  }

  const periodLabel = periodType === "all" ? "All time"
    : periodType === "custom" ? `${TIMELINE[Math.min(customFrom, customTo)]?.label} – ${TIMELINE[Math.max(customFrom, customTo)]?.label}`
    : periodType === "year" ? YEAR_OPTIONS[yearIdx].label
    : periodType === "quarter" ? `${QUARTER_LABELS[quarter - 1]} ${YEAR_OPTIONS[yearIdx].label}`
    : `${TIMELINE[YEAR_OPTIONS[yearIdx].start + month]?.label}`;

  return (
    <div className="sw-inv" style={{ minHeight: "100vh" }}>
      {/* Everything except the drill-down drawers is zoomed to 90%.
          The drawers are rendered OUTSIDE this zoomed wrapper (as
          direct children of the un-zoomed .sw-inv root) because
          Chromium's `zoom` property creates a new containing block for
          `position: fixed` descendants — a fixed drawer nested inside a
          zoomed ancestor scrolls with that ancestor's content instead
          of staying pinned to the real viewport. */}
      <div className="tv-zoom-desktop" style={{ overflowX: "hidden" } as React.CSSProperties}>
      {/* Filter bar */}
      <div style={{ background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)", padding: "14px 22px 14px", borderBottom: "3px solid var(--gold)" }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 20, color: "#fff", fontWeight: 700 }}>Target vs Actual</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 2 }}>AOP targets against achieved units, value and rates</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 14 }}>
        <LocationSelect locations={LOCATIONS} value={location} onChange={handleLocationChange} />
        <ProjectMultiSelect projects={availableNames} selected={selectedProjects} onChange={setSelectedProjects} />

        <div>
          <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Period</label>
          <div style={{ display: "flex", gap: 5 }}>
            {(["all", "year", "quarter", "month", "custom"] as PeriodType[]).map(t => (
              <button key={t} onClick={() => setPeriodType(t)} style={{ background: periodType === t ? "#B8893C" : "#1D2A4A", color: "#fff", border: `1px solid ${periodType === t ? "#B8893C" : "#33406B"}`, borderRadius: 7, padding: "9px 14px", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer" }}>
                {t === "all" ? "All time" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {(periodType === "year" || periodType === "quarter" || periodType === "month") && (
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

        {periodType === "custom" && (
          <>
            <div>
              <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>From</label>
              <select value={customFrom} onChange={e => setCustomFrom(+e.target.value)} style={{ background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                {TIMELINE.map((m, i) => <option key={m.label} value={i}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>To</label>
              <select value={customTo} onChange={e => setCustomTo(+e.target.value)} style={{ background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                {TIMELINE.map((m, i) => <option key={m.label} value={i}>{m.label}</option>)}
              </select>
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />
        <span style={{ color: "#c7cedf", fontSize: 12.5, paddingBottom: 9, marginRight: 14 }}>Data as on <strong style={{ color: "#fff", fontWeight: 600 }}>{DATA_AS_ON}</strong></span>
        <button onClick={handleReset} style={{ background: "none", border: "none", color: "#c7cedf", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", paddingBottom: 9 }}>Reset</button>
        </div>
      </div>

      <div className="wrap">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, color: "var(--mut)" }}>
            <strong>{selectionLabel}</strong> · {periodLabel}
          </div>

        </div>

        {!target && !actual && (
          <div className="card"><p style={{ color: "var(--mut)" }}>No target or actual data for this project.</p></div>
        )}

        {/* AOP + current month summary — fixed scope, above all charts */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="resp-grid2"
          style={{ gap: 14, marginBottom: 14 }}
        >
          <TvaSummaryCard title={`AOP TARGET VALUES ${aopFy.label.replace("FY ", "")}`} rows={summaryRows.aop} />
          <TvaSummaryCard title={`CURRENT MONTH${todayIdx >= 0 ? ` — ${TIMELINE[todayIdx].label}` : ""}`} rows={summaryRows.month} />
        </motion.div>

        {/* Chart controls — sit under the two summary tables, right
            above the charts they drive */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          {/* Bar/Line style toggle — flips the three Target vs Achieved charts together */}
          <div style={{
            display: "inline-flex", background: "#fff", borderRadius: 999, padding: 4,
            boxShadow: "0 1px 3px rgba(20,33,61,.08), 0 4px 14px rgba(20,33,61,.08)", border: "1px solid #e4e0d6",
            marginRight: 10,
          }}>
            {(["bar", "line"] as const).map(sty => (
              <button
                key={sty}
                onClick={() => setChartStyle(sty)}
                style={{
                  border: "none",
                  background: chartStyle === sty ? "#0097a7" : "transparent",
                  color: chartStyle === sty ? "#fff" : "#0097a7",
                  fontWeight: 700,
                  fontSize: 13,
                  padding: "8px 20px",
                  borderRadius: 999,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "background 0.15s, color 0.15s, transform 0.34s cubic-bezier(0.34, 1.8, 0.5, 1)",
                  textTransform: "capitalize",
                }}
              >
                {sty}
              </button>
            ))}
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
                  transition: "background 0.15s, color 0.15s, transform 0.34s cubic-bezier(0.34, 1.8, 0.5, 1)",
                  textTransform: "capitalize",
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Cards 1-2: Units, TSV */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="resp-grid2"
          style={{ gap: 14, marginBottom: 14 }}
        >
          <Zoomable title="Target vs achieved">
          <UnitsTargetCard chartStyle={chartStyle} data={unitsData} title="UNITS — TARGET VS ACHIEVED" unit="Units" onBarClick={setDrillMonth}
            offset={sharedOffset} windowSize={WINDOW_SIZE} onOffsetChange={setSharedOffset} />
          </Zoomable>
          <Zoomable title="Target vs achieved">
          <UnitsTargetCard chartStyle={chartStyle} data={tsvData} title="TSV — TARGET VS ACHIEVED (₹ Crs)" unit="Cr" formatVal={n => n.toFixed(1)} onBarClick={setDrillMonth}
            offset={sharedOffset} windowSize={WINDOW_SIZE} onOffsetChange={setSharedOffset} />
          </Zoomable>
        </motion.div>

        {/* Cards 3-4: Area, Avg Rate — same 2-column size as above, same shared offset */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="resp-grid2"
          style={{ gap: 14, marginBottom: 14 }}
        >
          <Zoomable title="Target vs achieved">
          <UnitsTargetCard chartStyle={chartStyle} data={areaData} title="AREA — TARGET VS ACHIEVED (Lakh sqft)" unit="L sqft" formatVal={n => n.toFixed(2)} onBarClick={setDrillMonth}
            offset={sharedOffset} windowSize={WINDOW_SIZE} onOffsetChange={setSharedOffset} />
          </Zoomable>
          <Zoomable title="Avg rate — target vs achieved">
          <AvgRateCard
            data={rateDataWithAdjusted}
            avgAchievedRate={avgAchievedRate}
            targetRate={avgTargetRate}
            requiredRate={requiredRate}
            onPointClick={handleRatePointClick}
            offset={sharedOffset} windowSize={WINDOW_SIZE} onOffsetChange={setSharedOffset}
          />
          </Zoomable>
        </motion.div>

        {/* Cards 5-6: Tower charts */}
        {actual && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="tv-2x2-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginBottom: 18 }}>
            <Zoomable title="Sold % — units & TSV">
            <TowerSoldPctCard title={activeNames.length > 1 ? "PROJECT WISE SOLD % — UNITS & TSV" : undefined} towers={actual.towers} projectTsv={actual.tsv} projectSold={actual.sold} onTowerClick={handleTowerDrill} />
            </Zoomable>
            <Zoomable title="Rate movement">
            <TowerRateMovementCard title={activeNames.length > 1 ? "PROJECT WISE RATE MOVEMENT" : undefined} towers={actual.towers} onTowerClick={handleTowerDrill} />
            </Zoomable>
          </motion.div>
        )}

        {/* Cards 7-8: Rate trend + Type wise */}
        {actual && (
          <div className="tv-2x2-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginBottom: 18 }}>
            <Zoomable title="Rate trend over time">
            <RateTrendOverTimeCard data={actual.rate_trend} />
            </Zoomable>
            <Zoomable title="Type-wise sales">
            <TypeWiseSaleCard configs={actual.configs} onConfigClick={name => setDrillScope({ type: "config", label: name, projects: activeNames })} />
            </Zoomable>
          </div>
        )}
      </div>
      </div>
      {/* end zoomed wrapper — drawers below are intentionally outside it */}

      {/* Drill-downs */}
      {drillMonth && (
        <MonthDrillDrawer
          year={drillMonth.year}
          month={drillMonth.calMonth}
          monthLabel={drillMonth.month}
          projectFilter={new Set(activeNames)}
          onClose={() => setDrillMonth(null)}
        />
      )}
      {drillScope && (
        <ScopeDrawer
          projectName={drillScope.projects.length === 1 ? drillScope.projects[0] : selectionLabel}
          projectNames={drillScope.projects}
          scopeType={drillScope.type}
          scopeLabel={drillScope.label}
          onClose={() => setDrillScope(null)}
        />
      )}
    </div>
  );
}
