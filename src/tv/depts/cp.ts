import type { TvDept, TvDeptDef } from "../types";
import { DATA_AS_ON } from "../../config/dataInfo";
import { fN, inrCr, pct, pctN } from "../../mobile/fmt";

/** C&P — Cost & Budget, PO-linked WBS utilisation and vendor ageing.
 *  Same aggregation as mobile Cost.tsx and the VendorAgeingView on the desktop Cost page. */
async function load(): Promise<TvDept> {
  const [{ CB, WBS_ROWS, statusOf }, { VA, VA_ROWS }] = await Promise.all([
    import("../../components/cost/costShared"),
    import("../../components/cost/vendorAgeingShared"),
  ]);

  /* ---------- Cost & budget (all WBS) ---------- */
  const s = { budget: 0, assigned: 0, actual: 0, commitment: 0, available: 0 };
  WBS_ROWS.forEach(w => { s.budget += w.budget; s.assigned += w.assigned; s.actual += w.actual; s.commitment += w.commitment; s.available += w.available; });
  const util = pctN(s.assigned, s.budget);
  const health = { healthy: 0, watch: 0, critical: 0, nobudget: 0 };
  WBS_ROWS.forEach(w => { health[statusOf(w)]++; });

  const byDept = (() => {
    const m = new Map<number, { b: number; a: number }>();
    WBS_ROWS.forEach(w => { const e = m.get(w.dept) ?? { b: 0, a: 0 }; e.b += w.budget; e.a += w.assigned; m.set(w.dept, e); });
    return [...m.entries()].sort((x, y) => y[1].b - x[1].b).slice(0, 6);
  })();

  /* ---------- Vendor ageing ---------- */
  const total = VA_ROWS.reduce((x, r) => x + r.amt, 0);
  const byBucket = new Map<number, { v: number; n: number }>();
  VA_ROWS.forEach(r => { const e = byBucket.get(r.bucket) ?? { v: 0, n: 0 }; e.v += r.amt; e.n++; byBucket.set(r.bucket, e); });
  const over180 = byBucket.get(6)?.v ?? 0;
  const vendors = new Set(VA_ROWS.map(r => r.vend)).size;
  const byVend = (() => {
    const m = new Map<number, { v: number; o: number; n: number }>();
    VA_ROWS.forEach(r => { const e = m.get(r.vend) ?? { v: 0, o: 0, n: 0 }; e.v += r.amt; if (r.bucket === 6) e.o += r.amt; e.n++; m.set(r.vend, e); });
    return [...m.entries()];
  })();
  const topOld = byVend.filter(([, e]) => e.o > 0).sort((a, b) => b[1].o - a[1].o).slice(0, 6);
  const vname = (i: number) => (VA.VEND[i] || "Vendor").replace(/\s+/g, " ").slice(0, 26);
  const buckets = VA.BUCKET.map((label, i) => ({ label, value: Math.max(byBucket.get(i)?.v ?? 0, 0) }));
  const critShare = WBS_ROWS.length ? (health.critical / WBS_ROWS.length) * 100 : 0;

  return {
    id: "cp", name: "C&P — Cost & Budget", tagline: "Budget utilisation, WBS health and vendor payables ageing",
    asOn: DATA_AS_ON,
    kpis: [
      { id: "budget", label: "Approved budget", value: s.budget, format: v => inrCr(v), sub: `${fN(WBS_ROWS.length)} WBS elements`, tone: "navy" },
      { id: "assigned", label: "Budget utilised", value: s.assigned, format: v => inrCr(v), sub: "actual + commitment", tone: "teal" },
      { id: "util", label: "Utilisation", value: util, format: v => `${v.toFixed(1)}%`, sub: `${inrCr(s.available)} still available`, tone: "amber" },
      { id: "crit", label: "Critical WBS", value: health.critical, format: fN, sub: `${critShare.toFixed(0)}% of WBS above 95% used`, tone: "red" },
      { id: "vatot", label: "Vendor payables", value: total, format: v => inrCr(v), sub: `${fN(vendors)} vendors · ${fN(VA_ROWS.length)} open items`, tone: "violet" },
      { id: "va180", label: "Overdue > 180 d", value: over180, format: v => inrCr(v), sub: `${pct(over180, total)} of payables · ageing as on ${VA.meta.asOn}`, tone: "gold" },
    ],
    stories: [
      { focus: "util", headline: `${util.toFixed(0)}% of the approved budget is already utilised`,
        visual: { type: "ring", title: "Budget utilised", pct: util, label: "utilised", sub: `${inrCr(s.assigned)} of ${inrCr(s.budget)}` } },
      { focus: "budget", headline: byDept.length ? `${CB.DEPT[byDept[0][0]] || "Top department"} holds the largest budget, ${inrCr(byDept[0][1].b)}` : "No budget data available",
        visual: { type: "hbars", title: "Approved budget by department", rows: byDept.map(([d, e]) => ({ label: (CB.DEPT[d] || "—").slice(0, 26), value: e.b, sub: `${pct(e.a, e.b)} utilised · ${inrCr(e.a)}` })), format: v => inrCr(v) } },
      { focus: "assigned", headline: `${pct(s.commitment, s.assigned)} of utilised budget is PO commitment, not yet spent`,
        visual: { type: "donut", title: "Budget: actual, committed, available", parts: [
          { label: "Actual", value: Math.max(s.actual, 0), color: "#6d4aa6" },
          { label: "Commitment", value: Math.max(s.commitment, 0), color: "#e6a100" },
          { label: "Available", value: Math.max(s.available, 0), color: "#16a06f" },
        ], centre: { value: inrCr(s.budget, 0), label: "budget" }, format: v => inrCr(v) } },
      { focus: "crit", headline: `${fN(health.critical)} of ${fN(WBS_ROWS.length)} WBS elements are over 95% of budget`,
        visual: { type: "donut", title: "WBS budget health", parts: [
          { label: "Healthy", value: health.healthy, color: "#16a06f" },
          { label: "Watch", value: health.watch, color: "#e6a100" },
          { label: "Critical", value: health.critical, color: "#d64545" },
          { label: "No budget", value: health.nobudget, color: "#8d99ae" },
        ], centre: { value: fN(WBS_ROWS.length), label: "WBS" }, format: fN } },
      { focus: "vatot", headline: `${inrCr(total)} is open with ${fN(vendors)} vendors`,
        visual: { type: "columns", title: "Vendor payables by ageing bucket", data: buckets, format: v => inrCr(v) } },
      { focus: "va180", headline: topOld.length ? `${pct(over180, total)} of payables are over 180 days — led by ${vname(topOld[0][0])}` : "No vendor payables are over 180 days",
        visual: { type: "hbars", title: "Vendors with the most overdue > 180 d", rows: topOld.map(([v, e]) => ({ label: vname(v), value: e.o, sub: `${fN(e.n)} open items` })), format: v => inrCr(v) } },
    ],
  };
}

export const cp: TvDeptDef = { id: "cp", name: "C&P — Cost & Budget", tagline: "Budget utilisation, WBS health and vendor ageing", pages: "Cost & Budget · POs · Vendor ageing", icon: "Wallet", tone: "amber", load };
