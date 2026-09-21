import { useEffect, useMemo, useState } from "react";
import { PageBanner, BannerPills, BANNER_LBL, BANNER_CTL } from "../../components/layout/PageBanner";
import { Zoomable } from "../../components/common/Zoomable";
import { showTip, hideTip } from "../../components/common/hoverTip";
import "../../components/inventory/smartworldInventory.css";

/** PR → PO Journey — live from the PR2PO backend on the VendorGlobe
 * API server. One journey per PR number, stitched from three legs:
 *   SAP PR   (SAP_PR mirror: Erdat created → Frgdt released → Ebeln PO)
 *   QMS PR   (VendorGlobe: validators → CP team → assignee, PRH status)
 *   NFA      (VendorGlobe: vendor selection, level 1–8 approvals)
 *   SAP PO   (SAP_PO mirror: BADAT created → FRGZU/FRGKE/PROCSTAT release)
 */

const API_BASE = "http://192.168.66.28:5002"; // VendorGlobe_API service

const NAVY = "#14213D", TEAL = "#0E7490", GOLD = "#B8893C", GREEN = "#1BAF7A", RED = "#c0392b", AMBER = "#EDA100";
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #eae6da", borderRadius: 12, boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)", padding: "14px 16px", marginBottom: 14 };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 15.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 2px" };
const CAP: React.CSSProperties = { fontSize: 11, color: "var(--mut)", marginBottom: 10 };
const TH: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "8px 10px", borderBottom: "2px solid #eae6da", whiteSpace: "nowrap", textAlign: "left" };
const TD: React.CSSProperties = { padding: "6px 10px", borderBottom: "1px solid #f0ede5", whiteSpace: "nowrap" };
const fN = (n: number) => Math.round(n).toLocaleString("en-IN");
const fMoney = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
};
const GLASS = (c1: string, c2: string): React.CSSProperties => ({
  background: `linear-gradient(150deg, ${c1} 0%, ${c2} 100%)`,
  border: "1px solid rgba(255,255,255,.35)", borderRadius: 14,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), 0 10px 24px rgba(20,33,61,.28), 0 2px 6px rgba(20,33,61,.18)",
  padding: "14px 16px", color: "#fff", position: "relative", overflow: "hidden",
});

/* ---------------- date handling ---------------- */
/** Robust parse for the mixed formats the two systems emit:
 * "2026-07-21", "2026-07-15 15:10:32", "15/07/2026", "" / "NA" /
 * "0000-00-00 00:00:00" / None → null. Returns ms epoch. */
function pDate(v: string | null | undefined): number | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s || s === "NA" || s === "None" || s.startsWith("0000")) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    return Number.isFinite(t) && +m[1] > 2000 ? t : null;
  }
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  return null;
}
const DAY = 86400000;
const days = (a: number, b: number) => Math.round((b - a) / DAY);
const fD = (t: number | null) =>
  t === null ? "—" : new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" });
const todayUtc = () => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); };
/** days idle since t, clamped at 0 — some QMS/NFA dates are future-dated
 *  data-entry artifacts and must not produce negative idle */
const idleDays = (t: number) => Math.max(0, days(t, todayUtc()));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/* ---------------- journey model ---------------- */
export interface Stage { k: string; l: string; short: string }
export const STAGES: Stage[] = [
  { k: "sap_created", l: "SAP PR Created", short: "SAP PR" },
  { k: "sap_released", l: "SAP PR Approved", short: "SAP Appr" },
  { k: "qms_created", l: "QMS PR Created", short: "QMS PR" },
  { k: "qms_approved", l: "QMS PR Approved", short: "QMS Appr" },
  { k: "nfa_created", l: "NFA / Vendor Selection", short: "NFA" },
  { k: "nfa_approved", l: "NFA Approved", short: "NFA Appr" },
  { k: "po_created", l: "PO Created", short: "PO" },
  { k: "po_released", l: "PO Approved", short: "PO Appr" },
];
const STAGE_COLS = ["#1c3f6e", "#2a5c8f", "#0E7490", "#0f8a7a", "#B8893C", "#c99a3a", "#1BAF7A", "#0f8a5f"];

interface Journey {
  id: string;                       // PR number (Banfn / EPR_No)
  origin: "sap" | "vg";             // where the journey starts
  desc: string;
  plant: string; project: string; dept: string; vendor: string;
  value: number;                    // best-known value (PO > VG > PR lines)
  /** ms per stage key; null = not reached (or date unknown but reached) */
  m: Record<string, number | null>;
  reached: Record<string, boolean>;
  exception: string | null;         // Returned / Cancelled / Deleted …
  stageIdx: number;                 // first un-reached stage (= where it sits)
  done: boolean;                    // reached po_released
  pendingWith: string;
  pendingSince: number | null;
  vg: Record<string, string | null> | null;
  po: Record<string, string | null> | null;
  poApprox: boolean;                // po_released date approximated by AEDAT
  poItemsGone: number;              // PO items SAP stopped returning (deleted)
  poItemsSeen: number;              // PO items ever synced from the live feed
}

/* SAP's OData entity silently drops deleted items instead of sending
 * Loekz='X', so cancellation is inferred: every synced item of the PO has
 * vanished from the feed (backend sets CANCELLED), or a real deletion
 * indicator arrives once the entity is fixed. */
const poCancelled = (pos: Rec[]) =>
  pos.length > 0 && pos.every(p =>
    p.CANCELLED === "1" || p.LOEKZ === "L" || p.LOEKZ === "X" || p.LOEKZ === "1" || p.LOEKZ === "True");
const goneOf = (pos: Rec[], k: "ITEMS_GONE" | "ITEMS_SEEN") =>
  pos.reduce((s, p) => s + (parseInt(String(p[k] ?? "0"), 10) || 0), 0);

function buildJourneys(data: { sap_pr: Rec[]; sap_po: Rec[]; vg: Rec[] }): Journey[] {
  type R = Rec;
  const poByNo = new Map<string, R>();
  const poByBanfn = new Map<string, R[]>();
  data.sap_po.forEach(p => {
    if (p.EBELN) poByNo.set(String(p.EBELN), p);
    const bn = String(p.BANFN || "");
    if (bn) { if (!poByBanfn.has(bn)) poByBanfn.set(bn, []); poByBanfn.get(bn)!.push(p); }
  });
  const vgByNo = new Map<string, R>();
  data.vg.forEach(v => { if (v.EPR_No) vgByNo.set(String(v.EPR_No), v); });

  // group SAP PR lines to header
  const sapByNo = new Map<string, R[]>();
  data.sap_pr.forEach(l => {
    const k = String(l.Banfn || "");
    if (!k) return;
    if (!sapByNo.has(k)) sapByNo.set(k, []);
    sapByNo.get(k)!.push(l);
  });

  const out: Journey[] = [];
  const seen = new Set<string>();

  const mkFromVg = (v: R, m: Journey["m"], reached: Journey["reached"]) => {
    m.qms_created = pDate(v.PR_Created_Date) ?? pDate(v.PRN_Date);
    reached.qms_created = m.qms_created !== null;
    const prApproved = v.PRH_Status_Desc === "Approved";
    const qDates = [v.Validator_One_Date, v.Validator_Two_Date, v.CP_Team_Date, v.Assignee_Team_Date]
      .map(pDate).filter((x): x is number => x !== null);
    if (prApproved) { reached.qms_approved = true; m.qms_approved = qDates.length ? Math.max(...qDates) : null; }
    m.nfa_created = pDate(v.NFA_Created_Date) ?? pDate(v.ENFA_Date);
    reached.nfa_created = m.nfa_created !== null;
    const nfaApproved = v.NFA_Status_Desc === "Approved";
    const lDates = [v.Level_One_Date, v.Level_Two_Date, v.Level_Three_Date, v.Level_Four_Date,
      v.Level_Five_Date, v.Level_Six_Date, v.Level_Seven_Date, v.Level_Eight_Date]
      .map(pDate).filter((x): x is number => x !== null);
    if (nfaApproved) { reached.nfa_approved = true; m.nfa_approved = lDates.length ? Math.max(...lDates) : null; }
  };

  const finish = (j: Journey, v: R | null) => {
    // exception states (terminal): anything Returned / Cancelled / Deleted
    if (v && !j.exception) {
      const pr = String(v.PRH_Status_Desc || "");
      const nf = String(v.NFA_Status_Desc || "");
      if (/Cancel/i.test(pr)) j.exception = "QMS PR Cancelled";
      else if (/Return/i.test(pr)) j.exception = "QMS PR Returned";
      else if (/Cancel/i.test(nf)) j.exception = "NFA Cancelled";
      else if (/Return/i.test(nf)) j.exception = "NFA Returned";
    }
    const applicable = STAGES.filter(s => !(j.origin === "vg" && (s.k === "sap_created" || s.k === "sap_released")));
    let idx = applicable.length;
    for (let i = 0; i < applicable.length; i++) {
      if (!j.reached[applicable[i].k]) { idx = i; break; }
    }
    j.done = applicable.every(s => j.reached[s.k]);
    j.stageIdx = STAGES.findIndex(s => s.k === (applicable[idx]?.k ?? "po_released"));
    if (j.done) j.stageIdx = STAGES.length;

    // pending-with for the stage it sits at
    const at = applicable[idx]?.k;
    if (!j.done && !j.exception) {
      if (at === "sap_released") j.pendingWith = "SAP Release";
      else if (at === "qms_created") j.pendingWith = "QMS Replication";
      else if (at === "qms_approved") j.pendingWith = (j.vg?.PR_Pending_With && j.vg.PR_Pending_With !== "NA" ? j.vg.PR_Pending_With : "QMS Approval") as string;
      else if (at === "nfa_created") j.pendingWith = "NFA Creation";
      else if (at === "nfa_approved") j.pendingWith = (j.vg?.NFA_Pending_With && j.vg.NFA_Pending_With !== "NA" ? j.vg.NFA_Pending_With : "NFA Approval") as string;
      else if (at === "po_created") j.pendingWith = "PO Creation (SAP)";
      else if (at === "po_released") j.pendingWith = "PO Release (SAP)";
    }
    // pending since = last reached milestone date
    const reachedDates = STAGES.map(s => j.m[s.k]).filter((x): x is number => x !== null);
    j.pendingSince = reachedDates.length ? Math.max(...reachedDates) : null;
    out.push(j);
  };

  sapByNo.forEach((lines, banfn) => {
    seen.add(banfn);
    // Badat is the true requisition date; this extract's Erdat is a
    // refresh date (often later, sometimes after Frgdt).
    const erdats = lines.map(l => pDate(l.Badat) ?? pDate(l.Erdat)).filter((x): x is number => x !== null);
    const frgdts = lines.map(l => pDate(l.Frgdt)).filter((x): x is number => x !== null);
    const v = vgByNo.get(banfn) ?? null;
    const first = lines[0];
    const deleted = lines.every(l => l.Loekz === "True" || l.Loekz === "1");
    const ebelns = [...new Set(lines.map(l => String(l.Ebeln || "")).filter(Boolean))];
    const pos = ebelns.map(e => poByNo.get(e)).filter((p): p is R => !!p);
    // guard against the OData entity duplicating document totals onto
    // every line: all-identical line values -> count once, not summed
    const lineNet = lines.map(l => parseFloat(String(l.Netwr)) || 0);
    const lineVal = lineNet.length > 1 && new Set(lineNet).size === 1 ? lineNet[0] : lineNet.reduce((s, x) => s + x, 0);
    const poVal = pos.reduce((s, p) => s + (parseFloat(String(p.NETWR)) || 0), 0);

    const m: Journey["m"] = {}; const reached: Journey["reached"] = {};
    STAGES.forEach(s => { m[s.k] = null; reached[s.k] = false; });
    m.sap_created = erdats.length ? Math.min(...erdats) : null;
    reached.sap_created = true;
    if (frgdts.length) { reached.sap_released = true; m.sap_released = Math.max(...frgdts); }
    if (v) mkFromVg(v, m, reached);
    if (pos.length) {
      reached.po_created = true;
      const badats = pos.map(p => pDate(p.BADAT)).filter((x): x is number => x !== null);
      m.po_created = badats.length ? Math.min(...badats) : null;
      const released = !poCancelled(pos) && pos.every(p => p.FRGKE === "G" || p.PROCSTAT === "05" || p.PROCSTAT === "5");
      if (released) {
        reached.po_released = true;
        const aedats = pos.map(p => pDate(p.AEDAT)).filter((x): x is number => x !== null);
        m.po_released = aedats.length ? Math.max(...aedats) : null;
      }
    }
    const j: Journey = {
      id: banfn, origin: "sap",
      desc: String(v?.Scope || first.Txz01 || "—"),
      plant: String(first.PlantDesc || "—"), project: String(v?.Project_Name || "—"),
      dept: String(first.Eknam || first.Ekgrp || "—"),
      vendor: String(pos[0]?.NAME1 || v?.Vendor_Name || "—"),
      value: poVal || parseFloat(String(v?.Amount_Including_Tax)) || lineVal,
      m, reached,
      exception: deleted ? "PR Deleted in SAP" : poCancelled(pos) ? "PO Cancelled in SAP" : null,
      stageIdx: 0, done: false, pendingWith: "", pendingSince: null,
      vg: v, po: pos[0] ?? null,
      poApprox: reached.po_released,
      poItemsGone: goneOf(pos, "ITEMS_GONE"), poItemsSeen: goneOf(pos, "ITEMS_SEEN"),
    };
    finish(j, v);
  });

  // VendorGlobe-only journeys (created in QMS directly, or SAP PR outside window)
  data.vg.forEach(v => {
    const epr = String(v.EPR_No || "");
    if (!epr || seen.has(epr)) return;
    const m: Journey["m"] = {}; const reached: Journey["reached"] = {};
    STAGES.forEach(s => { m[s.k] = null; reached[s.k] = false; });
    mkFromVg(v, m, reached);
    if (!reached.qms_created) return;
    // Live SAP OData POs carry BANFN, so a QMS journey whose SAP PR is
    // missing from the stale mirror still reaches the PO stages.
    const pos = poByBanfn.get(epr) ?? [];
    if (pos.length) {
      reached.po_created = true;
      const badats = pos.map(p => pDate(p.BADAT)).filter((x): x is number => x !== null);
      m.po_created = badats.length ? Math.min(...badats) : null;
      const released = !poCancelled(pos) && pos.every(p => p.FRGKE === "G" || p.PROCSTAT === "05" || p.PROCSTAT === "5");
      if (released) {
        reached.po_released = true;
        const aedats = pos.map(p => pDate(p.AEDAT)).filter((x): x is number => x !== null);
        m.po_released = aedats.length ? Math.max(...aedats) : null;
      }
    }
    const poVal = pos.reduce((s2, p) => s2 + (parseFloat(String(p.NETWR)) || 0), 0);
    const j: Journey = {
      id: epr, origin: "vg",
      desc: String(v.Scope || "—"), plant: "—", project: String(v.Project_Name || "—"),
      dept: String(v.PRH_Category_Name || "—"), vendor: String(pos[0]?.NAME1 || v.Vendor_Name || "—"),
      value: poVal || parseFloat(String(v.Amount_Including_Tax)) || parseFloat(String(v.PR_Budget)) || 0,
      m, reached, exception: poCancelled(pos) ? "PO Cancelled in SAP" : null,
      stageIdx: 0, done: false,
      pendingWith: "", pendingSince: null, vg: v, po: pos[0] ?? null,
      poApprox: reached.po_released,
      poItemsGone: goneOf(pos, "ITEMS_GONE"), poItemsSeen: goneOf(pos, "ITEMS_SEEN"),
    };
    finish(j, v);
  });

  return out;
}
type Rec = Record<string, string | null>;

/* ---------------- drill list drawer (click any chart segment) ---------------- */
export interface ListSel { title: string; sub?: string; rows: { j: Journey; note?: string }[] }

function MiniBars({ title, data, color = TEAL, max = 8 }: { title: string; data: [string, number][]; color?: string; max?: number }) {
  const bars = data.filter(([, n]) => n > 0).slice(0, max);
  if (!bars.length) return null;
  const mx = Math.max(...bars.map(b => b[1]), 1);
  return (
    <div style={{ background: "#fff", border: "1px solid #eae6da", borderRadius: 10, padding: "10px 13px", marginBottom: 10 }}>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5 }}>{title}</div>
      {bars.map(([l, n]) => (
        <div key={l} style={{ padding: "3px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, gap: 8 }}>
            <span style={{ fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l}</span>
            <span style={{ fontWeight: 800, color: "var(--mut)", whiteSpace: "nowrap" }}>{fN(n)}</span>
          </div>
          <div style={{ height: 7, background: "#f0ede5", borderRadius: 4, overflow: "hidden", marginTop: 2 }}>
            <div style={{ height: "100%", width: `${(n / mx) * 100}%`, background: color, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function count<T>(items: T[], key: (t: T) => string | null): [string, number][] {
  const m = new Map<string, number>();
  items.forEach(t => { const k = key(t); if (k) m.set(k, (m.get(k) ?? 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
function ListDrawer({ sel, onPick, onClose }: { sel: ListSel | null; onPick: (j: Journey) => void; onClose: () => void }) {
  if (!sel) return null;
  const totVal = sel.rows.reduce((s, r) => s + r.j.value, 0);
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.30)", zIndex: 60 }} />
      <div style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(480px, 92vw)", zIndex: 61, background: "#f6f4ef", boxShadow: "-14px 0 46px rgba(20,33,61,.35)", display: "flex", flexDirection: "column" }}>
        <div style={{ background: NAVY, padding: "14px 18px", borderBottom: "3px solid var(--gold)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", color: "#c9b27c" }}>DRILL-DOWN</div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 16.5, fontWeight: 700, color: "#fff", marginTop: 2 }}>{sel.title}</div>
            </div>
            <button onClick={onClose} aria-label="Close" style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 8, fontSize: 15, cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ color: "rgba(255,255,255,.8)", fontSize: 12, marginTop: 6 }}>
            {fN(sel.rows.length)} PR{sel.rows.length === 1 ? "" : "s"}{totVal ? ` · ${fMoney(totVal)}` : ""}{sel.sub ? ` · ${sel.sub}` : ""}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
          {sel.rows.length === 0 && <div style={{ textAlign: "center", color: "var(--mut)", fontWeight: 600, padding: 30 }}>No journeys in this segment.</div>}
          {sel.rows.length > 0 && (() => {
            const js = sel.rows.map(r => r.j);
            const fl = js.filter(j => !j.done && !j.exception);
            const idles = fl.map(j => (j.pendingSince !== null ? idleDays(j.pendingSince) : null)).filter((x): x is number => x !== null);
            const tiles: [string, string, string][] = [
              ["PRs", fN(js.length), TEAL],
              ["Value", fMoney(js.reduce((s, j) => s + j.value, 0)), NAVY],
              ["In-flight", fN(fl.length), "#1a7f9c"],
              ["Completed", fN(js.filter(j => j.done).length), GREEN],
              ["Exceptions", fN(js.filter(j => j.exception).length), RED],
              ["Avg idle", idles.length ? `${(idles.reduce((a, b) => a + b, 0) / idles.length).toFixed(0)} d` : "—", AMBER],
            ];
            const monthOf = (j: Journey) => { const c = j.m.sap_created ?? j.m.qms_created; return c !== null ? new Date(c).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }) : null; };
            const monthKey = (j: Journey) => { const c = j.m.sap_created ?? j.m.qms_created; return c !== null ? iso(c).slice(0, 7) : ""; };
            const mm = new Map<string, number>();
            js.slice().sort((a, b) => monthKey(a).localeCompare(monthKey(b))).forEach(j => {
              const l = monthOf(j); if (l) mm.set(l, (mm.get(l) ?? 0) + 1);
            });
            const months: [string, number][] = [...mm.entries()];
            return (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                  {tiles.map(([k, v, c]) => (
                    <div key={k} style={{ background: "#fff", border: "1px solid #eae6da", borderLeft: `4px solid ${c}`, borderRadius: 10, padding: "7px 10px" }}>
                      <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
                      <div style={{ fontFamily: "Georgia,serif", fontSize: 16, fontWeight: 700, color: "var(--ink)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</div>
                    </div>
                  ))}
                </div>
                <MiniBars title="By stage" color={TEAL}
                  data={count(js, j => j.exception ?? (j.done ? "Completed" : STAGES[Math.min(j.stageIdx, 7)].l))} />
                <MiniBars title="Pending with" color={GOLD}
                  data={count(fl, j => j.pendingWith || "—")} />
                <MiniBars title="By project / plant" color={NAVY}
                  data={count(js, j => (j.project !== "—" ? j.project : j.plant !== "—" ? j.plant : null))} />
                <MiniBars title="Idle ageing" color={RED}
                  data={[["0–7 d", 0, 7], ["8–15 d", 8, 15], ["16–30 d", 16, 30], ["31–60 d", 31, 60], ["> 60 d", 61, 1e9]]
                    .map(([l, lo, hi]) => [l as string, idles.filter(d => d >= (lo as number) && d <= (hi as number)).length] as [string, number])} />
                <MiniBars title="Created by month" color="#2a5c8f" max={12} data={months} />
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", margin: "12px 2px 6px" }}>PR list · {fN(js.length)}</div>
              </>
            );
          })()}
          {sel.rows.map(({ j, note }) => {
            const stageLbl = j.exception ?? (j.done ? "Completed" : STAGES[Math.min(j.stageIdx, 7)].l);
            const stageCol = j.exception ? RED : j.done ? GREEN : STAGE_COLS[Math.min(j.stageIdx, 7)];
            const idle = !j.done && !j.exception && j.pendingSince !== null ? idleDays(j.pendingSince) : null;
            return (
              <div key={j.id} onClick={() => onPick(j)}
                style={{ background: "#fff", border: "1px solid #eae6da", borderRadius: 10, padding: "9px 12px", marginBottom: 8, cursor: "pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GOLD; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#eae6da"; }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>{j.id}</span>
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {note && <span style={{ background: `${GOLD}22`, color: "#96691c", fontWeight: 800, fontSize: 10.5, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{note}</span>}
                    <span style={{ background: `${stageCol}1c`, color: stageCol, fontWeight: 800, fontSize: 10, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{stageLbl}</span>
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.desc}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--mut)", marginTop: 3, fontWeight: 600 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {j.done || j.exception ? (j.po?.EBELN ? `PO ${j.po.EBELN}` : "—") : `with ${j.pendingWith || "—"}`}
                  </span>
                  <span style={{ whiteSpace: "nowrap" }}>{idle !== null ? `idle ${idle} d · ` : ""}{j.value ? fMoney(j.value) : ""}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "8px 14px", borderTop: "1px solid #e5e0d2", fontSize: 11, color: "var(--mut)", fontWeight: 600 }}>Click a PR for its full milestone timeline</div>
      </div>
    </>
  );
}

/* ---------------- small chart: monthly created vs PO ---------------- */
function TrendChart({ rows, onPick }: { rows: Journey[]; onPick?: (monthKey: string, label: string) => void }) {
  const data = useMemo(() => {
    const m = new Map<string, { c: number; p: number }>();
    rows.forEach(j => {
      const c = j.m.sap_created ?? j.m.qms_created;
      if (c !== null) { const k = iso(c).slice(0, 7); if (!m.has(k)) m.set(k, { c: 0, p: 0 }); m.get(k)!.c++; }
      if (j.m.po_created !== null) { const k = iso(j.m.po_created).slice(0, 7); if (!m.has(k)) m.set(k, { c: 0, p: 0 }); m.get(k)!.p++; }
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);
  const mx = Math.max(...data.map(([, e]) => Math.max(e.c, e.p)), 1);
  const lbl = (k: string) => new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 190, overflow: "hidden", paddingTop: 6 }}>
      {data.map(([k, e]) => (
        <div key={k} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end", cursor: onPick ? "pointer" : "default" }}
          onClick={() => onPick?.(k, lbl(k))}
          onMouseEnter={ev => showTip(ev, `<b>${lbl(k)}</b><br/>PRs created — ${fN(e.c)}<br/>POs created — ${fN(e.p)}<br/>click → list`)}
          onMouseMove={ev => showTip(ev, `<b>${lbl(k)}</b> ${fN(e.c)} / ${fN(e.p)}`)} onMouseLeave={hideTip}>
          <div style={{ width: "70%", display: "flex", gap: 2, alignItems: "flex-end", height: "82%" }}>
            <div style={{ flex: 1, height: `${(e.c / mx) * 100}%`, background: NAVY, borderRadius: "3px 3px 0 0", minHeight: e.c ? 2 : 0 }} />
            <div style={{ flex: 1, height: `${(e.p / mx) * 100}%`, background: GREEN, borderRadius: "3px 3px 0 0", minHeight: e.p ? 2 : 0 }} />
          </div>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--mut)", whiteSpace: "nowrap" }}>{lbl(k)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- journey drawer ---------------- */
function JourneyDrawer({ j, onClose }: { j: Journey | null; onClose: () => void }) {
  if (!j) return null;
  const applicable = STAGES.filter(s => !(j.origin === "vg" && s.k.startsWith("sap_")));
  let prev: number | null = null;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.35)", zIndex: 70 }} />
      <div style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(560px, 95vw)", zIndex: 71, background: "#f6f4ef", boxShadow: "-14px 0 46px rgba(20,33,61,.35)", display: "flex", flexDirection: "column" }}>
        <div style={{ background: NAVY, padding: "14px 18px", borderBottom: "3px solid var(--gold)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", color: "#c9b27c" }}>
                PR JOURNEY {j.exception ? `· ${j.exception.toUpperCase()}` : j.done ? "· COMPLETED" : `· AT ${STAGES[Math.min(j.stageIdx, 7)].l.toUpperCase()}`}
              </div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "#fff", marginTop: 2 }}>PR {j.id}</div>
            </div>
            <button onClick={onClose} aria-label="Close" style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 8, fontSize: 15, cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ color: "rgba(255,255,255,.8)", fontSize: 12, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.desc}</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14, fontSize: 12 }}>
            {[["Project / Plant", j.project !== "—" ? j.project : j.plant], ["Department", j.dept], ["Vendor", j.vendor], ["Value", j.value ? fMoney(j.value) : "—"]].map(([k, v]) => (
              <div key={k} style={{ background: "#fff", border: "1px solid #eae6da", borderRadius: 10, padding: "8px 11px" }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
                <div style={{ fontWeight: 700, color: "var(--ink)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={CARD}>
            <h3 style={H3}>Milestone timeline</h3>
            <div style={CAP}>gap = days from the previous milestone{j.poApprox ? " · PO-approved date approximated by last change date" : ""}</div>
            {applicable.map((s, i) => {
              const t = j.m[s.k]; const hit = j.reached[s.k];
              const gap = hit && t !== null && prev !== null ? days(prev, t) : null;
              if (t !== null) prev = t;
              const col = hit ? STAGE_COLS[STAGES.findIndex(x => x.k === s.k)] : "#c9c2b2";
              return (
                <div key={s.k} style={{ display: "flex", gap: 12, alignItems: "flex-start", position: "relative", paddingBottom: i === applicable.length - 1 ? 0 : 18 }}>
                  {i < applicable.length - 1 && <div style={{ position: "absolute", left: 7, top: 18, bottom: 0, width: 2, background: hit ? "#d8d2c4" : "#eee9dd" }} />}
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: hit ? col : "#fff", border: `3px solid ${col}`, flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: hit ? 800 : 600, color: hit ? "var(--ink)" : "var(--mut)" }}>{s.l}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: hit ? "var(--ink)" : "var(--mut)", whiteSpace: "nowrap" }}>{hit ? (t !== null ? fD(t) : "done · date n/a") : "pending"}</span>
                    </div>
                    {gap !== null && gap >= 0 && <div style={{ fontSize: 11, color: gap > 15 ? RED : "var(--mut)", fontWeight: gap > 15 ? 800 : 600 }}>+{gap} days</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {j.vg && (
            <div style={CARD}>
              <h3 style={H3}>QMS / NFA detail</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <tbody>
                  {[
                    ["QMS PR status", j.vg.PRH_Status_Desc], ["PR pending with", j.vg.PR_Pending_With],
                    ["Validator 1", j.vg.Validator_One && `${j.vg.Validator_One} · ${fD(pDate(j.vg.Validator_One_Date))}`],
                    ["Validator 2", j.vg.Validator_Two && `${j.vg.Validator_Two} · ${fD(pDate(j.vg.Validator_Two_Date))}`],
                    ["CP team", j.vg.CP_Team && `${j.vg.CP_Team} · ${fD(pDate(j.vg.CP_Team_Date))}`],
                    ["NFA no.", j.vg.NFA_No], ["NFA status", j.vg.NFA_Status_Desc], ["NFA pending with", j.vg.NFA_Pending_With],
                    ...[1, 2, 3, 4, 5, 6, 7, 8].map(n => {
                      const w = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"][n - 1];
                      const team = j.vg![`Level_${w}_Team`]; const dt = pDate(j.vg![`Level_${w}_Date`]);
                      return team || dt ? [`NFA level ${n}`, `${team ?? "—"} · ${fD(dt)}`] : null;
                    }).filter((x): x is string[] => !!x),
                  ].filter(([, v]) => v && v !== "NA").map(([k, v]) => (
                    <tr key={k as string}><td style={{ ...TD, color: "var(--mut)", width: 130 }}>{k}</td><td style={{ ...TD, fontWeight: 600, whiteSpace: "normal" }}>{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {j.po && (
            <div style={CARD}>
              <h3 style={H3}>PO detail</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <tbody>
                  {[["PO number", j.po.EBELN], ["PO date", fD(pDate(j.po.BADAT))], ["Vendor", j.po.NAME1],
                    ["Release levels granted", j.po.FRGZU || "none"], ["Release indicator", j.po.FRGKE === "G" ? "G — released" : `${j.po.FRGKE} — blocked/in release`],
                    ["Value", fMoney(parseFloat(String(j.po.NETWR)) || 0)], ["Invoiced", fMoney(parseFloat(String(j.po.NETWR_INV)) || 0)]]
                    .filter(([, v]) => v).map(([k, v]) => (
                      <tr key={k as string}><td style={{ ...TD, color: "var(--mut)", width: 150 }}>{k}</td><td style={{ ...TD, fontWeight: 600 }}>{v}</td></tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------------- page ---------------- */
export default function PrToPoPage() {
  // POs + QMS are live from SAP OData / VendorGlobe; only the SAP PR
  // leg still comes from the stale SWDBIDB mirror (PR entity pending).
  const defStart = "2026-05-01";
  const defEnd = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(defStart);
  const [to, setTo] = useState(defEnd);
  const [applied, setApplied] = useState({ from: defStart, to: defEnd });
  const [raw, setRaw] = useState<{ sap_pr: Rec[]; sap_po: Rec[]; vg: Rec[]; meta: Record<string, unknown> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState<"all" | "flight" | "done" | "exc">("all");
  /* main view = SAP-origin journeys only (SAP PR → QMS → back to SAP PO);
     PRs created directly in QMS (no SAP twin) live in their own bucket */
  const [flow, setFlow] = useState<"sap" | "qms">("sap");
  const [stageF, setStageF] = useState(-1);
  const [drawer, setDrawer] = useState<Journey | null>(null);
  const [list, setList] = useState<ListSel | null>(null);
  const [page, setPage] = useState(1);

  /** open the drill list drawer: journeys sorted oldest-movement-first */
  const openList = (title: string, js: Journey[], sub?: string, notes?: Map<string, string>) =>
    setList({
      title, sub,
      rows: [...js].sort((a, b) => (a.pendingSince ?? 9e15) - (b.pendingSince ?? 9e15))
        .map(j => ({ j, note: notes?.get(j.id) })),
    });

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    fetch(`${API_BASE}/pr2po/data?startdate=${applied.from}&enddate=${applied.to}`)
      .then(r => r.json())
      .then(j => { if (!alive) return; if (!j.ok) throw new Error(j.error || "backend error"); setRaw(j); setLoading(false); })
      .catch(e => { if (!alive) return; setError(String(e.message || e)); setLoading(false); });
    return () => { alive = false; };
  }, [applied]);

  const journeys = useMemo(() => raw ? buildJourneys(raw) : [], [raw]);
  const qmsDirectCount = useMemo(() => journeys.filter(j => j.origin === "vg").length, [journeys]);
  const rows = useMemo(() => journeys.filter(j => {
    if (flow === "sap" ? j.origin !== "sap" : j.origin !== "vg") return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      if (!j.id.toLowerCase().includes(s) && !j.desc.toLowerCase().includes(s) &&
          !j.vendor.toLowerCase().includes(s) && !(j.po?.EBELN ?? "").toLowerCase().includes(s)) return false;
    }
    if (statusF === "flight" && (j.done || j.exception)) return false;
    if (statusF === "done" && !j.done) return false;
    if (statusF === "exc" && !j.exception) return false;
    if (stageF >= 0 && (j.done || j.exception || j.stageIdx !== stageF)) return false;
    return true;
  }), [journeys, q, statusF, stageF, flow]);

  const inFlight = rows.filter(j => !j.done && !j.exception);
  const completed = rows.filter(j => j.done);
  const exceptions = rows.filter(j => j.exception);
  const withPo = rows.filter(j => j.reached.po_created && !j.exception);
  const totTats = completed
    .map(j => { const a = j.m.sap_created ?? j.m.qms_created, b = j.m.po_released ?? j.m.po_created; return a !== null && b !== null ? days(a, b) : null; })
    .filter((x): x is number => x !== null && x >= 0);
  const avgTat = totTats.length ? totTats.reduce((s, x) => s + x, 0) / totTats.length : null;
  const poValue = rows.reduce((s, j) => s + (j.reached.po_created && !j.exception ? j.value : 0), 0);

  /* funnel counts: journeys that reached each stage */
  const funnel = STAGES.map((s, i) => ({
    s, i, n: rows.filter(j => j.reached[s.k]).length,
    stuck: rows.filter(j => !j.done && !j.exception && j.stageIdx === i).length,
  }));

  /* avg TAT per consecutive leg */
  const legTats = STAGES.slice(1).map((s, i) => {
    const prevK = STAGES[i].k;
    const ds = rows.map(j => {
      const a = j.m[prevK], b = j.m[s.k];
      return a !== null && b !== null ? days(a, b) : null;
    }).filter((x): x is number => x !== null && x >= 0);
    ds.sort((a, b) => a - b);
    return { from: STAGES[i], to: s, n: ds.length, avg: ds.length ? ds.reduce((x, y) => x + y, 0) / ds.length : null, med: ds.length ? ds[Math.floor(ds.length / 2)] : null };
  });

  /* pending-with table */
  const pendingWith = useMemo(() => {
    const m = new Map<string, { n: number; oldest: number | null; stage: string }>();
    inFlight.forEach(j => {
      const k = j.pendingWith || "—";
      if (!m.has(k)) m.set(k, { n: 0, oldest: null, stage: STAGES[Math.min(j.stageIdx, 7)].l });
      const e = m.get(k)!; e.n++;
      if (j.pendingSince !== null && (e.oldest === null || j.pendingSince < e.oldest)) e.oldest = j.pendingSince;
    });
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [inFlight]);

  /* aging of in-flight (days since last milestone) */
  const AGE_BANDS = [["0–3 d", 0, 3], ["4–7 d", 4, 7], ["8–15 d", 8, 15], ["16–30 d", 16, 30], ["31–60 d", 31, 60], ["> 60 d", 61, 1e9]] as const;
  const aging = AGE_BANDS.map(([l, lo, hi]) => ({
    l, n: inFlight.filter(j => { if (j.pendingSince === null) return false; const a = idleDays(j.pendingSince); return a >= lo && a <= hi; }).length,
  }));

  /* full bifurcation: in-flight by stage, exceptions by type */
  const stageBreak = STAGES.map((s, i) => {
    const js = inFlight.filter(j => j.stageIdx === i);
    const idles = js.map(j => (j.pendingSince !== null ? idleDays(j.pendingSince) : null))
      .filter((x): x is number => x !== null);
    return {
      s, i, js,
      avgIdle: idles.length ? idles.reduce((a, b) => a + b, 0) / idles.length : null,
      maxIdle: idles.length ? Math.max(...idles) : null,
      value: js.reduce((a, j) => a + j.value, 0),
    };
  });
  const excByType = useMemo(() => {
    const m = new Map<string, Journey[]>();
    exceptions.forEach(j => { const k = j.exception!; if (!m.has(k)) m.set(k, []); m.get(k)!.push(j); });
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  /* month → journeys, for trend-chart drill */
  const monthPick = (mk: string, label: string) => {
    const js = rows.filter(j => { const c = j.m.sap_created ?? j.m.qms_created; return c !== null && iso(c).slice(0, 7) === mk; });
    openList(`PRs created in ${label}`, js);
  };

  const meta = raw?.meta as { sync?: { SAP_PR?: { last_sync_age_s?: number } } } | undefined;
  const syncAge = meta?.sync?.SAP_PR?.last_sync_age_s;
  const pageSize = 25;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = [...rows].sort((a, b) => (b.pendingSince ?? 0) - (a.pendingSince ?? 0)).slice((page - 1) * pageSize, page * pageSize);

  const tatNotes = new Map(completed.map(j => {
    const a = j.m.sap_created ?? j.m.qms_created, b = j.m.po_released ?? j.m.po_created;
    return [j.id, a !== null && b !== null ? `${days(a, b)} d total` : ""] as [string, string];
  }));
  const KPIS: [string, string, string, [string, string], () => void][] = [
    [flow === "sap" ? "Total PRs (SAP flow)" : "QMS-direct PRs", fN(rows.length), `${applied.from} → ${applied.to}`, ["#1c3f6e", "#0f2547"], () => openList(flow === "sap" ? "All SAP-flow PRs in window" : "All QMS-direct PRs in window", rows)],
    ["Reached PO", `${fN(withPo.length)}`, `${rows.length ? ((withPo.length / rows.length) * 100).toFixed(1) : 0}% conversion · ${fMoney(poValue)}`, ["#1e9a6c", "#0f6647"], () => openList("PRs that reached PO", withPo)],
    ["In-flight", fN(inFlight.length), "moving through approvals", ["#1a7f9c", "#0e5468"], () => openList("In-flight PRs", inFlight)],
    ["Returned / Cancelled", fN(exceptions.length), "exception journeys", ["#c0392b", "#7e1f14"], () => openList("Exception journeys", exceptions)],
    ["Avg PR → PO TAT", avgTat !== null ? `${avgTat.toFixed(0)} d` : "—", `${fN(totTats.length)} completed journeys`, ["#c99a3a", "#96691c"], () => openList("Completed journeys — full TAT", completed, "end-to-end days per PR", tatNotes)],
  ];

  return (
    <div className="sw-inv" style={{ minHeight: "100vh", background: "#f6f4ef" }}>
      <PageBanner bleed title="PR → PO Journey"
        sub={<>SAP PR → QMS approvals → NFA vendor selection → SAP PO · live
          {syncAge !== undefined && syncAge !== null ? <> · synced {Math.max(1, Math.round(Number(syncAge) / 60))} min ago</> : null}
          {raw ? <> · {fN(journeys.length)} journeys in window</> : null}</>}>
        <div>
          <div style={BANNER_LBL}>From (PR created)</div>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...BANNER_CTL, width: 150, color: "#14213d", colorScheme: "light" } as React.CSSProperties} />
        </div>
        <div>
          <div style={BANNER_LBL}>To</div>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...BANNER_CTL, width: 150, color: "#14213d", colorScheme: "light" } as React.CSSProperties} />
        </div>
        <button className="pb-btn" onClick={() => { setApplied({ from, to }); setPage(1); }}>Apply</button>
        <div>
          <div style={BANNER_LBL}>Search</div>
          <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="PR / PO / vendor / text…"
            style={{ ...BANNER_CTL, width: 210, cursor: "text", color: "#14213d" } as React.CSSProperties} />
        </div>
        <div>
          <div style={BANNER_LBL}>Flow</div>
          <BannerPills items={[["sap", "SAP → QMS → SAP"], ["qms", `QMS-direct (${fN(qmsDirectCount)})`]] as const}
            value={flow} onChange={k => { setFlow(k); setStageF(-1); setPage(1); }} />
        </div>
        <div>
          <div style={BANNER_LBL}>Status</div>
          <BannerPills items={[["all", "All"], ["flight", "In-flight"], ["done", "Completed"], ["exc", "Exceptions"]] as const}
            value={statusF} onChange={k => { setStatusF(k); setStageF(-1); setPage(1); }} />
        </div>
        <button className="pb-btn" onClick={() => { setQ(""); setStatusF("all"); setStageF(-1); setFlow("sap"); setFrom(defStart); setTo(defEnd); setApplied({ from: defStart, to: defEnd }); setPage(1); }}>⟲ Reset</button>
      </PageBanner>

      <div style={{ padding: "16px 20px 40px" }}>
        {loading && <div style={{ ...CARD, textAlign: "center", padding: 40, color: "var(--mut)", fontWeight: 600 }}>Loading live journey data…</div>}
        {error && (
          <div style={{ ...CARD, borderLeft: `6px solid ${RED}` }}>
            <h3 style={H3}>Backend unreachable</h3>
            <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 6 }}>
              Could not load <code>{API_BASE}/pr2po/data</code> — {error}.<br />
              Check the VendorGlobeAPI service on 192.168.66.28 (<code>/pr2po/health</code>) and that this machine can reach it.
            </div>
          </div>
        )}
        {!loading && !error && raw && (<>
          {/* Stale-feed notice - computed from the data, disappears when fresh rows arrive */}
          {(() => {
            const mxSap = Math.max(0, ...(raw.sap_pr as Rec[]).map(r => pDate(r.Badat) ?? pDate(r.Erdat) ?? 0));
            const stale = mxSap > 0 && days(mxSap, todayUtc()) > 14;
            return stale ? (
              <div style={{ background: "#fdf6e3", border: `1px solid ${AMBER}`, borderLeft: `6px solid ${AMBER}`, borderRadius: 10, padding: "9px 14px", marginBottom: 12, fontSize: 12.5, color: "var(--ink)", fontWeight: 600 }}>
                ⚠ SAP <b>PR</b> feed: no new SAP PR documents since <b>{fD(mxSap)}</b> (PR OData entity pending) — QMS and <b>PO data are live from SAP</b>.
              </div>
            ) : null;
          })()}

          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
            {KPIS.map(([k, v, sub, [c1, c2], pick]) => (
              <div key={k} className="g3d" style={{ ...GLASS(c1, c2), cursor: "pointer" }} onClick={pick}
                onMouseEnter={e => showTip(e, `<b>${k}</b><br/>${v} · ${sub}<br/>click → list`)} onMouseMove={e => showTip(e, `<b>${k}</b> ${v}`)} onMouseLeave={hideTip}>
                <div style={{ position: "absolute", top: -30, right: -30, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,.10)", filter: "blur(2px)" }} />
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.4px", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>{k}</div>
                <div style={{ fontFamily: "Georgia,serif", fontSize: 26, fontWeight: 700, lineHeight: 1.1, marginTop: 6, textShadow: "0 2px 4px rgba(0,0,0,.25)", whiteSpace: "nowrap" }}>{v}</div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,.75)", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Journey summary — full bifurcation of where every PR stands */}
          <Zoomable title="Journey summary" collapsible>
            <div style={CARD}>
              <h3 style={H3}>Journey Summary — where every PR stands right now</h3>
              <div style={CAP}>{fN(rows.length)} PRs in window · click any row or segment → list of those PRs · click a PR → full timeline</div>
              {/* status split bar */}
              {(() => {
                const segs = [
                  ["Completed", completed, GREEN], ["In-flight", inFlight, TEAL], ["Exceptions", exceptions, RED],
                ] as const;
                const tot = Math.max(rows.length, 1);
                return (
                  <div style={{ display: "flex", height: 26, borderRadius: 8, overflow: "hidden", marginBottom: 12, border: "1px solid #eee9dd" }}>
                    {segs.map(([l, js, c]) => js.length > 0 && (
                      <div key={l} onClick={() => openList(`${l} PRs`, [...js])}
                        style={{ width: `${(js.length / tot) * 100}%`, background: c, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", minWidth: js.length ? 34 : 0 }}
                        onMouseEnter={e => showTip(e, `<b>${l}</b><br/>${fN(js.length)} PRs (${((js.length / tot) * 100).toFixed(1)}%)<br/>click → list`)}
                        onMouseMove={e => showTip(e, `<b>${l}</b> ${fN(js.length)}`)} onMouseLeave={hideTip}>
                        <span style={{ color: "#fff", fontWeight: 800, fontSize: 11.5, textShadow: "0 1px 2px rgba(0,0,0,.35)", whiteSpace: "nowrap" }}>{fN(js.length)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
                {/* in-flight by stage */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", marginBottom: 6 }}>In-flight — sitting at stage</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead><tr>
                      <th style={TH}>Stage</th><th style={{ ...TH, textAlign: "right" }}>PRs</th>
                      <th style={{ ...TH, textAlign: "right" }}>Avg idle</th><th style={{ ...TH, textAlign: "right" }}>Max idle</th><th style={{ ...TH, textAlign: "right" }}>Value</th>
                    </tr></thead>
                    <tbody>
                      {stageBreak.filter(b => b.js.length > 0).map(b => (
                        <tr key={b.s.k} onClick={() => openList(`Sitting at: ${b.s.l}`, b.js)} style={{ cursor: "pointer" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                          <td style={TD}><span style={{ background: `${STAGE_COLS[b.i]}1c`, color: STAGE_COLS[b.i], fontWeight: 800, fontSize: 10.5, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>{b.s.l}</span></td>
                          <td style={{ ...TD, textAlign: "right", fontWeight: 800 }}>{fN(b.js.length)}</td>
                          <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: (b.avgIdle ?? 0) > 30 ? RED : "var(--mut)" }}>{b.avgIdle !== null ? `${b.avgIdle.toFixed(0)} d` : "—"}</td>
                          <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: (b.maxIdle ?? 0) > 30 ? RED : "var(--mut)" }}>{b.maxIdle !== null ? `${b.maxIdle} d` : "—"}</td>
                          <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{b.value ? fMoney(b.value) : "—"}</td>
                        </tr>
                      ))}
                      {inFlight.length === 0 && <tr><td style={{ ...TD, color: "var(--mut)" }} colSpan={5}>Nothing in flight.</td></tr>}
                    </tbody>
                  </table>
                </div>
                {/* completed + exceptions by type */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", marginBottom: 6 }}>Completed & exceptions</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead><tr><th style={TH}>Status</th><th style={{ ...TH, textAlign: "right" }}>PRs</th><th style={{ ...TH, textAlign: "right" }}>% of window</th><th style={{ ...TH, textAlign: "right" }}>Value</th></tr></thead>
                    <tbody>
                      <tr onClick={() => openList("Completed journeys — full TAT", completed, "end-to-end days per PR", tatNotes)} style={{ cursor: "pointer" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                        <td style={TD}><span style={{ background: `${GREEN}1c`, color: GREEN, fontWeight: 800, fontSize: 10.5, borderRadius: 999, padding: "2px 9px" }}>Completed (PO approved)</span></td>
                        <td style={{ ...TD, textAlign: "right", fontWeight: 800 }}>{fN(completed.length)}</td>
                        <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: "var(--mut)" }}>{rows.length ? ((completed.length / rows.length) * 100).toFixed(1) : 0}%</td>
                        <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{fMoney(completed.reduce((s, j) => s + j.value, 0))}</td>
                      </tr>
                      {excByType.map(([k, js]) => (
                        <tr key={k} onClick={() => openList(k, [...js])} style={{ cursor: "pointer" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                          <td style={TD}><span style={{ background: `${RED}1c`, color: RED, fontWeight: 800, fontSize: 10.5, borderRadius: 999, padding: "2px 9px" }}>{k}</span></td>
                          <td style={{ ...TD, textAlign: "right", fontWeight: 800 }}>{fN(js.length)}</td>
                          <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: "var(--mut)" }}>{rows.length ? ((js.length / rows.length) * 100).toFixed(1) : 0}%</td>
                          <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{fMoney(js.reduce((s, j) => s + j.value, 0))}</td>
                        </tr>
                      ))}
                      {exceptions.length === 0 && <tr><td style={{ ...TD, color: "var(--mut)" }} colSpan={4}>No returned / cancelled journeys.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Zoomable>

          {/* Funnel */}
          <Zoomable title="Journey funnel" collapsible>
            <div style={CARD}>
              <h3 style={H3}>Journey Funnel — how far PRs have travelled</h3>
              <div style={CAP}>bar = journeys that reached the stage · gold badge = sitting there now · click a badge → filter records</div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: 8, alignItems: "end", height: 210, paddingTop: 4 }}>
                {funnel.map(({ s, i, n, stuck }) => {
                  const mx = Math.max(...funnel.map(x => x.n), 1);
                  const total = Math.max(rows.length, 1);
                  return (
                    <div key={s.k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" }}
                      onMouseEnter={e => showTip(e, `<b>${s.l}</b><br/>${fN(n)} reached (${((n / total) * 100).toFixed(0)}% of journeys)<br/>${fN(stuck)} sitting here now<br/>click bar → list`)}
                      onMouseMove={e => showTip(e, `<b>${s.l}</b> ${fN(n)}`)} onMouseLeave={hideTip}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>{fN(n)}</span>
                      <div onClick={() => openList(`Reached: ${s.l}`, rows.filter(j => j.reached[s.k]))}
                        style={{ width: "76%", height: `${Math.max((n / mx) * 120, n ? 4 : 0)}px`, background: STAGE_COLS[i], borderRadius: "5px 5px 0 0", cursor: "pointer" }} />
                      {stuck > 0 && (
                        <span onClick={() => { setStageF(i); setStatusF("flight"); setPage(1); }}
                          style={{ background: `${GOLD}22`, color: GOLD, fontWeight: 800, fontSize: 10.5, borderRadius: 999, padding: "2px 8px", cursor: "pointer", border: stageF === i ? `1.5px solid ${GOLD}` : "1.5px solid transparent", whiteSpace: "nowrap" }}>
                          {fN(stuck)} here
                        </span>
                      )}
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--mut)", textAlign: "center", lineHeight: 1.25 }}>{s.short}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Zoomable>

          {/* Stage TATs + Pending-with */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 14, marginBottom: 14 }}>
            <Zoomable title="Stage TATs" collapsible>
              <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                <h3 style={H3}>Average TAT per Leg</h3>
                <div style={CAP}>days between consecutive milestones · median in grey · computed on journeys with both dates</div>
                {(() => {
                  const mx = Math.max(...legTats.map(t => t.avg ?? 0), 1);
                  return legTats.map(t => (
                    <div key={t.to.k} className="barrow" style={{ padding: "4px 0", cursor: "pointer" }}
                      onClick={() => {
                        const withD = rows.map(j => {
                          const a = j.m[t.from.k], b = j.m[t.to.k];
                          const d = a !== null && b !== null ? days(a, b) : null;
                          return d !== null && d >= 0 ? { j, d } : null;
                        }).filter((x): x is { j: Journey; d: number } => !!x).sort((a, b) => b.d - a.d);
                        setList({
                          title: `TAT: ${t.from.l} → ${t.to.l}`, sub: "slowest first",
                          rows: withD.map(({ j, d }) => ({ j, note: `${d} d` })),
                        });
                      }}
                      onMouseEnter={e => showTip(e, `<b>${t.from.short} → ${t.to.short}</b><br/>avg ${t.avg?.toFixed(1) ?? "—"} d · median ${t.med ?? "—"} d · ${fN(t.n)} journeys<br/>click → list, slowest first`)}
                      onMouseMove={e => showTip(e, `<b>${t.to.short}</b> avg ${t.avg?.toFixed(1) ?? "—"} d`)} onMouseLeave={hideTip}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                        <span style={{ color: "var(--ink)", fontWeight: 700 }}>{t.from.short} → {t.to.short}</span>
                        <span style={{ color: "var(--mut)", fontWeight: 700 }}>{t.avg !== null ? `${t.avg.toFixed(1)} d avg` : "—"} <span style={{ color: "#b0a890" }}>· {t.med ?? "—"} med</span></span>
                      </div>
                      <div style={{ height: 9, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${((t.avg ?? 0) / mx) * 100}%`, background: (t.avg ?? 0) > 30 ? RED : (t.avg ?? 0) > 10 ? AMBER : TEAL, borderRadius: 5 }} />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </Zoomable>
            <Zoomable title="Pending with" collapsible>
              <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                <h3 style={H3}>In-flight — Pending With</h3>
                <div style={CAP}>{fN(inFlight.length)} journeys waiting · oldest = earliest last-movement date</div>
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                      <th style={TH}>Pending with</th><th style={TH}>Stage</th><th style={{ ...TH, textAlign: "right" }}>PRs</th><th style={{ ...TH, textAlign: "right" }}>Oldest</th>
                    </tr></thead>
                    <tbody>
                      {pendingWith.map(([k, e]) => (
                        <tr key={k} onClick={() => openList(`Pending with: ${k}`, inFlight.filter(j => (j.pendingWith || "—") === k))} style={{ cursor: "pointer" }}
                          onMouseEnter={ev => { (ev.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                          onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.background = ""; }}>
                          <td style={{ ...TD, fontWeight: 700, color: "var(--ink)" }}>{k}</td>
                          <td style={{ ...TD, color: "var(--mut)" }}>{e.stage}</td>
                          <td style={{ ...TD, textAlign: "right", fontWeight: 800 }}>{fN(e.n)}</td>
                          <td style={{ ...TD, textAlign: "right", color: e.oldest !== null && idleDays(e.oldest) > 30 ? RED : "var(--mut)", fontWeight: 700 }}>
                            {e.oldest !== null ? `${idleDays(e.oldest)} d` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Zoomable>
          </div>

          {/* Aging + Trend */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, marginBottom: 14 }}>
            <Zoomable title="In-flight aging" collapsible>
              <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                <h3 style={H3}>In-flight Aging</h3>
                <div style={CAP}>days since the journey last moved</div>
                {(() => {
                  const mx = Math.max(...aging.map(a => a.n), 1);
                  return aging.map((a, i) => (
                    <div key={a.l} className="barrow" style={{ padding: "4.5px 0", cursor: "pointer" }}
                      onClick={() => {
                        const [, lo, hi] = AGE_BANDS[i];
                        openList(`In-flight, idle ${a.l}`, inFlight.filter(j => {
                          if (j.pendingSince === null) return false;
                          const d = idleDays(j.pendingSince); return d >= lo && d <= hi;
                        }));
                      }}
                      onMouseEnter={e => showTip(e, `<b>${a.l}</b><br/>${fN(a.n)} journeys<br/>click → list`)} onMouseMove={e => showTip(e, `<b>${a.l}</b> ${fN(a.n)}`)} onMouseLeave={hideTip}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 2 }}>
                        <span style={{ fontWeight: 700, color: "var(--ink)" }}>{a.l}</span>
                        <span style={{ fontWeight: 800, color: "var(--mut)" }}>{fN(a.n)}</span>
                      </div>
                      <div style={{ height: 10, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(a.n / mx) * 100}%`, background: i >= 4 ? RED : i >= 2 ? AMBER : GREEN, borderRadius: 5 }} />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </Zoomable>
            <Zoomable title="Monthly trend" collapsible>
              <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
                <h3 style={H3}>Monthly — PRs Created vs POs Created</h3>
                <div style={CAP}>navy = PRs created · green = POs created</div>
                <TrendChart rows={rows} onPick={monthPick} />
              </div>
            </Zoomable>
          </div>

          {/* Data & join diagnostics — the proof of every connection */}
          <Zoomable title="Data and join diagnostics" collapsible defaultCollapsed>
            <div style={CARD}>
              <h3 style={H3}>Data & Join Diagnostics</h3>
              <div style={CAP}>live counts proving each link · SAP PR ⟷ VendorGlobe joined on Banfn = EPR_No · PR → PO joined on Ebeln = EBELN</div>
              {(() => {
                const sapPrs = new Set((raw.sap_pr as Rec[]).map(r => String(r.Banfn || "")).filter(Boolean));
                const vgPrs = new Set((raw.vg as Rec[]).map(r => String(r.EPR_No || "")).filter(Boolean));
                const both = [...sapPrs].filter(x => vgPrs.has(x)).length;
                const sapWithPoLink = new Set((raw.sap_pr as Rec[]).filter(r => r.Ebeln).map(r => String(r.Banfn))).size;
                const poNos = new Set((raw.sap_po as Rec[]).map(r => String(r.EBELN || "")));
                const linkedFound = new Set((raw.sap_pr as Rec[]).filter(r => r.Ebeln && poNos.has(String(r.Ebeln))).map(r => String(r.Banfn))).size;
                const sapErr = (raw.meta as { sap_error?: string | null }).sap_error;
                const items: [string, string, string][] = [
                  ["SAP PR lines fetched", fN((raw.sap_pr as Rec[]).length), "rows from PR2PO.dbo.SAP_PR (mirror of SWDBIDB.PRD_PR)"],
                  ["Distinct SAP PRs", fN(sapPrs.size), "grouped by Banfn — one journey each"],
                  ["VendorGlobe PRs fetched", fN(vgPrs.size), "rows from PRNFATatReportHistory (QMS + NFA legs)"],
                  ["Matched in BOTH systems", fN(both), "Banfn = EPR_No — these journeys carry all legs"],
                  ["SAP-only journeys", fN(sapPrs.size - both), "no QMS record — not yet replicated, or outside VG sync window"],
                  ["VendorGlobe-only journeys", fN(vgPrs.size - both), "created directly in QMS (Is_Sap_Pr = 0) or SAP twin missing"],
                  ["SAP PRs with a PO link", fN(sapWithPoLink), "PR lines carrying Ebeln (follow-on PO number)"],
                  ["PO headers fetched", fN((raw.sap_po as Rec[]).length), "PR2PO.dbo.SAP_PO rows aggregated by EBELN"],
                  ["PRs whose PO was found", fN(linkedFound), "Ebeln resolved in SAP_PO — these reach the PO stage"],
                ];
                return (
                  <>
                    {sapErr && <div style={{ background: "#fdecea", border: `1px solid ${RED}`, color: RED, fontWeight: 700, fontSize: 12.5, borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>SAP mirror query failed: {String(sapErr)}</div>}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 8 }}>
                      {items.map(([k, v, sub]) => (
                        <div key={k} style={{ background: "#faf9f6", border: "1px solid #eee9dd", borderRadius: 10, padding: "8px 12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink)" }}>{k}</span>
                            <span style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>{v}</span>
                          </div>
                          <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 2 }}>{sub}</div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </Zoomable>

          {/* Records */}
          <Zoomable title="Journey records" collapsible>
            <div style={CARD}>
              <h3 style={H3}>Journey Records</h3>
              <div style={CAP}>{fN(rows.length)} journeys{stageF >= 0 ? ` · filtered: sitting at ${STAGES[stageF].l}` : ""} · click a row → full timeline</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 980 }}>
                  <thead><tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                    {["PR no.", "Created", "Description", "Project / Plant", "Stage", "Pending with", "Idle", "PO no.", "Value"].map(h => (
                      <th key={h} style={{ ...TH, textAlign: ["Idle", "Value"].includes(h) ? "right" : "left" }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {pageRows.map(j => {
                      const idle = !j.done && !j.exception && j.pendingSince !== null ? idleDays(j.pendingSince) : null;
                      const stageLbl = j.exception ?? (j.done ? "Completed" : STAGES[Math.min(j.stageIdx, 7)].l);
                      const stageCol = j.exception ? RED : j.done ? GREEN : STAGE_COLS[Math.min(j.stageIdx, 7)];
                      return (
                        <tr key={j.id} onClick={() => setDrawer(j)} style={{ cursor: "pointer" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                          <td style={{ ...TD, fontWeight: 800, color: "var(--ink)" }}>{j.id}</td>
                          <td style={{ ...TD, color: "var(--mut)" }}>{fD(j.m.sap_created ?? j.m.qms_created)}</td>
                          <td style={{ ...TD, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{j.desc}</td>
                          <td style={{ ...TD, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{j.project !== "—" ? j.project : j.plant}</td>
                          <td style={TD}><span style={{ background: `${stageCol}1c`, color: stageCol, fontWeight: 800, fontSize: 10.5, borderRadius: 999, padding: "2px 9px" }}>{stageLbl}</span></td>
                          <td style={{ ...TD, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{j.done || j.exception ? "—" : j.pendingWith}</td>
                          <td style={{ ...TD, textAlign: "right", color: idle !== null && idle > 30 ? RED : "var(--mut)", fontWeight: idle !== null && idle > 30 ? 800 : 600 }}>{idle !== null ? `${idle} d` : "—"}</td>
                          <td style={{ ...TD, color: "var(--mut)" }}>{j.po?.EBELN ?? "—"}</td>
                          <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{j.value ? fMoney(j.value) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 12 }}>
                <span style={{ color: "var(--mut)" }}>Page {page} of {fN(pages)}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid #d8d2c4", background: "#fff", cursor: page > 1 ? "pointer" : "default", opacity: page > 1 ? 1 : 0.5, fontFamily: "inherit", fontWeight: 700 }}>‹ Prev</button>
                  <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid #d8d2c4", background: "#fff", cursor: page < pages ? "pointer" : "default", opacity: page < pages ? 1 : 0.5, fontFamily: "inherit", fontWeight: 700 }}>Next ›</button>
                </div>
              </div>
            </div>
          </Zoomable>
        </>)}
      </div>
      <ListDrawer sel={list} onPick={j => setDrawer(j)} onClose={() => setList(null)} />
      <JourneyDrawer j={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
