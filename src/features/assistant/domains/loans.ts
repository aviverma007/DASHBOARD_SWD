/** Loan details: bank files, sanctions, disbursements. */
import raw from "../../../data/loanData.json";
import type { Ctx, Section } from "../types";
import { entLabel, fN, idxsFor, inPeriodDay, inr, norm, pct } from "../nlp";
import { kv, moreNote, noProject, rowsOf, sectionTitle, topRows } from "./common";

const D = raw as unknown as { meta: { asOn: string }; PROJECTS: string[]; BANKS: string[]; L: (number | string)[][] };
const ASON = D.meta.asOn;
const BSTOP = new Set("bank limited ltd finance housing home of india the and company corporation".split(" "));

export async function runLoans(c: Ctx): Promise<Section> {
  const title = sectionTitle("Home loans", c);
  const pIdx = idxsFor(D.PROJECTS, c.ents);
  if (pIdx && pIdx.size === 0) return noProject(title, c, "Loan Details", "/loan-details", ASON);

  /* bank named in the question? */
  const toks = c.nq.split(" ").filter(t => t.length >= 3 && !BSTOP.has(t));
  let bankSet: Set<number> | null = null, bankLbl = "";
  const bhits = D.BANKS.map((b, i) => ({ i, s: toks.filter(t => norm(b).split(" ").includes(t)).length })).filter(x => x.s > 0);
  if (bhits.length) { const best = Math.max(...bhits.map(x => x.s)); bankSet = new Set(bhits.filter(x => x.s === best).map(x => x.i)); bankLbl = [...bankSet].map(i => D.BANKS[i]).join(" / "); }

  const rows = D.L.filter(r =>
    (!pIdx || pIdx.has(r[0] as number)) && (!bankSet || bankSet.has(r[10] as number)) &&
    (c.period.kind === "all" || inPeriodDay(c.period, (r[15] as number) >= 0 ? (r[15] as number) : (r[13] as number))));
  const sanc = rows.reduce((s, r) => s + (r[14] as number), 0);
  const disb = rows.reduce((s, r) => s + (r[16] as number), 0);
  const bal = rows.reduce((s, r) => s + (r[18] as number), 0);
  const cost = rows.reduce((s, r) => s + (r[9] as number), 0);
  const withSanc = rows.filter(r => (r[14] as number) > 0).length;

  const blocks = [kv([
    ["Loan cases", fN(rows.length)], ["With sanction", fN(withSanc)], ["Sanctioned amount", inr(sanc)],
    ["Disbursed", `${inr(disb)} · ${pct(disb, sanc, 0)} of sanction`], ["Balance to disburse", inr(bal)], ["Property value of these units", inr(cost)],
  ])];
  if (!bankSet) {
    const m = new Map<number, { n: number; s: number; d: number }>();
    rows.forEach(r => { const b = r[10] as number; if (b < 0) return; const e = m.get(b) ?? { n: 0, s: 0, d: 0 }; e.n++; e.s += r[14] as number; e.d += r[16] as number; m.set(b, e); });
    const list = [...m.entries()].sort((a, b) => (c.cue.low ? a[1].s - b[1].s : b[1].s - a[1].s));
    const { shown, more } = topRows(list, c.topN > 5 ? c.topN : 8);
    blocks.push(rowsOf(["Bank", "Cases", "Sanctioned", "Disbursed"], shown.map(([k, e]) => [D.BANKS[k], fN(e.n), inr(e.s), inr(e.d)]), moreNote(more, "banks")));
  }
  if (!c.ents.length || c.cue.byProject) {
    const m = new Map<number, { n: number; s: number; d: number }>();
    rows.forEach(r => { const p = r[0] as number; const e = m.get(p) ?? { n: 0, s: 0, d: 0 }; e.n++; e.s += r[14] as number; e.d += r[16] as number; m.set(p, e); });
    blocks.push(rowsOf(["Project", "Cases", "Sanctioned", "Disbursed"], [...m.entries()].sort((a, b) => b[1].s - a[1].s).map(([k, e]) => [D.PROJECTS[k], fN(e.n), inr(e.s), inr(e.d)])));
  }
  return {
    title,
    headline: `${bankLbl || (c.ents.length ? entLabel(c.ents) : "All projects")}: ${fN(rows.length)} loan cases, ${inr(sanc)} sanctioned, ${inr(disb)} disbursed (${pct(disb, sanc, 0)}).`,
    blocks, asOn: ASON, open: { label: "Open Loan Details", path: "/loan-details" },
  };
}
