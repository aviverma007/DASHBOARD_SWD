/** Vendor ageing / payables (SAP open items). */
import { VA, VA_ROWS } from "../../../components/cost/vendorAgeingShared";
import type { Ctx, Section } from "../types";
import { fN, inr, norm, pct } from "../nlp";
import { barBlock, kv, moreNote, rowsOf, text, topRows } from "./common";

const ASON = VA.meta.asOn;
const OPEN = { label: "Open Cost → Vendor Ageing", path: "/cost" };
const STOP = new Set(("how much what is the are our we owe owed to of for from vendor vendors supplier suppliers payable payables payment payments ageing aging outstanding " +
  "overdue due amount total balance show me list tell about with and or in on at by all any top bucket buckets days day older than over more unpaid pending blocked block " +
  "items item open invoice invoices bills bill pay paying").split(" "));

export async function runVendors(c: Ctx): Promise<Section> {
  const title = "Vendor payables";
  const tokens = c.nq.split(" ").filter(t => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t));

  /* a specific vendor? */
  let vendHits: number[] = [];
  if (tokens.length) {
    const scored = VA.VEND.map((v, i) => ({ i, s: tokens.filter(t => norm(v).includes(t)).length })).filter(x => x.s > 0);
    const best = Math.max(0, ...scored.map(x => x.s));
    if (best >= Math.min(2, tokens.length)) vendHits = scored.filter(x => x.s === best).map(x => x.i);
  }

  const over = (b: number) => b >= 1;
  if (vendHits.length && vendHits.length <= 6) {
    const blocks = vendHits.slice(0, 4).map(vi => {
      const rs = VA_ROWS.filter(r => r.vend === vi);
      const net = rs.reduce((s, r) => s + r.amt, 0);
      const od = rs.filter(r => over(r.bucket)).reduce((s, r) => s + r.amt, 0);
      const b180 = rs.filter(r => r.bucket === 6).reduce((s, r) => s + r.amt, 0);
      return kv([["Vendor", VA.VEND[vi]], ["Net outstanding", inr(net)], ["Overdue (past due date)", inr(od)], ["> 180 days", inr(b180)], ["Open items", fN(rs.length)],
        ["Payment blocked", fN(rs.filter(r => r.blocked === 1).length) + " items"]]);
    });
    const v0 = vendHits[0], n0 = VA_ROWS.filter(r => r.vend === v0).reduce((s, r) => s + r.amt, 0);
    return {
      title, headline: `${VA.VEND[v0]}: net outstanding ${inr(n0)}${vendHits.length > 1 ? ` (+${vendHits.length - 1} similar vendor names)` : ""}.`,
      blocks: [...blocks, text("Sign follows the Vendor Ageing tab: negative = credit/payable balance as posted in SAP.")], asOn: ASON, open: OPEN,
    };
  }

  const rows = VA_ROWS;
  const total = rows.reduce((s, r) => s + r.amt, 0);
  const odAmt = rows.filter(r => over(r.bucket)).reduce((s, r) => s + r.amt, 0);
  const b180 = rows.filter(r => r.bucket === 6).reduce((s, r) => s + r.amt, 0);
  const blocked = rows.filter(r => r.blocked === 1).reduce((s, r) => s + r.amt, 0);
  const byB = VA.BUCKET.map((b, k) => ({ b, v: rows.filter(r => r.bucket === k).reduce((s, r) => s + r.amt, 0), n: rows.filter(r => r.bucket === k).length }));
  const m = new Map<number, number>();
  rows.forEach(r => m.set(r.vend, (m.get(r.vend) ?? 0) + r.amt));
  const vlist = [...m.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const { shown, more } = topRows(vlist, c.topN);
  const blocks = [
    kv([["Net outstanding", inr(total)], ["Overdue (past due date)", `${inr(odAmt)} · ${pct(odAmt, total, 0)}`], ["Overdue > 180 days", `${inr(b180)} · ${pct(b180, total, 0)}`],
      ["Payment blocked", inr(blocked)], ["Open items / vendors", `${fN(rows.length)} / ${fN(m.size)}`]]),
    barBlock("Ageing buckets", byB.map(x => ({ label: x.b, value: Math.abs(x.v), text: `${inr(x.v)} · ${fN(x.n)} items` }))),
    rowsOf(["Largest vendor balances", "Net outstanding"], shown.map(([k, v]) => [VA.VEND[k], inr(v)]), moreNote(more, "vendors")),
    text("Vendor ageing is a point-in-time SAP open-items snapshot, so it cannot be filtered by month. Ask by vendor name for one vendor's balance."),
  ];
  return { title, headline: `Net vendor outstanding ${inr(total)}; ${inr(odAmt)} is past due and ${inr(b180)} is older than 180 days.`, blocks, asOn: ASON, open: OPEN };
}
