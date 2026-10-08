/** Target vs Actual: AOP monthly targets vs booked actuals. */
import tg from "../../../data/targetData.json";
import tv from "../../../data/tvAnalytics.json";
import { DATA_AS_ON } from "../../../config/dataInfo";
import type { Ctx, Section } from "../types";
import { ANCHOR, crv, entLabel, entityOfName, fN, pct, sqft, ymKey } from "../nlp";
import { kv, rowsOf, sectionTitle, text } from "./common";

interface TP { name: string; units: number[]; area: number[]; rate: number[]; sale_value: number[] }
interface TA { name: string; monthly_units: number[]; monthly_tsv: number[]; monthly_area: number[] }
const T = tg as unknown as { months: { year: number; month: number; label: string }[]; projects: TP[] };
const A = (tv as unknown as { projects: TA[] }).projects;
const OPEN = { label: "Open Target vs Actual", path: "/target" };

const sum = (a: number[] | undefined, idx: number[]) => (a ? idx.reduce((s, i) => s + (a[i] ?? 0), 0) : 0);

export async function runTarget(c: Ctx): Promise<Section> {
  const title = sectionTitle("Target vs actual", c);
  const idx: number[] = [];
  const anchorKey = ymKey(ANCHOR.getFullYear(), ANCHOR.getMonth());
  T.months.forEach((m, i) => {
    const k = ymKey(m.year, m.month - 1);
    const inRange = c.period.kind === "all" ? k <= anchorKey : c.period.months.includes(k);
    if (inRange) idx.push(i);
  });
  const periodLbl = c.period.kind === "all" ? `${T.months[idx[0]]?.label ?? ""} – ${T.months[idx[idx.length - 1]]?.label ?? ""} (till date)` : c.period.label;
  if (!idx.length) return { title, headline: `There are no targets defined for ${c.period.label}.`, blocks: [text(`Targets cover ${T.months[0].label} to ${T.months[T.months.length - 1].label}.`)], asOn: DATA_AS_ON, open: OPEN };

  const wanted = c.ents.length ? T.projects.filter(p => c.ents.some(e => e.ds.test(p.name.toLowerCase().replace(/[^a-z0-9' ]+/g, " ")))) : T.projects;
  if (c.ents.length && !wanted.length) {
    return {
      title, headline: `No target is defined for ${entLabel(c.ents)}.`,
      blocks: [text(`Targets exist for: ${T.projects.map(p => p.name).join(", ")}.`)], asOn: DATA_AS_ON, open: OPEN,
    };
  }

  const rows = wanted.map(p => {
    const id = entityOfName(p.name)?.id;
    const act = A.find(a => entityOfName(a.name)?.id === id);
    return {
      name: p.name, hasActual: !!act,
      tU: sum(p.units, idx), tV: sum(p.sale_value, idx), tA: sum(p.area, idx),
      aU: act ? sum(act.monthly_units, idx) : 0, aV: act ? sum(act.monthly_tsv, idx) : 0, aA: act ? sum(act.monthly_area, idx) * 1e5 : 0,
    };
  }).filter(r => r.tU || r.tV || r.aU);
  const tot = rows.reduce((s, r) => ({ tU: s.tU + r.tU, tV: s.tV + r.tV, tA: s.tA + r.tA, aU: s.aU + r.aU, aV: s.aV + r.aV, aA: s.aA + r.aA }), { tU: 0, tV: 0, tA: 0, aU: 0, aV: 0, aA: 0 });

  const blocks = [
    kv([
      ["Period", periodLbl],
      ["Units — target / actual", `${fN(tot.tU)} / ${fN(tot.aU)} (${pct(tot.aU, tot.tU, 0)})`],
      ["Sale value — target / actual", `${crv(tot.tV)} / ${crv(tot.aV)} (${pct(tot.aV, tot.tV, 0)})`],
      ["Area — target / actual", `${sqft(tot.tA)} / ${sqft(tot.aA)} (${pct(tot.aA, tot.tA, 0)})`],
      [tot.aV >= tot.tV ? "Ahead of target by" : "Shortfall vs target", crv(Math.abs(tot.tV - tot.aV))],
    ]),
  ];
  if (rows.length > 1 || c.cue.byProject) {
    blocks.push(rowsOf(["Project", "Target units", "Actual units", "Target value", "Actual value", "Achieved"],
      rows.map(r => [r.name, fN(r.tU), r.hasActual ? fN(r.aU) : "n/a", crv(r.tV), r.hasActual ? crv(r.aV) : "n/a", r.hasActual ? pct(r.aV, r.tV, 0) : "—"])));
  }
  if (rows.some(r => !r.hasActual)) blocks.push(text("Projects marked n/a have a target but no actuals in the latest INVR/PDRN refresh."));
  if (c.period.kind !== "all" && c.period.to > ANCHOR) blocks.push(text(`Actuals run only till ${DATA_AS_ON}, so future months in this range show a target with no actual yet.`));

  const who = c.ents.length ? entLabel(c.ents) : "All projects";
  return {
    title,
    headline: `${who} · ${periodLbl}: target ${fN(tot.tU)} units / ${crv(tot.tV)}, actual ${fN(tot.aU)} units / ${crv(tot.aV)} — ${pct(tot.aV, tot.tV, 0)} of value target achieved.`,
    blocks, asOn: DATA_AS_ON, open: OPEN,
  };
}
