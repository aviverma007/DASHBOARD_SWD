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

  const TH: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", textAlign: "right", padding: "6px 8px" };
  const TD: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 14.5, color: "var(--ink)", textAlign: "right", padding: "7px 8px", whiteSpace: "nowrap" };

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>{title}</div>
      {rows === null ? (
        <p style={{ color: "var(--mut)", fontSize: 12.5, margin: 0 }}>Outside the plan timeline.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <th style={{ ...TH, textAlign: "left" }}></th>
              <th style={TH}>Total</th>
              <th style={TH}>Achieved</th>
              <th style={TH}>%age</th>
            </tr>
          </thead>
          <tbody>
            {([
              ["UNITS", rows.units, fmt.units],
              ["AREA",  rows.area,  fmt.area],
              ["TSV",   rows.tsv,   fmt.tsv],
            ] as const).map(([lbl, pair, f]) => {
              const p = pct(pair);
              return (
                <tr key={lbl} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", color: "var(--mut)", padding: "7px 8px 7px 0" }}>{lbl}</td>
                  <td style={TD}>{f(pair.t)}</td>
                  <td style={{ ...TD, fontWeight: 700 }}>{f(pair.a)}</td>
                  <td style={{ ...TD, fontWeight: 700, color: p === null ? "var(--mut)" : p >= 100 ? "#1a7a4a" : "#c97a1a" }}>
                    {p === null ? "—" : p + "%"}
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
  // Custom range — TIMELINE indices, inclusive
  const [customFrom, setCustomFrom] = useState<number>(0);
  const [customTo, setCustomTo] = useState<number>(TIMELINE.length - 1);

  const [drillMonth, setDrillMonth] = useState<TVADataPoint | null>(null);
  const [drillScope, setDrillScope] = useState<{ type: "tower" | "config"; label: string } | null>(null);

  const target = TD.projects.find(p => p.name === selectedProject);
  const actual = TV.projects.find(p => p.name === selectedProject);

  function handleReset() {
    setPeriodType("all"); setYearIdx(1); setQuarter(1); setMonth(0); setChartGranularity("month");
    setCustomFrom(0); setCustomTo(TIMELINE.length - 1);
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
      <div style={{ background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)", padding: "12px 22px 14px", borderBottom: "3px solid var(--gold)", display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 14 }}>
        <ProjectSelect projects={TD.projects.map(p => p.name)} selected={selectedProject} onChange={setSelectedProject} />

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

        {/* AOP + current month summary — fixed scope, above all charts */}
        <div className="resp-grid2" style={{ gap: 14, marginBottom: 14 }}>
          <TvaSummaryCard title={`AOP TARGET VALUES ${aopFy.label.replace("FY ", "")}`} rows={summaryRows.aop} />
          <TvaSummaryCard title={`CURRENT MONTH${todayIdx >= 0 ? ` — ${TIMELINE[todayIdx].label}` : ""}`} rows={summaryRows.month} />
        </div>

        {/* Cards 1-2: Units, TSV */}
        <div className="resp-grid2" style={{ gap: 14, marginBottom: 14 }}>
          <UnitsTargetCard data={unitsData} title="UNITS — TARGET VS ACHIEVED" unit="Units" onBarClick={setDrillMonth}
            offset={sharedOffset} windowSize={WINDOW_SIZE} onOffsetChange={setSharedOffset} />
          <UnitsTargetCard data={tsvData} title="TSV — TARGET VS ACHIEVED (₹ Crs)" unit="Cr" formatVal={n => n.toFixed(1)} onBarClick={setDrillMonth}
            offset={sharedOffset} windowSize={WINDOW_SIZE} onOffsetChange={setSharedOffset} />
        </div>

        {/* Cards 3-4: Area, Avg Rate — same 2-column size as above, same shared offset */}
        <div className="resp-grid2" style={{ gap: 14, marginBottom: 14 }}>
          <UnitsTargetCard data={areaData} title="AREA — TARGET VS ACHIEVED (Lakh sqft)" unit="L sqft" formatVal={n => n.toFixed(2)} onBarClick={setDrillMonth}
            offset={sharedOffset} windowSize={WINDOW_SIZE} onOffsetChange={setSharedOffset} />
          <AvgRateCard
            data={rateDataWithAdjusted}
            avgAchievedRate={avgAchievedRate}
            targetRate={avgTargetRate}
            requiredRate={requiredRate}
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
      </div>
      {/* end zoomed wrapper — drawers below are intentionally outside it */}

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
