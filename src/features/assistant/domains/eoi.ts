/** EOI / Advance receipts. */
import raw from "../../../data/eoiData.json";
import type { Ctx, Section } from "../types";
import { entLabel, fN, idxsFor, inPeriodDay, inr, dayNum } from "../nlp";
import { kv, noProject, rowsOf, sectionTitle, text } from "./common";

const D = raw as unknown as { meta: { asOn: string }; PROJECTS: string[]; C: (number | string)[][] };
const ASON = D.meta.asOn;
const asOnDay = (() => { const d = new Date(ASON); return isNaN(d.getTime()) ? dayNum(new Date()) : dayNum(d); })();

interface Cu { proj: number; status: number; cleared: number; adj: number; refunds: number; n: number; first: number; net: number }
const CUS: Cu[] = D.C.map(c => ({
  proj: c[1] as number, status: c[2] as number, cleared: c[8] as number, adj: c[9] as number, refunds: c[10] as number,
  n: c[12] as number, first: c[6] as number, net: (c[8] as number) + (c[9] as number) + (c[10] as number),
}));
const isPool = (c: Cu) => c.n >= 100 && c.cleared > 0 && Math.abs(c.adj) >= 0.9 * c.cleared;

export async function runEoi(c: Ctx): Promise<Section> {
  const title = sectionTitle("EOI / Advance", c);
  const pIdx = idxsFor(D.PROJECTS, c.ents);
  if (pIdx && pIdx.size === 0) return noProject(title, c, "EOI/Advance", "/eoi", ASON);
  const scoped = CUS.filter(x => (!pIdx || pIdx.has(x.proj)) && (c.period.kind === "all" || inPeriodDay(c.period, x.first)));
  const pending = scoped.filter(x => x.status === 0 && !isPool(x));
  const holding = pending.filter(x => x.net > 1000);
  const inHand = holding.reduce((s, x) => s + x.net, 0);
  const cleared = scoped.filter(x => !isPool(x)).reduce((s, x) => s + x.cleared, 0);
  const refunds = scoped.filter(x => !isPool(x)).reduce((s, x) => s + x.refunds, 0);
  const avgAge = holding.length ? holding.reduce((s, x) => s + Math.max(0, asOnDay - x.first), 0) / holding.length : 0;
  const status = [0, 1, 2].map(s => scoped.filter(x => x.status === s && !isPool(x)).length);

  const blocks = [kv([
    ["Customers holding money (allotment pending)", `${fN(holding.length)} · ${inr(inHand)}`],
    ["Average ageing", holding.length ? `${fN(avgAge)} days` : "—"],
    ["Total paid (cleared)", inr(cleared)], ["Refunded", inr(Math.abs(refunds))],
    ["Status mix", `${fN(status[0])} pending · ${fN(status[1])} allotted · ${fN(status[2])} cancelled`],
  ])];
  if (!c.ents.length || c.ents.length > 1 || c.cue.byProject) {
    const rows = D.PROJECTS.map((p, i) => {
      const hs = holding.filter(x => x.proj === i);
      return { p, n: hs.length, v: hs.reduce((s, x) => s + x.net, 0), type: p === "CODE 67 GURGAON" ? "EOI" : "Advance" };
    }).filter(r => r.n > 0 && (!pIdx || pIdx.has(D.PROJECTS.indexOf(r.p)))).sort((a, b) => b.v - a.v);
    blocks.push(rowsOf(["Project", "Type", "Customers", "Money in hand"], rows.map(r => [r.p, r.type, fN(r.n), inr(r.v)])));
  }
  blocks.push(text("Money in hand = cleared + adjustments + refunds for customers still awaiting allotment, excluding pooled pass-through accounts and balances under ₹1,000. Only CODE 67 is a true EOI; RERA-registered projects collect Advance."));
  return {
    title,
    headline: `${c.ents.length ? entLabel(c.ents) : "All projects"}: ${fN(holding.length)} customers have ${inr(inHand)} in EOI/advance awaiting allotment (avg ${fN(avgAge)} days old).`,
    blocks, asOn: ASON, open: { label: "Open EOI/Advance", path: "/eoi" },
  };
}
