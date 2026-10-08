/** Cost & budget (SAP ZALR): budget, utilised, actual, commitment, POs. */
import { CB, PO_ROWS, WBS_ROWS, statusOf, type WbsRow } from "../../../components/cost/costShared";
import type { Ctx, Section } from "../types";
import { entLabel, fN, inPeriodDay, inr, norm, pct } from "../nlp";
import { kv, moreNote, rowsOf, sectionTitle, text, topRows } from "./common";

const ASON = CB.meta.asOn;
const OPEN = { label: "Open Cost", path: "/cost" };

const DEPT_RX: [RegExp, string][] = [
  [/\bfinance\b/, "Finance"], [/\bsecretarial\b/, "Secretarial"], [/\badmin(?:istration)?\b/, "Admin"], [/\bit (dept|department|team|expenses?|cost|spend)\b|\bi t (dept|department|team)\b|\binformation technology\b/, "IT"],
  [/\bhr\b|\bhuman resources?\b/, "HR"], [/\bmarketing\b/, "Marketing"], [/\bbrokerage\b/, "Brokerage"], [/\bcrm\b/, "CRM"], [/\blegal\b/, "Legal"],
  [/\binternal audit\b|\baudit\b/, "Internal Audit Expense"], [/\bprocurement\b|\bcontract\b/, "Contract & Procurement Expense"],
  [/\basset management\b/, "Asset Management"], [/\bpmo\b/, "PMO Expense"], [/\bdesign\b/, "Design Expense"], [/\bbd\b|\bbusiness development\b/, "BD Expense"],
  [/\bcoordination\b/, "Coordination Expense"], [/\bsales (dept|department|team|budget|expense|spend)\b/, "Sales"],
];

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
  for (const [rx, name] of DEPT_RX) {
    if (rx.test(c.nq)) { const di = CB.DEPT.indexOf(name); if (di >= 0) { rows = rows.filter(w => w.dept === di); deptLbl = name; } break; }
  }
  let typLbl = "";
  if (/\bnon ?project\b|\bopex\b|\boverheads?\b/.test(c.nq)) { rows = rows.filter(w => w.typ === 0); typLbl = "non-project"; }
  else if (/\bproject (wbs|cost|spend|budget)\b|\bconstruction\b/.test(c.nq) && !c.ents.length) { rows = rows.filter(w => w.typ === 1); typLbl = "project"; }

  const t = sumBy(rows);
  const util = t.b ? (t.u / t.b) * 100 : 0;
  const scopeLbl = [c.ents.length ? entLabel(c.ents) : "All entities", deptLbl && `${deptLbl} dept`, typLbl].filter(Boolean).join(" · ");
  const ids = new Set(rows.map(w => w.i));

  const blocks = [kv([
    ["Budget", inr(t.b)], ["Utilised (actual + commitment)", `${inr(t.u)} · ${pct(t.u, t.b)}`],
    ["  Actual spend", inr(t.a)], ["  Open commitment (POs)", inr(t.c)],
    [t.av >= 0 ? "Balance available" : "Over budget by", inr(Math.abs(t.av))], ["WBS lines", fN(rows.length)],
  ])];

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
