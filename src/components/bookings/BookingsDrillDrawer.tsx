import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showTip, hideTip } from "../common/hoverTip";
import {
  HBarListRaw as HBarList, Banner, Spark,
  CARD, H3, CAP, BLUE, TEAL, GOLD, GREEN,
} from "../leads/footfallCharts";
import {
  type Bk, type Dim, type Chip, DIMN, BROKERS,
  MON, fN, CRf, ymKey, ymLbl, PSHORT, BANDS, bandOf,
} from "./bookingsShared";
import { PDRN } from "../../utils/pdrnLogic";

export interface BkDrillSeed { dim: Dim; val: number | string; label: string }

function applyChips(rows: Bk[], chips: Chip[]): Bk[] {
  return rows.filter(b =>
    chips.every(c => {
      switch (c.dim) {
        case "p": return b.p === c.val;
        case "cfg": return b.cfg === c.val;
        case "tw": return b.tw === c.val;
        case "band": return bandOf(b) === c.val;
        case "mon": return ymKey(b) === c.val;
        default: return true;
      }
    })
  );
}

/** BOOKINGS · DETAILED BREAKDOWN — right-side drill drawer matching
 * the footfall/digital/CP drawers: removable stacking chips, insight
 * tiles, scoped KPIs, breakdown cards, combined value+count trend,
 * broker leaderboard, paginated records (row → detail slide-over via
 * onRecord). */
export function BookingsDrillDrawer({ seed, baseRows, cancelledBase, baseLabel, onClose, onRecord }: {
  seed: BkDrillSeed | null;
  baseRows: Bk[];
  cancelledBase: Bk[];
  baseLabel: string;
  onClose: () => void;
  onRecord: (b: Bk) => void;
}) {
  const [chips, setChips] = useState<Chip[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (seed) { setChips([{ dim: seed.dim, val: seed.val, label: seed.label }]); setPage(1); }
  }, [seed]);

  const rows = useMemo(() => applyChips(baseRows, chips), [baseRows, chips]);
  const cancelled = useMemo(() => applyChips(cancelledBase, chips), [cancelledBase, chips]);
  const total = rows.length;
  const tcv = rows.reduce((s, b) => s + b.tsv, 0);
  const avg = total ? tcv / total : 0;
  const area = rows.reduce((s, b) => s + b.area, 0);

  function addChip(dim: Dim) {
    return (val: number | string, label: string) => {
      setChips(prev => [...prev.filter(c => c.dim !== dim), { dim, val, label }]);
      setPage(1);
    };
  }
  function removeChip(dim: Dim) {
    const next = chips.filter(c => c.dim !== dim);
    if (next.length === 0) onClose(); else setChips(next);
    setPage(1);
  }
  const has = (dim: Dim) => chips.some(c => c.dim === dim);

  const monthly = useMemo(() => {
    const m = new Map<string, { n: number; v: number }>();
    rows.forEach(b => { const k = ymKey(b); if (!m.has(k)) m.set(k, { n: 0, v: 0 }); const e = m.get(k)!; e.n++; e.v += b.tsv; });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, e]) => ({ key: k, label: ymLbl(k), value: e.n, v: e.v }));
  }, [rows]);

  const listFrom = (get: (b: Bk) => number, names: string[]) => {
    const m = new Map<number, number>();
    rows.forEach(b => { const k = get(b); if (k >= 0) m.set(k, (m.get(k) ?? 0) + 1); });
    return [...m.entries()].map(([key, value]) => ({ key, label: names[key], value })).sort((a, b) => b.value - a.value);
  };

  // insights
  const insights = useMemo(() => {
    const out: { k: string; v: string; hint: string }[] = [];
    const top = (get: (b: Bk) => number, names: string[]) => {
      const m = new Map<number, number>();
      rows.forEach(b => { const k = get(b); if (k >= 0) m.set(k, (m.get(k) ?? 0) + 1); });
      const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
      return best ? { name: names[best[0]], n: best[1] } : null;
    };
    const tp = top(b => b.p, PSHORT);
    if (tp) out.push({ k: "Top project", v: `${tp.name} · ${Math.round((tp.n / Math.max(total, 1)) * 100)}%`, hint: `${fN(tp.n)} bookings` });
    const tc = top(b => b.cfg, PDRN.CFG);
    if (tc) out.push({ k: "Top configuration", v: tc.name, hint: `${fN(tc.n)} bookings` });
    const tb = top(b => b.broker, BROKERS);
    if (tb) out.push({ k: "Top channel partner", v: tb.name, hint: `${fN(tb.n)} bookings brought` });
    out.push({ k: "Avg ticket", v: CRf(avg), hint: `${CRf(tcv)} across ${fN(total)} bookings` });
    const bandC = BANDS.map((band, i) => ({ band, n: rows.filter(b => bandOf(b) === i).length })).sort((a, b) => b.n - a.n)[0];
    if (bandC && bandC.n) out.push({ k: "Dominant ticket band", v: bandC.band.label, hint: `${fN(bandC.n)} bookings` });
    const bm = [...monthly].sort((a, b) => b.value - a.value)[0];
    if (bm) out.push({ k: "Busiest month", v: `${bm.label} · ${fN(bm.value)}`, hint: CRf(bm.v) });
    out.push({ k: "Cancelled in scope", v: fN(cancelled.length), hint: cancelled.length ? CRf(cancelled.reduce((s, b) => s + b.tsv, 0)) : "none" });
    return out;
  }, [rows, monthly, cancelled, total, tcv, avg]);

  const PER = 8;
  const sorted = useMemo(() => [...rows].sort((a, b) => (b.y - a.y) || (b.m - a.m) || (b.tsv - a.tsv)), [rows]);
  const pages = Math.max(1, Math.ceil(sorted.length / PER));
  const shown = sorted.slice((page - 1) * PER, page * PER);

  const KPI = ({ l, v, s, spark }: { l: string; v: string; s?: string; spark?: boolean }) => (
    <div style={{ ...CARD, padding: "12px 15px" }}
      onMouseEnter={e => showTip(e, `<b>${l}</b><br/>${v}${s ? ` · ${s}` : ""}`)}
      onMouseMove={e => showTip(e, `<b>${l}</b><br/>${v}${s ? ` · ${s}` : ""}`)}
      onMouseLeave={hideTip}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)" }}>{l}</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 21, fontWeight: 700, color: "var(--ink)", marginTop: 3 }}>{v}</div>
      {s && <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 1 }}>{s}</div>}
      {spark && <Spark items={monthly.slice(-18)} />}
    </div>
  );

  const title = chips.map(c => `${DIMN[c.dim]}: ${c.label}`).join(" · ");

  return (
    <AnimatePresence>
      {seed && (
        <>
          <motion.div key="bkdov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.45)", zIndex: 70 }} />
          <motion.div key="bkddw" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(880px, 96vw)", zIndex: 71, background: "#f6f4ef", boxShadow: "-14px 0 50px rgba(20,33,61,.3)", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ background: "#0f2233", padding: "18px 24px 16px", borderBottom: "3px solid #0e7490" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "1.6px", color: "#7fb8d4" }}>BOOKINGS · DETAILED BREAKDOWN</div>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 21, fontWeight: 700, color: "#fff", marginTop: 4 }}>{title}</div>
                </div>
                <button onClick={onClose} aria-label="Close"
                  style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 9, fontSize: 16, cursor: "pointer", flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>
                {chips.map(c => (
                  <button key={c.dim} onClick={() => removeChip(c.dim)}
                    style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.14)", color: "#fff", border: "none", borderRadius: 7, padding: "5px 11px", fontSize: 11.5, fontFamily: "inherit", cursor: "pointer" }}>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", color: "#7fb8d4" }}>{DIMN[c.dim].toUpperCase()}</span>
                    {c.label} <span style={{ opacity: 0.7 }}>✕</span>
                  </button>
                ))}
                <span style={{ fontSize: 10.5, color: "#7fb8d4", alignSelf: "center" }}>scope: {baseLabel}</span>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 30px" }}>
              {/* Insights */}
              <div style={{ ...CARD, marginBottom: 14 }}>
                <h3 style={H3}>Key insights for this selection</h3>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                  {insights.map(i => (
                    <div key={i.k} style={{ background: "#faf9f6", border: "1px solid #eae6da", borderRadius: 10, padding: "10px 14px", minWidth: 170 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "var(--mut)" }}>{i.k}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginTop: 3 }}>{i.v}</div>
                      <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 1 }}>{i.hint}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 4 }}>
                <KPI l="Bookings" v={fN(total)} s="in this selection" spark />
                <KPI l="Agreement value" v={CRf(tcv)} />
                <KPI l="Avg ticket" v={CRf(avg)} />
                <KPI l="Area" v={`${(area / 1e5).toFixed(2)} L sqft`} s={area ? `₹${Math.round(tcv / area).toLocaleString("en-IN")}/sqft` : undefined} />
                <KPI l="Cancelled" v={fN(cancelled.length)} s={cancelled.length ? CRf(cancelled.reduce((s, b) => s + b.tsv, 0)) : "none in scope"} />
              </div>

              <div><Banner title="BOOKINGS ANALYSIS" sub={`${fN(total)} bookings · ${CRf(tcv)}`} /></div>

              {/* Breakdown cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 12 }}>
                {!has("p") && (
                  <div style={CARD}>
                    <h3 style={H3}>By project</h3>
                    <div style={CAP}>click → narrow further</div>
                    <HBarList items={listFrom(b => b.p, PSHORT)} total={total} color={BLUE} onPick={addChip("p")} />
                  </div>
                )}
                {!has("cfg") && (
                  <div style={CARD}>
                    <h3 style={H3}>By configuration</h3>
                    <div style={CAP}>click → narrow further</div>
                    <HBarList items={listFrom(b => b.cfg, PDRN.CFG)} total={total} color={GOLD} onPick={addChip("cfg")} />
                  </div>
                )}
                {!has("band") && (
                  <div style={CARD}>
                    <h3 style={H3}>Ticket-size mix</h3>
                    <div style={CAP}>click a band → narrow</div>
                    <HBarList
                      items={BANDS.map((band, i) => ({ key: i, label: band.label, value: rows.filter(b => bandOf(b) === i).length }))}
                      total={total} color={TEAL} onPick={addChip("band")} />
                  </div>
                )}
                {!has("tw") && (
                  <div style={CARD}>
                    <h3 style={H3}>By tower</h3>
                    <div style={CAP}>click → narrow further</div>
                    <HBarList items={listFrom(b => b.tw, PDRN.TW)} total={total} color={GREEN} onPick={addChip("tw")} maxHeight={230} sortable />
                  </div>
                )}
                <div style={CARD}>
                  <h3 style={H3}>Channel-partner leaderboard</h3>
                  <div style={CAP}>bookings brought in this selection</div>
                  {(() => {
                    const g = new Map<number, { n: number; v: number }>();
                    rows.forEach(b => { if (b.broker >= 0) { if (!g.has(b.broker)) g.set(b.broker, { n: 0, v: 0 }); const e = g.get(b.broker)!; e.n++; e.v += b.tsv; } });
                    const items = [...g.entries()].map(([k, e]) => ({ k, ...e })).sort((a, b) => b.n - a.n);
                    const mx = Math.max(...items.map(i => i.n), 1);
                    return (
                      <div style={{ maxHeight: 230, overflowY: "auto", paddingRight: 6 }}>
                        {items.map(it => (
                          <div key={it.k} className="barrow"
                            onMouseEnter={e => showTip(e, `<b>${BROKERS[it.k]}</b><br/>${fN(it.n)} bookings · ${CRf(it.v)}`)}
                            onMouseMove={e => showTip(e, `<b>${BROKERS[it.k]}</b><br/>${fN(it.n)} bookings · ${CRf(it.v)}`)}
                            onMouseLeave={hideTip}
                            style={{ padding: "4px 0" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3, gap: 8 }}>
                              <span style={{ color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{BROKERS[it.k]}</span>
                              <span style={{ color: "var(--mut)", whiteSpace: "nowrap" }}>{fN(it.n)} · {CRf(it.v)}</span>
                            </div>
                            <div style={{ height: 8, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${(it.n / mx) * 100}%`, background: TEAL, borderRadius: 5 }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Trend */}
              {!has("mon") && (
                <div style={{ ...CARD, marginTop: 12 }}>
                  <h3 style={H3}>Booking trend</h3>
                  <div style={CAP}>bars = value (₹ Cr labels) · gold line = count · click a month</div>
                  <div style={{ overflowX: "auto" }}>
                    {(() => {
                      const TW_ = Math.max(monthly.length * 46, 300), TH = 170, padB = 24, padT = 22;
                      const vmax = Math.max(...monthly.map(t => t.v), 1), nmax = Math.max(...monthly.map(t => t.value), 1);
                      return (
                        <svg viewBox={`0 0 ${TW_} ${TH}`} width={TW_} height={TH} style={{ display: "block" }}>
                          {monthly.map((t, i) => {
                            const bw = 30, gap = 16, x = i * (bw + gap) + 6;
                            const bh = (t.v / vmax) * (TH - padB - padT);
                            return (
                              <g key={t.key} style={{ cursor: "pointer" }}
                                onClick={() => addChip("mon")(t.key, t.label)}
                                onMouseEnter={e => showTip(e, `<b>${t.label}</b><br/>${CRf(t.v)} · ${fN(t.value)} bookings`)}
                                onMouseMove={e => showTip(e, `<b>${t.label}</b><br/>${CRf(t.v)} · ${fN(t.value)} bookings`)}
                                onMouseLeave={hideTip}>
                                <rect x={x} y={0} width={bw + gap - 4} height={TH - padB} fill="transparent" />
                                <rect x={x} y={TH - padB - bh} width={bw} height={bh} rx="3" fill="#D7E2F0" />
                                <text x={x + bw / 2} y={TH - padB - bh - 4} textAnchor="middle" fontSize="8" fill="#3d4a63">{(t.v / 1e7).toFixed(0)}</text>
                                <text x={x + bw / 2} y={TH - 7} textAnchor="middle" fontSize="8" fill="#8a94a6">{t.label}</text>
                              </g>
                            );
                          })}
                          <polyline fill="none" stroke="#B8893C" strokeWidth="2"
                            points={monthly.map((t, i) => `${i * 46 + 6 + 15},${TH - padB - (t.value / nmax) * (TH - padB - padT)}`).join(" ")} />
                        </svg>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Records */}
              <div><Banner title="BOOKING RECORDS" sub={`${fN(total)} in selection · click a row for full detail`} /></div>
              <div style={{ ...CARD, paddingBottom: 6 }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--line)" }}>
                        {["Booked", "Project", "Tower · Unit", "Config", "Broker", "Value"].map((h, i) => (
                          <th key={h} style={{ textAlign: i === 5 ? "right" : "left", padding: "6px 8px", color: "var(--mut)", fontSize: 10, letterSpacing: "1px", textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((b, i) => (
                        <tr key={i} onClick={() => onRecord(b)}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
                          style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }}>
                          <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{MON[b.m - 1]}'{String(b.y).slice(2)}</td>
                          <td style={{ padding: "6px 8px" }}>{PSHORT[b.p]}</td>
                          <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{PDRN.TW[b.tw] ?? "—"} · {b.unit}</td>
                          <td style={{ padding: "6px 8px" }}>{PDRN.CFG[b.cfg]}</td>
                          <td style={{ padding: "6px 8px", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.broker >= 0 ? BROKERS[b.broker] : "—"}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "Georgia,serif", fontWeight: 700, whiteSpace: "nowrap" }}>{CRf(b.tsv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0 4px", fontSize: 12, color: "var(--mut)" }}>
                  <span>Page {page} of {fN(pages)}</span>
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ marginLeft: "auto", border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "4px 11px", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.45 : 1, fontFamily: "inherit" }}>‹ Prev</button>
                  <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={{ border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "4px 11px", cursor: page >= pages ? "default" : "pointer", opacity: page >= pages ? 0.45 : 1, fontFamily: "inherit" }}>Next ›</button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
