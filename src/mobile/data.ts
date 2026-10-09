/** Shared phone-screen aggregates. Re-uses the same datasets/logic as the desktop pages — no new numbers. */
import { PDRN, calcOverall, type PeriodFilter } from "../utils/pdrnLogic";
import cpRaw from "../data/cpAnalytics.json";
import { MONTHS } from "./fmt";

export const ALL: PeriodFilter = { type: "all" };

export interface MonthPt { label: string; value: number; units: number; ym: number }

/** last `n` months (ending at the latest month with a booking) of sales value (₹) and units */
export function salesByMonth(n = 12): MonthPt[] {
  const m = new Map<number, { v: number; u: number }>();
  let max = 0;
  for (const r of PDRN.R) {
    const k = r.year * 12 + (r.month - 1);
    const e = m.get(k) ?? { v: 0, u: 0 };
    e.v += r.tsv; e.u += 1; m.set(k, e);
    if (k > max) max = k;
  }
  const out: MonthPt[] = [];
  for (let k = max - n + 1; k <= max; k++) {
    const e = m.get(k) ?? { v: 0, u: 0 };
    out.push({ label: MONTHS[k % 12], value: e.v, units: e.u, ym: k });
  }
  return out;
}

const CP = cpRaw as unknown as { P: string[]; R: number[][]; meta: { asOn: string } };
export interface Coll { n: number; tcv: number; called: number; recv: number; due: number }
/** SAP collection totals over active bookings (same semantics as the SAP Collections page / assistant) */
export function collectionTotals(): Coll {
  const t: Coll = { n: 0, tcv: 0, called: 0, recv: 0, due: 0 };
  for (const r of CP.R) {
    if (r[13] !== 0) continue;
    const called = r[22], recv = r[24] - r[25];
    t.n++; t.tcv += r[26]; t.called += called; t.recv += recv; t.due += called - recv;
  }
  return t;
}
export const collectionAsOn = CP.meta.asOn;

export const overall = () => calcOverall(ALL);
