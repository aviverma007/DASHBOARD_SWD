import raw from "../../data/caseManagement.json";

/** Case-management dataset — dict-coded rows.
 * Row: [0 openDay, 1 closedDay, 2 sta, 3 typ, 4 pri, 5 org, 6 tat,
 *       7 area, 8 subArea, 9 prj, 10 own, 11 app, 12 ageDays,
 *       13 account, 14 caseNo, 15 hni, 16 legal, 17 reassigns]
 * Days are offsets from 2022-01-01; −1 = unknown/blank. */
export interface CmDataset {
  STA: string[]; TYP: string[]; PRI: string[]; ORG: string[]; TAT: string[];
  AREA: string[]; SUBA: string[]; PRJ: string[]; OWN: string[]; APP: string[]; TL: string[];
  R: (number | string)[][];
  meta: { rows: number; asOn: string };
}
export const CM = raw as unknown as CmDataset;

export interface CaseRec {
  open: number; closed: number; sta: number; typ: number; pri: number;
  org: number; tat: number; area: number; subArea: number; prj: number;
  own: number; app: number; age: number; account: string; caseNo: string;
  hni: number; legal: number; reassigns: number; tl: number;
}
export const CASES: CaseRec[] = CM.R.map(r => ({
  open: r[0] as number, closed: r[1] as number, sta: r[2] as number, typ: r[3] as number,
  pri: r[4] as number, org: r[5] as number, tat: r[6] as number, area: r[7] as number,
  subArea: r[8] as number, prj: r[9] as number, own: r[10] as number, app: r[11] as number,
  age: r[12] as number, account: String(r[13]), caseNo: String(r[14]),
  hni: r[15] as number, legal: r[16] as number, reassigns: r[17] as number,
  tl: (r[18] as number) ?? -1,
}));

const CLOSED_NAMES = new Set(["Closed", "Resolved", "Close"]);
const closedIdx = new Set(CM.STA.map((s, i) => (CLOSED_NAMES.has(s) ? i : -1)).filter(i => i >= 0));
/** Closed/Resolved/Close group — mirrors the CRM report's definition. */
export const isClosed = (c: CaseRec) => closedIdx.has(c.sta);

/** TAT bucket: overdue = Beyond TAT · atrisk = any escalation level · within = rest. */
export const tatBucket = (c: CaseRec): "overdue" | "atrisk" | "within" => {
  if (c.tat < 0) return "within";
  const t = CM.TAT[c.tat];
  if (t === "Beyond TAT") return "overdue";
  if (t.includes("Escalation")) return "atrisk";
  return "within";
};

export const EPOCH_MS = new Date("2022-01-01T00:00:00").getTime();
export const dayToDate = (d: number) => new Date(EPOCH_MS + d * 86400000);
export const fmtDay = (d: number) =>
  d >= 0 ? dayToDate(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—";
export const ymOf = (d: number) => {
  const dt = dayToDate(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};
export const ymLbl = (k: string) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }).replace(" ", "'");
};
export const fyOf = (d: number) => {
  const dt = dayToDate(d);
  return dt.getMonth() + 1 >= 4 ? dt.getFullYear() + 1 : dt.getFullYear();
};
export const fyLbl = (fyEnd: number) => `FY ${String(fyEnd - 1).slice(2)}-${String(fyEnd).slice(2)}`;
export const fN = (n: number) => n.toLocaleString("en-IN");

/** Reference-style ageing buckets for open cases. */
export const AGE_BANDS = [
  { k: 0, label: "0\u20132 days", lo: 0, hi: 2 },
  { k: 1, label: "3\u20137 days", lo: 3, hi: 7 },
  { k: 2, label: "8\u201315 days", lo: 8, hi: 15 },
  { k: 3, label: "16\u201330 days", lo: 16, hi: 30 },
  { k: 4, label: "31\u201360 days", lo: 31, hi: 60 },
  { k: 5, label: "60+ days", lo: 61, hi: Infinity },
];
export const ageBand = (age: number) => AGE_BANDS.find(b => age >= b.lo && age <= b.hi)?.k ?? 5;
