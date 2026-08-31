/** Shared digital-enquiry dataset, types, scoping and funnel —
 * used by both the Digital tab section and its drill drawer. */
import raw from "../../data/digitalEnquiries.json";
import { dayToDate, dayToYm, ymLabel, DOW, fNum } from "../../utils/footfallLogic";

export interface DigDataset {
  SUB: string[]; PRJ: string[]; STA: string[]; AGN: string[]; OWN: string[]; STG: string[];
  epoch: string; R: number[][];
  meta: { rows: number; source: string; asOn: string; note: string };
}
export const DG = raw as unknown as DigDataset;

export interface DigRec { sub: number; p: number; sta: number; ag: number; ow: number; stg: number; day: number }
export const RECORDS: DigRec[] = DG.R.map(r => ({ sub: r[0], p: r[1], sta: r[2], ag: r[3], ow: r[4], stg: r[5], day: r[6] }));

export type Dim = "sub" | "p" | "sta" | "ag" | "ow" | "stg" | "mon" | "dow";
export interface Chip { dim: Dim; val: number | string; label: string }
export const DIM_NAMES: Record<Dim, string> = {
  sub: "Sub source", p: "Project", sta: "Status", ag: "Agency", ow: "Owner", stg: "Opp. stage", mon: "Month", dow: "Weekday",
};

export function applyChips(records: DigRec[], chips: Chip[]): DigRec[] {
  return records.filter(r =>
    chips.every(c => {
      switch (c.dim) {
        case "sub": return r.sub === c.val;
        case "p":   return r.p === c.val;
        case "sta": return r.sta === c.val;
        case "ag":  return r.ag === c.val;
        case "ow":  return r.ow === c.val;
        case "stg": return r.stg === c.val;
        case "mon": return r.day >= 0 && dayToYm(r.day) === c.val;
        case "dow": return r.day >= 0 && dayToDate(r.day).getDay() === c.val;
        default: return true;
      }
    })
  );
}

/** Digital funnel: enquiry → qualified → opportunity → site-visit-or-
 * beyond → booked. Qualified counts presales Status; the later steps
 * come from the opportunity Stage column (a stage exists ⇔ an
 * opportunity was created). Steps are nested populations. */
export function digitalFunnel(rows: DigRec[]) {
  const total = rows.length;
  const QUAL = DG.STA.indexOf("Qualified");
  const svSet = new Set(["Site Visit", "In Progress", "Inventory", "Booked"].map(s => DG.STG.indexOf(s)).filter(i => i >= 0));
  const BK = DG.STG.indexOf("Booked");
  const qualified = rows.filter(r => r.sta === QUAL || r.stg >= 0).length; // qualified status OR already an opportunity
  const opp = rows.filter(r => r.stg >= 0).length;
  const sv = rows.filter(r => svSet.has(r.stg)).length;
  const booked = rows.filter(r => r.stg === BK).length;
  const lost = rows.filter(r => DG.STG[r.stg] === "Closed Lost").length;
  const steps = [
    { key: "enq", label: "Enquiries", value: total, hint: "every digital enquiry in scope" },
    { key: "qual", label: "Qualified", value: qualified, hint: "presales-qualified or already an opportunity" },
    { key: "opp", label: "Opportunity", value: opp, hint: "opportunity created in CRM" },
    { key: "sv", label: "Site visit+", value: sv, hint: "reached site visit / in-progress / inventory / booked" },
    { key: "bk", label: "Booked", value: booked, hint: "converted to a booking" },
  ].map((s, i, arr) => ({
    ...s,
    pctOfTotal: total ? (s.value / total) * 100 : 0,
    pctOfPrev: i === 0 ? 100 : arr[i - 1].value ? (s.value / arr[i - 1].value) * 100 : 0,
  }));
  return { steps, lost };
}



/** Monthly + weekday aggregation over digital rows. */
export function digMonthly(rows: DigRec[]) {
  const m = new Map<string, number>();
  rows.forEach(r => { if (r.day >= 0) { const ym = dayToYm(r.day); m.set(ym, (m.get(ym) ?? 0) + 1); } });
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, value]) => ({ key, label: ymLabel(key), value }));
}
export function digWeekday(rows: DigRec[]) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  rows.forEach(r => { if (r.day >= 0) c[dayToDate(r.day).getDay()]++; });
  return [1, 2, 3, 4, 5, 6, 0].map(d => ({ key: d, label: DOW[d], value: c[d] }));
}

/** "Key insights" tiles for a digital selection. */
export interface DigInsight { k: string; v: string; hint: string }
export function digInsights(rows: DigRec[]): DigInsight[] {
  const total = rows.length || 1;
  const top = (get: (r: DigRec) => number, names: string[]) => {
    const m = new Map<number, number>();
    rows.forEach(r => { const k = get(r); if (k >= 0) m.set(k, (m.get(k) ?? 0) + 1); });
    const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    return best ? { name: names[best[0]], n: best[1] } : null;
  };
  const out: DigInsight[] = [];
  const ts = top(r => r.sub, DG.SUB);
  if (ts) out.push({ k: "Top sub-source", v: `${ts.name} · ${Math.round((ts.n / total) * 100)}%`, hint: `${fNum(ts.n)} of ${fNum(total)} enquiries` });
  const tp = top(r => r.p, DG.PRJ);
  if (tp) out.push({ k: "Top project", v: `${tp.name} · ${Math.round((tp.n / total) * 100)}%`, hint: `${fNum(tp.n)} enquiries` });
  const QUAL = DG.STA.indexOf("Qualified");
  const q = rows.filter(r => r.sta === QUAL).length;
  out.push({ k: "Qualification rate", v: `${((q / total) * 100).toFixed(1)}%`, hint: `${fNum(q)} presales-qualified` });
  const opp = rows.filter(r => r.stg >= 0).length;
  out.push({ k: "Opportunity conversion", v: `${((opp / total) * 100).toFixed(1)}%`, hint: `${fNum(opp)} opportunities created` });
  const ta = top(r => r.ag, DG.AGN);
  if (ta) out.push({ k: "Top agency", v: ta.name, hint: `${fNum(ta.n)} enquiries` });
  const to_ = top(r => r.ow, DG.OWN);
  if (to_) out.push({ k: "Top presales owner", v: to_.name, hint: `${fNum(to_.n)} handled` });
  const mm = new Map<string, number>();
  rows.forEach(r => { if (r.day >= 0) { const ym = dayToYm(r.day); mm.set(ym, (mm.get(ym) ?? 0) + 1); } });
  const bm = [...mm.entries()].sort((a, b) => b[1] - a[1])[0];
  if (bm) out.push({ k: "Busiest month", v: `${ymLabel(bm[0])} · ${fNum(bm[1])}`, hint: "highest monthly volume" });
  const BK = DG.STG.indexOf("Booked");
  const bk = rows.filter(r => r.stg === BK).length;
  out.push({ k: "Booking outcome", v: `${fNum(bk)} booked · ${((bk / total) * 100).toFixed(2)}%`, hint: "share of enquiries booked" });
  return out;
}
