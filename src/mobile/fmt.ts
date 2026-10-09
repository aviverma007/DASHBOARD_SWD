/** Number formatting for the phone UI (Indian grouping, ₹ Cr/L). */
export const fN = (n: number) => Math.round(n).toLocaleString("en-IN");

/** rupees → "₹11,795 Cr" */
export function inrCr(rupees: number, dp = 1): string {
  const cr = rupees / 1e7;
  const a = Math.abs(cr);
  if (a >= 100) return `₹${fN(cr)} Cr`;
  if (a >= 1) return `₹${cr.toFixed(dp)} Cr`;
  if (a >= 0.01) return `₹${(rupees / 1e5).toFixed(1)} L`;
  return `₹${fN(rupees)}`;
}
/** value already in crore */
export const cr = (v: number, dp = 1) => inrCr(v * 1e7, dp);

/** axis-friendly: 11795 → "11.8k", 1250000 → "12.5L" */
export function short(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e7) return `${(n / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`;
  if (a >= 1e5) return `${(n / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return String(Math.round(n));
}
export const sqftL = (a: number) => (a >= 1e5 ? `${(a / 1e5).toFixed(2)} L sq ft` : `${fN(a)} sq ft`);
export const pct = (a: number, b: number, dp = 0) => (b > 0 ? `${((a / b) * 100).toFixed(dp)}%` : "0%");
export const pctN = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
export const initials = (s: string) =>
  s.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "U";
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortName = (p: string) =>
  p.replace(/^smart ?world\s*/i, "").replace(/^the\s+/i, "").replace(/\s+/g, " ").trim() || p;
