import raw from "../../data/vendorAgeing.json";
import { fN, fMoney, EPOCH_MS } from "./costShared";

/** Vendor ageing (SAP FBL1N-style open items, as on 09 Sep 2026).
 * L row: [0 vend, 1 recon, 2 dtyp, 3 spgl, 4 amount, 5 bucket 0-6,
 *         6 dueDay, 7 docNo, 8 blocked, 9 docDay, 10 postDay]
 * (day fields are offsets from 2022-01-01; -1 = unknown) */
export interface VaDataset {
  VEND: string[]; RECON: string[]; DTYP: string[]; SPGL: string[]; BUCKET: string[];
  L: (number | string)[][];
  meta: { asOn: string; vendors: number; lines: number };
}
export const VA = raw as unknown as VaDataset;

export interface VaRow {
  i: number; vend: number; recon: number; dtyp: number; spgl: number;
  amt: number; bucket: number; due: number; doc: string; blocked: number;
  docDay: number; postDay: number;
}
export const VA_ROWS: VaRow[] = VA.L.map((r, i) => ({
  i, vend: r[0] as number, recon: r[1] as number, dtyp: r[2] as number, spgl: r[3] as number,
  amt: r[4] as number, bucket: r[5] as number, due: r[6] as number,
  doc: String(r[7]), blocked: r[8] as number,
  docDay: (r[9] as number) ?? -1, postDay: (r[10] as number) ?? -1,
}));

/** Bucket palette — green (not due) → deep red (>180). */
export const BUCKET_COLS = ["#1BAF7A", "#0E7490", "#B8893C", "#EDA100", "#E07B39", "#C0392B", "#8B1E12"];

/** Exact date, e.g. "17 Mar 2025". */
export const fmtDay = (d: number) =>
  d >= 0 ? new Date(EPOCH_MS + d * 86400000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtDue = fmtDay;

export { fN, fMoney };
