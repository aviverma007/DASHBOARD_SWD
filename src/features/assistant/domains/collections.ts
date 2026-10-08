/** SAP Collection: TCV, demand raised, received, net due, future dues (PDRN). */
import raw from "../../../data/cpAnalytics.json";
import type { Ctx, Section } from "../types";
import { entLabel, fN, idxsFor, inPeriodYm, inr, pct } from "../nlp";
import { kv, moreNote, noProject, rowsOf, sectionTitle, text, topRows } from "./common";

const D = raw as unknown as { P: string[]; R: number[][]; meta: { asOn: string } };
const ASON = D.meta.asOn;

interface C { n: number; tcv: number; called: number; recv: number; due: number; future: number; dueUnits: number }
const empty = (): C => ({ n: 0, tcv: 0, called: 0, recv: 0, due: 0, future: 0, dueUnits: 0 });
function add(t: C, r: number[]) {
  const called = r[22], recv = r[24] - r[25];
  t.n++; t.tcv += r[26]; t.called += called; t.recv += recv;
  const due = called - recv;
  t.due += due; t.future += r[26] - called;
  if (due > 0) t.dueUnits++;
}

export async function runCollections(c: Ctx): Promise<Section> {
  const title = sectionTitle("SAP collection", c);
  const pIdx = idxsFor(D.P, c.ents);
  if (pIdx && pIdx.size === 0) return noProject(title, c, "SAP Collection", "/sap-collections", ASON);
  const rows = D.R.filter(r => r[13] === 0 && (!pIdx || pIdx.has(r[0])) && inPeriodYm(c.period, r[7], r[8]));
  const t = empty();
  rows.forEach(r => add(t, r));

  const blocks = [
    kv([
      ["Active bookings", fN(t.n)], ["Total contract value (TCV)", inr(t.tcv)],
      ["Demand raised (called)", `${inr(t.called)} · ${pct(t.called, t.tcv)} of TCV`],
      ["Received", `${inr(t.recv)} · ${pct(t.recv, t.called)} of demand`],
      ["Net due (demand − received)", `${inr(t.due)} · ${fN(t.dueUnits)} units with dues`],
      ["Future dues (TCV − demand)", inr(t.future)],
    ]),
  ];
  if (!c.ents.length || c.ents.length > 1 || c.cue.byProject) {
    const m = new Map<number, C>();
    rows.forEach(r => { if (!m.has(r[0])) m.set(r[0], empty()); add(m.get(r[0])!, r); });
    const list = [...m.entries()].sort((a, b) => (c.cue.low ? a[1].due - b[1].due : b[1].due - a[1].due));
    const { shown, more } = topRows(list, 12);
    blocks.push(rowsOf(["Project", "TCV", "Demand", "Received", "Net due", "Recd %"],
      shown.map(([k, x]) => [D.P[k], inr(x.tcv), inr(x.called), inr(x.recv), inr(x.due), pct(x.recv, x.called, 0)]), moreNote(more, "projects")));
    if ((c.cue.top || c.cue.low) && list.length > 1) blocks.unshift(text(`${c.cue.low ? "Lowest" : "Highest"} net due: ${D.P[list[0][0]]} — ${inr(list[0][1].due)}.`));
  }
  blocks.push(text("Received = Net Received incl. tax − Pending for clearance. Figures are cumulative balances per booking" + (c.period.explicit ? ` (filtered to bookings made in ${c.period.label})` : "") + "; the PDRN has no receipt dates, so collections cannot be split by month received."));

  const who = c.ents.length ? entLabel(c.ents) : "All projects";
  const ex = blocks.find(b => b.t === "text" && /^(Highest|Lowest) net due/.test(b.text));
  return {
    title,
    headline: (ex && ex.t === "text" ? ex.text + " " : "") + `${who}: ${inr(t.recv)} received of ${inr(t.called)} demanded (${pct(t.recv, t.called, 0)}); net due ${inr(t.due)}, future dues ${inr(t.future)}.`,
    blocks, asOn: ASON, open: { label: "Open SAP Collection", path: "/sap-collections" },
  };
}
