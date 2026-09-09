import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showTip, hideTip } from "../common/hoverTip";
import { Zoomable } from "../common/Zoomable";
import { VA, BUCKET_COLS, fmtDue, fN, fMoney, type VaRow } from "./vendorAgeingShared";

const NAVY = "#14213D", TEAL = "#0E7490", GREEN = "#1BAF7A", RED = "#c0392b", GOLD = "#B8893C";
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #eae6da", borderRadius: 12, boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)", padding: "14px 16px", marginBottom: 14 };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 15.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 2px" };
const CAP: React.CSSProperties = { fontSize: 11, color: "var(--mut)", marginBottom: 10 };

export type VaDim = "vend" | "recon" | "dtyp" | "spgl" | "bucket" | "blocked";
export interface VaChip { dim: VaDim; val: number; label: string }
export const bLbl = (k: number) => (k === 0 ? "Not due" : `${VA.BUCKET[k]} days`);
const DIMN: Record<VaDim, string> = { vend: "Vendor", recon: "Recon G/L", dtyp: "Doc type", spgl: "Sp. G/L", bucket: "Bucket", blocked: "Payment" };

const matches = (r: VaRow, ch: VaChip): boolean => {
  switch (ch.dim) {
    case "vend": return r.vend === ch.val;
    case "recon": return r.recon === ch.val;
    case "dtyp": return r.dtyp === ch.val;
    case "spgl": return r.spgl === ch.val;
    case "bucket": return r.bucket === ch.val;
    case "blocked": return r.blocked === ch.val;
  }
};

/* ---------------- Drill drawer — same shell as CostDrillDrawer ---------------- */
function VaDrillDrawer({ seed, baseRows, baseLabel, onClose, onAddChip }: {
  seed: { chips: VaChip[] } | null; baseRows: VaRow[]; baseLabel: string;
  onClose: () => void; onAddChip: (c: VaChip) => void;
}) {
  const chips = seed?.chips ?? [];
  const has = (d: VaDim) => chips.some(c => c.dim === d);
  const rows = useMemo(() => baseRows.filter(r => chips.every(ch => matches(r, ch))), [baseRows, chips]);
  const total = rows.reduce((s, r) => s + r.amt, 0);
  const over180 = rows.filter(r => r.bucket === 6).reduce((s, r) => s + r.amt, 0);
  const vendors = new Set(rows.map(r => r.vend)).size;

  const Bars = ({ items, dim }: { items: { k: number; label: string; v: number }[]; dim: VaDim }) => {
    const mx = Math.max(...items.map(it => Math.abs(it.v)), 1);
    return (
      <div style={{ maxHeight: 210, overflowY: "auto", paddingRight: 4 }}>
        {items.slice(0, 25).map(it => (
          <div key={it.k} className="barrow" onClick={() => onAddChip({ dim, val: it.k, label: it.label })}
            onMouseEnter={e => showTip(e, `<b>${it.label}</b><br/>${fMoney(it.v)} · click → add filter`)}
            onMouseMove={e => showTip(e, `<b>${it.label}</b><br/>${fMoney(it.v)}`)} onMouseLeave={hideTip}
            style={{ padding: "3.5px 0", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2, gap: 8 }}>
              <span style={{ color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
              <span style={{ color: "var(--mut)", whiteSpace: "nowrap" }}>{fMoney(it.v)}</span>
            </div>
            <div style={{ height: 7, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(Math.abs(it.v) / mx) * 100}%`, background: TEAL, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    );
  };
  const aggBy = (key: (r: VaRow) => number, names: string[]) => {
    const m = new Map<number, number>();
    rows.forEach(r => m.set(key(r), (m.get(key(r)) ?? 0) + r.amt));
    return [...m.entries()].map(([k, v]) => ({ k, label: names[k] ?? "—", v })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  };
  const vendItems = aggBy(r => r.vend, VA.VEND);
  const reconItems = aggBy(r => r.recon, VA.RECON);
  const docLines = useMemo(() => [...rows].sort((a, b) => Math.abs(b.amt) - Math.abs(a.amt)).slice(0, 200), [rows]);

  return (
    <AnimatePresence>
      {seed && (
        <>
          <motion.div key="vaov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.35)", zIndex: 70 }} />
          <motion.div key="vadw" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(560px, 95vw)", zIndex: 71, background: "#f6f4ef", boxShadow: "-14px 0 46px rgba(20,33,61,.35)", display: "flex", flexDirection: "column" }}>
            <div style={{ background: NAVY, padding: "14px 18px", borderBottom: "3px solid var(--gold)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", color: "#c9b27c" }}>VENDOR DRILL</div>
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
                  <span key={i} style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.25)", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "4px 11px" }}>
                    {DIMN[c.dim]}: {c.label}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
                {[{ l: "Outstanding", v: fMoney(total), c: TEAL }, { l: "> 180 days", v: fMoney(over180), c: RED }, { l: "Vendors · items", v: `${fN(vendors)} · ${fN(rows.length)}`, c: GOLD }].map(t => (
                  <div key={t.l} style={{ background: "#fff", border: "1px solid #eae6da", borderLeft: `5px solid ${t.c}`, borderRadius: 10, padding: "9px 11px" }}>
                    <div style={{ fontFamily: "Georgia,serif", fontSize: 16, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>{t.v}</div>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", marginTop: 3 }}>{t.l}</div>
                  </div>
                ))}
              </div>
              <div style={CARD}>
                <h3 style={H3}>Ageing buckets</h3>
                <div style={CAP}>click a bucket → add filter</div>
                {(() => {
                  const m = new Map<number, number>(); rows.forEach(r => m.set(r.bucket, (m.get(r.bucket) ?? 0) + r.amt));
                  const mx = Math.max(...[...m.values()].map(Math.abs), 1);
                  return VA.BUCKET.map((_b, k) => {
                    const v = m.get(k) ?? 0;
                    return (
                      <div key={k} className="barrow" onClick={() => onAddChip({ dim: "bucket", val: k, label: bLbl(k) })}
                        onMouseEnter={e => showTip(e, `<b>${bLbl(k)}</b><br/>${fMoney(v)}`)} onMouseMove={e => showTip(e, `<b>${bLbl(k)}</b> ${fMoney(v)}`)} onMouseLeave={hideTip}
                        style={{ padding: "3px 0", cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 2 }}>
                          <span style={{ color: "var(--ink)", fontWeight: 700 }}>{bLbl(k)}</span>
                          <span style={{ color: "var(--mut)", fontWeight: 700 }}>{fMoney(v)}</span>
                        </div>
                        <div style={{ height: 7, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${(Math.abs(v) / mx) * 100}%`, background: BUCKET_COLS[k], borderRadius: 4 }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              {!has("vend") && <div style={CARD}><h3 style={H3}>Top vendors</h3><div style={CAP}>click → add filter</div><Bars items={vendItems} dim="vend" /></div>}
              {!has("recon") && <div style={CARD}><h3 style={H3}>By Recon G/L</h3><div style={CAP}>click → add filter</div><Bars items={reconItems} dim="recon" /></div>}
              <div style={CARD}>
                <h3 style={H3}>Open items</h3>
                <div style={CAP}>top {Math.min(docLines.length, 200)} of {fN(rows.length)} by value</div>
                <div style={{ maxHeight: 320, overflowY: "auto", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 460 }}>
                    <thead>
                      <tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                        {["Doc no.", "Vendor", "Due", "Bucket", "Amount"].map(h => (
                          <th key={h} style={{ textAlign: h === "Amount" ? "right" : "left", fontSize: 9.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "6px 8px", borderBottom: "2px solid #eae6da" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {docLines.map(r => (
                        <tr key={r.i} style={{ borderBottom: "1px solid #f0ede5" }}>
                          <td style={{ padding: "5px 8px", fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>{r.doc}</td>
                          <td style={{ padding: "5px 8px", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{VA.VEND[r.vend]}</td>
                          <td style={{ padding: "5px 8px", whiteSpace: "nowrap", color: "var(--mut)" }}>{fmtDue(r.due)}</td>
                          <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                            <span style={{ background: `${BUCKET_COLS[r.bucket]}22`, color: BUCKET_COLS[r.bucket], fontWeight: 800, fontSize: 11, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>{bLbl(r.bucket)}</span>
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: r.amt < 0 ? GREEN : "var(--ink)" }}>{fMoney(r.amt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Main view ---------------- */
export function VendorAgeingView({ rows, scopeLabel }: { rows: VaRow[]; scopeLabel: string }) {
  const [drill, setDrill] = useState<{ chips: VaChip[] } | null>(null);
  const open = (chips: VaChip[]) => setDrill({ chips });

  const total = rows.reduce((s, r) => s + r.amt, 0);
  const byBucket = useMemo(() => {
    const m = new Map<number, { v: number; n: number }>();
    rows.forEach(r => { if (!m.has(r.bucket)) m.set(r.bucket, { v: 0, n: 0 }); const e = m.get(r.bucket)!; e.v += r.amt; e.n++; });
    return m;
  }, [rows]);
  const over180 = byBucket.get(6)?.v ?? 0;
  const notDue = byBucket.get(0)?.v ?? 0;
  const blockedAmt = rows.filter(r => r.blocked === 1).reduce((s, r) => s + r.amt, 0);
  const vendors = new Set(rows.map(r => r.vend)).size;

  const byVend = useMemo(() => {
    const m = new Map<number, { v: number; o: number; n: number }>();
    rows.forEach(r => { if (!m.has(r.vend)) m.set(r.vend, { v: 0, o: 0, n: 0 }); const e = m.get(r.vend)!; e.v += r.amt; if (r.bucket === 6) e.o += r.amt; e.n++; });
    return [...m.entries()].sort((a, b) => Math.abs(b[1].v) - Math.abs(a[1].v));
  }, [rows]);
  const byRecon = useMemo(() => {
    const m = new Map<number, number>();
    rows.forEach(r => m.set(r.recon, (m.get(r.recon) ?? 0) + r.amt));
    return [...m.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  }, [rows]);
  const byDtyp = useMemo(() => {
    const m = new Map<number, number>();
    rows.forEach(r => m.set(r.dtyp, (m.get(r.dtyp) ?? 0) + r.amt));
    return [...m.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  }, [rows]);

  const KPI = ({ k, v, s, col, onClick }: { k: string; v: string; s: string; col: string; onClick?: () => void }) => (
    <div onClick={onClick}
      onMouseEnter={e => showTip(e, `<b>${k}</b><br/>${v} · ${s}${onClick ? "<br/>click → drill" : ""}`)}
      onMouseMove={e => showTip(e, `<b>${k}</b><br/>${v}`)} onMouseLeave={hideTip}
      style={{ background: "#fff", border: "1px solid #eae6da", borderLeft: `6px solid ${col}`, borderRadius: 12, boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)", padding: "12px 14px", display: "flex", gap: 10, alignItems: "center", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${col}1f`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ width: 13, height: 13, borderRadius: "50%", background: col }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 21, fontWeight: 700, color: "var(--ink)", lineHeight: 1, whiteSpace: "nowrap" }}>{v}</div>
        <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "1.1px", textTransform: "uppercase", color: "var(--mut)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k}</div>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8a8474", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s}</div>
      </div>
    </div>
  );

  return (
    <>
      {/* KPI tickets */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 14 }}>
        <KPI k="Net outstanding" v={fMoney(total)} s={`${fN(rows.length)} open items · ${fN(vendors)} vendors`} col={NAVY} />
        <KPI k="Overdue > 180 days" v={fMoney(over180)} s={`${total !== 0 ? ((over180 / total) * 100).toFixed(1) : "—"}% of outstanding`} col={RED}
          onClick={() => open([{ dim: "bucket", val: 6, label: "> 180 days" }])} />
        <KPI k="Not yet due" v={fMoney(notDue)} s={`${byBucket.get(0)?.n ?? 0} items`} col={GREEN}
          onClick={() => open([{ dim: "bucket", val: 0, label: "Not Due" }])} />
        <KPI k="Payment blocked" v={fMoney(blockedAmt)} s={`${fN(rows.filter(r => r.blocked === 1).length)} items with block flag`} col={GOLD}
          onClick={() => open([{ dim: "blocked", val: 1, label: "Blocked" }])} />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(430px, 1fr))", gap: 14, marginBottom: 14 }}>
        <Zoomable title="Top vendors by outstanding">
          <div style={{ ...CARD, height: "100%", marginBottom: 0, display: "flex", flexDirection: "column" }}>
            <h3 style={H3}>Top Vendors by Outstanding</h3>
            <div style={CAP}>navy = total outstanding · red = &gt; 180 days portion · click a vendor → drill · top 60 of {fN(byVend.length)}</div>
            <div style={{ flex: 1, minHeight: 0, maxHeight: 330, overflowY: "auto", paddingRight: 6 }}>
              {(() => {
                const mx = Math.max(...byVend.map(([, e]) => Math.abs(e.v)), 1);
                return byVend.slice(0, 60).map(([v, e]) => (
                  <div key={v} className="barrow" onClick={() => open([{ dim: "vend", val: v, label: VA.VEND[v] }])}
                    onMouseEnter={ev => showTip(ev, `<b>${VA.VEND[v]}</b><br/>Outstanding — ${fMoney(e.v)}<br/>&gt;180d — ${fMoney(e.o)}<br/>${fN(e.n)} items`)}
                    onMouseMove={ev => showTip(ev, `<b>${VA.VEND[v]}</b> ${fMoney(e.v)}`)} onMouseLeave={hideTip}
                    style={{ padding: "4px 0", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                      <span style={{ color: "var(--ink)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{VA.VEND[v]}</span>
                      <span style={{ color: "var(--mut)", fontWeight: 700, flexShrink: 0 }}>{fMoney(e.v)}</span>
                    </div>
                    <div style={{ position: "relative", height: 8, background: "#f0ede5", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ position: "absolute", inset: 0, width: `${(Math.abs(e.v) / mx) * 100}%`, background: NAVY, borderRadius: 4 }} />
                      <div style={{ position: "absolute", inset: 0, width: `${(Math.abs(e.o) / mx) * 100}%`, background: RED, borderRadius: 4 }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </Zoomable>
        <Zoomable title="Outstanding by recon GL">
          <div style={{ ...CARD, height: "100%", marginBottom: 0, display: "flex", flexDirection: "column" }}>
            <h3 style={H3}>Outstanding by Recon G/L</h3>
            <div style={CAP}>payables ledger split · click → drill</div>
            <div style={{ flex: 1, minHeight: 0, maxHeight: 330, overflowY: "auto", paddingRight: 6 }}>
              {(() => {
                const mx = Math.max(...byRecon.map(([, v]) => Math.abs(v)), 1);
                return byRecon.map(([k, v]) => (
                  <div key={k} className="barrow" onClick={() => open([{ dim: "recon", val: k, label: VA.RECON[k] }])}
                    onMouseEnter={ev => showTip(ev, `<b>${VA.RECON[k]}</b><br/>${fMoney(v)}`)}
                    onMouseMove={ev => showTip(ev, `<b>${VA.RECON[k]}</b> ${fMoney(v)}`)} onMouseLeave={hideTip}
                    style={{ padding: "3.5px 0", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                      <span style={{ color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{VA.RECON[k]}</span>
                      <span style={{ color: "var(--mut)", fontWeight: 700, flexShrink: 0 }}>{fMoney(v)}</span>
                    </div>
                    <div style={{ height: 8, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(Math.abs(v) / mx) * 100}%`, background: TEAL, borderRadius: 5 }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </Zoomable>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginBottom: 14 }}>
        <Zoomable title="Doc type split">
          <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
            <h3 style={H3}>Outstanding by Document Type</h3>
            <div style={CAP}>click → drill</div>
            <div style={{ maxHeight: 280, overflowY: "auto", paddingRight: 6 }}>
              {(() => {
                const mx = Math.max(...byDtyp.map(([, v]) => Math.abs(v)), 1);
                return byDtyp.map(([k, v]) => (
                  <div key={k} className="barrow" onClick={() => open([{ dim: "dtyp", val: k, label: VA.DTYP[k] }])}
                    onMouseEnter={ev => showTip(ev, `<b>${VA.DTYP[k]}</b><br/>${fMoney(v)}`)}
                    onMouseMove={ev => showTip(ev, `<b>${VA.DTYP[k]}</b> ${fMoney(v)}`)} onMouseLeave={hideTip}
                    style={{ padding: "3.5px 0", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                      <span style={{ color: "var(--ink)", fontWeight: 600 }}>{VA.DTYP[k]}</span>
                      <span style={{ color: "var(--mut)", fontWeight: 700 }}>{fMoney(v)}</span>
                    </div>
                    <div style={{ height: 8, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(Math.abs(v) / mx) * 100}%`, background: GOLD, borderRadius: 5 }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </Zoomable>
        <Zoomable title="Ageing distribution">
          <div style={{ ...CARD, height: "100%", marginBottom: 0 }}>
            <h3 style={H3}>Ageing Distribution</h3>
            <div style={CAP}>value share per bucket · click → drill</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 220, paddingTop: 8 }}>
              {VA.BUCKET.map((_b, k) => {
                const e = byBucket.get(k) ?? { v: 0, n: 0 };
                const mx = Math.max(...VA.BUCKET.map((_, i) => Math.abs(byBucket.get(i)?.v ?? 0)), 1);
                return (
                  <div key={k} onClick={() => open([{ dim: "bucket", val: k, label: bLbl(k) }])}
                    onMouseEnter={ev => showTip(ev, `<b>${bLbl(k)}</b><br/>${fMoney(e.v)} · ${fN(e.n)} items`)}
                    onMouseMove={ev => showTip(ev, `<b>${bLbl(k)}</b> ${fMoney(e.v)}`)} onMouseLeave={hideTip}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", cursor: "pointer" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 4, whiteSpace: "nowrap" }}>{fMoney(e.v)}</span>
                    <div style={{ width: "72%", height: `${Math.max((Math.abs(e.v) / mx) * 74, e.v !== 0 ? 2 : 0)}%`, background: BUCKET_COLS[k], borderRadius: "5px 5px 0 0" }} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: BUCKET_COLS[k], marginTop: 6, whiteSpace: "nowrap" }}>{bLbl(k)}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--mut)", marginTop: 1, whiteSpace: "nowrap" }}>{fN(e.n)} items</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Zoomable>
      </div>

      {/* Vendor table */}
      <Zoomable title="Vendor-wise ageing">
        <div style={CARD}>
          <h3 style={H3}>Vendor-wise Ageing</h3>
          <div style={CAP}>{fN(byVend.length)} vendors in scope · click a row → drill</div>
          <div style={{ maxHeight: 420, overflowY: "auto", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 760 }}>
              <thead>
                <tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                  {["Vendor", "Items", "Not due", "0–90 days", "91–180 days", "> 180 days", "Total"].map(h => (
                    <th key={h} style={{ textAlign: h === "Vendor" ? "left" : "right", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "8px 10px", borderBottom: "2px solid #eae6da" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byVend.slice(0, 400).map(([v]) => {
                  const vr = rows.filter(r => r.vend === v);
                  const bsum = (lo: number, hi: number) => vr.filter(r => r.bucket >= lo && r.bucket <= hi).reduce((s, r) => s + r.amt, 0);
                  const tot = vr.reduce((s, r) => s + r.amt, 0);
                  return (
                    <tr key={v} onClick={() => open([{ dim: "vend", val: v, label: VA.VEND[v] }])}
                      style={{ cursor: "pointer", borderBottom: "1px solid #f0ede5" }}
                      onMouseEnter={ev => { (ev.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                      onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.background = ""; }}>
                      <td style={{ padding: "7px 10px", fontWeight: 700, color: "var(--ink)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{VA.VEND[v]}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: "var(--mut)" }}>{fN(vr.length)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: GREEN, fontWeight: 700 }}>{fMoney(bsum(0, 0))}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right" }}>{fMoney(bsum(1, 3))}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right" }}>{fMoney(bsum(4, 5))}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: RED, fontWeight: 700 }}>{fMoney(bsum(6, 6))}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 800 }}>{fMoney(tot)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {byVend.length > 400 && (
              <div style={{ fontSize: 11.5, color: "var(--mut)", padding: "8px 2px 2px" }}>
                Showing top 400 of {fN(byVend.length)} vendors — use vendor search to find the rest.
              </div>
            )}
          </div>
        </div>
      </Zoomable>

      <VaDrillDrawer seed={drill} baseRows={rows} baseLabel={scopeLabel}
        onClose={() => setDrill(null)}
        onAddChip={(chip: VaChip) => setDrill(d => (d && !d.chips.some(c => c.dim === chip.dim) ? { chips: [...d.chips, chip] } : d))} />
    </>
  );
}
