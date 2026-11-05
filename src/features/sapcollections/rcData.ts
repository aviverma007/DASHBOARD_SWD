/** Dated customer receipts (SAP ZREC prints) and the period maths the Collections view shares.
 * Built by scripts/build_collections.py into src/data/collections.json.
 * Collection = cleared RECEIPTs (online / cheque / DD); TDS challans, bounces, receipts awaiting
 * clearance, refunds and journal vouchers are kept apart — JVs only move money between customer codes. */
import raw from "../../data/collections.json";

interface RcFile {
  meta: { asOn: string; asOnDay: number; coverageFrom: Record<string, string>; duplicatesDropped: number };
  KINDS: string[]; PROJECTS: string[]; MODES: string[]; BANKS: string[]; CHANNELS: string[]; CHARGES: string[]; CSTATUS: string[];
  C: string[][]; R: (number | string)[][];
}
export const RC = raw as unknown as RcFile;

export const KIND = { CASH: 0, TDS: 1, BOUNCE: 2, PENDING: 3, REFUND: 4, JV: 5 } as const;
export interface Rc {
  day: number; clr: number; amt: number; proj: string; kind: number; mode: string; bank: string; channel: string;
  charge: string; cstatus: string; code: string; name: string; unit: string; doc: string;
}
export const RECEIPTS: Rc[] = RC.R.map(r => {
  const c = RC.C[r[10] as number] ?? [];
  return {
    day: r[0] as number, clr: r[1] as number, amt: r[2] as number, proj: RC.PROJECTS[r[3] as number], kind: r[4] as number,
    mode: RC.MODES[r[5] as number], bank: RC.BANKS[r[6] as number], channel: RC.CHANNELS[r[7] as number],
    charge: RC.CHARGES[r[8] as number], cstatus: RC.CSTATUS[r[9] as number],
    code: c[0] ?? "", name: c[1] || "—", unit: c[2] || "", doc: String(r[11] ?? ""),
  };
});
export const PROJECTS_RC = [...RC.PROJECTS].sort();

/** SAP's EOI collection pool accounts (no name, no unit, many receipts): money lands there first and is
 *  moved to the customer's own code by journal voucher. Real cash, but not a customer. */
export const POOL_NAME = "EOI collection pool";
(() => {
  const n = new Map<string, number>();
  RECEIPTS.forEach(r => { if (r.name === "—" && !r.unit) n.set(r.code, (n.get(r.code) ?? 0) + 1); });
  RECEIPTS.forEach(r => { if ((n.get(r.code) ?? 0) >= 50) r.name = POOL_NAME; });
})();

/* ---------------- dates ---------------- */
const EPOCH = Date.UTC(2022, 0, 1), DAY = 86400000;
const dt = (d: number) => new Date(EPOCH + d * DAY);
export const dayOf = (y: number, m: number, d: number) => Math.round((Date.UTC(y, m - 1, d) - EPOCH) / DAY);
export const fDay = (d: number) => d < 0 ? "—" : dt(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const fDayS = (d: number) => d < 0 ? "—" : dt(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
export const ymOf = (d: number) => dt(d).toISOString().slice(0, 7);
export const ymLbl = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(" ", "'");
export const dow = (d: number) => dt(d).getUTCDay();   // 0 Sun
const todayIst = () => Math.floor((Date.now() + 5.5 * 3600000 - EPOCH) / DAY);

/** anchor = latest day with a cleared receipt in the data ("today" once the feed is live) */
export const ANCHOR = RC.meta.asOnDay;
export const ANCHOR_IS_TODAY = ANCHOR === todayIst();

export interface Period { key: string; label: string; short: string; from: number; to: number; prev?: { from: number; to: number; label: string } }
export function periods(a = ANCHOR): Record<string, Period> {
  const d = dt(a), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  const mon = a - ((dow(a) + 6) % 7);                     // Monday of this week
  const mStart = dayOf(y, m, 1), lmStart = dayOf(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1, 1), lmEnd = mStart - 1;
  const llmStart = (() => { const d2 = dt(lmStart); const yy = d2.getUTCFullYear(), mm = d2.getUTCMonth() + 1; return dayOf(mm === 1 ? yy - 1 : yy, mm === 1 ? 12 : mm - 1, 1); })();
  const fyY = m >= 4 ? y : y - 1, fyStart = dayOf(fyY, 4, 1);
  // previous working day for the "today" comparison (skip Sunday)
  const prevDay = a - (dow(a) === 1 ? 2 : 1);
  const dayLbl = ANCHOR_IS_TODAY && a === ANCHOR ? "Today" : `Latest day · ${fDayS(a)}`;
  const sameDayLm = Math.min(lmStart + (a - mStart), lmEnd);
  return {
    today: { key: "today", label: dayLbl, short: fDayS(a), from: a, to: a, prev: { from: prevDay, to: prevDay, label: `vs ${fDayS(prevDay)}` } },
    week: { key: "week", label: "This week", short: `${fDayS(mon)} – ${fDayS(a)}`, from: mon, to: a, prev: { from: mon - 7, to: a - 7, label: "vs same days last week" } },
    lastweek: { key: "lastweek", label: "Last week", short: `${fDayS(mon - 7)} – ${fDayS(mon - 1)}`, from: mon - 7, to: mon - 1, prev: { from: mon - 14, to: mon - 8, label: "vs the week before" } },
    mtd: { key: "mtd", label: "This month", short: `${ymLbl(ymOf(a))} to date`, from: mStart, to: a, prev: { from: lmStart, to: sameDayLm, label: "vs same days last month" } },
    lastmonth: { key: "lastmonth", label: "Last month", short: ymLbl(ymOf(lmStart)), from: lmStart, to: lmEnd, prev: { from: llmStart, to: lmStart - 1, label: `vs ${ymLbl(ymOf(llmStart))}` } },
    last30: { key: "last30", label: "Last 30 days", short: `${fDayS(a - 29)} – ${fDayS(a)}`, from: a - 29, to: a, prev: { from: a - 59, to: a - 30, label: "vs the 30 days before" } },
    fy: { key: "fy", label: `FY ${String(fyY).slice(2)}-${String(fyY + 1).slice(2)} to date`, short: `since 1 Apr ${fyY}`, from: fyStart, to: a, prev: { from: dayOf(fyY - 1, 4, 1), to: a - 365, label: "vs same point last FY" } },
    all: { key: "all", label: "Collection till date", short: "all receipts in the data", from: -1e6, to: 1e6 },
  };
}

/* ---------------- aggregation ---------------- */
export const inP = (r: Rc, p: { from: number; to: number }) => r.day >= p.from && r.day <= p.to;
export interface Agg { cash: number; tds: number; n: number; bounce: number; nBounce: number; pending: number; refund: number; jv: number; payers: number }
export function agg(rs: Rc[]): Agg {
  const a: Agg = { cash: 0, tds: 0, n: 0, bounce: 0, nBounce: 0, pending: 0, refund: 0, jv: 0, payers: 0 };
  const who = new Set<string>();
  for (const r of rs) {
    if (r.kind === KIND.CASH) { a.cash += r.amt; a.n++; who.add(r.code); }
    else if (r.kind === KIND.TDS) a.tds += r.amt;
    else if (r.kind === KIND.BOUNCE) { a.bounce += r.amt; a.nBounce++; }
    else if (r.kind === KIND.PENDING) a.pending += r.amt;
    else if (r.kind === KIND.REFUND) a.refund += Math.abs(r.amt);
    else a.jv += r.amt;
  }
  a.payers = who.size;
  return a;
}
export const sumBy = (rs: Rc[], key: (r: Rc) => string, val: (r: Rc) => number = r => r.amt) => {
  const m = new Map<string, number>();
  rs.forEach(r => m.set(key(r), (m.get(key(r)) ?? 0) + val(r)));
  return [...m.entries()].map(([k, v]) => ({ k, v })).sort((x, y) => y.v - x.v);
};
/** working days Mon–Sat between two day numbers, inclusive */
export const workDays = (a: number, b: number) => { let n = 0; for (let d = a; d <= b; d++) if (dow(d) !== 0) n++; return n; };

export const fCr = (v: number, dp = 2) => `₹${(v / 1e7).toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp })} Cr`;
export const fMoney = (v: number) => { const a = Math.abs(v); return a >= 1e7 ? fCr(v) : a >= 1e5 ? `₹${(v / 1e5).toFixed(2)} L` : `₹${Math.round(v).toLocaleString("en-IN")}`; };
export const fN = (n: number) => Math.round(n).toLocaleString("en-IN");
export const pctChg = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? Infinity : 0);
