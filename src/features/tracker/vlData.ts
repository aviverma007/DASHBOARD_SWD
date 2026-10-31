/** VisiLean task data (Table View export) and every calculation the tracker
 * tabs share. Built by scripts/build_tracker_vl.py into src/data/trackerVL.json.
 *
 * Rules reproduce the VisiLean Power BI reports (checked on Sky Arc, 31 Oct 2026):
 *  - % complete (Project Review)  = planned-duration-weighted progress.
 *  - Earned value                 = baseline cost × progress (₹179.07 Cr, exact).
 *  - Baseline cost / BCWS to date = cost spread over baseline / planned dates by
 *    working days Mon–Sat (within 0.05% of Power BI).
 *  - Delay (auto schedule) = planned end − baseline end.
 *  - Delay (actual status) = complete: actual end − planned end; started: as-on − planned end;
 *    not started: as-on − planned start (when that has passed).
 *  - A tower's Delay (actual) = the largest delay among its tasks not yet complete.
 */
import raw from "../../data/trackerVL.json";

interface VLFile {
  META: Record<string, { asOn: string; source: string; tasks: number; cost: number; costCol?: string; contractorCol?: string }>;
  REASONS: string[]; TYPES: string[]; CATS: string[];
  PROJECTS: string[]; STATUS: string[]; LOCS: string[]; TOWERS: string[]; FLOORS: string[];
  TRADES: string[]; OWNERS: string[]; CONTRACTORS: string[]; ORGS: string[];
  T: (string | number)[][];
}
export const VL = raw as unknown as VLFile;

export const EPOCH = Date.UTC(2022, 0, 1);
const DAY = 86400000;
export const dayOf = (y: number, m: number, d: number) => Math.round((Date.UTC(y, m - 1, d) - EPOCH) / DAY);
export const fD = (d: number) => d < 0 ? "—" : new Date(EPOCH + d * DAY).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).replace(/\//g, "-");
export const fDs = (d: number) => d < 0 ? "—" : new Date(EPOCH + d * DAY).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" });
export const ymOf = (d: number) => new Date(EPOCH + d * DAY).toISOString().slice(0, 7);
export const ymEnd = (ym: string) => { const [y, m] = ym.split("-").map(Number); return dayOf(y, m + 1, 1) - 1; };
export const ymLbl = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(" ", "'");
export const fCr = (v: number, dp = 2) => `₹${(v / 1e7).toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp })} Cr`;
export const fN = (n: number) => Math.round(n).toLocaleString("en-IN");
export const fPct = (v: number, dp = 1) => (isFinite(v) ? `${v.toFixed(dp)}%` : "—");

/** "31 Oct 2026" → day number */
export function asOnDay(s: string): number {
  const t = Date.parse(`${s} UTC`);
  return isNaN(t) ? dayOf(2026, 10, 31) : Math.round((t - EPOCH) / DAY);
}

/* working days Mon–Sat, as a running count so any range is O(1) */
const WD: number[] = (() => {
  const n = 4400, w = new Array<number>(n);
  let c = 0;
  for (let i = 0; i < n; i++) { if (new Date(EPOCH + i * DAY).getUTCDay() !== 0) c++; w[i] = c; }
  return w;
})();
const wd = (a: number, b: number) => (b < a ? 0 : WD[Math.min(b, WD.length - 1)] - (a > 0 ? WD[Math.min(a - 1, WD.length - 1)] : 0));
/** share of [s, e] elapsed by day `c` (inclusive), by working days */
export function frac(s: number, e: number, c: number): number {
  if (s < 0 || e < 0) return 0;
  if (c >= e) return 1;
  if (c < s) return 0;
  const tot = wd(s, e);
  return tot ? wd(s, c) / tot : 1;
}

export type Phase = "done" | "started" | "notStarted" | "stopped";
export interface VTask {
  proj: number; id: number; name: string; status: string;
  bs: number; be: number; ps: number; pe: number; as: number; ae: number;
  dur: number; prog: number; cost: number;
  loc: string; tower: string; floor: string; frank: number; trade: string; owner: string;
  contractor: string; org: string; critical: boolean; milestone: boolean; workforce: number;
  reasons: string[]; type: string; cat: string;
  phase: Phase; ev: number;
  delayAuto: number; delayActual: number; lateRunning: boolean; lateStart: boolean;
}

const asOnOf = VL.PROJECTS.map(p => asOnDay(VL.META[p]?.asOn ?? ""));
export const projAsOn = (pi: number) => asOnOf[pi];

export const TASKS: VTask[] = VL.T.map(r => {
  const g = (i: number) => r[i] as number;
  const proj = g(0), status = VL.STATUS[g(3)], today = asOnOf[proj];
  const prog = g(11), ae = g(9), as = g(8), pe = g(7), ps = g(6), be = g(5);
  const s = status.toLowerCase();
  const phase: Phase = s.includes("stop") ? "stopped"
    : (s === "complete" || s === "approved" || s === "quality checked" || s.includes("milestone completed") || ae >= 0 || prog >= 100) ? "done"
    : (s === "started" || as >= 0 || prog > 0) ? "started" : "notStarted";
  const delayActual = phase === "done" ? (ae >= 0 && pe >= 0 ? ae - pe : 0)
    : phase === "started" || phase === "stopped" ? (pe >= 0 ? today - pe : 0)
    : ps >= 0 && today > ps ? today - ps : 0;
  const reasons = VL.REASONS.filter((_, b) => (g(24) & (1 << b)) !== 0);
  return {
    proj, id: g(1), name: r[2] as string, status, bs: g(4), be, ps, pe, as, ae,
    dur: g(10), prog, cost: g(12),
    loc: VL.LOCS[g(13)], tower: VL.TOWERS[g(14)], floor: VL.FLOORS[g(15)], frank: g(16),
    trade: VL.TRADES[g(17)] || "—", owner: VL.OWNERS[g(18)], contractor: VL.CONTRACTORS[g(19)], org: VL.ORGS[g(20)],
    critical: g(21) === 1, milestone: g(22) === 1, workforce: g(23), reasons,
    type: VL.TYPES[g(25)], cat: VL.CATS[g(26)],
    phase, ev: (g(12) * prog) / 100,
    delayAuto: pe >= 0 && be >= 0 ? pe - be : 0, delayActual,
    lateRunning: (phase === "started") && pe >= 0 && today > pe,
    lateStart: phase === "notStarted" && ps >= 0 && today > ps,
  };
});

/* ---------------- aggregates ---------------- */
export const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);

/** duration-weighted % complete (actual) and % that should be done by `cut` (planned) */
export function pctDone(ts: VTask[], cut: number) {
  const w = sum(ts, t => Math.max(t.dur, 1));
  if (!w) return { actual: 0, planned: 0, baseline: 0 };
  return {
    actual: (sum(ts, t => Math.max(t.dur, 1) * Math.min(t.prog, 100) / 100) / w) * 100,
    planned: (sum(ts, t => Math.max(t.dur, 1) * frac(t.ps, t.pe, cut)) / w) * 100,
    baseline: (sum(ts, t => Math.max(t.dur, 1) * frac(t.bs, t.be, cut)) / w) * 100,
  };
}

export interface EVPoint { ym: string; bl: number; bcws: number; ev: number | null; cBl: number; cBcws: number; cEv: number | null }
/** earned value summary at `cut` and the monthly S-curve */
export function earned(ts: VTask[], cut: number) {
  const budget = sum(ts, t => t.cost);
  const blTill = sum(ts, t => t.cost * frac(t.bs, t.be, cut));
  const bcwsTill = sum(ts, t => t.cost * frac(t.ps, t.pe, cut));
  const ev = sum(ts, t => t.ev);
  return { budget, blTill, bcwsTill, ev, variance: bcwsTill - ev, varBl: blTill - ev,
    blPct: budget ? (blTill / budget) * 100 : 0, bcwsPct: budget ? (bcwsTill / budget) * 100 : 0, evPct: budget ? (ev / budget) * 100 : 0 };
}

/** monthly series; EV is spread over each task's actual start → actual end (or as-on) and stops at the as-on month */
export function sCurve(ts: VTask[], cut: number): EVPoint[] {
  const costed = ts.filter(t => t.cost > 0);
  const ds = costed.flatMap(t => [t.bs, t.be, t.ps, t.pe]).filter(d => d >= 0);
  if (!ds.length) return [];
  let ym = ymOf(Math.min(...ds));
  const last = ymOf(Math.max(...ds)), cutYm = ymOf(cut);
  const out: EVPoint[] = [];
  let pBl = 0, pBc = 0, pEv = 0;
  while (ym <= last) {
    const e = ymEnd(ym);
    const cBl = sum(costed, t => t.cost * frac(t.bs, t.be, e));
    const cBcws = sum(costed, t => t.cost * frac(t.ps, t.pe, e));
    const evOn = ym <= cutYm;
    const cEv = evOn ? sum(costed, t => (t.as >= 0 ? t.ev * frac(t.as, t.ae >= 0 ? t.ae : Math.max(cut, t.as), Math.min(e, cut)) : 0)) : null;
    out.push({ ym, bl: cBl - pBl, bcws: cBcws - pBc, ev: cEv === null ? null : cEv - pEv, cBl, cBcws, cEv });
    pBl = cBl; pBc = cBcws; if (cEv !== null) pEv = cEv;
    const [y, m] = ym.split("-").map(Number);
    ym = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  return out;
}

/** natural tower order: Tower A, A(P1), B … then non-tower areas */
export function towerOrder(names: string[]): string[] {
  const rank = (n: string) => /^tower|^t\d/i.test(n) ? 0 : /^nta|^common|^ews|^club/i.test(n) ? 1 : /procure|drawing/i.test(n) ? 2 : 3;
  return [...new Set(names)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "en", { numeric: true }));
}

export const groupBy = <T,>(xs: T[], k: (x: T) => string) => {
  const m = new Map<string, T[]>();
  xs.forEach(x => { const key = k(x); if (!m.has(key)) m.set(key, []); m.get(key)!.push(x); });
  return m;
};

/** timeline row for a group of tasks (a tower): ends, delays, % planned vs actual */
export function timeline(ts: VTask[], cut: number) {
  const be = Math.max(-1, ...ts.map(t => t.be)), pe = Math.max(-1, ...ts.map(t => t.pe));
  const open = ts.filter(t => t.phase !== "done");
  const p = pctDone(ts, cut);
  return {
    be, pe, delayAop: be >= 0 && pe >= 0 ? pe - be : 0,
    delayActual: open.length ? Math.max(...open.map(t => t.delayActual)) : null,
    planned: p.planned, actual: p.actual,
  };
}

/** contractor score as VisiLean defines it: 40% cost achieved + 60% physical progress */
export function contractorScore(ts: VTask[]) {
  const n = ts.length, executed = sum(ts, t => Math.min(t.prog, 100) / 100);
  const cost = sum(ts, t => t.cost), ev = sum(ts, t => t.ev);
  const phys = n ? (executed / n) * 100 : 0, achieved = cost ? (ev / cost) * 100 : 0;
  return { n, executed, phys, cost, ev, achieved, score: 0.4 * achieved + 0.6 * phys, workers: sum(ts, t => t.workforce) };
}
export const SCORE_BANDS: [number, string, string][] = [[86, "Excellent", "#0f9d58"], [71, "Good", "#7cc48c"], [61, "Average", "#f2c6a0"], [51, "Below average", "#f4b400"], [0, "Poor", "#e0322c"]];
export const scoreBand = (v: number) => SCORE_BANDS.find(([lo]) => v >= lo)!;

export const PHASE_LBL: Record<Phase, string> = { done: "Complete", started: "Started", notStarted: "Not started", stopped: "Stopped" };
