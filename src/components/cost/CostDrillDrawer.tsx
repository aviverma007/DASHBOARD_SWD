import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showTip, hideTip } from "../common/hoverTip";
import { CB, WBS_ROWS, PO_ROWS, type WbsRow, statusOf, fmtDay, ymOf, ymLbl, fMoney, fN } from "./costShared";

export type CostDim = "typ" | "dept" | "proj" | "status" | "wbs" | "vendor" | "mon";
export interface CostChip { dim: CostDim; val: number | string; label: string }
export interface CostDrillSeed { chips: CostChip[] }

const NAVY = "#14213D", TEAL = "#0E7490", GOLD = "#B8893C", GREEN = "#1BAF7A", RED = "#c0392b";
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #eae6da", borderRadius: 12, padding: "13px 15px", marginBottom: 12 };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 14.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" };
const DIMN: Record<CostDim, string> = { typ: "Budget type", dept: "Department", proj: "Project", status: "Status", wbs: "WBS", vendor: "Vendor", mon: "Month" };

export function CostDrillDrawer({ seed, baseLabel, onClose, onAddChip }: {
  seed: CostDrillSeed | null; baseLabel: string; onClose: () => void; onAddChip: (c: CostChip) => void;
}) {
  const chips = seed?.chips ?? [];
  const has = (d: CostDim) => chips.some(c => c.dim === d);

  const wbsMatch = (w: WbsRow, ch: CostChip): boolean => {
    switch (ch.dim) {
      case "typ": return w.typ === ch.val;
      case "dept": return w.dept === ch.val;
      case "proj": return w.proj === ch.val;
      case "status": return statusOf(w) === ch.val;
      case "wbs": return w.i === ch.val;
      default: return true; // vendor/mon scope only the PO view
    }
  };
  const wbsRows = useMemo(() => WBS_ROWS.filter(w => chips.every(ch => wbsMatch(w, ch))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed]);
  const wSet = useMemo(() => new Set(wbsRows.map(w => w.i)), [wbsRows]);
  const poRows = useMemo(() => PO_ROWS.filter(p => (p.w >= 0 ? wSet.has(p.w) : chips.every(c => c.dim !== "wbs")) &&
    chips.every(ch => ch.dim === "vendor" ? p.vendor === ch.val : ch.dim === "mon" ? (p.day >= 0 && ymOf(p.day) === ch.val) : ch.dim === "typ" ? p.typ === ch.val : true)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wSet, seed]);

  const budget = wbsRows.reduce((s, w) => s + w.budget, 0);
  const assigned = wbsRows.reduce((s, w) => s + w.assigned, 0);
  const available = wbsRows.reduce((s, w) => s + w.available, 0);
  const util = budget > 0 ? (assigned / budget) * 100 : 0;
  const crit = wbsRows.filter(w => statusOf(w) === "critical").length;

  const List = ({ title, items, dim }: { title: string; dim: CostDim; items: { k: number | string; label: string; v: number; sub?: string }[] }) => {
    const mx = Math.max(...items.map(i => i.v), 1);
    if (!items.length) return null;
    return (
      <div style={CARD}>
        <h3 style={H3}>{title}</h3>
        {items.slice(0, 10).map(it => (
          <div key={String(it.k)} className="barrow" onClick={() => onAddChip({ dim, val: it.k, label: it.label })}
            onMouseEnter={e => showTip(e, `<b>${it.label}</b><br/>${fMoney(it.v)}${it.sub ? `<br/>${it.sub}` : ""}<br/>click → narrow`)}
            onMouseMove={e => showTip(e, `<b>${it.label}</b><br/>${fMoney(it.v)}`)} onMouseLeave={hideTip}
            style={{ padding: "3.5px 0", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2, gap: 8 }}>
              <span style={{ color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
              <span style={{ color: "var(--mut)", whiteSpace: "nowrap" }}>{fMoney(it.v)}</span>
            </div>
            <div style={{ height: 7, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(it.v / mx) * 100}%`, background: TEAL, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const deptItems = useMemo(() => {
    const m = new Map<number, number>();
    wbsRows.forEach(w => m.set(w.dept, (m.get(w.dept) ?? 0) + w.assigned));
    return [...m.entries()].map(([k, v]) => ({ k, label: CB.DEPT[k], v })).sort((a, b) => b.v - a.v);
  }, [wbsRows]);
  const projItems = useMemo(() => {
    const m = new Map<string, number>();
    wbsRows.forEach(w => m.set(w.proj, (m.get(w.proj) ?? 0) + w.assigned));
    return [...m.entries()].map(([k, v]) => ({ k, label: k, v })).sort((a, b) => b.v - a.v);
  }, [wbsRows]);
  const wbsItems = useMemo(() =>
    [...wbsRows].sort((a, b) => b.assigned - a.assigned).slice(0, 10)
      .map(w => ({ k: w.i, label: `${w.wbs} — ${w.desc}`, v: w.assigned, sub: `budget ${fMoney(w.budget)} · ${w.budget > 0 ? ((w.assigned / w.budget) * 100).toFixed(0) : "—"}%` })),
    [wbsRows]);
  const vendItems = useMemo(() => {
    const m = new Map<number, number>();
    poRows.forEach(p => { if (p.vendor >= 0) m.set(p.vendor, (m.get(p.vendor) ?? 0) + p.ordered); });
    return [...m.entries()].map(([k, v]) => ({ k, label: CB.VEND[k], v })).sort((a, b) => b.v - a.v);
  }, [poRows]);
  const trend = useMemo(() => {
    const m = new Map<string, number>();
    poRows.forEach(p => { if (p.day >= 0) m.set(ymOf(p.day), (m.get(ymOf(p.day)) ?? 0) + p.ordered); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [poRows]);

  return (
    <AnimatePresence>
      {seed && (
        <>
          <motion.div key="cbov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.35)", zIndex: 70 }} />
          <motion.div key="cbdw" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(560px, 95vw)", zIndex: 71, background: "#f6f4ef", boxShadow: "-14px 0 46px rgba(20,33,61,.35)", display: "flex", flexDirection: "column" }}>
            <div style={{ background: NAVY, padding: "14px 18px", borderBottom: "3px solid var(--gold)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", color: "#c9b27c" }}>BUDGET DRILL</div>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "#fff", marginTop: 2 }}>
                    {chips.length ? chips[chips.length - 1].label : baseLabel}
                  </div>
                </div>
                <button onClick={onClose} aria-label="Close"
                  style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 8, fontSize: 15, cursor: "pointer", flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,.6)", padding: "4px 0" }}>{baseLabel} ›</span>
                {chips.map((c, i) => (
                  <span key={i} style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.25)", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "3px 10px" }}>
                    {DIMN[c.dim]}: {c.label}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 26px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                {[
                  ["Budget", fMoney(budget), TEAL], ["Utilized", fMoney(assigned), GOLD], ["Balance", fMoney(available), GREEN],
                  ["Utilization", `${util.toFixed(1)}%`, util > 95 ? RED : util > 80 ? GOLD : GREEN],
                  ["WBS in scope", fN(wbsRows.length), NAVY], ["Critical WBS", fN(crit), RED],
                ].map(([k, v, col]) => (
                  <div key={k as string} style={{ background: "#fff", border: "1px solid #eae6da", borderLeft: `4px solid ${col}`, borderRadius: 10, padding: "9px 11px" }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
                    <div style={{ fontFamily: "Georgia,serif", fontSize: 15.5, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>

              {trend.length > 1 && (
                <div style={CARD}>
                  <h3 style={H3}>PO spend by month</h3>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90, overflowX: "auto", paddingBottom: 2 }}>
                    {(() => {
                      const mx = Math.max(...trend.map(([, v]) => v), 1);
                      return trend.map(([k, v]) => (
                        <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: "1 0 34px", minWidth: 34 }}
                          onClick={() => onAddChip({ dim: "mon", val: k, label: ymLbl(k) })}
                          onMouseEnter={e => showTip(e, `<b>${ymLbl(k)}</b><br/>${fMoney(v)}<br/>click → narrow`)}
                          onMouseMove={e => showTip(e, `<b>${ymLbl(k)}</b><br/>${fMoney(v)}`)} onMouseLeave={hideTip}>
                          <div style={{ width: "70%", maxWidth: 20, height: `${(v / mx) * 62}px`, background: TEAL, borderRadius: "3px 3px 0 0", minHeight: 2, cursor: "pointer" }} />
                          <span style={{ fontSize: 8.5, color: "var(--mut)", whiteSpace: "nowrap" }}>{ymLbl(k)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {!has("dept") && <List title="By department (utilized)" dim="dept" items={deptItems} />}
              {!has("proj") && <List title="By project (utilized)" dim="proj" items={projItems} />}
              {!has("wbs") && <List title="Top WBS (utilized)" dim="wbs" items={wbsItems} />}
              {!has("vendor") && <List title="Top vendors (PO value)" dim="vendor" items={vendItems} />}

              <div style={CARD}>
                <h3 style={H3}>PO lines ({fN(poRows.length)})</h3>
                <div style={{ maxHeight: 280, overflowY: "auto" }}>
                  {poRows.slice(0, 120).map((p, i) => (
                    <div key={`${p.docNo}-${i}`}
                      onMouseEnter={e => showTip(e, `<b>${p.vendor >= 0 ? CB.VEND[p.vendor] : "—"}</b><br/>${p.text || "—"}<br/>${fMoney(p.ordered)} · with GST ${fMoney(p.orderedGST)}<br/>GL: ${p.gl >= 0 ? CB.GL[p.gl] : "—"}`)}
                      onMouseMove={e => showTip(e, `<b>${fMoney(p.ordered)}</b> · ${fmtDay(p.day)}`)} onMouseLeave={hideTip}
                      style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid #f0ede5", fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: TEAL, whiteSpace: "nowrap" }}>{p.docNo}</span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)" }}>{p.vendor >= 0 ? CB.VEND[p.vendor] : "—"}</span>
                      <span style={{ color: "var(--mut)", whiteSpace: "nowrap" }}>{fmtDay(p.day)}</span>
                      <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{fMoney(p.ordered)}</span>
                    </div>
                  ))}
                  {poRows.length > 120 && <div style={{ fontSize: 11, color: "var(--mut)", padding: "8px 0" }}>Showing first 120 — narrow further above.</div>}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
