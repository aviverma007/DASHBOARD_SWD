/**
 * Direct port of the reference tool's pure JS functions. Kept as close
 * to the original as possible — same names, same logic, same order of
 * operations — so behavior matches exactly. Only adapted where the
 * original touched the DOM directly (those pieces move into the React
 * component instead).
 */
import type { RawInventoryDataset, RawUnit, ScopeCondition, FilterState } from "../types/smartworldRaw";

/** Formats a sq-ft area figure, e.g. 4.2 for large totals (in lakh sq ft)
 * or a plain comma-separated number for smaller ones. Replaces the
 * reference tool's CR() currency formatter — this app shows area, not value. */
export function fArea(a: number): string {
  if (a >= 100000) {
    return (a / 100000).toFixed(2) + " L sq ft";
  }
  return Math.round(a).toLocaleString("en-IN") + " sq ft";
}

export function pct(a: number, b: number): number {
  return b ? Math.round((a / b) * 100) : 0;
}

export function fNum(n: number): string {
  return Math.round(n).toLocaleString("en-IN");
}

// Category classification — matches isComm/catOf exactly.
const COMMERCIAL_UNIT_TYPES = new Set(["Shop", "Retail", "Restaurant", "KIOSK"]);
export const CAT = ["Residential", "Commercial"];

export function makeCatOf(RD: RawInventoryDataset) {
  const streetIndex = RD.P.indexOf("Smartworld One DXP Street");
  const isComm = (u: RawUnit) => COMMERCIAL_UNIT_TYPES.has(RD.UT[u[5]]) || u[0] === streetIndex;
  return (u: RawUnit) => (isComm(u) ? 1 : 0);
}

export function floorBand(f: number): number {
  return f <= 8 ? 0 : f <= 20 ? 1 : 2;
}
export const FB = ["Low (up to 8)", "Mid (9–20)", "High (21+)"];

export function sizeBand(a: number): number {
  return a < 1000 ? 0 : a < 1500 ? 1 : a < 2200 ? 2 : 3;
}
export const SB = ["< 1,000 sq ft", "1,000–1,500", "1,500–2,200", "2,200+ sq ft"];

export function ordinal(f: number): string {
  if (f <= 0) return "Ground";
  if (f % 1 !== 0) return Math.floor(f) + "A";
  const s = ["th", "st", "nd", "rd"];
  const v = f % 100;
  return f + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const STL = ["Available", "Booked", "Management unit"];
export const BLL = ["On hold", "In progress", "Management unit"];

/** baseUnits() — applies the top filter bar (project/status/category/config). */
export function baseUnits(
  U: RawUnit[],
  state: FilterState,
  catOf: (u: RawUnit) => number
): RawUnit[] {
  return U.filter((u) => {
    if (state.proj.size && !state.proj.has(u[0])) return false;
    if (state.status === "av" && u[8] !== 0) return false;
    if (state.status === "bk" && u[8] !== 1) return false;
    if (state.status === "blk" && u[8] !== 2) return false;
    if (state.cat !== -1 && catOf(u) !== state.cat) return false;
    if (state.cfg !== -1 && u[4] !== state.cfg) return false;
    return true;
  });
}

/** match(u,c) — a single scope condition test. */
export function match(u: RawUnit, c: ScopeCondition, catOf: (u: RawUnit) => number): boolean {
  switch (c.k) {
    case "p":
      return u[0] === c.v;
    case "tw":
      return u[1] === c.v;
    case "fl":
      return u[2] === c.v;
    case "cfg":
      return u[4] === c.v;
    case "ut":
      return u[5] === c.v;
    case "st":
      return u[8] === c.v;
    case "cat":
      return catOf(u) === c.v;
    case "fb":
      return floorBand(u[2]) === c.v;
    case "sb":
      return sizeBand(u[6]) === c.v;
    default:
      return true;
  }
}

/** scopedUnits() — baseUnits() further filtered by every condition in scope. */
export function scopedUnits(
  base: RawUnit[],
  scope: ScopeCondition[],
  catOf: (u: RawUnit) => number
): RawUnit[] {
  let a = base;
  for (const c of scope) a = a.filter((u) => match(u, c, catOf));
  return a;
}

export interface Stats {
  t: number;
  av: number;
  bk: number;
  bl: number;
  areaAv: number; // total super area of available units, sq ft
  areaBk: number; // total super area of booked units, sq ft
  areaBl: number; // total super area of management units, sq ft
}

/** stats(a) — Total/Available/Booked/Management + area available/booked/management. */
export function stats(a: RawUnit[]): Stats {
  const av = a.filter((u) => u[8] === 0);
  const bk = a.filter((u) => u[8] === 1);
  const bl = a.filter((u) => u[8] === 2);
  return {
    t: a.length,
    av: av.length,
    bk: bk.length,
    bl: bl.length,
    areaAv: av.reduce((s, u) => s + u[6], 0),
    areaBk: bk.reduce((s, u) => s + u[6], 0),
    areaBl: bl.reduce((s, u) => s + u[6], 0),
  };
}

/** showTower(pi) — whether a project has a sane number of distinct towers to show a tower ranking for. */
export function showTower(pi: number, U: RawUnit[], TW: string[]): boolean {
  const s = new Set(U.filter((u) => u[0] === pi && TW[u[1]] !== "").map((u) => u[1]));
  return s.size > 0 && s.size <= 40;
}

export interface GroupBarItem {
  k: number;
  us: RawUnit[];
  av: number;
}

/** groupBars data — groups units by keyFn, sorted most-available-first. */
export function groupByKey(arr: RawUnit[], keyFn: (u: RawUnit) => number): GroupBarItem[] {
  const g = new Map<number, RawUnit[]>();
  arr.forEach((u) => {
    const k = keyFn(u);
    const list = g.get(k) ?? [];
    list.push(u);
    g.set(k, list);
  });
  const items: GroupBarItem[] = Array.from(g.entries()).map(([k, us]) => ({
    k,
    us,
    av: us.filter((u) => u[8] === 0).length,
  }));
  return items.sort((a, b) => b.av / b.us.length - a.av / a.us.length || b.av - a.av);
}

export interface StatusBarItem {
  k: number;
  c: number;
  t: number;
}

/** statusBars data — used inside the drawer when a status (kst) scope is active. */
export function statusBarsData(
  ref: RawUnit[],
  field: (u: RawUnit) => number,
  stCode: number
): StatusBarItem[] {
  const tot = new Map<number, number>();
  const cnt = new Map<number, number>();
  ref.forEach((u) => {
    const k = field(u);
    tot.set(k, (tot.get(k) ?? 0) + 1);
    if (u[8] === stCode) cnt.set(k, (cnt.get(k) ?? 0) + 1);
  });
  const items: StatusBarItem[] = Array.from(cnt.entries()).map(([k, c]) => ({
    k,
    c,
    t: tot.get(k) ?? 0,
  }));
  return items.sort((a, b) => b.c / b.t - a.c / a.t || b.c - a.c);
}
