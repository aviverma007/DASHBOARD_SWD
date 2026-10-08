/** CRM case management: tickets, complaints, TAT. */
import { CM, CASES, isClosed, tatBucket, dayToDate } from "../../../components/cases/caseShared";
import type { Block, Ctx, Section } from "../types";
import { barBlock, kv, noProject, rowsOf, sectionTitle } from "./common";
import { dayNum, entLabel, fN, idxsFor, inPeriodDay, pct, comparePeriod, delta } from "../nlp";

const OPEN = { label: "Open Case Management", path: "/case-management" };
function top(names: string[], rows: { [k: string]: number }[], key: string, total: number, n = 6): Block {
  const m = new Map<number, number>();
  rows.forEach(r => { const k = r[key]; if (k >= 0) m.set(k, (m.get(k) ?? 0) + 1); });
  const list = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return barBlock("", list.map(([k, v]) => ({ label: names[k] ?? "—", value: v, text: `${fN(v)} · ${pct(v, total, 0)}` })));
}

export async function runCases(c: Ctx): Promise<Section> {
  const title = sectionTitle("Cases", c);
  const pIdx = idxsFor(CM.PRJ, c.ents);
  if (pIdx && pIdx.size === 0) return noProject(title, c, "Case Management", "/case-management", CM.meta.asOn);

  const typIdx = (rx: RegExp) => CM.TYP.findIndex(t => rx.test(t.toLowerCase()));
  let typ = -1, typLbl = "";
  if (/\bcomplaints?\b/.test(c.nq)) { typ = typIdx(/complaint/); typLbl = "complaints"; }
  else if (/\bqueries|query\b/.test(c.nq)) { typ = typIdx(/query/); typLbl = "queries"; }
  else if (/\bspam\b/.test(c.nq)) { typ = typIdx(/spam/); typLbl = "spam"; }
  const priIdx = /\bhigh priority\b|\bhigh\b/.test(c.nq) ? CM.PRI.indexOf("High") : /\blow priority\b/.test(c.nq) ? CM.PRI.indexOf("Low") : /\bmedium priority\b/.test(c.nq) ? CM.PRI.indexOf("Medium") : -1;

  const base = CASES.filter(x => (!pIdx || pIdx.has(x.prj)) && (typ < 0 || x.typ === typ) && (priIdx < 0 || x.pri === priIdx) &&
    (!/\bhni\b/.test(c.nq) || x.hni === 1) && (!/\blegal\b/.test(c.nq) || x.legal === 1));
  const inP = (x: (typeof CASES)[number], p = c.period) => (p.kind === "all" ? true : inPeriodDay(p, x.open));
  const opened = base.filter(x => inP(x));
  const open = opened.filter(x => !isClosed(x));
  const closedN = opened.length - open.length;
  const overdue = open.filter(x => tatBucket(x) === "overdue");
  const atRisk = open.filter(x => tatBucket(x) === "atrisk");
  const asOnDay = dayNum(new Date(CM.meta.asOn));
  const ages = open.map(x => (x.age > 0 ? x.age : x.open >= 0 ? Math.max(0, asOnDay - x.open) : 0));
  const avgAge = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;
  const prev = comparePeriod(c);
  const pr = prev ? base.filter(x => inP(x, prev)).length : null;

  const blocks: Block[] = [kv([
    [`${typLbl ? typLbl[0].toUpperCase() + typLbl.slice(1) : "Cases"} raised`, fN(opened.length)],
    ["Still open", `${fN(open.length)} (${pct(open.length, opened.length, 0)})`], ["Closed / resolved", fN(closedN)],
    ["Beyond TAT", fN(overdue.length)], ["At risk (escalated)", fN(atRisk.length)],
    ["Average age of open cases", open.length ? `${fN(avgAge)} days` : "—"],
    ...(pr !== null ? [[`vs ${prev!.label}`, `${fN(pr)} → ${delta(opened.length, pr)}`] as [string, string]] : []),
  ])];
  const ref = opened as unknown as { [k: string]: number }[];
  const b1 = top(CM.TYP, ref, "typ", opened.length, 4); if (b1.t === "bars") b1.title = "By type"; blocks.push(b1);
  if (!c.ents.length || c.cue.byProject) { const b = top(CM.PRJ, ref, "prj", opened.length, 8); if (b.t === "bars") b.title = "By project"; blocks.push(b); }
  const b2 = top(CM.PRI, ref, "pri", opened.length, 3); if (b2.t === "bars") b2.title = "By priority"; blocks.push(b2);
  if (/\b(area|reason|category|issue|subject)\b/.test(c.nq)) { const b = top(CM.AREA, ref, "area", opened.length, 8); if (b.t === "bars") b.title = "Top areas"; blocks.push(b); }
  if (/\b(origin|channel|source|via)\b/.test(c.nq)) { const b = top(CM.ORG, ref, "org", opened.length, 8); if (b.t === "bars") b.title = "By origin"; blocks.push(b); }
  if (c.cue.byMonth) {
    const m = new Map<string, number>();
    opened.forEach(x => { if (x.open >= 0) { const d = dayToDate(x.open); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; m.set(k, (m.get(k) ?? 0) + 1); } });
    blocks.push(rowsOf(["Month", "Cases raised"], [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([k, v]) => [k, fN(v)])));
  }
  return {
    title,
    headline: `${c.ents.length ? entLabel(c.ents) : "All projects"}${c.period.explicit ? " · " + c.period.label : ""}: ${fN(opened.length)} ${typLbl || "cases"} raised, ${fN(open.length)} still open, ${fN(overdue.length)} beyond TAT.`,
    blocks, asOn: CM.meta.asOn, open: OPEN,
  };
}
