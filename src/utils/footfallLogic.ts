/** Footfall analytics over the Customer Site Visit export
 * (Footfall_data_till_21_aug.xlsx · 54,222 records).
 * Mirrors the reference suite's customer-footfall page: dimensional
 * counting with click-to-filter, monthly trend, weekday pattern —
 * plus a conversion funnel built from Opportunity Stage. */
import raw from "../data/footfallVisits.json";

export interface FfRecord {
  g: number;    // gallery idx
  p: number;    // project idx
  src: number;  // 0 Direct · 1 Channel Partner · 2 Direct Loyalty · 3 Digital · -1 blank
  cp: number;   // channel partner idx (-1 none)
  stg: number;  // stage idx (-1 blank)
  loc: number;  // locality idx
  age: number;  // age band idx
  cat: number;  // category idx
  day: number;  // days since 2022-01-01 (-1 unknown)
  /** CRM opportunity number, e.g. SF-00077911 */
  opp: string;
}

interface FfDataset {
  G: string[]; P: string[]; CPN: string[]; LOC: string[];
  AGE: string[]; STG: string[]; CAT: string[]; SRC: string[];
  epoch: string; R: (number | string)[][];
  meta: { rows: number; source: string; asOn: string };
}

export const FF = raw as unknown as FfDataset;

export const FF_RECORDS: FfRecord[] = FF.R.map(r => ({
  g: r[0] as number, p: r[1] as number, src: r[2] as number, cp: r[3] as number, stg: r[4] as number, loc: r[5] as number, age: r[6] as number, cat: r[7] as number, day: r[8] as number, opp: (r[9] as string) ?? "",
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
export type FfDim = "g" | "p" | "src" | "loc" | "age" | "mon" | "dow" | "stg" | "cat" | "cp";

/** Apply filters to any record subset (drawers stack on page scope). */
export function ffApply(records: FfRecord[], filters: FfFilter[]): FfRecord[] {
  return records.filter(r =>
    filters.every(f => {
      switch (f.dim) {
        case "g":   return r.g === f.val;
        case "p":   return r.p === f.val;
        case "src": return r.src === f.val;
        case "loc": return r.loc === f.val;
        case "age": return r.age === f.val;
        case "stg": return r.stg === f.val;
        case "cat": return r.cat === f.val;
        case "cp":  return r.cp === f.val;
        case "mon": return r.day >= 0 && dayToYm(r.day) === f.val;
        case "dow": return r.day >= 0 && dayToDate(r.day).getDay() === f.val;
        default:    return true;
      }
    })
  );
}

export function ffScope(filters: FfFilter[]): FfRecord[] {
  return ffApply(FF_RECORDS, filters);
}

/** "Key insights for this selection" — reference-style tiles, each
 * with the share maths spelled out. */
export interface FfInsight { k: string; v: string; hint: string }
export function ffInsights(rows: FfRecord[]): FfInsight[] {
  const total = rows.length || 1;
  const top = (get: (r: FfRecord) => number, names: string[]) => {
    const m = new Map<number, number>();
    rows.forEach(r => { const k = get(r); if (k >= 0) m.set(k, (m.get(k) ?? 0) + 1); });
    const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    return best ? { name: names[best[0]], n: best[1] } : null;
  };
  const out: FfInsight[] = [];
  const tp = top(r => r.p, FF.P);
  if (tp) out.push({ k: "Top project/campaign", v: `${tp.name} · ${Math.round((tp.n / total) * 100)}%`, hint: `${fNum(tp.n)} of ${fNum(total)} visits` });
  const direct = rows.filter(r => r.src === 0 || r.src === 2).length;
  const viaCp = rows.filter(r => r.src === 1).length;
  const digital = rows.filter(r => r.src === 3).length;
  out.push({
    k: "Walk-in source",
    v: `Direct ${Math.round((direct / total) * 100)}% · CP ${Math.round((viaCp / total) * 100)}%${digital ? ` · Digital ${Math.round((digital / total) * 100)}%` : ""}`,
    hint: `${fNum(direct)} direct · ${fNum(viaCp)} via partners${digital ? ` · ${fNum(digital)} digital` : ""}`,
  });
  const tl = top(r => r.loc, FF.LOC);
  if (tl) out.push({ k: "Top locality", v: `${tl.name} · ${Math.round((tl.n / total) * 100)}%`, hint: `${fNum(tl.n)} visitors` });
  const ta = top(r => r.age, FF.AGE);
  if (ta) out.push({ k: "Dominant age band", v: `${ta.name} · ${Math.round((ta.n / total) * 100)}%`, hint: `${fNum(ta.n)} of captured ages` });
  const mm = new Map<string, number>();
  rows.forEach(r => { if (r.day >= 0) { const ym = dayToYm(r.day); mm.set(ym, (mm.get(ym) ?? 0) + 1); } });
  const bm = [...mm.entries()].sort((a, b) => b[1] - a[1])[0];
  if (bm) out.push({ k: "Busiest month", v: `${ymLabel(bm[0])} · ${fNum(bm[1])}`, hint: "highest monthly footfall" });
  const BK = FF.STG.indexOf("Booked");
  const booked = rows.filter(r => r.stg === BK).length;
  out.push({ k: "Booking outcome", v: `${fNum(booked)} booked · ${((booked / total) * 100).toFixed(1)}%`, hint: "share of visits now at Booked stage" });
  const tcp = top(r => (r.src === 1 ? r.cp : -1), FF.CPN);
  if (tcp) out.push({ k: "Top channel partner", v: tcp.name, hint: `${fNum(tcp.n)} visits brought` });
  return out;
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

/** Quarter key for a day offset, e.g. "2026-Q3". */
export function dayToQuarter(day: number): string {
  const d = dayToDate(day);
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}
export function quarterLabel(q: string): string {
  const [y, qq] = q.split("-");
  return `${qq} '${y.slice(2)}`;
}
export function dayToYear(day: number): string {
  return String(dayToDate(day).getFullYear());
}

/** Distinct quarters / years present in the data, ascending. */
export function periodKeys(records: FfRecord[], mode: "quarter" | "year"): string[] {
  const s = new Set<string>();
  records.forEach(r => { if (r.day >= 0) s.add(mode === "quarter" ? dayToQuarter(r.day) : dayToYear(r.day)); });
  // Future-dated rows exist (scheduled site visits) but a period that
  // hasn't begun yet is meaningless for momentum comparison — cap the
  // options at today's quarter/year.
  const cur = mode === "quarter" ? dayToQuarter(todayDay()) : dayToYear(todayDay());
  return [...s].sort().filter(k => k <= cur);
}

export function inPeriod(r: FfRecord, mode: "quarter" | "year", key: string): boolean {
  if (r.day < 0) return false;
  return (mode === "quarter" ? dayToQuarter(r.day) : dayToYear(r.day)) === key;
}

/** Global period presets (day-offset bounds, inclusive). */
export interface PeriodPreset { key: string; label: string; from: number; to: number }
export function periodPresets(): PeriodPreset[] {
  const today = Math.floor((Date.now() - new Date(FF.epoch + "T00:00:00").getTime()) / 86400000);
  const dayOf = (iso: string) => Math.floor((new Date(iso + "T00:00:00").getTime() - new Date(FF.epoch + "T00:00:00").getTime()) / 86400000);
  return [
    { key: "all", label: "All time", from: -1, to: 1e9 },
    { key: "30d", label: "Last 30 days", from: today - 29, to: today },
    { key: "90d", label: "Last 90 days", from: today - 89, to: today },
    { key: "12m", label: "Last 12 months", from: today - 364, to: today },
    { key: "cy26", label: "CY 2026", from: dayOf("2026-01-01"), to: dayOf("2026-12-31") },
    { key: "cy25", label: "CY 2025", from: dayOf("2025-01-01"), to: dayOf("2025-12-31") },
    { key: "fy26", label: "FY 25-26", from: dayOf("2025-04-01"), to: dayOf("2026-03-31") },
    { key: "fy27", label: "FY 26-27", from: dayOf("2026-04-01"), to: dayOf("2027-03-31") },
  ];
}

/** ISO date (yyyy-mm-dd) → day offset from the dataset epoch. */
/** Day offset of "today" — used to hide not-yet-begun periods. */
export function todayDay(): number {
  const t = new Date();
  return isoToDay(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`);
}

export function isoToDay(iso: string): number {
  return Math.floor((new Date(iso + "T00:00:00").getTime() - new Date(FF.epoch + "T00:00:00").getTime()) / 86400000);
}

export function fNum(n: number): string {
  return Math.round(n).toLocaleString("en-IN");
}
