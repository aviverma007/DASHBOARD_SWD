/** Cost & budget (SAP ZALR): budget, utilised, actual, commitment, POs. */
import { CB, PO_ROWS, WBS_ROWS, statusOf, type WbsRow } from "../../../components/cost/costShared";
import { NP, NP_ROWS } from "../../../components/cost/NonProjectView";
import type { Ctx, Section } from "../types";
import { entLabel, fN, inPeriodDay, inr, norm, pct } from "../nlp";
import { kv, moreNote, rowsOf, sectionTitle, text, topRows } from "./common";

const ASON = CB.meta.asOn;
const OPEN = { label: "Open Cost", path: "/cost" };

/** Department phrases. `np` = how the Cost tab (Non-Project FY-26) names it (PO purchasing group);
 * `wbs` = the WBS-owner department in costBudget.json (used when the tab has no such group). */
const ASK = "(?:budgets?|expenses?|expenditure|spend|spent|costs?|utili[sz]ation|po|pos)";
const DEPTS: { rx: RegExp; label: string; np?: RegExp; wbs?: string }[] = [
  { rx: /\bfinance\b|\baccounts dept\b/, label: "Finance", np: /^finance/, wbs: "Finance" },
  { rx: /\bsecretarial\b/, label: "Secretarial", wbs: "Secretarial" },
  { rx: /\badmin(?:istration)?\b/, label: "Administration", np: /^administration/, wbs: "Admin" },
  { rx: new RegExp(`\\bit (dept|department|team|expenses?|cost|spend|budget)\\b|\\bi t (dept|department|team)\\b|\\binformation technology\\b|\\b${ASK} (?:of|for|in|on|by) (?:the )?(?:it|i t)\\b|\\b(?:it|i t) ${ASK}\\b`), label: "IT", np: /^it$/, wbs: "IT" },
  { rx: /\bhr\b|\bhuman resources?\b/, label: "HR (Operations)", np: /^hr/, wbs: "HR" },
  { rx: /\bdigital marketing\b/, label: "Digital Marketing", np: /^digital marketing/, wbs: "Marketing" },
  { rx: /\bmarketing\b/, label: "Marketing", np: /^marketing/, wbs: "Marketing" },
  { rx: /\bbrokerage\b/, label: "Brokerage", wbs: "Brokerage" },
  { rx: /\bcrm\b/, label: "CRM", np: /^crm/, wbs: "CRM" },
  { rx: /\blegal\b/, label: "Legal", wbs: "Legal" },
  { rx: /\binternal audit\b|\baudit\b/, label: "Internal Audit", np: /^internal audit/, wbs: "Internal Audit Expense" },
  { rx: /\bprocurement\b|\bcontract\b/, label: "Contract & Procurement", np: /^contract/, wbs: "Contract & Procurement Expense" },
  { rx: /\basset management\b/, label: "Asset Management", wbs: "Asset Management" },
  { rx: /\bpmo\b/, label: "PMO", wbs: "PMO Expense" },
  { rx: /\bdesign\b/, label: "Design", wbs: "Design Expense" },
  { rx: /\bbd\b|\bbusiness development\b/, label: "BD", wbs: "BD Expense" },
  { rx: /\bcoordination\b/, label: "Coordination", wbs: "Coordination Expense" },
  { rx: new RegExp(`\\bsales (dept|department|team|budget|expenses?|spend)\\b|\\b${ASK} (?:of|for|in|on|by) (?:the )?sales\\b|\\bsales ${ASK}\\b`), label: "Sales", np: /^sales$/, wbs: "Sales" },
];

/** Same maths as the Cost tab's Approved-Budget strip: budget/utilised come from the 07-Sep ZALR
 * run for the non-project WBS that appear in the filtered PO detail. */
const NP_BUDGET = (() => {
  const m = new Map<string, WbsRow>();
  WBS_ROWS.forEach(w => { if (w.typ === 0) m.set(w.wbs, w); });
  return m;
})();

const sumBy = (rows: WbsRow[]) => rows.reduce((s, w) => ({ b: s.b + w.budget, u: s.u + w.assigned, a: s.a + w.actual, c: s.c + w.commitment, av: s.av + w.available }),
  { b: 0, u: 0, a: 0, c: 0, av: 0 });

export async function runCost(c: Ctx): Promise<Section> {
  const title = sectionTitle("Budget", c, false);

  /* PO document lookup */
  const po = c.raw.match(/\b(9\d{9})\b/);
  if (po) {
    const lines = PO_ROWS.filter(p => p.docNo === po[1]);
    if (!lines.length) return { title: `PO ${po[1]}`, headline: `PO ${po[1]} is not in the cost dataset.`, blocks: [text("Check the number, or search it in the Cost tab.")], asOn: ASON, open: OPEN };
    const w = WBS_ROWS[lines[0].w];
    const ord = lines.reduce((s, l) => s + l.orderedGST, 0), del = lines.reduce((s, l) => s + l.delivered, 0);
    return {
      title: `PO ${po[1]}`,
      headline: `PO ${po[1]}: ${fN(lines.length)} line(s), ${inr(ord)} ordered (incl. GST), ${inr(del)} delivered — vendor ${CB.VEND[lines[0].vendor]}.`,
      blocks: [kv([["Vendor", CB.VEND[lines[0].vendor]], ["WBS", w.wbs], ["Plant", CB.PLANT[w.plant] ?? "—"], ["Ordered (incl. GST)", inr(ord)], ["Delivered", inr(del)], ["Lines", fN(lines.length)]]),
        rowsOf(["Item", "Ordered (incl. GST)"], lines.slice(0, 8).map(l => [l.text, inr(l.orderedGST)]))],
      asOn: ASON, open: OPEN,
    };
  }

  /* scope */
  const plantOk = new Set<number>();
  if (c.ents.length) CB.PLANT.forEach((p, i) => { const n = norm(p); if (c.ents.some(e => e.ds.test(n))) plantOk.add(i); });
  let rows = WBS_ROWS.filter(w => !c.ents.length || plantOk.has(w.plant));
  if (c.ents.length && !rows.length) {
    return { title, headline: `No budget lines found for ${entLabel(c.ents)}.`, blocks: [text("The cost dataset has no WBS/plant matching that project name.")], asOn: ASON, open: OPEN };
  }
  let deptLbl = "";
  let dep: (typeof DEPTS)[number] | null = null;
  for (const d of DEPTS) if (d.rx.test(c.nq)) { dep = d; break; }
  const wantProject = /\bproject (wbs|cost|spend|budget)\b|\bconstruction\b/.test(c.nq);

  /* Non-project department view = exactly what the Cost tab (Non-Project FY-26) shows */
  if (dep?.np && !c.ents.length && !wantProject) return runNonProject(c, dep as { label: string; np: RegExp });

  if (dep?.wbs) { const di = CB.DEPT.indexOf(dep.wbs); if (di >= 0) { rows = rows.filter(w => w.dept === di); deptLbl = dep.label; } }
  let typLbl = "";
  if (/\bnon ?project\b|\bopex\b|\boverheads?\b/.test(c.nq)) { rows = rows.filter(w => w.typ === 0); typLbl = "non-project"; }
  else if (wantProject && !c.ents.length) { rows = rows.filter(w => w.typ === 1); typLbl = "project"; }
  else if (!c.ents.length && !deptLbl) typLbl = "project + non-project";

  const t = sumBy(rows);
  const util = t.b ? (t.u / t.b) * 100 : 0;
  const scopeLbl = [c.ents.length ? entLabel(c.ents) : "All entities", deptLbl && `${deptLbl} dept`, typLbl].filter(Boolean).join(" · ");
  const ids = new Set(rows.map(w => w.i));

  const blocks = [kv([
    ["Budget", inr(t.b)], ["Utilised (actual + commitment)", `${inr(t.u)} · ${pct(t.u, t.b)}`],
    ["  Actual spend", inr(t.a)], ["  Open commitment (POs)", inr(t.c)],
    [t.av >= 0 ? "Balance available" : "Over budget by", inr(Math.abs(t.av))], ["WBS lines", fN(rows.length)],
  ])];

  if (typLbl === "project + non-project") {
    const np = sumBy(rows.filter(w => w.typ === 0)), pj = sumBy(rows.filter(w => w.typ === 1));
    blocks[0] = kv([...(blocks[0] as { t: "kv"; rows: [string, string][] }).rows,
      ["  of which non-project (opex)", `${inr(np.b)} budget · ${inr(np.u)} utilised`], ["  of which project WBS", `${inr(pj.b)} budget · ${inr(pj.u)} utilised`]]);
  }

  /* spend in a period = POs placed in it */
  if (c.period.explicit) {
    const pl = PO_ROWS.filter(p => ids.has(p.w) && inPeriodDay(c.period, p.day));
    const ord = pl.reduce((s, p) => s + p.ordered, 0), ordG = pl.reduce((s, p) => s + p.orderedGST, 0);
    blocks.push(kv([[`POs placed in ${c.period.label}`, `${fN(pl.length)} lines · ${inr(ord)} (${inr(ordG)} incl. GST)`]]));
  }

  const wantOver = /\bover ?budget\b|\boverrun\w*\b|\bexceed\w*\b|\bcritical\b|\boverspen\w*\b|\bbreach\w*\b/.test(c.nq);
  if (wantOver) {
    const bad = rows.filter(w => statusOf(w) === "critical").sort((a, b) => (b.assigned - b.budget) - (a.assigned - a.budget));
    const { shown, more } = topRows(bad, c.topN);
    blocks.push(text(`${fN(bad.length)} WBS lines are critical (utilised above 95% of budget, or spend with no budget).`));
    blocks.push(rowsOf(["WBS", "Description", "Budget", "Utilised", "Excess"], shown.map(w => [w.wbs, w.desc, inr(w.budget), inr(w.assigned), inr(w.assigned - w.budget)]), moreNote(more, "lines")));
  }

  if (/\bvendors?\b|\bsupplier\w*\b|\bparty\b/.test(c.nq)) {
    const m = new Map<number, { n: number; v: number }>();
    PO_ROWS.filter(p => ids.has(p.w) && inPeriodDay(c.period, p.day)).forEach(p => { const e = m.get(p.vendor) ?? { n: 0, v: 0 }; e.n++; e.v += p.orderedGST; m.set(p.vendor, e); });
    const list = [...m.entries()].sort((a, b) => b[1].v - a[1].v);
    const { shown, more } = topRows(list, c.topN);
    blocks.push(rowsOf(["Vendor", "PO lines", "Ordered (incl. GST)"], shown.map(([k, e]) => [CB.VEND[k], fN(e.n), inr(e.v)]), moreNote(more, "vendors")));
  }

  /* breakdowns */
  if (!wantOver) {
    const byDept = new Map<number, WbsRow[]>();
    rows.forEach(w => { if (!byDept.has(w.dept)) byDept.set(w.dept, []); byDept.get(w.dept)!.push(w); });
    if (byDept.size > 1) {
      const list = [...byDept.entries()].map(([d, ws]) => ({ d, s: sumBy(ws) })).sort((a, b) => b.s.b - a.s.b);
      const { shown, more } = topRows(list, 10);
      blocks.push(rowsOf(["Department", "Budget", "Utilised", "Used %", "Available"], shown.map(x => [CB.DEPT[x.d], inr(x.s.b), inr(x.s.u), pct(x.s.u, x.s.b, 0), inr(x.s.av)]), moreNote(more, "departments")));
    }
    if (c.ents.length || deptLbl) {
      const top = [...rows].sort((a, b) => b.budget - a.budget);
      const { shown, more } = topRows(top, c.topN);
      blocks.push(rowsOf(["Top WBS by budget", "Budget", "Utilised", "Used %"], shown.map(w => [`${w.wbs} — ${w.desc}`, inr(w.budget), inr(w.assigned), pct(w.assigned, w.budget, 0)]), moreNote(more, "lines")));
    } else {
      const byPlant = new Map<number, WbsRow[]>();
      rows.forEach(w => { if (!byPlant.has(w.plant)) byPlant.set(w.plant, []); byPlant.get(w.plant)!.push(w); });
      const list = [...byPlant.entries()].map(([p, ws]) => ({ p, s: sumBy(ws) })).sort((a, b) => b.s.b - a.s.b);
      const { shown, more } = topRows(list, 10);
      blocks.push(rowsOf(["Plant / project", "Budget", "Utilised", "Used %"], shown.map(x => [CB.PLANT[x.p] ?? "—", inr(x.s.b), inr(x.s.u), pct(x.s.u, x.s.b, 0)]), moreNote(more, "plants")));
    }
  }
  const st = { healthy: 0, watch: 0, critical: 0, nobudget: 0 };
  rows.forEach(w => st[statusOf(w)]++);
  blocks.push(text(`Status of lines: ${fN(st.healthy)} healthy (<80%), ${fN(st.watch)} watch (80–95%), ${fN(st.critical)} critical (>95%), ${fN(st.nobudget)} without budget. Utilised = SAP assigned (actual + commitment).`));

  const critN = rows.filter(w => statusOf(w) === "critical").length;
  return {
    title,
    headline: (wantOver ? `${fN(critN)} WBS lines are over 95% utilised or over budget. ` : "") + `${scopeLbl}: budget ${inr(t.b)}, utilised ${inr(t.u)} (${util.toFixed(0)}%), ${t.av >= 0 ? "balance" : "over by"} ${inr(Math.abs(t.av))}.`,
    blocks, asOn: ASON, open: OPEN,
  };
}

async function runNonProject(c: Ctx, dep: { label: string; np: RegExp }): Promise<Section> {
  const title = sectionTitle("Budget", c, false);
  const pg = new Set<number>();
  NP.PGRP.forEach((n, i) => { if (dep.np.test(norm(n))) pg.add(i); });
  const all = NP_ROWS.filter(r => pg.has(r.pgrp));
  let lines = all;
  const scope = `Non-Project · FY-26 · ${[...pg].map(i => NP.PGRP[i]).join(" + ")}`;
  if (c.period.explicit) lines = lines.filter(r => inPeriodDay(c.period, r.day));
  const codes = new Set(all.map(r => NP.WBS[r.wbs]));
  const brows = [...NP_BUDGET.entries()].filter(([code]) => codes.has(code)).map(([, w]) => w);
  const t = sumBy(brows);
  const util = t.b ? (t.u / t.b) * 100 : 0;
  const pos = new Set(lines.map(r => r.po)).size;
  const ord = lines.reduce((s, r) => s + r.ord, 0), ordG = lines.reduce((s, r) => s + r.ordGst, 0), del = lines.reduce((s, r) => s + r.del, 0);
  const crit = brows.filter(w => statusOf(w) === "critical").length;

  const blocks = [kv([
    ["Approved budget", inr(t.b)], ["Utilised (actual + commitment)", `${inr(t.u)} · ${pct(t.u, t.b)}`],
    [t.av >= 0 ? "Balance available" : "Over budget by", inr(Math.abs(t.av))],
    ["WBS elements", `${fN(brows.length)} · ${fN(crit)} critical`],
    [c.period.explicit ? `POs placed in ${c.period.label}` : "PO documents", `${fN(pos)} POs · ${fN(lines.length)} lines`],
    ["Ordered / delivered", `${inr(ord)} / ${inr(del)} (${inr(ordG)} ordered incl. GST)`],
  ])];
  const top = [...brows].sort((a, b) => b.budget - a.budget);
  const { shown, more } = topRows(top, c.topN);
  blocks.push(rowsOf(["Top WBS by budget", "Budget", "Utilised", "Used %"], shown.map(w => [`${w.wbs} — ${w.desc}`, inr(w.budget), inr(w.assigned), pct(w.assigned, w.budget, 0)]), moreNote(more, "lines")));
  if (/\bvendors?\b|\bsupplier\w*\b|\bparty\b/.test(c.nq)) {
    const m = new Map<number, { n: number; v: number }>();
    lines.forEach(r => { const e = m.get(r.vend) ?? { n: 0, v: 0 }; e.n++; e.v += r.ordGst; m.set(r.vend, e); });
    const list = [...m.entries()].sort((a, b) => b[1].v - a[1].v);
    const v = topRows(list, c.topN);
    blocks.push(rowsOf(["Vendor", "PO lines", "Ordered (incl. GST)"], v.shown.map(([k, e]) => [NP.VEND[k], fN(e.n), inr(e.v)]), moreNote(v.more, "vendors")));
  }
  blocks.push(text(`Scope: ${scope} — the same department filter and budget maths as the Cost tab. Department = the PO purchasing group; budget and utilised come from the SAP ZALR run for the non-project WBS that carry those POs. Project-WBS budgets are separate: ask "project WBS budget" or name a project.`));
  return {
    title,
    headline: `${scope}: budget ${inr(t.b)}, utilised ${inr(t.u)} (${util.toFixed(0)}%), ${t.av >= 0 ? "balance" : "over by"} ${inr(Math.abs(t.av))} across ${fN(brows.length)} WBS.`,
    blocks, asOn: NP.meta.asOn, open: OPEN,
  };
}
