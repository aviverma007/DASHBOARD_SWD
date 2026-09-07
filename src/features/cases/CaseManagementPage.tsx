import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showTip, hideTip } from "../../components/common/hoverTip";
import { Zoomable } from "../../components/common/Zoomable";
import {
  CM, CASES, type CaseRec, isClosed, tatBucket,
  fmtDay, ymOf, ymLbl, fyOf, fyLbl, fN,
} from "../../components/cases/caseShared";

/* Look & feel tokens — same family as the Bookings page. */
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #eae6da", borderRadius: 14, padding: "16px 18px", boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)", marginBottom: 14 };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 16.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 2px" };
const CAP: React.CSSProperties = { fontSize: 11.5, color: "#b8893c", marginBottom: 12 };
const SEL: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "var(--ink)", background: "#fff", border: "1px solid #d8d2c4", borderRadius: 8, padding: "7px 10px", cursor: "pointer", fontFamily: "inherit", maxWidth: 210 };
const SELLBL: React.CSSProperties = { fontSize: 9.5, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: "rgba(255,255,255,.75)", marginBottom: 4 };
const NAVY = "#14213D", TEAL = "#0E7490", GOLD = "#B8893C", GREEN = "#1BAF7A", RED = "#c0392b", AMBER = "#EDA100";
const PAL = [TEAL, GOLD, GREEN, "#7fa8c9", RED, "#6a1b9a", "#00838f", "#e65100", "#37474f", "#558b2f", "#ad1457", "#1565c0"];

function Banner({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 10, background: TEAL, borderRadius: 10, padding: "7px 16px", margin: "6px 0 14px" }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "1.5px", color: "#fff" }}>{title}</span>
      <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.85)" }}>{sub}</span>
    </div>
  );
}

/** Reference-style ageing buckets for open cases. */
const AGE_BANDS = [
  { k: 0, label: "0–2 days", lo: 0, hi: 2 },
  { k: 1, label: "3–7 days", lo: 3, hi: 7 },
  { k: 2, label: "8–15 days", lo: 8, hi: 15 },
  { k: 3, label: "16–30 days", lo: 16, hi: 30 },
  { k: 4, label: "31–60 days", lo: 31, hi: 60 },
  { k: 5, label: "60+ days", lo: 61, hi: Infinity },
];
const ageBand = (age: number) => AGE_BANDS.find(b => age >= b.lo && age <= b.hi)?.k ?? 5;

export default function CaseManagementPage() {
  // ── filters ──
  const [prj, setPrj] = useState(-1);
  const [typ, setTyp] = useState(-1);
  const [sta, setSta] = useState<"all" | "open" | "closed">("all");
  const [org, setOrg] = useState(-1);
  const [own, setOwn] = useState(-1);
  const [app, setApp] = useState(-1); // Case Applicability
  const [tatF, setTatF] = useState<"" | "overdue" | "atrisk" | "within">("");
  const [ageF, setAgeF] = useState(-1);
  const [perMode, setPerMode] = useState<"all" | "y" | "m">("all");
  const [perSel, setPerSel] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<CaseRec | null>(null);

  const perOptions = useMemo(() => {
    if (perMode === "y") return [...new Set(CASES.filter(c => c.open >= 0).map(c => String(fyOf(c.open))))].sort().reverse();
    if (perMode === "m") return [...new Set(CASES.filter(c => c.open >= 0).map(c => ymOf(c.open)))].sort().reverse();
    return [];
  }, [perMode]);
  useEffect(() => { if (perMode !== "all" && perOptions.length && !perOptions.includes(perSel)) setPerSel(perOptions[0]); }, [perMode, perOptions, perSel]);

  const inScope = (c: CaseRec) =>
    (prj < 0 || c.prj === prj) && (typ < 0 || c.typ === typ) && (org < 0 || c.org === org) &&
    (own < 0 || c.own === own) && (app < 0 || c.app === app) &&
    (perMode === "all" || (c.open >= 0 && (perMode === "y" ? String(fyOf(c.open)) === perSel : ymOf(c.open) === perSel)));

  /** base = filter bar only; rows additionally apply status/TAT/age card filters. */
  const base = useMemo(() => CASES.filter(inScope),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prj, typ, org, own, app, perMode, perSel]);
  const rows = useMemo(() => base.filter(c =>
    (sta === "all" || (sta === "closed") === isClosed(c)) &&
    (!tatF || (!isClosed(c) && tatBucket(c) === tatF)) &&
    (ageF < 0 || (!isClosed(c) && ageBand(c.age) === ageF))
  ), [base, sta, tatF, ageF]);

  const total = base.length;
  const openT = base.filter(c => !isClosed(c)).length;
  const closedT = total - openT;
  const overdue = base.filter(c => !isClosed(c) && tatBucket(c) === "overdue").length;
  const atRisk = base.filter(c => !isClosed(c) && tatBucket(c) === "atrisk").length;
  const avgOpenAge = (() => {
    const withAge = base.filter(c => !isClosed(c) && c.age >= 0);
    return withAge.length ? withAge.reduce((s, c) => s + c.age, 0) / withAge.length : 0;
  })();

  const scopeLabel = [
    prj >= 0 ? CM.PRJ[prj] : "",
    perMode === "all" ? "all time" : perMode === "y" ? fyLbl(Number(perSel)) : (perSel ? ymLbl(perSel) : ""),
  ].filter(Boolean).join(" · ");

  const KPI = ({ k, v, s, active, onClick, color }: { k: string; v: string; s: string; active?: boolean; onClick?: () => void; color?: string }) => (
    <div onClick={onClick}
      onMouseEnter={e => showTip(e, `<b>${k}</b><br/>${v} · ${s}${onClick ? "<br/>click → filter records" : ""}`)}
      onMouseMove={e => showTip(e, `<b>${k}</b><br/>${v} · ${s}`)} onMouseLeave={hideTip}
      style={{ ...CARD, marginBottom: 0, padding: "13px 16px", cursor: onClick ? "pointer" : "default", borderLeft: `4px solid ${color ?? TEAL}`, outline: active ? `2px solid ${color ?? TEAL}` : "none" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginTop: 3 }}>{v}</div>
      <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 1 }}>{s}</div>
    </div>
  );

  function Donut({ items, onPick, picked }: { items: { k: number; label: string; v: number }[]; onPick?: (k: number) => void; picked?: number }) {
    const tot = Math.max(items.reduce((s, i) => s + i.v, 0), 1);
    const R = 52, C = 2 * Math.PI * R;
    let off = 0;
    return (
      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <svg width={140} height={140} viewBox="0 0 140 140">
          {items.map((it, i) => {
            const frac = it.v / tot, dash = frac * C, o = off; off += dash;
            return (
              <circle key={it.k} cx={70} cy={70} r={R} fill="none" stroke={PAL[i % PAL.length]} strokeWidth={picked === it.k ? 26 : 20}
                strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-o} transform="rotate(-90 70 70)"
                style={{ cursor: onPick ? "pointer" : "default", opacity: picked !== undefined && picked >= 0 && picked !== it.k ? 0.35 : 1 }}
                onClick={() => onPick?.(it.k)}
                onMouseEnter={e => showTip(e, `<b>${it.label}</b><br/>${fN(it.v)} cases (${((it.v / tot) * 100).toFixed(1)}%)`)}
                onMouseMove={e => showTip(e, `<b>${it.label}</b><br/>${fN(it.v)} cases (${((it.v / tot) * 100).toFixed(1)}%)`)}
                onMouseLeave={hideTip} />
            );
          })}
          <text x={70} y={66} textAnchor="middle" style={{ fontFamily: "Georgia,serif", fontSize: 19, fontWeight: 700, fill: "var(--ink)" }}>{fN(tot)}</text>
          <text x={70} y={82} textAnchor="middle" style={{ fontSize: 9.5, fill: "var(--mut)", letterSpacing: 1 }}>CASES</text>
        </svg>
        <div style={{ flex: 1, minWidth: 150 }}>
          {items.map((it, i) => (
            <div key={it.k} onClick={() => onPick?.(it.k)}
              onMouseEnter={e => showTip(e, `<b>${it.label}</b><br/>${fN(it.v)} cases (${((it.v / tot) * 100).toFixed(1)}%)`)}
              onMouseMove={e => showTip(e, `<b>${it.label}</b><br/>${fN(it.v)} (${((it.v / tot) * 100).toFixed(1)}%)`)} onMouseLeave={hideTip}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "3.5px 0", cursor: onPick ? "pointer" : "default", opacity: picked !== undefined && picked >= 0 && picked !== it.k ? 0.45 : 1 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: PAL[i % PAL.length], flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--ink)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{fN(it.v)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const donutOf = (get: (c: CaseRec) => number, names: string[], grouped?: (c: CaseRec) => string) => {
    const m = new Map<string, number>();
    rows.forEach(c => {
      const key = grouped ? grouped(c) : (get(c) >= 0 ? names[get(c)] : "Unknown");
      m.set(key, (m.get(key) ?? 0) + 1);
    });
    return [...m.entries()].map(([label, v], i) => ({ k: i, label, v })).sort((a, b) => b.v - a.v);
  };

  // ── monthly trend (opened vs closed) ──
  const trend = useMemo(() => {
    const m = new Map<string, { o: number; c: number }>();
    rows.forEach(c => {
      if (c.open >= 0) { const k = ymOf(c.open); if (!m.has(k)) m.set(k, { o: 0, c: 0 }); m.get(k)!.o++; }
      if (c.closed >= 0) { const k = ymOf(c.closed); if (!m.has(k)) m.set(k, { o: 0, c: 0 }); m.get(k)!.c++; }
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  // ── area table ──
  const [areaSortKey, setAreaSortKey] = useState<"total" | "open" | "closed">("total");
  const areaTable = useMemo(() => {
    const m = new Map<number, { t: number; o: number; c: number }>();
    rows.forEach(c => {
      const k = c.area;
      if (!m.has(k)) m.set(k, { t: 0, o: 0, c: 0 });
      const e = m.get(k)!;
      e.t++; if (isClosed(c)) e.c++; else e.o++;
    });
    return [...m.entries()]
      .map(([k, e]) => ({ k, name: k >= 0 ? CM.AREA[k] : "Unknown", total: e.t, open: e.o, closed: e.c }))
      .sort((a, b) => (areaSortKey === "total" ? b.total - a.total : areaSortKey === "open" ? b.open - a.open : b.closed - a.closed));
  }, [rows, areaSortKey]);

  // ── records ──
  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(c => c.caseNo.toLowerCase().includes(s) || c.account.toLowerCase().includes(s));
  }, [rows, q]);
  const PER = 25;
  const pages = Math.max(Math.ceil(searched.length / PER), 1);
  const shown = searched.slice((page - 1) * PER, page * PER);
  useEffect(() => { setPage(1); }, [rows, q]);

  const FSel = ({ label, value, onChange, names }: { label: string; value: number; onChange: (v: number) => void; names: string[] }) => (
    <div>
      <div style={SELLBL}>{label}</div>
      <select style={SEL} value={value} onChange={e => onChange(Number(e.target.value))}>
        <option value={-1}>All</option>
        {names.map((n, i) => <option key={i} value={i}>{n}</option>)}
      </select>
    </div>
  );

  const statusName = (c: CaseRec) => (c.sta >= 0 ? CM.STA[c.sta] : "—");

  return (
    <div className="sw-inv" style={{ minHeight: "100vh" }}>
      <div className="tv-zoom-desktop">
      {/* Header */}
      <div style={{ background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)", padding: "16px 22px 14px", borderBottom: "3px solid var(--gold)" }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 20, color: "#fff", fontWeight: 700 }}>Case Management</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 2 }}>
          {fN(CASES.length)} customer cases · data as on {CM.meta.asOn}
        </div>
        {/* Filter bar */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, marginTop: 12 }}>
          <FSel label="Project" value={prj} onChange={setPrj} names={CM.PRJ} />
          <FSel label="Case type" value={typ} onChange={setTyp} names={CM.TYP} />
          <FSel label="Case origin" value={org} onChange={setOrg} names={CM.ORG} />
          <FSel label="Case owner" value={own} onChange={setOwn} names={CM.OWN} />
          <FSel label="Applicability" value={app} onChange={setApp} names={CM.APP} />
          <div>
            <div style={SELLBL}>Period (opened)</div>
            <div style={{ display: "inline-flex", background: "rgba(255,255,255,.12)", borderRadius: 999, padding: 3, gap: 2 }}>
              {([["all", "All time"], ["y", "Year"], ["m", "Month"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setPerMode(k)}
                  style={{ border: "none", background: perMode === k ? GOLD : "transparent", color: "#fff", fontWeight: 700, fontSize: 11.5, padding: "6px 14px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {perMode !== "all" && (
            <div>
              <div style={SELLBL}>{perMode === "y" ? "Financial year" : "Month"}</div>
              <select style={SEL} value={perSel} onChange={e => setPerSel(e.target.value)}>
                {perOptions.map(k => <option key={k} value={k}>{perMode === "y" ? fyLbl(Number(k)) : ymLbl(k)}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "16px 20px 40px" }}>
        {/* KPI strip — reference: Total / Open / Closed / Overdue / At risk + avg age */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 12, marginBottom: 14 }}>
          <KPI k="Total cases" v={fN(total)} s={scopeLabel || "all time"} active={sta === "all" && !tatF && ageF < 0} onClick={() => { setSta("all"); setTatF(""); setAgeF(-1); }} />
          <KPI k="Open cases" v={fN(openT)} s={`${total ? ((openT / total) * 100).toFixed(1) : 0}% of total`} color={AMBER} active={sta === "open" && !tatF} onClick={() => { setSta("open"); setTatF(""); setAgeF(-1); }} />
          <KPI k="Closed cases" v={fN(closedT)} s={`${total ? ((closedT / total) * 100).toFixed(1) : 0}% closure`} color={GREEN} active={sta === "closed"} onClick={() => { setSta("closed"); setTatF(""); setAgeF(-1); }} />
          <KPI k="Overdue (beyond TAT)" v={fN(overdue)} s="open cases past TAT" color={RED} active={tatF === "overdue"} onClick={() => { setSta("open"); setTatF(tatF === "overdue" ? "" : "overdue"); setAgeF(-1); }} />
          <KPI k="At risk (escalation)" v={fN(atRisk)} s="open, in escalation levels" color={GOLD} active={tatF === "atrisk"} onClick={() => { setSta("open"); setTatF(tatF === "atrisk" ? "" : "atrisk"); setAgeF(-1); }} />
          <KPI k="Avg open age" v={`${avgOpenAge.toFixed(1)} d`} s="mean age of open cases" color={NAVY} />
        </div>

        <div><Banner title="CASE ANALYSIS" sub={`${fN(rows.length)} cases in view · ${scopeLabel || "all time"}`} /></div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 14 }}>
          <Zoomable title="Case type">
            <div style={{ ...CARD, marginBottom: 0, height: "100%" }}>
              <h3 style={H3}>Case type</h3>
              <div style={CAP}>click a slice → filter</div>
              <Donut items={donutOf(c => c.typ, CM.TYP)} onPick={k => {
                const label = donutOf(c => c.typ, CM.TYP)[k]?.label;
                const idx = CM.TYP.indexOf(label);
                setTyp(typ === idx ? -1 : idx);
              }} />
            </div>
          </Zoomable>
          <Zoomable title="Status">
            <div style={{ ...CARD, marginBottom: 0, height: "100%" }}>
              <h3 style={H3}>Status</h3>
              <div style={CAP}>Closed groups Closed/Resolved/Close · click → open/closed view</div>
              <Donut items={donutOf(c => c.sta, CM.STA, c => (isClosed(c) ? "Closed" : statusName(c)))}
                onPick={k => {
                  const label = donutOf(c => c.sta, CM.STA, cc => (isClosed(cc) ? "Closed" : statusName(cc)))[k]?.label;
                  setSta(label === "Closed" ? (sta === "closed" ? "all" : "closed") : (sta === "open" ? "all" : "open"));
                }} />
            </div>
          </Zoomable>
          <Zoomable title="Case origin">
            <div style={{ ...CARD, marginBottom: 0, height: "100%" }}>
              <h3 style={H3}>Case origin</h3>
              <div style={CAP}>click a row → filter</div>
              {(() => {
                const items = donutOf(c => c.org, CM.ORG);
                const mx = Math.max(...items.map(i => i.v), 1);
                return items.map(it => {
                  const idx = CM.ORG.indexOf(it.label);
                  return (
                    <div key={it.label} className="barrow" onClick={() => setOrg(org === idx ? -1 : idx)}
                      onMouseEnter={e => showTip(e, `<b>${it.label}</b><br/>${fN(it.v)} cases`)}
                      onMouseMove={e => showTip(e, `<b>${it.label}</b><br/>${fN(it.v)} cases`)} onMouseLeave={hideTip}
                      style={{ padding: "4px 0", cursor: "pointer", opacity: org >= 0 && org !== idx ? 0.45 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                        <span style={{ color: "var(--ink)", fontWeight: 600 }}>{it.label}</span>
                        <span style={{ color: "var(--mut)" }}>{fN(it.v)}</span>
                      </div>
                      <div style={{ height: 8, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(it.v / mx) * 100}%`, background: TEAL, borderRadius: 5 }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </Zoomable>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 14, marginTop: 14 }}>
          <Zoomable title="Cases by owner">
            <div style={{ ...CARD, marginBottom: 0, height: "100%" }}>
              <h3 style={H3}>Cases by owner</h3>
              <div style={CAP}>top 15 · gold = open portion · click → filter owner</div>
              {(() => {
                const m = new Map<number, { t: number; o: number }>();
                rows.forEach(c => { if (c.own < 0) return; if (!m.has(c.own)) m.set(c.own, { t: 0, o: 0 }); const e = m.get(c.own)!; e.t++; if (!isClosed(c)) e.o++; });
                const items = [...m.entries()].sort((a, b) => b[1].t - a[1].t).slice(0, 15);
                const mx = Math.max(...items.map(([, e]) => e.t), 1);
                return items.map(([k, e]) => (
                  <div key={k} className="barrow" onClick={() => setOwn(own === k ? -1 : k)}
                    onMouseEnter={ev => showTip(ev, `<b>${CM.OWN[k]}</b><br/>Total — ${fN(e.t)}<br/>Open — ${fN(e.o)} · Closed — ${fN(e.t - e.o)}`)}
                    onMouseMove={ev => showTip(ev, `<b>${CM.OWN[k]}</b><br/>Total — ${fN(e.t)}<br/>Open — ${fN(e.o)} · Closed — ${fN(e.t - e.o)}`)}
                    onMouseLeave={hideTip}
                    style={{ padding: "3.5px 0", cursor: "pointer", opacity: own >= 0 && own !== k ? 0.45 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                      <span style={{ color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{CM.OWN[k]}</span>
                      <span style={{ color: "var(--mut)", whiteSpace: "nowrap" }}>{fN(e.t)} <span style={{ color: GOLD }}>({fN(e.o)} open)</span></span>
                    </div>
                    <div style={{ height: 8, background: "#f0ede5", borderRadius: 5, overflow: "hidden", position: "relative" }}>
                      <div style={{ position: "absolute", inset: 0, width: `${(e.t / mx) * 100}%`, background: TEAL, borderRadius: 5 }} />
                      <div style={{ position: "absolute", inset: 0, width: `${(e.o / mx) * 100}%`, background: GOLD, borderRadius: 5 }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </Zoomable>
          <Zoomable title="Cases by ageing">
            <div style={{ ...CARD, marginBottom: 0, height: "100%" }}>
              <h3 style={H3}>Open cases by ageing</h3>
              <div style={CAP}>days since opened · open cases only · click a band → filter</div>
              {(() => {
                const m = new Map<number, number>();
                base.filter(c => !isClosed(c) && (!tatF || tatBucket(c) === tatF)).forEach(c => { const b = ageBand(c.age); m.set(b, (m.get(b) ?? 0) + 1); });
                const mx = Math.max(...AGE_BANDS.map(b => m.get(b.k) ?? 0), 1);
                return AGE_BANDS.map(b => {
                  const v = m.get(b.k) ?? 0;
                  return (
                    <div key={b.k} className="barrow" onClick={() => { setSta("open"); setAgeF(ageF === b.k ? -1 : b.k); }}
                      onMouseEnter={e => showTip(e, `<b>${b.label}</b><br/>${fN(v)} open cases`)}
                      onMouseMove={e => showTip(e, `<b>${b.label}</b><br/>${fN(v)} open cases`)} onMouseLeave={hideTip}
                      style={{ padding: "5px 0", cursor: "pointer", opacity: ageF >= 0 && ageF !== b.k ? 0.45 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                        <span style={{ color: "var(--ink)", fontWeight: 600 }}>{b.label}</span>
                        <span style={{ color: "var(--mut)" }}>{fN(v)}</span>
                      </div>
                      <div style={{ height: 9, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(v / mx) * 100}%`, background: b.k >= 4 ? RED : b.k >= 2 ? AMBER : GREEN, borderRadius: 5 }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </Zoomable>
        </div>

        {/* Monthly trend */}
        <Zoomable title="Monthly opened vs closed">
        <div style={{ ...CARD, marginTop: 14 }}>
          <h3 style={H3}>Monthly opened vs closed</h3>
          <div style={CAP}>teal = opened · green = closed in that month</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 170, overflowX: "auto", paddingBottom: 4 }}>
            {(() => {
              const mx = Math.max(...trend.map(([, v]) => Math.max(v.o, v.c)), 1);
              return trend.map(([k, v]) => (
                <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 44 }}
                  onMouseEnter={e => showTip(e, `<b>${ymLbl(k)}</b><br/>Opened — ${fN(v.o)}<br/>Closed — ${fN(v.c)}`)}
                  onMouseMove={e => showTip(e, `<b>${ymLbl(k)}</b><br/>Opened — ${fN(v.o)}<br/>Closed — ${fN(v.c)}`)} onMouseLeave={hideTip}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 130 }}>
                    <div style={{ width: 15, height: `${(v.o / mx) * 100}%`, background: TEAL, borderRadius: "3px 3px 0 0", minHeight: 2 }} />
                    <div style={{ width: 15, height: `${(v.c / mx) * 100}%`, background: GREEN, borderRadius: "3px 3px 0 0", minHeight: 2 }} />
                  </div>
                  <span style={{ fontSize: 9.5, color: "var(--mut)", whiteSpace: "nowrap" }}>{ymLbl(k)}</span>
                </div>
              ));
            })()}
          </div>
        </div>
        </Zoomable>

        {/* Area table */}
        <Zoomable title="Cases by area">
        <div style={{ ...CARD }}>
          <h3 style={H3}>Cases by area</h3>
          <div style={CAP}>click a column heading to sort</div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #eae6da", position: "sticky", top: 0, background: "#fff" }}>
                  <th style={{ textAlign: "left", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "7px 8px 7px 0" }}>Area</th>
                  {(["total", "open", "closed"] as const).map(k => (
                    <th key={k} onClick={() => setAreaSortKey(k)}
                      style={{ textAlign: "right", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: areaSortKey === k ? TEAL : "var(--mut)", padding: "7px 8px", cursor: "pointer", userSelect: "none" }}>
                      {k}{areaSortKey === k ? " ↓" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {areaTable.map(r => (
                  <tr key={r.k} style={{ borderBottom: "1px solid #f0ede5" }}
                    onMouseEnter={e => showTip(e, `<b>${r.name}</b><br/>Total — ${fN(r.total)}<br/>Open — ${fN(r.open)} · Closed — ${fN(r.closed)}`)}
                    onMouseMove={e => showTip(e, `<b>${r.name}</b><br/>Total — ${fN(r.total)}`)} onMouseLeave={hideTip}>
                    <td style={{ padding: "7px 8px 7px 0", color: "var(--ink)", fontWeight: 600 }}>{r.name}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right" }}>{fN(r.total)}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", color: AMBER, fontWeight: 700 }}>{fN(r.open)}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", color: GREEN, fontWeight: 700 }}>{fN(r.closed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </Zoomable>

        {/* Records */}
        <div><Banner title="CASE RECORDS" sub={`${fN(searched.length)} in scope · click a row for full detail`} /></div>
        <div style={{ ...CARD }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search case number or account name…"
            style={{ width: "100%", boxSizing: "border-box", fontSize: 13, padding: "9px 12px", border: "1px solid #d8d2c4", borderRadius: 9, marginBottom: 12, fontFamily: "inherit" }} />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 760 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #eae6da" }}>
                  {["Case no.", "Account", "Opened", "Status", "Type", "Project", "Owner", "Age (d)"].map(h => (
                    <th key={h} style={{ textAlign: "left", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "7px 10px 7px 0", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((c, i) => (
                  <tr key={`${c.caseNo}-${i}`} onClick={() => setDetail(c)}
                    style={{ borderBottom: "1px solid #f0ede5", cursor: "pointer" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                    <td style={{ padding: "7px 10px 7px 0", fontWeight: 700, color: TEAL, whiteSpace: "nowrap" }}>{c.caseNo}</td>
                    <td style={{ padding: "7px 10px 7px 0", maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.account || "—"}</td>
                    <td style={{ padding: "7px 10px 7px 0", whiteSpace: "nowrap" }}>{fmtDay(c.open)}</td>
                    <td style={{ padding: "7px 10px 7px 0" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px", background: isClosed(c) ? "#e2f3ec" : "#fdf1dc", color: isClosed(c) ? "#1a7a4a" : "#b06c00" }}>{statusName(c)}</span>
                    </td>
                    <td style={{ padding: "7px 10px 7px 0", whiteSpace: "nowrap" }}>{c.typ >= 0 ? CM.TYP[c.typ] : "—"}</td>
                    <td style={{ padding: "7px 10px 7px 0", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.prj >= 0 ? CM.PRJ[c.prj] : "—"}</td>
                    <td style={{ padding: "7px 10px 7px 0", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.own >= 0 ? CM.OWN[c.own] : "—"}</td>
                    <td style={{ padding: "7px 10px 7px 0" }}>{c.age >= 0 ? c.age : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 12.5 }}>
            <span style={{ color: "var(--mut)" }}>Page {page} of {fN(pages)}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid #d8d2c4", background: "#fff", cursor: page <= 1 ? "default" : "pointer", fontFamily: "inherit", opacity: page <= 1 ? 0.5 : 1 }}>‹ Prev</button>
              <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid #d8d2c4", background: "#fff", cursor: page >= pages ? "default" : "pointer", fontFamily: "inherit", opacity: page >= pages ? 0.5 : 1 }}>Next ›</button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Detail slide-over */}
      <AnimatePresence>
        {detail && (
          <>
            <motion.div key="cmov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              onClick={() => setDetail(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.35)", zIndex: 80 }} />
            <motion.div key="cmdw" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(440px, 92vw)", zIndex: 81, background: "#f6f4ef", boxShadow: "-14px 0 46px rgba(20,33,61,.35)", display: "flex", flexDirection: "column" }}>
              <div style={{ background: NAVY, padding: "16px 20px", borderBottom: "3px solid var(--gold)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", color: "#c9b27c" }}>CASE RECORD</div>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 700, color: "#fff", marginTop: 2 }}>{detail.caseNo}</div>
                </div>
                <button onClick={() => setDetail(null)} aria-label="Close"
                  style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 8, fontSize: 15, cursor: "pointer", flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 26px" }}>
                {([
                  ["Account", detail.account || "—"],
                  ["Opened", fmtDay(detail.open)],
                  ["Closed", fmtDay(detail.closed)],
                  ["Status", statusName(detail)],
                  ["Case type", detail.typ >= 0 ? CM.TYP[detail.typ] : "—"],
                  ["Priority", detail.pri >= 0 ? CM.PRI[detail.pri] : "—"],
                  ["Origin", detail.org >= 0 ? CM.ORG[detail.org] : "—"],
                  ["TAT status", detail.tat >= 0 ? CM.TAT[detail.tat] : "Within time"],
                  ["Area", detail.area >= 0 ? CM.AREA[detail.area] : "—"],
                  ["Sub area", detail.subArea >= 0 ? CM.SUBA[detail.subArea] : "—"],
                  ["Project", detail.prj >= 0 ? CM.PRJ[detail.prj] : "—"],
                  ["Case owner", detail.own >= 0 ? CM.OWN[detail.own] : "—"],
                  ["Applicability", detail.app >= 0 ? CM.APP[detail.app] : "—"],
                  ["Age", detail.age >= 0 ? `${detail.age} days` : "—"],
                  ["Reassignments", String(detail.reassigns)],
                  ["HNI customer", detail.hni ? "Yes" : "No"],
                  ["Active legal case", detail.legal ? "Yes" : "No"],
                ] as const).map(([k, v]) => (
                  <div key={k} style={{ padding: "9px 0", borderBottom: "1px solid #eae6da" }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginTop: 3, wordBreak: "break-word" }}>{v}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
