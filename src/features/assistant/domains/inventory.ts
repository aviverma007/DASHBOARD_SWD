/** Inventory (INVR → smartworldInventory.json): stock, sold/unsold, unit lookup. */
import raw from "../../../data/smartworldInventory.json";
import { DATA_AS_ON } from "../../../config/dataInfo";
import type { Ctx, Section } from "../types";
import { entLabel, fN, idxsFor, inr, pct, sqft } from "./../nlp";
import { kv, moreNote, noProject, rowsOf, sectionTitle, text, topRows } from "./common";

const D = raw as unknown as { P: string[]; TW: string[]; FL: string[]; CFG: string[]; UT: string[]; U: (number | string)[][] };
const OPEN = { label: "Open Inventory", path: "/inventory" };
const ST = ["Available", "Booked", "Management"];

interface Tot { total: number; sold: number; avail: number; mgmt: number; area: number; soldArea: number; value: number }
const empty = (): Tot => ({ total: 0, sold: 0, avail: 0, mgmt: 0, area: 0, soldArea: 0, value: 0 });
function add(t: Tot, u: (number | string)[]) {
  const st = u[8] as number, a = u[6] as number;
  t.total++; t.area += a;
  if (st === 1) { t.sold++; t.soldArea += a; } else if (st === 0) { t.avail++; t.value += u[7] as number; } else t.mgmt++;
}
const unsold = (t: Tot) => t.avail + t.mgmt;

export async function runInventory(c: Ctx): Promise<Section> {
  const title = sectionTitle("Inventory", c, false);
  const um = c.raw.match(/\b([A-Za-z]{1,3}\d{0,2})\s*[-–]\s*(\d{2,4}[A-Za-z]?)\b/);
  if (um && /\b(unit|flat|apartment|sold|available|price|cost|status|booked|area|tower|floor)\b/i.test(c.raw)) return runUnit(c, `${um[1]}${um[2]}`);

  const pIdx = idxsFor(D.P, c.ents);
  if (pIdx && pIdx.size === 0) return noProject(title, c, "Inventory", "/inventory", DATA_AS_ON);
  const units = D.U.filter(u => !pIdx || pIdx.has(u[0] as number));
  const t = empty();
  units.forEach(u => add(t, u));

  const blocks = [
    kv([
      ["Total units", fN(t.total)], ["Sold (booked)", `${fN(t.sold)} · ${pct(t.sold, t.total)}`],
      ["Unsold", `${fN(unsold(t))} · ${pct(unsold(t), t.total)}`],
      ["  of which available", fN(t.avail)], ["  of which management / on hold", fN(t.mgmt)],
      ["Total area", sqft(t.area)], ["Sold area", `${sqft(t.soldArea)} · ${pct(t.soldArea, t.area)}`],
      ["Unsold area", sqft(t.area - t.soldArea)], ["Available stock value", inr(t.value)],
    ]),
  ];

  const showProjects = !c.ents.length || c.ents.length > 1 || c.cue.byProject;
  if (showProjects) {
    const m = new Map<number, Tot>();
    units.forEach(u => { const k = u[0] as number; if (!m.has(k)) m.set(k, empty()); add(m.get(k)!, u); });
    const list = [...m.entries()].sort((a, b) => (c.cue.low ? a[1].sold / a[1].total - b[1].sold / b[1].total : b[1][c.cue.top ? "sold" : "total"] - a[1][c.cue.top ? "sold" : "total"]));
    blocks.push(rowsOf(["Project", "Total", "Sold", "Unsold", "Sold %", "Area"],
      list.map(([k, x]) => [D.P[k], fN(x.total), fN(x.sold), fN(unsold(x)), pct(x.sold, x.total, 0), sqft(x.area)])));
  }
  if (c.cue.byTower || (c.ents.length === 1 && !c.cue.byConfig && /\b(tower|towers)\b/.test(c.nq))) {
    const m = new Map<string, Tot>();
    units.forEach(u => { const k = `${D.P[u[0] as number]} · ${D.TW[u[1] as number]}`; if (!m.has(k)) m.set(k, empty()); add(m.get(k)!, u); });
    const list = [...m.entries()].sort((a, b) => unsold(b[1]) - unsold(a[1]));
    const { shown, more } = topRows(list, 12);
    blocks.push(rowsOf(["Tower", "Total", "Sold", "Unsold", "Sold %"], shown.map(([k, x]) => [k, fN(x.total), fN(x.sold), fN(unsold(x)), pct(x.sold, x.total, 0)]), moreNote(more, "towers")));
  }
  if (c.cue.byConfig || /\b(bhk|config\w*)\b/.test(c.nq)) {
    const m = new Map<string, Tot>();
    units.forEach(u => { const k = D.CFG[u[4] as number]; if (!m.has(k)) m.set(k, empty()); add(m.get(k)!, u); });
    const list = [...m.entries()].sort((a, b) => b[1].total - a[1].total);
    blocks.push(rowsOf(["Config", "Total", "Sold", "Unsold", "Sold %"], list.map(([k, x]) => [k, fN(x.total), fN(x.sold), fN(unsold(x)), pct(x.sold, x.total, 0)])));
  }
  blocks.push(text("Unsold = Available + Management units (management units are held back, so they are not sold). Inventory is a point-in-time snapshot and is not filtered by period."));

  const who = c.ents.length ? entLabel(c.ents) : "All projects";
  return {
    title,
    headline: `${who}: ${fN(t.total)} units in total — ${fN(t.sold)} sold (${pct(t.sold, t.total, 0)}), ${fN(unsold(t))} unsold, ${sqft(t.area)}.`,
    blocks, asOn: DATA_AS_ON, open: OPEN,
  };
}

async function runUnit(c: Ctx, key: string): Promise<Section> {
  const k = key.toLowerCase();
  const hits = D.U.filter(u => String(u[12]).toLowerCase().replace(/[^a-z0-9]/g, "") === k);
  const title = `Unit ${key.toUpperCase()}`;
  if (!hits.length) return { title, headline: `I could not find a unit "${key.toUpperCase()}" in the inventory.`, blocks: [text("Check the unit number (for example R-220, TF-3103, T6-903) and the project name.")], asOn: DATA_AS_ON, open: OPEN };
  const pIdx = idxsFor(D.P, c.ents);
  const list = (pIdx ? hits.filter(u => pIdx.has(u[0] as number)) : hits).slice(0, 4);
  const book = (await import("../../../data/cpAnalytics.json")).default as unknown as { P: string[]; R: (number | string)[][] };
  const blocks = list.map(u => {
    const sold = u[8] === 1;
    const rows: [string, string][] = [
      ["Project", D.P[u[0] as number]], ["Tower / floor", `${D.TW[u[1] as number]} · ${D.FL[u[3] as number]}`],
      ["Configuration", D.CFG[u[4] as number]], ["Super area", sqft(u[6] as number)], ["Status", ST[u[8] as number]],
      [sold ? "Unit cost (INVR)" : "List price", inr(u[7] as number)],
    ];
    if (sold) {
      const pn = D.P[u[0] as number].toLowerCase().replace(/\s+/g, "");
      const b = book.R.find(r => String(r[9]).toLowerCase().replace(/[^a-z0-9]/g, "") === k && book.P[r[0] as number].toLowerCase().replace(/\s+/g, "") === pn && r[13] === 0);
      if (b) {
        const rate = (b[5] as number) ? (b[6] as number) / (b[5] as number) : 0;
        rows.push(["Sale value (TSV)", inr(b[6] as number)], ["Rate", `₹${fN(rate)} / sq ft`], ["Booked in", `${b[8]}/${b[7]}`], ["Payment plan", String(book.R[0] && b[11] !== undefined ? b[11] : "—")], ["BBA", (b[23] as number) >= 0 ? "Registered" : "Not yet"]);
      }
    }
    return kv(rows);
  });
  const u0 = list[0] ?? hits[0];
  return {
    title,
    headline: `${key.toUpperCase()} in ${D.P[u0[0] as number]} is ${ST[u0[8] as number].toLowerCase()} — ${D.CFG[u0[4] as number]}, ${sqft(u0[6] as number)}.`,
    blocks: [...blocks, text("Customer names are not shown in chat — open the Bookings tab for the buyer record.")],
    asOn: DATA_AS_ON, open: OPEN,
  };
}

