import type { TvDept, TvDeptDef } from "../types";
import { DATA_AS_ON } from "../../config/dataInfo";
import { fN, inrCr, pct, pctN } from "../../mobile/fmt";

/** C&P — Cost & Budget and PO-linked WBS utilisation (same aggregation as mobile Cost.tsx). */
async function load(): Promise<TvDept> {
  const { CB, WBS_ROWS, statusOf } = await import("../../components/cost/costShared");

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

  const critShare = WBS_ROWS.length ? (health.critical / WBS_ROWS.length) * 100 : 0;

  return {
    id: "cp", name: "C&P — Cost & Budget", tagline: "Budget utilisation and WBS health",
    asOn: DATA_AS_ON,
    kpis: [
      { id: "budget", label: "Approved budget", value: s.budget, format: v => inrCr(v), sub: `${fN(WBS_ROWS.length)} WBS elements`, tone: "navy" },
      { id: "assigned", label: "Budget utilised", value: s.assigned, format: v => inrCr(v), sub: "actual + commitment", tone: "teal" },
      { id: "util", label: "Utilisation", value: util, format: v => `${v.toFixed(1)}%`, sub: `${inrCr(s.available)} still available`, tone: "amber" },
      { id: "crit", label: "Critical WBS", value: health.critical, format: fN, sub: `${critShare.toFixed(0)}% of WBS above 95% used`, tone: "red" },
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
    ],
  };
}

export const cp: TvDeptDef = { id: "cp", name: "C&P — Cost & Budget", tagline: "Budget utilisation and WBS health", pages: "Cost & Budget · POs", icon: "Wallet", tone: "amber", load };
