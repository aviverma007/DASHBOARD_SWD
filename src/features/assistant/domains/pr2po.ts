/** PR → PO pipeline: live feed from the VendorGlobe API, same journey model as the tab. */
import type { Ctx, Section } from "../types";
import { barBlock, kv, rowsOf, text } from "./common";
import { fN, inr, norm } from "../nlp";

const API_BASE = "http://192.168.66.28:5002";
const OPEN = { label: "Open PR to PO", path: "/pr-to-po" };

export async function runPr2Po(c: Ctx): Promise<Section> {
  const title = "PR to PO";
  const today = new Date().toISOString().slice(0, 10);
  const from = c.period.explicit && c.period.kind !== "all" ? c.period.from.toISOString().slice(0, 10) : "2026-05-01";
  const to = c.period.explicit && c.period.kind !== "all" ? (c.period.to.toISOString().slice(0, 10) < today ? c.period.to.toISOString().slice(0, 10) : today) : today;
  let raw: { ok?: boolean; error?: string; sap_pr: Record<string, string>[]; sap_po: Record<string, string>[]; vg: Record<string, string>[] };
  try {
    const r = await fetch(`${API_BASE}/pr2po/data?startdate=${from}&enddate=${to}`);
    raw = await r.json();
    if (!raw.ok) throw new Error(raw.error || "backend error");
  } catch (e) {
    return {
      title, headline: "The PR to PO live feed is not reachable right now.",
      blocks: [text(`I could not reach the VendorGlobe service (${String((e as Error).message || e)}). Check that it is running and that you are on the office network, then ask again.`)],
      open: OPEN,
    };
  }
  const { buildJourneys, STAGES, plantOf, idleDays } = await import("../../pr2po/PrToPoPage");
  const all = buildJourneys(raw as never);

  /* single PR / PO lookup */
  const num = c.raw.match(/\b(\d{7,10})\b/);
  if (num) {
    const n = num[1];
    const j = all.find(x => x.id.replace(/^0+/, "") === n.replace(/^0+/, "")) ?? all.find(x => String(x.po?.EBELN ?? "").replace(/^0+/, "") === n.replace(/^0+/, ""));
    if (!j) return { title: `PR / PO ${n}`, headline: `I could not find ${n} between ${from} and ${to}.`, blocks: [text("It may be outside this date window — ask again with a period, for example 'PR 11001 in August 2026'.")], open: OPEN };
    const state = j.done ? "Completed (PO approved)" : j.exception ? j.exception : `Pending at ${STAGES[j.stageIdx]?.l ?? "—"}`;
    return {
      title: `PR ${j.id}`,
      headline: `PR ${j.id} — ${state}${j.pendingLevel ? ` · ${j.pendingLevel}` : ""}${j.pendingSince ? ` · idle ${idleDays(j.pendingSince)} days` : ""}.`,
      blocks: [kv([["Description", j.desc || "—"], ["Project / plant", plantOf(j) ?? "—"], ["Department", j.dept], ["Vendor", j.vendor], ["Value", j.value ? inr(j.value) : "—"],
        ["Status", state], ["Pending with", j.pendingWith || "—"], ["Approval level", j.pendingLevel ?? "—"], ["PO number", String(j.po?.EBELN ?? "—")]])],
      open: OPEN,
    };
  }

  const flow = /\bqms( direct)?\b/.test(c.nq) && /\bdirect\b/.test(c.nq) ? "vg" : "sap";
  let rows = all.filter(j => j.origin === flow);
  if (c.ents.length) rows = rows.filter(j => { const p = norm(plantOf(j) ?? ""); return c.ents.some(e => e.ds.test(p)); });
  const completed = rows.filter(j => j.done);
  const exceptions = rows.filter(j => j.exception && !j.done);
  const inFlight = rows.filter(j => !j.done && !j.exception);
  const poStage = inFlight.filter(j => j.reached.po_created);

  const byStage = STAGES.map((s, i) => ({ s, n: inFlight.filter(j => j.stageIdx === i).length })).filter(x => x.n > 0);
  const lvl = new Map<string, number>();
  inFlight.forEach(j => { if (j.pendingLevel) lvl.set(j.pendingLevel, (lvl.get(j.pendingLevel) ?? 0) + 1); });
  const oldest = [...inFlight].filter(j => j.pendingSince).sort((a, b) => (a.pendingSince ?? 0) - (b.pendingSince ?? 0)).slice(0, c.topN);
  const value = inFlight.reduce((s, j) => s + (j.value || 0), 0);

  const blocks = [
    kv([["Total PRs", `${fN(rows.length)} (${from} → ${to})`], ["Completed (PO approved)", fN(completed.length)],
      ["In-flight", `${fN(inFlight.length)}${poStage.length ? ` · incl. ${fN(poStage.length)} at PO stage` : ""}`], ["Returned / cancelled", fN(exceptions.length)], ["Value in-flight", inr(value)]]),
    barBlock("In-flight PRs — where they are pending", byStage.map(x => ({ label: x.s.pend, value: x.n, text: fN(x.n) }))),
  ];
  if (lvl.size) blocks.push(barBlock("Pending at which approval level", [...lvl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ label: k, value: v, text: fN(v) }))));
  if (oldest.length) blocks.push(rowsOf(["Longest-waiting PR", "Pending at", "Level", "Idle (days)"], oldest.map(j => [`${j.id} · ${plantOf(j) ?? j.dept}`, STAGES[j.stageIdx]?.short ?? "—", j.pendingLevel ?? "—", j.pendingSince ? String(idleDays(j.pendingSince)) : "—"])));
  return {
    title,
    headline: `${c.ents.length ? c.ents.map(e => e.label).join(" + ") + ": " : ""}${fN(rows.length)} PRs — ${fN(completed.length)} reached PO, ${fN(inFlight.length)} in flight, ${fN(exceptions.length)} returned/cancelled.`,
    blocks, asOn: `live ${today}`, open: OPEN,
  };
}
