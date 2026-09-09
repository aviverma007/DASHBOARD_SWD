import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showTip, hideTip } from "../common/hoverTip";
import { CM, type CaseRec, isClosed, tatBucket, ymOf, ymLbl, fmtDay, fN, AGE_BANDS, ageBand } from "./caseShared";

/** Drill dimensions. "stg" = open/closed group; "age" = ageing band. */
export type CaseDim = "typ" | "sta" | "stg" | "org" | "own" | "tl" | "age" | "mon" | "area";
export interface CaseChip { dim: CaseDim; val: number | string; label: string }
export interface CaseDrillSeed { chips: CaseChip[] }

const NAVY = "#14213D", TEAL = "#0E7490", GOLD = "#B8893C", GREEN = "#1BAF7A", RED = "#c0392b", AMBER = "#EDA100";
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #eae6da", borderRadius: 12, padding: "13px 15px", marginBottom: 12 };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 14.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" };
const DIMN: Record<CaseDim, string> = { typ: "Case type", sta: "Status", stg: "State", org: "Origin", own: "Owner", tl: "Team leader", age: "Ageing", mon: "Month", area: "Category" };


export function CaseDrillDrawer({ seed, baseRows, baseLabel, onClose, onAddChip, onRecord }: {
  seed: CaseDrillSeed | null;
  baseRows: CaseRec[];
  baseLabel: string;
  onClose: () => void;
  onAddChip: (chip: CaseChip) => void;
  onRecord: (c: CaseRec) => void;
}) {
  const chips = seed?.chips ?? [];
  const has = (d: CaseDim) => chips.some(c => c.dim === d);

  const match = (c: CaseRec, ch: CaseChip): boolean => {
    switch (ch.dim) {
      case "typ": return c.typ === ch.val;
      case "sta": return c.sta === ch.val;
      case "stg": return (ch.val === "open") !== isClosed(c) ? false : true;
      case "org": return c.org === ch.val;
      case "own": return c.own === ch.val;
      case "tl": return c.tl === ch.val;
      case "age": return !isClosed(c) && ageBand(c.age) === ch.val;
      case "mon": return c.open >= 0 && ymOf(c.open) === ch.val;
      case "area": return c.area === ch.val;
    }
  };
  const rows = useMemo(() => baseRows.filter(c => chips.every(ch => match(c, ch))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseRows, seed]);

  const total = rows.length;
  const open = rows.filter(c => !isClosed(c)).length;
  const overdue = rows.filter(c => !isClosed(c) && tatBucket(c) === "overdue").length;
  const atrisk = rows.filter(c => !isClosed(c) && tatBucket(c) === "atrisk").length;
  const withAge = rows.filter(c => !isClosed(c) && c.age >= 0);
  const avgAge = withAge.length ? withAge.reduce((s, c) => s + c.age, 0) / withAge.length : 0;

  const List = ({ title, dim, get, names, top = 8, labelOf }: {
    title: string; dim: CaseDim; get: (c: CaseRec) => number; names?: string[]; top?: number; labelOf?: (k: number) => string;
  }) => {
    const m = new Map<number, number>();
    rows.forEach(c => { const k = get(c); if (k < 0) return; m.set(k, (m.get(k) ?? 0) + 1); });
    const items = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
    const mx = Math.max(...items.map(([, v]) => v), 1);
    if (!items.length) return null;
    return (
      <div style={CARD}>
        <h3 style={H3}>{title}</h3>
        {items.map(([k, v]) => {
          const label = labelOf ? labelOf(k) : (names?.[k] ?? String(k));
          return (
            <div key={k} className="barrow" onClick={() => onAddChip({ dim, val: k, label })}
              onMouseEnter={e => showTip(e, `<b>${label}</b><br/>${fN(v)} cases (${((v / Math.max(total, 1)) * 100).toFixed(1)}%)<br/>click → narrow`)}
              onMouseMove={e => showTip(e, `<b>${label}</b><br/>${fN(v)} cases`)} onMouseLeave={hideTip}
              style={{ padding: "3.5px 0", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2, gap: 8 }}>
                <span style={{ color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                <span style={{ color: "var(--mut)", whiteSpace: "nowrap" }}>{fN(v)}</span>
              </div>
              <div style={{ height: 7, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(v / mx) * 100}%`, background: TEAL, borderRadius: 4 }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const trend = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(c => { if (c.open >= 0) { const k = ymOf(c.open); m.set(k, (m.get(k) ?? 0) + 1); } });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <AnimatePresence>
      {seed && (
        <>
          <motion.div key="cdov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.35)", zIndex: 70 }} />
          <motion.div key="cddw" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(560px, 95vw)", zIndex: 71, background: "#f6f4ef", boxShadow: "-14px 0 46px rgba(20,33,61,.35)", display: "flex", flexDirection: "column" }}>
            {/* header + chips */}
            <div style={{ background: NAVY, padding: "14px 18px", borderBottom: "3px solid var(--gold)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", color: "#c9b27c" }}>CASE DRILL</div>
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
              {/* KPI strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                {[
                  ["Cases", fN(total), TEAL], ["Open", fN(open), AMBER], ["Closed", fN(total - open), GREEN],
                  ["Overdue", fN(overdue), RED], ["At risk", fN(atrisk), GOLD], ["Avg open age", `${avgAge.toFixed(1)} d`, NAVY],
                ].map(([k, v, col]) => (
                  <div key={k as string} style={{ background: "#fff", border: "1px solid #eae6da", borderLeft: `4px solid ${col}`, borderRadius: 10, padding: "9px 11px" }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
                    <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* mini trend */}
              {trend.length > 1 && (
                <div style={CARD}>
                  <h3 style={H3}>Opened by month</h3>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90, overflowX: "auto", paddingBottom: 2 }}>
                    {(() => {
                      const mx = Math.max(...trend.map(([, v]) => v), 1);
                      return trend.map(([k, v]) => (
                        <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 34 }}
                          onClick={() => onAddChip({ dim: "mon", val: k, label: ymLbl(k) })}
                          onMouseEnter={e => showTip(e, `<b>${ymLbl(k)}</b><br/>${fN(v)} opened<br/>click → narrow`)}
                          onMouseMove={e => showTip(e, `<b>${ymLbl(k)}</b><br/>${fN(v)} opened`)} onMouseLeave={hideTip}>
                          <div style={{ width: 16, height: `${(v / mx) * 62}px`, background: TEAL, borderRadius: "3px 3px 0 0", minHeight: 2, cursor: "pointer" }} />
                          <span style={{ fontSize: 8.5, color: "var(--mut)", whiteSpace: "nowrap" }}>{ymLbl(k)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {!has("typ") && <List title="By case type" dim="typ" get={c => c.typ} names={CM.TYP} />}
              {!has("sta") && !has("stg") && <List title="By status" dim="sta" get={c => c.sta} names={CM.STA} />}
              {!has("org") && <List title="By origin" dim="org" get={c => c.org} names={CM.ORG} />}
              {!has("own") && <List title="By case owner" dim="own" get={c => c.own} names={CM.OWN} top={10} />}
              {!has("tl") && <List title="By team leader" dim="tl" get={c => c.tl} names={CM.TL} top={8} />}
              {!has("age") && (
                <List title="Open cases by ageing" dim="age" get={c => (isClosed(c) ? -1 : ageBand(c.age))} labelOf={k => AGE_BANDS[k].label} />
              )}

              {/* records */}
              <div style={CARD}>
                <h3 style={H3}>Records ({fN(rows.length)})</h3>
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {rows.slice(0, 120).map((c, i) => (
                    <div key={`${c.caseNo}-${i}`} onClick={() => onRecord(c)}
                      style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid #f0ede5", cursor: "pointer", fontSize: 12 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                      <span style={{ fontWeight: 700, color: TEAL, whiteSpace: "nowrap" }}>{c.caseNo}</span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)" }}>{c.account || "—"}</span>
                      <span style={{ color: "var(--mut)", whiteSpace: "nowrap" }}>{fmtDay(c.open)}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 6, padding: "1px 7px", background: isClosed(c) ? "#e2f3ec" : "#fdf1dc", color: isClosed(c) ? "#1a7a4a" : "#b06c00", whiteSpace: "nowrap" }}>
                        {c.sta >= 0 ? CM.STA[c.sta] : "—"}
                      </span>
                    </div>
                  ))}
                  {rows.length > 120 && <div style={{ fontSize: 11, color: "var(--mut)", padding: "8px 0" }}>Showing first 120 — narrow further with the lists above.</div>}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
