/** Footfall analytics over the Customer Site Visit export
 * (Footfall_data_till_21_aug.xlsx · 54,222 records).
 * Mirrors the reference suite's customer-footfall page: dimensional
 * counting with click-to-filter, monthly trend, weekday pattern —
 * plus a conversion funnel built from Opportunity Stage. */
import raw from "../data/footfallVisits.json";

export interface FfRecord {
  g: number;    // gallery idx
  p: number;    // project idx
  src: number;  // 0 Direct · 1 Channel Partner · 2 Direct Loyalty · -1 blank
  cp: number;   // channel partner idx (-1 none)
  stg: number;  // stage idx (-1 blank)
  loc: number;  // locality idx
  age: number;  // age band idx
  cat: number;  // category idx
  day: number;  // days since 2022-01-01 (-1 unknown)
}

interface FfDataset {
  G: string[]; P: string[]; CPN: string[]; LOC: string[];
  AGE: string[]; STG: string[]; CAT: string[]; SRC: string[];
  epoch: string; R: number[][];
  meta: { rows: number; source: string; asOn: string };
}

export const FF = raw as unknown as FfDataset;

export const FF_RECORDS: FfRecord[] = FF.R.map(r => ({
  g: r[0], p: r[1], src: r[2], cp: r[3], stg: r[4], loc: r[5], age: r[6], cat: r[7], day: r[8],
}));

const EPOCH_MS = new Date(FF.epoch + "T00:00:00").getTime();
export function dayToDate(day: number): Date {
  return new Date(EPOCH_MS + day * 86400000);
}
export function dayToYm(day: number): string {
  const d = dayToDate(day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function ymLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]}'${String(y).slice(2)}`;
}
export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Active filter: one per dimension max, like the reference suite. */
export interface FfFilter { dim: FfDim; val: number | string; label: string }
export type FfDim = "g" | "p" | "src" | "loc" | "age" | "mon" | "dow" | "stg" | "cat";

export function ffScope(filters: FfFilter[]): FfRecord[] {
  return FF_RECORDS.filter(r =>
    filters.every(f => {
      switch (f.dim) {
        case "g":   return r.g === f.val;
        case "p":   return r.p === f.val;
        case "src": return r.src === f.val;
        case "loc": return r.loc === f.val;
        case "age": return r.age === f.val;
        case "stg": return r.stg === f.val;
        case "cat": return r.cat === f.val;
        case "mon": return r.day >= 0 && dayToYm(r.day) === f.val;
        case "dow": return r.day >= 0 && dayToDate(r.day).getDay() === f.val;
        default:    return true;
      }
    })
  );
}

/** Group-count on any numeric field. */
export function ffCount(records: FfRecord[], get: (r: FfRecord) => number): Map<number, number> {
  const m = new Map<number, number>();
  records.forEach(r => {
    const k = get(r);
    m.set(k, (m.get(k) ?? 0) + 1);
  });
  return m;
}

export function ffMonthly(records: FfRecord[]): { key: string; label: string; value: number }[] {
  const m = new Map<string, number>();
  records.forEach(r => {
    if (r.day < 0) return;
    const ym = dayToYm(r.day);
    m.set(ym, (m.get(ym) ?? 0) + 1);
  });
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, value]) => ({ key, label: ymLabel(key), value }));
}

export function ffWeekday(records: FfRecord[]): { key: number; label: string; value: number }[] {
  const c = [0, 0, 0, 0, 0, 0, 0];
  records.forEach(r => { if (r.day >= 0) c[dayToDate(r.day).getDay()]++; });
  return [1, 2, 3, 4, 5, 6, 0].map(d => ({ key: d, label: DOW[d], value: c[d] }));
}

/** Conversion funnel from Opportunity Stage.
 * Stages are CURRENT statuses, not sequential events, so the funnel is
 * built as nested populations:
 *   Footfall (all visits)
 *     ⊇ In pipeline  = everyone not Closed Lost (and staged)
 *     ⊇ Progressed   = Submitted to CRM / In Progress / Inventory / Booked
 *     ⊇ Booked
 * Closed Lost and blank-stage counts are reported alongside. */
export function ffFunnel(records: FfRecord[]) {
  const idx = (name: string) => FF.STG.indexOf(name);
  const LOST = idx("Closed Lost");
  const PROGRESS = new Set([idx("Submitted to CRM"), idx("In Progress"), idx("Inventory"), idx("Booked")].filter(i => i >= 0));
  const BOOKED = idx("Booked");

  const total = records.length;
  const lost = records.filter(r => r.stg === LOST).length;
  const blank = records.filter(r => r.stg < 0).length;
  const pipeline = records.filter(r => r.stg >= 0 && r.stg !== LOST).length;
  const progressed = records.filter(r => PROGRESS.has(r.stg)).length;
  const booked = records.filter(r => r.stg === BOOKED).length;

  const steps = [
    { key: "total", label: "Footfall", value: total, hint: "every site visit in scope" },
    { key: "pipeline", label: "In pipeline", value: pipeline, hint: "not closed-lost" },
    { key: "progressed", label: "Progressed", value: progressed, hint: "CRM / in-progress / inventory / booked" },
    { key: "booked", label: "Booked", value: booked, hint: "converted to a booking" },
  ].map((s, i, arr) => ({
    ...s,
    pctOfTotal: total ? (s.value / total) * 100 : 0,
    pctOfPrev: i === 0 ? 100 : arr[i - 1].value ? (s.value / arr[i - 1].value) * 100 : 0,
  }));

  return { steps, lost, blank };
}

export function fNum(n: number): string {
  return Math.round(n).toLocaleString("en-IN");
}
