/** Gallery footfall, CP gallery visits and digital enquiries. */
import { FF, FF_RECORDS, dayToYm, ymLabel as ffYmLabel } from "../../../utils/footfallLogic";
import { CPV, CPV_RECORDS, cpvFirstVisitMap } from "../../../utils/cpVisitsLogic";
import { DG, RECORDS as DIG } from "../../../components/leads/digitalShared";
import type { Block, Ctx, Section } from "../types";
import { entLabel, fN, idxsFor, inPeriodDay, pct, comparePeriod, delta, norm } from "../nlp";
import { barBlock, kv, moreNote, noProject, rowsOf, sectionTitle, text, topRows } from "./common";

function countBy<T>(rows: T[], key: (r: T) => number): [number, number][] {
  const m = new Map<number, number>();
  rows.forEach(r => { const k = key(r); if (k >= 0) m.set(k, (m.get(k) ?? 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
const bars = (title: string, names: string[], list: [number, number][], total: number, n = 8): Block =>
  barBlock(title, list.slice(0, n).map(([k, v]) => ({ label: names[k] ?? "—", value: v, text: `${fN(v)} · ${pct(v, total, 0)}` })));

function monthly(days: number[]): Block | null {
  const m = new Map<string, number>();
  days.forEach(d => { if (d >= 0) { const k = dayToYm(d); m.set(k, (m.get(k) ?? 0) + 1); } });
  const list = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  return list.length ? rowsOf(["Month", "Count"], list.reverse().map(([k, v]) => [ffYmLabel(k), fN(v)])) : null;
}

/* ───────────── customer footfall ───────────── */
export async function runFootfall(c: Ctx): Promise<Section> {
  const title = sectionTitle("Gallery footfall", c);
  const pIdx = idxsFor(FF.P, c.ents);
  if (pIdx && pIdx.size === 0) return noProject(title, c, "Gallery Footfall", "/gallery-footfall", FF.meta.asOn);
  const scope = (p = c.period) => FF_RECORDS.filter(r => (!pIdx || pIdx.has(r.p)) && (p.kind === "all" ? true : inPeriodDay(p, r.day)));
  const rows = scope();
  const opps = new Set(rows.map(r => r.opp).filter(Boolean)).size;
  const bookedIdx = FF.STG.indexOf("Booked");
  const booked = rows.filter(r => r.stg === bookedIdx).length;
  const prev = comparePeriod(c);
  const pr = prev ? scope(prev).length : null;

  const blocks: Block[] = [kv([
    ["Customer visits", fN(rows.length)], ["Unique opportunities", fN(opps)],
    ["Reached 'Booked' stage", `${fN(booked)} (${pct(booked, rows.length)})`],
    ...(pr !== null ? [[`vs ${prev!.label}`, `${fN(pr)} → ${delta(rows.length, pr)}`] as [string, string]] : []),
  ])];
  blocks.push(bars("By source", FF.SRC, countBy(rows, r => r.src), rows.length));
  if (!c.ents.length || c.cue.byProject) blocks.push(bars("By project", FF.P, countBy(rows, r => r.p), rows.length, 10));
  blocks.push(bars("By gallery", FF.G, countBy(rows, r => r.g), rows.length));
  blocks.push(bars("By opportunity stage", FF.STG, countBy(rows, r => r.stg), rows.length));
  if (/\b(locality|localities|area|where|location|from)\b/.test(c.nq)) blocks.push(bars("Top localities", FF.LOC, countBy(rows, r => r.loc), rows.length, 8));
  if (/\b(age|aged)\b/.test(c.nq)) blocks.push(bars("By age band", FF.AGE, countBy(rows, r => r.age), rows.length));
  if (/\b(channel partner|cp|broker)\b/.test(c.nq)) {
    const l = countBy(rows.filter(r => r.src === 1), r => r.cp); const { shown } = topRows(l, c.topN);
    blocks.push(rowsOf(["Channel partner", "Visits"], shown.map(([k, v]) => [FF.CPN[k], fN(v)])));
  }
  if (c.cue.byMonth || (!c.period.explicit)) { const mb = monthly(rows.map(r => r.day)); if (mb) blocks.push(mb); }

  return {
    title,
    headline: `${c.ents.length ? entLabel(c.ents) : "All projects"}${c.period.explicit ? " · " + c.period.label : ""}: ${fN(rows.length)} gallery visits (${fN(opps)} unique opportunities); ${fN(booked)} reached Booked.`,
    blocks, asOn: FF.meta.asOn, open: { label: "Open Gallery Footfall", path: "/gallery-footfall" },
  };
}

/* ───────────── channel-partner gallery visits ───────────── */
export async function runCpVisits(c: Ctx): Promise<Section> {
  const title = sectionTitle("CP gallery visits", c);
  const pIdx = idxsFor(CPV.PRJ, c.ents);
  if (pIdx && pIdx.size === 0) return noProject(title, c, "Channel Partners", "/channel-partners", CPV.meta.asOn);
  const scope = (p = c.period) => CPV_RECORDS.filter(r => (!pIdx || pIdx.has(r.p)) && (p.kind === "all" ? true : inPeriodDay(p, r.day)));
  const rows = scope();
  const partners = new Set(rows.filter(r => r.cp >= 0).map(r => r.cp));
  const visitors = rows.filter(r => r.nv > 0).reduce((s, r) => s + r.nv, 0);
  const first = cpvFirstVisitMap();
  const fresh = [...partners].filter(cp => { const d = first.get(cp); return d !== undefined && (c.period.kind === "all" ? true : inPeriodDay(c.period, d)); }).length;
  const prev = comparePeriod(c);
  const pr = prev ? scope(prev) : null;

  const blocks: Block[] = [kv([
    ["Visits", fN(rows.length)], ["Distinct channel partners", fN(partners.size)],
    ["Visitors brought (where recorded)", fN(visitors)],
    ...(c.period.kind !== "all" ? [["New partners (first visit ever)", fN(fresh)] as [string, string]] : []),
    ...(pr ? [[`vs ${prev!.label}`, `${fN(pr.length)} visits → ${delta(rows.length, pr.length)}`] as [string, string]] : []),
  ])];
  const topCp = countBy(rows, r => r.cp);
  const { shown, more } = topRows(topCp, c.topN);
  blocks.push(rowsOf(["Top partners by visits", "Visits"], shown.map(([k, v]) => [CPV.CPN[k], fN(v)]), moreNote(more, "partners")));
  if (!c.ents.length || c.cue.byProject) blocks.push(bars("By project", CPV.PRJ, countBy(rows, r => r.p), rows.length, 10));
  blocks.push(bars("By gallery", CPV.G, countBy(rows, r => r.g), rows.length));
  blocks.push(bars("By status", CPV.STA, countBy(rows, r => r.sta), rows.length));
  if (c.cue.byMonth || !c.period.explicit) { const mb = monthly(rows.map(r => r.day)); if (mb) blocks.push(mb); }
  return {
    title,
    headline: `${c.ents.length ? entLabel(c.ents) : "All projects"}${c.period.explicit ? " · " + c.period.label : ""}: ${fN(rows.length)} CP visits from ${fN(partners.size)} partners.`,
    blocks, asOn: CPV.meta.asOn, open: { label: "Open Channel Partners", path: "/channel-partners" },
  };
}

/* ───────────── digital enquiries ───────────── */
export async function runDigital(c: Ctx): Promise<Section> {
  const title = sectionTitle("Digital leads", c);
  const pIdx = idxsFor(DG.PRJ, c.ents);
  if (pIdx && pIdx.size === 0) return noProject(title, c, "Digital Leads", "/digital-leads", DG.meta.asOn);
  const subHit = new Set(DG.SUB.map((n, i) => ({ n: norm(n), i })).filter(x => x.n.length > 3 && c.nq.includes(x.n.replace(/^chatbot /, ""))).map(x => x.i));
  const subLbl = [...subHit].map(i => DG.SUB[i]).join(" / ");
  const scope = (p = c.period) => DIG.filter(r => (!pIdx || pIdx.has(r.p)) && (!subHit.size || subHit.has(r.sub)) && (p.kind === "all" ? true : inPeriodDay(p, r.day)));
  const rows = scope();
  const QUAL = DG.STA.indexOf("Qualified"), BOOKED = DG.STG.indexOf("Booked");
  const qualified = rows.filter(r => r.sta === QUAL || r.stg >= 0).length;
  const opp = rows.filter(r => r.stg >= 0).length;
  const booked = rows.filter(r => r.stg === BOOKED).length;
  const prev = comparePeriod(c);
  const pr = prev ? scope(prev).length : null;

  const blocks: Block[] = [kv([
    ["Enquiries", fN(rows.length)], ["Qualified", `${fN(qualified)} (${pct(qualified, rows.length)})`],
    ["Became opportunity", `${fN(opp)} (${pct(opp, rows.length)})`], ["Booked", `${fN(booked)} (${pct(booked, rows.length, 2)})`],
    ...(pr !== null ? [[`vs ${prev!.label}`, `${fN(pr)} → ${delta(rows.length, pr)}`] as [string, string]] : []),
  ])];
  blocks.push(bars("By sub-source", DG.SUB, countBy(rows, r => r.sub), rows.length, 10));
  if (!c.ents.length || c.cue.byProject) blocks.push(bars("By project", DG.PRJ, countBy(rows, r => r.p), rows.length, 10));
  blocks.push(bars("By status", DG.STA, countBy(rows, r => r.sta), rows.length));
  if (/\b(agency|agencies|agn)\b/.test(c.nq)) blocks.push(bars("By agency", DG.AGN, countBy(rows, r => r.ag), rows.length, 8));
  if (c.cue.byMonth || !c.period.explicit) { const mb = monthly(rows.map(r => r.day)); if (mb) blocks.push(mb); }
  blocks.push(text("Qualified = presales-qualified or already an opportunity (same rule as the Digital Leads tab)."));
  return {
    title,
    headline: `${subLbl ? subLbl + " · " : ""}${c.ents.length ? entLabel(c.ents) : "All projects"}${c.period.explicit ? " · " + c.period.label : ""}: ${fN(rows.length)} digital enquiries, ${fN(qualified)} qualified, ${fN(booked)} booked.`,
    blocks, asOn: DG.meta.asOn, open: { label: "Open Digital Leads", path: "/digital-leads" },
  };
}
