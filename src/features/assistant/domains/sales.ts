/** Sales / bookings (PDRN → cpAnalytics.json) and channel-partner sales. */
import raw from "../../../data/cpAnalytics.json";
import type { Ctx, Section } from "../types";
import { delta, entLabel, fN, idxsFor, inPeriodYm, inr, pct, comparePeriod, sqft, ymLabel, ymKey, ANCHOR } from "../nlp";
import { barBlock, kv, moreNote, noProject, rowsOf, sectionTitle, text, topRows } from "./common";

const D = raw as unknown as { P: string[]; TW: string[]; CFG: string[]; CP: string[]; R: number[][]; meta: { asOn: string } };
const ASON = D.meta.asOn;
const OPEN = { label: "Open Bookings", path: "/bookings" };

interface Agg { n: number; tsv: number; area: number; cancelled: number; cTsv: number; rebooked: number; bba: number }
function agg(rows: number[][]): Agg {
  const a: Agg = { n: 0, tsv: 0, area: 0, cancelled: 0, cTsv: 0, rebooked: 0, bba: 0 };
  for (const r of rows) {
    if (r[13] === 1) { a.cancelled++; a.cTsv += r[6]; continue; }
    a.n++; a.tsv += r[6]; a.area += r[5];
    if (r[14] === 1) a.rebooked++;
    if (r[23] >= 0) a.bba++;
  }
  return a;
}
const rate = (a: { tsv: number; area: number }) => (a.area ? a.tsv / a.area : 0);

function scope(c: Ctx) {
  const pIdx = idxsFor(D.P, c.ents);
  return { pIdx, rows: (p = c.period) => D.R.filter(r => (!pIdx || pIdx.has(r[0])) && inPeriodYm(p, r[7], r[8])) };
}

export async function runSales(c: Ctx): Promise<Section> {
  const { pIdx, rows } = scope(c);
  const title = sectionTitle("Sales", c);
  if (pIdx && pIdx.size === 0) return noProject(title, c, "Bookings", "/bookings", ASON);

  const cur = rows();
  const a = agg(cur);
  const wantCancel = /\bcancel\w*\b/.test(c.nq);
  const prev = comparePeriod(c);
  const pa = prev && !c.period.dayLevel ? agg(rows(prev)) : null;
  const lbl = c.period.explicit ? c.period.label : "till date";

  const blocks = [];
  if (wantCancel) {
    blocks.push(kv([
      ["Bookings made", fN(a.n + a.cancelled)], ["Cancelled", `${fN(a.cancelled)} (${pct(a.cancelled, a.n + a.cancelled)})`],
      ["Cancelled value", inr(a.cTsv)], ["Still active", fN(a.n)],
    ]));
  } else {
    const rows2: [string, string][] = [
      ["Units sold", fN(a.n)], ["Sale value (TSV)", inr(a.tsv)], ["Area sold", sqft(a.area)],
      ["Avg rate", a.area ? `₹${fN(rate(a))} / sq ft` : "—"], ["Avg ticket size", a.n ? inr(a.tsv / a.n) : "—"],
    ];
    if (a.cancelled) rows2.push(["Cancelled (same bookings)", `${fN(a.cancelled)} · ${inr(a.cTsv)}`]);
    if (a.rebooked) rows2.push(["Re-booked units", fN(a.rebooked)]);
    if (/\bbba\b|agreement/.test(c.nq)) rows2.push(["BBA registered", `${fN(a.bba)} of ${fN(a.n)}`]);
    blocks.push(kv(rows2));
  }

  if (pa && !wantCancel) {
    blocks.push(rowsOf(["vs " + prev!.label, "Units", "Sale value", "Avg rate"], [
      ["Previous", fN(pa.n), inr(pa.tsv), pa.area ? `₹${fN(rate(pa))}` : "—"],
      ["Change", delta(a.n, pa.n), delta(a.tsv, pa.tsv), delta(rate(a), rate(pa))],
    ]));
  }

  /* per-project split */
  const showProjects = !c.ents.length || c.ents.length > 1 || c.cue.byProject;
  if (showProjects) {
    const m = new Map<number, number[][]>();
    cur.forEach(r => { if (!m.has(r[0])) m.set(r[0], []); m.get(r[0])!.push(r); });
    const list = [...m.entries()].map(([p, rs]) => ({ p, a: agg(rs) })).filter(x => x.a.n + x.a.cancelled > 0)
      .sort((x, y) => (c.cue.low ? x.a.tsv - y.a.tsv : y.a.tsv - x.a.tsv));
    if (list.length) {
      blocks.push(rowsOf(["Project", "Units", "Sale value", "Avg rate"],
        list.map(x => [D.P[x.p], fN(x.a.n), inr(x.a.tsv), x.a.area ? `₹${fN(rate(x.a))}` : "—"])));
      if ((c.cue.top || c.cue.low) && list.length > 1) {
        const w = list[0];
        blocks.unshift(text(`${c.cue.low ? "Lowest" : "Highest"} sales: ${D.P[w.p]} — ${fN(w.a.n)} units, ${inr(w.a.tsv)}.`));
      }
    }
  }

  /* monthly trend */
  const wantMonths = c.cue.byMonth || c.period.months.length > 1 && c.period.explicit || (!c.period.explicit && (!!pIdx || c.cue.top));
  if (wantMonths || c.cue.top && !c.period.explicit) {
    const m = new Map<string, number[][]>();
    cur.forEach(r => { if (r[7] > 0) { const k = ymKey(r[7], r[8] - 1); if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); } });
    const all = [...m.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([k, rs]) => ({ k, a: agg(rs) }));
    if (all.length) {
      const best = [...all].sort((x, y) => y.a.tsv - x.a.tsv)[0];
      const shown = all.slice(-12);
      blocks.push(rowsOf(["Month", "Units", "Sale value", "Avg rate"], shown.reverse().map(x => [ymLabel(x.k), fN(x.a.n), inr(x.a.tsv), x.a.area ? `₹${fN(rate(x.a))}` : "—"]),
        all.length > 12 ? `Last 12 of ${all.length} months` : undefined));
      if (c.cue.top) blocks.unshift(text(`Best month: ${ymLabel(best.k)} — ${fN(best.a.n)} units, ${inr(best.a.tsv)}.`));
    }
  }

  if (c.cue.byTower) {
    const m = new Map<string, number[][]>();
    cur.forEach(r => { const k = `${D.P[r[0]]} · ${D.TW[r[1]]}`; if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); });
    const list = [...m.entries()].map(([k, rs]) => ({ k, a: agg(rs) })).sort((x, y) => y.a.n - x.a.n);
    const { shown, more } = topRows(list, 10);
    if (shown.length) blocks.push(rowsOf(["Tower", "Units", "Sale value"], shown.map(x => [x.k, fN(x.a.n), inr(x.a.tsv)]), moreNote(more, "towers")));
  }
  if (c.cue.byConfig) {
    const bucket = (s: string) => { const m = s.match(/(\d)\s*BHK/i); return m ? `${m[1]} BHK` : /shop|retail|commercial|anchor|restaurant/i.test(s) ? "Commercial" : "Other"; };
    const m = new Map<string, number[][]>();
    cur.forEach(r => { const k = bucket(D.CFG[r[4]]); if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); });
    const list = [...m.entries()].map(([k, rs]) => ({ k, a: agg(rs) })).sort((x, y) => y.a.n - x.a.n);
    blocks.push(barBlock("Units sold by configuration", list.map(x => ({ label: x.k, value: x.a.n, text: `${fN(x.a.n)} · ${inr(x.a.tsv)}` }))));
  }

  const who = c.ents.length ? entLabel(c.ents) : "All projects";
  let topLine = "";
  const pl = blocks.find(b => b.t === "text" && /^(Highest|Lowest) sales/.test(b.text));
  if (pl && pl.t === "text") topLine = pl.text.replace(/\.$/, "") + (c.period.explicit ? ` in ${c.period.label}` : " till date") + ".";
  const headline = topLine ? topLine : wantCancel
    ? `${who}: ${fN(a.cancelled)} cancellations (${inr(a.cTsv)}) out of ${fN(a.n + a.cancelled)} bookings ${lbl === "till date" ? "till date" : "in " + lbl}.`
    : a.n || a.cancelled
      ? `${who}${c.period.explicit ? " · " + c.period.label : ""}: ${fN(a.n)} unit${a.n === 1 ? "" : "s"} sold, ${inr(a.tsv)} sale value, avg ₹${fN(rate(a))}/sq ft.`
      : `${who}: no bookings recorded ${c.period.explicit ? "in " + c.period.label : "yet"}.`;
  const beyond = c.period.explicit && c.period.kind !== "all" && c.period.to > ANCHOR;
  if (beyond) blocks.push(text(`Note: bookings data runs only till ${ASON}.`));
  blocks.push(text("Sale value = Total BSP Net Value of active bookings, the same basis as the Bookings and Overview tabs."));
  return { title, headline, blocks, asOn: ASON, open: OPEN };
}

/** Channel-partner sales (who brought the bookings). */
export async function runCp(c: Ctx): Promise<Section> {
  const { pIdx, rows } = scope(c);
  const title = sectionTitle("Channel partner sales", c);
  if (pIdx && pIdx.size === 0) return noProject(title, c, "Channel Partners", "/channel-partners", ASON);
  const act = rows().filter(r => r[13] === 0);
  const via = act.filter(r => r[12] >= 0), direct = act.length - via.length;
  const m = new Map<number, { n: number; tsv: number }>();
  via.forEach(r => { const e = m.get(r[12]) ?? { n: 0, tsv: 0 }; e.n++; e.tsv += r[6]; m.set(r[12], e); });
  const list = [...m.entries()].map(([k, v]) => ({ name: D.CP[k], ...v })).sort((x, y) => (c.cue.low ? x.tsv - y.tsv : y.tsv - x.tsv));
  const tot = via.reduce((s, r) => s + r[6], 0);
  const { shown, more } = topRows(list, c.topN);
  const blocks = [
    kv([
      ["Bookings via channel partners", `${fN(via.length)} (${pct(via.length, act.length)})`],
      ["Direct bookings", `${fN(direct)} (${pct(direct, act.length)})`],
      ["Active partners", fN(list.length)], ["Value via partners", inr(tot)],
    ]),
    rowsOf(["#", "Channel partner", "Units", "Sale value", "Share"], shown.map((x, i) => [String(i + 1), x.name, fN(x.n), inr(x.tsv), pct(x.tsv, tot)]), moreNote(more, "partners")),
  ];
  const lead = list[0];
  const headline = lead
    ? `${entLabel(c.ents)}${c.period.explicit ? " · " + c.period.label : ""}: ${fN(list.length)} partners brought ${fN(via.length)} bookings (${inr(tot)}); ${c.cue.low ? "lowest" : "top"} is ${lead.name} with ${fN(lead.n)} units.`
    : `No channel-partner bookings found${c.period.explicit ? " in " + c.period.label : ""}.`;
  return { title, headline, blocks, asOn: ASON, open: { label: "Open Channel Partners", path: "/channel-partners" } };
}

