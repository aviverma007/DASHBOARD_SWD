import raw from "../../data/costBudget.json";

/** Cost / budget-control dataset (SAP ZALR non-project).
 * W row: [0 dept, 1 projCode, 2 wbs, 3 desc, 4 budget, 5 assigned(=Utilized),
 *         6 actual, 7 commitment, 8 available, 9 pgrp, 10 type(0 non-project/1 project), 11 plant]
 * P row: [0 wIdx, 1 day, 2 vendor, 3 ordered, 4 orderedGST, 5 delivered,
 *         6 docNo, 7 glDesc, 8 shortText, 9 type]  — day offset from 2022-01-01. */
export interface CostDataset {
  DEPT: string[]; PGRP: string[]; VEND: string[]; GL: string[]; PLANT: string[];
  W: (number | string)[][]; P: (number | string)[][];
  meta: { wbs: number; poLines: number; asOn: string; note: string };
}
export const CB = raw as unknown as CostDataset;

export interface WbsRow {
  i: number; dept: number; proj: string; wbs: string; desc: string;
  budget: number; assigned: number; actual: number; commitment: number; available: number; pgrp: number;
  /** 0 = non-project opex · 1 = project WBS (merged ZALR) */
  typ: number;
  plant: number;
}
export const WBS_ROWS: WbsRow[] = CB.W.map((w, i) => ({
  i, dept: w[0] as number, proj: String(w[1]), wbs: String(w[2]), desc: String(w[3]),
  budget: w[4] as number, assigned: w[5] as number, actual: w[6] as number,
  commitment: w[7] as number, available: w[8] as number, pgrp: w[9] as number,
  typ: (w[10] as number) ?? 0, plant: (w[11] as number) ?? -1,
}));

export interface PoRow {
  w: number; day: number; vendor: number; ordered: number; orderedGST: number;
  delivered: number; docNo: string; gl: number; text: string; typ: number;
}
export const PO_ROWS: PoRow[] = CB.P.map(p => ({
  w: p[0] as number, day: p[1] as number, vendor: p[2] as number,
  ordered: p[3] as number, orderedGST: p[4] as number, delivered: p[5] as number,
  docNo: String(p[6]), gl: p[7] as number, text: String(p[8]), typ: (p[9] as number) ?? 0,
}));

/** Utilization status thresholds — same as the reference dashboard. */
export const statusOf = (w: WbsRow): "healthy" | "watch" | "critical" | "nobudget" => {
  if (w.budget <= 0) return w.assigned > 0 ? "critical" : "nobudget";
  const pct = (w.assigned / w.budget) * 100;
  return pct > 95 ? "critical" : pct > 80 ? "watch" : "healthy";
};
export const STATUS_LBL = { healthy: "Healthy (<80%)", watch: "Watch (80–95%)", critical: "Critical (>95%)", nobudget: "No budget" } as const;

export const EPOCH_MS = new Date("2022-01-01T00:00:00").getTime();
export const dayToDate = (d: number) => new Date(EPOCH_MS + d * 86400000);
export const fmtDay = (d: number) =>
  d >= 0 ? dayToDate(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—";
export const ymOf = (d: number) => { const t = dayToDate(d); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`; };
export const ymLbl = (k: string) => { const [y, m] = k.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }).replace(" ", "'"); };
export const fN = (n: number) => Math.round(n).toLocaleString("en-IN");
/** ₹ formatter: Cr for big, L for mid, plain for small. */
export const fMoney = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
};

export const TYPE_LBL = ["Non-project", "Project"] as const;

/** Dominant plant per project code, for "PROJ — Plant" labels. */
const projPlant = new Map<string, number>();
{
  const cnt = new Map<string, Map<number, number>>();
  WBS_ROWS.forEach(w => {
    if (!cnt.has(w.proj)) cnt.set(w.proj, new Map());
    const m = cnt.get(w.proj)!;
    m.set(w.plant, (m.get(w.plant) ?? 0) + 1);
  });
  cnt.forEach((m, p) => {
    let best = -1, bn = -1;
    m.forEach((n, k) => { if (n > bn) { bn = n; best = k; } });
    projPlant.set(p, best);
  });
}
export const projLbl = (proj: string) => {
  const pl = projPlant.get(proj) ?? -1;
  return pl >= 0 ? `${proj} — ${CB.PLANT[pl]}` : proj;
};
