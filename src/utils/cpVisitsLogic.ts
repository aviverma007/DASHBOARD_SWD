/** CP gallery visits — the dedicated 31-Aug partner-visit export
 * (48,397 rows): every row is a channel-partner rep visiting a sales
 * gallery. Distinct from customer footfall. Rep names and internal
 * notes are deliberately NOT in the app dataset. */
import raw from "../data/cpGalleryVisits.json";
import { dayToDate, dayToYm, ymLabel, DOW, fNum } from "./footfallLogic";

export interface CpvDataset {
  PRJ: string[]; CPN: string[]; ASG: string[]; STA: string[]; G: string[]; VT: string[];
  epoch: string; R: number[][];
  meta: { rows: number; source: string; asOn: string; note: string };
}
export const CPV = raw as unknown as CpvDataset;

export interface CpvRec { p: number; cp: number; asg: number; sta: number; g: number; vt: number; nv: number; day: number; hr: number }
export const CPV_RECORDS: CpvRec[] = CPV.R.map(r => ({
  p: r[0], cp: r[1], asg: r[2], sta: r[3], g: r[4], vt: r[5], nv: r[6], day: r[7], hr: r[8],
}));

export type CpvDim = "p" | "cp" | "asg" | "sta" | "g" | "vt" | "mon" | "dow";
export interface CpvChip { dim: CpvDim; val: number | string; label: string }
export const CPV_DIM_NAMES: Record<CpvDim, string> = {
  p: "Project", cp: "Channel partner", asg: "Assigned RM", sta: "Status", g: "Gallery", vt: "Visit type", mon: "Month", dow: "Weekday",
};

export function cpvApply(records: CpvRec[], chips: CpvChip[]): CpvRec[] {
  return records.filter(r =>
    chips.every(c => {
      switch (c.dim) {
        case "p": return r.p === c.val;
        case "cp": return r.cp === c.val;
        case "asg": return r.asg === c.val;
        case "sta": return r.sta === c.val;
        case "g": return r.g === c.val;
        case "vt": return r.vt === c.val;
        case "mon": return r.day >= 0 && dayToYm(r.day) === c.val;
        case "dow": return r.day >= 0 && dayToDate(r.day).getDay() === c.val;
        default: return true;
      }
    })
  );
}

export function cpvMonthly(rows: CpvRec[]) {
  const m = new Map<string, number>();
  rows.forEach(r => { if (r.day >= 0) { const ym = dayToYm(r.day); m.set(ym, (m.get(ym) ?? 0) + 1); } });
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, value]) => ({ key, label: ymLabel(key), value }));
}
export function cpvWeekday(rows: CpvRec[]) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  rows.forEach(r => { if (r.day >= 0) c[dayToDate(r.day).getDay()]++; });
  return [1, 2, 3, 4, 5, 6, 0].map(d => ({ key: d, label: DOW[d], value: c[d] }));
}

/** First-ever visit day per partner over ALL data — "new partner"
 * means first appearance ever falls in the selected period. */
export function cpvFirstVisitMap(): Map<number, number> {
  const m = new Map<number, number>();
  CPV_RECORDS.forEach(r => {
    if (r.cp < 0 || r.day < 0) return;
    const cur = m.get(r.cp);
    if (cur === undefined || r.day < cur) m.set(r.cp, r.day);
  });
  return m;
}

export interface CpvInsight { k: string; v: string; hint: string }
export function cpvInsights(rows: CpvRec[], FIRST: Map<number, number>): CpvInsight[] {
  const total = rows.length || 1;
  const top = (get: (r: CpvRec) => number, names: string[]) => {
    const m = new Map<number, number>();
    rows.forEach(r => { const k = get(r); if (k >= 0) m.set(k, (m.get(k) ?? 0) + 1); });
    const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    return best ? { name: names[best[0]], n: best[1] } : null;
  };
  const out: CpvInsight[] = [];
  const tcp = top(r => r.cp, CPV.CPN);
  if (tcp) out.push({ k: "Top partner", v: tcp.name, hint: `${fNum(tcp.n)} visits · ${Math.round((tcp.n / total) * 100)}%` });
  const tp = top(r => r.p, CPV.PRJ);
  if (tp) out.push({ k: "Top project", v: `${tp.name} · ${Math.round((tp.n / total) * 100)}%`, hint: `${fNum(tp.n)} visits` });
  const tg = top(r => r.g, CPV.G);
  if (tg) out.push({ k: "Top gallery", v: `${tg.name} · ${Math.round((tg.n / total) * 100)}%`, hint: `${fNum(tg.n)} visits` });
  const ta = top(r => r.asg, CPV.ASG);
  if (ta) out.push({ k: "Top assigned RM", v: ta.name, hint: `${fNum(ta.n)} visits handled` });
  const uniq = new Set(rows.filter(r => r.cp >= 0).map(r => r.cp));
  const revisits = rows.filter(r => r.cp >= 0 && r.day >= 0 && r.day > (FIRST.get(r.cp) ?? Infinity)).length;
  out.push({ k: "Partners in selection", v: fNum(uniq.size), hint: `avg ${(total / Math.max(uniq.size, 1)).toFixed(1)} visits each` });
  out.push({ k: "Revisit share", v: `${((revisits / total) * 100).toFixed(1)}%`, hint: `${fNum(revisits)} were repeat visits` });
  const visitors = rows.filter(r => r.nv > 0);
  if (visitors.length) {
    const sum = visitors.reduce((a, r) => a + r.nv, 0);
    out.push({ k: "Group size", v: `${(sum / visitors.length).toFixed(1)} avg`, hint: `${fNum(sum)} visitors across ${fNum(visitors.length)} recorded groups` });
  }
  const mm = new Map<string, number>();
  rows.forEach(r => { if (r.day >= 0) { const ym = dayToYm(r.day); mm.set(ym, (mm.get(ym) ?? 0) + 1); } });
  const bm = [...mm.entries()].sort((a, b) => b[1] - a[1])[0];
  if (bm) out.push({ k: "Busiest month", v: `${ymLabel(bm[0])} · ${fNum(bm[1])}`, hint: "highest monthly CP visits" });
  return out;
}
