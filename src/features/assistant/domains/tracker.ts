/** Project tracker: construction progress from the schedule's leaf activities,
 * using the same definitions as the Project Tracker tab. */
import raw from "../../../data/projectTracker.json";
import type { Ctx, Section } from "../types";
import { dayNum, entLabel, fN, norm } from "../nlp";
import { kv, rowsOf, sectionTitle, text } from "./common";

interface T { proj: number; pct: number; done: boolean; active: boolean; overdue: boolean; slip: boolean; tower: number; trade: number; name: string; pe: number }
const D = raw as unknown as { meta: { asOn: string }; PROJECTS: string[]; STATUS: string[]; TOWERS: string[]; TRADES: string[]; T: (number | string)[][] };
const ASON = D.meta.asOn;
const asOnDay = (() => { const d = new Date(ASON); return isNaN(d.getTime()) ? dayNum(new Date()) : dayNum(d); })();
const ACTS: T[] = D.T.filter(t => (t[15] as number) === 1).map(t => {
  const st = D.STATUS[t[4] as number], pct = t[3] as number, pe = t[6] as number, be = t[9] as number;
  const done = st === "Complete" || st === "Quality checked" || pct >= 100;
  return { proj: t[0] as number, pct, done, active: st === "Started", overdue: !done && pe >= 0 && pe < asOnDay, slip: pe >= 0 && be >= 0 && pe > be,
    tower: t[12] as number, trade: t[10] as number, name: String(t[1]), pe };
});
const avg = (xs: T[]) => (xs.length ? xs.reduce((s, t) => s + t.pct, 0) / xs.length : 0);

export async function runTracker(c: Ctx): Promise<Section> {
  const title = sectionTitle("Construction progress", c, false);
  const alias = (name: string) => c.ents.some(e => e.ds.test(norm(name)) ||
    (e.id === "suites" && /\bes\b|sector 98/.test(norm(name))) || (e.id === "natures" && /nature/.test(norm(name))) ||
    (e.id === "residencies" && /\bes\b|elie/.test(norm(name))) || (e.id === "dxp1" && /dxp.*ph.?1/.test(norm(name))) || (e.id === "dxp2" && /dxp.*ph.?2/.test(norm(name))));
  const pIdx = c.ents.length ? D.PROJECTS.map((p, i) => (alias(p) ? i : -1)).filter(i => i >= 0) : D.PROJECTS.map((_, i) => i);
  const open = { label: "Open Project Tracker", path: "/project-tracker" };
  if (!pIdx.length) return { title, headline: `The tracker has no schedule for ${entLabel(c.ents)}.`, blocks: [text(`Tracked projects: ${D.PROJECTS.join("; ")}.`)], asOn: ASON, open };

  const tw = c.nq.match(/\btower ([a-z0-9]+)\b/);
  const towerOk = (t: T) => !tw || (t.tower >= 0 && norm(D.TOWERS[t.tower]).startsWith(`tower ${tw[1]}`));
  const per = pIdx.map(pi => {
    const a = ACTS.filter(t => t.proj === pi && towerOk(t));
    return { pi, a, pct: avg(a), done: a.filter(t => t.done).length, run: a.filter(t => t.active && !t.done).length, od: a.filter(t => t.overdue).length, slip: a.filter(t => t.slip).length };
  }).filter(x => x.a.length);
  const all = per.flatMap(x => x.a);
  const blocks = [
    rowsOf(["Project", "Progress", "Activities", "Done", "Running", "Overdue", "Slipped"],
      per.map(x => [D.PROJECTS[x.pi], `${x.pct.toFixed(0)}%`, fN(x.a.length), fN(x.done), fN(x.run), fN(x.od), fN(x.slip)])),
  ];
  if (per.length === 1 || c.cue.byTower) {
    const m = new Map<string, T[]>();
    all.forEach(t => { if (t.tower < 0) return; const k = `${per.length > 1 ? D.PROJECTS[t.proj] + " · " : ""}${D.TOWERS[t.tower] || "Unassigned"}`; if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); });
    const list = [...m.entries()].map(([k, ts]) => ({ k, ts, pct: avg(ts) })).sort((a, b) => b.pct - a.pct).slice(0, 14);
    if (list.length) blocks.push(rowsOf(["Tower", "Progress", "Done / total", "Overdue"], list.map(x => [x.k, `${x.pct.toFixed(0)}%`, `${fN(x.ts.filter(t => t.done).length)} / ${fN(x.ts.length)}`, fN(x.ts.filter(t => t.overdue).length)])));
  }
  if (/\b(trade|package|work)\b/.test(c.nq)) {
    const m = new Map<number, T[]>();
    all.forEach(t => { if (t.trade >= 0) { if (!m.has(t.trade)) m.set(t.trade, []); m.get(t.trade)!.push(t); } });
    const list = [...m.entries()].map(([k, ts]) => ({ k, ts, pct: avg(ts) })).sort((a, b) => b.ts.length - a.ts.length).slice(0, 10);
    blocks.push(rowsOf(["Trade", "Progress", "Activities", "Overdue"], list.map(x => [D.TRADES[x.k], `${x.pct.toFixed(0)}%`, fN(x.ts.length), fN(x.ts.filter(t => t.overdue).length)])));
  }
  blocks.push(kv([["Schedule data date", ASON]]));
  blocks.push(text("Progress = average completion of the schedule's leaf activities; Overdue = planned end passed and not complete; Slipped = planned end later than baseline (same as the Project Tracker tab)."));
  const head = per.length === 1
    ? `${D.PROJECTS[per[0].pi]} is ${per[0].pct.toFixed(0)}% complete — ${fN(per[0].done)} of ${fN(per[0].a.length)} activities done, ${fN(per[0].od)} overdue.`
    : `${per.map(x => `${D.PROJECTS[x.pi]} ${x.pct.toFixed(0)}%`).join(" · ")} average completion.`;
  return { title, headline: head, blocks, asOn: ASON, open };
}
