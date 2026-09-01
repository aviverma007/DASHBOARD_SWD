/** Shared bookings dataset, types and helpers — used by the
 * Bookings page and its drill drawer. Single source: cpAnalytics. */
import raw from "../../data/cpAnalytics.json";
import { PDRN } from "../../utils/pdrnLogic";

export interface Bk {
  p: number; tw: number; cfg: number; area: number; tsv: number;
  y: number; m: number; unit: string; name: string; plan: string;
  broker: number;
}
export interface CpRawFile { P: string[]; TW: string[]; FL: string[]; CFG: string[]; CP: string[]; R: (number | string)[][] }
export const CPD = raw as unknown as CpRawFile;
export const BROKERS = CPD.CP;
/** Active bookings straight from the single source, WITH broker. */
export const ROWS: Bk[] = CPD.R.filter(r => r[13] === 0).map(r => ({
  p: r[0] as number, tw: r[1] as number, cfg: r[4] as number, area: r[5] as number, tsv: r[6] as number,
  y: r[7] as number, m: r[8] as number, unit: String(r[9]), name: String(r[10]), plan: String(r[11]),
  broker: r[12] as number,
}));
export const CANCELLED: Bk[] = CPD.R.filter(r => r[13] === 1).map(r => ({
  p: r[0] as number, tw: r[1] as number, cfg: r[4] as number, area: r[5] as number, tsv: r[6] as number,
  y: r[7] as number, m: r[8] as number, unit: String(r[9]), name: String(r[10]), plan: String(r[11]),
  broker: r[12] as number,
}));
export const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const fN = (n: number) => n.toLocaleString("en-IN");
export const CRf = (v: number) => `₹${(v / 1e7) >= 100 ? Math.round(v / 1e7).toLocaleString("en-IN") : (v / 1e7).toFixed(v / 1e7 >= 10 ? 1 : 2)} Cr`;
export const ymKey = (b: Bk) => `${b.y}-${String(b.m).padStart(2, "0")}`;
/** Indian FY quarter (Q1 Apr–Jun … Q4 Jan–Mar), keyed by FY end-year. */
export const qKey = (b: Bk) => { const fy = b.m >= 4 ? b.y + 1 : b.y; const q = b.m >= 4 ? Math.ceil((b.m - 3) / 3) : 4; return `${fy}-Q${q}`; };
export const fyKey = (b: Bk) => String(b.m >= 4 ? b.y + 1 : b.y);
export const ymLbl = (k: string) => { const [y, m] = k.split("-"); return `${MON[Number(m) - 1]}'${y.slice(2)}`; };
export const PSHORT = PDRN.P.map(p => p.replace(/^SMARTWORLD\s+/i, "").replace(/\b\w+/g, s => s[0] + s.slice(1).toLowerCase()));

/** Ticket-size bands, as in the reference. */
export const BANDS: { label: string; lo: number; hi: number }[] = [
  { label: "Under ₹1 Cr", lo: 0, hi: 1e7 },
  { label: "₹1–2 Cr", lo: 1e7, hi: 2e7 },
  { label: "₹2–3 Cr", lo: 2e7, hi: 3e7 },
  { label: "₹3–5 Cr", lo: 3e7, hi: 5e7 },
  { label: "₹5 Cr +", lo: 5e7, hi: Infinity },
];
export const bandOf = (b: Bk) => BANDS.findIndex(x => b.tsv >= x.lo && b.tsv < x.hi);

export type Dim = "p" | "cfg" | "tw" | "band" | "mon";
export interface Chip { dim: Dim; val: number | string; label: string }
export const DIMN: Record<Dim, string> = { p: "Project", cfg: "Config", tw: "Tower", band: "Ticket band", mon: "Month" };

